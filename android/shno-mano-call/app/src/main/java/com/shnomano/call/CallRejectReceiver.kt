package com.shnomano.call

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.shnomano.call.data.SessionStore
import com.shnomano.call.data.SHNO_MANO_BASE_URL
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

/** Receiver allows decline without launching the polling foreground service. */
class CallRejectReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val callId=intent.getStringExtra("call_id").orEmpty()
        val conversationId=intent.getStringExtra("conversation_id").orEmpty()
        val from=intent.getStringExtra("from").orEmpty()
        if (callId.isBlank() || conversationId.isBlank() || from.isBlank()) return
        CallAlertState.close(callId)
        context.getSystemService(NotificationManager::class.java).cancel(4102)
        val cookie=SessionStore(context).sessionCookie ?: return
        val pending=goAsync()
        Thread {
            try {
                val conn=URL(SHNO_MANO_BASE_URL+"api/call-signals").openConnection() as HttpURLConnection
                try {
                    conn.requestMethod="POST"
                    conn.connectTimeout=5000
                    conn.readTimeout=5000
                    conn.doOutput=true
                    conn.setRequestProperty("Content-Type","application/json")
                    conn.setRequestProperty("Cookie","__Host-shino_session=$cookie")
                    val data=JSONObject().put("event","call:reject").put("callId",callId)
                        .put("conversationId",conversationId).put("userId",from)
                    conn.outputStream.use { it.write(data.toString().toByteArray(Charsets.UTF_8)) }
                    conn.responseCode
                } finally { conn.disconnect() }
            } catch (_: Exception) { /* D1 invite will expire regardless */ }
            finally { pending.finish() }
        }.start()
    }
}
