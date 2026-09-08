package com.shnomano.call

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.ContactsContract
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shnomano.call.data.*
import kotlinx.coroutines.launch

private val AppBg = Color(0xFFF7F8F8)
private val AppGreen = Color(0xFF18A96B)
private val AppDark = Color(0xFF111B21)
private val AppMuted = Color(0xFF667781)
private val AppLine = Color(0xFFE8EAED)
private val BubbleMine = Color(0xFFD9FDD3)

class WhatsAppStyleActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!SessionStore(this).isSignedIn()) {
            startActivity(Intent(this, WelcomeActivity::class.java))
            finish()
            return
        }
        setContent { MaterialTheme { ShnoMessenger() } }
    }
}

private enum class AppTab(val label: String, val icon: ImageVector) {
    CHATS("الدردشات", Icons.Default.ChatBubble),
    CONTACTS("جهات الاتصال", Icons.Default.Groups),
    CALLS("المكالمات", Icons.Default.Call),
    ACCOUNT("حسابي", Icons.Default.Person)
}

private data class DemoPerson(val id: String, val name: String, val subtitle: String, val phone: String, val online: Boolean)

private sealed interface Page {
    data object Home : Page
    data class FriendPage(val friend: FriendDto) : Page
    data class PhonePage(val contact: ContactEntity) : Page
    data class DemoPage(val person: DemoPerson) : Page
    data class ChatPage(val conversation: ConversationDto) : Page
    data class DemoChatPage(val person: DemoPerson) : Page
}

@Composable
private fun ShnoMessenger() {
    val context = LocalContext.current
    val repo = remember { AppRepository(context) }
    var tab by remember { mutableStateOf(AppTab.CHATS) }
    var page by remember { mutableStateOf<Page>(Page.Home) }
    val demos = remember {
        mutableStateListOf(
            DemoPerson("demo-1", "علي حسن", "متصل الآن", "07700000001", true),
            DemoPerson("demo-2", "أم عباس", "تمت المشاهدة قبل 5 د", "07800000002", false),
            DemoPerson("demo-3", "أحمد العبيدي", "رسالة تجريبية من شنو منو", "07500000003", true),
            DemoPerson("demo-4", "ليث الناصري", "آخر ظهور اليوم", "07700000004", false)
        )
    }

    BackHandler(enabled = page !is Page.Home) { page = Page.Home }

    when (val p = page) {
        Page.Home -> MessengerHome(repo, tab, { tab = it }, demos,
            onDemo = { page = Page.DemoPage(it) },
            onDeleteDemo = { demos.remove(it) },
            onFriend = { page = Page.FriendPage(it) },
            onPhone = { page = Page.PhonePage(it) },
            onChat = { page = Page.ChatPage(it) })
        is Page.FriendPage -> FriendDetail(repo, p.friend, { page = Page.Home }) { page = Page.ChatPage(it) }
        is Page.PhonePage -> PhoneDetail(repo, p.contact, { page = Page.Home }) { page = Page.ChatPage(it) }
        is Page.DemoPage -> DemoDetail(p.person, { page = Page.Home }, { page = Page.DemoChatPage(p.person) })
        is Page.ChatPage -> RealChat(repo, p.conversation) { page = Page.Home }
        is Page.DemoChatPage -> DemoChat(p.person) { page = Page.Home }
    }
}

@Composable
private fun MessengerHome(
    repo: AppRepository,
    tab: AppTab,
    onTab: (AppTab) -> Unit,
    demos: List<DemoPerson>,
    onDemo: (DemoPerson) -> Unit,
    onDeleteDemo: (DemoPerson) -> Unit,
    onFriend: (FriendDto) -> Unit,
    onPhone: (ContactEntity) -> Unit,
    onChat: (ConversationDto) -> Unit
) {
    Scaffold(
        containerColor = AppBg,
        topBar = { AppHeader(tab) },
        bottomBar = {
            NavigationBar(containerColor = Color.White, tonalElevation = 1.dp) {
                AppTab.entries.forEach { item ->
                    NavigationBarItem(
                        selected = tab == item,
                        onClick = { onTab(item) },
                        icon = { Icon(item.icon, item.label) },
                        label = { Text(item.label, fontSize = 10.sp) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = AppDark,
                            selectedTextColor = AppDark,
                            indicatorColor = Color(0xFFD9FDD3),
                            unselectedIconColor = AppDark,
                            unselectedTextColor = AppDark
                        )
                    )
                }
            }
        }
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding).background(AppBg)) {
            when (tab) {
                AppTab.CHATS -> ChatsPage(repo, demos, onDemo, onDeleteDemo, onChat)
                AppTab.CONTACTS -> ContactsPage(repo, demos, onDemo, onDeleteDemo, onFriend, onPhone)
                AppTab.CALLS -> CallsPage(repo, demos, onDemo, onDeleteDemo, onFriend)
                AppTab.ACCOUNT -> AccountPage(repo)
            }
        }
    }
}

@Composable
private fun AppHeader(tab: AppTab) {
    Surface(color = Color.White) {
        Column(Modifier.statusBarsPadding()) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("شنو منو", color = AppGreen, fontWeight = FontWeight.ExtraBold, fontSize = 27.sp, modifier = Modifier.weight(1f))
                IconButton(onClick = {}) { Icon(Icons.Default.CameraAlt, "الكاميرا", tint = AppDark) }
                IconButton(onClick = {}) { Icon(Icons.Default.MoreVert, "المزيد", tint = AppDark) }
            }
            if (tab != AppTab.ACCOUNT) Text("${tab.label}", color = AppMuted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 20.dp, vertical = 2.dp))
        }
    }
}

@Composable
private fun SearchBox(value: String, onValue: (String) -> Unit, hint: String) {
    TextField(
        value, onValue,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp),
        leadingIcon = { Icon(Icons.Default.Search, null, tint = AppMuted) },
        placeholder = { Text(hint, color = AppMuted) },
        singleLine = true,
        shape = RoundedCornerShape(28.dp),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = Color(0xFFF0F2F5), unfocusedContainerColor = Color(0xFFF0F2F5),
            focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent
        )
    )
}

@Composable
private fun ChatsPage(repo: AppRepository, demos: List<DemoPerson>, onDemo: (DemoPerson) -> Unit, onDeleteDemo: (DemoPerson) -> Unit, onChat: (ConversationDto) -> Unit) {
    var rows by remember { mutableStateOf<List<ConversationDto>>(emptyList()) }
    var query by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) { rows = repo.loadConversations(); loading = false }
    val filtered = rows.filter { qMatch(query, it.otherUser?.fullName ?: it.otherUser?.username ?: "") }
    Column {
        SearchBox(query, { query = it }, "ابحث في الدردشات")
        if (loading) LinearProgressIndicator(Modifier.fillMaxWidth(), color = AppGreen)
        LazyColumn(Modifier.fillMaxSize()) {
            if (filtered.isNotEmpty()) {
                items(filtered, key = { it.id }) { c ->
                    ConversationRow(c.otherUser?.fullName ?: c.otherUser?.username ?: "محادثة", c.lastMessage?.text ?: "ابدأ المحادثة", c.unreadCount, c.otherUser?.online == true) { onChat(c) }
                }
            } else {
                item { SectionHint("نماذج للتجربة — يمكن حذفها") }
                items(demos, key = { it.id }) { p -> DemoRow(p, onDeleteDemo) { onDemo(p) } }
            }
        }
    }
}

@Composable
private fun ContactsPage(repo: AppRepository, demos: List<DemoPerson>, onDemo: (DemoPerson) -> Unit, onDeleteDemo: (DemoPerson) -> Unit, onFriend: (FriendDto) -> Unit, onPhone: (ContactEntity) -> Unit) {
    val scope = rememberCoroutineScope()
    val contacts by repo.observeContacts().collectAsState(initial = emptyList())
    var friends by remember { mutableStateOf<List<FriendDto>>(emptyList()) }
    var query by remember { mutableStateOf("") }
    var status by remember { mutableStateOf<String?>(null) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val uri = result.data?.data ?: return@rememberLauncherForActivityResult
        scope.launch { repo.importPickedPhone(uri).onSuccess { status = "تمت إضافة ${it.name}" }.onFailure { status = it.message } }
    }
    LaunchedEffect(Unit) { repo.syncContacts(); friends = repo.loadFriends() }
    val ff = friends.filter { qMatch(query, it.displayName) || qMatch(query, it.username ?: "") }
    val fp = contacts.filter { qMatch(query, it.name) || qMatch(query, it.phone) }
    Column {
        SearchBox(query, { query = it }, "ابحث بالاسم أو الرقم")
        FilledTonalButton(
            onClick = { picker.launch(Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI)) },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp),
            colors = ButtonDefaults.filledTonalButtonColors(containerColor = Color(0xFFD9FDD3), contentColor = AppDark)
        ) { Icon(Icons.Default.PersonAdd, null); Spacer(Modifier.width(8.dp)); Text("إضافة جهة اتصال من الهاتف") }
        status?.let { Text(it, color = AppGreen, fontSize = 11.sp, modifier = Modifier.padding(horizontal = 18.dp, vertical = 4.dp)) }
        LazyColumn {
            if (ff.isNotEmpty()) {
                item { SectionHint("أصدقاء شنو منو") }
                items(ff, key = { it.userId }) { f -> PersonRow(f.displayName, "@${f.username ?: ""}", f.online) { onFriend(f) } }
            }
            if (fp.isNotEmpty()) {
                item { SectionHint("جهات الهاتف") }
                items(fp, key = { it.phone }) { p -> PersonRow(p.name, p.phone, false) { onPhone(p) } }
            }
            if (ff.isEmpty() && fp.isEmpty()) {
                item { SectionHint("نماذج للتجربة — يمكن حذفها") }
                items(demos, key = { it.id }) { p -> DemoRow(p, onDeleteDemo) { onDemo(p) } }
            }
        }
    }
}

@Composable
private fun CallsPage(repo: AppRepository, demos: List<DemoPerson>, onDemo: (DemoPerson) -> Unit, onDeleteDemo: (DemoPerson) -> Unit, onFriend: (FriendDto) -> Unit) {
    var friends by remember { mutableStateOf<List<FriendDto>>(emptyList()) }
    var query by remember { mutableStateOf("") }
    LaunchedEffect(Unit) { friends = repo.loadFriends() }
    val filtered = friends.filter { qMatch(query, it.displayName) }
    Column {
        SearchBox(query, { query = it }, "ابحث للاتصال")
        LazyColumn {
            if (filtered.isNotEmpty()) items(filtered, key = { it.userId }) { f -> PersonRow(f.displayName, if (f.online) "متصل الآن" else "صديق شنو منو", f.online) { onFriend(f) } }
            else {
                item { SectionHint("نماذج اتصال للتجربة — يمكن حذفها") }
                items(demos, key = { it.id }) { p -> DemoRow(p, onDeleteDemo) { onDemo(p) } }
            }
        }
    }
}

@Composable
private fun FriendDetail(repo: AppRepository, friend: FriendDto, onBack: () -> Unit, onChat: (ConversationDto) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var error by remember { mutableStateOf<String?>(null) }
    PersonShell(friend.displayName, if (friend.online) "متصل الآن" else "@${friend.username ?: ""}", onBack,
        onAudio = { openRealCall(context, friend.userId, "audio") },
        onVideo = { openRealCall(context, friend.userId, "video") }) {
        Button(onClick = { scope.launch { repo.openConversation(friend.userId).onSuccess(onChat).onFailure { error = it.message } } }, colors = ButtonDefaults.buttonColors(containerColor = AppGreen), modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.ChatBubble, null); Spacer(Modifier.width(8.dp)); Text("فتح الدردشة") }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
    }
}

@Composable
private fun PhoneDetail(repo: AppRepository, contact: ContactEntity, onBack: () -> Unit, onChat: (ConversationDto) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    PersonShell(contact.name, contact.phone, onBack,
        onAudio = { if (!contact.linkedUserId.isNullOrBlank()) openRealCall(context, contact.linkedUserId!!, "audio") else dial(context, contact.phone) },
        onVideo = { if (!contact.linkedUserId.isNullOrBlank()) openRealCall(context, contact.linkedUserId!!, "video") }) {
        if (!contact.linkedUserId.isNullOrBlank()) Button(onClick = { scope.launch { repo.openConversation(contact.linkedUserId!!).onSuccess(onChat) } }, colors = ButtonDefaults.buttonColors(containerColor = AppGreen), modifier = Modifier.fillMaxWidth()) { Text("فتح دردشة شنو منو") }
        else Button(onClick = { dial(context, contact.phone) }, colors = ButtonDefaults.buttonColors(containerColor = AppGreen), modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.Phone, null); Spacer(Modifier.width(8.dp)); Text("اتصال هاتفي") }
    }
}

@Composable
private fun DemoDetail(person: DemoPerson, onBack: () -> Unit, onChat: () -> Unit) {
    PersonShell(person.name, person.subtitle, onBack, onAudio = {}, onVideo = {}) {
        Button(onClick = onChat, colors = ButtonDefaults.buttonColors(containerColor = AppGreen), modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.ChatBubble, null); Spacer(Modifier.width(8.dp)); Text("فتح الدردشة التجريبية") }
        Text("هذا شخص تجريبي لعرض التصميم فقط، ويمكن حذفه من القوائم.", color = AppMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 12.dp))
    }
}

@Composable
private fun PersonShell(name: String, subtitle: String, onBack: () -> Unit, onAudio: () -> Unit, onVideo: () -> Unit, body: @Composable ColumnScope.() -> Unit) {
    Scaffold(containerColor = AppBg, topBar = {
        Surface(color = Color.White) {
            Row(Modifier.fillMaxWidth().statusBarsPadding().padding(vertical = 5.dp, horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "رجوع", tint = AppDark) }
                Avatar(name, 42.dp, 16.sp)
                Column(Modifier.padding(start = 10.dp).weight(1f)) { Text(name, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = AppDark); Text(subtitle, color = AppMuted, fontSize = 11.sp) }
                IconButton(onClick = onAudio) { Icon(Icons.Default.Call, "مكالمة صوتية", tint = AppDark) }
                IconButton(onClick = onVideo) { Icon(Icons.Default.Videocam, "مكالمة فيديو", tint = AppDark) }
            }
        }
    }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Spacer(Modifier.height(18.dp)); Avatar(name, 108.dp, 38.sp); Spacer(Modifier.height(12.dp))
            Text(name, color = AppDark, fontWeight = FontWeight.ExtraBold, fontSize = 25.sp)
            Text(subtitle, color = AppMuted, fontSize = 13.sp)
            Spacer(Modifier.height(24.dp)); body()
        }
    }
}

@Composable
private fun RealChat(repo: AppRepository, conversation: ConversationDto, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val other = conversation.otherUser
    var messages by remember { mutableStateOf<List<MessageDto>>(emptyList()) }
    var text by remember { mutableStateOf("") }
    LaunchedEffect(conversation.id) { repo.loadMessages(conversation.id).onSuccess { messages = it } }
    ChatShell(other?.fullName ?: other?.username ?: "محادثة", other?.online == true, onBack,
        onAudio = { other?.id?.let { openRealCall(context, it, "audio") } },
        onVideo = { other?.id?.let { openRealCall(context, it, "video") } },
        input = text, onInput = { text = it }, onSend = {
            val out = text.trim(); if (out.isBlank()) return@ChatShell; text = ""
            scope.launch { repo.sendMessage(conversation.id, out).onSuccess { messages = messages + it }.onFailure { text = out } }
        }) {
        items(messages, key = { it.messageId.ifBlank { "${it.createdAt}-${it.text}" } }) { m -> MessageBubble(m.text.orEmpty(), m.mine, if (m.localState == "pending") "قيد الإرسال" else "") }
    }
}

@Composable
private fun DemoChat(person: DemoPerson, onBack: () -> Unit) {
    var text by remember { mutableStateOf("") }
    val messages = remember { mutableStateListOf(Pair("مرحبا، هذه دردشة تجريبية لعرض التصميم.", false), Pair("ممتاز، هكذا نريد صفحة الشخص والدردشة.", true)) }
    ChatShell(person.name, person.online, onBack, onAudio = {}, onVideo = {}, input = text, onInput = { text = it }, onSend = { val out = text.trim(); if (out.isNotBlank()) { messages.add(out to true); text = "" } }) {
        items(messages) { m -> MessageBubble(m.first, m.second, "") }
    }
}

@Composable
private fun ChatShell(name: String, online: Boolean, onBack: () -> Unit, onAudio: () -> Unit, onVideo: () -> Unit, input: String, onInput: (String) -> Unit, onSend: () -> Unit, messages: LazyListScope.() -> Unit) {
    Scaffold(containerColor = Color(0xFFF2EFEA), topBar = {
        Surface(color = Color.White) {
            Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 4.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "رجوع", tint = AppDark) }
                Avatar(name, 40.dp, 15.sp)
                Column(Modifier.padding(start = 9.dp).weight(1f)) { Text(name, fontWeight = FontWeight.Bold, color = AppDark, fontSize = 17.sp); Text(if (online) "متصل الآن" else "شنو منو", color = AppMuted, fontSize = 10.sp) }
                IconButton(onClick = onAudio) { Icon(Icons.Default.Call, "صوت", tint = AppDark) }
                IconButton(onClick = onVideo) { Icon(Icons.Default.Videocam, "فيديو", tint = AppDark) }
            }
        }
    }, bottomBar = {
        Row(Modifier.fillMaxWidth().navigationBarsPadding().background(Color.White).padding(7.dp), verticalAlignment = Alignment.CenterVertically) {
            TextField(input, onInput, Modifier.weight(1f), placeholder = { Text("رسالة") }, leadingIcon = { Icon(Icons.Default.AttachFile, null) }, trailingIcon = { Icon(Icons.Default.CameraAlt, null) }, singleLine = true, shape = RoundedCornerShape(28.dp), colors = TextFieldDefaults.colors(focusedContainerColor = Color(0xFFF0F2F5), unfocusedContainerColor = Color(0xFFF0F2F5), focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent))
            Spacer(Modifier.width(6.dp)); FilledIconButton(onClick = onSend, colors = IconButtonDefaults.filledIconButtonColors(containerColor = AppGreen)) { Icon(Icons.Default.Send, "إرسال", tint = Color.White) }
        }
    }) { padding -> LazyColumn(Modifier.fillMaxSize().padding(padding).padding(horizontal = 10.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp), content = messages) }
}

@Composable
private fun MessageBubble(text: String, mine: Boolean, state: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start) {
        Surface(color = if (mine) BubbleMine else Color.White, shape = RoundedCornerShape(11.dp), shadowElevation = 1.dp) {
            Column(Modifier.widthIn(max = 310.dp).padding(horizontal = 10.dp, vertical = 7.dp)) { Text(text, color = AppDark, fontSize = 15.sp); if (state.isNotBlank()) Text(state, color = AppMuted, fontSize = 9.sp, modifier = Modifier.align(Alignment.End)) }
        }
    }
}

@Composable
private fun ConversationRow(name: String, subtitle: String, unread: Int, online: Boolean, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Avatar(name, 56.dp, 20.sp); Column(Modifier.padding(start = 12.dp).weight(1f)) { Text(name, color = AppDark, fontWeight = FontWeight.Bold, fontSize = 17.sp); Text(subtitle, color = AppMuted, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis) }
        Column(horizontalAlignment = Alignment.End) { Text(if (online) "الآن" else "", color = AppGreen, fontSize = 10.sp); if (unread > 0) Badge(containerColor = AppGreen) { Text(unread.toString()) } }
    }; HorizontalDivider(color = AppLine, modifier = Modifier.padding(start = 82.dp))
}

@Composable
private fun PersonRow(name: String, subtitle: String, online: Boolean, onClick: () -> Unit) {
    ConversationRow(name, subtitle, 0, online, onClick)
}

@Composable
private fun DemoRow(person: DemoPerson, onDelete: (DemoPerson) -> Unit, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Row(Modifier.weight(1f).clickable(onClick = onClick), verticalAlignment = Alignment.CenterVertically) { Avatar(person.name, 56.dp, 20.sp); Column(Modifier.padding(start = 12.dp)) { Text(person.name, color = AppDark, fontWeight = FontWeight.Bold, fontSize = 17.sp); Text(person.subtitle, color = AppMuted, fontSize = 13.sp) } }
        IconButton(onClick = { onDelete(person) }) { Icon(Icons.Default.DeleteOutline, "حذف النموذج", tint = AppMuted) }
    }; HorizontalDivider(color = AppLine, modifier = Modifier.padding(start = 82.dp))
}

@Composable
private fun Avatar(name: String, size: androidx.compose.ui.unit.Dp, font: androidx.compose.ui.unit.TextUnit) {
    Box(Modifier.size(size).background(Color(0xFFE1F3EA), CircleShape), contentAlignment = Alignment.Center) { Text(name.trim().firstOrNull()?.toString() ?: "ش", color = AppGreen, fontWeight = FontWeight.Bold, fontSize = font) }
}

@Composable private fun SectionHint(text: String) { Text(text, color = AppGreen, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 18.dp, vertical = 9.dp)) }

@Composable
private fun AccountPage(repo: AppRepository) {
    val context = LocalContext.current
    Column(Modifier.fillMaxSize().padding(18.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) { Avatar(repo.session.fullName ?: repo.session.username ?: "ش", 72.dp, 26.sp); Column(Modifier.padding(start = 14.dp)) { Text(repo.session.fullName ?: "حساب شنو منو", color = AppDark, fontWeight = FontWeight.Bold, fontSize = 20.sp); Text("@${repo.session.username ?: ""}", color = AppMuted) } }
        Spacer(Modifier.height(24.dp)); AccountRow(Icons.Default.Settings, "الإعدادات والرنين والإشعارات") { context.startActivity(Intent(context, SettingsActivity::class.java)) }
        AccountRow(Icons.Default.Storefront, "مول العراق") { openSection(context, "mall.html") }
        AccountRow(Icons.Default.PlayCircle, "الريلز") { openSection(context, "reels.html") }
        AccountRow(Icons.Default.Handyman, "الخدمات") { openSection(context, "services.html") }
        AccountRow(Icons.Default.Logout, "تسجيل الخروج") { repo.signOut(); context.startActivity(Intent(context, WelcomeActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)) }
    }
}

@Composable private fun AccountRow(icon: ImageVector, title: String, onClick: () -> Unit) { Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 15.dp), verticalAlignment = Alignment.CenterVertically) { Icon(icon, null, tint = AppGreen); Text(title, color = AppDark, modifier = Modifier.padding(start = 16.dp).weight(1f), fontWeight = FontWeight.Medium); Icon(Icons.Default.ChevronLeft, null, tint = AppMuted) }; HorizontalDivider(color = AppLine) }

private fun qMatch(q: String, text: String) = q.isBlank() || text.contains(q, true)
private fun openRealCall(context: Context, userId: String, type: String) { if (userId.isBlank()) return; val url = "https://shino-mino-tak-tak.duckdns.org/messages.html?user=${Uri.encode(userId)}&prepare=$type"; context.startActivity(Intent(context, WebCallActivity::class.java).putExtra(WebCallActivity.EXTRA_URL, url)) }
private fun dial(context: Context, phone: String) { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(phone)}"))) }
private fun openSection(context: Context, page: String) { context.startActivity(Intent(context, WebSectionActivity::class.java).putExtra(WebSectionActivity.EXTRA_URL, WebSectionActivity.BASE + page)) }
