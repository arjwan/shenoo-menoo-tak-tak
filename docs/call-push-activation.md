# Incoming calls during Doze: activation required

Status: prepared integration, not an activated or phone-tested fix. Existing 1.5.0 uses foreground polling. Android can suspend its network traffic during Doze.

## Required account configuration

1. Create/select the owner's Firebase project, enable Firebase Cloud Messaging HTTP v1 API, register Android package `com.shnomano.call`.
2. Download the Android **google-services.json** client configuration. Supply its complete JSON as GitHub Actions secret `SHNO_FIREBASE_ANDROID_CONFIG`, or place it locally at `android/shno-mano-call/app/google-services.json` for a local build. The Gradle configuration rejects the wrong package. This is client configuration, not an administrator private key.
3. In the SAME project, create a service account authorized only to send FCM messages (`roles/firebasecloudmessaging.admin`). Set its JSON as Cloudflare Pages production secret `SHNO_FCM_SERVICE_ACCOUNT`. Never put that private key in the APK, repository, issue, or conversation.
4. Apply additive migration `cloudflare/migrations/20261118_call_push.sql` to the bound D1 database.
5. Add a Worker bypass route (`script: null`) for `shinomino.com/api/call-push/*` and `www.shinomino.com/api/call-push/*` so device registration reaches Pages, as call-content and call-signals already do.
6. After configuration, merge/redeploy Pages and increment Android version before building/publishing the signed APK. Do not republish 1.5.0 under the same immutable release tag.

## Behavior

- Sign-in/token refresh registers installation ID + FCM token through the existing authenticated HttpOnly session. Logout unregisters and deletes the token. Only nonrevoked, unexpired sessions on active accounts receive hints.
- Only an accepted authorized 1:1 or group invite schedules FCM. Delivery failure does not undo the saved signaling event.
- FCM uses high priority, a 30-second TTL, and only event/call ID/recipient. No SDP, caller identity, text messages, or session credentials in the notification payload.
- Android rejects wrong-recipient, expired, normal-priority and signed-out hints. A valid hint starts the existing foreground call service, which independently authenticates and polls the real signaling API before showing an incoming call.
- Existing notification, ringtone, lock-screen and answer/reject UI are retained. Android notification permission/channel controls and full-screen intent access still apply; FCM cannot override user choices. Force-stop and some manufacturer restrictions require reopening the app.

## Required release validation

Test on two real signed-in phones: app foreground, another app active, locked screen, Doze (`adb shell dumpsys deviceidle force-idle`), app swiped from recents, ringing canceled before delivery, reject, answer, duplicate wake-up, logout/relogin/account switch, revoked session, no network/reconnect. Check both sender and recipient events, screen and audio. Exit forced idle after the test. Verify token and server project match, and verify real FCM acceptance; unit mocks are not evidence of delivery.

Do not call the background-call issue fixed until the provider is configured AND these device tests pass.
