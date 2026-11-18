package com.shnomano.call

import android.content.Context
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import com.shnomano.call.data.SHNO_MANO_BASE_URL
import com.shnomano.call.data.SessionStore
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import org.json.JSONObject

/** Bind the device token to this app's own authenticated session, never to the web app. */
object CallPushRegistration {
    private val worker = Executors.newSingleThreadExecutor()
    fun refresh(context: Context) {
        val app = context.applicationContext
        if (!SessionStore(app).isSignedIn()) return
        try {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                if (token.isNotBlank()) worker.execute { send(app, token, "POST") }
            }.addOnFailureListener { Log.w("CallFCM", "Token unavailable", it) }
        } catch (error: Exception) {
            Log.w("CallFCM", "Firebase not configured yet", error)
        }
    }
    fun updated(context: Context, token: String) {
        val app = context.applicationContext
        if (SessionStore(app).isSignedIn()) worker.execute { send(app, token, "POST") }
    }
    fun unregister(context: Context) {
        val app = context.applicationContext
        val cookie = SessionStore(app).sessionCookie ?: return
        try {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                worker.execute { send(app, token, "DELETE", cookie) }
            }
        } catch (_: Exception) { /* logout must never be blocked */ }
    }
    private fun send(context: Context, token: String, method: String, retainedCookie: String? = null) {
        val session = SessionStore(context)
        val cookie = retainedCookie ?: session.sessionCookie ?: return
        if (method == "POST" && !session.isSignedIn()) return
        val conn = URL(SHNO_MANO_BASE_URL + "api/call-push-token").openConnection() as HttpURLConnection
        try {
            conn.requestMethod = method
            conn.connectTimeout = 7000
            conn.readTimeout = 7000
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Cookie", "__Host-shino_session=$cookie")
            conn.outputStream.use { it.write(JSONObject().put("token", token).toString().toByteArray(Charsets.UTF_8)) }
            if (conn.responseCode !in 200..299) Log.w("CallFCM", "Token update HTTP ${conn.responseCode}")
        } catch (error: Exception) {
            Log.w("CallFCM", "Unable to update device registration", error)
        } finally { conn.disconnect() }
    }
}
