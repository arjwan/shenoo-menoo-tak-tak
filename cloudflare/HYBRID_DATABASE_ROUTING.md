# Hybrid Cloudflare D1 + MongoDB plan (staged)

## Current status
- Production: `cloudflare/worker.js` remains the live Worker and D1/R2 continue unchanged.
- Staged gateway: `cloudflare/mongo-gateway.js` is NOT deployed.
- Atlas project `Project 0`, cluster `Cluster0`, DB `shino_mino_tak_tak`, 58 collections.
- MongoDB access credentials are NOT included in source control or provided by the Atlas connector.
- There is no production `MONGODB_URI` Worker secret yet. Never write credentials to GitHub or a frontend file.

## Deterministic per-service routing
| API | Authoritative system | Status |
| --- | --- | --- |
| /api/auth/* | D1 | Running; no silent account migration |
| /api/posts, /api/posts/ads* | D1 + R2 | Running |
| /api/conversations*, /api/social* | D1 | Running for D1 accounts |
| /api/stores (approved, read-only) | MongoDB | Staged in gateway |
| /api/developer/mongo-summary | MongoDB (D1 developer role required) | Staged |
| /api/school*, /api/consultations*, /api/groups*, /api/support* | MongoDB (legacy) | NOT implemented in gateway |
| Other /api/* | D1 first, explicitly unsupported if absent | Existing behavior |

The dispatcher never falls back to MongoDB just because a D1 lookup failed;
that would break authorization and create split-brain writes.

## Required safe steps before production deployment
1. Create a dedicated least-privilege MongoDB database user with read-only access
   to `shino_mino_tak_tak` for initial rollout. Don't use the existing Atlas-admin user.
2. Securely configure Cloudflare Worker secret `MONGODB_URI`, without exposing it
   in the repository or chat.
3. Build a bundled ES module using Wrangler with the `mongodb` Node driver
   (>=6.15.0) and Cloudflare node compatibility. See Cloudflare's current official
   MongoDB connection tutorial.
4. Test the bundled gateway in an isolated Worker, with authentication,
   error handling, store visibility, and failure injection. Never expose direct
   arbitrary collection-query endpoints.
5. Map each remaining legacy route to a defined schema, reconcile identities,
   migrate required features and Socket.IO separately, then switch routes
   incrementally after acceptance tests.
6. The current Atlas network access list allows `0.0.0.0/0`. Restrict it
   when a viable network access design is chosen, without locking out the
   existing application.
7. Preserve MongoDB source records and all D1/R2 data; do not remove MariaDB
   or legacy backups as a side effect of enabling the gateway.

## Identity boundary
MongoDB `users` and D1 `users` are different sets. D1 session IDs must not
be treated as MongoDB ObjectIds or as proof of ownership of legacy records.
Require verified account linking before exposing private user data or writing
MongoDB records. In particular, never elevate a user merely by username.

## Deployment gate
Do not change the production Worker main module from `worker.js` to
`mongo-gateway.js` until secret setup, bundling, tests and verified account
mapping are complete. Simply committing the gateway does not connect MongoDB.
