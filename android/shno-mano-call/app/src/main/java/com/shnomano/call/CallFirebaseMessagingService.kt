package com.shnomano.call

import android.Manifest
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.shnomano.call.data.SHNO_MANO_BASE_URL
import com.shnomano.call.data.SessionStore

/** Handles a data-only high-priority call invite even without foreground polling. */
class CallFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        CallPushRegistration.updated(this, token)
    }
    override fun onMessageReceived(message: RemoteMessage) {
        val kind = message.data["kind"]
        if (kind != "call:invite" && kind != "call:missed" && kind != "chat:message") return
        if (!SessionStore(this).isSignedIn()) return
        val data = message.data
        if (kind == "chat:message") {
            val fromId = data["from"].orEmpty()
            val chatId = data["conversationId"].orEmpty()
            if (!UUID_PATTERN.matches(chatId) || !UUID_PATTERN.matches(fromId)) return
            if (Build.VERSION.SDK_INT >= 33 &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
            if (!SettingsStore(this).notificationsEnabled) return
            val open = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pending = PendingIntent.getActivity(this, chatId.hashCode(), open,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val type = data["messageType"].orEmpty()
            val text = when (type) {
                "audio" -> "رسالة صوتية جديدة"
                "video" -> "رسالة فيديو جديدة"
                "image" -> "صورة جديدة"
                else -> "رسالة جديدة"
            }
            val notification = NotificationCompat.Builder(this, ShnoManoApp.CHANNEL_MESSAGES)
                .setSmallIcon(R.drawable.ic_launcher)
                .setContentTitle("شنو منو اتصال")
                .setContentText(text)
                .setContentIntent(pending)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .build()
            getSystemService(NotificationManager::class.java).notify(chatId.hashCode(), notification)
            return
        }
        val callId = data["callId"].orEmpty()
        val from = data["from"].orEmpty()
        val conversationId = data["conversationId"].orEmpty()
        if (!UUID_PATTERN.matches(callId) || !UUID_PATTERN.matches(from) || !UUID_PATTERN.matches(conversationId)) return
        if (kind == "call:invite" && CallAlertState.isClosed(callId)) return
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        if (!SettingsStore(this).notificationsEnabled) return

        val name = data["callerName"]?.take(100)?.ifBlank { "مستخدم شنو منو" } ?: "مستخدم شنو منو"
        val type = if (data["type"] == "video") "video" else "audio"
        if (kind == "call:missed") {
            val prefs = getSharedPreferences("shno_missed_call_badges", MODE_PRIVATE)
            val ids = (prefs.getStringSet("ids", emptySet()) ?: emptySet()).toMutableSet()
            ids.add(callId)
            if (ids.size > 50) ids.clear().also { ids.add(callId) }
            prefs.edit().putStringSet("ids", ids).apply()
            val intent = Intent(this, WebSectionActivity::class.java).apply {
                putExtra(WebSectionActivity.EXTRA_URL, SHNO_MANO_BASE_URL + "call-history.html")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pending = PendingIntent.getActivity(this, 4203, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val notification = NotificationCompat.Builder(this, ShnoManoApp.CHANNEL_MISSED)
                .setSmallIcon(R.drawable.ic_launcher)
                .setContentTitle("مكالمة فائتة")
                .setContentText(name)
                .setContentIntent(pending)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setNumber(ids.size)
                .setBadgeIconType(NotificationCompat.BADGE_ICON_SMALL)
                .build()
            getSystemService(NotificationManager::class.java).notify(4203, notification)
            return
        }
        val open = Intent(this, WebCallActivity::class.java).apply {
            putExtra(WebCallActivity.EXTRA_URL, SHNO_MANO_BASE_URL + "messages.html?user=" + Uri.encode(from))
            putExtra(WebCallActivity.EXTRA_INCOMING, true)
            putExtra(WebCallActivity.EXTRA_CALL_ID, callId)
            putExtra(WebCallActivity.EXTRA_FROM, from)
            putExtra(WebCallActivity.EXTRA_CONVERSATION_ID, conversationId)
            putExtra(WebCallActivity.EXTRA_CALL_TYPE, type)
            putExtra(WebCallActivity.EXTRA_CALLER_NAME, name)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val openPending = PendingIntent.getActivity(this, callId.hashCode(), open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val accept = Intent(open).putExtra(WebCallActivity.EXTRA_AUTO_ACCEPT, true)
        val acceptPending = PendingIntent.getActivity(this, callId.hashCode() xor 0x2345, accept,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val reject = Intent(this, CallRejectReceiver::class.java).apply {
            putExtra("call_id", callId)
            putExtra("conversation_id", conversationId)
            putExtra("from", from)
        }
        val rejectPending = PendingIntent.getBroadcast(this, callId.hashCode() xor 0x3476, reject,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(this, ShnoManoApp.CHANNEL_CALLS)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle(if(type == "video") "مكالمة فيديو واردة" else "مكالمة صوتية واردة")
            .setContentText(name)
            .setContentIntent(openPending)
            .setFullScreenIntent(openPending, true)
            .setSilent(!SettingsStore(this).callSoundEnabled)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setTimeoutAfter(30_000L)
            .setOnlyAlertOnce(true)
            .addAction(R.drawable.ic_launcher, "قبول", acceptPending)
            .addAction(R.drawable.ic_launcher, "رفض", rejectPending)
            .build().apply {
                if (SettingsStore(this@CallFirebaseMessagingService).callSoundEnabled)
                    flags = flags or android.app.Notification.FLAG_INSISTENT
            }
        getSystemService(NotificationManager::class.java).notify(4102, notification)
    }
    companion object {
        private val UUID_PATTERN=Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
    }
}
