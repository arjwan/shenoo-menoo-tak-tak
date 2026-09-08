package com.shnomano.call.data

import android.content.Context

class SessionStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("shno_mano_call_session", Context.MODE_PRIVATE)

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
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val KEY_TOKEN = "token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_FULL_NAME = "full_name"
        private const val KEY_USERNAME = "username"
    }
}
