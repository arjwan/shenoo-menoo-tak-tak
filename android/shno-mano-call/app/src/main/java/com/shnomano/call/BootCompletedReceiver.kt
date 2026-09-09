package com.shnomano.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
        if (com.shnomano.call.data.SessionStore(context).isSignedIn()) {
            BackgroundRealtimeService.start(context)
        }
    }
}
