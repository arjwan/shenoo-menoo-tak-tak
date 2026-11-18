package com.shnomano.call

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.shnomano.call.data.SessionStore
import com.shnomano.call.data.SHNO_MANO_BASE_URL
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.Executors
import org.json.JSONObject

object CallPushRegistration {
    private val executor = Executors.newSingleThreadExecutor()
    fun initialize(context: Context): Boolean {
        return try {
            if (FirebaseApp.getApps(context).isEmpty()) {
                val options = FirebaseOptions.fromResource(context) ?: return false
                FirebaseApp.initializeApp(context, options)
            }
            true
        } catch (_: Exception) { false }
    }
    fun refresh(context: Context) {
        if (!SessionStore(context).isSignedIn() || !initialize(context)) return
        FirebaseMessaging.getInstance().token.addOnSuccessListener { register(context, it) }
    }
    fun register(context: Context, token: String) {
        val app = context.applicationContext
        val session = SessionStore(app)
        val cookie = session.sessionCookie ?: return
        val userId = session.userId ?: return
        val id = installationId(app)
        executor.execute {
            if (SessionStore(app).userId != userId || SessionStore(app).sessionCookie != cookie) return@execute
            runCatching { send(cookie, "POST", JSONObject().put("installationId", id).put("token", token)) }
                .onFailure { android.util.Log.w("CallPush", "Device registration unavailable") }
        }
    }
    fun unregister(context: Context) {
        val cookie = SessionStore(context).sessionCookie ?: return
        val id = installationId(context)
        executor.execute { runCatching { send(cookie, "DELETE", JSONObject().put("installationId", id)) } }
        if (initialize(context)) FirebaseMessaging.getInstance().deleteToken()
    }
    @Synchronized private fun installationId(context: Context): String {
        val prefs = context.getSharedPreferences("call_push_installation", Context.MODE_PRIVATE)
        return prefs.getString("id", null) ?: UUID.randomUUID().toString().also { prefs.edit().putString("id", it).commit() }
    }
    private fun send(cookie: String, method: String, body: JSONObject) {
        val connection = URL(SHNO_MANO_BASE_URL + "api/call-push/devices").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 7000
            connection.readTimeout = 7000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Cookie", "__Host-shino_session=$cookie")
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            check(connection.responseCode in 200..299)
        } finally { connection.disconnect() }
    }
}
