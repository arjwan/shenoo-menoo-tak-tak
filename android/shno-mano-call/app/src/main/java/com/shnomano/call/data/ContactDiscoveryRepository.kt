package com.shnomano.call.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class ContactDiscoveryResult(
    val query: String,
    val users: List<FriendDto> = emptyList(),
    val normalizedPhone: String? = null,
    val registeredPhoneUser: FriendDto? = null
)

class ContactDiscoveryRepository(context: Context) {
    private val app = context.applicationContext
    private val session = SessionStore(app)
    private val api = ApiFactory.create { session.token }

    suspend fun search(rawQuery: String): Result<ContactDiscoveryResult> = withContext(Dispatchers.IO) {
        runCatching {
            val query = rawQuery.trim()
            if (query.length < 2) return@runCatching ContactDiscoveryResult(query = query)

            val phone = normalizeIraqiPhone(query)
            if (phone.isNotBlank()) {
                val user = api.lookupPhone(phone).user
                ContactDiscoveryResult(
                    query = query,
                    users = listOfNotNull(user),
                    normalizedPhone = phone,
                    registeredPhoneUser = user
                )
            } else {
                ContactDiscoveryResult(
                    query = query,
                    users = api.searchUsers(query).users
                        .filter { it.userId.isNotBlank() }
                        .distinctBy { it.userId }
                )
            }
        }
    }

    suspend fun lookupPhone(rawPhone: String): Result<FriendDto?> = withContext(Dispatchers.IO) {
        runCatching {
            val phone = normalizeIraqiPhone(rawPhone)
            require(phone.isNotBlank()) { "رقم الهاتف العراقي غير صالح" }
            api.lookupPhone(phone).user
        }
    }

    fun inviteText(rawPhone: String? = null): String {
        val phonePart = rawPhone?.let(::normalizeIraqiPhone).orEmpty()
        val destination = SHNO_MANO_BASE_URL.removeSuffix("/")
        return buildString {
            append("هلا، انضم إليّ على شنو منو تك تك 🇮🇶\n")
            append("نزّل التطبيق وافتح حسابك، وبعدها ابحث عني أو أضفني عبر QR.\n")
            append("الرابط: ").append(destination)
            if (phonePart.isNotBlank()) append("\nالرقم: ").append(phonePart)
        }
    }

    companion object {
        fun normalizeIraqiPhone(value: String): String {
            var phone = value.trim().replace(Regex("[^0-9+]"), "")
            if (phone.startsWith("+964")) phone = "0" + phone.drop(4)
            else if (phone.startsWith("00964")) phone = "0" + phone.drop(5)
            else if (phone.startsWith("964")) phone = "0" + phone.drop(3)
            return if (Regex("^07\\d{9}$").matches(phone)) phone else ""
        }
    }
}
