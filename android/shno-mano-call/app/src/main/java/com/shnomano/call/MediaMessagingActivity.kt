package com.shnomano.call

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.shnomano.call.data.*
import kotlinx.coroutines.launch
import java.io.File
import java.io.FileOutputStream

private val MediaBg = Color(0xFF061514)
private val MediaPanel = Color(0xFF10201B)
private val MediaPanel2 = Color(0xFF132824)
private val MediaAccent = Color(0xFF19D9A0)
private val MediaMuted = Color(0xFF91A39D)

class MediaMessagingActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ShnoManoTheme { MediaMessagingScreen { finish() } } }
    }
}

@Composable
private fun MediaMessagingScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val appRepo = remember { AppRepository(context) }
    var selected by remember { mutableStateOf<ConversationDto?>(null) }

    if (selected == null) {
        ConversationPicker(appRepo, onBack) { selected = it }
    } else {
        MediaChatScreen(appRepo, selected!!) { selected = null }
    }
}

@Composable
private fun ConversationPicker(repo: AppRepository, onBack: () -> Unit, onOpen: (ConversationDto) -> Unit) {
    var rows by remember { mutableStateOf<List<ConversationDto>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) {
        rows = repo.loadConversations()
        loading = false
    }
    Column(Modifier.fillMaxSize().background(MediaBg).padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, null, tint = Color.White) }
            Text("دردشة الصوت والفيديو", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        }
        Text("اختر محادثة لإرسال رسالة صوتية أو فيديو أو نص", color = MediaMuted, fontSize = 12.sp)
        Spacer(Modifier.height(14.dp))
        if (loading) CircularProgressIndicator(color = MediaAccent)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(rows, key = { it.id }) { c ->
                val other = c.otherUser
                Card(
                    colors = CardDefaults.cardColors(containerColor = MediaPanel),
                    shape = RoundedCornerShape(18.dp),
                    modifier = Modifier.fillMaxWidth().clickable { onOpen(c) }
                ) {
                    Column(Modifier.padding(14.dp)) {
                        Text(other?.fullName ?: other?.username ?: "محادثة", color = Color.White, fontWeight = FontWeight.Bold)
                        Text(other?.username?.let { "@$it" } ?: "", color = MediaMuted, fontSize = 11.sp)
                    }
                }
            }
            if (!loading && rows.isEmpty()) item {
                Text("لا توجد محادثات حالياً", color = MediaMuted, modifier = Modifier.padding(16.dp))
            }
        }
    }
}

@Composable
private fun MediaChatScreen(repo: AppRepository, conversation: ConversationDto, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val mediaRepo = remember { MediaMessageRepository(repo.session) }
    var messages by remember { mutableStateOf<List<MediaMessageDto>>(emptyList()) }
    var text by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf<String?>(null) }
    var recorder by remember { mutableStateOf<MediaRecorder?>(null) }
    var recordingFile by remember { mutableStateOf<File?>(null) }
    var isRecording by remember { mutableStateOf(false) }
    var captureFile by remember { mutableStateOf<File?>(null) }

    suspend fun reload() {
        mediaRepo.load(conversation.id).onSuccess { messages = it }
    }

    suspend fun uploadFile(file: File, mime: String, displayName: String) {
        busy = true
        status = "جاري الإرسال..."
        mediaRepo.sendFile(conversation.id, file, mime, displayName)
            .onSuccess { message ->
                messages = messages + message
                status = "تم الإرسال"
            }
            .onFailure { status = it.message ?: "تعذر إرسال الملف" }
        busy = false
    }

    val videoPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri != null) {
            scope.launch {
                runCatching { copyUriToCache(context, uri, "picked-video") }
                    .onSuccess { file -> uploadFile(file, context.contentResolver.getType(uri) ?: "video/mp4", queryDisplayName(context, uri) ?: file.name) }
                    .onFailure { status = it.message ?: "تعذر قراءة الفيديو" }
            }
        }
    }

    val captureVideo = rememberLauncherForActivityResult(ActivityResultContracts.CaptureVideo()) { ok ->
        val file = captureFile
        if (ok && file != null && file.exists()) {
            scope.launch { uploadFile(file, "video/mp4", file.name) }
        } else if (file != null && file.exists()) {
            file.delete()
        }
        captureFile = null
    }

    val cameraPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            val file = newMediaFile(context, "video", ".mp4")
            captureFile = file
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            captureVideo.launch(uri)
        } else status = "يجب السماح بالكاميرا لتسجيل الفيديو"
    }

    val audioPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (!granted) status = "يجب السماح بالمايكروفون لتسجيل الرسالة الصوتية"
        else {
            runCatching {
                val file = newMediaFile(context, "voice", ".m4a")
                val r = createRecorder(context, file)
                r.start()
                recordingFile = file
                recorder = r
                isRecording = true
                status = "جاري التسجيل... اضغط مرة أخرى للإرسال"
            }.onFailure { status = it.message ?: "تعذر بدء التسجيل" }
        }
    }

    LaunchedEffect(conversation.id) { reload() }
    DisposableEffect(Unit) {
        onDispose {
            runCatching { recorder?.stop() }
            runCatching { recorder?.release() }
        }
    }

    Scaffold(
        containerColor = MediaBg,
        topBar = {
            Row(Modifier.fillMaxWidth().background(MediaPanel).statusBarsPadding().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, null, tint = Color.White) }
                Column(Modifier.weight(1f)) {
                    Text(conversation.otherUser?.fullName ?: conversation.otherUser?.username ?: "محادثة", color = Color.White, fontWeight = FontWeight.Bold)
                    Text("نص • صوت • فيديو", color = MediaAccent, fontSize = 10.sp)
                }
                IconButton(onClick = { scope.launch { reload() } }) { Icon(Icons.Default.Refresh, null, tint = MediaAccent) }
            }
        },
        bottomBar = {
            Column(Modifier.fillMaxWidth().background(MediaPanel).navigationBarsPadding().padding(8.dp)) {
                status?.let { Text(it, color = if (it.startsWith("تعذر") || it.startsWith("يجب")) MaterialTheme.colorScheme.error else MediaMuted, fontSize = 10.sp) }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(enabled = !busy, onClick = {
                        if (isRecording) {
                            val file = recordingFile
                            runCatching { recorder?.stop() }.onFailure { file?.delete() }
                            runCatching { recorder?.release() }
                            recorder = null
                            recordingFile = null
                            isRecording = false
                            if (file != null && file.exists() && file.length() > 0L) scope.launch { uploadFile(file, "audio/mp4", file.name) }
                        } else if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                            val file = newMediaFile(context, "voice", ".m4a")
                            runCatching {
                                val r = createRecorder(context, file)
                                r.start()
                                recordingFile = file
                                recorder = r
                                isRecording = true
                                status = "جاري التسجيل... اضغط زر المايك للإرسال"
                            }.onFailure { status = it.message ?: "تعذر بدء التسجيل" }
                        } else audioPermission.launch(Manifest.permission.RECORD_AUDIO)
                    }) {
                        Icon(if (isRecording) Icons.Default.Stop else Icons.Default.Mic, null, tint = if (isRecording) MaterialTheme.colorScheme.error else MediaAccent)
                    }
                    IconButton(enabled = !busy, onClick = { videoPicker.launch("video/*") }) { Icon(Icons.Default.VideoLibrary, null, tint = MediaAccent) }
                    IconButton(enabled = !busy, onClick = {
                        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                            val file = newMediaFile(context, "video", ".mp4")
                            captureFile = file
                            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
                            captureVideo.launch(uri)
                        } else cameraPermission.launch(Manifest.permission.CAMERA)
                    }) { Icon(Icons.Default.Videocam, null, tint = MediaAccent) }
                    OutlinedTextField(text, { text = it }, modifier = Modifier.weight(1f), placeholder = { Text("اكتب رسالة") }, singleLine = true)
                    IconButton(enabled = !busy && text.isNotBlank(), onClick = {
                        val outgoing = text
                        busy = true
                        scope.launch {
                            mediaRepo.sendText(conversation.id, outgoing)
                                .onSuccess { messages = messages + it; text = ""; status = null }
                                .onFailure { status = it.message ?: "تعذر إرسال الرسالة" }
                            busy = false
                        }
                    }) { Icon(Icons.Default.Send, null, tint = MediaAccent) }
                }
            }
        }
    ) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(messages, key = { it.messageId.ifBlank { "${it.createdAt}-${it.text}-${it.attachment?.url}" } }) { message ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = if (message.mine) Arrangement.End else Arrangement.Start) {
                    Surface(color = if (message.mine) MediaAccent else MediaPanel2, shape = RoundedCornerShape(16.dp)) {
                        Column(Modifier.widthIn(max = 300.dp).padding(10.dp)) {
                            message.text?.takeIf { it.isNotBlank() }?.let {
                                Text(it, color = if (message.mine) MediaBg else Color.White, fontSize = 13.sp)
                            }
                            message.attachment?.let { attachment ->
                                Spacer(Modifier.height(4.dp))
                                val mime = attachment.mimeType.orEmpty()
                                val label = when {
                                    mime.startsWith("audio/") -> "🎙️ رسالة صوتية"
                                    mime.startsWith("video/") -> "🎬 فيديو"
                                    mime.startsWith("image/") -> "🖼️ صورة"
                                    else -> "📎 ${attachment.name ?: "ملف"}"
                                }
                                Text(
                                    label,
                                    color = if (message.mine) MediaBg else MediaAccent,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.clickable { openAttachment(context, attachment) }
                                )
                                attachment.size?.let { Text(formatBytes(it), color = if (message.mine) MediaBg.copy(alpha = .65f) else MediaMuted, fontSize = 9.sp) }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Suppress("DEPRECATION")
private fun createRecorder(context: Context, file: File): MediaRecorder {
    val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) MediaRecorder(context) else MediaRecorder()
    recorder.setAudioSource(MediaRecorder.AudioSource.MIC)
    recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
    recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
    recorder.setAudioEncodingBitRate(96_000)
    recorder.setAudioSamplingRate(44_100)
    recorder.setOutputFile(file.absolutePath)
    recorder.prepare()
    return recorder
}

private fun newMediaFile(context: Context, prefix: String, suffix: String): File {
    val dir = File(context.cacheDir, "media").apply { mkdirs() }
    return File(dir, "$prefix-${System.currentTimeMillis()}$suffix")
}

private fun copyUriToCache(context: Context, uri: Uri, prefix: String): File {
    val name = queryDisplayName(context, uri) ?: "$prefix-${System.currentTimeMillis()}"
    val safe = name.replace(Regex("[^A-Za-z0-9._-]"), "_").takeLast(100)
    val file = File(File(context.cacheDir, "media").apply { mkdirs() }, "${System.currentTimeMillis()}-$safe")
    context.contentResolver.openInputStream(uri).use { input ->
        requireNotNull(input) { "تعذر فتح الملف" }
        FileOutputStream(file).use { output -> input.copyTo(output) }
    }
    return file
}

private fun queryDisplayName(context: Context, uri: Uri): String? {
    return context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) cursor.getString(0) else null
    }
}

private fun openAttachment(context: Context, attachment: MediaAttachmentDto) {
    val raw = attachment.url ?: return
    val url = if (raw.startsWith("http://") || raw.startsWith("https://")) raw else SHNO_MANO_BASE_URL.removeSuffix("/") + raw
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
        attachment.mimeType?.let { setDataAndType(Uri.parse(url), it) }
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    runCatching { context.startActivity(intent) }
}

private fun formatBytes(value: Long): String = when {
    value >= 1024L * 1024L -> "%.1f MB".format(value / (1024.0 * 1024.0))
    value >= 1024L -> "%.1f KB".format(value / 1024.0)
    else -> "$value B"
}
