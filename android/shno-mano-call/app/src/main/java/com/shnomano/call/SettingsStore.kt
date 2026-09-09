package com.shnomano.call

import android.content.Context

class SettingsStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("shno_mano_call_settings", Context.MODE_PRIVATE)

    var notificationsEnabled: Boolean
        get() = prefs.getBoolean("notifications_enabled", true)
        set(value) = prefs.edit().putBoolean("notifications_enabled", value).apply()

    var vibrationEnabled: Boolean
        get() = prefs.getBoolean("vibration_enabled", true)
        set(value) = prefs.edit().putBoolean("vibration_enabled", value).apply()

    var callSoundEnabled: Boolean
        get() = prefs.getBoolean("call_sound_enabled", true)
        set(value) = prefs.edit().putBoolean("call_sound_enabled", value).apply()

    var ringtoneUri: String?
        get() = prefs.getString("ringtone_uri", null)
        set(value) = prefs.edit().putString("ringtone_uri", value).apply()

    var speakerphoneEnabled: Boolean
        get() = prefs.getBoolean("speakerphone_enabled", true)
        set(value) = prefs.edit().putBoolean("speakerphone_enabled", value).apply()
}
