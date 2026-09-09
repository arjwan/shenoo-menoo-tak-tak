package com.shnomano.call

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import com.shnomano.call.data.SessionStore

class ShnoManoApp : Application() {
    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
        if (SessionStore(this).isSignedIn()) {
            BackgroundRealtimeService.start(this)
        }
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

        val backgroundChannel = NotificationChannel(
            CHANNEL_BACKGROUND,
            "خدمة شنو منو في الخلفية",
            NotificationManager.IMPORTANCE_MIN
        ).apply {
            description = "تحافظ على استقبال الرسائل والمكالمات عند عمل التطبيق في الخلفية"
            setSound(null, null)
            enableVibration(false)
            lockscreenVisibility = android.app.Notification.VISIBILITY_SECRET
        }

        manager.createNotificationChannel(messageChannel)
        manager.createNotificationChannel(callChannel)
        manager.createNotificationChannel(backgroundChannel)
    }

    companion object {
        const val CHANNEL_MESSAGES = "shno_messages"
        const val CHANNEL_CALLS = "shno_calls"
        const val CHANNEL_BACKGROUND = "shno_background"
    }
}
