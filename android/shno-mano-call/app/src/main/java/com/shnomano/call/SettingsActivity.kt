package com.shnomano.call

import android.content.Intent
import android.media.RingtoneManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
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
    var notifications by remember { mutableStateOf(store.notificationsEnabled) }
    var vibration by remember { mutableStateOf(store.vibrationEnabled) }
    var callSound by remember { mutableStateOf(store.callSoundEnabled) }
    var ringtoneLabel by remember { mutableStateOf("نغمة الهاتف الافتراضية") }

    val ringtonePicker = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val uri = if (android.os.Build.VERSION.SDK_INT >= 33) {
            result.data?.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI, android.net.Uri::class.java)
        } else {
            @Suppress("DEPRECATION")
            result.data?.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI)
        }
        if (uri != null) {
            store.ringtoneUri = uri.toString()
            ringtoneLabel = RingtoneManager.getRingtone(context, uri)?.getTitle(context) ?: "نغمة مختارة"
        }
    }

    LaunchedEffect(Unit) {
        store.ringtoneUri?.let { saved ->
            runCatching {
                val uri = android.net.Uri.parse(saved)
                ringtoneLabel = RingtoneManager.getRingtone(context, uri)?.getTitle(context) ?: "نغمة مختارة"
            }
        }
    }

    Column(
        Modifier.fillMaxSize().background(Color(0xFF070910)).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack) { Text("رجوع") }
            Text("إعدادات شنو منو اتصال", color = Color.White, fontSize = 22.sp)
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
        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF111522)), shape = RoundedCornerShape(18.dp)) {
            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                Text("نغمة المكالمة", color = Color.White, fontSize = 16.sp)
                Text(ringtoneLabel, color = Color(0xFF98A2B3), fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                Spacer(Modifier.height(10.dp))
                Button(onClick = {
                    val intent = android.content.Intent(RingtoneManager.ACTION_RINGTONE_PICKER).apply {
                        putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_RINGTONE)
                        putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true)
                        putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false)
                        store.ringtoneUri?.let { putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, android.net.Uri.parse(it)) }
                    }
                    ringtonePicker.launch(intent)
                }) { Text("اختيار نغمة") }
            }
        }
        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF111522)), shape = RoundedCornerShape(18.dp)) {
            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                Text("البحث والإضافة", color = Color.White, fontSize = 16.sp)
                Text("ابحث باسم المستخدم أو رقم الهاتف، وأرسل دعوة جاهزة لغير المسجلين", color = Color(0xFF98A2B3), fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = { context.startActivity(Intent(context, ContactDiscoveryActivity::class.java)) },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("فتح البحث وإضافة الأصدقاء") }
            }
        }
        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF111522)), shape = RoundedCornerShape(18.dp)) {
            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                Text("الرسائل الصوتية والفيديو", color = Color.White, fontSize = 16.sp)
                Text("سجّل رسالة صوتية، أرسل فيديو من الهاتف، أو سجّل فيديو جديداً وأرسله", color = Color(0xFF98A2B3), fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = { context.startActivity(Intent(context, MediaMessagingActivity::class.java)) },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("فتح دردشة الوسائط") }
            }
        }
        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF111522)), shape = RoundedCornerShape(18.dp)) {
            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                Text("إضافة صديق عبر QR", color = Color.White, fontSize = 16.sp)
                Text("اعرض رمز حسابك أو امسح رمز صديق لإرسال طلب الإضافة", color = Color(0xFF98A2B3), fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = { context.startActivity(Intent(context, QrFriendActivity::class.java)) },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("فتح QR شنو منو") }
            }
        }
        Text("ملاحظة: تغيير صوت قناة المكالمات قد يحتاج إغلاق التطبيق وفتحه من جديد على بعض أجهزة أندرويد.", color = Color(0xFF98A2B3), fontSize = 11.sp)
    }
}

@Composable
private fun SettingSwitch(title: String, subtitle: String, checked: Boolean, onChanged: (Boolean) -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF111522)), shape = RoundedCornerShape(18.dp)) {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(title, color = Color.White, fontSize = 16.sp)
                Text(subtitle, color = Color(0xFF98A2B3), fontSize = 11.sp)
            }
            Switch(checked = checked, onCheckedChange = onChanged)
        }
    }
}
