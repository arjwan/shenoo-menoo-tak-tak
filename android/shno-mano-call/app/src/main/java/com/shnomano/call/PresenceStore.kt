package com.shnomano.call

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Live state shared by the foreground service and the Compose screens.
 *
 * The set is intentionally populated only by the authenticated Socket.IO
 * connection (or its presence snapshot). REST/Mongo values are not merged into
 * it because they can be stale by the time a screen is rendered.
 */
data class IncomingCall(
    val callId: String,
    val from: String,
    val conversationId: String,
    val type: String,
    val callerName: String
)

object PresenceStore {
    private val _onlineUserIds = MutableStateFlow<Set<String>>(emptySet())
    val onlineUserIds: StateFlow<Set<String>> = _onlineUserIds.asStateFlow()

    private val _incomingCall = MutableStateFlow<IncomingCall?>(null)
    val incomingCall: StateFlow<IncomingCall?> = _incomingCall.asStateFlow()

    fun markOnline(userId: String) {
        val id = userId.trim()
        if (id.isBlank()) return
        _onlineUserIds.value = _onlineUserIds.value + id
    }

    fun markOffline(userId: String) {
        val id = userId.trim()
        if (id.isBlank()) return
        _onlineUserIds.value = _onlineUserIds.value - id
    }

    fun replaceOnline(userIds: Collection<String>) {
        _onlineUserIds.value = userIds.map(String::trim).filter(String::isNotBlank).toSet()
    }

    fun isOnline(userId: String?): Boolean = !userId.isNullOrBlank() && userId in _onlineUserIds.value

    /**
     * Returns false for a replay of an invite that is already being handled.
     * This is the de-duplication point for a service socket plus a WebView
     * socket receiving the same callId.
     */
    fun acceptIncomingCall(call: IncomingCall): Boolean {
        val current = _incomingCall.value
        if (current?.callId == call.callId) return false
        _incomingCall.value = call
        return true
    }

    fun clearIncomingCall(callId: String? = null) {
        if (callId.isNullOrBlank() || _incomingCall.value?.callId == callId) {
            _incomingCall.value = null
        }
    }

    fun clearAll() {
        _onlineUserIds.value = emptySet()
        _incomingCall.value = null
    }
}
