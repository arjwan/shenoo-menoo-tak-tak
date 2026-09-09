package com.shnomano.call

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.shnomano.call.data.ApiFactory
import com.shnomano.call.data.SHNO_MANO_BASE_URL
import com.shnomano.call.data.SessionStore
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONObject

class BackgroundRealtimeService : Service() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var session: SessionStore
    private var socket: Socket? = null

    override fun onCreate() {
        super.onCreate()
        session = SessionStore(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!session.isSignedIn()) {
            stopSelf()
            return START_NOT_STICKY
        }
        startForeground(ONGOING_ID, ongoingNotification())
        connectSocket()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun connectSocket() {
        if (socket?.connected() == true) return
        socket?.disconnect()
        socket?.close()

        val token = session.token ?: return
        val options = IO.Options.builder()
            .setAuth(mapOf("token" to token))
            .setReconnection(true)
            .build()

        socket = IO.socket(SHNO_MANO_BASE_URL, options).also { s ->
            s.on(Socket.EVENT_CONNECT) {
                joinConversationRooms(s)
            }
            s.on("call:invite") { args ->
                val payload = args.firstOrNull() as? JSONObject ?: return@on
                showIncomingCall(payload)
            }
            s.on("call:end") { cancelCallNotification() }
            s.on("call:reject") { cancelCallNotification() }
            s.on("private:message") { args ->
                val payload = args.firstOrNull() as? JSONObject ?: return@on
                showMessage(payload)
            }
            s.connect()
        }
    }

    private fun joinConversationRooms(s: Socket) {
        val api = ApiFactory.create { session.token }
        serviceScope.launch {
            runCatching { api.conversations().conversations }
                .getOrDefault(emptyList())
                .forEach { conversation -> s.emit("private:join", conversation.id) }
        }
    }

    private fun showIncomingCall(payload: JSONObject) {
        val callerId = payload.optString("from")
        val callerName = payload.optString("callerName").ifBlank { "مستخدم شنو منو" }
        val type = payload.optString("type").ifBlank { "audio" }
        val callId = payload.optString("callId")
        if (callerId.isBlank()) return

        val targetUrl = SHNO_MANO_BASE_URL + "messages.html?user=" + Uri.encode(callerId) + "&incoming=1"
        val openIntent = Intent(this, WebCallActivity::class.java)
            .putExtra(WebCallActivity.EXTRA_URL, targetUrl)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pendingIntent = PendingIntent.getActivity(
            this,
            callId.hashCode(),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val title = if (type == "video") "مكالمة فيديو واردة" else "مكالمة صوتية واردة"
        val notification = NotificationCompat.Builder(this, ShnoManoApp.CHANNEL_CALLS)
            .setSmallIcon(com.shnomano.call.R.drawable.ic_launcher)
            .setContentTitle(title)
            .setContentText(callerName)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(pendingIntent)
            .setFullScreenIntent(pendingIntent, true)
            .addAction(0, "فتح المكالمة", pendingIntent)
            .build()

        runCatching {
            NotificationManagerCompat.from(this).notify(CALL_ID, notification)
        }
    }

    private fun showMessage(payload: JSONObject) {
        val senderId = payload.optString("senderId")
        if (senderId.isNotBlank() && senderId == session.userId) return
        val message = payload.optJSONObject("message")
        val body = message?.optString("text").orEmpty().ifBlank { "وصلتك رسالة جديدة" }
        val conversationId = payload.optString("conversationId")

        val openIntent = Intent(this, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pendingIntent = PendingIntent.getActivity(
            this,
            conversationId.hashCode(),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, ShnoManoApp.CHANNEL_MESSAGES)
            .setSmallIcon(com.shnomano.call.R.drawable.ic_launcher)
            .setContentTitle("رسالة جديدة في شنو منو")
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        runCatching {
            NotificationManagerCompat.from(this).notify((conversationId + body).hashCode(), notification)
        }
    }

    private fun cancelCallNotification() {
        runCatching { NotificationManagerCompat.from(this).cancel(CALL_ID) }
    }

    private fun ongoingNotification(): Notification {
        val openIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            ONGOING_ID,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, ShnoManoApp.CHANNEL_BACKGROUND)
            .setSmallIcon(com.shnomano.call.R.drawable.ic_launcher)
            .setContentTitle("شنو منو يعمل في الخلفية")
            .setContentText("استقبال الرسائل والمكالمات مفعّل")
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .build()
    }

    override fun onDestroy() {
        cancelCallNotification()
        socket?.disconnect()
        socket?.close()
        socket = null
        serviceScope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val ONGOING_ID = 4001
        private const val CALL_ID = 4002

        fun start(context: Context) {
            val intent = Intent(context, BackgroundRealtimeService::class.java)
            androidx.core.content.ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, BackgroundRealtimeService::class.java))
        }
    }
}
