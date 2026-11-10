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
    private val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val handledCalls = java.util.Collections.synchronizedSet(linkedSetOf<String>())
    private var callCursor = 0L
    private val seenUnread = mutableMapOf<String, Int>()
    private var groupCursor = 0L
    private var groupMessagesCursor = 0L
    private var groupMessageBaseline = false
    private val notifiedGroupCalls = mutableSetOf<String>()
    private var baselineLoaded = false
    private var lastMessagesCheck = 0L
    private var activeCall: JSONObject? = null

    override fun onCreate() {
        super.onCreate()
        running = this
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        try { startAsForeground() }
        catch (error: Exception) { AppDiagnostics.record(this, error, "foreground-service"); stopSelf(); return START_NOT_STICKY }
        startPolling()
        if (intent?.action == ACTION_END_CALL) {
            if (!WebCallActivity.endActiveCall()) {
                activeCall?.let { call ->
                    poller?.execute {
                        try { sendTerminalSignal(call.optString("callId"), call.optString("conversationId"), call.optString("userId"), "call:end") }
                        catch (error: Exception) { Log.w(TAG, "Call termination failed", error) }
                    }
                    clearActiveNotification(call.optString("callId"))
                }
            }
            return START_STICKY
        }
        if (intent?.action == ACTION_REJECT_CALL) {
            val callId = intent.getStringExtra("call_id").orEmpty()
            val conversationId = intent.getStringExtra("conversation_id").orEmpty()
            val from = intent.getStringExtra("from").orEmpty()
            if (callId.isNotBlank() && conversationId.isNotBlank() && from.isNotBlank()) {
                CallAlertState.close(callId)
                WebCallActivity.dismissIncomingCall(callId)
                poller?.execute {
                    try { sendTerminalSignal(callId, conversationId, from) }
                    catch (error: Exception) { Log.w(TAG, "Call rejection failed", error) }
                }
                clearCallAlert(callId)
            }
            return START_STICKY
        }
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
            var types = if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING else 0
            if (activeCall != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED) types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                if (activeCall?.optString("type") == "video" && ContextCompat.checkSelfPermission(this, android.Manifest.permission.CAMERA) == android.content.pm.PackageManager.PERMISSION_GRANTED) types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
            }
            // Android enforces while-in-use grants when capture types are added.
            try { startForeground(SERVICE_NOTIFICATION_ID, notification, types) }
            catch (error: SecurityException) {
                Log.w(TAG, "Capture foreground permission unavailable", error)
                startForeground(SERVICE_NOTIFICATION_ID, notification, if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING else 0)
            }
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
                        pollGroupMessages()
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
        val terminated = (0 until events.length()).mapNotNull { events.optJSONObject(it) }
            .filter { it.optString("event") in listOf("call:end", "call:reject", "call:accept") }
            .map { it.optString("callId") }.toSet()
        for (i in 0 until events.length()) {
            val event = events.optJSONObject(i) ?: continue
            if (event.optString("event") == "call:invite" && event.optString("callId") !in terminated) {
                val payload = JSONObject()
                    .put("callId", event.optString("callId"))
                    .put("from", event.optString("from"))
                    .put("conversationId", event.optString("conversationId"))
                    .put("callerName", event.optString("callerName"))
                    .put("type", event.optJSONObject("payload")?.optString("type") ?: "audio")
                handleIncomingInvite(payload, false)
            } else if (event.optString("event") in listOf("call:end", "call:reject", "call:accept")) {
                val id = event.optString("callId")
                clearCallAlert(id)
                if (event.optString("event") != "call:accept") CallAlertState.close(id)
                if (event.optString("event") != "call:accept" && activeCall?.optString("callId") == id) {
                    mainHandler.post { WebCallActivity.endActiveCall(); clearActiveNotification(id) }
                }
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
        val response = getJson("api/call-groups/alerts?after=$groupCursor")
        val invites = response.optJSONArray("invites") ?: return
        for (i in 0 until invites.length()) {
            val event = invites.optJSONObject(i) ?: continue
            val callId = event.optString("callId")
            val groupId = event.optString("groupId")
            if (callId.isNotBlank() && groupId.isNotBlank() && notifiedGroupCalls.add(callId)) {
                notifyGroupCall(groupId, event.optString("name"), callId)
            }
        }
        groupCursor = response.optLong("cursor", groupCursor)
    }

    private fun pollGroupMessages() {
        val response = getJson("api/call-groups/message-alerts?after=$groupMessagesCursor")
        val messages = response.optJSONArray("messages") ?: return
        for (i in 0 until messages.length()) {
            val msg = messages.optJSONObject(i) ?: continue
            val groupId = msg.optString("groupId")
            if (groupId.isBlank() || !groupMessageBaseline) continue
            val link = Intent(this, WebSectionActivity::class.java).apply {
                putExtra(WebSectionActivity.EXTRA_URL, SHNO_MANO_BASE_URL + "call-groups.html?group=" + Uri.encode(groupId))
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pending = PendingIntent.getActivity(
                this, groupId.hashCode(), link,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val n = NotificationCompat.Builder(this, ShnoManoApp.CHANNEL_MESSAGES)
                .setSmallIcon(R.drawable.ic_launcher)
                .setContentTitle(msg.optString("senderName") + " · " + msg.optString("groupName"))
                .setContentText(msg.optString("text"))
                .setContentIntent(pending)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .build()
            getSystemService(NotificationManager::class.java).notify(groupId.hashCode(), n)
        }
        groupMessagesCursor = response.optLong("cursor", groupMessagesCursor)
        groupMessageBaseline = true
    }

    private fun notifyGroupCall(groupId: String, name: String, callId: String) {
        val url = SHNO_MANO_BASE_URL + "call-groups.html?group=" + Uri.encode(groupId) + "&incomingCall=" + Uri.encode(callId)
        val open = Intent(this, WebSectionActivity::class.java).apply {
            putExtra(WebSectionActivity.EXTRA_URL, url)
            putExtra(WebSectionActivity.EXTRA_GROUP_INVITE, true)
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
            .setTimeoutAfter(30_000)
            .addAction(NotificationCompat.Action.Builder(R.drawable.ic_launcher, "عرض المكالمة", pending).build())
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
        if (CallAlertState.isClosed(callId) || !handledCalls.add(callId)) return
        synchronized(handledCalls) { if (handledCalls.size > 128) handledCalls.remove(handledCalls.first()) }
        if (!PresenceStore.acceptIncomingCall(call)) return
        mainHandler.postDelayed({ clearCallAlert(callId) }, 30_000)
        // Android notification channel owns the call ringtone (no second player).
        postIncomingCallNotification(call, isGroup)
    }

    private fun sendTerminalSignal(callId: String, conversationId: String, from: String, event: String = "call:reject") {
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
                .put("event", event)
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
            .setTimeoutAfter(30_000)
            .setAutoCancel(false)
            .setOnlyAlertOnce(true)
            .addAction(NotificationCompat.Action.Builder(R.drawable.ic_launcher, "قبول", answerPending).build())
            .addAction(NotificationCompat.Action.Builder(R.drawable.ic_launcher, "رفض", rejectPending).build())
            .build().apply {
                if (SettingsStore(this@BackgroundRealtimeService).callSoundEnabled) this.flags = this.flags or android.app.Notification.FLAG_INSISTENT
            }
        getSystemService(NotificationManager::class.java).notify(CALL_NOTIFICATION_ID, notification)
    }

    private fun showActiveCall(state: JSONObject, url: String) {
        activeCall = state
        startAsForeground()
        val resume = Intent(this, WebCallActivity::class.java).apply {
            putExtra(WebCallActivity.EXTRA_URL, url)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pending = PendingIntent.getActivity(this, ACTIVE_CALL_NOTIFICATION_ID, resume, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val end = PendingIntent.getService(this, ACTIVE_CALL_NOTIFICATION_ID,
            Intent(this, BackgroundRealtimeService::class.java).setAction(ACTION_END_CALL),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(this, ShnoManoApp.CHANNEL_REALTIME)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle("مكالمة شنو منو اتصال")
            .setContentText("اضغط للرجوع إلى المكالمة")
            .setContentIntent(pending)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .addAction(R.drawable.ic_launcher, "إنهاء المكالمة", end)
            .build()
        getSystemService(NotificationManager::class.java).notify(ACTIVE_CALL_NOTIFICATION_ID, notification)
    }

    private fun clearActiveNotification(callId: String) {
        if (activeCall?.optString("callId") != callId) return
        activeCall = null
        startAsForeground()
        getSystemService(NotificationManager::class.java).cancel(ACTIVE_CALL_NOTIFICATION_ID)
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
        getSystemService(NotificationManager::class.java).cancel(ACTIVE_CALL_NOTIFICATION_ID)
        mainHandler.removeCallbacksAndMessages(null)
        poller?.shutdownNow()
        poller = null
        PresenceStore.clearAll()
        if (running === this) running = null
        super.onDestroy()
    }

    companion object {
        private const val TAG = "ShnoRealtime"
        private const val ACTION_END_CALL = "com.shnomano.call.action.END_CALL"
        private const val ACTIVE_CALL_NOTIFICATION_ID = 4103
        private const val ACTION_STOP = "com.shnomano.call.action.STOP_REALTIME"
        private const val ACTION_REJECT_CALL = "com.shnomano.call.action.REJECT_CALL"
        private const val SERVICE_NOTIFICATION_ID = 4101
        private const val CALL_NOTIFICATION_ID = 4102
        @Volatile private var running: BackgroundRealtimeService? = null

        fun start(context: Context) {
            val app = context.applicationContext
            if (!SessionStore(app).isSignedIn()) return
            try { ContextCompat.startForegroundService(app, Intent(app, BackgroundRealtimeService::class.java)) }
            catch (error: Exception) { AppDiagnostics.record(app, error, "background-start"); Log.e(TAG, "Unable to start background alerts", error) }
        }

        fun stop(context: Context) {
            val app = context.applicationContext
            running?.stopSelf()
            app.stopService(Intent(app, BackgroundRealtimeService::class.java))
            PresenceStore.clearAll()
        }

        fun trackActiveCall(state: JSONObject, url: String) {
            running?.showActiveCall(state, url)
        }
        fun refreshCaptureForeground() {
            val service = running ?: return
            try { service.startAsForeground() } catch (error: Exception) { AppDiagnostics.record(service, error, "foreground-capture") }
        }
        fun clearActiveCall(callId: String) { running?.clearActiveNotification(callId) }
        fun acknowledgeIncomingCall(callId: String) { running?.clearCallAlert(callId) }
    }
}