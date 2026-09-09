package com.shnomano.call

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Process-wide realtime presence cache fed by BackgroundRealtimeService.
 * REST responses provide the initial state; Socket.IO events keep it current.
 */
object PresenceStore {
    private val _online = MutableStateFlow<Map<String, Boolean>>(emptyMap())
    val online: StateFlow<Map<String, Boolean>> = _online.asStateFlow()

    fun setOnline(userId: String, isOnline: Boolean) {
        if (userId.isBlank()) return
        _online.value = _online.value.toMutableMap().apply { put(userId, isOnline) }
    }

    fun seed(states: Map<String, Boolean>) {
        if (states.isEmpty()) return
        _online.value = _online.value.toMutableMap().apply { putAll(states) }
    }

    fun clear() {
        _online.value = emptyMap()
    }
}
