package com.shnomano.call

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Bg = Color(0xFF03110F)
private val Bg2 = Color(0xFF061B18)
private val Card = Color(0xFF102723)
private val Card2 = Color(0xFF16332E)
private val Accent = Color(0xFF18E0B5)
private val Accent2 = Color(0xFF3CF2CE)
private val TextMuted = Color(0xFF95ABA6)
private val Danger = Color(0xFFFF4B4B)

class NativeMainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ShnoManoTheme { ShnoApp() } }
    }
}

private data class Person(val id:String,val name:String,val status:String,val unread:Int=0,val online:Boolean=false,val last:String="")
private enum class MainTab(val title:String,val icon:ImageVector){ CHATS("الدردشات",Icons.Default.ChatBubble), CALLS("المكالمات",Icons.Default.Call), COMMUNITY("المجتمع",Icons.Default.Groups), SETTINGS("الإعدادات",Icons.Default.Settings) }
private sealed interface Screen { data object Login:Screen; data object Home:Screen; data class Chat(val p:Person):Screen; data class Profile(val p:Person):Screen; data class Voice(val p:Person):Screen; data class Video(val p:Person):Screen; data object Contacts:Screen; data object Status:Screen }

private val demoPeople = listOf(
    Person("1","سارة أحمد","متصلة الآن",2,true,"حسناً، أراك لاحقاً"),
    Person("2","علي الكربلائي","آخر ظهور 9:18",0,false,"مكالمة صوتية"),
    Person("3","مجموعة الأصدقاء","5 أعضاء نشطين",5,true,"محمد: صورة جديدة"),
    Person("4","نور الهدى","آخر ظهور أمس",0,false,"شكراً جزيلاً"),
    Person("5","أحمد سامي","متصل الآن",1,true,"ممتاز 👍"),
    Person("6","عائلتي","12 عضو",0,false,"أمي: فيديو")
)

@Composable private fun ShnoApp(){
    var screen by rememberSaveable { mutableStateOf<Screen>(Screen.Login) }
    var tab by rememberSaveable { mutableStateOf(MainTab.CHATS) }
    BackHandler(enabled = screen !is Screen.Login && screen !is Screen.Home){ screen = Screen.Home }
    when(val s=screen){
        Screen.Login -> LoginScreen { screen=Screen.Home }
        Screen.Home -> HomeScreen(tab,{tab=it},{screen=Screen.Chat(it)},{screen=Screen.Profile(it)},{screen=Screen.Contacts},{screen=Screen.Status})
        is Screen.Chat -> ChatScreen(s.p,{screen=Screen.Home},{screen=Screen.Voice(s.p)},{screen=Screen.Video(s.p)},{screen=Screen.Profile(s.p)})
        is Screen.Profile -> ProfileScreen(s.p,{screen=Screen.Home},{screen=Screen.Chat(s.p)},{screen=Screen.Voice(s.p)},{screen=Screen.Video(s.p)})
        is Screen.Voice -> VoiceCallScreen(s.p){screen=Screen.Profile(s.p)}
        is Screen.Video -> VideoCallScreen(s.p){screen=Screen.Profile(s.p)}
        Screen.Contacts -> ContactsScreen({screen=Screen.Home},{screen=Screen.Profile(it)})
        Screen.Status -> StatusScreen { screen=Screen.Home }
    }
}

@Composable private fun AppBackground(content:@Composable BoxScope.()->Unit){
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF062522),Bg,Color(0xFF020A09)))),content=content)
}

@Composable private fun LoginScreen(onPreview:()->Unit){
    var user by rememberSaveable{mutableStateOf("")}; var pass by rememberSaveable{mutableStateOf("")}
    AppBackground{
        Column(Modifier.fillMaxSize().statusBarsPadding().padding(26.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.Center){
            Box(Modifier.size(106.dp).background(Brush.radialGradient(listOf(Accent2,Color(0xFF0B8C78))),CircleShape),contentAlignment=Alignment.Center){ Icon(Icons.Default.Phone, null, tint=Color.White, modifier=Modifier.size(54.dp)) }
            Spacer(Modifier.height(22.dp)); Text("شنو منو",fontSize=38.sp,fontWeight=FontWeight.Black,color=Color.White); Text("تواصل ... بلا حدود",color=Accent,fontSize=18.sp)
            Spacer(Modifier.height(38.dp))
            OutlinedTextField(user,{user=it},Modifier.fillMaxWidth(),label={Text("رقم الهاتف أو اسم المستخدم")},leadingIcon={Icon(Icons.Default.Person,null)},singleLine=true,colors=darkField())
            Spacer(Modifier.height(12.dp)); OutlinedTextField(pass,{pass=it},Modifier.fillMaxWidth(),label={Text("كلمة المرور")},leadingIcon={Icon(Icons.Default.Lock,null)},singleLine=true,colors=darkField())
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.End){ Text("نسيت كلمة المرور؟",color=Accent,fontSize=12.sp) }
            Spacer(Modifier.height(18.dp)); Button(onClick={},enabled=false,modifier=Modifier.fillMaxWidth().height(54.dp),colors=ButtonDefaults.buttonColors(containerColor=Accent,disabledContainerColor=Accent.copy(alpha=.35f))){Text("تسجيل الدخول",fontWeight=FontWeight.Bold)}
            Spacer(Modifier.height(12.dp)); OutlinedButton(onClick=onPreview,modifier=Modifier.fillMaxWidth().height(52.dp),colors=ButtonDefaults.outlinedButtonColors(contentColor=Accent)){Text("معاينة التصميم الجديد")}
            Spacer(Modifier.height(18.dp)); Text("هذه النسخة مستقلة عن الموقع. ربط الحساب والمزامنة سيتم في المرحلة التالية.",color=TextMuted,fontSize=11.sp,textAlign=TextAlign.Center)
        }
    }
}

@Composable private fun HomeScreen(tab:MainTab,onTab:(MainTab)->Unit,onChat:(Person)->Unit,onProfile:(Person)->Unit,onContacts:()->Unit,onStatus:()->Unit){
    Scaffold(containerColor=Bg,topBar={TopBar(tab.title,onContacts)},bottomBar={NavigationBar(containerColor=Color(0xFF061713)){MainTab.entries.forEach{t->NavigationBarItem(selected=t==tab,onClick={onTab(t)},icon={Icon(t.icon,null)},label={Text(t.title,fontSize=10.sp)},colors=NavigationBarItemDefaults.colors(selectedIconColor=Accent,selectedTextColor=Accent,indicatorColor=Accent.copy(.14f),unselectedIconColor=TextMuted,unselectedTextColor=TextMuted))}}}){pad->
        AppBackground{ Box(Modifier.fillMaxSize().padding(pad)){ when(tab){MainTab.CHATS->ChatsTab(onChat,onProfile,onStatus);MainTab.CALLS->CallsTab(onProfile);MainTab.COMMUNITY->CommunityTab();MainTab.SETTINGS->SettingsTab()} } }
    }
}

@Composable private fun TopBar(title:String,onContacts:()->Unit){
    Surface(color=Color(0xFF061713)){Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal=16.dp,vertical=9.dp),verticalAlignment=Alignment.CenterVertically){Column(Modifier.weight(1f)){Text("شنو منو",color=Accent,fontSize=25.sp,fontWeight=FontWeight.Black);Text(title,color=TextMuted,fontSize=11.sp)};IconButton(onClick={}){Icon(Icons.Default.Search,null,tint=Color.White)};IconButton(onClick=onContacts){Icon(Icons.Default.PersonAdd,null,tint=Color.White)}}}
}

@Composable private fun ChatsTab(onChat:(Person)->Unit,onProfile:(Person)->Unit,onStatus:()->Unit){
    var q by rememberSaveable{mutableStateOf("")}; val shown=demoPeople.filter{q.isBlank()||it.name.contains(q,true)}
    Column(Modifier.fillMaxSize().padding(horizontal=14.dp)){
        SearchBox(q,{q=it},"البحث في الدردشات...")
        Spacer(Modifier.height(12.dp)); Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())){ StoryAdd(onStatus); demoPeople.take(4).forEach{StoryChip(it,onProfile)} }
        Spacer(Modifier.height(10.dp)); LazyColumn{items(shown,key={it.id}){p->PersonRow(p,{onChat(p)},{onProfile(p)})}}
    }
}

@Composable private fun CallsTab(onProfile:(Person)->Unit){
    Column(Modifier.fillMaxSize().padding(horizontal=14.dp)){ SearchBox("",{},"ابحث في سجل المكالمات");Spacer(Modifier.height(12.dp));Row(Modifier.horizontalScroll(rememberScrollState())){FilterChip(true,{}, {Text("الكل")});Spacer(Modifier.width(8.dp));FilterChip(false,{}, {Text("صادرة")});Spacer(Modifier.width(8.dp));FilterChip(false,{}, {Text("واردة")});Spacer(Modifier.width(8.dp));FilterChip(false,{}, {Text("فائتة")})};Spacer(Modifier.height(8.dp));LazyColumn{items(demoPeople){p->CallRow(p,onProfile)}} }
}

@Composable private fun CommunityTab(){
    val groups=listOf("العائلة" to "12 عضو","أصدقاء الجامعة" to "28 عضو","أهل الحي" to "45 عضو","عشاق التقنية" to "1.2K عضو","أخبار العراق" to "125K متابع")
    Column(Modifier.fillMaxSize().padding(14.dp)){SearchBox("",{},"ابحث في المجتمعات...");Spacer(Modifier.height(12.dp));OutlinedButton(onClick={},modifier=Modifier.fillMaxWidth(),colors=ButtonDefaults.outlinedButtonColors(contentColor=Accent)){Icon(Icons.Default.GroupAdd,null);Spacer(Modifier.width(8.dp));Text("إنشاء مجموعة جديدة")};Spacer(Modifier.height(12.dp));groups.forEachIndexed{i,g->Surface(color=if(i%2==0) Card else Card2,shape=RoundedCornerShape(16.dp),modifier=Modifier.fillMaxWidth().padding(vertical=5.dp)){Row(Modifier.padding(14.dp),verticalAlignment=Alignment.CenterVertically){Avatar(g.first,48.dp);Column(Modifier.weight(1f).padding(horizontal=12.dp)){Text(g.first,color=Color.White,fontWeight=FontWeight.Bold);Text(g.second,color=TextMuted,fontSize=12.sp)};Icon(Icons.Default.ChevronLeft,null,tint=TextMuted)}}}}
}

@Composable private fun SettingsTab(){
    val rows=listOf(Triple(Icons.Default.AccountCircle,"الحساب","الخصوصية، الأمان، تغيير الرقم"),Triple(Icons.Default.Palette,"المظهر","الوضع الداكن، السمات، اللغة"),Triple(Icons.Default.Notifications,"الإشعارات","المكالمات، الرسائل، الأصوات"),Triple(Icons.Default.Storage,"البيانات والتخزين","استخدام البيانات والتنزيل"),Triple(Icons.Default.Help,"المساعدة","مركز المساعدة، تواصل معنا"),Triple(Icons.Default.Info,"حول التطبيق","شنو منو — إصدار تجريبي"))
    Column(Modifier.fillMaxSize().padding(14.dp)){Row(Modifier.fillMaxWidth().padding(vertical=16.dp),verticalAlignment=Alignment.CenterVertically){Avatar("أحمد العراقي",64.dp);Column(Modifier.padding(start=14.dp)){Text("أحمد العراقي",color=Color.White,fontSize=20.sp,fontWeight=FontWeight.Bold);Text("+964 770 123 4567",color=TextMuted)}};rows.forEach{r->Surface(color=Card,shape=RoundedCornerShape(15.dp),modifier=Modifier.fillMaxWidth().padding(vertical=4.dp)){Row(Modifier.padding(14.dp),verticalAlignment=Alignment.CenterVertically){Icon(r.first,null,tint=Accent);Column(Modifier.weight(1f).padding(horizontal=12.dp)){Text(r.second,color=Color.White,fontWeight=FontWeight.SemiBold);Text(r.third,color=TextMuted,fontSize=11.sp)};Icon(Icons.Default.ChevronLeft,null,tint=TextMuted)}}}}
}

@Composable private fun ChatScreen(p:Person,onBack:()->Unit,onVoice:()->Unit,onVideo:()->Unit,onProfile:()->Unit){
    var msg by rememberSaveable{mutableStateOf("")}; val local=remember{mutableStateListOf("مرحباً، كيف حالك اليوم؟","بخير والله الحمد، وأنت؟","ممتاز 😊","نتكلم لاحقاً؟","نعم بالتأكيد")}
    Scaffold(containerColor=Bg,topBar={Surface(color=Color(0xFF061713)){Row(Modifier.fillMaxWidth().statusBarsPadding().padding(8.dp),verticalAlignment=Alignment.CenterVertically){IconButton(onClick=onBack){Icon(Icons.Default.ArrowBack,null,tint=Color.White)};Avatar(p.name,42.dp);Column(Modifier.weight(1f).padding(horizontal=10.dp).clickable(onClick=onProfile)){Text(p.name,color=Color.White,fontWeight=FontWeight.Bold);Text(p.status,color=if(p.online)Accent else TextMuted,fontSize=11.sp)};IconButton(onClick=onVideo){Icon(Icons.Default.Videocam,null,tint=Color.White)};IconButton(onClick=onVoice){Icon(Icons.Default.Call,null,tint=Color.White)};IconButton(onClick={}){Icon(Icons.Default.MoreVert,null,tint=Color.White)}}}},bottomBar={MessageComposer(msg,{msg=it}){if(msg.isNotBlank()){local.add(msg);msg=""}}}){pad->
        AppBackground{LazyColumn(Modifier.fillMaxSize().padding(pad).padding(horizontal=12.dp),verticalArrangement=Arrangement.spacedBy(8.dp),contentPadding=PaddingValues(vertical=16.dp)){items(local){m->val mine=local.indexOf(m)%2==1;Row(Modifier.fillMaxWidth(),horizontalArrangement=if(mine)Arrangement.End else Arrangement.Start){Surface(color=if(mine)Color(0xFF08745F) else Card,shape=RoundedCornerShape(16.dp)){Text(m,color=Color.White,modifier=Modifier.padding(horizontal=14.dp,vertical=10.dp),fontSize=14.sp)}}}}}
    }
}

@Composable private fun ProfileScreen(p:Person,onBack:()->Unit,onChat:()->Unit,onVoice:()->Unit,onVideo:()->Unit){
    AppBackground{Column(Modifier.fillMaxSize().statusBarsPadding().padding(20.dp),horizontalAlignment=Alignment.CenterHorizontally){Row(Modifier.fillMaxWidth()){IconButton(onClick=onBack){Icon(Icons.Default.ArrowBack,null,tint=Color.White)}};Spacer(Modifier.height(24.dp));Avatar(p.name,108.dp);Spacer(Modifier.height(14.dp));Text(p.name,color=Color.White,fontSize=26.sp,fontWeight=FontWeight.Black);Text(p.status,color=if(p.online)Accent else TextMuted);Spacer(Modifier.height(28.dp));Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceEvenly){ActionCircle("رسالة",Icons.Default.ChatBubble,onChat);ActionCircle("صوتي",Icons.Default.Call,onVoice);ActionCircle("فيديو",Icons.Default.Videocam,onVideo)};Spacer(Modifier.height(28.dp));InfoCard(Icons.Default.Phone,"رقم الهاتف","+964 770 123 4567");InfoCard(Icons.Default.AlternateEmail,"اسم المستخدم","@${p.name.replace(" ","_")}");InfoCard(Icons.Default.Lock,"الخصوصية","معلومات الاتصال خاصة داخل التطبيق")}}
}

@Composable private fun VoiceCallScreen(p:Person,onEnd:()->Unit){
    AppBackground{Column(Modifier.fillMaxSize().statusBarsPadding().padding(24.dp),horizontalAlignment=Alignment.CenterHorizontally){Spacer(Modifier.weight(.35f));Box(Modifier.fillMaxWidth().height(84.dp).background(Brush.horizontalGradient(listOf(Color.Transparent,Accent.copy(.35f),Color.Transparent))),contentAlignment=Alignment.Center){Text("▂▅▇▃▆▂▇▅▃▆▂",color=Accent,fontSize=28.sp)};Spacer(Modifier.height(20.dp));Avatar(p.name,130.dp);Spacer(Modifier.height(18.dp));Text(p.name,color=Color.White,fontSize=30.sp,fontWeight=FontWeight.Black);Text("00:15",color=Color.White,fontSize=18.sp);Text("مكالمة صوتية",color=TextMuted);Spacer(Modifier.weight(1f));Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceEvenly){ActionCircle("كتم",Icons.Default.MicOff){};ActionCircle("مكبر الصوت",Icons.Default.VolumeUp){};ActionCircle("إضافة",Icons.Default.PersonAdd){}};Spacer(Modifier.height(26.dp));FloatingActionButton(onClick=onEnd,containerColor=Danger,modifier=Modifier.size(72.dp)){Icon(Icons.Default.CallEnd,null,tint=Color.White,modifier=Modifier.size(34.dp))};Spacer(Modifier.height(28.dp))}}
}

@Composable private fun VideoCallScreen(p:Person,onEnd:()->Unit){
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF24332F),Color(0xFF0A1412))))){Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center){Column(horizontalAlignment=Alignment.CenterHorizontally){Avatar(p.name,150.dp);Spacer(Modifier.height(12.dp));Text(p.name,color=Color.White,fontSize=26.sp,fontWeight=FontWeight.Bold);Text("الفيديو التجريبي",color=TextMuted)}};Surface(color=Color(0xBB102723),shape=RoundedCornerShape(18.dp),modifier=Modifier.align(Alignment.TopEnd).statusBarsPadding().padding(16.dp).size(105.dp,145.dp)){Box(contentAlignment=Alignment.Center){Icon(Icons.Default.Person,null,tint=TextMuted,modifier=Modifier.size(54.dp))}};Row(Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(22.dp).fillMaxWidth(),horizontalArrangement=Arrangement.SpaceEvenly){CallControl(Icons.Default.CameraAlt){};CallControl(Icons.Default.MicOff){};CallControl(Icons.Default.Cameraswitch){};FloatingActionButton(onClick=onEnd,containerColor=Danger){Icon(Icons.Default.CallEnd,null,tint=Color.White)}}}
}

@Composable private fun ContactsScreen(onBack:()->Unit,onOpen:(Person)->Unit){AppBackground{Column(Modifier.fillMaxSize().statusBarsPadding().padding(14.dp)){Row(verticalAlignment=Alignment.CenterVertically){IconButton(onClick=onBack){Icon(Icons.Default.ArrowBack,null,tint=Color.White)};Text("جهات الاتصال",color=Color.White,fontSize=24.sp,fontWeight=FontWeight.Bold)};SearchBox("",{},"البحث في جهات الاتصال...");Spacer(Modifier.height(12.dp));Surface(color=Accent.copy(.12f),shape=RoundedCornerShape(14.dp),modifier=Modifier.fillMaxWidth().clickable{} ){Row(Modifier.padding(14.dp),verticalAlignment=Alignment.CenterVertically){Box(Modifier.size(44.dp).background(Accent,CircleShape),contentAlignment=Alignment.Center){Icon(Icons.Default.PersonAdd,null,tint=Bg)};Text("إضافة جهة اتصال جديدة",color=Accent,fontWeight=FontWeight.Bold,modifier=Modifier.padding(start=12.dp))}};Spacer(Modifier.height(8.dp));LazyColumn{items(demoPeople){p->PersonRow(p,{onOpen(p)},{onOpen(p)})}}}}}

@Composable private fun StatusScreen(onBack:()->Unit){AppBackground{Column(Modifier.fillMaxSize().statusBarsPadding().padding(14.dp)){Row(verticalAlignment=Alignment.CenterVertically){IconButton(onClick=onBack){Icon(Icons.Default.ArrowBack,null,tint=Color.White)};Text("الحالة",color=Color.White,fontSize=24.sp,fontWeight=FontWeight.Bold)};Surface(color=Card,shape=RoundedCornerShape(18.dp),modifier=Modifier.fillMaxWidth()){Row(Modifier.padding(14.dp),verticalAlignment=Alignment.CenterVertically){Box{Avatar("قصتي",58.dp);Box(Modifier.size(22.dp).background(Accent,CircleShape).align(Alignment.BottomEnd),contentAlignment=Alignment.Center){Icon(Icons.Default.Add,null,tint=Bg,modifier=Modifier.size(16.dp))}};Column(Modifier.padding(start=12.dp)){Text("قصتي",color=Color.White,fontWeight=FontWeight.Bold);Text("اضغط لإضافة حالة",color=TextMuted,fontSize=12.sp)}}};Text("الحالات الحديثة",color=TextMuted,modifier=Modifier.padding(vertical=16.dp));demoPeople.take(4).forEach{StoryListRow(it)}}}}

@Composable private fun MessageComposer(value:String,onChange:(String)->Unit,onSend:()->Unit){Surface(color=Color(0xFF061713)){Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(8.dp),verticalAlignment=Alignment.CenterVertically){IconButton(onClick={}){Icon(Icons.Default.EmojiEmotions,null,tint=TextMuted)};OutlinedTextField(value,onChange,Modifier.weight(1f),placeholder={Text("اكتب رسالة...")},singleLine=true,colors=darkField());IconButton(onClick={}){Icon(Icons.Default.AttachFile,null,tint=TextMuted)};FilledIconButton(onClick=onSend,colors=IconButtonDefaults.filledIconButtonColors(containerColor=Accent)){Icon(if(value.isBlank())Icons.Default.Mic else Icons.Default.Send,null,tint=Bg)}}}

@Composable private fun SearchBox(v:String,on:(String)->Unit,hint:String){OutlinedTextField(v,on,Modifier.fillMaxWidth(),placeholder={Text(hint,color=TextMuted)},leadingIcon={Icon(Icons.Default.Search,null,tint=TextMuted)},singleLine=true,shape=RoundedCornerShape(22.dp),colors=darkField())}
@Composable private fun StoryAdd(on:()->Unit){Column(Modifier.width(72.dp).clickable(onClick=on),horizontalAlignment=Alignment.CenterHorizontally){Box(Modifier.size(55.dp).background(Card,CircleShape),contentAlignment=Alignment.Center){Icon(Icons.Default.Add,null,tint=Accent)};Text("إضافة",color=TextMuted,fontSize=10.sp)}}
@Composable private fun StoryChip(p:Person,on:(Person)->Unit){Column(Modifier.width(72.dp).clickable{on(p)},horizontalAlignment=Alignment.CenterHorizontally){Box(Modifier.size(58.dp).background(Accent,CircleShape).padding(2.dp).background(Bg,CircleShape),contentAlignment=Alignment.Center){Text(p.name.take(1),color=Color.White,fontSize=20.sp,fontWeight=FontWeight.Bold)};Text(p.name.substringBefore(" "),color=Color.White,fontSize=10.sp,maxLines=1)}}

@Composable private fun PersonRow(p:Person,onClick:()->Unit,onLong:()->Unit){Row(Modifier.fillMaxWidth().clickable(onClick=onClick).padding(vertical=10.dp, horizontal=4.dp),verticalAlignment=Alignment.CenterVertically){Avatar(p.name,54.dp);Column(Modifier.weight(1f).padding(horizontal=12.dp)){Row(verticalAlignment=Alignment.CenterVertically){Text(p.name,color=Color.White,fontSize=16.sp,fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f));Text(if(p.online)"10:24" else "أمس",color=if(p.unread>0)Accent else TextMuted,fontSize=11.sp)};Row(verticalAlignment=Alignment.CenterVertically){Text(p.last.ifBlank{p.status},color=TextMuted,fontSize=12.sp,modifier=Modifier.weight(1f),maxLines=1);if(p.unread>0)Box(Modifier.size(22.dp).background(Accent,CircleShape),contentAlignment=Alignment.Center){Text(p.unread.toString(),color=Bg,fontSize=10.sp,fontWeight=FontWeight.Bold)}}}}

@Composable private fun CallRow(p:Person,on:(Person)->Unit){Row(Modifier.fillMaxWidth().clickable{on(p)}.padding(vertical=11.dp),verticalAlignment=Alignment.CenterVertically){Avatar(p.name,52.dp);Column(Modifier.weight(1f).padding(horizontal=12.dp)){Text(p.name,color=Color.White,fontWeight=FontWeight.Bold);Row(verticalAlignment=Alignment.CenterVertically){Icon(if(p.online)Icons.Default.CallReceived else Icons.Default.CallMade,null,tint=if(p.online)Accent else TextMuted,modifier=Modifier.size(14.dp));Spacer(Modifier.width(5.dp));Text(if(p.online)"مكالمة صوتية • منذ دقيقتين" else "مكالمة فيديو • أمس",color=TextMuted,fontSize=11.sp)}};Icon(Icons.Default.Call,null,tint=Accent)} }

@Composable private fun StoryListRow(p:Person){Row(Modifier.fillMaxWidth().padding(vertical=9.dp),verticalAlignment=Alignment.CenterVertically){Box(Modifier.size(58.dp).background(Accent,CircleShape).padding(2.dp).background(Bg,CircleShape),contentAlignment=Alignment.Center){Text(p.name.take(1),color=Color.White,fontSize=20.sp,fontWeight=FontWeight.Bold)};Column(Modifier.padding(start=12.dp)){Text(p.name,color=Color.White,fontWeight=FontWeight.Bold);Text("منذ ${demoPeople.indexOf(p)+1} ساعة",color=TextMuted,fontSize=11.sp)}}}

@Composable private fun Avatar(name:String,size:androidx.compose.ui.unit.Dp){Box(Modifier.size(size).background(Brush.linearGradient(listOf(Color(0xFF0D8E78),Accent)),CircleShape),contentAlignment=Alignment.Center){Text(name.take(1),color=Color.White,fontWeight=FontWeight.Black,fontSize=(size.value*.38f).sp)}}
@Composable private fun ActionCircle(label:String,icon:ImageVector,on:()->Unit){Column(horizontalAlignment=Alignment.CenterHorizontally){FilledIconButton(onClick=on,modifier=Modifier.size(58.dp),colors=IconButtonDefaults.filledIconButtonColors(containerColor=Card2,contentColor=Accent)){Icon(icon,null,modifier=Modifier.size(25.dp))};Spacer(Modifier.height(6.dp));Text(label,color=TextMuted,fontSize=11.sp)}}
@Composable private fun CallControl(icon:ImageVector,on:()->Unit){FilledIconButton(onClick=on,modifier=Modifier.size(52.dp),colors=IconButtonDefaults.filledIconButtonColors(containerColor=Color(0xBB203833),contentColor=Color.White)){Icon(icon,null)}}
@Composable private fun InfoCard(icon:ImageVector,title:String,value:String){Surface(color=Card,shape=RoundedCornerShape(16.dp),modifier=Modifier.fillMaxWidth().padding(vertical=5.dp)){Row(Modifier.padding(14.dp),verticalAlignment=Alignment.CenterVertically){Icon(icon,null,tint=Accent);Column(Modifier.padding(start=12.dp)){Text(title,color=TextMuted,fontSize=11.sp);Text(value,color=Color.White,fontWeight=FontWeight.SemiBold)}}}}
@Composable private fun darkField()=OutlinedTextFieldDefaults.colors(focusedTextColor=Color.White,unfocusedTextColor=Color.White,focusedBorderColor=Accent,unfocusedBorderColor=Color(0xFF29433D),focusedLabelColor=Accent,unfocusedLabelColor=TextMuted,cursorColor=Accent)
