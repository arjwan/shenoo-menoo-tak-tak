# Sumer School migration to Cloudflare

## Phase 1 (this branch, staged)
- Public verified catalogue: GET /api/school/curriculum/catalog, 108 books and stage/grade/subject filters.
- Logged-in D1-user bookshelf: GET /api/school/books, reusing the application HttpOnly cookie via the existing Worker service binding.
- Authorised reader URL: GET /api/school/books/:id/reader, linking to the verified Google Drive source (PDF bytes have NOT been copied to R2).
- The Cloudflare Pages build derives its dataset from server/src/data/iraqi-curriculum-catalog.js; no replacement or fabricated books.

## Subsequent phases, not yet migrated
- Guardian/student enrolment and permissions, teachers and applications.
- Schedules, lessons, learning progress, sessions and virtual classrooms.
- PDF storage and access controls for R2, school management and moderation.

Existing /api/school/* routes remain on the legacy origin except the new, more-specific Pages Functions routes. Do not remove the legacy fallback until coverage, authorization and data parity are verified.

## Acceptance checks
```sh
node --test tests/cloudflare-school-catalog.test.mjs
```
No public curriculum-text or protected student data is released by the catalog endpoint.
