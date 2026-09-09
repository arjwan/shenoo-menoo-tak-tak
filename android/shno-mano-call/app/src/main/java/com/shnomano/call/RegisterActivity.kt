package com.shnomano.call

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shnomano.call.data.ApiFactory
import com.shnomano.call.data.SignUpRequest
import kotlinx.coroutines.launch
import org.json.JSONObject
import retrofit2.HttpException

class RegisterActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ShnoManoTheme { RegisterScreen() } }
    }

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    private fun RegisterScreen() {
        val api = remember { ApiFactory.create { null } }
        val scope = rememberCoroutineScope()
        var fullName by remember { mutableStateOf("") }
        var username by remember { mutableStateOf("") }
        var phone by remember { mutableStateOf("") }
        var email by remember { mutableStateOf("") }
        var birthDate by remember { mutableStateOf("") }
        var gender by remember { mutableStateOf("other") }
        var password by remember { mutableStateOf("") }
        var confirm by remember { mutableStateOf("") }
        var accepted by remember { mutableStateOf(false) }
        var busy by remember { mutableStateOf(false) }
        var message by remember { mutableStateOf<String?>(null) }
        var success by remember { mutableStateOf(false) }

        Scaffold(
            containerColor = Color(0xFF070910),
            topBar = {
                TopAppBar(
                    title = { Text("إنشاء حساب شنو منو", color = Color.White, fontWeight = FontWeight.Bold) },
                    navigationIcon = { IconButton(onClick = { finish() }) { Icon(Icons.Default.ArrowBack, null, tint = Color.White) } },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF111522))
                )
            }
        ) { padding ->
            Column(
                Modifier.fillMaxSize().padding(padding).background(
                    Brush.verticalGradient(listOf(Color(0xFF0B1020), Color(0xFF070910)))
                ).verticalScroll(rememberScrollState()).padding(18.dp)
            ) {
                Text("حساب موحّد لكل شنو منو", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Black)
                Text("سيعمل نفس الحساب في التطبيق والويب ومول العراق والريلز والخدمات بعد موافقة الإدارة.", color = Color(0xFF98A2B3), fontSize = 12.sp, lineHeight = 18.sp)
                Spacer(Modifier.height(16.dp))

                Field("الاسم الكامل", fullName) { fullName = it }
                Field("اسم المستخدم بالعربي أو الإنكليزي", username) {
                    username = it.trimStart().lowercase().replace(Regex("\\s+"), "")
                }
                Field("رقم الهاتف العراقي 07xxxxxxxxx", phone) { phone = it.filter(Char::isDigit).take(11) }
                Field("البريد الإلكتروني - اختياري", email) { email = it.trim() }
                Field("تاريخ الميلاد YYYY-MM-DD - اختياري", birthDate) { birthDate = it.take(10) }

                Text("الجنس", color = Color.White, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp, bottom = 4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = gender == "male", onClick = { gender = "male" }, label = { Text("ذكر") })
                    FilterChip(selected = gender == "female", onClick = { gender = "female" }, label = { Text("أنثى") })
                    FilterChip(selected = gender == "other", onClick = { gender = "other" }, label = { Text("آخر") })
                }

                PasswordField("كلمة المرور - 8 أحرف على الأقل", password) { password = it }
                PasswordField("تأكيد كلمة المرور", confirm) { confirm = it }

                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Checkbox(checked = accepted, onCheckedChange = { accepted = it })
                    Text("أوافق على شروط الاستخدام وسياسة الخصوصية", color = Color.White, fontSize = 12.sp)
                }

                message?.let {
                    Text(it, color = if (success) Color(0xFF27D8C4) else MaterialTheme.colorScheme.error, fontSize = 12.sp, modifier = Modifier.padding(vertical = 8.dp))
                }

                Button(
                    enabled = !busy && !success,
                    onClick = {
                        message = null
                        val validArabicName = fullName.trim().matches(Regex("^[\\p{L}\\p{M}][\\p{L}\\p{M} .'-]{1,99}$"))
                        val validUsername = username.matches(Regex("^[\\p{L}\\p{M}0-9_.]{3,30}$"))
                        when {
                            fullName.isBlank() || username.isBlank() || phone.isBlank() || password.isBlank() -> message = "أكمل الحقول الإلزامية"
                            !validArabicName -> message = "اكتب الاسم الكامل بالعربية أو الإنكليزية دون رموز غير صالحة"
                            !validUsername -> message = "اسم المستخدم يقبل العربية أو الإنكليزية والأرقام و _ . فقط، من 3 إلى 30 حرفاً"
                            !phone.matches(Regex("^07\\d{9}$")) -> message = "رقم الهاتف يجب أن يبدأ بـ 07 ويتكون من 11 رقماً"
                            password.length < 8 -> message = "كلمة المرور يجب أن تكون 8 أحرف على الأقل"
                            password != confirm -> message = "كلمتا المرور غير متطابقتين"
                            !accepted -> message = "يجب الموافقة على الشروط والخصوصية"
                            else -> {
                                busy = true
                                scope.launch {
                                    try {
                                        val response = api.signUp(SignUpRequest(
                                            fullName = fullName.trim(), username = username.trim(), phone = phone,
                                            email = email.trim(), birthDate = birthDate.ifBlank { null }, gender = gender,
                                            password = password, confirmPassword = confirm
                                        ))
                                        success = response.ok
                                        message = response.message ?: if (response.ok) "تم إنشاء الطلب وهو بانتظار الموافقة" else "تعذر إنشاء الحساب"
                                    } catch (e: HttpException) {
                                        val serverMessage = runCatching {
                                            JSONObject(e.response()?.errorBody()?.string().orEmpty()).optString("message")
                                        }.getOrNull().orEmpty()
                                        message = serverMessage.ifBlank { "تعذر إنشاء الحساب: ${e.code()}" }
                                    } catch (e: Exception) {
                                        message = e.message ?: "تعذر الاتصال بالخادم"
                                    } finally { busy = false }
                                }
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF7C5CFF))
                ) {
                    if (busy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                    else Text("إنشاء الحساب")
                }

                if (success) {
                    Spacer(Modifier.height(10.dp))
                    OutlinedButton(
                        onClick = { startActivity(Intent(this@RegisterActivity, MainActivity::class.java)); finish() },
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("العودة لتسجيل الدخول") }
                }
                Spacer(Modifier.height(20.dp))
                Text("لن يتم تسجيل دخول الحساب تلقائياً قبل موافقة الإدارة.", color = Color(0xFF98A2B3), fontSize = 11.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
            }
        }
    }

    @Composable
    private fun Field(label: String, value: String, onChange: (String) -> Unit) {
        OutlinedTextField(value, onChange, label = { Text(label) }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp))
    }

    @Composable
    private fun PasswordField(label: String, value: String, onChange: (String) -> Unit) {
        OutlinedTextField(value, onChange, label = { Text(label) }, singleLine = true, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp))
    }
}
