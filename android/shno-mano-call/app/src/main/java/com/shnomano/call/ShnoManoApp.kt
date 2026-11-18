package com.shnomano.call

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import org.json.JSONObject

class ShnoManoApp : Application() {
    override fun onCreate() {
        super.onCreate()
        instance = this
        try {
            val config = assets.open("google-services.json").bufferedReader().use { JSONObject(it.readText()) }
            val project = config.getJSONObject("project_info")
            val clients = config.getJSONArray("client")
            val client = (0 until clients.length()).map { clients.getJSONObject(it) }
                .first { it.getJSONObject("client_info").getJSONObject("android_client_info").getString("package_name") == "com.shnomano.call" }
            val options = FirebaseOptions.Builder()
                .setApplicationId(client.getJSONObject("client_info").getString("mobilesdk_app_id"))
                .setApiKey(client.getJSONArray("api_key").getJSONObject(0).getString("current_key"))
                .setGcmSenderId(project.getString("project_number"))
                .setProjectId(project.getString("project_id"))
                .build()
            if (FirebaseApp.getApps(this).isEmpty()) FirebaseApp.initializeApp(this, options)
        } catch (error: Exception) {
            android.util.Log.e("CallFCM", "Firebase client setup unavailable", error)
        }
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            AppDiagnostics.record(this, error, "uncaught")
            previous?.uncaughtException(thread, error)
        }
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        val settings = SettingsStore(this)

        val realtimeChannel = NotificationChannel(
            CHANNEL_REALTIME,
            "اتصال شنو منو اللحظي",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "تشغيل الحضور والمكالمات في الخلفية"
            setShowBadge(false)
        }

        val messageChannel = NotificationChannel(
            CHANNEL_MESSAGES,
            "رسائل شنو منو",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "تنبيهات الرسائل الجديدة"
            enableVibration(settings.vibrationEnabled)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build()
            )
        }

        // Always use the current Android device ringtone, never an app-owned sound.
        val ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
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
            setSound(ringtone, audio)
            enableLights(true)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }

        val missedChannel = NotificationChannel(
            CHANNEL_MISSED,
            "مكالمات شنو منو الفائتة",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "إشعار المكالمة الفائتة والعدد على أيقونة التطبيق"
            setShowBadge(true)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }

        manager.createNotificationChannel(realtimeChannel)
        manager.createNotificationChannel(messageChannel)
        manager.createNotificationChannel(callChannel)
        manager.createNotificationChannel(missedChannel)
    }

    companion object {
        lateinit var instance: ShnoManoApp
            private set
        const val CHANNEL_REALTIME = "shno_realtime"
        const val CHANNEL_MESSAGES = "shno_messages_20261110"
        const val CHANNEL_CALLS = "shno_calls_device_ringtone_20261118_v3"
        const val CHANNEL_MISSED = "shno_missed_calls_20261118"
    }
}
