package com.shnomano.call

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build

class ShnoManoApp : Application() {
    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        val settings = SettingsStore(this)

        val messageChannel = NotificationChannel(
            CHANNEL_MESSAGES,
            "رسائل شنو منو",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "تنبيهات الرسائل الجديدة"
            enableVibration(settings.vibrationEnabled)
        }

        val ringtone = settings.ringtoneUri?.let(android.net.Uri::parse)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        val audio = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .build()
        val callChannel = NotificationChannel(
            CHANNEL_CALLS,
            "مكالمات شنو منو",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "تنبيهات المكالمات الواردة"
            enableVibration(settings.vibrationEnabled)
            if (settings.callSoundEnabled) setSound(ringtone, audio) else setSound(null, null)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }

        manager.createNotificationChannel(messageChannel)
        manager.createNotificationChannel(callChannel)
    }

    companion object {
        const val CHANNEL_MESSAGES = "shno_messages"
        const val CHANNEL_CALLS = "shno_calls"
    }
}
