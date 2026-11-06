# Application and developer routing

The application uses the native Cloudflare Worker with its existing D1 and R2 bindings. Core authentication stays under `/api/auth/`.

The developer console has one canonical workspace at `/developer/`, with a paired-phone confirmation document at `/developer/confirm.html`. Its API client calls the existing `/api/developer/`, `/api/developer-mfa/`, and school management namespaces through Pages Functions and the HTTPS auxiliary Express server. No D1 role is automatically promoted from a MongoDB username.

The auxiliary runtime uses a Cluster0-scoped service account restricted to `shino_mino_tak_tak`. Developer service modules require a full authenticated developer session; password-only MFA tokens and ordinary user sessions are rejected. Existing credentials and second factors stay in MongoDB. Core application sessions and developer sessions remain separate.

Build with `bash scripts/build-cloudflare-pages.sh`. Pages must deploy `dist` and retain the `API` service binding to the existing Worker. The build includes the console directory, security headers and a real 404 document. Do not publish connection secrets or password recovery values in source control.

The obsolete temporary developer control plane and Mongo gateway have been removed. Their D1 tables are retained to preserve stored data; they expose no developer HTTP management handlers. Production cutover requires authorized login, MFA, management, school downloads and core application checks.
