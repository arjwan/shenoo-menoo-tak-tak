# Unified-account migration: MongoDB canonical (staged, NOT enabled)

## Current verified code boundaries
- Cloudflare Pages serves the website. Its D1 Worker handles /api/auth/signup, /signin, /session with PBKDF2 and D1-only HttpOnly cookie sessions.
- The Express /api/auth implementation uses Mongoose User records and bcrypt JWTs.
- The native /api/developer/login currently uses MariaDB and returns a full token after password verification.
- The unified developer UI expects a **preAuthToken** first; developer MFA endpoints currently return 503. Never route the full token around that requirement.
- The deployment still routes /api/auth through the D1 Worker. **DB_CLIENT=mongodb on the auxiliary server alone does not switch public login or fix developer login.**
- D1 and legacy MongoDB/MariaDB user IDs and password hash formats are not interchangeable.

## Stage A: Prepared only
- This branch adds explicit `DB_CLIENT=mongodb` support in `server/src/config/db.js`, using an explicitly selected `MONGODB_DB_NAME`. It is opt-in and does not alter production settings.
- Keep `DB_CLIENT=mysql` unchanged in production until the original MongoDB collections, indexes, User model behaviour and backup are verified in staging.
- No automatic provisioning, privilege promotion, password resets, D1 deletions or database fallback.

## Stage B: Requirements before any cutover
1. Take verified recoverable backups of D1, MariaDB, MongoDB and R2 metadata, and record rollback procedure. Do not place backup credentials in GitHub.
2. Inventory existing accounts by opaque IDs; match conflicts by verified contact ownership, **not username alone**. Preserve IDs and linked records whenever possible.
3. Choose one authentication session model and adapt the frontend and all protected API endpoints to it. Do not mix D1 HttpOnly cookies with MongoDB JWT authorization across services accidentally. Review CSRF, CORS and logout/revocation.
4. Rebuild developer password -> scoped pre-auth -> registered MFA -> full session using the canonical user store. Require an audited owner recovery flow if no MFA is enrolled. Never issue an admin token from password-only login.
5. For D1-only accounts, migrate identities via user-authorized proof or audited reset; PBKDF2 hashes in D1 cannot be compared by the existing bcrypt-only MongoDB auth implementation.
6. Test login, signup, existing-user recovery, MFA, developer-only operations, school downloads, API authorization and rate limits in an isolated staging environment.
7. Only after acceptance switch Cloudflare /api/auth routing (and applicable protected application API routing) together and verify logged-in requests. Leave email DNS, R2 and other unrelated configuration intact.

## Local checks
```sh
node --test server/test/mongodb-db-selection.test.js
```

## Revert
Revert the new branch or keep `DB_CLIENT=mysql` unchanged. No live switch or migration has occurred in this branch.
