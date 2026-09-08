package com.shnomano.call

import android.Manifest
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Contacts
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Night = Color(0xFF070910)
private val Panel = Color(0xFF111522)
private val Violet = Color(0xFF7C5CFF)
private val Aqua = Color(0xFF27D8C4)
private val Muted = Color(0xFF98A2B3)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ShnoManoCallApp() }
    }
}

private data class Tab(val title: String, val icon: ImageVector)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShnoManoCallApp() {
    var selected by remember { mutableIntStateOf(0) }
    val tabs = listOf(
        Tab("جهاتي", Icons.Default.Contacts),
        Tab("الرسائل", Icons.Default.ChatBubble),
        Tab("اتصال", Icons.Default.Call),
        Tab("السجل", Icons.Default.History),
        Tab("حسابي", Icons.Default.Person)
    )

    MaterialTheme {
        Scaffold(
            containerColor = Night,
            bottomBar = {
                NavigationBar(containerColor = Color(0xFF0B0E17)) {
                    tabs.forEachIndexed { index, tab ->
                        NavigationBarItem(
                            selected = selected == index,
                            onClick = { selected = index },
                            icon = { Icon(tab.icon, contentDescription = tab.title) },
                            label = { Text(tab.title, fontSize = 10.sp) }
                        )
                    }
                }
            }
        ) { padding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .background(
                        Brush.verticalGradient(
                            listOf(Color(0xFF0B1020), Night, Color(0xFF090C14))
                        )
                    )
            ) {
                when (selected) {
                    0 -> ContactsScreen()
                    1 -> EmptyFeature("المحادثات", "ستظهر رسائلك المحفوظة والمتزامنة هنا.", Icons.Default.ChatBubble)
                    2 -> EmptyFeature("شنو منو اتصال", "اختر شخصاً من جهاتك لبدء مكالمة صوتية أو فيديو.", Icons.Default.Call)
                    3 -> EmptyFeature("سجل المكالمات", "المكالمات الواردة والصادرة ستظهر هنا.", Icons.Default.History)
                    else -> EmptyFeature("حسابي", "إدارة حساب شنو منو وإعدادات الاتصال.", Icons.Default.Person)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ContactsScreen() {
    var query by remember { mutableStateOf("") }
    var permissionStatus by remember { mutableStateOf<String?>(null) }
    val permissions = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        permissionStatus = if (result[Manifest.permission.READ_CONTACTS] == true) {
            "تم السماح بقراءة جهات الاتصال المختارة على الجهاز."
        } else {
            "لم يتم منح صلاحية جهات الاتصال. يمكنك منحها لاحقاً من إعدادات الهاتف."
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp, vertical = 14.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(Brush.linearGradient(listOf(Violet, Aqua)), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text("ش", color = Color.White, fontWeight = FontWeight.Black, fontSize = 22.sp)
            }
            Column(Modifier.padding(start = 12.dp).weight(1f)) {
                Text("شنو منو اتصال", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text("أصدقاؤك وجهات هاتفك بمكان واحد", color = Muted, fontSize = 12.sp)
            }
            IconButton(onClick = {}) {
                Icon(Icons.Default.Person, contentDescription = "الحساب", tint = Color.White)
            }
        }

        Spacer(Modifier.height(18.dp))

        TextField(
            value = query,
            onValueChange = { query = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("ابحث بالاسم أو الرقم") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            singleLine = true,
            shape = RoundedCornerShape(18.dp),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = Panel,
                unfocusedContainerColor = Panel,
                focusedIndicatorColor = Color.Transparent,
                unfocusedIndicatorColor = Color.Transparent,
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White,
                focusedLeadingIconColor = Aqua,
                unfocusedLeadingIconColor = Muted
            )
        )

        Spacer(Modifier.height(14.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF111522))
        ) {
            Column(Modifier.padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Surface(
                    modifier = Modifier.size(64.dp),
                    shape = CircleShape,
                    color = Color(0x227C5CFF)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.Contacts, contentDescription = null, tint = Violet, modifier = Modifier.size(30.dp))
                    }
                }
                Spacer(Modifier.height(12.dp))
                Text("ابدأ بإضافة جهات هاتفك", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text(
                    "التطبيق لن يعرض الصفحة العامة. جهاتك ورسائلك تحفظ داخل الهاتف وتزامن مع حساب شنو منو.",
                    color = Muted,
                    fontSize = 12.sp,
                    lineHeight = 18.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 6.dp)
                )
                Spacer(Modifier.height(14.dp))
                Button(
                    onClick = {
                        permissions.launch(
                            arrayOf(
                                Manifest.permission.READ_CONTACTS,
                                Manifest.permission.RECORD_AUDIO,
                                Manifest.permission.CAMERA
                            )
                        )
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Violet),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Contacts, contentDescription = null)
                    Text("إضافة جهات الهاتف", modifier = Modifier.padding(start = 8.dp))
                }
                permissionStatus?.let {
                    Text(it, color = if (it.startsWith("تم")) Aqua else Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 10.dp))
                }
            }
        }

        Spacer(Modifier.height(14.dp))
        Text("الأشخاص", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
        Text("ستظهر هنا جهات الهاتف والأصدقاء بعد أول مزامنة ناجحة.", color = Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
private fun EmptyFeature(title: String, body: String, icon: ImageVector) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Surface(modifier = Modifier.size(76.dp), shape = CircleShape, color = Color(0x227C5CFF)) {
            Box(contentAlignment = Alignment.Center) {
                Icon(icon, contentDescription = null, tint = Violet, modifier = Modifier.size(34.dp))
            }
        }
        Spacer(Modifier.height(18.dp))
        Text(title, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text(body, color = Muted, fontSize = 13.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp))
    }
}
