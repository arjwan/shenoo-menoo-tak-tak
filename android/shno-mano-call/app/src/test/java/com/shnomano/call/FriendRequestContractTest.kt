package com.shnomano.call

import com.google.gson.Gson
import com.shnomano.call.data.FriendRequestsResponse
import org.junit.Assert.*
import org.junit.Test

class FriendRequestContractTest {
    @Test fun incomingAndSentCloudflareRequestsAreSafeToRender() {
        for (field in listOf("sender", "receiver", "user")) {
            val response = Gson().fromJson("""{"ok":true,"requests":[{"id":"request-1","$field":{"id":"friend-1","fullName":"صديق"}}]}""", FriendRequestsResponse::class.java)
            assertEquals("friend-1", response.requests.single().contact.userId)
            assertEquals("صديق", response.requests.single().contact.displayName)
        }
    }
    @Test fun missingOptionalUserNeverCrashesTheContactsPage() {
        val response = Gson().fromJson("""{"ok":true,"requests":[{"id":"request-2"}]}""", FriendRequestsResponse::class.java)
        assertEquals("", response.requests.single().contact.userId)
    }
    @Test fun declinedNotificationCannotReopenAsPending() {
        val id = java.util.UUID.randomUUID().toString()
        assertFalse(CallAlertState.isClosed(id))
        CallAlertState.close(id)
        assertTrue(CallAlertState.isClosed(id))
    }
}
