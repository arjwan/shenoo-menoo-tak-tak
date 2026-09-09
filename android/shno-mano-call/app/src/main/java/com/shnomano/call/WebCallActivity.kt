package com.shnomano.call

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.Toast
import android.app.AlertDialog
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.shnomano.call.data.AppRepository
import com.shnomano.call.data.SessionStore
import kotlinx.coroutines.launch
import org.json.JSONObject

class WebCallActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var audioManager: AudioManager
    private var targetUrl: String = ""
    private var bootstrapped = false
    private var pendingPermissionRequest: PermissionRequest? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private var ringbackTone: ToneGenerator? = null
    private var pendingIncomingCall: IncomingCall? = null
    private var webPageReady = false
    private var speakerRouteButton: Button? = null
    private var earpieceRouteButton: Button? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    private val mediaPermissionLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        val granted = result.values.all { it }
        val request = pendingPermissionRequest
        pendingPermissionRequest = null
        if (granted) {
            prepareCallAudio()
            request?.grant(request.resources)
        } else request?.deny()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(4, 10, 8)
        window.navigationBarColor = Color.rgb(4, 10, 8)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        prepareCallAudio()

        targetUrl = intent.getStringExtra(EXTRA_URL).orEmpty()
        pendingIncomingCall = incomingCallFrom(intent)
        if (targetUrl.isBlank()) { finish(); return }
        pendingIncomingCall?.let { BackgroundRealtimeService.acknowledgeIncomingCall(it.callId) }

        val root = FrameLayout(this).apply { setBackgroundColor(Color.rgb(4, 10, 8)) }
        webView = WebView(this).apply {
            setBackgroundColor(Color.rgb(4, 10, 8))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            addJavascriptInterface(CallStateBridge(), "ShnoAndroidCall")
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    prepareCallAudio()
                    if (!bootstrapped && url?.contains("signin.html") == true) {
                        bootstrapped = true
                        val tokenJs = JSONObject.quote(SessionStore(this@WebCallActivity).token.orEmpty())
                        val targetJs = JSONObject.quote(targetUrl)
                        evaluateJavascript("localStorage.setItem('token',$tokenJs);sessionStorage.setItem('token',$tokenJs);location.replace($targetJs);", null)
                        return
                    }
                    if (url?.contains("messages.html") == true) {
                        webPageReady = true
                        injectCallStage()
                        webView.visibility = View.VISIBLE
                        deliverPendingIncomingCall()
                    }
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) {
                    runOnUiThread {
                        val missing = mutableListOf<String>()
                        if (request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE) && ContextCompat.checkSelfPermission(this@WebCallActivity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) missing += Manifest.permission.RECORD_AUDIO
                        if (request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE) && ContextCompat.checkSelfPermission(this@WebCallActivity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) missing += Manifest.permission.CAMERA
                        if (missing.isEmpty()) { prepareCallAudio(); request.grant(request.resources) }
                        else { pendingPermissionRequest = request; mediaPermissionLauncher.launch(missing.toTypedArray()) }
                    }
                }
            }
        }
        root.addView(webView, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))

        val close = controlButton("⌄") { minimizeCall() }
        root.addView(close, FrameLayout.LayoutParams(60, 60).apply { gravity = Gravity.TOP or Gravity.END; topMargin = 18; marginEnd = 18 })

        val settings = controlButton("⚙") { showCallSettings() }
        root.addView(settings, FrameLayout.LayoutParams(68, 60).apply { gravity = Gravity.TOP or Gravity.START; topMargin = 18; marginStart = 18 })

        val audioRoutes = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(8, 4, 8, 4)
            val speakerButton = controlButton("🔊 صوت عالي") { setAudioRoute(true) }
            val earpieceButton = controlButton("📱 صوت الهاتف") { setAudioRoute(false) }
            speakerRouteButton = speakerButton
            earpieceRouteButton = earpieceButton
            addView(speakerButton)
            addView(earpieceButton)
        }
        root.addView(audioRoutes, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT).apply {
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            bottomMargin = 86
        })

        val tools = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(8, 8, 8, 8)
            addView(controlButton("↔ تبديل") { webView.evaluateJavascript("window.shnoSwapVideo&&window.shnoSwapVideo()", null) })
            addView(controlButton("⛶ تكبير") { webView.evaluateJavascript("window.shnoToggleVideoSize&&window.shnoToggleVideoSize()", null) })
            addView(controlButton("＋ مشارك") { showParticipantPicker() })
        }
        root.addView(tools, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT).apply {
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            bottomMargin = 28
        })

        setContentView(root)
        webView.visibility = View.INVISIBLE
        webView.loadUrl("https://shino-mino-tak-tak.duckdns.org/signin.html")
    }

    private fun controlButton(label: String, click: () -> Unit) = Button(this).apply {
        text = label
        textSize = 13f
        setTextColor(Color.WHITE)
        setBackgroundColor(Color.argb(220, 16, 32, 27))
        setOnClickListener { click() }
        minWidth = 0
        minHeight = 0
        setPadding(18, 10, 18, 10)
    }

    private fun showParticipantPicker() {
        if (!webPageReady) {
            Toast.makeText(this, "انتظر حتى يتم إنشاء المكالمة", Toast.LENGTH_SHORT).show()
            return
        }
        lifecycleScope.launch {
            val friends = AppRepository(this@WebCallActivity).loadFriends().filter { it.userId.isNotBlank() }
            if (friends.isEmpty()) {
                Toast.makeText(this@WebCallActivity, "لا يوجد أصدقاء متاحون للإضافة", Toast.LENGTH_SHORT).show()
                return@launch
            }
            val labels = friends.map { friend ->
                val state = if (PresenceStore.onlineUserIds.value.contains(friend.userId)) " · متصل الآن" else " · غير متصل"
                friend.displayName + state
            }.toTypedArray()
            AlertDialog.Builder(this@WebCallActivity)
                .setTitle("إضافة مشارك إلى المكالمة")
                .setItems(labels) { _, which ->
                    val friend = friends[which]
                    if (!PresenceStore.onlineUserIds.value.contains(friend.userId)) {
                        Toast.makeText(this@WebCallActivity, "${friend.displayName} غير متصل الآن", Toast.LENGTH_SHORT).show()
                        return@setItems
                    }
                    val userId = JSONObject.quote(friend.userId)
                    webView.evaluateJavascript(
                        "(function(){if(typeof window.shnoAddParticipant!=='function')return 'not-ready';return window.shnoAddParticipant($userId);})()"
                    ) { result ->
                        if (result?.contains("not-ready") == true) {
                            Toast.makeText(this@WebCallActivity, "تعذر إضافة المشارك الآن", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
                .setNegativeButton("إلغاء", null)
                .show()
        }
    }

    private fun injectCallStage() {
        val js = """
            (function(){
              if(window.__shnoCallStageReady) return;
              window.__shnoCallStageReady=true;
              var style=document.createElement('style');
              style.textContent=`
                body{margin:0!important;background:#050b09!important;overflow:hidden!important}
                body>*:not([data-call-modal]){display:none!important}
                [data-call-modal][hidden]{display:none!important}
                [data-call-modal]{position:fixed!important;inset:0!important;display:flex!important;align-items:center!important;justify-content:center!important;background:#050b09!important;z-index:9999!important}
                [data-call-modal] [data-remote-video]{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;object-fit:cover!important;background:#050b09!important;border-radius:0!important;z-index:1!important}
                [data-call-modal] [data-local-video]{position:fixed!important;right:18px!important;top:96px!important;width:30vw!important;max-width:170px!important;height:22vh!important;object-fit:cover!important;border-radius:18px!important;border:2px solid rgba(255,255,255,.65)!important;z-index:5!important;box-shadow:0 12px 36px rgba(0,0,0,.45)!important}
                [data-call-modal].shno-swap [data-local-video]{inset:0!important;width:100vw!important;max-width:none!important;height:100vh!important;border:0!important;border-radius:0!important;z-index:1!important}
                [data-call-modal].shno-swap [data-remote-video]{right:18px!important;left:auto!important;top:96px!important;bottom:auto!important;width:30vw!important;height:22vh!important;border-radius:18px!important;border:2px solid rgba(255,255,255,.65)!important;z-index:5!important}
                [data-call-modal].shno-focus [data-local-video]{width:46vw!important;max-width:240px!important;height:34vh!important}
              `;
              document.head.appendChild(style);
              document.querySelectorAll('header,main,nav,aside,footer').forEach(function(el){el.style.display='none'});
              window.shnoSwapVideo=function(){var m=document.querySelector('[data-call-modal]');if(m)m.classList.toggle('shno-swap')};
              window.shnoToggleVideoSize=function(){var m=document.querySelector('[data-call-modal]');if(m)m.classList.toggle('shno-focus')};
              var modal=document.querySelector('[data-call-modal]');
              var status=document.querySelector('[data-call-status]');
              var feedback=document.querySelector('[data-message-feedback]');
              var terminal=/انتهت المكالمة|لا يوجد رد|تعذر الاتصال|تعذر الوصول|رفض|غير متصل|مشغول/;
              var report=function(){
                var text=(status&&status.textContent||'').trim();
                if(text) ShnoAndroidCall.onState(text);
                if(modal&&modal.hidden){
                  var done=(feedback&&feedback.textContent||'').trim();
                  if(terminal.test(done)) ShnoAndroidCall.onEnded(done);
                  else modal.hidden=false;
                }
              };
              if(modal||status||feedback){
                new MutationObserver(report).observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});
                report();
              }
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    private inner class CallStateBridge {
        @JavascriptInterface fun onState(state: String) = runOnUiThread {
            when {
                state.contains("يرن") -> startRingback()
                state.contains("متصل") || state.contains("واردة") || state.contains("إنشاء") -> stopRingback()
            }
        }

        @JavascriptInterface fun onEnded(message: String) = runOnUiThread {
            stopRingback()
            if (message.contains("غير متصل") || message.contains("مشغول")) Toast.makeText(this@WebCallActivity, message, Toast.LENGTH_LONG).show()
            if (!isFinishing) finish()
        }
    }

    private fun startRingback() {
        if (!SettingsStore(this).callSoundEnabled || ringbackTone != null) return
        ringbackTone = runCatching { ToneGenerator(AudioManager.STREAM_VOICE_CALL, 70).also { it.startTone(ToneGenerator.TONE_SUP_RINGTONE) } }.getOrNull()
    }

    private fun stopRingback() { ringbackTone?.stopTone(); ringbackTone?.release(); ringbackTone = null }

    private fun prepareCallAudio() {
        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
        applyAudioRoute(SettingsStore(this).speakerphoneEnabled)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (audioFocusRequest == null) {
                val attrs = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
                audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(attrs).setAcceptsDelayedFocusGain(false).setOnAudioFocusChangeListener { }.build()
            }
            audioFocusRequest?.let { audioManager.requestAudioFocus(it) }
        } else {
            @Suppress("DEPRECATION")
            audioManager.requestAudioFocus(null, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
        }
    }

    private fun releaseCallAudio() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
        else { @Suppress("DEPRECATION") audioManager.abandonAudioFocus(null) }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) runCatching { audioManager.clearCommunicationDevice() }
        @Suppress("DEPRECATION") runCatching { audioManager.stopBluetoothSco() }
        audioManager.mode = AudioManager.MODE_NORMAL
        @Suppress("DEPRECATION") runCatching { audioManager.isSpeakerphoneOn = false }
    }

    private fun setAudioRoute(speaker: Boolean) { SettingsStore(this).speakerphoneEnabled = speaker; applyAudioRoute(speaker) }

    private fun applyAudioRoute(speaker: Boolean) {
        if (!::audioManager.isInitialized) return
        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
        var selected = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val wantedType = if (speaker) android.media.AudioDeviceInfo.TYPE_BUILTIN_SPEAKER else android.media.AudioDeviceInfo.TYPE_BUILTIN_EARPIECE
            val device = audioManager.availableCommunicationDevices.firstOrNull { it.type == wantedType }
            if (device != null) selected = audioManager.setCommunicationDevice(device)
        }
        @Suppress("DEPRECATION")
        if (!selected || Build.VERSION.SDK_INT < Build.VERSION_CODES.S) audioManager.isSpeakerphoneOn = speaker
        speakerRouteButton?.text = if (speaker) "🔊 صوت عالي ✓" else "🔊 صوت عالي"
        earpieceRouteButton?.text = if (!speaker) "📱 صوت الهاتف ✓" else "📱 صوت الهاتف"
    }

    private fun incomingCallFrom(source: Intent): IncomingCall? {
        if (!source.getBooleanExtra(EXTRA_INCOMING, false)) return null
        val callId = source.getStringExtra(EXTRA_CALL_ID).orEmpty()
        val from = source.getStringExtra(EXTRA_FROM).orEmpty()
        val conversationId = source.getStringExtra(EXTRA_CONVERSATION_ID).orEmpty()
        val type = source.getStringExtra(EXTRA_CALL_TYPE).orEmpty().takeIf { it == "audio" || it == "video" } ?: "audio"
        if (callId.isBlank() || from.isBlank() || conversationId.isBlank()) return null
        return IncomingCall(callId, from, conversationId, type, source.getStringExtra(EXTRA_CALLER_NAME).orEmpty().ifBlank { "مستخدم شنو منو" })
    }

    private fun deliverPendingIncomingCall() {
        val call = pendingIncomingCall ?: return
        if (!webPageReady || !::webView.isInitialized) return
        val payload = JSONObject().apply { put("callId", call.callId); put("from", call.from); put("conversationId", call.conversationId); put("type", call.type); put("callerName", call.callerName) }.toString()
        webView.evaluateJavascript("(function(){var p=$payload;if(typeof window.shnoHandleIncomingCall==='function'){window.shnoHandleIncomingCall(p);return 'ready';}return 'waiting';})()") { result ->
            if (result?.contains("ready") == true) { BackgroundRealtimeService.acknowledgeIncomingCall(call.callId); pendingIncomingCall = null }
            else mainHandler.postDelayed({ deliverPendingIncomingCall() }, 250)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent); setIntent(intent)
        incomingCallFrom(intent)?.let { call -> pendingIncomingCall = call; targetUrl = intent.getStringExtra(EXTRA_URL).orEmpty().ifBlank { targetUrl }; BackgroundRealtimeService.acknowledgeIncomingCall(call.callId); deliverPendingIncomingCall() }
    }

    override fun onResume() { super.onResume(); if (::audioManager.isInitialized) prepareCallAudio() }

    private fun showCallSettings() {
        val choices = arrayOf("السماعة الخارجية", "سماعة المكالمات", "إعدادات النغمة والإشعارات")
        AlertDialog.Builder(this).setTitle("إعدادات المكالمة").setItems(choices) { _, which ->
            when (which) { 0 -> setAudioRoute(true); 1 -> setAudioRoute(false); 2 -> startActivity(Intent(this, SettingsActivity::class.java)) }
        }.setNegativeButton("إلغاء", null).show()
    }

    override fun onBackPressed() { Toast.makeText(this, "لإنهاء المكالمة استخدم زر إنهاء المكالمة الأحمر", Toast.LENGTH_SHORT).show() }

    private fun minimizeCall() { Toast.makeText(this, "المكالمة مستمرة في الخلفية", Toast.LENGTH_SHORT).show(); moveTaskToBack(true) }

    override fun onDestroy() {
        stopRingback(); mainHandler.removeCallbacksAndMessages(null); pendingPermissionRequest?.deny(); pendingPermissionRequest = null
        if (::webView.isInitialized) { webView.stopLoading(); webView.loadUrl("about:blank"); webView.removeAllViews(); webView.destroy() }
        if (::audioManager.isInitialized) releaseCallAudio()
        super.onDestroy()
    }

    companion object {
        const val EXTRA_URL = "url"
        const val EXTRA_INCOMING = "incoming_call"
        const val EXTRA_CALL_ID = "call_id"
        const val EXTRA_FROM = "from"
        const val EXTRA_CONVERSATION_ID = "conversation_id"
        const val EXTRA_CALL_TYPE = "call_type"
        const val EXTRA_CALLER_NAME = "caller_name"
    }
}
