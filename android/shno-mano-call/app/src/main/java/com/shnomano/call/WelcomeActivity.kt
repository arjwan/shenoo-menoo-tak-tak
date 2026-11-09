package com.shnomano.call

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Login
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

class WelcomeActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ShnoManoTheme { WelcomeScreen() } }
    }

    @Composable
    private fun WelcomeScreen() {
        Box(
            Modifier.fillMaxSize().background(
                Brush.verticalGradient(listOf(Color(0xFF273A85), Color(0xFF101D43), Color(0xFF090E26)))
            ).padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF172B57)),
                shape = RoundedCornerShape(30.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        Modifier.size(78.dp).background(
                            Brush.linearGradient(listOf(Color(0xFF7C5CFF), Color(0xFF2C9AE9))), CircleShape
                        ), contentAlignment = Alignment.Center
                    ) { Text("☎", color = Color.White, fontSize = 36.sp, fontWeight = FontWeight.Black) }
                    Spacer(Modifier.height(18.dp))
                    Text("اتصال", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Black)
                    Text(
                        "مكالماتك ومحادثاتك وجهات اتصالك في مساحة خاصة، متصلة بحساب شنو منو",
                        color = Color(0xFFB7CEEF), fontSize = 13.sp, textAlign = TextAlign.Center, lineHeight = 20.sp
                    )
                    Spacer(Modifier.height(16.dp))
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF223E75)),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("💬 رسائل     •     📞 مكالمات     •     👥 أصدقاء",
                            modifier = Modifier.fillMaxWidth().padding(13.dp),
                            color = Color(0xFFE9F6FF), textAlign = TextAlign.Center, fontSize = 12.sp)
                    }
                    Spacer(Modifier.height(24.dp))
                    Button(
                        onClick = { startActivity(Intent(this@WelcomeActivity, MainActivity::class.java)) },
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3D80F4))
                    ) { Icon(Icons.Default.Login, null); Spacer(Modifier.width(8.dp)); Text("تسجيل الدخول") }
                    Spacer(Modifier.height(12.dp))
                    OutlinedButton(
                        onClick = { startActivity(Intent(this@WelcomeActivity, RegisterActivity::class.java)) },
                        modifier = Modifier.fillMaxWidth().height(52.dp)
                    ) { Icon(Icons.Default.PersonAdd, null); Spacer(Modifier.width(8.dp)); Text("إنشاء حساب جديد") }
                    Spacer(Modifier.height(16.dp))
                    Text("بعد إنشاء الحساب يصبح بانتظار موافقة الإدارة، ثم يعمل في الويب والتطبيق بنفس البيانات.", color = Color(0xFF98A2B3), fontSize = 11.sp, textAlign = TextAlign.Center)
                }
            }
        }
    }
}
