package com.shnomano.call

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.VideoLibrary
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.shnomano.call.data.MediaMessageRepository
import com.shnomano.call.data.SessionStore
import kotlinx.coroutines.launch
import java.io.File
import java.io.FileOutputStream

@Composable
fun ChatMediaActions(
    conversationId: String,
    session: SessionStore,
    enabled: Boolean = true,
    onBusyChanged: (Boolean) -> Unit = {},
    onStatus: (String?) -> Unit = {},
    onSent: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val repo = remember(session) { MediaMessageRepository(session) }
    var recorder by remember { mutableStateOf<MediaRecorder?>(null) }
    var recordingFile by remember { mutableStateOf<File?>(null) }
    var recording by remember { mutableStateOf(false) }
    var captureFile by remember { mutableStateOf<File?>(null) }

    suspend fun upload(file: File, mimeType: String, displayName: String) {
        onBusyChanged(true)
        onStatus("جاري الإرسال...")
        repo.sendFile(conversationId, file, mimeType, displayName)
            .onSuccess {
                onStatus("تم الإرسال")
                onSent()
            }
            .onFailure { onStatus(it.message ?: "تعذر إرسال الملف") }
        onBusyChanged(false)
    }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            runCatching { copyInlineUri(context, uri) }
                .onSuccess { file ->
                    upload(
                        file,
                        context.contentResolver.getType(uri) ?: "video/mp4",
                        inlineDisplayName(context, uri) ?: file.name
                    )
                }
                .onFailure { onStatus(it.message ?: "تعذر قراءة الفيديو") }
        }
    }

    val captureVideo = rememberLauncherForActivityResult(ActivityResultContracts.CaptureVideo()) { ok ->
        val file = captureFile
        if (ok && file != null && file.exists() && file.length() > 0L) {
            scope.launch { upload(file, "video/mp4", file.name) }
        } else {
            file?.delete()
        }
        captureFile = null
    }

    fun launchVideoCapture() {
        val file = newInlineMediaFile(context, "video", ".mp4")
        captureFile = file
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        captureVideo.launch(uri)
    }

    val cameraPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) launchVideoCapture() else onStatus("يجب السماح بالكاميرا لتسجيل الفيديو")
    }

    fun startRecording() {
        runCatching {
            val file = newInlineMediaFile(context, "voice", ".m4a")
            val r = createInlineRecorder(context, file)
            r.start()
            recorder = r
            recordingFile = file
            recording = true
            onStatus("جاري تسجيل الرسالة الصوتية... اضغط المايك مرة أخرى للإرسال")
        }.onFailure { onStatus(it.message ?: "تعذر بدء التسجيل") }
    }

    val audioPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) startRecording() else onStatus("يجب السماح بالمايكروفون لتسجيل الرسالة الصوتية")
    }

    DisposableEffect(Unit) {
        onDispose {
            runCatching { recorder?.stop() }
            runCatching { recorder?.release() }
        }
    }

    Row {
        IconButton(enabled = enabled, onClick = {
            if (recording) {
                val file = recordingFile
                runCatching { recorder?.stop() }.onFailure { file?.delete() }
                runCatching { recorder?.release() }
                recorder = null
                recordingFile = null
                recording = false
                if (file != null && file.exists() && file.length() > 0L) {
                    scope.launch { upload(file, "audio/mp4", file.name) }
                }
            } else if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                startRecording()
            } else {
                audioPermission.launch(Manifest.permission.RECORD_AUDIO)
            }
        }) {
            Icon(
                if (recording) Icons.Default.Stop else Icons.Default.Mic,
                contentDescription = if (recording) "إيقاف وإرسال التسجيل" else "تسجيل رسالة صوتية",
                tint = if (recording) MaterialTheme.colorScheme.error else Color(0xFF19D9A0)
            )
        }
        Spacer(Modifier.width(2.dp))
        IconButton(enabled = enabled && !recording, onClick = { picker.launch("video/*") }) {
            Icon(Icons.Default.VideoLibrary, "اختيار فيديو", tint = Color(0xFF19D9A0))
        }
        IconButton(enabled = enabled && !recording, onClick = {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                launchVideoCapture()
            } else {
                cameraPermission.launch(Manifest.permission.CAMERA)
            }
        }) {
            Icon(Icons.Default.Videocam, "تسجيل فيديو", tint = Color(0xFF19D9A0))
        }
    }
}

@Suppress("DEPRECATION")
private fun createInlineRecorder(context: Context, file: File): MediaRecorder {
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

private fun newInlineMediaFile(context: Context, prefix: String, suffix: String): File {
    val dir = File(context.cacheDir, "media").apply { mkdirs() }
    return File(dir, "$prefix-${System.currentTimeMillis()}$suffix")
}

private fun copyInlineUri(context: Context, uri: Uri): File {
    val name = inlineDisplayName(context, uri) ?: "video-${System.currentTimeMillis()}.mp4"
    val safe = name.replace(Regex("[^A-Za-z0-9._-]"), "_").takeLast(100)
    val file = File(File(context.cacheDir, "media").apply { mkdirs() }, "${System.currentTimeMillis()}-$safe")
    context.contentResolver.openInputStream(uri).use { input ->
        requireNotNull(input) { "تعذر فتح الملف" }
        FileOutputStream(file).use { output -> input.copyTo(output) }
    }
    return file
}

private fun inlineDisplayName(context: Context, uri: Uri): String? =
    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) cursor.getString(0) else null
    }
