package com.shnomano.call

import android.content.Context

/** Private local diagnostic metadata; no exception messages, cookies or request bodies. */
object AppDiagnostics {
    fun record(context: Context, error: Throwable, origin: String) {
        runCatching {
            val frames = generateSequence(error) { it.cause }.take(4).joinToString("\n") { cause ->
                cause.javaClass.name + "\n" + cause.stackTrace.take(35).joinToString("\n") { "  at $it" }
            }
            context.getSharedPreferences("call_diagnostics", Context.MODE_PRIVATE).edit()
                .putString(if (origin == "uncaught") "last_crash" else "last_failure", "$origin · Android ${android.os.Build.VERSION.SDK_INT}\n$frames").apply()
        }
    }
    fun last(context: Context): String {
        val recorded = context.getSharedPreferences("call_diagnostics", Context.MODE_PRIVATE)
        .let { it.getString("last_crash", null) ?: it.getString("last_failure", "لم يُسجَّل إغلاق غير متوقع في هذه النسخة").orEmpty() }
        val exit = if (android.os.Build.VERSION.SDK_INT >= 30) runCatching {
            context.getSystemService(android.app.ActivityManager::class.java)
                .getHistoricalProcessExitReasons(context.packageName, 0, 1).firstOrNull()?.let { "آخر إنهاء سجله النظام: ${it.reason}" }
        }.getOrNull() else null
        return listOfNotNull(recorded, exit).joinToString("\n")
    }
}
