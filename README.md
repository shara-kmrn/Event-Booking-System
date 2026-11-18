# Eventra · Event Booking System

Eventra is a full-stack event management and ticketing application. Customers discover events, reserve tickets, and pay through Stripe Checkout. Organizers manage events and gate check-in, while administrators moderate events, manage accounts, and process refunds. The booking engine uses atomic MongoDB inventory updates and verifies payments server-side before issuing tickets.

## Features

| Role | Capabilities |
| --- | --- |
| **Customer** (`customer`) | Register with email verification, reset a password, and manage a profile. Browse approved upcoming events and filter by search term, category, location, or date. Check availability, reserve a ticket tier, complete Stripe Checkout, resume or cancel pending bookings, view and download eligible QR passes as SVG files, and submit and track complaints. |
| **Organizer** (`organizer`) | Create, edit, and cancel owned events with location schedules, ticket tiers, prices, and capacities. View event bookings, verified sales and revenue, and check-in history. Select an event and enter a QR token to verify and record group admission. |
| **Administrator** (`superadmin`) | View platform analytics and transactions, manage user roles and account status, assign organizer plans, approve, reject, or cancel events, maintain categories and venues, process eligible Stripe refunds, and respond to complaints. |

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, Vite 8, Tailwind CSS 4, React Router, Axios, Lucide React, `qrcode.react` |
| Backend | Node.js, Express 5, JavaScript ES modules, REST API |
| Database | MongoDB with Mongoose 9, using either a local instance or MongoDB Atlas |
| Authentication and email | JWT bearer tokens, bcrypt password hashing, email verification and password reset codes, Nodemailer over SMTP, MongoDB-backed rate limits |
| Payments | Stripe Checkout, PaymentIntent API, signed Stripe webhooks, server-side refund reconciliation |
| Deployment targets | Vercel for the Vite build, Render for the Express web service, MongoDB Atlas for hosted data |

## Architecture

The React SPA calls the Express API through Axios. Protected requests carry a bearer token. Express validates the token and loads the account from MongoDB before enforcing role and ownership rules. JWTs include an expiry, issuer, audience, and session version. Role changes and password resets invalidate earlier sessions.

Express uses Mongoose to store users, events, bookings, categories, venues, and complaints. Event documents hold ticket inventory and a reservation journal. Separate collections record Stripe webhook processing, queued email notifications, and authentication rate limits. Stripe sends payment events to Express, while Nodemailer delivers account and booking email through the configured SMTP provider.

```text
Event-Booking-System/
├── backend/
│   ├── config/          # MongoDB, authentication, CORS, booking settings
│   ├── controllers/    # HTTP request handlers
│   ├── middleware/     # Authentication, roles, and rate limits
│   ├── models/         # Mongoose schemas and indexes
│   ├── routes/         # REST endpoints
│   ├── services/       # Inventory, payments, reconciliation, notifications
│   ├── tests/          # API integration and startup index tests
│   ├── utils/          # Validation, email, and response helpers
│   ├── .env.example
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── public/          # Static assets
│   ├── src/
│   │   ├── api/         # Axios client, session, booking, and ticket helpers
│   │   ├── component/   # Booking modal, navigation, and gate verification
│   │   ├── context/     # Authentication and theme
│   │   └── pages/       # Event discovery, account pages, tickets, dashboards
│   ├── tests/          # Session, booking state, and ticket document tests
│   ├── .env.example
│   └── package.json
└── README.md
```

## Local setup

### Prerequisites

- Git, npm, and Node.js **22.13+ on the 22.x line**, or **24+**. Node.js **20.19+ on the 20.x line** also satisfies the checked package engine requirements.
- A running local MongoDB instance or a MongoDB Atlas connection string.
- An SMTP account or local mail catcher for registration, verification, and password reset.
- Stripe test credentials and a webhook signing secret to exercise payments.

### Installation

1. Clone the repository and install both packages.

   ```bash
   git clone https://github.com/shara-kmrn/Event-Booking-System.git
   cd Event-Booking-System
   npm --prefix backend ci
   npm --prefix frontend ci
   ```

2. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`. Use the settings below and supply secrets privately. Generate a random JWT secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
3. Start MongoDB and your mail catcher or configure your SMTP provider. For a Stripe test flow, forward signed test webhooks to `http://localhost:5000/api/payment/webhook` and configure both Stripe variables before starting the API.
4. Run the development servers in separate terminals from the repository root.

   ```bash
   npm --prefix backend run dev
   ```

   ```bash
   npm --prefix frontend run dev
   ```

5. Open `http://localhost:5173`. Check the API at `http://localhost:5000/api/health`. Register as a customer or organizer and verify the account through email. For an end-to-end booking, use an approved published event with a future schedule and available inventory. Public registration offers customer and organizer roles. Admin flows require an existing `superadmin` account provisioned outside public registration.

### Environment variables

#### Backend (`backend/.env`)

Example local settings with placeholders for secrets. Set the Stripe pair when exercising payments. A mail catcher can use an unauthenticated SMTP relay.

```dotenv
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/eventra
JWT_SECRET=<random-secret>
CLIENT_URL=http://localhost:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173

SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_SECURE=false
FROM_EMAIL=eventra@example.com
# SMTP_USER=<smtp-user>
# SMTP_PASS=<smtp-password>

# STRIPE_SECRET_KEY=sk_test_<replace-me>
# STRIPE_WEBHOOK_SECRET=whsec_<replace-me>
```

| Variable | Purpose and defaults |
| --- | --- |
| `NODE_ENV`, `PORT` | Production enables stricter configuration validation. The local port defaults to `5000`. |
| `MONGO_URI` or `MONGO_URL` | MongoDB connection string. The API checks `MONGO_URI` first. |
| `JWT_SECRET` | Required signing secret. Production requires a strong random secret of at least 32 bytes. |
| `JWT_TTL_SECONDS`, `JWT_ISSUER`, `JWT_AUDIENCE` | Defaults are `86400`, `eventra-api`, and `eventra-web`. |
| `CLIENT_URL`, `CORS_ALLOWED_ORIGINS` | Checkout return origin and comma-separated allowlist of exact frontend origins. CORS falls back to `CLIENT_URL`, then to localhost and 127.0.0.1 on port 5173 in development. Checkout falls back to the first allowed origin. |
| `TRUST_PROXY_HOPS` | Trusted reverse-proxy hop count. Defaults to `0`. |
| `SMTP_HOST`, `FROM_EMAIL` | SMTP server and sender. Required for email-dependent flows and at production startup. |
| `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Port defaults to `587` and implicit TLS defaults off. Supply SMTP credentials as a pair when required. |
| `AUTH_OTP_TTL_SECONDS`, `AUTH_OTP_MAX_ATTEMPTS`, `AUTH_OTP_COOLDOWN_SECONDS`, `AUTH_OTP_MAX_SENDS_PER_HOUR` | Default code lifetime, attempt cap, resend cooldown, and hourly send cap are `600`, `5`, `60`, and `5`. |
| `AUTH_RATE_WINDOW_SECONDS`, `AUTH_RATE_LOGIN_MAX`, `AUTH_RATE_VERIFY_MAX`, `AUTH_RATE_SEND_MAX` | Default rate window and login, verification, and send limits are `900`, `15`, `10`, and `3`. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Optional as a pair at startup. Payments require both. Use matching test or live mode credentials and webhook configuration. |
| `BOOKING_RESERVATION_MINUTES`, `BOOKING_MAX_TICKETS`, `BOOKING_JOURNAL_LIMIT` | Defaults are `30` minutes, `100` tickets per booking, and `5000` reservation journal entries per event. |
| `BOOKING_MAINTENANCE_SECONDS`, `EVENT_TIMEZONE_OFFSET_MINUTES` | Maintenance runs every `30` seconds by default. The event time offset defaults to `330` minutes (UTC+05:30). |

See the [backend environment template](backend/.env.example) for the full set of configuration keys.

#### Frontend (`frontend/.env`)

```dotenv
VITE_API_BASE_URL=http://localhost:5000/api
```

`VITE_API_BASE_URL` is the public API base URL, including `/api`. It defaults to the local value above. Vite embeds this value at build time.

### Commands

| Directory | Command | Purpose |
| --- | --- | --- |
| `backend` | `npm run dev` | Start Express with nodemon |
| `backend` | `npm start` | Run the API with Node.js |
| `backend` | `npm test` | Run backend integration and index tests |
| `frontend` | `npm run dev` | Start the Vite development server |
| `frontend` | `npm run build` | Build the SPA into `frontend/dist/` |
| `frontend` | `npm run preview` | Preview the production build locally |
| `frontend` | `npm run lint` | Run ESLint |
| `frontend` | `npm test` | Run frontend helper tests |

## API reference

Routes are relative to `/api`. Send JSON for ordinary request bodies and `Authorization: Bearer <token>` on protected routes. The Stripe webhook receives a signed raw request body.

### Health, authentication, and events

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public | Check API availability |
| POST | `/auth/register`, `/auth/verify-otp`, `/auth/resend-otp` | Public | Register and verify an account by email |
| POST | `/auth/login` | Public | Sign in and obtain a JWT |
| POST | `/auth/forgot-password`, `/auth/reset-password` | Public | Request a reset code and set a new password |
| GET, PUT | `/auth/profile` | Authenticated | Read or update the current profile |
| GET | `/events`, `/events/upcoming` | Public | Browse upcoming events |
| GET | `/events/categories` | Public | List event categories |
| GET | `/events/:id`, `/events/:eventId/availability` | Public | Read event details or current ticket availability |
| GET | `/events/organizer`, `/events/my/tenant-events` | Organizer | List owned events |
| POST | `/events` | Organizer | Create an event |
| PUT | `/events/:id` | Organizer | Update an owned event |
| POST, DELETE | `/events/:id/cancel` (POST), `/events/:id` (DELETE) | Organizer | Cancel an owned event |

### Bookings, payments, and gate check-in

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/bookings` | Customer | Create an idempotent reservation |
| GET | `/bookings/my-bookings` | Customer | List the customer's bookings |
| GET | `/bookings/:bookingId` | Authenticated, subject to booking access rules | Read booking and ticket state |
| POST | `/bookings/:bookingId/confirm` | Customer | Refresh payment state from Stripe. Send an empty body. |
| POST | `/bookings/:bookingId/cancel` | Customer | Cancel a pending booking |
| GET, POST | `/bookings/complaints` | Customer | List or submit complaints |
| POST | `/payment/create-checkout-session`, `/payment/create-payment-intent` | Customer | Start Stripe Checkout or create a PaymentIntent |
| POST | `/payment/webhook` | Stripe signature | Process supported payment, checkout, and refund events |
| POST | `/bookings/verify-ticket`, `/tickets/verify`, `/tickets/check-in` | Organizer | Validate a pass and record single-use check-in |
| GET | `/tickets/history` | Organizer or administrator | List check-in records, optionally filtered by event and status |

`/payments` is an alias for `/payment`, including its webhook. Booking creation requires an `Idempotency-Key` header with 16–128 letters, digits, underscores, or hyphens. Send `eventId`, `locationId`, `ticketTierId`, and `ticketQuantity` (or `quantity`). Customer contact fields are optional. Payment initiation accepts `{ "bookingId": "…" }` for an existing reservation, or the reservation payload with its idempotency header. Gate verification accepts `eventId` and `ticketToken`.

### Dashboards and administration

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/analytics/organizer` | Organizer | View organizer dashboard data |
| GET | `/analytics/events/:eventId/bookings`, `/analytics/events/:eventId/statistics` | Organizer | Read owned event bookings or sales statistics |
| GET | `/analytics/admin` | Administrator | View platform dashboard data |
| GET | `/admin/users` | Administrator | List users |
| PUT | `/admin/users/:id/role`, `/admin/users/:id/status`, `/admin/organizers/:id/plan` | Administrator | Manage roles, account status, and organizer plans |
| GET | `/admin/events` | Administrator | List events for moderation |
| PUT | `/admin/events/:id/approve`, `/admin/events/:id/reject` | Administrator | Moderate an event |
| POST | `/admin/events/:id/cancel` | Administrator | Cancel an event |
| GET, POST | `/admin/categories`, `/admin/venues` | Administrator | List or create categories and venues |
| DELETE | `/admin/categories/:id`, `/admin/venues/:id` | Administrator | Delete a category or venue |
| GET | `/admin/transactions` | Administrator | List transactions |
| PUT | `/admin/transactions/:id/refund` | Administrator | Request and reconcile an eligible Stripe refund |
| GET | `/admin/complaints` | Administrator | List complaints |
| PUT | `/admin/complaints/:id/resolve` | Administrator | Respond to or resolve a complaint |

The analytics router is also mounted under `/organizer`, with the same route suffixes and access rules.

## Booking, payment, and ticket lifecycle

1. **Reserve.** The server checks the event, location, tier, schedule, and stock. It calculates totals in LKR from stored prices and adds a 5% platform fee to the ticket subtotal. A customer-scoped idempotency key lets the client retry the same reservation safely.
2. **Hold inventory.** A conditional atomic update moves stock from available to reserved and writes a journal entry in the same event document. A hold defaults to 30 minutes and can end sooner at the applicable sales or start deadline. Finalized holds move to sold stock. Expired or cancelled pending holds release inventory, and a maintenance job reconciles unfinished work.
3. **Pay and verify.** The browser opens hosted Stripe Checkout. On return to My Tickets, the app checks the booking status through the API. Signed webhooks and server-side reconciliation validate Stripe references, metadata, amount, currency, and payment state before confirmation. Webhook event IDs support deduplication. The backend also exposes a PaymentIntent flow.
4. **Issue a group pass.** Once an eligible booking is confirmed, the API exposes its QR token. The frontend renders the code and allows an eligible pass to be downloaded as an SVG. At the gate, the organizer selects the event and enters the token. A successful atomic check-in marks the pass used and admits the entire booked group.
5. **Handle refunds and cancellations.** An administrator can request a Stripe refund for an eligible unused paid booking. The backend reconciles the provider result and restricts ticket use during refund or review. Cancelling an event closes sales and triggers cancellation notifications. Paid bookings are handled through the separate refund workflow.

See the [booking and payment design](backend/PHASE_2.md) and [management workflows](PHASE_3.md) for implementation details.

## Deployment

These are manual deployment settings derived from the application. The repository does not establish the active Vercel or Render service configuration or a verified live URL.

| Service | Setup |
| --- | --- |
| **MongoDB Atlas** | Create a database user with access to the application database. Add the backend's outbound addresses to the Atlas IP access list and copy the driver connection string into Render's `MONGO_URI`. [Atlas connection guide](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/) |
| **Render** | Create a Node web service with root directory `backend`, build command `npm ci`, start command `npm start`, and health check path `/api/health`. The server reads Render's `PORT`. Set `NODE_ENV=production`, the MongoDB URI, JWT secret, SMTP settings, and the exact HTTPS Vercel origin for `CLIENT_URL` and `CORS_ALLOWED_ORIGINS`. [Render deployment guide](https://render.com/docs/your-first-deploy) |
| **Vercel** | Set the root directory to `frontend`, use the Vite preset, build with `npm run build`, and publish `dist`. Set `VITE_API_BASE_URL` to the Render HTTPS service URL with `/api` appended. Configure an SPA fallback to `/index.html` for deep links such as `/my-tickets` and dashboard routes. [Vercel rewrite configuration](https://vercel.com/docs/project-configuration/vercel-json) |

For Stripe, register the Render HTTPS endpoint at `/api/payment/webhook` and configure the endpoint signing secret alongside the Stripe API key on Render. The handler supports `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `checkout.session.completed`, `checkout.session.expired`, both `checkout.session.async_payment_*` outcomes, `charge.refunded`, `refund.created`, `refund.updated`, and `refund.failed`. Verify the health endpoint, a direct SPA route, and a test checkout before using live Stripe credentials.

## Testing

Run both suites from the repository root.

```bash
npm --prefix frontend test
npm --prefix backend test
```

- **Frontend** tests cover session and API behavior, booking status helpers, and ticket document generation.
- **Backend** tests exercise Express routes, authentication, booking and inventory, Stripe webhook verification, management workflows, and startup indexes. Run a local MongoDB instance at `127.0.0.1:27017`, or set `TEST_MONGO_URI` to another loopback MongoDB URI. The suites retain isolated test databases and mock external Stripe and SMTP calls. See the [backend test notes](backend/tests/README.md).
- **Manual browser check.** Approve a future event, book it as a customer in Stripe test mode, return to My Tickets, download the pass, and verify that a second organizer check-in with the same token is rejected.

## Screenshots

| View | Placeholder |
| --- | --- |
| Event discovery | _Add a screenshot of the home page and filters._ |
| Checkout and My Tickets | _Add screenshots of the reservation flow and a demo QR pass._ |
| Organizer dashboard | _Add a screenshot showing event management and gate check-in._ |
| Administrator dashboard | _Add a screenshot showing moderation and transaction management._ |

## Future improvements

- Add camera-based QR scanning and preserve token entry as an accessible fallback.
- Support individual attendee passes and partial group arrival.
- Add automated browser coverage for checkout, ticket download, and dashboard workflows.
- Add operational metrics and alerts for payment reconciliation and inventory reservation failures.
