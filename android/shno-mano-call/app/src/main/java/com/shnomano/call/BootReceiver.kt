package com.shnomano.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.shnomano.call.data.SessionStore

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED && SessionStore(context).isSignedIn()) {
            BackgroundRealtimeService.start(context)
        }
    }
}
