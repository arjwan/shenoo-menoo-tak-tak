# Validation record — incomplete application acceptance

Tests run locally on Windows with Node 24.20.0. MariaDB is a real isolated
11.4.11 server bound to loopback, with a fresh uniquely named test database for
each native run. No production or IQ Hosting data was accessed.

| Check | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Native SQL/auth integration | 9 | 0 | 0 |
| Selected existing regressions on repair branch | 114 | 9 | 3 |
| Same selected regressions on clean base `0c9fefc` | 114 | 9 | 2 |

The extra skipped case is the native integration suite when its opt-in test
environment is absent from the general regression command. Eleven legacy
test files that start/connect MongoDB were not run. Their cases are **not**
counted as passed or as the three skipped cases above. These must be ported,
not silently removed from final acceptance.

`validation/regression-comparison.json` records the file selection and the
same nine failures on both checkouts. No new failing test names were observed
in that selection. Existing failures include missing school entry files, an
outdated school header assertion, and preserved-file checksum mismatches on
this Windows checkout. They remain unresolved; their presence on the base
does not make a production acceptance suite green.

`validation/mariadb-native.txt` contains the actual native test runner output.
It includes successful empty/repeated migrations, foreign-key checks,
bootstrap/recovery collision guards, real HTTP login/logout, role/status checks,
JWT and DB-session expiry, persisted rate limits, SQL injection rejection,
preserved populated MFA data, native profile/audit operations and sanitized
connection failure. The suite forbids loading MongoDB/Mongoose modules on the
native auth path. It does not prove that the remaining application is ported.

`node server/src/scripts/scan-secrets.js --history` passed. Changed JavaScript
was syntax-checked with Node and `git diff --check` passed. No remote CI outcome,
full application browser login, complete MariaDB chat/rooms/games cycle, hosting
deployment, or production readiness is claimed.
