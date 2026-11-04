# Developer-only MongoDB bridge — production rollout gate

## Source of truth

- `main` is the authoritative GitHub branch.
- Live: `cloudflare/worker.js` backed by Cloudflare D1 (`DB`) and R2 (`MEDIA`).
- Auxiliary: MongoDB Atlas `Cluster0`, database `shino_mino_tak_tak` (58 collections).
- `cloudflare/mongo-gateway.js` is a STAGED gateway, **not** the production Worker entrypoint.
- MongoDB is used **only** by authenticated developer APIs: `/api/developer/mongo-*`.
- Public application endpoints, including `/api/stores`, `/api/auth/*`, posts, stories, chat, ads, remain 100% D1/R2.
- No MongoDB data is copied to D1, and no MariaDB/Oracle dependency is added.

## Staged protected API methods

| Method | API | MongoDB collections |
|---|---|---|
| GET | `/api/developer/mongo-status` | db ping |
| GET | `/api/developer/mongo-summary` | users, stores, schoolteachers, schoolstudents, schoolteacherapplications, gamerooms, conversations, groupreports |
| GET | `/api/developer/mongo-users?q=&status=` | users, safe allowlisted projection only |
| GET | `/api/developer/mongo-admins` | users, admin/developer only |
| GET | `/api/developer/mongo-teacher-applications?status=pending` | schoolteacherapplications |

All requests require a valid, active D1 cookie session with `developer` or `admin` role, and MongoDB data is inaccessible to ordinary users. There is deliberately no automatic authority transfer based on equal usernames, and no arbitrary collection names or raw queries are accepted. The gateway is read-only until identity and per-service update flows are verified.

## Required to activate

1. Create a dedicated least-privilege MongoDB Atlas user that can read only the `shino_mino_tak_tak` database. Avoid the existing `atlasAdmin` application account.
2. Set Cloudflare Worker secret `MONGODB_URI` **in the Cloudflare dashboard**, never send credentials in chat and never place them in GitHub. Use the Atlas connection string with an encoded password.
3. Bundle `cloudflare/mongo-gateway.js` and `cloudflare/worker.js` with the existing `mongodb` dependency; use Cloudflare Workers compatibility date `2026-11-04` (Node compatibility enabled by default) and test with a non-production Worker and D1 test sessions.
4. Compare `mongo-summary` count with MongoDB Atlas count, confirm ordinary users get 403, confirm D1 routes unchanged, verify all Worker bindings are preserved, and test Atlas downtime.
5. Once authorized developer login and services pass tests, promote the gateway entrypoint on production without altering the Pages hostnames, DNS, MariaDB, or Render.
6. For mutable developer services (teacher approval, account edits, account deletion, MFA) port the original MongoDB business rules and audit logs, test each independently. These are **not implemented in the gateway** and should never be reported as working.

## Current blockers

- The production Worker has **no `MONGODB_URI` binding** (only `AUTH_SECRET`, `DB`, `MEDIA`).
- There are currently no D1 users with a privileged `developer`/`admin` role. A legacy MongoDB role does not grant a D1 session.
- The original legacy developer password is stored as a bcrypt hash in MongoDB and is not equivalent to the D1 password hashing scheme. A secure identity-linking or legacy developer login flow is needed; never grant privileges based on a username alone.
- The original MongoDB Atlas network allowlist currently permits `0.0.0.0/0`; narrow access when a compatible approach has been tested, without disconnecting the legacy deployment.

Until those gates are satisfied, the existing D1/R2 Worker stays live.
