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
