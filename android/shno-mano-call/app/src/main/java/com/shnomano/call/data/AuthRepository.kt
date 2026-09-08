package com.shnomano.call.data

import retrofit2.HttpException

class AuthRepository(
    private val sessionStore: SessionStore,
    private val api: ShnoManoApi = ApiFactory.create { sessionStore.token }
) {
    suspend fun signIn(identifier: String, password: String): Result<SignedInUserDto> = runCatching {
        val response = api.signIn(SignInRequest(identifier.trim(), password))
        if (!response.ok || response.token.isNullOrBlank() || response.user == null) {
            error(response.message ?: "تعذر تسجيل الدخول")
        }
        sessionStore.save(response)
        response.user
    }.recoverCatching { throwable ->
        if (throwable is HttpException) {
            val message = when (throwable.code()) {
                401 -> "بيانات تسجيل الدخول غير صحيحة"
                403 -> "الحساب غير مفعل أو بانتظار الموافقة"
                429 -> "محاولات كثيرة، حاول بعد قليل"
                else -> "تعذر الاتصال بالخادم (${throwable.code()})"
            }
            error(message)
        }
        throw throwable
    }

    fun isSignedIn(): Boolean = sessionStore.isSignedIn()
    fun currentName(): String = sessionStore.fullName ?: sessionStore.username ?: "مستخدم شنو منو"
    fun currentUsername(): String = sessionStore.username.orEmpty()
    fun signOut() = sessionStore.clear()
}
