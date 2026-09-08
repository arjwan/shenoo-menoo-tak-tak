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
                Brush.verticalGradient(listOf(Color(0xFF0B1020), Color(0xFF070910), Color(0xFF090C14)))
            ).padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF111522)),
                shape = RoundedCornerShape(30.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        Modifier.size(78.dp).background(
                            Brush.linearGradient(listOf(Color(0xFF7C5CFF), Color(0xFF27D8C4))), CircleShape
                        ), contentAlignment = Alignment.Center
                    ) { Text("ش", color = Color.White, fontSize = 36.sp, fontWeight = FontWeight.Black) }
                    Spacer(Modifier.height(18.dp))
                    Text("شنو منو", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black)
                    Text(
                        "حساب واحد لكل شنو منو: اتصال، رسائل، مول العراق، الريلز والخدمات",
                        color = Color(0xFF98A2B3), fontSize = 13.sp, textAlign = TextAlign.Center, lineHeight = 20.sp
                    )
                    Spacer(Modifier.height(26.dp))
                    Button(
                        onClick = { startActivity(Intent(this@WelcomeActivity, MainActivity::class.java)) },
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF7C5CFF))
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
