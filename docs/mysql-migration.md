# Historical experimental MySQL migration notes

This document describes the earlier compatibility-layer experiment, not the
approved native MariaDB implementation. Its commands are not production
deployment instructions. See `mariadb-native.md` for the current work and blockers.

Status: **schema tooling and experimental MySQL repositories implemented;
full service acceptance and hosting validation incomplete**.
Do not deploy this incomplete branch. Oracle and MongoDB are retired and must
not be restored. Hosting acceptance will use IQ Hosting MariaDB only.

## Implemented

- Deterministic schema conversion for all 60 current Mongoose models: 137 tables
  and 231 foreign-key relationships. Nested lists become ordered child tables;
  single nested documents become child tables with unique parent links.
- Existing 24-character identifiers are preserved as ASCII keys. Arabic text
  uses utf8mb4 with binary collation. Mixed data and maps use JSON.
- Compound unique indexes and conditional unique contact/student indexes are
  represented by generated columns. Missing optional unique keys become NULL.
- A separate MySQL 8 connection, SQL preview, destination check, migration
  journal, advisory migration lock, and schema verification. No runtime fallback
  from MySQL to MongoDB is allowed.
- CI uses an isolated MySQL 8 container and never production credentials.
- An opt-in MySQL repository layer now backs all 60 model exports in MySQL mode.
  It retains Mongoose validation, casting, defaults, validation hooks and domain
  methods without opening a MongoDB connection. Filters execute as parameterized
  SQL; normalized child tables implement arrays and references. Reads and writes
  use transactions; document saves check versions to reject stale changes.
- The development runtime requires both DB_CLIENT=mysql and
  MYSQL_RUNTIME_EXPERIMENTAL=true. Startup verifies the migrated schema and never
  creates or changes production tables implicitly. The default remains MongoDB.

## Acceptance coverage

The isolated MySQL suite exercises real signup, OTP confirmation, password login,
role checks, account projections, conflicting and independent saves, friendship
validation hooks, conversation membership, message history and read receipts,
ordered school attendance, nested teacher relationships, bulk contact upserts,
atomic counters, rollback on invalid foreign keys, authenticated Socket.IO,
JSON/map game state and persistence after reconnecting the runtime. It also
starts the complete application server and tests its login endpoint.

The existing school-management lifecycle suite can now run against an isolated
MySQL database. Its administration fixture follows the current policy: platform
admins have no implicit school-manager permissions; authorized management
operations use a developer account. No production authorization rule is relaxed.
Non-user school resource IDs are retained in audit details instead of violating
the audit table's User foreign key. Virtual classroom history follows the actual
participants-to-student relationship in MySQL.

## Commands

```sh
npm run mysql:schema -- plan    # local inventory, no connection
npm run mysql:schema -- sql     # candidate DDL on stdout, no connection
npm run mysql:schema -- check   # read-only IQ Hosting connection/version check
npm run mysql:schema -- apply   # writes only to the configured destination
npm run mysql:schema -- verify # read-only structural and journal checks
npm run test:mysql
npm run test:mysql:runtime # requires an isolated CI MySQL instance
```

Set private MYSQL_* variables in the server environment, using the exact existing
IQ Hosting database/user names. Never commit .env or connection secrets. TLS is
verified by default; a private CA can be supplied with MYSQL_SSL_CA_FILE. Local
hosting connections without TLS can explicitly use MYSQL_SSL_MODE=disabled.

`apply` requires an empty, already-created MySQL 8 database; it does not create a
database or user, copy MongoDB data, drop tables, or deploy. It refuses existing
untracked tables. Re-running a completed migration checks the checksum and
returns without writes to the application tables. MySQL DDL commits separately:
the journal records each completed statement. A crash between a DDL statement
and its journal update requires manual inspection; no automatic table deletion
or destructive rollback is attempted.

## Required before runtime cutover

1. Review and execute the candidate DDL against the isolated MySQL 8 CI database,
   then verify IQ Hosting's exact MySQL version and privileges. MariaDB is not
   accepted by this version of the tool.
2. Complete acceptance tests for all route/service/model operations. The new
   repositories implement find/count, projection, sort/pagination, population,
   create/save, atomic updates, deletes and bulk upserts. The covered operations
   above have isolated MySQL tests; other routes still require acceptance.
   Unsupported query/update operators fail explicitly instead of falling back
   to MongoDB. Administrative scripts that connect directly to MongoDB, the
   user hard-delete workflow under restrictive foreign keys, full-text search,
   and transaction/session-based simulation tooling still need separate review.
3. Review new bounds for formerly unlimited indexed strings (255 characters),
   nullable uniqueness differences, case/collation behavior, optional nested
   documents, and deletion order under foreign keys. Full-text keyword arrays
   require searching their child table and unioning results with scalar fields.
4. Build a read-only MongoDB export/import preserving IDs, dates, list ordering,
   password hashes and references. Check orphan references before inserting;
   compare counts and sampled records. Import is separate and not implemented.
5. Extend acceptance to all posts/media, notifications, payments/service flows,
   game actions, virtual classroom media/signaling and backup/restore. Re-run the
   covered flows on IQ Hosting with the actual deployment configuration.
6. Only after acceptance remove the experimental gate, publish to the
   destination, and switch shinomino.com after a successful smoke test.

No live IQ Hosting test or website deployment has been performed by this change.
