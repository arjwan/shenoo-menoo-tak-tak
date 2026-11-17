package com.shnomano.call

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.shnomano.call.data.SessionStore

/** FCM is a wake-up hint; the authenticated signaling API supplies every call detail. */
class CallPushMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        CallPushRegistration.register(this, token)
    }
    override fun onMessageReceived(message: RemoteMessage) {
        val session = SessionStore(this)
        if (!session.isSignedIn() || message.data["recipient"] != session.userId ||
            message.data["event"] != "call:wake" || !SettingsStore(this).notificationsEnabled) return
        if (message.sentTime <= 0 || System.currentTimeMillis() - message.sentTime > 30_000) return
        // Starting an FGS from a downgraded/normal-priority message is prohibited on modern Android.
        if (message.priority != RemoteMessage.PRIORITY_HIGH) return
        BackgroundRealtimeService.start(this)
    }
}
