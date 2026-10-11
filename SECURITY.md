# Security Review

Reviewed October 11, 2026. This is targeted code review and regression testing, not a claim that the application is vulnerability-free or an independent penetration test.

## University Profile Names

An email code verifies control of a mailbox, but does not supply its account-profile name. Junto no longer splits email addresses into names. A member without a connected provider profile appears as "Campus member"; names cannot be submitted through profile forms.

Thapar's public mail DNS currently points to Google. Its [official email circular](https://www.thapar.edu/upload/files/Email_Id.pdf) also directs students to Gmail. Configure a Google OAuth web application for the profile connection:

1. Register the exact production redirect URI: `https://junto-lyart-eta.vercel.app/auth/campus/callback`.
2. Request only `openid email profile`. Configure consent/testing access for university users. University policy may require administrator approval.
3. In Vercel's server environment, set `CAMPUS_IDENTITY_PROVIDER=google`, `CAMPUS_OIDC_CLIENT_ID`, and `CAMPUS_OIDC_CLIENT_SECRET`. Set `APP_URL=https://junto-lyart-eta.vercel.app`. Redeploy. Do not commit credentials or share them in chat.
4. Signed-in members connect their university profile from onboarding, Edit Profile, or Settings. The selected account must match the campus mailbox already verified in Junto.

Microsoft is supported when explicitly configured with the university's tenant UUID and its own application credentials. Never use `common` or `organizations` as the trusted tenant.

The connection uses the maintained `openid-client` library: authorization-code flow, S256 PKCE, random state and ID-token nonce, issuer/audience/expiry checks, JWT signature validation, and subject-matched UserInfo. Each ten-minute transaction is bound to the signed-in account and session and consumed atomically once. Google requires a verified email and the exact university hosted domain; Microsoft requires the exact tenant. Access/refresh/ID tokens are not stored. Provider subject IDs are unique and cannot silently replace an existing linked identity.

A provider's `name` is a display-name claim, not proof of a legal name. Names never determine authorization, moderator roles, campus membership, or ratings. See [Google's OIDC guidance](https://developers.google.com/identity/openid-connect/openid-connect) and [Microsoft's claim-validation guidance](https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation).

**Deployment prerequisite:** profile retrieval cannot be enabled without the provider's registered client credentials. Password sign-in, email codes, and all other workflows remain available without them.

## Hardened Paths

- Web Push subscriptions and delivery accept HTTPS URLs on known browser push-service domains only. Credentials, custom ports, IP literals, localhost, lookalike domains, and invalid encryption keys are rejected. Unsafe legacy subscriptions are discarded without network contact. Delivery has a five-second timeout, per-member limits, and a ten-device cap.
- Rate limits use atomic PostgreSQL windows shared across Vercel instances, not process-local memory. Only hashed keys are stored; expired rows are purged. Database failures do not fall back to an unprotected limiter. Password setup is limited before expensive hashing begins.
- OTP issuance is serialized per mailbox using a transaction-scoped database lock. Verification is single-use with atomic attempt counts. A failed email send discards only its own unused code, never a newer one.
- Password lockouts update atomically. Stored scrypt hashes require valid lengths and bounded parameters; test-only cost overrides cannot weaken production. Password changes compare-and-swap the previously verified hash and revoke other sessions in the same transaction. Code-only password creation requires a recent sign-in. Account deletion requires the current password or, for code-only accounts, a recent sign-in; deletion wipes credentials and private profile identity.
- Other members' photos require an active, onboarded viewer and honor bilateral blocks. Own-photo onboarding previews and moderator review remain available. Responses are private/no-store. Photo decoding is limited to still images of at most 25 megapixels and the existing five-megabyte upload limit; EXIF/GPS metadata is stripped.
- No-show reports require both people to have accepted the same finished plan, within the feedback window. Feedback cannot accuse someone of a no-show while the plan is still live. Existing corroboration/moderation rules and neutral declines remain unchanged.
- Production scripts require a fresh per-request CSP nonce; arbitrary inline scripts and eval are no longer permitted. Next.js HTML is dynamically rendered because request-specific nonces cannot safely reuse static/PPR shells. Motion/Radix inline styles remain permitted, not inline scripts. Existing frame protection, MIME protection, HTTPS HSTS, and camera permissions remain. Private routes are non-indexable; referrers are suppressed and private responses avoid caching.
- Production cookie security and generated links use configured `APP_URL`, not arbitrary forwarded-host/protocol headers. IP limits trust Vercel's overwritten forwarding header only when deployed on Vercel. Non-Vercel deployments use a shared fallback unless adapted for an explicitly trusted proxy.

## Dependencies and Remaining Work

`npm audit --omit=dev` reports zero known runtime vulnerabilities at review time. The vulnerable old esbuild nested under the development-only Drizzle loader is overridden with a patched version. The UI generator is development-only; its build-time CSS remains included.

The full development dependency audit still reports advisories for `braces` through its globbing/tooling dependency chain. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched release at review time. These tools do not process app-user glob patterns or run development servers in production. Monitor the upstream fix; do not apply npm's proposed incompatible major downgrades automatically.

Keep Vercel, GitHub, database and email accounts behind MFA, restrict production secret access, rotate exposed credentials, enable database backups, and review moderator access regularly. Infrastructure access policies, university consent approval, password-compromise screening, and continuous alerting are outside this code-only review.

## Verification

- TypeScript and a production Next.js build.
- Database-backed regression tests for existing workflows, shared limits, concurrent OTP/password operations, profile linking, private avatar access, and reporting permissions. Provider callback tests mock token exchange; they do not prove live consent works before credentials exist.
- Real local PostgreSQL smoke tests for rate-limit upserts, concurrent password lockout, and serialized OTP issuance.
- Production-browser checks using synthetic local accounts, with cleanup. No real student's account, inbox or password is used; live checks are read-only.

Changes are additive in `drizzle/0005_melted_zarda.sql`. Back up production data before manual schema changes. Do not expose PostgreSQL or dev tooling publicly.
