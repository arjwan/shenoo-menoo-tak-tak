package com.shnomano.call.data

import android.content.Context
import com.shnomano.call.BackgroundRealtimeService

class SessionStore(context: Context) {
    private val app = context.applicationContext
    private val prefs = app.getSharedPreferences("shno_mano_call_session", Context.MODE_PRIVATE)

    val token: String?
        get() = prefs.getString(KEY_TOKEN, null)

    val userId: String?
        get() = prefs.getString(KEY_USER_ID, null)

    val fullName: String?
        get() = prefs.getString(KEY_FULL_NAME, null)

    val username: String?
        get() = prefs.getString(KEY_USERNAME, null)

    fun isSignedIn(): Boolean = !token.isNullOrBlank() && !userId.isNullOrBlank()

    fun save(response: SignInResponse) {
        val user = requireNotNull(response.user)
        val authToken = requireNotNull(response.token)
        prefs.edit()
            .putString(KEY_TOKEN, authToken)
            .putString(KEY_USER_ID, user.id)
            .putString(KEY_FULL_NAME, user.fullName)
            .putString(KEY_USERNAME, user.username)
            .apply()
        BackgroundRealtimeService.start(app)
    }

    fun clear() {
        BackgroundRealtimeService.stop(app)
        prefs.edit().clear().apply()
    }

    companion object {
        private const val KEY_TOKEN = "token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_FULL_NAME = "full_name"
        private const val KEY_USERNAME = "username"
    }
}
