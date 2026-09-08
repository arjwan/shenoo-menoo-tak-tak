package com.shnomano.call

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shnomano.call.data.SessionStore

private val HomeNight = Color(0xFF070910)
private val HomePanel = Color(0xFF111522)
private val HomeViolet = Color(0xFF7C5CFF)
private val HomeAqua = Color(0xFF27D8C4)
private val HomeMuted = Color(0xFF98A2B3)

class HomeActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val session = SessionStore(this)
        if (!session.isSignedIn()) {
            startActivity(Intent(this, WelcomeActivity::class.java))
            finish()
            return
        }
        setContent { ShnoManoTheme { ShnoHome() } }
    }

    @Composable
    private fun ShnoHome() {
        Scaffold(
            containerColor = HomeNight,
            bottomBar = {
                NavigationBar(containerColor = Color(0xFF0B0E17)) {
                    NavigationBarItem(false, { openConnection() }, { Icon(Icons.Default.ChatBubble, null) }, label = { Text("الدردشات", fontSize = 10.sp) })
                    NavigationBarItem(false, { openConnection() }, { Icon(Icons.Default.People, null) }, label = { Text("الأصدقاء", fontSize = 10.sp) })
                    NavigationBarItem(false, { openSection("mall.html") }, { Text("🛍️", fontSize = 20.sp) }, label = { Text("مول العراق", fontSize = 10.sp) })
                    NavigationBarItem(false, { openSection("reels.html") }, { Text("🎬", fontSize = 20.sp) }, label = { Text("الريلز", fontSize = 10.sp) })
                    NavigationBarItem(true, { openConnection() }, { Icon(Icons.Default.Call, null) }, label = { Text("اتصال", fontSize = 10.sp) })
                }
            }
        ) { padding ->
            Column(
                Modifier.fillMaxSize().padding(padding).background(
                    Brush.verticalGradient(listOf(Color(0xFF0B1020), HomeNight, Color(0xFF090C14)))
                ).padding(18.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier.size(50.dp).background(Brush.linearGradient(listOf(HomeViolet, HomeAqua)), CircleShape),
                        contentAlignment = Alignment.Center
                    ) { Text("ش", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Black) }
                    Column(Modifier.padding(start = 12.dp)) {
                        Text("شنو منو", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 24.sp)
                        Text("اتصال • مول العراق • الريلز • الخدمات", color = HomeMuted, fontSize = 12.sp)
                    }
                }
                Spacer(Modifier.height(22.dp))
                HomeCard("💬", "الدردشات", "رسائلك ومحادثاتك مع أصدقاء شنو منو") { openConnection() }
                Spacer(Modifier.height(10.dp))
                HomeCard("🛍️", "مول العراق", "تصفح المتاجر والمنتجات داخل التطبيق دون تسجيل جديد") { openSection("mall.html") }
                Spacer(Modifier.height(10.dp))
                HomeCard("🎬", "الريلز", "مقاطع شنو منو القصيرة داخل التطبيق") { openSection("reels.html") }
                Spacer(Modifier.height(10.dp))
                HomeCard("🧰", "الخدمات", "صفحة الخدمات جاهزة للإضافات القادمة") { openSection("services.html") }
                Spacer(Modifier.height(10.dp))
                HomeCard("☎️", "شنو منو اتصال", "جهات الهاتف، الأصدقاء، المكالمات والرسائل") { openConnection() }
            }
        }
    }

    @Composable
    private fun HomeCard(icon: String, title: String, subtitle: String, onClick: () -> Unit) {
        Card(
            Modifier.fillMaxWidth().clickable(onClick = onClick),
            colors = CardDefaults.cardColors(containerColor = HomePanel),
            shape = RoundedCornerShape(22.dp)
        ) {
            Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(50.dp).background(Color(0x227C5CFF), CircleShape), contentAlignment = Alignment.Center) {
                    Text(icon, fontSize = 24.sp)
                }
                Column(Modifier.padding(start = 14.dp).weight(1f)) {
                    Text(title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                    Text(subtitle, color = HomeMuted, fontSize = 11.sp, lineHeight = 17.sp)
                }
                Text("‹", color = HomeAqua, fontSize = 28.sp)
            }
        }
    }

    private fun openConnection() {
        startActivity(Intent(this, MainActivity::class.java))
    }

    private fun openSection(page: String) {
        startActivity(Intent(this, WebSectionActivity::class.java).putExtra(WebSectionActivity.EXTRA_URL, WebSectionActivity.BASE + page))
    }
}
