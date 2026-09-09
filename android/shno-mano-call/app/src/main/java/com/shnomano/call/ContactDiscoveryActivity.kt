package com.shnomano.call

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shnomano.call.data.ContactDiscoveryRepository
import com.shnomano.call.data.FriendDto
import com.shnomano.call.data.AppRepository
import kotlinx.coroutines.launch

class ContactDiscoveryActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ShnoManoTheme { ContactDiscoveryScreen { finish() } } }
    }
}

@Composable
private fun ContactDiscoveryScreen(onBack: () -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val discovery = remember { ContactDiscoveryRepository(context) }
    val repo = remember { AppRepository(context) }
    val scope = rememberCoroutineScope()
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<FriendDto>>(emptyList()) }
    var busy by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf<String?>(null) }

    fun runSearch() {
        val value = query.trim()
        if (value.length < 2) {
            status = "اكتب اسم مستخدم أو رقم شنو منو"
            results = emptyList()
            return
        }
        busy = true
        status = null
        scope.launch {
            discovery.search(value)
                .onSuccess { result ->
                    results = result.users
                    if (result.normalizedPhone != null && result.registeredPhoneUser == null) {
                        status = "هذا الرقم غير مسجل في شنو منو — يمكنك إرسال دعوة جاهزة"
                    } else if (result.users.isEmpty()) {
                        status = "لم يتم العثور على مستخدم"
                    }
                }
                .onFailure { status = it.message ?: "تعذر البحث الآن" }
            busy = false
        }
    }

    Column(
        Modifier.fillMaxSize().background(Color(0xFF070910)).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack) { Text("رجوع") }
            Text("البحث وإضافة الأصدقاء", color = Color.White, fontSize = 21.sp, fontWeight = FontWeight.Bold)
        }
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("اسم المستخدم أو رقم الهاتف") },
            singleLine = true,
            shape = RoundedCornerShape(18.dp)
        )
        Button(onClick = ::runSearch, enabled = !busy, modifier = Modifier.fillMaxWidth().height(50.dp)) {
            if (busy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
            else Text("بحث في شنو منو")
        }

        status?.let { Text(it, color = Color(0xFF19D9A0), fontSize = 12.sp) }

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.weight(1f)) {
            items(results, key = { it.userId }) { user ->
                Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF111522)), shape = RoundedCornerShape(18.dp)) {
                    Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(44.dp).background(Color(0xFF19D9A0).copy(alpha = .15f), CircleShape), contentAlignment = Alignment.Center) {
                            Text(user.displayName.firstOrNull()?.toString() ?: "ش", color = Color(0xFF19D9A0), fontWeight = FontWeight.Bold)
                        }
                        Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                            Text(user.displayName, color = Color.White, fontWeight = FontWeight.Bold)
                            Text("@${user.username.orEmpty()}", color = Color(0xFF98A2B3), fontSize = 11.sp)
                        }
                        TextButton(onClick = {
                            scope.launch {
                                repo.sendFriendRequest(user.userId)
                                    .onSuccess { status = it }
                                    .onFailure { status = it.message ?: "تعذر إرسال الطلب" }
                            }
                        }) { Text("إضافة") }
                    }
                }
            }
        }

        OutlinedButton(
            onClick = {
                val text = discovery.inviteText(query)
                context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                }, "دعوة إلى شنو منو"))
            },
            modifier = Modifier.fillMaxWidth()
        ) { Text("إرسال دعوة جاهزة") }

        OutlinedButton(
            onClick = { context.startActivity(Intent(context, QrFriendActivity::class.java)) },
            modifier = Modifier.fillMaxWidth()
        ) { Text("إضافة عبر QR") }
    }
}
