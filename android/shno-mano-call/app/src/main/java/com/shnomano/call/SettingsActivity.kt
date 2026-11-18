package com.shnomano.call

import android.content.Intent
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

class SettingsActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ShnoManoTheme { SettingsScreen { finish() } } }
    }
}

@Composable
private fun SettingsScreen(onBack: () -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val store = remember { SettingsStore(context) }
    var locationMode by remember { mutableStateOf(store.locationSharingMode) }
    var locationPickerVisible by remember { mutableStateOf(false) }
    val locationModeLabel = when (locationMode) {
        "city" -> "الموقع التقريبي — المدينة والمحافظة"
        "precise" -> "الموقع الدقيق — إحداثيات الموقع"
        else -> "عدم السماح"
    }
    var lowData by remember { mutableStateOf(store.lowData) }
    var notifications by remember { mutableStateOf(store.notificationsEnabled) }
    var vibration by remember { mutableStateOf(store.vibrationEnabled) }
    var callSound by remember { mutableStateOf(store.callSoundEnabled) }
    Column(
        Modifier.fillMaxSize().background(Color(0xFF0B1020)).verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack) { Text("رجوع") }
            Text("إعدادات شنو منو اتصال", color = Color.White, fontSize = 22.sp)
        }
        val version = remember {
            @Suppress("DEPRECATION")
            val info = context.packageManager.getPackageInfo(context.packageName, 0)
            val code = if (android.os.Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()
            "${info.versionName} ($code)"
        }
        Text("إصدار اتصال $version", color = Color(0xFFA4B4CC), fontSize = 13.sp)
        OutlinedButton(onClick = {
            context.startActivity(Intent(android.provider.Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).apply {
                putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, context.packageName)
                putExtra(android.provider.Settings.EXTRA_CHANNEL_ID, ShnoManoApp.CHANNEL_CALLS)
            })
        }, modifier = Modifier.fillMaxWidth()) { Text("إعداد رنين المكالمات وإشعارات القفل") }
        if (android.os.Build.VERSION.SDK_INT >= 34) {
            OutlinedButton(onClick = {
                context.startActivity(Intent(android.provider.Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, android.net.Uri.parse("package:" + context.packageName)))
            }, modifier = Modifier.fillMaxWidth()) { Text("السماح بظهور المكالمة على شاشة القفل") }
        }
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF151E32)),
            shape = RoundedCornerShape(18.dp)
        ) {
            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                Text("الموقع أثناء المكالمات", color = Color.White, fontSize = 16.sp)
                Text(locationModeLabel, color = Color(0xFFA4B4CC), fontSize = 13.sp,
                    modifier = Modifier.padding(top = 6.dp))
                Text("يُطلب إذنك مرة لكل مكالمة، ولا تتم مشاركة الموقع تلقائياً.",
                    color = Color(0xFFA4B4CC), fontSize = 11.sp,
                    modifier = Modifier.padding(top = 6.dp))
                Spacer(Modifier.height(10.dp))
                OutlinedButton(onClick = { locationPickerVisible = true }, modifier = Modifier.fillMaxWidth()) {
                    Text("إعدادات مشاركة الموقع")
                }
            }
        }
        if (locationPickerVisible) {
            AlertDialog(
                onDismissRequest = { locationPickerVisible = false },
                title = { Text("مشاركة الموقع") },
                text = {
                    Column {
                        Text("اختر ما يمكن للتطبيق عرضه عند موافقتك أثناء المكالمة.")
                        listOf(
                            "city" to "الموقع التقريبي (المدينة والمحافظة)",
                            "precise" to "الموقع الدقيق",
                            "none" to "عدم السماح"
                        ).forEach { (value, title) ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                RadioButton(
                                    selected = locationMode == value,
                                    onClick = {
                                        locationMode = value
                                        store.locationSharingMode = value
                                        locationPickerVisible = false
                                    }
                                )
                                TextButton(onClick = {
                                    locationMode = value
                                    store.locationSharingMode = value
                                    locationPickerVisible = false
                                }) { Text(title) }
                            }
                        }
                    }
                },
                confirmButton = { TextButton(onClick = { locationPickerVisible = false }) { Text("إغلاق") } }
            )
        }
        SettingSwitch("توفير البيانات", "تقليل دقة الفيديو ومعدل الإطارات للشبكات الضعيفة", lowData) {
            lowData = it; store.lowData = it
        }
        SettingSwitch("الإشعارات", "تنبيهات الرسائل والمكالمات", notifications) {
            notifications = it; store.notificationsEnabled = it
        }
        SettingSwitch("الاهتزاز", "اهتزاز عند وصول مكالمة أو رسالة", vibration) {
            vibration = it; store.vibrationEnabled = it
        }
        SettingSwitch("صوت المكالمة", "تشغيل نغمة للمكالمة الواردة", callSound) {
            callSound = it; store.callSoundEnabled = it
        }
        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF151E32)), shape = RoundedCornerShape(18.dp)) {
            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                Text("نغمة الهاتف الأصلية", color = Color.White, fontSize = 16.sp)
                Text("المكالمة الواردة تستخدم نغمة الجهاز الافتراضية. تغيير الرنين من إعدادات صوت الجهاز أو إشعارات المكالمات.",
                    color = Color(0xFFA4B4CC), fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
            }
        }
        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF151E32)), shape = RoundedCornerShape(18.dp)) {
            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                Text("البحث والإضافة", color = Color.White, fontSize = 16.sp)
                Text("ابحث باسم المستخدم أو رقم الهاتف، وأرسل دعوة جاهزة لغير المسجلين", color = Color(0xFFA4B4CC), fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = { context.startActivity(Intent(context, ContactDiscoveryActivity::class.java)) },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("فتح البحث وإضافة الأصدقاء") }
            }
        }
        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF151E32)), shape = RoundedCornerShape(18.dp)) {
            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                Text("الرسائل الصوتية والفيديو", color = Color.White, fontSize = 16.sp)
                Text("سجّل رسالة صوتية، أرسل فيديو من الهاتف، أو سجّل فيديو جديداً وأرسله", color = Color(0xFFA4B4CC), fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = { context.startActivity(Intent(context, MediaMessagingActivity::class.java)) },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("فتح دردشة الوسائط") }
            }
        }
        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF151E32)), shape = RoundedCornerShape(18.dp)) {
            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                Text("إضافة صديق عبر QR", color = Color.White, fontSize = 16.sp)
                Text("اعرض رمز حسابك أو امسح رمز صديق لإرسال طلب الإضافة", color = Color(0xFFA4B4CC), fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = { context.startActivity(Intent(context, QrFriendActivity::class.java)) },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("فتح QR شنو منو") }
            }
        }
        var diagnostic by remember { mutableStateOf<String?>(null) }
        OutlinedButton(onClick = { diagnostic = AppDiagnostics.last(context) }, modifier = Modifier.fillMaxWidth()) { Text("تقرير آخر إغلاق للتطبيق") }
        diagnostic?.let { report ->
            AlertDialog(onDismissRequest = { diagnostic = null }, title = { Text("تقرير محلي") },
                text = { androidx.compose.foundation.text.selection.SelectionContainer { Text(report, fontSize = 11.sp, modifier = Modifier.heightIn(max = 300.dp).verticalScroll(rememberScrollState())) } },
                confirmButton = { TextButton(onClick = { diagnostic = null }) { Text("إغلاق") } })
        }
        Text("ملاحظة: تغيير صوت قناة المكالمات قد يحتاج إغلاق التطبيق وفتحه من جديد على بعض أجهزة أندرويد.", color = Color(0xFFA4B4CC), fontSize = 11.sp)
    }
}

@Composable
private fun SettingSwitch(title: String, subtitle: String, checked: Boolean, onChanged: (Boolean) -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF151E32)), shape = RoundedCornerShape(18.dp)) {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(title, color = Color.White, fontSize = 16.sp)
                Text(subtitle, color = Color(0xFFA4B4CC), fontSize = 11.sp)
            }
            Switch(checked = checked, onCheckedChange = onChanged)
        }
    }
}
