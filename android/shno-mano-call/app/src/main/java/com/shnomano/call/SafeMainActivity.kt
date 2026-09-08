package com.shnomano.call

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Contacts
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

class SafeMainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ShnoManoTheme { SafeApp() } }
    }
}

@Composable
private fun SafeApp() {
    var entered by remember { mutableStateOf(false) }
    var tab by remember { mutableIntStateOf(0) }
    val bg = Color(0xFF03110F)
    val card = Color(0xFF102723)
    val accent = Color(0xFF18E0B5)
    val muted = Color(0xFF95ABA6)

    Surface(modifier = Modifier.fillMaxSize(), color = bg) {
        if (!entered) {
            Column(
                modifier = Modifier.fillMaxSize().statusBarsPadding().padding(28.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(Modifier.size(100.dp).background(accent, CircleShape), contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.Call, null, tint = bg, modifier = Modifier.size(50.dp))
                }
                Spacer(Modifier.height(22.dp))
                Text("شنو منو اتصال", color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Black)
                Text("تواصل ... بلا حدود", color = accent)
                Spacer(Modifier.height(34.dp))
                Button(
                    onClick = { entered = true },
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = accent, contentColor = bg)
                ) { Text("فتح التطبيق", fontWeight = FontWeight.Bold) }
            }
        } else {
            Column(Modifier.fillMaxSize().statusBarsPadding()) {
                Text(
                    when (tab) { 0 -> "الدردشات"; 1 -> "المكالمات"; 2 -> "جهات الاتصال"; else -> "الإعدادات" },
                    color = Color.White,
                    fontSize = 25.sp,
                    fontWeight = FontWeight.Black,
                    modifier = Modifier.padding(18.dp)
                )
                Column(Modifier.weight(1f).padding(horizontal = 14.dp)) {
                    listOf("سارة أحمد" to "متصلة الآن", "علي الكربلائي" to "آخر ظهور 9:18", "نور الهدى" to "آخر ظهور أمس").forEach { p ->
                        Surface(color = card, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp)) {
                            Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                Box(Modifier.size(48.dp).background(accent, CircleShape), contentAlignment = Alignment.Center) {
                                    Text(p.first.take(1), color = bg, fontWeight = FontWeight.Black)
                                }
                                Column(Modifier.padding(horizontal = 12.dp)) {
                                    Text(p.first, color = Color.White, fontWeight = FontWeight.Bold)
                                    Text(p.second, color = muted, fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }
                NavigationBar(containerColor = Color(0xFF071815)) {
                    listOf(
                        Triple("الدردشات", Icons.Default.Chat, 0),
                        Triple("المكالمات", Icons.Default.Call, 1),
                        Triple("الأسماء", Icons.Default.Contacts, 2),
                        Triple("الإعدادات", Icons.Default.Settings, 3)
                    ).forEach { item ->
                        NavigationBarItem(
                            selected = tab == item.third,
                            onClick = { tab = item.third },
                            icon = { Icon(item.second, null) },
                            label = { Text(item.first, fontSize = 10.sp) },
                            colors = NavigationBarItemDefaults.colors(selectedIconColor = bg, selectedTextColor = accent, indicatorColor = accent, unselectedIconColor = muted, unselectedTextColor = muted)
                        )
                    }
                }
            }
        }
    }
}
