package com.shnomano.call.data

import org.json.JSONObject
import retrofit2.HttpException

/** Keeps the server's reason and request identity; never logs cookies or message bodies. */
class ApiFailure(
    val status: Int,
    val endpoint: String,
    val requestId: String?,
    message: String
) : IllegalStateException(message) {
    companion object {
        fun from(error: HttpException): ApiFailure {
            val response = error.response()
            val body = runCatching { JSONObject(response?.errorBody()?.string().orEmpty()) }.getOrNull()
            val reason = body?.optString("message")?.takeIf { it.isNotBlank() }
                ?: "تعذر تنفيذ الطلب"
            val path = response?.raw()?.request?.url?.encodedPath.orEmpty()
            val requestId = response?.headers()?.get("X-Request-ID") ?: response?.headers()?.get("CF-Ray")
            return ApiFailure(error.code(), path, requestId, "$reason (HTTP ${error.code()})")
        }
    }
}
