# Booking Index Startup Diagnostic

Date: 2026-11-06

## Status

Root cause confirmed against the configured local database. Startup diagnostics and explicit critical-index enforcement were corrected without changing index definitions. The original investigation left business data unchanged; the subsequently approved bookingId-only repair is recorded below and in LEGACY_BOOKING_REPAIR.md.

Update: the user approved the narrowly scoped repair. All nine missing bookingId fields have now been assigned, the configured database starts successfully, and its health check returned HTTP 200. See LEGACY_BOOKING_REPAIR.md for the verified backup, exact mappings, field-only comparisons and post-repair test results. The investigation below records the original pre-repair findings.

## Exact root cause and MongoDB error

MongoDB version: 8.2.1. Affected collection: event_saas.bookings.

All nine existing booking documents lack bookingId. The schema declares bookingId as a non-sparse unique single-field index. MongoDB indexes a missing value as null for this kind of index, so nine missing values conflict. See [MongoDB unique index documentation](https://www.mongodb.com/docs/manual/core/index-unique/).

Actual captured error:

```text
MongoServerError
code: 11000
codeName: DuplicateKey
Index build failed: 2bf01a81-2502-4332-99dc-4b039b3f6814:
Collection event_saas.bookings ( c4cead63-370c-4962-a258-8712923720a3 )
:: caused by :: E11000 duplicate key error collection: event_saas.bookings
index: bookingId_1 dup key: { bookingId: null }
keyPattern: { bookingId: 1 }
keyValue: { bookingId: null }
```

This is a legacy-data/index-compatibility problem. It is independent of the JWT and SMTP warnings.

## Startup path and files inspected

Before the change, server.js called connectDB(), then awaited Promise.all([Booking.init(), StripeWebhookEvent.init()]) before constructing/listening on the Express application. Its catch discarded the actual exception and printed only a generic message.

There was no separate production index initialization utility/service. Index creation was inline in server.js through Mongoose Model.init(). The authentication, booking and Phase 3 test suites also initialize indexes in isolated databases.

Inspected:

- backend/server.js
- backend/config/db.js
- backend/config/security.js
- backend/config/bookingSecurity.js
- backend/models/booking.js
- backend/models/StripeWebhookEvent.js
- Index declarations across backend/models, including Event, User, AuthRateLimit and Notification
- backend/services/bookingService.js
- backend/utils/sendEmail.js
- backend/package.json
- backend/tests/auth.test.js, booking.test.js, phase3.test.js and tests/README.md
- The new backend/tests/startupIndexes.test.js
- Live booking and webhook collection index metadata, document counts and bookingId-only duplicate/missing-field projections

No actual .env content or secret values were printed.

## Index audit

Mongoose reports ten booking schema indexes. Including MongoDB's automatic _id index, the complete collection should have eleven.

| Index | Required definition | Existing database |
| --- | --- | --- |
| _id_ | Unique MongoDB document identity | Present |
| bookingId_1 | Unique, non-sparse | Missing; creation fails on nine absent bookingIds |
| eventId_1 | Event lookup | Present |
| tenantId_1 | Organizer isolation lookup | Present |
| customerId_1 | Customer lookup | Present |
| reservationExpiresAt_1 | Reservation maintenance lookup | Present |
| qrToken_1 | Unique, sparse | Present |
| qrCodeString_1 | Unique | Present |
| customerId_1_requestKey_1 | Unique; partial on paymentVersion=2 and string requestKey | Present |
| stripePaymentIntentId_1 | Unique; partial on paymentVersion=2 and string intent ID | Present |
| stripeCheckoutSessionId_1 | Unique; partial on string session ID | Present |

StripeWebhookEvent has no additional schema indexes; its _id_ index is present and protects webhook event identity.

Findings:

- The bookingId path specifies unique:true and index:true, but Mongoose merges those into one declaration; this does not produce duplicate index definitions.
- No conflicting names/options were found among the existing booking indexes.
- Existing partial filters and compound index definitions match the schema.
- Existing unique QR/payment/idempotency indexes were not dropped, replaced or weakened.
- No syncIndexes(), dropIndex(), dropIndexes(), collection/database deletion or business-data modification was used.
- No automatic migration was added to startup.
- New v2 bookings already receive server-generated BKG references in bookingService.js; the nine affected documents have no paymentVersion field and are legacy records.
- Reinspection after startup attempts still found exactly nine bookings, all nine missing bookingId, with the same existing index names.

## Conflicting records and concrete repair proposal

Only record identifiers and proposed booking references are included; no customer or payment details.

| Existing _id | Proposed missing bookingId |
| --- | --- |
| 6ab011d92e233c3a901350a3 | BKG-LEGACY-6AB011D92E233C3A901350A3 |
| 6ab011ed2e233c3a901350ad | BKG-LEGACY-6AB011ED2E233C3A901350AD |
| 6ab011ef2e233c3a901350ba | BKG-LEGACY-6AB011EF2E233C3A901350BA |
| 6ab011f22e233c3a901350c7 | BKG-LEGACY-6AB011F22E233C3A901350C7 |
| 6ab012d52e233c3a901350d4 | BKG-LEGACY-6AB012D52E233C3A901350D4 |
| 6ab038f42e233c3a9013514d | BKG-LEGACY-6AB038F42E233C3A9013514D |
| 6ab03dc92e233c3a90135175 | BKG-LEGACY-6AB03DC92E233C3A90135175 |
| 6ab51c0d93be3b2cda51480d | BKG-LEGACY-6AB51C0D93BE3B2CDA51480D |
| 6ab51e8693be3b2cda51482f | BKG-LEGACY-6AB51E8693BE3B2CDA51482F |

Read-only collision preflight found zero existing bookings with any proposed reference.

Proposed migration, NOT executed:

1. Obtain explicit approval to add only bookingId to these nine existing bookings. The task currently prohibits modifying existing bookings.
2. Take a backup through the established database backup procedure and stop application writers.
3. Recheck the exact IDs, field absence, document count and proposed-reference collisions.
4. For each approved record, use a native conditional update matching its exact _id and bookingId: { $exists: false }, setting only the mapped bookingId. Do not replace documents or update timestamps, paymentVersion, ownership, payment state, amount, QR fields or inventory.
5. Abort and report if any predicate no longer matches; never overwrite a newly assigned reference.
6. Recheck all reference duplicates and absence. Build the unchanged unique bookingId index using ordinary index creation.
7. Run npm start and verify the configured database's indexes and health response.

The proposed references derive from already-unique _id values, fit the existing BKG reference format, and do not grant payment or ticket eligibility. Adding a sparse/partial exception instead would change index semantics, so that shortcut was not applied.

## Files modified and index changes

Modified:

- backend/server.js: preserve and log name, code, codeName, message, keyPattern and keyValue from the underlying error; explicitly call createIndexes() after init(); log successful critical-index initialization; keep process.exit(1) before app.listen on any failure.
- backend/package.json: include the new startup index regression suite.

Created:

- backend/tests/startupIndexes.test.js
- backend/BOOKING_INDEX_DIAGNOSTIC.md (this report)

Schema/index definitions changed: none.
Existing business records changed: none.
Database repair performed: none.
Required repair: the explicitly reviewed bookingId-only backfill above, subject to approval.

Explicit createIndexes() ensures required schema indexes even if Mongoose autoIndex is disabled. It adds required indexes only, never synchronizes away existing indexes. It can add other non-conflicting indexes before reporting a conflict; tests account for this and assert that existing indexes remain unchanged.

## Verification

- Initial configured-database npm start: MongoDB connection succeeded; startup failed safely with the actual E11000 details. No listening message appeared.
- Isolated npm start smoke test: succeeded using a newly named loopback test database, with process-scoped MONGO_URI/MONGO_URL/PORT overrides. No .env was edited.
- Smoke output included: MongoDB Connected: 127.0.0.1; Critical booking indexes initialized successfully; Server running on port 59973.
- GET http://127.0.0.1:59973/api/health returned HTTP 200 and { status: 'success', message: 'Backend is running' }.
- Smoke inspection verified all eleven booking indexes, bookingId uniqueness, idempotency uniqueness and the webhook _id index.
- Only the npm/server process tree created for the smoke test was stopped. Its isolated test database was retained.
- Backend syntax checks: passed across all backend JavaScript files.
- Modified backend JavaScript lint: passed for server.js and tests/startupIndexes.test.js.
- New index regression suite: four passed after correcting one test-only assertion. It covers autoIndex=false, idempotent repeated creation, E11000 for absent references, E11000 for explicit duplicate references, record preservation and conflicting-index preservation.
- The first full run passed the original 132 tests and three new tests; one new test initially assumed Mongoose would create no other indexes after encountering a conflict. The assertion was corrected to verify that all pre-existing indexes remain unchanged while allowing non-conflicting index creation.
- Final full backend suite: 136 passed; zero failures, cancellations or skips (final run approximately 100 seconds)..

Tests use generated isolated loopback databases and captured/mocked external services. They retain test databases; no actual customer bookings, payments, events or users were altered. Existing Phase 1 authentication and Phase 2 booking, inventory, payment/refund and QR tests remain included.

## JWT warning

The warning appears because the application is running outside production with a configured JWT_SECRET shorter than 32 bytes. The current secret was not printed. Production validation already rejects short/obviously weak secrets, and that validation is unchanged.

To generate a fresh secret privately for the current local PowerShell session, run this yourself:

```powershell
$env:JWT_SECRET = node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('hex'))"
```

This captures cryptographically random output into the current process environment instead of displaying it or editing .env. Child processes such as npm start inherit it. Closing the shell loses it; configure production through your deployment's secret manager. Do not commit or paste the value into logs/chat. Rotation invalidates tokens signed with the previous secret and should be coordinated.

No production secret was generated, displayed or changed during diagnosis.

## SMTP warning

The startup warning checks for missing SMTP_HOST or FROM_EMAIL. Email-dependent authentication still returns 503 until delivery is configured; OTP verification is not bypassed.

Configuration used by the existing implementation:

| Variable | Requirement |
| --- | --- |
| SMTP_HOST | Required SMTP server hostname |
| FROM_EMAIL | Required approved sender identity |
| SMTP_PORT | Optional, defaults to 587; valid range 1-65535 |
| SMTP_SECURE | Optional true/false; use true for implicit TLS when required by the provider, commonly port 465 |
| SMTP_USER | Required when the provider requires authentication |
| SMTP_PASS | Required together with SMTP_USER; both or neither for a trusted local relay |

For port 587 the existing transport normally starts with secure=false and negotiates STARTTLS when offered. Use your provider's documented configuration. Production requires SMTP_HOST and FROM_EMAIL, and paired credentials whenever authentication is used. Test sending through a local catcher or staging provider before production.

JWT and SMTP settings were inspected separately; neither causes the duplicate-key failure. No authentication, OTP, JWT or email security validation was disabled.

## Manual verification

Before approving any migration:

1. From backend, run npm start. Expect the detailed E11000 error and exit status 1 with the current unchanged data.
2. Inspect bookings with projection { _id: 1, bookingId: 1 } and filter { bookingId: { $exists: false } }; compare with the nine IDs above.
3. Inspect db.bookings.getIndexes(); bookingId_1 is currently absent, while QR/payment/idempotency indexes remain present.

After an explicitly approved reference-only repair:

1. Re-run the duplicate audit; expect no duplicate bookingId values and no missing references among the approved records.
2. Run npm test and backend syntax checks.
3. Run npm start against the intended configured database.
4. Confirm connection, critical-index-success and listening messages, in that order.
5. Inspect the unique bookingId_1 index and existing QR/payment/idempotency definitions.
6. Check /api/health and normal authenticated booking access. Legacy references must not create verified payments or valid tickets.
7. Resolve JWT/SMTP warnings independently using private configuration.

Resolved after explicit user approval: the nine-record bookingId-only repair and successful startup against the configured database are documented in LEGACY_BOOKING_REPAIR.md. No existing indexes or other business fields were changed.
