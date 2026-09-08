package com.shnomano.call.data

import com.google.gson.annotations.SerializedName
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PUT

private const val BASE_URL = "https://shino-mino-tak-tak.duckdns.org/"

data class PhoneContactDto(
    val id: String? = null,
    val name: String,
    val phone: String
)

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
)

data class FriendsResponse(
    val friends: List<FriendDto> = emptyList(),
    val users: List<FriendDto> = emptyList(),
    val data: List<FriendDto> = emptyList()
)

interface ShnoManoApi {
    @GET("api/phone-contacts")
    suspend fun phoneContacts(): PhoneContactsResponse

    @PUT("api/phone-contacts")
    suspend fun savePhoneContacts(@Body body: SavePhoneContactsRequest): PhoneContactsResponse

    @GET("api/friends")
    suspend fun friends(): FriendsResponse
}

object ApiFactory {
    fun create(tokenProvider: () -> String?): ShnoManoApi {
        val auth = Interceptor { chain ->
            val token = tokenProvider()
            val request = chain.request().newBuilder().apply {
                if (!token.isNullOrBlank()) header("Authorization", "Bearer $token")
            }.build()
            chain.proceed(request)
        }
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }
        val client = OkHttpClient.Builder()
            .addInterceptor(auth)
            .addInterceptor(logging)
            .build()
        return Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ShnoManoApi::class.java)
    }
}
