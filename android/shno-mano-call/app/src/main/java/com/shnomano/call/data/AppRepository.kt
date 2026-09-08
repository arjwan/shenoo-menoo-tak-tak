package com.shnomano.call.data

import android.content.Context
import android.provider.ContactsContract
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext

class AppRepository(context: Context) {
    private val app = context.applicationContext
    val session = SessionStore(app)
    private val api = ApiFactory.create { session.token }
    private val dao = ShnoManoDatabase.get(app).localDao()

    fun observeContacts(): Flow<List<ContactEntity>> = dao.observeContacts()

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
    suspend fun loadConversations(): List<ConversationDto> = runCatching { api.conversations().conversations }.getOrDefault(emptyList())

    suspend fun openConversation(userId: String): Result<ConversationDto> = runCatching {
        api.openConversation(userId).conversation ?: error("تعذر فتح المحادثة")
    }

    suspend fun loadMessages(conversationId: String): Result<List<MessageDto>> = runCatching {
        val response = api.messages(conversationId)
        runCatching { api.markRead(conversationId) }
        response.messages
    }

    suspend fun sendMessage(conversationId: String, text: String): Result<MessageDto> = runCatching {
        val clean = text.trim()
        if (clean.isBlank()) error("الرسالة فارغة")
        api.sendMessage(conversationId, SendMessageRequest(clean)).message ?: error("تعذر إرسال الرسالة")
    }

    companion object {
        fun normalizeIraqiPhone(value: String): String {
            var phone = value.replace(Regex("[^0-9+]"), "")
            if (phone.startsWith("+964")) phone = "0" + phone.drop(4)
            if (phone.startsWith("00964")) phone = "0" + phone.drop(5)
            return if (Regex("^07\\d{9}$").matches(phone)) phone else ""
        }
    }
}
