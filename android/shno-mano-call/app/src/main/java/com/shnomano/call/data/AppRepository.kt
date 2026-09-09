package com.shnomano.call.data

import android.content.Context
import android.provider.ContactsContract
import java.io.IOException
import org.json.JSONObject
import retrofit2.HttpException
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext

class AppRepository(context: Context) {
    private val app = context.applicationContext
    val session = SessionStore(app)
    private val api = ApiFactory.create { session.token }
    private val dao = ShnoManoDatabase.get(app).localDao()

    fun observeContacts(): Flow<List<ContactEntity>> = dao.observeContacts()
    fun observeMessages(conversationId: String): Flow<List<MessageEntity>> = dao.observeMessages(conversationId)

    suspend fun signIn(identifier: String, password: String): Result<SignedInUserDto> =
        AuthRepository(session, api).signIn(identifier, password)

    fun signOut() = session.clear()

    suspend fun importPickedPhone(uri: android.net.Uri): Result<ContactEntity> = runCatching {
        withContext(Dispatchers.IO) {
            val projection = arrayOf(
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                ContactsContract.CommonDataKinds.Phone.NUMBER
            )
            val cursor = app.contentResolver.query(uri, projection, null, null, null)
                ?: error("تعذر قراءة جهة الاتصال")
            cursor.use {
                if (!it.moveToFirst()) error("جهة الاتصال غير متاحة")
                val name = it.getString(0)?.trim().orEmpty().ifBlank { "جهة اتصال" }
                val raw = it.getString(1).orEmpty()
                val phone = normalizeIraqiPhone(raw)
                if (phone.isBlank()) error("رقم الهاتف ليس رقماً عراقياً صالحاً")
                val lookup = runCatching { api.lookupPhone(phone).user }.getOrNull()
                val contact = ContactEntity(
                    phone = phone,
                    name = name,
                    linkedUserId = lookup?.userId?.takeIf { id -> id.isNotBlank() },
                    username = lookup?.username,
                    avatarUrl = lookup?.avatarUrl,
                    isFriend = false
                )
                dao.saveContacts(listOf(contact))
                if (session.isSignedIn()) {
                    runCatching { api.savePhoneContacts(SavePhoneContactsRequest(listOf(PhoneContactDto(name = name, phone = phone)))) }
                }
                contact
            }
        }
    }

    suspend fun syncContacts(): List<ContactEntity> = withContext(Dispatchers.IO) {
        if (!session.isSignedIn()) return@withContext emptyList()
        val friends = runCatching { api.friends().all() }.getOrDefault(emptyList())
        val friendIds = friends.map { it.userId }.filter { it.isNotBlank() }.toSet()
        val remote = runCatching { api.phoneContacts().contacts }.getOrDefault(emptyList())
        val contacts = remote.map { item ->
            val linked = runCatching { api.lookupPhone(item.phone).user }.getOrNull()
            ContactEntity(
                phone = item.phone,
                name = item.name,
                linkedUserId = linked?.userId?.takeIf { it.isNotBlank() },
                username = linked?.username,
                avatarUrl = linked?.avatarUrl,
                isFriend = linked?.userId in friendIds
            )
        }
        if (contacts.isNotEmpty()) dao.saveContacts(contacts)
        contacts
    }

    suspend fun loadFriends(): List<FriendDto> = runCatching { api.friends().all() }.getOrDefault(emptyList())
    suspend fun loadFriendRequests(): List<FriendRequestDto> = runCatching { api.friendRequests().requests }.getOrDefault(emptyList())
    suspend fun loadSentFriendRequests(): List<FriendRequestDto> = runCatching { api.friendRequests("sent").requests }.getOrDefault(emptyList())
    suspend fun sendFriendRequest(userId: String): Result<String> = runCatching {
        api.sendFriendRequest(userId)
        "تم إرسال طلب الصداقة"
    }.recoverCatching { error ->
        if (error is HttpException) {
            val message = runCatching {
                JSONObject(error.response()?.errorBody()?.string().orEmpty()).optString("message")
            }.getOrNull().orEmpty()
            throw IllegalStateException(message.ifBlank {
                if (error.code() == 409) "يوجد طلب صداقة قائم" else if (error.code() == 403) "لا يمكن إرسال الطلب لهذا المستخدم" else "تعذر إرسال الطلب"
            })
        }
        throw error
    }
    suspend fun respondToFriendRequest(requestId: String, accept: Boolean): Result<String> = runCatching {
        api.actOnFriendRequest(requestId, if (accept) "accept" else "reject")
        if (accept) "تم قبول طلب الصداقة" else "تم رفض الطلب"
    }
    suspend fun loadConversations(): List<ConversationDto> = runCatching { api.conversations().conversations }.getOrDefault(emptyList())

    suspend fun openConversation(userId: String): Result<ConversationDto> = runCatching {
        api.openConversation(userId).conversation ?: error("تعذر فتح المحادثة")
    }

    suspend fun loadMessages(conversationId: String): Result<List<MessageDto>> = withContext(Dispatchers.IO) {
        retryPendingMessages(conversationId)
        try {
            val response = api.messages(conversationId)
            runCatching { api.markRead(conversationId) }
            val otherId = response.conversation?.otherUser?.id.orEmpty()
            val selfId = session.userId.orEmpty()
            val entities = response.messages.mapNotNull { message ->
                val id = message.messageId.takeIf { it.isNotBlank() } ?: return@mapNotNull null
                val sender = message.senderId.orEmpty()
                MessageEntity(
                    id = id,
                    conversationId = conversationId,
                    senderId = sender,
                    recipientId = if (sender == selfId) otherId else selfId,
                    body = message.text.orEmpty(),
                    createdAt = System.currentTimeMillis(),
                    state = "sent"
                )
            }
            if (entities.isNotEmpty()) dao.saveMessages(entities)
            Result.success(response.messages.map { it.copy(mine = it.senderId == selfId) })
        } catch (error: Throwable) {
            val cached = dao.messagesOnce(conversationId).map { it.toDto() }
            if (cached.isNotEmpty()) Result.success(cached) else Result.failure(error)
        }
    }

    suspend fun sendMessage(conversationId: String, text: String): Result<MessageDto> = withContext(Dispatchers.IO) {
        val clean = text.trim()
        if (clean.isBlank()) return@withContext Result.failure(IllegalArgumentException("الرسالة فارغة"))
        try {
            val remote = api.sendMessage(conversationId, SendMessageRequest(clean)).message
                ?: return@withContext Result.failure(IllegalStateException("تعذر إرسال الرسالة"))
            val dto = remote.copy(mine = true)
            val remoteId = dto.messageId.takeIf { it.isNotBlank() }
            if (remoteId != null) {
                dao.saveMessages(listOf(MessageEntity(
                    id = remoteId,
                    conversationId = conversationId,
                    senderId = session.userId.orEmpty(),
                    recipientId = "",
                    body = clean,
                    createdAt = System.currentTimeMillis(),
                    state = "sent"
                )))
            }
            Result.success(dto)
        } catch (error: IOException) {
            val pending = MessageEntity(
                id = "local-${UUID.randomUUID()}",
                conversationId = conversationId,
                senderId = session.userId.orEmpty(),
                recipientId = "",
                body = clean,
                createdAt = System.currentTimeMillis(),
                state = "pending"
            )
            dao.saveMessages(listOf(pending))
            Result.success(pending.toDto())
        } catch (error: Throwable) {
            Result.failure(error)
        }
    }

    private suspend fun retryPendingMessages(conversationId: String) {
        val pending = dao.pendingMessages().filter { it.conversationId == conversationId }
        for (item in pending) {
            try {
                val remote = api.sendMessage(item.conversationId, SendMessageRequest(item.body)).message ?: continue
                dao.deleteMessage(item.id)
                val remoteId = remote.messageId.takeIf { it.isNotBlank() } ?: continue
                dao.saveMessages(listOf(item.copy(id = remoteId, state = "sent")))
            } catch (_: Throwable) {
                return
            }
        }
    }

    private fun MessageEntity.toDto(): MessageDto = MessageDto(
        id = id,
        senderId = senderId,
        text = body,
        createdAt = createdAt.toString(),
        mine = senderId == session.userId,
        localState = state
    )

    companion object {
        fun normalizeIraqiPhone(value: String): String {
            var phone = value.replace(Regex("[^0-9+]"), "")
            if (phone.startsWith("+964")) phone = "0" + phone.drop(4)
            else if (phone.startsWith("00964")) phone = "0" + phone.drop(5)
            else if (phone.startsWith("964")) phone = "0" + phone.drop(3)
            return if (Regex("^07\\d{9}$").matches(phone)) phone else ""
        }
    }
}