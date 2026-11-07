# Eventra Phase 2: booking and transaction security

## Scope and verification

Phase 1 authentication, OTP protection, CORS, JWT/session versioning and rate limits
remain in place. No dependencies were installed and actual .env files were not
changed. There is no separate Payment or Ticket model in the existing app;
Booking remains the payment record and one QR pass represents an entire booking.

The inspected local MongoDB is standalone (no replica set or mongos), so this
implementation does not rely on multi-document transactions. It uses conditional
single-document Event updates plus a durable recovery protocol.

Automated tests use real Express, MongoDB, JWT and bcrypt. Stripe network calls
are mocked; raw webhook signatures are generated/verified using the installed
Stripe SDK. These tests are not a real Stripe sandbox or production verification.

## Booking/payment workflow

1. A verified Customer sends POST /api/bookings with eventId, locationId,
   ticketTierId, ticketQuantity and optional contact fields. Idempotency-Key is
   required (16-128 letters, digits, underscores or hyphens).
2. Backend validates publication, approval, activity, cancellation, UTC event and
   selected-location times, booking closing time, tier expiry, integer quantity,
   price and available stock. Client price/payment/status/QR assertions are rejected.
3. Backend creates a PENDING Booking with immutable request fingerprint and trusted
   money/time snapshots. A conditional Event update reserves stock and appends its
   journal entry atomically. No usable pass is issued.
4. The Customer creates Checkout using { bookingId }. Backend snapshots the Stripe
   parameters and uses a stable Stripe idempotency key. The current frontend
   redirects to hosted Checkout; it never collects card numbers.
5. Stripe returns the Customer to My Tickets. The frontend asks the backend to
   verify status; a redirect or success query string is not proof of payment.
6. The backend retrieves Stripe data and checks object binding, booking/customer/
   event/location/tier metadata, quantity, amount, currency, mode and payment state.
   Paid Checkout also requires its successful PaymentIntent and captured charge.
   Captured amount, refund records and net refund state are checked; a completed free
   Checkout is accepted only with a zero total and no_payment_required.
7. Only trusted success can atomically consume a still-valid hold. The Booking
   then becomes CONFIRMED/paid and receives one cryptographically random group QR.
8. Failed, cancelled or expired holds are released. Late captured payments are
   refunded idempotently; released/resold stock is never consumed again.

POST /api/payment/create-payment-intent remains available for direct Stripe
clients, but the React UI uses the existing Checkout endpoint. Direct clients
must complete the intent through Stripe and use server confirmation.

## Money and statuses

All current payments use USD, with integer cents for verification/calculation:

- subtotal = trusted tier unit price times quantity
- platformFee = rounded 5% of subtotal
- totalAmount = subtotal + platformFee
- organizerRevenue = subtotal (before external Stripe processing costs)

This corrects the previous mismatch between customer charge and recorded totals.
These are revenue figures, not automated organizer payouts.

Booking statuses: PENDING, CONFIRMED, FAILED, CANCELLED, EXPIRED.
Payment statuses retain the existing pending/paid/failed/refunded convention.
Ticket statuses: PENDING, VALID, USED, CANCELLED.
Reservation state is recovery metadata, not a second customer booking status.

## Standalone-safe inventory protocol

Nested location.ticketTiers is canonical when locations exist. Legacy top-level
ticketTypes is supported when locations are absent. For nested inventory, the
legacy ticketTypes mirror is derived from the updated canonical locations in the
same atomic operation.

- Reserve: available -= quantity; reserved += quantity; append HELD journal entry.
- Confirm: reserved -= quantity; sold += quantity; mark journal CONSUMED.
- Release unpaid hold: available += quantity; reserved -= quantity; mark RELEASED.
- Verified full refund: available += quantity; sold -= quantity; mark RELEASED.

Updates bind event, location and tier together and require the expected journal
state. There is no aggregate-only fallback. Guarded counters cannot be decremented
below zero by these operations.

The Event journal is the authority for inventory effects. Booking is a recoverable
projection. This is eventual cross-document consistency, not a MongoDB transaction.
A crash between Event and Booking updates is repaired by the journal and periodic
maintenance without repeating reserve/consume/release. Tests inject failures at
each of those projection boundaries.

BOOKING_RESERVATION_MINUTES defaults to 30. Deadlines are also capped by event/
location start, tier expiry and optional bookingClosesAt. Maintenance runs every
BOOKING_MAINTENANCE_SECONDS (30 by default). New booking requests also reclaim due
holds for that event without waiting for the worker.

Stripe Checkout has its own expiration constraints. The local deadline remains
authoritative and the worker expires the Stripe session; a payment received after
local release is refunded rather than granted a ticket. Failed provider calls
remain durable reconciliation work and are retried. The backend must stay running
for periodic work; signed webhooks and status checks also reconcile payments.

The journal is deliberately bounded by BOOKING_JOURNAL_LIMIT (5000 by default) to
avoid unbounded Event documents. At the limit, new reservations fail closed.
Do not prune journal entries or rebuild stock from capacity manually. Large/high
volume events need a reviewed archival/transactional-ledger strategy.

## Authorization and response data

- Customer booking reads, confirmation, cancellation and payment initiation require
  ownership. My Tickets always filters by authenticated customer ID.
- Organizer reads require both booking tenant and actual Event ownership.
- Super Admin retains booking-read/admin transaction access.
- Check-in remains Organizer-only under the existing role rules; no new staff or
  superadmin scanning privilege is invented.
- Booking responses use an allowlist. Request fingerprints, Stripe parameters and
  internal provider references are not included in history or organizer responses.
- Unconfirmed/unverified records do not expose QR tokens.
- Events with booking/reservation history cannot be physically deleted by the
  existing organizer delete action.

## Webhooks, retries and compensation

/api/payment/webhook and /api/payments/webhook are mounted after CORS and before
express.json/urlencoded. A raw Buffer, valid signature and matching test/live mode
are mandatory. There is no unsigned or mock fallback.

StripeWebhookEvent stores unique event IDs and processing leases. A completed
duplicate is acknowledged. A concurrent/incomplete event returns a retriable
failure; expired leases can be reclaimed. Payment and inventory operations are
independently idempotent, including after a worker/process interruption.

Handled events include payment_intent.succeeded/payment_failed/canceled and
checkout.session.completed/expired/async_payment_succeeded/async_payment_failed,
charge.refunded and refund.created/updated/failed.
The current implementation retrieves trusted Stripe state, so stale/out-of-order
failure notifications do not overwrite confirmed payments.

Refund calls use stable idempotency keys. An admin refund first invalidates the
unused Booking pass atomically. Sold stock is restored only after the provider
reports a successful full refund. Pending/failed provider operations remain
flagged for reconciliation. Used passes are rejected by this admin action.
Mismatched Stripe payments are not confirmed or blindly refunded; they are flagged
for manual review. Refunds created outside Eventra are retrieved from Stripe and
invalidate the group pass. Fully successful refunds are recorded as refunded;
pending/partial/failed external refunds quarantine the booking for reconciliation.
Unused seats are released only after the pass is atomically invalidated; already
admitted seats are never returned to sale. Partial/failed external refunds require
manual financial resolution and never trigger an extra automatic refund. This is
a security quarantine, not per-attendee partial-refund functionality.

## QR admission

Only a verified CONFIRMED/paid Booking has a usable TKT-<64 random hex digits>
token. QR content has no contact or payment data. Verification requires eventId,
checks organizer/event ownership and event eligibility, and atomically changes
VALID/not-checked-in to USED/checked-in.

One pass admits the entire ticketQuantity together. Partial group entry and
per-attendee tickets are not implemented. Used, wrong-event, invalid, cancelled,
failed or expired bookings cannot admit attendees. Booking IDs and MongoDB IDs
are no longer accepted as substitute admission tokens.

## Database compatibility

New fields include trusted money/payment references, verification timestamps,
reservation deadlines/recovery state, request fingerprint/key, refund flags,
externalRefundDetected and refundedAmount.
Event tiers gain reservedQuantity and Events gain the private reservationJournal,
activity/cancellation flags and optional bookingClosesAt.

Indexes add customer/request-key uniqueness and provider-object uniqueness for new
paymentVersion=2 records. Existing records/indexes are not deleted or rebuilt.

The existing non-sparse unique qrCodeString index needs a unique value on each
pending document. PENDING:<booking ObjectId> is an internal booking reference that
preserves this index. It is not a ticket, is never sent to clients as a pass, and
is never accepted at check-in. It is replaced by the real QR only after payment.

Legacy paid labels/old demo payment IDs are not proof of payment. Legacy bookings
remain stored/readable but do not gain a valid pass automatically. Review genuine
historic payments and existing inventory separately; no automatic data migration,
restocking or deletion is performed.

Previously created pending/rejected events no longer appear publicly or accept
bookings. Approve an event through the existing admin workflow before testing.

## API contracts

- POST /api/bookings: pending creation; Idempotency-Key required.
- GET /api/bookings/my-bookings: own safe booking states and verified passes.
- GET /api/bookings/:bookingId: owner/owning organizer/admin only.
- POST /api/bookings/:bookingId/confirm: own booking; empty body; backend retrieves
  Stripe status. Returns { booking }, which can still be pending.
- POST /api/bookings/:bookingId/cancel: own pending booking only; returns 200 or
  202 if provider reconciliation remains pending.
- POST /api/payment/create-checkout-session: { bookingId }, returns URL/session ID
  and safe Booking state.
- POST /api/payment/create-payment-intent: { bookingId }, returns client secret/
  intent ID and safe Booking state.
- Payment initiation also supports event-selection payloads with Idempotency-Key
  for compatible API clients. Price/payment assertions remain prohibited.
- /api/payments aliases remain available.
- POST /api/bookings/verify-ticket and /api/tickets/verify or /check-in: Organizer
  must send eventId plus ticketToken (or existing QR token field aliases).
- Admin refund endpoint now performs a verified provider refund, not a DB-only
  payment-status change; 202 means still awaiting reconciliation.
- Public event lists require approved/published/active upcoming events.

## Environment and manual verification

Actual .env files must be configured privately; they are not overwritten.

Existing required Stripe names: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
Use matching TEST mode key/signing secret during development. CLIENT_URL must
match an allowed frontend origin. Existing Phase 1 JWT/SMTP/CORS settings remain
required as documented in .env.example.

New settings: BOOKING_RESERVATION_MINUTES, BOOKING_MAX_TICKETS,
BOOKING_JOURNAL_LIMIT, BOOKING_MAINTENANCE_SECONDS,
EVENT_TIMEZONE_OFFSET_MINUTES.

Existing UTC dates are unchanged. New date+clock schedules use the configured
fixed offset (default +330 minutes for Sri Lanka); explicit ISO timestamps must
include Z or an offset. DST/timezone-specific schedules should use explicit ISO
timestamps, not a server-local clock.

Manual test sequence:
1. Configure Stripe TEST mode and matching webhook secret privately.
2. Forward Stripe webhooks to localhost:5000/api/payment/webhook with the Stripe
   CLI, or configure a development endpoint. Subscribe to the handled events.
3. Create/approve a future event with a small stock of tickets.
4. Log in as an authorized Customer. Complete actual Eventra Checkout using a
   Stripe test card. Verify pending -> confirmed, exact charged total, My Tickets
   QR and organizer inventory/revenue.
5. Try a declined test payment, cancellation, and reservation expiry. Verify stock
   release and no QR. Shorten the local reservation setting only in development.
6. Use two Customer sessions to compete for the last ticket.
7. Resend the same actual Stripe event from the Stripe dashboard/CLI and confirm
   no extra stock change, Booking or QR.
8. Select the event in Organizer verification. Check a token twice and concurrently,
   and try it for a different event/organizer.
9. Verify a pending/successful admin refund with Stripe TEST mode. Also refund a
   charge in Stripe directly: the pass must become invalid, unused seats return
   once, and already-admitted seats must not return to sale. Partial or failed
   external refunds must show manual-review state.
10. Review worker/reconciliation behavior during a temporary provider outage.

Do not treat a generic stripe trigger event without Eventra booking metadata as
a successful end-to-end booking test.

## Tests

npm test in backend runs Phase 1 and Phase 2. npm test in frontend runs session
and booking-state tests. No packages are installed by these commands.

All tests use loopback MongoDB databases with eventra_auth_test_* or
eventra_booking_test_* prefixes and unique case names. They are retained for
inspection. No drop/delete operations occur in the current test suites.

The missing-account auth check uses a nonexistent ID rather than deleting a
fixture. The first development run exposed one overlapping fixture update;
it was corrected and regression-tested. Automated Stripe calls are mocked.
Interactive browser, real SMTP, real Stripe test-mode charges/refunds, deployment
and production load remain manual verification steps.

## Verification at implementation handoff

The final full regression run passed 111 backend cases (37 Phase 1 and 74 Phase 2)
and 19 frontend cases (9 session and 10 booking-state cases), with no failures or
skips. The frontend production build passed. All 21 modified backend JavaScript
files passed syntax checks and recommended ESLint checks; all 7 modified frontend
JavaScript/JSX files passed the existing ESLint configuration with no warnings. Tests remain mocked for Stripe network calls; real Stripe sandbox,
interactive browser and production/load verification are still required.

All modified backend and frontend JavaScript is lint-checked. Full-project lint
still contains existing issues in Home and registration unrelated to Phase 2.

## Phase 2 file inventory

Created:

- `backend/config/bookingSecurity.js`
- `backend/services/stripeGateway.js`
- `backend/models/StripeWebhookEvent.js`
- `backend/utils/bookingResponse.js`
- `backend/services/inventoryService.js`
- `backend/services/bookingService.js`
- `backend/services/paymentService.js`
- `backend/services/bookingMaintenance.js`
- `backend/tests/booking.test.js`
- `backend/PHASE_2.md`
- `frontend/src/api/bookingState.js`
- `frontend/tests/bookingState.test.js`

Modified existing files:

- `backend/models/booking.js`
- `backend/models/event.js`
- `backend/controllers/bookingController.js`
- `backend/controllers/paymentController.js`
- `backend/controllers/eventController.js`
- `backend/controllers/analyticsController.js`
- `backend/controllers/adminController.js`
- `backend/routes/bookingRoutes.js`
- `backend/routes/paymentRoutes.js`
- `backend/utils/dateUtils.js`
- `backend/server.js`
- `backend/package.json`
- `backend/.env.example`
- `backend/tests/auth.test.js`
- `backend/tests/README.md`
- `frontend/src/component/bookingModal.jsx`
- `frontend/src/component/ticketVerifier.jsx`
- `frontend/src/pages/myTickets.jsx`
- `frontend/src/pages/organizerDashboard.jsx`
- `frontend/src/pages/adminDashboard.jsx`
- `frontend/package.json`

Unrelated pre-existing frontend lint errors: src/pages/home.jsx lines 49-50
(react-hooks/immutability), src/pages/register.jsx line 28 (unused assignedRole)
and line 50 (two unnecessary escapes). Five errors, zero warnings. These files
were not changed for Phase 2. No package lockfile or actual .env was modified.
