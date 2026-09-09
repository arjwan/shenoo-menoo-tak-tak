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
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shnomano.call.data.*
import kotlinx.coroutines.launch

private val Bg = Color(0xFF061514)
private val Panel = Color(0xFF10201B)
private val Panel2 = Color(0xFF132824)
private val Accent = Color(0xFF19D9A0)
private val Muted = Color(0xFF91A39D)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ShnoManoTheme { ShnoManoCallApp() } }
    }
}

private data class Tab(val title: String, val icon: ImageVector)

@Composable
fun ShnoManoCallApp() {
    val context = LocalContext.current
    val repo = remember(context) { AppRepository(context) }
    var signedIn by remember { mutableStateOf(repo.session.isSignedIn()) }
    var selected by remember { mutableIntStateOf(0) }
    var activeChat by remember { mutableStateOf<ConversationDto?>(null) }

    if (!signedIn) {
        LoginScreen(repo, onSuccess = { signedIn = true }, onRegister = {
            context.startActivity(Intent(context, RegisterActivity::class.java))
        })
        return
    }

    activeChat?.let { conversation ->
        ChatScreen(repo, conversation, onBack = { activeChat = null })
        return
    }

    val tabs = listOf(
        Tab("الدردشات", Icons.Default.ChatBubble),
        Tab("المكالمات", Icons.Default.Call),
        Tab("جهات الاتصال", Icons.Default.Contacts),
        Tab("الإعدادات", Icons.Default.Settings)
    )

    Scaffold(
        containerColor = Bg,
        bottomBar = {
            NavigationBar(containerColor = Color(0xFF071815)) {
                tabs.forEachIndexed { index, tab ->
                    NavigationBarItem(
                        selected = selected == index,
                        onClick = { selected = index },
                        icon = { Icon(tab.icon, tab.title) },
                        label = { Text(tab.title, fontSize = 10.sp) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Bg,
                            selectedTextColor = Accent,
                            indicatorColor = Accent,
                            unselectedIconColor = Muted,
                            unselectedTextColor = Muted
                        )
                    )
                }
            }
        }
    ) { padding ->
        Box(
            Modifier.fillMaxSize().padding(padding).background(
                Brush.verticalGradient(listOf(Color(0xFF062522), Bg, Color(0xFF020A09)))
            )
        ) {
            when (selected) {
                0 -> ConversationsScreen(repo) { activeChat = it }
                1 -> CallsScreen(repo) { userId ->
                    repoLaunchConversation(repo, userId) { activeChat = it }
                }
                2 -> ContactsScreen(repo) { userId ->
                    repoLaunchConversation(repo, userId) { activeChat = it }
                }
                else -> AccountScreen(repo) {
                    repo.signOut()
                    activeChat = null
                    signedIn = false
                }
            }
        }
    }
}

private fun repoLaunchConversation(repo: AppRepository, userId: String, onOpen: (ConversationDto) -> Unit) {
    if (userId.isBlank()) return
    kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch {
        repo.openConversation(userId).onSuccess(onOpen)
    }
}

@Composable
private fun LoginScreen(repo: AppRepository, onSuccess: () -> Unit, onRegister: () -> Unit) {
    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Box(
        Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF062522), Bg))),
        contentAlignment = Alignment.Center
    ) {
        Card(
            Modifier.fillMaxWidth().padding(24.dp),
            shape = RoundedCornerShape(28.dp),
            colors = CardDefaults.cardColors(containerColor = Panel)
        ) {
            Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                BrandHeader("تسجيل الدخول", "شنو منو اتصال")
                Spacer(Modifier.height(22.dp))
                OutlinedTextField(
                    value = identifier,
                    onValueChange = { identifier = it },
                    label = { Text("اسم المستخدم / الهاتف / البريد") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("كلمة المرور") },
                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility, if (passwordVisible) "إخفاء كلمة المرور" else "إظهار كلمة المرور")
                        }
                    },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp, modifier = Modifier.padding(top = 10.dp)) }
                Spacer(Modifier.height(16.dp))
                Button(
                    onClick = {
                        busy = true
                        error = null
                        scope.launch {
                            repo.signIn(identifier, password)
                                .onSuccess { onSuccess() }
                                .onFailure { error = it.message ?: "تعذر تسجيل الدخول" }
                            busy = false
                        }
                    },
                    enabled = !busy && identifier.isNotBlank() && password.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Bg),
                    modifier = Modifier.fillMaxWidth().height(52.dp)
                ) {
                    if (busy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text("دخول", fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.height(10.dp))
                OutlinedButton(onClick = onRegister, modifier = Modifier.fillMaxWidth()) { Text("إنشاء حساب جديد") }
            }
        }
    }
}

@Composable
private fun BrandHeader(title: String, subtitle: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier.size(52.dp).background(Brush.linearGradient(listOf(Accent, Color(0xFF43E0BE))), CircleShape),
            contentAlignment = Alignment.Center
        ) { Text("ش", color = Bg, fontSize = 24.sp, fontWeight = FontWeight.Black) }
        Column(Modifier.padding(start = 12.dp)) {
            Text(title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 21.sp)
            Text(subtitle, color = Muted, fontSize = 12.sp)
        }
    }
}

@Composable
private fun ConversationsScreen(repo: AppRepository, onOpen: (ConversationDto) -> Unit) {
    var conversations by remember { mutableStateOf<List<ConversationDto>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) {
        conversations = repo.loadConversations()
        loading = false
    }
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        BrandHeader("الدردشات", "محادثات شنو منو الحقيقية")
        Spacer(Modifier.height(14.dp))
        if (loading) LinearProgressIndicator(Modifier.fillMaxWidth(), color = Accent)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(conversations, key = { it.id }) { c ->
                val other = c.otherUser
                PersonRow(
                    name = other?.fullName ?: other?.username ?: "محادثة",
                    subtitle = c.lastMessage?.text.orEmpty(),
                    badge = c.unreadCount,
                    onClick = { onOpen(c) }
                )
            }
            if (!loading && conversations.isEmpty()) item { EmptyState("لا توجد محادثات بعد") }
        }
    }
}

@Composable
private fun ContactsScreen(repo: AppRepository, onMessage: (String) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val contacts by repo.observeContacts().collectAsState(initial = emptyList())
    var friends by remember { mutableStateOf<List<FriendDto>>(emptyList()) }
    var requests by remember { mutableStateOf<List<FriendRequestDto>>(emptyList()) }
    var sentRequestUserIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var query by remember { mutableStateOf("") }
    var status by remember { mutableStateOf<String?>(null) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val uri = result.data?.data ?: return@rememberLauncherForActivityResult
        scope.launch {
            repo.importPickedPhone(uri)
                .onSuccess { status = "تم حفظ ${it.name}" }
                .onFailure { status = it.message ?: "تعذر قراءة جهة الاتصال" }
        }
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) picker.launch(Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI))
        else status = "يلزم السماح بقراءة جهة الاتصال التي تختارها"
    }

    LaunchedEffect(Unit) {
        repo.syncContacts()
        friends = repo.loadFriends()
        requests = repo.loadFriendRequests()
        sentRequestUserIds = repo.loadSentFriendRequests().map { it.user.userId }.toSet()
    }

    val filteredFriends = friends.filter { query.isBlank() || it.displayName.contains(query, true) || (it.username ?: "").contains(query, true) }
    val filteredContacts = contacts.filter { query.isBlank() || it.name.contains(query, true) || it.phone.contains(query) }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        BrandHeader("جهات الاتصال", "الهاتف + أصدقاء شنو منو")
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("ابحث بالاسم أو الرقم") },
            leadingIcon = { Icon(Icons.Default.Search, null) },
            singleLine = true,
            shape = RoundedCornerShape(20.dp)
        )
        Spacer(Modifier.height(8.dp))
        Button(
            onClick = { permission.launch(android.Manifest.permission.READ_CONTACTS) },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Bg)
        ) {
            Icon(Icons.Default.PersonAdd, null)
            Spacer(Modifier.width(8.dp))
            Text("اختيار جهة من الهاتف")
        }
        OutlinedButton(
            onClick = { scope.launch {
                requests = repo.loadFriendRequests()
                sentRequestUserIds = repo.loadSentFriendRequests().map { it.user.userId }.toSet()
                friends = repo.loadFriends()
                status = "تم تحديث طلبات الصداقة"
            } },
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Default.Refresh, null)
            Spacer(Modifier.width(8.dp))
            Text("تحديث طلبات الصداقة")
        }
        status?.let { Text(it, color = Accent, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp)) }
        Spacer(Modifier.height(8.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (requests.isNotEmpty()) item { SectionTitle("طلبات الصداقة الواردة") }
            items(requests, key = { "request-${it.id}" }) { request ->
                Card(colors = CardDefaults.cardColors(containerColor = Panel2), shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        AvatarLetter(request.user.displayName)
                        Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                            Text(request.user.displayName, color = Color.White, fontWeight = FontWeight.Bold)
                            Text("يريد إضافتك إلى أصدقاء شنو منو", color = Muted, fontSize = 11.sp)
                        }
                        IconButton(onClick = {
                            scope.launch {
                                repo.respondToFriendRequest(request.id, true).onSuccess { status = it }
                                requests = repo.loadFriendRequests(); friends = repo.loadFriends()
                            }
                        }) { Icon(Icons.Default.Check, "قبول", tint = Accent) }
                        IconButton(onClick = {
                            scope.launch {
                                repo.respondToFriendRequest(request.id, false).onSuccess { status = it }
                                requests = repo.loadFriendRequests()
                            }
                        }) { Icon(Icons.Default.Close, "رفض", tint = MaterialTheme.colorScheme.error) }
                    }
                }
            }
            if (filteredFriends.isNotEmpty()) item { SectionTitle("أصدقاء شنو منو") }
            items(filteredFriends, key = { "friend-${it.userId}" }) { f ->
                PersonRow(f.displayName, if (f.online) "متصل الآن" else "@${f.username ?: ""}", onClick = { onMessage(f.userId) })
            }
            if (filteredContacts.isNotEmpty()) item { SectionTitle("جهات الهاتف") }
            items(filteredContacts, key = { "phone-${it.phone}" }) { c ->
                Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp)) {
                        Text(c.name, color = Color.White, fontWeight = FontWeight.Bold)
                        Text(c.phone, color = Muted, fontSize = 12.sp)
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = { dial(context, c.phone) }, modifier = Modifier.weight(1f)) { Icon(Icons.Default.Phone, null); Spacer(Modifier.width(4.dp)); Text("هاتف") }
                            if (!c.linkedUserId.isNullOrBlank()) {
                                val linkedId = c.linkedUserId.orEmpty()
                                val isFriend = friends.any { it.userId == linkedId }
                                val requestSent = linkedId in sentRequestUserIds
                                OutlinedButton(onClick = {
                                    if (isFriend) onMessage(linkedId)
                                    else if (requestSent) status = "طلب الصداقة مُرسل مسبقًا"
                                    else scope.launch {
                                        repo.sendFriendRequest(linkedId)
                                            .onSuccess { status = it; sentRequestUserIds = sentRequestUserIds + linkedId }
                                            .onFailure { status = it.message ?: "تعذر إرسال الطلب" }
                                    }
                                }, modifier = Modifier.weight(1f)) {
                                    Icon(if (isFriend) Icons.Default.ChatBubble else Icons.Default.PersonAdd, null)
                                    Spacer(Modifier.width(4.dp))
                                    Text(if (isFriend) "مراسلة" else if (requestSent) "طلب مُرسل" else "إضافة")
                                }
                            }
                        }
                    }
                }
            }
            if (filteredFriends.isEmpty() && filteredContacts.isEmpty()) item { EmptyState("لا توجد جهات بعد") }
        }
    }
}

@Composable
private fun CallsScreen(repo: AppRepository, onMessage: (String) -> Unit) {
    val context = LocalContext.current
    var friends by remember { mutableStateOf<List<FriendDto>>(emptyList()) }
    LaunchedEffect(Unit) { friends = repo.loadFriends() }
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        BrandHeader("المكالمات", "صوت وفيديو مع الأصدقاء")
        Spacer(Modifier.height(14.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(friends, key = { it.userId }) { f ->
                Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        AvatarLetter(f.displayName)
                        Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                            Text(f.displayName, color = Color.White, fontWeight = FontWeight.Bold)
                            Text(if (f.online) "متصل الآن" else "@${f.username ?: ""}", color = if (f.online) Accent else Muted, fontSize = 11.sp)
                        }
                        IconButton(onClick = { openShnoCall(context, f.userId, "audio") }) { Icon(Icons.Default.Call, null, tint = Accent) }
                        IconButton(onClick = { openShnoCall(context, f.userId, "video") }) { Icon(Icons.Default.Videocam, null, tint = Accent) }
                        IconButton(onClick = { onMessage(f.userId) }) { Icon(Icons.Default.ChatBubble, null, tint = Color.White) }
                    }
                }
            }
            if (friends.isEmpty()) item { EmptyState("لا يوجد أصدقاء متاحون للمكالمة حالياً") }
        }
    }
}

@Composable
private fun ChatScreen(repo: AppRepository, conversation: ConversationDto, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var messages by remember { mutableStateOf<List<MessageDto>>(emptyList()) }
    var text by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    val other = conversation.otherUser

    LaunchedEffect(conversation.id) {
        repo.loadMessages(conversation.id).onSuccess { messages = it }
    }

    Scaffold(
        containerColor = Bg,
        topBar = {
            Row(Modifier.fillMaxWidth().background(Panel).statusBarsPadding().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, null, tint = Color.White) }
                AvatarLetter(other?.fullName ?: other?.username ?: "ش")
                Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                    Text(other?.fullName ?: other?.username ?: "محادثة", color = Color.White, fontWeight = FontWeight.Bold)
                    Text(if (other?.online == true) "متصل الآن" else "شنو منو", color = if (other?.online == true) Accent else Muted, fontSize = 10.sp)
                }
                if (!other?.id.isNullOrBlank()) {
                    IconButton(onClick = { openShnoCall(context, other!!.id, "audio") }) { Icon(Icons.Default.Call, null, tint = Accent) }
                    IconButton(onClick = { openShnoCall(context, other!!.id, "video") }) { Icon(Icons.Default.Videocam, null, tint = Accent) }
                }
            }
        },
        bottomBar = {
            Row(Modifier.fillMaxWidth().background(Panel).navigationBarsPadding().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(text, { text = it }, modifier = Modifier.weight(1f), placeholder = { Text("اكتب رسالة") }, singleLine = true)
                IconButton(enabled = !busy && text.isNotBlank(), onClick = {
                    val outgoing = text
                    busy = true
                    scope.launch {
                        repo.sendMessage(conversation.id, outgoing)
                            .onSuccess { message -> messages = messages + message; text = "" }
                        busy = false
                    }
                }) { Icon(Icons.Default.Send, null, tint = Accent) }
            }
        }
    ) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding).padding(12.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            items(messages, key = { it.messageId.ifBlank { "${it.createdAt}-${it.text}" } }) { m ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = if (m.mine) Arrangement.End else Arrangement.Start) {
                    Surface(color = if (m.mine) Accent else Panel2, shape = RoundedCornerShape(16.dp)) {
                        Column(Modifier.padding(10.dp)) {
                            Text(m.text.orEmpty(), color = if (m.mine) Bg else Color.White, fontSize = 13.sp)
                            if (m.localState == "pending") Text("قيد الإرسال", color = if (m.mine) Bg.copy(alpha = .7f) else Muted, fontSize = 9.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AccountScreen(repo: AppRepository, onLogout: () -> Unit) {
    val context = LocalContext.current
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        BrandHeader("حسابي", repo.session.fullName ?: repo.session.username ?: "مستخدم شنو منو")
        Spacer(Modifier.height(18.dp))
        InfoRow(Icons.Default.Person, "اسم المستخدم", repo.session.username ?: "-")
        InfoRow(Icons.Default.Cloud, "الخادم", SHNO_MANO_BASE_URL.removeSuffix("/"))
        Spacer(Modifier.height(12.dp))
        OutlinedButton(
            onClick = { context.startActivity(Intent(context, SettingsActivity::class.java)) },
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Default.Settings, null)
            Spacer(Modifier.width(8.dp))
            Text("إعدادات الصوت والرنين والإشعارات")
        }
        Spacer(Modifier.height(22.dp))
        Button(onClick = onLogout, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) { Text("تسجيل الخروج") }
    }
}

@Composable
private fun PersonRow(name: String, subtitle: String, badge: Int = 0, onClick: () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Panel),
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            AvatarLetter(name)
            Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                Text(name, color = Color.White, fontWeight = FontWeight.Bold)
                Text(subtitle, color = Muted, fontSize = 11.sp, maxLines = 1)
            }
            if (badge > 0) Badge(containerColor = Accent, contentColor = Bg) { Text(badge.toString()) }
        }
    }
}

@Composable
private fun AvatarLetter(name: String) {
    Box(Modifier.size(46.dp).background(Accent.copy(alpha = .15f), CircleShape), contentAlignment = Alignment.Center) {
        Text(name.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "ش", color = Accent, fontSize = 18.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun SectionTitle(text: String) { Text(text, color = Accent, fontWeight = FontWeight.Bold, modifier = Modifier.padding(vertical = 6.dp)) }

@Composable
private fun EmptyState(text: String) { Box(Modifier.fillMaxWidth().padding(28.dp), contentAlignment = Alignment.Center) { Text(text, color = Muted) } }

@Composable
private fun InfoRow(icon: ImageVector, title: String, value: String) {
    Card(colors = CardDefaults.cardColors(containerColor = Panel), modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp)) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = Accent)
            Column(Modifier.padding(start = 12.dp)) { Text(title, color = Color.White, fontWeight = FontWeight.Bold); Text(value, color = Muted, fontSize = 12.sp) }
        }
    }
}

private fun dial(context: android.content.Context, phone: String) {
    runCatching { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(phone)}"))) }
}

private fun openShnoCall(context: android.content.Context, userId: String, type: String) {
    if (userId.isBlank()) return
    val url = "${SHNO_MANO_BASE_URL}messages.html?user=${Uri.encode(userId)}&call=$type"
    context.startActivity(Intent(context, WebCallActivity::class.java).putExtra(WebCallActivity.EXTRA_URL, url))
}
