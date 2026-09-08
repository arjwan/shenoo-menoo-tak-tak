package com.shnomano.call

import android.content.Context
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shnomano.call.data.*
import kotlinx.coroutines.launch

private val NativeNight = Color(0xFF06110E)
private val NativeTop = Color(0xFF0A1713)
private val NativePanel = Color(0xFF10201B)
private val NativeGreen = Color(0xFF22C78A)
private val NativeAqua = Color(0xFF43E0BE)
private val NativeMuted = Color(0xFF91A39D)
private val NativeLine = Color(0xFF203A33)

class NativeMainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!SessionStore(this).isSignedIn()) {
            startActivity(Intent(this, WelcomeActivity::class.java))
            finish()
            return
        }
        setContent { ShnoManoTheme { NativeShnoManoApp() } }
    }
}

private enum class NativeTab(val title: String, val icon: ImageVector) {
    CHATS("الدردشات", Icons.Default.ChatBubble),
    CONTACTS("جهات الاتصال", Icons.Default.Contacts),
    CALLS("المكالمات", Icons.Default.Call),
    ACCOUNT("حسابي", Icons.Default.Person)
}

private sealed interface NativeScreen {
    data object Home : NativeScreen
    data class Friend(val friend: FriendDto) : NativeScreen
    data class Phone(val contact: ContactEntity) : NativeScreen
    data class Chat(val conversation: ConversationDto) : NativeScreen
}

@Composable
private fun NativeShnoManoApp() {
    val context = LocalContext.current
    val repo = remember { AppRepository(context) }
    var tab by remember { mutableStateOf(NativeTab.CHATS) }
    var screen by remember { mutableStateOf<NativeScreen>(NativeScreen.Home) }

    when (val current = screen) {
        NativeScreen.Home -> NativeHome(repo, tab, { tab = it }, { screen = NativeScreen.Friend(it) }, { screen = NativeScreen.Phone(it) }, { screen = NativeScreen.Chat(it) })
        is NativeScreen.Friend -> NativeFriendProfile(repo, current.friend, { screen = NativeScreen.Home }, { screen = NativeScreen.Chat(it) })
        is NativeScreen.Phone -> NativePhoneProfile(repo, current.contact, { screen = NativeScreen.Home }, { screen = NativeScreen.Chat(it) })
        is NativeScreen.Chat -> NativeChat(repo, current.conversation) { screen = NativeScreen.Home }
    }
}

@Composable
private fun NativeHome(
    repo: AppRepository,
    tab: NativeTab,
    onTab: (NativeTab) -> Unit,
    onFriend: (FriendDto) -> Unit,
    onPhone: (ContactEntity) -> Unit,
    onChat: (ConversationDto) -> Unit
) {
    Scaffold(
        containerColor = NativeNight,
        topBar = { NativeTopBar(tab.title) },
        bottomBar = {
            NavigationBar(containerColor = Color(0xFF081612), tonalElevation = 0.dp) {
                NativeTab.entries.forEach { item ->
                    NavigationBarItem(
                        selected = tab == item,
                        onClick = { onTab(item) },
                        icon = { Icon(item.icon, item.title) },
                        label = { Text(item.title, fontSize = 10.sp) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = NativeGreen,
                            selectedTextColor = NativeGreen,
                            indicatorColor = Color(0x3322C78A),
                            unselectedIconColor = NativeMuted,
                            unselectedTextColor = NativeMuted
                        )
                    )
                }
            }
        }
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding).background(Brush.verticalGradient(listOf(Color(0xFF0A1713), NativeNight)))) {
            when (tab) {
                NativeTab.CHATS -> NativeChats(repo, onChat)
                NativeTab.CONTACTS -> NativeContacts(repo, onFriend, onPhone)
                NativeTab.CALLS -> NativeCalls(repo, onFriend)
                NativeTab.ACCOUNT -> NativeAccount(repo)
            }
        }
    }
}

@Composable
private fun NativeTopBar(section: String) {
    Surface(color = NativeTop) {
        Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 15.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(43.dp).background(Brush.linearGradient(listOf(Color(0xFF0D9866), NativeAqua)), CircleShape), contentAlignment = Alignment.Center) {
                Text("ش", color = Color.White, fontWeight = FontWeight.Black, fontSize = 21.sp)
            }
            Column(Modifier.padding(start = 11.dp).weight(1f)) {
                Text("شنو منو اتصال", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 19.sp)
                Text(section, color = NativeMuted, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun NativeChats(repo: AppRepository, onChat: (ConversationDto) -> Unit) {
    var rows by remember { mutableStateOf<List<ConversationDto>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var query by remember { mutableStateOf("") }
    LaunchedEffect(Unit) { rows = repo.loadConversations(); loading = false }
    val filtered = rows.filter {
        val name = it.otherUser?.fullName ?: it.otherUser?.username ?: ""
        query.isBlank() || name.contains(query, true)
    }
    Column(Modifier.fillMaxSize().padding(horizontal = 14.dp)) {
        NativeSearch(query, { query = it }, "ابحث في الدردشات")
        Spacer(Modifier.height(8.dp))
        when {
            loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = NativeGreen) }
            filtered.isEmpty() -> NativeEmpty("💬", "لا توجد محادثات بعد", "افتح جهة اتصال أو صديقاً وابدأ المحادثة")
            else -> LazyColumn { items(filtered, key = { it.id }) { c ->
                val other = c.otherUser
                NativePersonRow(
                    other?.fullName ?: other?.username ?: "محادثة",
                    c.lastMessage?.text?.ifBlank { "رسالة" } ?: "ابدأ المحادثة",
                    other?.online == true,
                    c.unreadCount,
                    { onChat(c) }
                )
            } }
        }
    }
}

@Composable
private fun NativeContacts(repo: AppRepository, onFriend: (FriendDto) -> Unit, onPhone: (ContactEntity) -> Unit) {
    val scope = rememberCoroutineScope()
    val contacts by repo.observeContacts().collectAsState(initial = emptyList())
    var friends by remember { mutableStateOf<List<FriendDto>>(emptyList()) }
    var query by remember { mutableStateOf("") }
    var status by remember { mutableStateOf<String?>(null) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val uri = result.data?.data ?: return@rememberLauncherForActivityResult
        scope.launch {
            repo.importPickedPhone(uri).onSuccess { status = "تم حفظ ${it.name}" }.onFailure { status = it.message }
        }
    }
    LaunchedEffect(Unit) { repo.syncContacts(); friends = repo.loadFriends() }
    val ff = friends.filter { query.isBlank() || it.displayName.contains(query, true) || (it.username ?: "").contains(query, true) }
    val fp = contacts.filter { query.isBlank() || it.name.contains(query, true) || it.phone.contains(query) }
    Column(Modifier.fillMaxSize().padding(horizontal = 14.dp)) {
        NativeSearch(query, { query = it }, "ابحث عن شخص أو رقم")
        Spacer(Modifier.height(7.dp))
        FilledTonalButton(
            onClick = { picker.launch(Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI)) },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.filledTonalButtonColors(containerColor = Color(0x3322C78A), contentColor = NativeGreen)
        ) {
            Icon(Icons.Default.PersonAdd, null)
            Spacer(Modifier.width(8.dp))
            Text("إضافة جهة اتصال من الهاتف")
        }
        status?.let { Text(it, color = NativeAqua, fontSize = 11.sp, modifier = Modifier.padding(top = 5.dp)) }
        LazyColumn {
            if (ff.isNotEmpty()) {
                item { NativeSection("أصدقاء شنو منو") }
                items(ff, key = { "friend-${it.userId}" }) { f -> NativePersonRow(f.displayName, "@${f.username ?: ""}", f.online, 0) { onFriend(f) } }
            }
            if (fp.isNotEmpty()) {
                item { NativeSection("جهات الهاتف المحفوظة") }
                items(fp, key = { "phone-${it.phone}" }) { p -> NativePersonRow(p.name, p.phone, false, 0) { onPhone(p) } }
            }
            if (ff.isEmpty() && fp.isEmpty()) item { NativeEmpty("👥", "لا توجد جهات", "أضف جهة من هاتفك أو أضف صديقاً في شنو منو") }
        }
    }
}

@Composable
private fun NativeCalls(repo: AppRepository, onFriend: (FriendDto) -> Unit) {
    var friends by remember { mutableStateOf<List<FriendDto>>(emptyList()) }
    var query by remember { mutableStateOf("") }
    LaunchedEffect(Unit) { friends = repo.loadFriends() }
    val filtered = friends.filter { query.isBlank() || it.displayName.contains(query, true) }
    Column(Modifier.fillMaxSize().padding(horizontal = 14.dp)) {
        NativeSearch(query, { query = it }, "ابحث للاتصال")
        Spacer(Modifier.height(10.dp))
        Text("اضغط على الشخص لفتح صفحته ثم اختر صوت أو فيديو", color = NativeMuted, fontSize = 12.sp)
        Spacer(Modifier.height(6.dp))
        if (filtered.isEmpty()) NativeEmpty("☎️", "لا يوجد أصدقاء للاتصال", "تظهر هنا الحسابات بعد قبول طلب الصداقة")
        else LazyColumn { items(filtered, key = { it.userId }) { f -> NativePersonRow(f.displayName, if (f.online) "متصل الآن" else "صديق شنو منو", f.online, 0) { onFriend(f) } } }
    }
}

@Composable
private fun NativeFriendProfile(repo: AppRepository, friend: FriendDto, onBack: () -> Unit, onChat: (ConversationDto) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    NativeProfileShell(friend.displayName, if (friend.online) "متصل الآن" else "@${friend.username ?: ""}", friend.online, onBack) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            NativeBigAction("رسالة", Icons.Default.ChatBubble, Modifier.weight(1f)) {
                if (busy || friend.userId.isBlank()) return@NativeBigAction
                busy = true
                scope.launch { repo.openConversation(friend.userId).onSuccess(onChat).onFailure { error = it.message }; busy = false }
            }
            NativeBigAction("صوت", Icons.Default.Call, Modifier.weight(1f)) { nativeOpenCall(context, friend.userId, "audio") }
            NativeBigAction("فيديو", Icons.Default.Videocam, Modifier.weight(1f)) { nativeOpenCall(context, friend.userId, "video") }
        }
        error?.let { Text(it ?: "تعذر فتح المحادثة", color = MaterialTheme.colorScheme.error, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp)) }
        Spacer(Modifier.height(18.dp))
        NativeInfo("حساب شنو منو", "صفحة مستقلة للصديق: المحادثة والاتصال الصوتي والفيديو من نفس المكان.")
    }
}

@Composable
private fun NativePhoneProfile(repo: AppRepository, contact: ContactEntity, onBack: () -> Unit, onChat: (ConversationDto) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var error by remember { mutableStateOf<String?>(null) }
    NativeProfileShell(contact.name, contact.phone, false, onBack) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            NativeBigAction("هاتف", Icons.Default.Phone, Modifier.weight(1f)) { nativeDial(context, contact.phone) }
            NativeBigAction("واتساب", Icons.Default.Chat, Modifier.weight(1f)) { nativeWhatsApp(context, contact.phone) }
        }
        if (!contact.linkedUserId.isNullOrBlank()) {
            Spacer(Modifier.height(14.dp))
            Text("الرقم مرتبط بحساب شنو منو", color = NativeAqua, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            Spacer(Modifier.height(9.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                NativeBigAction("رسالة", Icons.Default.ChatBubble, Modifier.weight(1f)) {
                    scope.launch { repo.openConversation(contact.linkedUserId!!).onSuccess(onChat).onFailure { error = it.message } }
                }
                NativeBigAction("صوت", Icons.Default.Call, Modifier.weight(1f)) { nativeOpenCall(context, contact.linkedUserId!!, "audio") }
                NativeBigAction("فيديو", Icons.Default.Videocam, Modifier.weight(1f)) { nativeOpenCall(context, contact.linkedUserId!!, "video") }
            }
        } else {
            Spacer(Modifier.height(16.dp))
            NativeInfo("جهة هاتف", "يمكن الاتصال بها حتى إن لم تكن مسجلة في شنو منو. اتصال شنو منو يظهر عندما يرتبط الرقم بحساب وصداقة مقبولة.")
        }
        error?.let { Text(it ?: "تعذر فتح المحادثة", color = MaterialTheme.colorScheme.error, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp)) }
    }
}

@Composable
private fun NativeProfileShell(name: String, subtitle: String, online: Boolean, onBack: () -> Unit, body: @Composable ColumnScope.() -> Unit) {
    Scaffold(containerColor = NativeNight, topBar = {
        Surface(color = NativeTop) {
            Row(Modifier.fillMaxWidth().statusBarsPadding().padding(7.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "رجوع", tint = Color.White) }
                Text("صفحة الشخص", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 17.sp)
            }
        }
    }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            NativeAvatar(name, 94.dp, 34.sp)
            Spacer(Modifier.height(13.dp))
            Text(name, color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 24.sp)
            Text(subtitle, color = if (online) NativeGreen else NativeMuted, fontSize = 13.sp)
            Spacer(Modifier.height(24.dp))
            body()
        }
    }
}

@Composable
private fun NativeChat(repo: AppRepository, conversation: ConversationDto, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val other = conversation.otherUser
    var messages by remember { mutableStateOf<List<MessageDto>>(emptyList()) }
    var text by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(conversation.id) { repo.loadMessages(conversation.id).onSuccess { messages = it }.onFailure { error = it.message } }
    Scaffold(
        containerColor = NativeNight,
        topBar = {
            Surface(color = NativeTop) {
                Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 5.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "رجوع", tint = Color.White) }
                    NativeAvatar(other?.fullName ?: other?.username ?: "ش", 38.dp, 16.sp)
                    Column(Modifier.padding(start = 8.dp).weight(1f)) {
                        Text(other?.fullName ?: other?.username ?: "محادثة", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text(if (other?.online == true) "متصل الآن" else "شنو منو", color = if (other?.online == true) NativeGreen else NativeMuted, fontSize = 10.sp)
                    }
                    if (!other?.id.isNullOrBlank()) {
                        IconButton(onClick = { nativeOpenCall(context, other!!.id, "audio") }) { Icon(Icons.Default.Call, "صوت", tint = NativeGreen) }
                        IconButton(onClick = { nativeOpenCall(context, other!!.id, "video") }) { Icon(Icons.Default.Videocam, "فيديو", tint = NativeGreen) }
                    }
                }
            }
        },
        bottomBar = {
            Column(Modifier.navigationBarsPadding().background(NativeTop)) {
                error?.let { Text(it ?: "", color = MaterialTheme.colorScheme.error, fontSize = 11.sp, modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp)) }
                Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    TextField(
                        text,
                        { text = it },
                        Modifier.weight(1f),
                        placeholder = { Text("اكتب رسالة…") },
                        singleLine = true,
                        shape = RoundedCornerShape(24.dp),
                        colors = TextFieldDefaults.colors(focusedContainerColor = NativePanel, unfocusedContainerColor = NativePanel, focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent)
                    )
                    Spacer(Modifier.width(6.dp))
                    FilledIconButton(
                        onClick = {
                            if (text.isBlank() || busy) return@FilledIconButton
                            val outgoing = text
                            text = ""
                            busy = true
                            scope.launch {
                                repo.sendMessage(conversation.id, outgoing).onSuccess { messages = messages + it }.onFailure { error = it.message; text = outgoing }
                                busy = false
                            }
                        },
                        colors = IconButtonDefaults.filledIconButtonColors(containerColor = NativeGreen)
                    ) { Icon(Icons.Default.Send, "إرسال", tint = Color(0xFF04100C)) }
                }
            }
        }
    ) { padding ->
        if (messages.isEmpty()) Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { Text("ابدأ المحادثة", color = NativeMuted) }
        else LazyColumn(Modifier.fillMaxSize().padding(padding).padding(horizontal = 10.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            items(messages, key = { it.messageId.ifBlank { "${it.createdAt}-${it.text}" } }) { m ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = if (m.mine) Arrangement.End else Arrangement.Start) {
                    Surface(color = if (m.mine) Color(0xFF176B51) else NativePanel, shape = RoundedCornerShape(16.dp)) {
                        Column(Modifier.widthIn(max = 300.dp).padding(horizontal = 11.dp, vertical = 8.dp)) {
                            Text(m.text.orEmpty(), color = Color.White, fontSize = 14.sp)
                            if (m.localState == "pending") Text("قيد الإرسال", color = NativeMuted, fontSize = 9.sp, modifier = Modifier.align(Alignment.End))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NativeAccount(repo: AppRepository) {
    val context = LocalContext.current
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            NativeAvatar(repo.session.fullName ?: repo.session.username ?: "ش", 66.dp, 25.sp)
            Column(Modifier.padding(start = 13.dp).weight(1f)) {
                Text(repo.session.fullName ?: "حساب شنو منو", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text("@${repo.session.username ?: ""}", color = NativeMuted, fontSize = 12.sp)
            }
        }
        Spacer(Modifier.height(18.dp))
        NativeAccountRow(Icons.Default.Settings, "الإعدادات والرنين والإشعارات") { context.startActivity(Intent(context, SettingsActivity::class.java)) }
        NativeAccountEmoji("🛍️", "مول العراق") { nativeOpenSection(context, "mall.html") }
        NativeAccountEmoji("🎬", "الريلز") { nativeOpenSection(context, "reels.html") }
        NativeAccountEmoji("🧰", "الخدمات") { nativeOpenSection(context, "services.html") }
        NativeAccountRow(Icons.Default.Logout, "تسجيل الخروج", true) {
            repo.signOut()
            context.startActivity(Intent(context, WelcomeActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
        }
        Spacer(Modifier.height(18.dp))
        Text("حساب واحد للويب ولكل شنو منو", color = NativeMuted, fontSize = 11.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun NativeSearch(value: String, onValue: (String) -> Unit, hint: String) {
    TextField(value, onValue, Modifier.fillMaxWidth(), placeholder = { Text(hint) }, leadingIcon = { Icon(Icons.Default.Search, null) }, singleLine = true, shape = RoundedCornerShape(22.dp), colors = TextFieldDefaults.colors(focusedContainerColor = NativePanel, unfocusedContainerColor = NativePanel, focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent))
}

@Composable
private fun NativePersonRow(name: String, subtitle: String, online: Boolean, badge: Int, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 10.dp, horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Box {
            NativeAvatar(name, 50.dp, 19.sp)
            if (online) Box(Modifier.size(12.dp).align(Alignment.BottomEnd).background(NativeGreen, CircleShape))
        }
        Column(Modifier.padding(start = 12.dp).weight(1f)) {
            Text(name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            Text(subtitle, color = if (online) NativeGreen else NativeMuted, fontSize = 11.sp, maxLines = 1)
        }
        if (badge > 0) Badge(containerColor = NativeGreen, contentColor = Color(0xFF04100C)) { Text(badge.toString()) }
        else Icon(Icons.Default.ChevronLeft, null, tint = NativeMuted)
    }
    HorizontalDivider(color = NativeLine.copy(alpha = 0.55f), thickness = 0.5.dp)
}

@Composable
private fun NativeAvatar(name: String, size: androidx.compose.ui.unit.Dp, font: androidx.compose.ui.unit.TextUnit) {
    Box(Modifier.size(size).background(Brush.linearGradient(listOf(Color(0xFF197351), Color(0xFF25B984))), CircleShape), contentAlignment = Alignment.Center) {
        Text(name.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "ش", color = Color.White, fontWeight = FontWeight.Bold, fontSize = font)
    }
}

@Composable
private fun NativeBigAction(text: String, icon: ImageVector, modifier: Modifier = Modifier, onClick: () -> Unit) {
    OutlinedButton(onClick = onClick, modifier = modifier.height(76.dp), shape = RoundedCornerShape(18.dp), colors = ButtonDefaults.outlinedButtonColors(contentColor = NativeGreen)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(icon, null)
            Spacer(Modifier.height(5.dp))
            Text(text, fontSize = 11.sp, maxLines = 1)
        }
    }
}

@Composable
private fun NativeInfo(title: String, body: String) {
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = NativePanel)) {
        Column(Modifier.padding(16.dp)) {
            Text(title, color = Color.White, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(5.dp))
            Text(body, color = NativeMuted, fontSize = 12.sp, lineHeight = 18.sp)
        }
    }
}

@Composable
private fun NativeAccountRow(icon: ImageVector, title: String, destructive: Boolean = false, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(42.dp).background(if (destructive) Color(0x33C43B4D) else Color(0x3322C78A), CircleShape), contentAlignment = Alignment.Center) { Icon(icon, null, tint = if (destructive) Color(0xFFFF7B88) else NativeGreen) }
        Text(title, color = if (destructive) Color(0xFFFF8C97) else Color.White, fontWeight = FontWeight.Medium, modifier = Modifier.padding(start = 12.dp).weight(1f))
        Icon(Icons.Default.ChevronLeft, null, tint = NativeMuted)
    }
    HorizontalDivider(color = NativeLine.copy(alpha = 0.6f), thickness = 0.5.dp)
}

@Composable
private fun NativeAccountEmoji(icon: String, title: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(42.dp).background(Color(0x3322C78A), CircleShape), contentAlignment = Alignment.Center) { Text(icon, fontSize = 20.sp) }
        Text(title, color = Color.White, fontWeight = FontWeight.Medium, modifier = Modifier.padding(start = 12.dp).weight(1f))
        Icon(Icons.Default.ChevronLeft, null, tint = NativeMuted)
    }
    HorizontalDivider(color = NativeLine.copy(alpha = 0.6f), thickness = 0.5.dp)
}

@Composable
private fun NativeSection(text: String) { Text(text, color = NativeAqua, fontWeight = FontWeight.Bold, fontSize = 12.sp, modifier = Modifier.padding(top = 12.dp, bottom = 5.dp)) }

@Composable
private fun NativeEmpty(icon: String, title: String, subtitle: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 44.dp, horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(icon, fontSize = 38.sp)
        Spacer(Modifier.height(9.dp))
        Text(title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 17.sp)
        Spacer(Modifier.height(4.dp))
        Text(subtitle, color = NativeMuted, fontSize = 12.sp, textAlign = TextAlign.Center)
    }
}

private fun nativeOpenCall(context: Context, userId: String, type: String) {
    if (userId.isBlank()) return
    val url = "https://shino-mino-tak-tak.duckdns.org/messages.html?user=${Uri.encode(userId)}&prepare=$type"
    context.startActivity(Intent(context, WebCallActivity::class.java).putExtra(WebCallActivity.EXTRA_URL, url))
}

private fun nativeDial(context: Context, phone: String) {
    context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(phone)}")))
}

private fun nativeWhatsApp(context: Context, phone: String) {
    val normalized = AppRepository.normalizeIraqiPhone(phone)
    val international = if (normalized.startsWith("0")) "964${normalized.drop(1)}" else normalized
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$international"))) }
}

private fun nativeOpenSection(context: Context, page: String) {
    context.startActivity(Intent(context, WebSectionActivity::class.java).putExtra(WebSectionActivity.EXTRA_URL, WebSectionActivity.BASE + page))
}
