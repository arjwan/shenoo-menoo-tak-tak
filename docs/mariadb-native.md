# Native MariaDB repair — work in progress

Base: `0c9fefc64773aa02da61711f85bdf06ee8438a78` (`main`).
Local rollback branch: `backup/pre-mariadb-native-20261029`.
Repair branch: `fix/native-mariadb-developer-auth`.

**Not ready to merge or deploy as the completed migration.** Developer
authentication is native SQL, but the rest of the application's 60 models and
their service consumers still use the existing Mongoose compatibility runtime.
That adapter has not been replaced or disguised as a native implementation.
See `mariadb-audit.json` for the exact files and operation candidates.

## Implemented

- Checked-in SQL baseline: 137 application tables and 231 foreign keys, frozen
  from the current relational schema. The native runner loads only SQL files;
  it never loads Mongoose or generates the schema from models at runtime.
- A second migration adds persisted developer sessions and login-attempt
  buckets. Including the journal, a fresh native test database has 140 tables.
- Parameterized native account lookup, explicit bootstrap, password recovery,
  profile updates, security metadata and session revocation use `mysql2/promise`.
- Developer passwords use bcrypt cost 12 with a 12–72 UTF-8 byte setup limit.
  Login accepts only an existing active developer. Username/contact collisions
  never promote or rename existing ordinary users. Recovery requires the exact
  existing developer ID, keeps its role/status, and revokes its sessions.
- HS256 JWTs have a 15-minute lifetime, issuer/audience validation, and a random
  session identifier whose hash is persisted. Authorization rechecks the current
  account role/status and session expiry. Logout revokes the stored session.
  HTTP and socket authorization reject old developer bearer and MFA tokens.
- Old MFA routes return 503 during the rebuild. Existing enrollments and keys
  remain intact. MFA is temporarily suspended at the owner's request and must
  be redesigned by an explicit decision before real users are accepted.
- Developer UI handles the new direct token response and calls server logout.
  No visual styles, colors, pages or feature modules were replaced.
- The shared DB entrypoint no longer connects to MongoDB. The native connector
  requires MariaDB, verifies TLS by default and reports sanitized failure without
  a fallback. The old adapter's explicit experimental guard remains; bootstrap
  never enables it. This guard is a deployment blocker, not an acceptance flag.
- Eight retired Oracle deployment artifacts are archived as non-executable text
  outside the workflows/scripts directories. No hosting resources were changed.
- Reverse-proxy trust defaults to false. IQ Hosting's actual trusted proxy/CIDR
  must be confirmed before setting `TRUST_PROXY`; client IP headers are not
  trusted unconditionally for developer rate limiting.

## Preparing a fresh test database

Use a separate empty MariaDB database and restricted database user. Do not run
these migrations against an existing database without a reviewed adoption
migration. The runner refuses nonempty databases without its own journal, checks
migration checksums, serializes runners with an advisory lock, records DDL
progress, and never drops tables. A crash between DDL and journal update fails
closed and requires inspection; it does not blindly recreate objects.

Set `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`,
`MYSQL_SSL_MODE=required`, and optionally `MYSQL_SSL_CA_FILE` in private server
configuration. IQ Hosting's prefixed database/user names must be used exactly.
Do not put real values in Git. TLS can be disabled only for a confirmed local
test connection or when the hosting provider explicitly requires that topology.

```sh
npm ci
npm run mariadb:migrate
```

## Developer setup and recovery

Set a strong random `JWT_SECRET` of at least 32 bytes and private
`DEVELOPER_NAME`, `DEVELOPER_USERNAME`, `DEVELOPER_CONTACT`,
`DEVELOPER_PASSWORD`. Do not put secrets on shell command lines or in logs.

For a new identity only, set `DEVELOPER_BOOTSTRAP=allow-new-developer` and run:

```sh
npm run seed:developer
```

The command reports only the action and non-secret account ID. Re-running the
bootstrap leaves an existing developer's password unchanged. Remove the
bootstrap authorization from private configuration after use.

For recovery, set `DEVELOPER_RECOVERY_USER_ID` to the exact active developer ID
and supply its current username/contact plus a new password in private config:

```sh
npm run recover:developer
```

Recovery never resets MFA records, activates a blocked account, or promotes an
ordinary user. Repeated recovery safely keeps the same identity and invalidates
all prior sessions. Remove the recovery password/configuration after use.

## Tests and limitations

Native tests run against an isolated real MariaDB 11.4.11 Windows server bound
to `127.0.0.1:33317`, installed entirely under ignored `work/`. The official ZIP's
SHA-256 was verified. No IQ Hosting database was accessed.

```sh
# Local/CI test-only server; test creates a new database with this exact prefix.
# Supply MYSQL_* for a disposable local MariaDB server first.
MARIADB_NATIVE_TEST=1 MYSQL_DATABASE=shinomino_native_test_1 npm run test:mariadb:native
```

The native suite rejects loading `mongoose` and `mongodb` while exercising the
new auth path. It covers fresh/repeated migrations, foreign keys, bootstrap,
identity collisions, real HTTP login, wrong passwords, role/status rejection,
expiry, logout, rate limits, injection, recovery, preserved populated MFA data,
profile validation/audit transactions, and sanitized connection failure.

Last completed native run: **9 passed, 0 failed, 0 skipped**. Regressions and
baseline comparisons are recorded in `mariadb-validation.md`; a failing full
acceptance suite must not be described as ready. The new GitHub MariaDB workflow
has been authored; a local run does not prove that remote CI has completed.

## Required before final acceptance

1. Replace remaining model/adapter consumers with domain SQL repositories,
   including ordinary account operations, chat, rooms, games, community,
   school, background jobs and developer business-management endpoints.
2. Port corresponding integration suites to disposable MariaDB databases;
   remove the adapter and MongoDB packages only after their last consumers are
   gone. None of those packages is claimed removed by this patch.
3. Review enum/default/validation semantics across all domains; this frozen
   baseline preserves the earlier table layout and is not proof every domain's
   native invariants have been ported.
4. Finish the complete service startup on native repositories and test the real
   application end to end. The default experimental guard remains disabled.
5. After review/merge, confirm IQ Hosting paths, Node version, DB permissions,
   TLS, proxy configuration, process manager and deployment mechanism. Hosting
   publication is a later step, per the owner's instruction.

PR #58 was reviewed but not merged: it can promote a matching ordinary account,
uses the database selected by old config, and deletes MFA enrollment. Its
approach is incompatible with the requested recovery policy.
