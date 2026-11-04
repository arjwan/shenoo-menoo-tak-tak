# شينو مينو تك تك — Cloudflare-only clean runtime

This is an **isolated partial implementation**, not a full port of the original Express/Mongoose application. Do not switch `shinomino.com` to this Worker until all required features have passed acceptance tests.

## Current resources

- Worker: `shenoo-cloudflare-clean`
- Preview: `https://shenoo-cloudflare-clean.arjwan307.workers.dev`
- D1: `shno-mano-production` (`DB` binding), new schema, no imported users
- R2: `shno-mano-media` (`MEDIA` binding)
- `AUTH_SECRET`: stored as a Cloudflare secret binding; **never add it to Git**
- No Oracle, MongoDB or IQ Hosting calls in this Worker

## Implemented paths

- `GET /api/health`
- `GET /api/auth/registration-config`
- `POST /api/auth/signup` (new user, minimum 10-character password)
- `POST /api/auth/signin`
- `GET /api/users/me` with bearer token
- `GET /api/posts` and `POST /api/posts` with bearer token, multipart files in R2
- `GET /media/:id` for public post media

The signup flow does not yet include email verification, Turnstile, or rate limiting. **Do not route production user traffic until these protections exist.** File uploads use basic signatures and are capped at 15 MiB. Video is passed through without transcoding.

## Missing / not accepted

The existing UI still uses legacy API endpoints and is not wired to this Worker. Legacy social graphs, reels, stories, feeds, friends, notifications, admin/developer authentication, school, games, conversations, Durable Objects, WebSocket signaling and WebRTC are not yet ported. Empty placeholder responses for some GET paths are **not functional parity**. All other endpoints return HTTP 501.

## Operational controls

- Production `shinomino.com` DNS and IQ Hosting deployment remain untouched.
- Do not import or migrate old MariaDB/MongoDB accounts.
- Preserve the old system until an explicit cutover decision.
- No developer backdoor / automatic role promotion. Design separate secure developer bootstrap before cutover.
- Follow `cloudflare/migrations/0001_clean.sql` for schema. Existing D1 schema has already been applied.
- Test with preview URL and isolated test accounts before enabling signups to users.
