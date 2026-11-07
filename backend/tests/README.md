# Authentication and transaction checks

Run `npm test` from backend with Node 20+ and MongoDB running on 127.0.0.1:27017.
Optional TEST_MONGO_URI must point to loopback MongoDB. The suite overrides the
database name with unique eventra_auth_test_* or eventra_booking_test_* case names.
Each test uses its own isolated database. Test records are retained; the suites
perform no delete/drop operations. The missing-account test uses an ID that does not exist.
No development accounts, events, bookings, or real mailboxes are used.

Tests execute real Express routes, MongoDB queries, bcrypt and JWT verification.
The authentication suite captures external SMTP. The transaction suite mocks
Stripe network methods while exercising real SDK webhook signatures, MongoDB,
Express routes, authorization, inventory and recovery logic.
No application code provides test authentication or fake mail success.
Run `npm test` in frontend for storage, logout-state, token-expiry and Axios
401-handling checks. Those checks do not replace authenticated browser testing.

## Compatibility and deployment

- Existing password hashes and verified users remain valid.
- Existing JWTs require login again: new JWTs require issuer, audience, expiry
  and a session-version claim. Version defaults to zero for existing records.
- Legacy plaintext verification/reset codes are no longer accepted. Request a
  fresh code; issuance removes the corresponding legacy value. A successful
  password reset also clears outstanding verification codes.
- New private User fields are added lazily; no destructive migration is needed.
  Historical plaintext fields remain hidden until replaced/cleared. A separate
  reviewed migration can remove any obsolete legacy fields permanently.
- Role changes increment the session version atomically; deletion is checked
  against the database for each protected request.
- Password reset increments the session version atomically with OTP consumption.
- The AuthRateLimit collection uses a MongoDB TTL index. Ensure production
  deployment creates that index; expiry is checked even before TTL cleanup.
- Rate limits are shared across backend instances through MongoDB. Account keys
  and IP keys are HMAC digests. Each endpoint also has an IP ceiling.
- Verification/reset codes expire after 10 minutes, allow five attempts, have a
  60-second resend cooldown and a five-send hourly cap by default.
- Cooldown/hourly-cap responses use generic eligibility messages to avoid
  disclosing whether an account exists; endpoint rate limits return HTTP 429.
- Local development needs SMTP_HOST and FROM_EMAIL for email-dependent flows.
  A local SMTP mail catcher can be used without SMTP_USER/SMTP_PASS. Missing mail
  configuration returns HTTP 503; mail delivery failures never pretend success.
- Production requires a strong JWT_SECRET, database URI, HTTPS frontend origin,
  SMTP_HOST and FROM_EMAIL. Credentials, when used, must be provided as a pair.
- Set TRUST_PROXY_HOPS only to your actual trusted reverse-proxy topology.
- JWTs remain in localStorage for compatibility. Protect against XSS and use HTTPS.
- Actual .env files are not edited by this phase. Copy variable names/descriptions
  from .env.example and configure deployment secrets privately.

Phase 2 booking/payment security is implemented. See ../PHASE_2.md for the
reservation protocol, migration implications, API contracts and manual Stripe tests.
