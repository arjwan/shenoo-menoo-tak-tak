package com.shnomano.call

import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.shnomano.call.data.SHNO_MANO_BASE_URL
import com.shnomano.call.data.SessionStore
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit
import org.json.JSONObject

/**
 * Keeps an independent D1 session active for call invitations and new messages.
 * Browser and native app share the same signaling API, not the legacy Socket.IO route.
 */
class BackgroundRealtimeService : Service() {
    private var poller: ScheduledExecutorService? = null
    private var callCursor = 0L
    private val seenUnread = mutableMapOf<String, Int>()
    private val groupCursors = mutableMapOf<String, Long>()
    private val notifiedGroupCalls = mutableSetOf<String>()
    private var baselineLoaded = false
    private var lastMessagesCheck = 0L

    override fun onCreate() {
        super.onCreate()
        running = this
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (intent?.action == ACTION_REJECT_CALL) {
            val callId = intent.getStringExtra("call_id").orEmpty()
            val conversationId = intent.getStringExtra("conversation_id").orEmpty()
            val from = intent.getStringExtra("from").orEmpty()
            if (callId.isNotBlank() && conversationId.isNotBlank() && from.isNotBlank()) {
                Executors.newSingleThreadExecutor().execute {
                    try { rejectRemoteCall(callId, conversationId, from) }
                    catch (error: Exception) { Log.w(TAG, "Call rejection failed", error) }
                }
                clearCallAlert(callId)
            }
            return START_STICKY
        }
        startAsForeground()
        startPolling()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startAsForeground() {
        val launchIntent = Intent(this, MainActivity::class.java)
        val launchPendingIntent = PendingIntent.getActivity(
            this,
            SERVICE_NOTIFICATION_ID,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(this, ShnoManoApp.CHANNEL_REALTIME)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle("شنو منو")
            .setContentText("الاتصال اللحظي يعمل")
            .setContentIntent(launchPendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(SERVICE_NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(SERVICE_NOTIFICATION_ID, notification)
        }
    }

    // Single source of truth: the same D1 endpoints used by shinomino.com.
    // The standalone app retains its own session cookie in SessionStore.
    @Synchronized
    private fun startPolling() {
        if (poller != null) return
        if (!SessionStore(this).isSignedIn()) { stopSelf(); return }
        poller = Executors.newSingleThreadScheduledExecutor().also { worker ->
            worker.scheduleWithFixedDelay({
                try {
                    pollIncomingCalls()
                    if (System.currentTimeMillis() - lastMessagesCheck > 5000) {
                        lastMessagesCheck = System.currentTimeMillis()
                        pollMessages()
                        pollGroups()
                    }
                } catch (error: Exception) {
                    Log.w(TAG, "D1 realtime check failed: ${error.message}")
                }
            }, 0, 1600, TimeUnit.MILLISECONDS)
        }
    }

    private fun getJson(path: String): JSONObject {
        val session = SessionStore(this)
        val cookie = session.sessionCookie ?: throw IllegalStateException("لا توجد جلسة اتصال")
        val connection = URL(SHNO_MANO_BASE_URL + path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 7000
            connection.readTimeout = 7000
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Cookie", "__Host-shino_session=$cookie")
            if (connection.responseCode != 200) {
                if (connection.responseCode == 401) Log.w(TAG, "Standalone session expired or rejected")
                throw IllegalStateException("HTTP ${connection.responseCode}")
            }
            val body = connection.inputStream.bufferedReader().use { it.readText() }
            return JSONObject(body)
        } finally {
            connection.disconnect()
        }
    }

    private fun pollIncomingCalls() {
        val data = getJson("api/call-signals?after=$callCursor")
        if (!data.optBoolean("ok")) return
        val events = data.optJSONArray("events") ?: return
        for (i in 0 until events.length()) {
            val event = events.optJSONObject(i) ?: continue
            if (event.optString("event") == "call:invite") {
                val payload = JSONObject()
                    .put("callId", event.optString("callId"))
                    .put("from", event.optString("from"))
                    .put("conversationId", event.optString("conversationId"))
                    .put("callerName", event.optString("callerName"))
                    .put("type", event.optJSONObject("payload")?.optString("type") ?: "audio")
                handleIncomingInvite(payload, false)
            } else if (event.optString("event") in listOf("call:end", "call:reject", "call:accept")) {
                clearCallAlert(event.optString("callId"))
            }
            callCursor = maxOf(callCursor, event.optLong("id", 0L))
        }
        callCursor = maxOf(callCursor, data.optLong("cursor", callCursor))
    }

    private fun pollMessages() {
        val data = getJson("api/conversations")
        val entries = data.optJSONArray("conversations") ?: return
        val updated = mutableMapOf<String, Int>()
        for (i in 0 until entries.length()) {
            val row = entries.optJSONObject(i) ?: continue
            val id = row.optString("id")
            val unread = row.optInt("unreadCount", 0)
            if (id.isBlank()) continue
            updated[id] = unread
            if (baselineLoaded && unread > (seenUnread[id] ?: 0)) {
                val other = row.optJSONObject("otherUser")
                val name = other?.optString("fullName")?.takeIf { it.isNotBlank() } ?: "شنو منو"
                val target = Intent(this, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val pending = PendingIntent.getActivity(
                    this, id.hashCode(), target,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                val notification = NotificationCompat.Builder(this, ShnoManoApp.CHANNEL_MESSAGES)
                    .setSmallIcon(R.drawable.ic_launcher)
                    .setContentTitle("رسالة جديدة من $name")
                    .setContentText("لديك رسائل جديدة في شنو منو اتصال")
                    .setContentIntent(pending)
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .build()
                getSystemService(NotificationManager::class.java).notify(id.hashCode(), notification)
            }
        }
        seenUnread.clear()
        seenUnread.putAll(updated)
        baselineLoaded = true
    }

    // Private group invitations also arrive when the group's web page is closed.
    private fun pollGroups() {
        val list = getJson("api/call-groups").optJSONArray("groups") ?: return
        for (index in 0 until list.length()) {
            val group = list.optJSONObject(index) ?: continue
            val groupId = group.optString("id")
            if (groupId.isBlank()) continue
            val cursor = groupCursors[groupId] ?: 0L
            val response = getJson("api/call-groups/$groupId/signals?after=$cursor")
            val signals = response.optJSONArray("signals") ?: continue
            for (i in 0 until signals.length()) {
                val signal = signals.optJSONObject(i) ?: continue
                if (signal.optString("event") == "invite") {
                    val callId = signal.optString("callId")
                    if (callId.isNotBlank() && notifiedGroupCalls.add(callId)) {
                        notifyGroupCall(groupId, group.optString("name"), callId)
                    }
                }
            }
            groupCursors[groupId] = response.optLong("cursor", cursor)
        }
    }

    private fun notifyGroupCall(groupId: String, name: String, callId: String) {
        val url = SHNO_MANO_BASE_URL + "call-groups.html?group=" + Uri.encode(groupId)
        val open = Intent(this, WebSectionActivity::class.java).apply {
            putExtra(WebSectionActivity.EXTRA_URL, url)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pending = PendingIntent.getActivity(
            this, callId.hashCode(), open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(this, ShnoManoApp.CHANNEL_CALLS)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle("مكالمة جماعية واردة")
            .setContentText(name.ifBlank { "شنو منو اتصال" })
            .setContentIntent(pending)
            .setFullScreenIntent(pending, true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .addAction(NotificationCompat.Action.Builder(R.drawable.ic_launcher, "فتح وقبول الدعوة", pending).build())
            .build()
        getSystemService(NotificationManager::class.java).notify(callId.hashCode(), notification)
    }

    private fun handleIncomingInvite(payload: JSONObject, isGroup: Boolean) {
        val callId = if (isGroup) payload.optString("groupId").trim() else payload.optString("callId").trim()
        val from = payload.optString("from").trim()
        val conversationId = payload.optString("conversationId").trim().ifBlank { callId }
        val type = payload.optString("type").takeIf { it == "audio" || it == "video" } ?: "audio"
        if (callId.isBlank() || from.isBlank()) return
        val call = IncomingCall(
            callId = callId,
            from = from,
            conversationId = conversationId,
            type = type,
            callerName = payload.optString("callerName").ifBlank { "مستخدم شنو منو" }
        )
        if (!PresenceStore.acceptIncomingCall(call)) return
        // Android notification channel owns the call ringtone (no second player).
        postIncomingCallNotification(call, isGroup)
    }

    private fun rejectRemoteCall(callId: String, conversationId: String, from: String) {
        val cookie = SessionStore(this).sessionCookie ?: return
        val conn = URL(SHNO_MANO_BASE_URL + "api/call-signals").openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.connectTimeout = 7000
            conn.readTimeout = 7000
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Cookie", "__Host-shino_session=$cookie")
            val body = JSONObject()
                .put("event", "call:reject")
                .put("callId", callId)
                .put("conversationId", conversationId)
                .put("userId", from)
                .put("reason", "declined")
                .toString()
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            if (conn.responseCode !in 200..299) Log.w(TAG, "Reject signal HTTP ${conn.responseCode}")
        } finally {
            conn.disconnect()
        }
    }

    private fun postIncomingCallNotification(call: IncomingCall, isGroup: Boolean) {
        val url = "${SHNO_MANO_BASE_URL}messages.html?user=${Uri.encode(call.from)}"
        val openCall = Intent(this, WebCallActivity::class.java).apply {
            putExtra(WebCallActivity.EXTRA_URL, url)
            putExtra(WebCallActivity.EXTRA_INCOMING, true)
            putExtra(WebCallActivity.EXTRA_GROUP_CALL, isGroup)
            putExtra(WebCallActivity.EXTRA_CALL_ID, call.callId)
            putExtra(WebCallActivity.EXTRA_FROM, call.from)
            putExtra(WebCallActivity.EXTRA_CONVERSATION_ID, call.conversationId)
            putExtra(WebCallActivity.EXTRA_CALL_TYPE, call.type)
            putExtra(WebCallActivity.EXTRA_CALLER_NAME, call.callerName)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            call.callId.hashCode(),
            openCall,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val answerCall = Intent(openCall).apply {
            putExtra(WebCallActivity.EXTRA_AUTO_ACCEPT, true)
        }
        val answerPending = PendingIntent.getActivity(
            this, call.callId.hashCode() xor 0x2345, answerCall,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val rejectCall = Intent(this, BackgroundRealtimeService::class.java).apply {
            action = ACTION_REJECT_CALL
            putExtra("call_id", call.callId)
            putExtra("conversation_id", call.conversationId)
            putExtra("from", call.from)
        }
        val rejectPending = PendingIntent.getService(
            this, call.callId.hashCode() xor 0x3476, rejectCall,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val typeLabel = when {
            isGroup && call.type == "video" -> "دعوة لمكالمة فيديو جماعية"
            isGroup -> "دعوة لمكالمة صوتية جماعية"
            call.type == "video" -> "مكالمة فيديو واردة"
            else -> "مكالمة صوتية واردة"
        }
        val notification = NotificationCompat.Builder(this, ShnoManoApp.CHANNEL_CALLS)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle(typeLabel)
            .setContentText(call.callerName)
            .setContentIntent(pendingIntent)
            .setFullScreenIntent(pendingIntent, true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setOnlyAlertOnce(true)
            .addAction(NotificationCompat.Action.Builder(R.drawable.ic_launcher, "قبول", answerPending).build())
            .addAction(NotificationCompat.Action.Builder(R.drawable.ic_launcher, "رفض", rejectPending).build())
            .build()
        getSystemService(NotificationManager::class.java).notify(CALL_NOTIFICATION_ID, notification)
    }

    private fun clearCallAlert(callId: String?) {
        val current = PresenceStore.incomingCall.value
        if (callId.isNullOrBlank() || current?.callId == callId) {
            PresenceStore.clearIncomingCall(callId)
            getSystemService(NotificationManager::class.java).cancel(CALL_NOTIFICATION_ID)
        }
    }

    private fun callIdFrom(args: Array<out Any?>): String? {
        val payload = args.firstOrNull() as? JSONObject ?: return null
        return payload.optString("callId").takeIf { it.isNotBlank() }
            ?: payload.optString("groupId").takeIf { it.isNotBlank() }
    }

    override fun onDestroy() {
        getSystemService(NotificationManager::class.java).cancel(CALL_NOTIFICATION_ID)
        poller?.shutdownNow()
        poller = null
        PresenceStore.clearAll()
        if (running === this) running = null
        super.onDestroy()
    }

    companion object {
        private const val TAG = "ShnoRealtime"
        private const val ACTION_STOP = "com.shnomano.call.action.STOP_REALTIME"
        private const val ACTION_REJECT_CALL = "com.shnomano.call.action.REJECT_CALL"
        private const val SERVICE_NOTIFICATION_ID = 4101
        private const val CALL_NOTIFICATION_ID = 4102
        @Volatile private var running: BackgroundRealtimeService? = null

        fun start(context: Context) {
            val app = context.applicationContext
            if (!SessionStore(app).isSignedIn()) return
            ContextCompat.startForegroundService(app, Intent(app, BackgroundRealtimeService::class.java))
        }

        fun stop(context: Context) {
            val app = context.applicationContext
            running?.stopSelf()
            app.stopService(Intent(app, BackgroundRealtimeService::class.java))
            PresenceStore.clearAll()
        }

        fun acknowledgeIncomingCall(callId: String) { running?.clearCallAlert(callId) }
    }
}