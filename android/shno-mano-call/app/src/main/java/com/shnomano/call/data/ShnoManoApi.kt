package com.shnomano.call.data

import com.google.gson.annotations.SerializedName
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

const val SHNO_MANO_BASE_URL = "https://shino-mino-tak-tak.duckdns.org/"

data class SignInRequest(val identifier: String, val password: String)
data class SignedInUserDto(val id: String, val fullName: String, val username: String, val role: String? = null)
data class SignInResponse(val ok: Boolean = false, val message: String? = null, val status: String? = null, val token: String? = null, val user: SignedInUserDto? = null)

data class SignUpRequest(
    val fullName: String,
    val username: String,
    val phone: String,
    val email: String = "",
    val birthDate: String? = null,
    val gender: String = "other",
    val password: String,
    val confirmPassword: String,
    val termsAccepted: Boolean = true,
    val privacyAccepted: Boolean = true
)
data class SignUpResponse(
    val ok: Boolean = false,
    val status: String? = null,
    val message: String? = null,
    val userId: String? = null
)

data class PhoneContactDto(val id: String? = null, val name: String, val phone: String)
data class PhoneContactsResponse(val contacts: List<PhoneContactDto> = emptyList())
data class SavePhoneContactsRequest(val contacts: List<PhoneContactDto>)

data class FriendDto(
    val id: String? = null,
    @SerializedName("_id") val mongoId: String? = null,
    val fullName: String? = null,
    val name: String? = null,
    val username: String? = null,
    val avatarUrl: String? = null,
    val online: Boolean = false
) {
    val userId: String get() = id ?: mongoId.orEmpty()
    val displayName: String get() = fullName ?: name ?: username ?: "صديق"
}

data class FriendsResponse(val friends: List<FriendDto> = emptyList(), val users: List<FriendDto> = emptyList(), val data: List<FriendDto> = emptyList()) {
    fun all(): List<FriendDto> = when {
        friends.isNotEmpty() -> friends
        users.isNotEmpty() -> users
        else -> data
    }
}
data class FriendRequestDto(val id: String, val user: FriendDto, val status: String = "pending")
data class FriendRequestsResponse(val ok: Boolean = false, val requests: List<FriendRequestDto> = emptyList())
data class UsersSearchResponse(val ok: Boolean = false, val users: List<FriendDto> = emptyList())

data class LookupPhoneResponse(val ok: Boolean = false, val user: FriendDto? = null)
data class OtherUserDto(val id: String, val username: String? = null, val fullName: String? = null, val avatarUrl: String? = null, val online: Boolean = false)
data class MessageDto(
    @SerializedName("_id") val mongoId: String? = null,
    val id: String? = null,
    val senderId: String? = null,
    val text: String? = null,
    val type: String? = null,
    val attachment: MediaAttachmentDto? = null,
    val createdAt: String? = null,
    val mine: Boolean = false,
    val localState: String = "sent"
) { val messageId: String get() = id ?: mongoId.orEmpty() }
data class ConversationDto(val id: String, val otherUser: OtherUserDto? = null, val lastMessage: MessageDto? = null, val updatedAt: String? = null, val unreadCount: Int = 0)
data class ConversationsResponse(val ok: Boolean = false, val conversations: List<ConversationDto> = emptyList())
data class ConversationResponse(val ok: Boolean = false, val conversation: ConversationDto? = null, val message: String? = null)
data class MessagesResponse(val ok: Boolean = false, val conversation: ConversationDto? = null, val messages: List<MessageDto> = emptyList())
data class SendMessageRequest(val text: String)
data class SendMessageResponse(val ok: Boolean = false, val message: MessageDto? = null)
data class OkResponse(val ok: Boolean = false, val message: String? = null)

interface ShnoManoApi {
    @POST("api/auth/signup") suspend fun signUp(@Body body: SignUpRequest): SignUpResponse
    @POST("api/auth/signin") suspend fun signIn(@Body body: SignInRequest): SignInResponse
    @GET("api/phone-contacts") suspend fun phoneContacts(): PhoneContactsResponse
    @PUT("api/phone-contacts") suspend fun savePhoneContacts(@Body body: SavePhoneContactsRequest): PhoneContactsResponse
    @GET("api/friends") suspend fun friends(): FriendsResponse
    @GET("api/friends/requests") suspend fun friendRequests(@Query("type") type: String = "incoming"): FriendRequestsResponse
    @POST("api/friends/request/{userId}") suspend fun sendFriendRequest(@Path("userId") userId: String): OkResponse
    @PATCH("api/friends/requests/{requestId}/{action}") suspend fun actOnFriendRequest(@Path("requestId") requestId: String, @Path("action") action: String): OkResponse
    @DELETE("api/friends/{userId}") suspend fun removeFriend(@Path("userId") userId: String): OkResponse
    @GET("api/users/search") suspend fun searchUsers(@Query("q") query: String): UsersSearchResponse
    @GET("api/users/lookup-phone") suspend fun lookupPhone(@Query("phone") phone: String): LookupPhoneResponse
    @GET("api/conversations") suspend fun conversations(): ConversationsResponse
    @POST("api/conversations/{userId}") suspend fun openConversation(@Path("userId") userId: String): ConversationResponse
    @GET("api/conversations/{id}/messages") suspend fun messages(@Path("id") id: String, @Query("limit") limit: Int = 100): MessagesResponse
    @POST("api/conversations/{id}/messages") suspend fun sendMessage(@Path("id") id: String, @Body body: SendMessageRequest): SendMessageResponse
    @PATCH("api/conversations/{id}/read") suspend fun markRead(@Path("id") id: String): OkResponse
}

object ApiFactory {
    fun create(tokenProvider: () -> String?): ShnoManoApi {
        val auth = Interceptor { chain ->
            val token = tokenProvider()
            val request = chain.request().newBuilder().apply {
                if (!token.isNullOrBlank()) header("Authorization", "Bearer $token")
                header("Accept", "application/json")
            }.build()
            chain.proceed(request)
        }
        val logging = HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC }
        val client = OkHttpClient.Builder().addInterceptor(auth).addInterceptor(logging).build()
        return Retrofit.Builder().baseUrl(SHNO_MANO_BASE_URL).client(client).addConverterFactory(GsonConverterFactory.create()).build().create(ShnoManoApi::class.java)
    }
}