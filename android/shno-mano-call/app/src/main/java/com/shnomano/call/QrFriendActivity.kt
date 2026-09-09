package com.shnomano.call

import android.content.Intent
import android.graphics.Bitmap
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import com.google.zxing.common.BitMatrix
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.shnomano.call.data.AppRepository
import kotlinx.coroutines.launch
import java.io.File
import java.io.FileOutputStream

class QrFriendActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ShnoManoTheme { QrFriendScreen { finish() } } }
    }
}

@Composable
private fun QrFriendScreen(onBack: () -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val repo = remember { AppRepository(context) }
    val scope = rememberCoroutineScope()
    val userId = repo.session.userId.orEmpty()
    val payload = remember(userId) { if (userId.isBlank()) "" else "shnomano://friend/$userId" }
    val qrBitmap = remember(payload) { payload.takeIf { it.isNotBlank() }?.let(::makeQrBitmap) }
    var status by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    val scanner = rememberLauncherForActivityResult(ScanContract()) { result ->
        val scannedUserId = parseFriendQr(result.contents)
        if (scannedUserId.isNullOrBlank()) {
            if (!result.contents.isNullOrBlank()) status = "رمز QR ليس خاصاً بإضافة صديق في شنو منو"
            return@rememberLauncherForActivityResult
        }
        if (scannedUserId == userId) {
            status = "هذا رمز حسابك أنت"
            return@rememberLauncherForActivityResult
        }
        busy = true
        scope.launch {
            repo.sendFriendRequest(scannedUserId)
                .onSuccess { status = it }
                .onFailure { status = it.message ?: "تعذر إرسال طلب الصداقة" }
            busy = false
        }
    }

    Column(
        Modifier.fillMaxSize().background(Color(0xFF070910)).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack) { Text("رجوع") }
            Text("إضافة صديق عبر QR", color = Color.White, fontSize = 22.sp)
        }

        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF111522)), shape = RoundedCornerShape(22.dp)) {
            Column(Modifier.fillMaxWidth().padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("QR الخاص بي", color = Color.White, fontSize = 18.sp)
                Text("أرسله لصديقك ليضيفك مباشرة في شنو منو", color = Color(0xFF98A2B3), fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp, bottom = 14.dp))
                if (qrBitmap != null) {
                    Surface(color = Color.White, shape = RoundedCornerShape(14.dp)) {
                        Image(qrBitmap.asImageBitmap(), contentDescription = "رمز QR الخاص بحسابي", modifier = Modifier.size(230.dp).padding(10.dp))
                    }
                    Spacer(Modifier.height(12.dp))
                    Button(onClick = {
                        runCatching { shareQrImage(context, qrBitmap) }
                            .onFailure { status = "تعذر مشاركة رمز QR" }
                    }, modifier = Modifier.fillMaxWidth()) { Text("مشاركة رمز QR") }
                } else {
                    Text("سجّل الدخول أولاً لإنشاء رمز الحساب", color = MaterialTheme.colorScheme.error)
                }
            }
        }

        Button(
            onClick = {
                val options = ScanOptions()
                    .setDesiredBarcodeFormats(ScanOptions.QR_CODE)
                    .setPrompt("وجّه الكاميرا إلى رمز QR الخاص بصديقك")
                    .setBeepEnabled(false)
                    .setOrientationLocked(false)
                scanner.launch(options)
            },
            enabled = !busy,
            modifier = Modifier.fillMaxWidth().height(52.dp)
        ) {
            if (busy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
            else Text("مسح QR وإرسال طلب إضافة")
        }

        status?.let { Text(it, color = Color(0xFF19D9A0), fontSize = 13.sp) }
        Text("طلبات QR تستخدم نفس نظام الصداقة والحظر، لذلك لا تُكرر طلباً قائماً ولا تتجاوز الحظر.", color = Color(0xFF98A2B3), fontSize = 11.sp)
    }
}

private fun makeQrBitmap(value: String, size: Int = 900): Bitmap {
    val matrix: BitMatrix = MultiFormatWriter().encode(value, BarcodeFormat.QR_CODE, size, size)
    val pixels = IntArray(size * size)
    for (y in 0 until size) {
        for (x in 0 until size) {
            pixels[y * size + x] = if (matrix[x, y]) android.graphics.Color.BLACK else android.graphics.Color.WHITE
        }
    }
    return Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888).apply {
        setPixels(pixels, 0, size, 0, 0, size, size)
    }
}

private fun parseFriendQr(contents: String?): String? {
    val value = contents?.trim().orEmpty()
    if (!value.startsWith("shnomano://friend/")) return null
    return value.removePrefix("shnomano://friend/").substringBefore('?').trim().takeIf { it.matches(Regex("^[A-Fa-f0-9]{24}$")) }
}

private fun shareQrImage(context: android.content.Context, bitmap: Bitmap) {
    val dir = File(context.cacheDir, "shared_qr").apply { mkdirs() }
    val file = File(dir, "shno-mano-friend-qr.png")
    FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "image/png"
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_TEXT, "أضفني على شنو منو عبر رمز QR")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(intent, "مشاركة QR شنو منو"))
}
