package com.shnomano.call

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.ContactsContract
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shnomano.call.data.*
import kotlinx.coroutines.launch

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

@Composable
fun ShnoManoCallApp() {
    val context = LocalContext.current
    val repo = remember { AppRepository(context) }
    var signedIn by remember { mutableStateOf(repo.session.isSignedIn()) }
    var selected by remember { mutableIntStateOf(0) }
    var activeChat by remember { mutableStateOf<ConversationDto?>(null) }

    MaterialTheme {
        if (!signedIn) {
            LoginScreen(repo) { signedIn = true }
            return@MaterialTheme
        }

        if (activeChat != null) {
            ChatScreen(repo, activeChat!!) { activeChat = null }
            return@MaterialTheme
        }

        val tabs = listOf(
            Tab("جهاتي", Icons.Default.Contacts),
            Tab("الرسائل", Icons.Default.ChatBubble),
            Tab("اتصال", Icons.Default.Call),
            Tab("السجل", Icons.Default.History),
            Tab("حسابي", Icons.Default.Person)
        )
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
                Modifier.fillMaxSize().padding(padding).background(
                    Brush.verticalGradient(listOf(Color(0xFF0B1020), Night, Color(0xFF090C14)))
                )
            ) {
                when (selected) {
                    0 -> ContactsScreen(repo, onMessage = { userId ->
                        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch {
                            repo.openConversation(userId).onSuccess { activeChat = it }
                        }
                    })
                    1 -> ConversationsScreen(repo) { activeChat = it }
                    2 -> CallHubScreen(repo)
                    3 -> RecentScreen(repo) { activeChat = it }
                    else -> AccountScreen(repo) {
                        repo.signOut(); signedIn = false
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LoginScreen(repo: AppRepository, onSuccess: () -> Unit) {
    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF0B1020), Night))), contentAlignment = Alignment.Center) {
        Card(Modifier.fillMaxWidth().padding(24.dp), shape = RoundedCornerShape(28.dp), colors = CardDefaults.cardColors(containerColor = Panel)) {
            Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                BrandHeader("تسجيل الدخول", "شنو منو اتصال")
                Spacer(Modifier.height(20.dp))
                OutlinedTextField(identifier, { identifier = it }, label = { Text("اسم المستخدم / الهاتف / البريد") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(password, { password = it }, label = { Text("كلمة المرور") }, visualTransformation = PasswordVisualTransformation(), singleLine = true, modifier = Modifier.fillMaxWidth())
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp, modifier = Modifier.padding(top = 10.dp)) }
                Spacer(Modifier.height(16.dp))
                Button(
                    onClick = {
                        busy = true; error = null
                        scope.launch {
                            repo.signIn(identifier, password).onSuccess { onSuccess() }.onFailure { error = it.message ?: "تعذر تسجيل الدخول" }
                            busy = false
                        }
                    },
                    enabled = !busy && identifier.isNotBlank() && password.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = Violet),
                    modifier = Modifier.fillMaxWidth()
                ) { if (busy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text("دخول") }
            }
        }
    }
}

@Composable
private fun BrandHeader(title: String, subtitle: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(50.dp).background(Brush.linearGradient(listOf(Violet, Aqua)), CircleShape), contentAlignment = Alignment.Center) {
            Text("ش", color = Color.White, fontSize = 23.sp, fontWeight = FontWeight.Black)
        }
        Column(Modifier.padding(start = 12.dp)) {
            Text(title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 20.sp)
            Text(subtitle, color = Muted, fontSize = 12.sp)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ContactsScreen(repo: AppRepository, onMessage: (String) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val contacts by repo.observeContacts().collectAsState(initial = emptyList())
    var friends by remember { mutableStateOf<List<FriendDto>>(emptyList()) }
    var query by remember { mutableStateOf("") }
    var status by remember { mutableStateOf<String?>(null) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val uri = result.data?.data ?: return@rememberLauncherForActivityResult
        scope.launch {
            repo.importPickedPhone(uri).onSuccess { status = "تمت إضافة ${it.name} وحفظها" }.onFailure { status = it.message }
        }
    }

    LaunchedEffect(Unit) {
        repo.syncContacts()
        friends = repo.loadFriends()
    }

    val filteredContacts = contacts.filter { query.isBlank() || it.name.contains(query, true) || it.phone.contains(query) }
    val filteredFriends = friends.filter { query.isBlank() || it.displayName.contains(query, true) || (it.username ?: "").contains(query, true) }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        BrandHeader("شنو منو اتصال", "جهات الهاتف + أصدقاء شنو منو")
        Spacer(Modifier.height(14.dp))
        TextField(query, { query = it }, modifier = Modifier.fillMaxWidth(), placeholder = { Text("ابحث بالاسم أو الرقم") }, leadingIcon = { Icon(Icons.Default.Search, null) }, singleLine = true, shape = RoundedCornerShape(18.dp))
        Spacer(Modifier.height(10.dp))
        Button(
            onClick = {
                picker.launch(Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI))
            },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = Violet)
        ) { Icon(Icons.Default.PersonAdd, null); Spacer(Modifier.width(8.dp)); Text("اختيار جهة من الهاتف") }
        status?.let { Text(it, color = Aqua, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp)) }
        Spacer(Modifier.height(12.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (filteredFriends.isNotEmpty()) {
                item { SectionTitle("أصدقاء شنو منو") }
                items(filteredFriends, key = { "f-${it.userId}" }) { friend ->
                    PersonCard(friend.displayName, "@${friend.username ?: ""}", friend.online) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            SmallAction("رسالة", Icons.Default.ChatBubble, Modifier.weight(1f)) { if (friend.userId.isNotBlank()) onMessage(friend.userId) }
                            SmallAction("صوت", Icons.Default.Call, Modifier.weight(1f)) { openShnoCall(context, friend.userId, "audio") }
                            SmallAction("فيديو", Icons.Default.Videocam, Modifier.weight(1f)) { openShnoCall(context, friend.userId, "video") }
                        }
                    }
                }
            }
            if (filteredContacts.isNotEmpty()) {
                item { SectionTitle("جهات الهاتف") }
                items(filteredContacts, key = { "p-${it.phone}" }) { contact ->
                    PersonCard(contact.name, contact.phone, false) {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                SmallAction("هاتف", Icons.Default.Phone, Modifier.weight(1f)) { dial(context, contact.phone) }
                                SmallAction("واتساب", Icons.Default.Chat, Modifier.weight(1f)) { openWhatsApp(context, contact.phone) }
                                SmallAction("تلغرام", Icons.Default.Send, Modifier.weight(1f)) { openTelegram(context, contact.phone) }
                            }
                            if (!contact.linkedUserId.isNullOrBlank()) {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    SmallAction("شنو رسالة", Icons.Default.ChatBubble, Modifier.weight(1f)) { onMessage(contact.linkedUserId) }
                                    SmallAction("شنو صوت", Icons.Default.Call, Modifier.weight(1f)) { openShnoCall(context, contact.linkedUserId, "audio") }
                                    SmallAction("شنو فيديو", Icons.Default.Videocam, Modifier.weight(1f)) { openShnoCall(context, contact.linkedUserId, "video") }
                                }
                            }
                        }
                    }
                }
            }
            if (filteredFriends.isEmpty() && filteredContacts.isEmpty()) item {
                Text("لا توجد جهات بعد. استخدم زر اختيار جهة من الهاتف.", color = Muted, modifier = Modifier.padding(24.dp), textAlign = TextAlign.Center)
            }
        }
    }
}

@Composable
private fun PersonCard(name: String, sub: String, online: Boolean, actions: @Composable () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(42.dp).background(Color(0x227C5CFF), CircleShape), contentAlignment = Alignment.Center) { Icon(Icons.Default.Person, null, tint = Violet) }
                Column(Modifier.padding(start = 10.dp).weight(1f)) {
                    Text(name, color = Color.White, fontWeight = FontWeight.Bold)
                    Text(sub, color = Muted, fontSize = 11.sp)
                }
                if (online) Text("متصل", color = Aqua, fontSize = 10.sp)
            }
            Spacer(Modifier.height(10.dp)); actions()
        }
    }
}

@Composable
private fun SmallAction(text: String, icon: ImageVector, modifier: Modifier = Modifier, onClick: () -> Unit) {
    OutlinedButton(onClick = onClick, modifier = modifier, contentPadding = PaddingValues(horizontal = 6.dp, vertical = 6.dp)) {
        Icon(icon, null, modifier = Modifier.size(16.dp)); Spacer(Modifier.width(4.dp)); Text(text, fontSize = 10.sp, maxLines = 1)
    }
}

@Composable
private fun SectionTitle(text: String) { Text(text, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp, modifier = Modifier.padding(vertical = 6.dp)) }

@Composable
private fun ConversationsScreen(repo: AppRepository, onOpen: (ConversationDto) -> Unit) {
    var conversations by remember { mutableStateOf<List<ConversationDto>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) { conversations = repo.loadConversations(); loading = false }
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        BrandHeader("المحادثات", "رسائل شنو منو المتزامنة")
        Spacer(Modifier.height(14.dp))
        if (loading) CircularProgressIndicator()
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(conversations, key = { it.id }) { c ->
                val other = c.otherUser
                Card(Modifier.fillMaxWidth().clickable { onOpen(c) }, colors = CardDefaults.cardColors(containerColor = Panel)) {
                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Person, null, tint = Violet)
                        Column(Modifier.padding(start = 12.dp).weight(1f)) {
                            Text(other?.fullName ?: other?.username ?: "محادثة", color = Color.White, fontWeight = FontWeight.Bold)
                            Text(c.lastMessage?.text ?: "", color = Muted, fontSize = 11.sp, maxLines = 1)
                        }
                        if (c.unreadCount > 0) Badge { Text(c.unreadCount.toString()) }
                    }
                }
            }
            if (!loading && conversations.isEmpty()) item { Text("لا توجد محادثات بعد.", color = Muted, modifier = Modifier.padding(24.dp)) }
        }
    }
}

@Composable
private fun ChatScreen(repo: AppRepository, conversation: ConversationDto, onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    var messages by remember { mutableStateOf<List<MessageDto>>(emptyList()) }
    var text by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    LaunchedEffect(conversation.id) { repo.loadMessages(conversation.id).onSuccess { messages = it } }
    Scaffold(containerColor = Night, topBar = {
        Row(Modifier.fillMaxWidth().background(Panel).padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, null, tint = Color.White) }
            Text(conversation.otherUser?.fullName ?: conversation.otherUser?.username ?: "محادثة", color = Color.White, fontWeight = FontWeight.Bold)
        }
    }, bottomBar = {
        Row(Modifier.fillMaxWidth().background(Panel).padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            TextField(text, { text = it }, modifier = Modifier.weight(1f), placeholder = { Text("اكتب رسالة") }, singleLine = true)
            IconButton(enabled = !busy && text.isNotBlank(), onClick = {
                busy = true
                scope.launch {
                    repo.sendMessage(conversation.id, text).onSuccess { msg -> messages = messages + msg; text = "" }
                    busy = false
                }
            }) { Icon(Icons.Default.Send, null, tint = Aqua) }
        }
    }) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding).padding(12.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            items(messages, key = { it.messageId.ifBlank { "${it.createdAt}-${it.text}" } }) { m ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = if (m.mine) Arrangement.End else Arrangement.Start) {
                    Surface(color = if (m.mine) Violet else Panel, shape = RoundedCornerShape(16.dp)) {
                        Text(m.text.orEmpty(), color = Color.White, modifier = Modifier.padding(10.dp), fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun CallHubScreen(repo: AppRepository) {
    val context = LocalContext.current
    var friends by remember { mutableStateOf<List<FriendDto>>(emptyList()) }
    LaunchedEffect(Unit) { friends = repo.loadFriends() }
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        BrandHeader("الاتصال", "صوت وفيديو مع أصدقاء شنو منو")
        Spacer(Modifier.height(14.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(friends, key = { it.userId }) { f ->
                PersonCard(f.displayName, f.username ?: "", f.online) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        SmallAction("صوت", Icons.Default.Call, Modifier.weight(1f)) { openShnoCall(context, f.userId, "audio") }
                        SmallAction("فيديو", Icons.Default.Videocam, Modifier.weight(1f)) { openShnoCall(context, f.userId, "video") }
                    }
                }
            }
            if (friends.isEmpty()) item { Text("لا يوجد أصدقاء متاحون للاتصال حالياً.", color = Muted, modifier = Modifier.padding(24.dp)) }
        }
    }
}

@Composable
private fun RecentScreen(repo: AppRepository, onOpen: (ConversationDto) -> Unit) {
    var rows by remember { mutableStateOf<List<ConversationDto>>(emptyList()) }
    LaunchedEffect(Unit) { rows = repo.loadConversations() }
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        BrandHeader("النشاط الأخير", "آخر الأشخاص الذين تواصلت معهم")
        Spacer(Modifier.height(14.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(rows, key = { it.id }) { c ->
                Card(Modifier.fillMaxWidth().clickable { onOpen(c) }, colors = CardDefaults.cardColors(containerColor = Panel)) {
                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.History, null, tint = Violet)
                        Column(Modifier.padding(start = 10.dp)) {
                            Text(c.otherUser?.fullName ?: c.otherUser?.username ?: "مستخدم", color = Color.White)
                            Text(c.updatedAt ?: "", color = Muted, fontSize = 10.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AccountScreen(repo: AppRepository, onLogout: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Surface(Modifier.size(82.dp), shape = CircleShape, color = Color(0x227C5CFF)) { Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.Person, null, tint = Violet, modifier = Modifier.size(38.dp)) } }
        Spacer(Modifier.height(16.dp))
        Text(repo.session.fullName ?: repo.session.username ?: "حسابي", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text("@${repo.session.username.orEmpty()}", color = Muted)
        Spacer(Modifier.height(24.dp))
        Button(onClick = onLogout, colors = ButtonDefaults.buttonColors(containerColor = Violet)) { Text("تسجيل الخروج") }
    }
}

private fun dial(context: android.content.Context, phone: String) {
    context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))
}

private fun openWhatsApp(context: android.content.Context, phone: String) {
    val international = "964" + phone.removePrefix("0")
    openUri(context, "https://wa.me/$international")
}

private fun openTelegram(context: android.content.Context, phone: String) {
    val international = "+964" + phone.removePrefix("0")
    val native = Intent(Intent.ACTION_VIEW, Uri.parse("tg://resolve?phone=${Uri.encode(international)}"))
    runCatching { context.startActivity(native) }.onFailure { openUri(context, "https://t.me/${Uri.encode(international)}") }
}

private fun openShnoCall(context: android.content.Context, userId: String, type: String) {
    if (userId.isBlank()) return
    openUri(context, "https://shino-mino-tak-tak.duckdns.org/messages.html?user=${Uri.encode(userId)}&prepare=$type")
}

private fun openUri(context: android.content.Context, url: String) {
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
}
