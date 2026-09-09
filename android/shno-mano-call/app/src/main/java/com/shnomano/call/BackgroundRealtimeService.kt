package com.shnomano.call

import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.shnomano.call.data.SHNO_MANO_BASE_URL
import com.shnomano.call.data.SessionStore
import io.socket.client.IO
import io.socket.client.Socket
import io.socket.emitter.Emitter
import org.json.JSONObject

/**
 * Owns the one authenticated Socket.IO connection used while a user is
 * signed in. WebViews may open a second short-lived socket for WebRTC, but the
 * app's background presence and incoming-call socket is never duplicated by
 * this service.
 */
class BackgroundRealtimeService : Service() {
    private var socket: Socket? = null
    private var socketToken: String? = null
    private var ringtone: Ringtone? = null

    override fun onCreate() {
        super.onCreate()
        running = this
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }

        startAsForeground()
        connectOnce()
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
            startForeground(
                SERVICE_NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            )
        } else {
            startForeground(SERVICE_NOTIFICATION_ID, notification)
        }
    }

    @Synchronized
    private fun connectOnce() {
        val token = SessionStore(this).token?.takeIf { it.isNotBlank() } ?: run {
            stopSelf()
            return
        }

        val current = socket
        if (current != null && socketToken == token) {
            if (!current.connected()) current.connect()
            return
        }

        disconnectSocket()
        val options = IO.Options().apply {
            forceNew = false
            reconnection = true
            reconnectionAttempts = Int.MAX_VALUE
            reconnectionDelay = 1_000
            reconnectionDelayMax = 10_000
            randomizationFactor = 0.25
            timeout = 20_000
            // The server accepts this header during the Socket.IO handshake.
            // Using headers also works with the Android client across v2/v4
            // protocol versions without relying on a JS-only auth option.
            extraHeaders = mapOf("Authorization" to listOf("Bearer $token"))
        }

        val created = runCatching { IO.socket(SHNO_MANO_BASE_URL, options) }.getOrNull() ?: return
        socketToken = token
        socket = created
        registerSocketListeners(created)
        created.connect()
    }

    private fun registerSocketListeners(client: Socket) {
        client.on(Socket.EVENT_CONNECT, Emitter.Listener {
            Log.d(TAG, "realtime socket connected")
        })
        client.on("presence:state", Emitter.Listener { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@Listener
            val ids = payload.optJSONArray("userIds") ?: return@Listener
            val online = buildList {
                for (index in 0 until ids.length()) add(ids.optString(index))
            }
            PresenceStore.replaceOnline(online)
        })
        client.on("presence:online", Emitter.Listener { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@Listener
            PresenceStore.markOnline(payload.optString("userId"))
        })
        client.on("presence:offline", Emitter.Listener { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@Listener
            PresenceStore.markOffline(payload.optString("userId"))
        })
        client.on("call:invite", Emitter.Listener { args ->
            val payload = args.firstOrNull() as? JSONObject ?: return@Listener
            handleIncomingInvite(payload)
        })
        client.on("call:accept", Emitter.Listener { args ->
            clearCallAlert(callIdFrom(args))
        })
        client.on("call:reject", Emitter.Listener { args ->
            clearCallAlert(callIdFrom(args))
        })
        client.on("call:end", Emitter.Listener { args ->
            clearCallAlert(callIdFrom(args))
        })
        client.on(Socket.EVENT_DISCONNECT, Emitter.Listener {
            // Without a live socket there is no trustworthy remote presence
            // value. The built-in Socket.IO manager reconnects and sends a new
            // snapshot; no second timer or manual reconnect loop is started.
            PresenceStore.replaceOnline(emptySet())
            Log.d(TAG, "realtime socket disconnected; waiting for Socket.IO reconnect")
        })
        client.on(Socket.EVENT_CONNECT_ERROR, Emitter.Listener { args ->
            Log.w(TAG, "realtime socket connection error: ${args.firstOrNull()}")
        })
    }

    private fun handleIncomingInvite(payload: JSONObject) {
        val callId = payload.optString("callId").trim()
        val from = payload.optString("from").trim()
        val conversationId = payload.optString("conversationId").trim()
        val type = payload.optString("type").takeIf { it == "audio" || it == "video" } ?: "audio"
        if (callId.isBlank() || from.isBlank() || conversationId.isBlank()) return

        val call = IncomingCall(
            callId = callId,
            from = from,
            conversationId = conversationId,
            type = type,
            callerName = payload.optString("callerName").ifBlank { "مستخدم شنو منو" }
        )
        if (!PresenceStore.acceptIncomingCall(call)) return
        startRingtone()
        postIncomingCallNotification(call)
    }

    private fun postIncomingCallNotification(call: IncomingCall) {
        val url = "${SHNO_MANO_BASE_URL}messages.html?user=${Uri.encode(call.from)}"
        val openCall = Intent(this, WebCallActivity::class.java).apply {
            putExtra(WebCallActivity.EXTRA_URL, url)
            putExtra(WebCallActivity.EXTRA_INCOMING, true)
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
        val typeLabel = if (call.type == "video") "مكالمة فيديو واردة" else "مكالمة صوتية واردة"
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
            .addAction(NotificationCompat.Action.Builder(R.drawable.ic_launcher, "فتح المكالمة", pendingIntent).build())
            .build()
        getSystemService(NotificationManager::class.java).notify(CALL_NOTIFICATION_ID, notification)
    }

    private fun startRingtone() {
        stopRingtone()
        if (!SettingsStore(this).callSoundEnabled) return
        val uri = SettingsStore(this).ringtoneUri?.let(Uri::parse)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        ringtone = RingtoneManager.getRingtone(applicationContext, uri)?.also { tone ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                tone.audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            }
            tone.play()
        }
    }

    private fun stopRingtone() {
        ringtone?.let { if (it.isPlaying) it.stop() }
        ringtone = null
    }

    private fun clearCallAlert(callId: String?) {
        val current = PresenceStore.incomingCall.value
        if (callId.isNullOrBlank() || current?.callId == callId) {
            PresenceStore.clearIncomingCall(callId)
            stopRingtone()
            getSystemService(NotificationManager::class.java).cancel(CALL_NOTIFICATION_ID)
        }
    }

    private fun callIdFrom(args: Array<out Any?>): String? =
        (args.firstOrNull() as? JSONObject)?.optString("callId")?.takeIf { it.isNotBlank() }

    @Synchronized
    private fun disconnectSocket() {
        socket?.off()
        socket?.disconnect()
        socket?.close()
        socket = null
        socketToken = null
    }

    override fun onDestroy() {
        stopRingtone()
        getSystemService(NotificationManager::class.java).cancel(CALL_NOTIFICATION_ID)
        disconnectSocket()
        PresenceStore.clearAll()
        if (running === this) running = null
        super.onDestroy()
    }

    companion object {
        private const val TAG = "ShnoRealtime"
        private const val ACTION_STOP = "com.shnomano.call.action.STOP_REALTIME"
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

        fun acknowledgeIncomingCall(callId: String) {
            running?.clearCallAlert(callId)
        }
    }
}
