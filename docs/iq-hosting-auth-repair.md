# IQ Hosting authentication readiness repair

Live read-only inspection found:

- The cPanel Git repository is at merge commit `48b91bd`.
- The running application is `/home/shinomin/shenoo-menoo-tak-tak` and uses
  Passenger with Node 24. Its developer frontend differs from the Git copy.
- The running Node process has no `JWT_SECRET` and the application has no `.env`.
- MariaDB 10.11.19 contains the existing users table and legacy migration journal,
  but neither `developer_sessions` nor `developer_login_attempts` exists.
- Existing developer account data must be preserved. No password reset or
  privilege promotion is needed to add the missing infrastructure.

The earlier full migration command is for an empty database. It correctly
refuses the nonempty hosting database and must not be forced or worked around
by dropping/reinitializing tables.

## Additive commands

Run with the application's existing private MYSQL_* environment:

```sh
npm run mariadb:auth:migrate
npm run auth:configure
```

The first command verifies the existing user layout and any existing auth-table
definitions before creating only the two missing authentication tables. It
serializes with the native migration lock, validates keys/relationships, and
does not touch application tables, user rows or the legacy migration journal.
It does not falsely mark the full application baseline as migrated.

The second command preserves any existing valid platform/file JWT secret. Only
when neither exists does it generate a random secret and append it to a private
mode-600 `.env` inside the project. It never prints the value, replaces an
existing key, or changes account passwords. Invalid existing keys require an
explicit replacement decision rather than silent rotation.

## Preserving the developer workspace

Back up the existing frontend before changing it. Compare the IDs and service
API paths of both copies. Update only the developer login-response handler and
server-side logout handler if required; retain the workspace, services, forms,
visual design and MFA records. Back up application files inside a private
project backup folder, keep private configuration out of Git, then restart the
existing Node application and verify the live API and UI separately.

## Validation

- Native MariaDB and nonempty-database upgrade integration: **14 passed, 0 failed**.
  This includes preserving a populated account/password and existing journal,
  repeatable upgrade, working existing developer login/logout, incompatible
  auth-schema rejection before further DDL, and refusing a missing users table.
- Private JWT-environment setup: **4 passed, 0 failed**, including repeatability,
  preserving platform keys and unrelated settings, invalid-key refusal and lock
  ownership.

User registration still follows its existing email-OTP policy. A missing JWT
secret also prevents OTP signing/hashing, but restoring that key does not
configure email delivery. Keep the existing verification requirement unless
the owner explicitly chooses temporary registration without an email code.
No registration security policy is changed by these two commands.

This targeted deployment repair does not complete the remaining native SQL
service migration and does not replace or simplify developer services.

## Observed deployment and Android follow-up (2026-10-30)

The additive authentication repair from commit 9cadd93 was applied to the
existing Passenger application. The deployment created the two missing auth
tables and a private JWT configuration, verified unchanged account records,
and preserved frontend bytes outside the login/logout handlers and existing
service scripts. A private rollback copy remains under the application's
.noah-repairs directory.

Live checks: health 200, unauthenticated developer session/dashboard 401,
private /.env access 403. Actual developer-password login has not yet been
confirmed by the owner. Registration reports OTP-delivery failure; its email
verification policy remains enabled pending the owner's configuration decision.

Both Android source trees still targeted the retired DuckDNS origin. Their
API, session resume, WebView and background service origins now target
https://shinomino.com, including the exact trusted host for media permissions.
Release versions are advanced to website APK 2.0.5 (25) and call APK 1.3.3 (16)
so rebuilt APKs can upgrade installed copies. Existing signing configuration
and application IDs are preserved. A previously installed APK is not updated
by deploying the website; it must receive the rebuilt signed release.

Re-run validation: 7 Android session-entry tests and 4 private-environment
tests passed (11 passed, 0 failed, 0 skipped). Secret scan including history
and git diff --check passed. APK compilation/signing/device installation have
not been verified in this Windows workspace; the POSIX Gradle wrapper is
present, but no Windows wrapper or known local JDK/SDK installation was found.
No Oracle resource shutdown or R2 media round-trip is claimed by this repair.
