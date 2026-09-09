package com.shnomano.call.data

import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query
import java.io.File


data class MediaAttachmentDto(
    val url: String? = null,
    val name: String? = null,
    val mimeType: String? = null,
    val size: Long? = null
)

data class MediaMessageDto(
    val _id: String? = null,
    val id: String? = null,
    val senderId: String? = null,
    val type: String? = null,
    val text: String? = null,
    val attachment: MediaAttachmentDto? = null,
    val createdAt: String? = null,
    val mine: Boolean = false
) {
    val messageId: String get() = id ?: _id.orEmpty()
}

data class MediaMessagesResponse(
    val ok: Boolean = false,
    val messages: List<MediaMessageDto> = emptyList()
)

data class MediaSendResponse(
    val ok: Boolean = false,
    val message: MediaMessageDto? = null
)

interface MediaMessageApi {
    @GET("api/conversations/{id}/messages")
    suspend fun messages(
        @Path("id") conversationId: String,
        @Query("limit") limit: Int = 100
    ): MediaMessagesResponse

    @Multipart
    @POST("api/conversations/{id}/messages")
    suspend fun sendText(
        @Path("id") conversationId: String,
        @Part("text") text: RequestBody
    ): MediaSendResponse

    @Multipart
    @POST("api/conversations/{id}/messages")
    suspend fun sendAttachment(
        @Path("id") conversationId: String,
        @Part attachment: MultipartBody.Part,
        @Part("text") text: RequestBody
    ): MediaSendResponse
}

class MediaMessageRepository(
    private val session: SessionStore
) {
    private val api: MediaMessageApi = createMediaApi { session.token }

    suspend fun load(conversationId: String): Result<List<MediaMessageDto>> = runCatching {
        api.messages(conversationId).messages
    }

    suspend fun sendText(conversationId: String, text: String): Result<MediaMessageDto> = runCatching {
        val clean = text.trim()
        require(clean.isNotBlank()) { "الرسالة فارغة" }
        api.sendText(
            conversationId,
            clean.toRequestBody("text/plain; charset=utf-8".toMediaTypeOrNull())
        ).message ?: error("تعذر إرسال الرسالة")
    }

    suspend fun sendFile(
        conversationId: String,
        file: File,
        mimeType: String,
        displayName: String = file.name,
        caption: String = ""
    ): Result<MediaMessageDto> = runCatching {
        require(file.exists() && file.length() > 0L) { "الملف غير متاح" }
        require(file.length() <= 10L * 1024L * 1024L) { "حجم الملف أكبر من 10 ميغابايت" }
        val body = file.asRequestBody(mimeType.toMediaTypeOrNull())
        val part = MultipartBody.Part.createFormData("attachment", displayName, body)
        api.sendAttachment(
            conversationId,
            part,
            caption.toRequestBody("text/plain; charset=utf-8".toMediaTypeOrNull())
        ).message ?: error("تعذر إرسال الملف")
    }
}

private fun createMediaApi(tokenProvider: () -> String?): MediaMessageApi {
    val auth = Interceptor { chain ->
        val token = tokenProvider()
        val request = chain.request().newBuilder().apply {
            if (!token.isNullOrBlank()) header("Authorization", "Bearer $token")
            header("Accept", "application/json")
        }.build()
        chain.proceed(request)
    }
    val client = OkHttpClient.Builder().addInterceptor(auth).build()
    return Retrofit.Builder()
        .baseUrl(SHNO_MANO_BASE_URL)
        .client(client)
        .addConverterFactory(GsonConverterFactory.create())
        .build()
        .create(MediaMessageApi::class.java)
}
