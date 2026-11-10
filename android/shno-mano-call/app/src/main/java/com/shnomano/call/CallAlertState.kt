package com.shnomano.call

/** Local terminal decisions win over delayed notifications and page loading. */
object CallAlertState {
    private val terminal = linkedMapOf<String, Long>()
    @Synchronized fun close(id: String) {
        if (id.isBlank()) return
        terminal[id] = System.currentTimeMillis()
        while (terminal.size > 128) terminal.remove(terminal.keys.first())
    }
    @Synchronized fun isClosed(id: String): Boolean {
        val time = terminal[id] ?: return false
        if (System.currentTimeMillis() - time > 600_000) { terminal.remove(id); return false }
        return true
    }
}
