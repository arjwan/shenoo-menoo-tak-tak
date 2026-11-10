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
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.CookieManager
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.shnomano.call.data.SessionStore
import org.json.JSONObject

class WebCallActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var audioManager: AudioManager
    private var targetUrl: String = ""
    private var pendingPermissionRequest: PermissionRequest? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private var pendingIncomingCall: IncomingCall? = null
    private var incomingGroupCall = false
    private var webPageReady = false
    private var autoAcceptIncoming = false
    private val mainHandler = Handler(Looper.getMainLooper())

    private val mediaPermissionLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        val granted = result.values.all { it }
        val request = pendingPermissionRequest
        pendingPermissionRequest = null
        if (granted) {
            prepareCallAudio()
            request?.grant(request.resources.filter { it == PermissionRequest.RESOURCE_AUDIO_CAPTURE || it == PermissionRequest.RESOURCE_VIDEO_CAPTURE }.toTypedArray())
        } else request?.deny()
    }

    private val screenConsent = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val consent = result.data
        if (result.resultCode == android.app.Activity.RESULT_OK && consent != null && !isFinishing) {
            ContextCompat.startForegroundService(this, Intent(this, ScreenShareService::class.java).apply {
                putExtra(ScreenShareService.EXTRA_RESULT, result.resultCode)
                putExtra(ScreenShareService.EXTRA_CONSENT, consent)
            })
        } else screenShareStopped("تم إلغاء مشاركة الشاشة")
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        currentActivity = java.lang.ref.WeakReference(this)
        window.statusBarColor = Color.rgb(4, 10, 8)
        window.navigationBarColor = Color.rgb(4, 10, 8)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        // Incoming ring remains active until the user answers.

        targetUrl = intent.getStringExtra(EXTRA_URL).orEmpty()
        incomingGroupCall = intent.getBooleanExtra(EXTRA_GROUP_CALL, false)
        pendingIncomingCall = incomingCallFrom(intent)
        autoAcceptIncoming = intent.getBooleanExtra(EXTRA_AUTO_ACCEPT, false)
        if (pendingIncomingCall != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(true)
                setTurnScreenOn(true)
            } else {
                @Suppress("DEPRECATION")
                window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
            }
        } else {
            prepareCallAudio()
        }
        if (!isTrustedUrl(targetUrl)) { finish(); return }

        val root = FrameLayout(this).apply { setBackgroundColor(Color.rgb(4, 10, 8)) }
        webView = WebView(this).apply {
            setBackgroundColor(Color.rgb(4, 10, 8))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.cacheMode = WebSettings.LOAD_NO_CACHE
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            addJavascriptInterface(CallStateBridge(), "ShnoAndroidCall")
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView?, request: android.webkit.WebResourceRequest?): android.webkit.WebResourceResponse? {
                    if (request == null || request.method != "GET" || !isTrustedUrl(request.url.toString())) return null
                    val name = request.url.path?.removePrefix("/") ?: return null
                    if (name !in packagedCallFiles) return null
                    val mime = when {
                        name.endsWith(".html") -> "text/html"
                        name.endsWith(".css") -> "text/css"
                        name.endsWith(".js") -> "text/javascript"
                        else -> "application/json"
                    }
                    return android.webkit.WebResourceResponse(mime, "UTF-8", 200, "OK",
                        mapOf("Cache-Control" to "no-store", "X-Shno-Call-UI" to buildIdentity()),
                        assets.open("call-web/$name"))
                }

                override fun shouldOverrideUrlLoading(view: WebView?, request: android.webkit.WebResourceRequest?): Boolean =
                    !isTrustedUrl(request?.url?.toString().orEmpty())

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    if (isTrustedUrl(url.orEmpty())) {
                        webPageReady = true
                        if (!incomingGroupCall) deliverPendingIncomingCall()
                    }
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun getDefaultVideoPoster(): android.graphics.Bitmap =
                    android.graphics.Bitmap.createBitmap(1, 1, android.graphics.Bitmap.Config.ARGB_8888)

                override fun onPermissionRequest(request: PermissionRequest) {
                    runOnUiThread {
                        if (request.origin.toString().trimEnd('/') != "https://shinomino.com") { request.deny(); return@runOnUiThread }
                        val resources = request.resources.filter { it == PermissionRequest.RESOURCE_AUDIO_CAPTURE || it == PermissionRequest.RESOURCE_VIDEO_CAPTURE }.toTypedArray()
                        if (resources.isEmpty()) { request.deny(); return@runOnUiThread }
                        val missing = mutableListOf<String>()
                        if (request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE) && ContextCompat.checkSelfPermission(this@WebCallActivity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) missing += Manifest.permission.RECORD_AUDIO
                        if (request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE) && ContextCompat.checkSelfPermission(this@WebCallActivity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) missing += Manifest.permission.CAMERA
                        if (missing.isEmpty()) { prepareCallAudio(); request.grant(resources) }
                        else { pendingPermissionRequest?.deny(); pendingPermissionRequest = request; mediaPermissionLauncher.launch(missing.toTypedArray()) }
                    }
                }
            }
        }
        root.addView(webView, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))


        setContentView(root)
        // Use this app's private session for its embedded call window.
        val cookie = SessionStore(this).sessionCookie
        if (cookie.isNullOrBlank()) {
            Toast.makeText(this, "انتهت جلسة اتصال. يرجى تسجيل الدخول من التطبيق.", Toast.LENGTH_LONG).show()
            finish()
            return
        }
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setCookie(
            "https://shinomino.com",
            "__Host-shino_session=$cookie; Path=/; Secure; HttpOnly; SameSite=Lax"
        ) { accepted ->
            if (accepted && !isFinishing) webView.loadUrl(targetUrl) else finish()
        }
        // setCookie is asynchronous; load only after the session is available.

    }

    private fun invokeCallControl(selector: String): Boolean {
        if (!webPageReady || !::webView.isInitialized) {
            Toast.makeText(this, "الاتصال لم يجهز بعد", Toast.LENGTH_SHORT).show()
            return false
        }
        val quoted = JSONObject.quote(selector)
        webView.evaluateJavascript(
            "(function(){return typeof window.shnoClickCallControl==='function'&&window.shnoClickCallControl($quoted);})()"
        ) { result ->
            if (result != "true") Toast.makeText(this, "تعذر تنفيذ الإجراء؛ لا تزال المكالمة قيد التحميل", Toast.LENGTH_SHORT).show()
        }
        return true
    }

    private val packagedCallFiles by lazy { assets.list("call-web")?.toSet().orEmpty() }

    @Suppress("DEPRECATION")
    private fun buildIdentity(): String {
        val info = packageManager.getPackageInfo(packageName, 0)
        val code = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()
        return "${info.versionName} ($code)"
    }

    private inner class CallStateBridge {
        @JavascriptInterface fun getBuildInfo(): String = buildIdentity()

        @JavascriptInterface fun startScreenShare() = runOnUiThread {
            if (!isFinishing) screenConsent.launch(getSystemService(android.media.projection.MediaProjectionManager::class.java).createScreenCaptureIntent())
        }
        @JavascriptInterface fun stopScreenShare() = runOnUiThread {
            stopService(Intent(this@WebCallActivity, ScreenShareService::class.java))
        }

        @JavascriptInterface fun setSpeaker(speaker: Boolean) = runOnUiThread {
            prepareCallAudio()
            setAudioRoute(speaker)
        }
        @JavascriptInterface fun onCallState(json: String) = runOnUiThread {
            val state = runCatching { JSONObject(json) }.getOrNull() ?: return@runOnUiThread
            val callId = state.optString("callId")
            when (state.optString("state")) {
                "outgoing", "accepting", "connected" -> {
                    BackgroundRealtimeService.acknowledgeIncomingCall(callId)
                    prepareCallAudio()
                    BackgroundRealtimeService.trackActiveCall(state, webView.url ?: targetUrl)
                }
                "ended" -> {
                    BackgroundRealtimeService.acknowledgeIncomingCall(callId)
                    BackgroundRealtimeService.clearActiveCall(callId)
                    if (!isFinishing) finish()
                }
            }
        }
    }

    private fun prepareCallAudio() {
        BackgroundRealtimeService.refreshCaptureForeground()
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
    }

    private fun incomingCallFrom(source: Intent): IncomingCall? {
        if (!source.getBooleanExtra(EXTRA_INCOMING, false)) return null
        val callId = source.getStringExtra(EXTRA_CALL_ID).orEmpty()
        val from = source.getStringExtra(EXTRA_FROM).orEmpty()
        val conversationId = source.getStringExtra(EXTRA_CONVERSATION_ID).orEmpty().ifBlank { callId }
        val type = source.getStringExtra(EXTRA_CALL_TYPE).orEmpty().takeIf { it == "audio" || it == "video" } ?: "audio"
        if (callId.isBlank() || from.isBlank()) return null
        return IncomingCall(callId, from, conversationId, type, source.getStringExtra(EXTRA_CALLER_NAME).orEmpty().ifBlank { "مستخدم شنو منو" })
    }

    private fun deliverPendingIncomingCall() {
        val call = pendingIncomingCall ?: return
        if (incomingGroupCall || !webPageReady || !::webView.isInitialized) return
        val payload = JSONObject().apply { put("callId", call.callId); put("from", call.from); put("conversationId", call.conversationId); put("type", call.type); put("callerName", call.callerName) }.toString()
        webView.evaluateJavascript("(function(){var p=$payload;if(typeof window.shnoHandleIncomingCall==='function'){return window.shnoHandleIncomingCall(p)?'ready':'waiting';}return 'waiting';})()") { result ->
            if (result == "\"ready\"") {
                pendingIncomingCall = null
                if (autoAcceptIncoming) {
                    autoAcceptIncoming = false
                    invokeCallControl("[data-call-accept]")
                    prepareCallAudio()
                }
            }
            else if (!isFinishing && pendingIncomingCall != null) mainHandler.postDelayed({ deliverPendingIncomingCall() }, 250)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        incomingGroupCall = intent.getBooleanExtra(EXTRA_GROUP_CALL, false)
        incomingCallFrom(intent)?.let { call ->
            pendingIncomingCall = call
            autoAcceptIncoming = intent.getBooleanExtra(EXTRA_AUTO_ACCEPT, false)
            targetUrl = intent.getStringExtra(EXTRA_URL).orEmpty().ifBlank { targetUrl }
            if (!incomingGroupCall) deliverPendingIncomingCall()
        }
    }



    private fun isTrustedUrl(url: String): Boolean {
        val parsed = Uri.parse(url)
        return parsed.scheme == "https" && parsed.host == "shinomino.com" && parsed.port in listOf(-1, 443)
    }

    override fun onBackPressed() {
        webView.evaluateJavascript("window.shnoEndCall&&window.shnoEndCall()", null)
    }

    override fun onDestroy() {
        stopService(Intent(this, ScreenShareService::class.java))
        mainHandler.removeCallbacksAndMessages(null); pendingPermissionRequest?.deny(); pendingPermissionRequest = null
        if (::webView.isInitialized) { webView.stopLoading(); webView.loadUrl("about:blank"); webView.removeAllViews(); webView.destroy() }
        if (::audioManager.isInitialized) releaseCallAudio()
        if (currentActivity?.get() === this) currentActivity = null
        super.onDestroy()
    }

    companion object {
        private val framePending = java.util.concurrent.atomic.AtomicBoolean(false)
        private var currentActivity: java.lang.ref.WeakReference<WebCallActivity>? = null
        fun screenShareFrame(base64: String, width: Int, height: Int) {
            val activity = currentActivity?.get() ?: return
            if (!framePending.compareAndSet(false, true)) return
            activity.runOnUiThread {
                if (!activity.isFinishing && !activity.isDestroyed) activity.webView.evaluateJavascript(
                    "window.ShnoScreenShare&&window.ShnoScreenShare.onNativeFrame('" + base64 + "'," + width + "," + height + ")") { framePending.set(false) }
                else framePending.set(false)
            }
        }
        fun screenShareStopped(message: String) {
            val activity = currentActivity?.get() ?: return
            activity.runOnUiThread {
                if (!activity.isFinishing && !activity.isDestroyed) activity.webView.evaluateJavascript(
                    "window.ShnoScreenShare&&window.ShnoScreenShare.onNativeStopped(" + JSONObject.quote(message) + ")", null)
            }
        }
        fun endActiveCall(): Boolean {
            val activity = currentActivity?.get() ?: return false
            activity.runOnUiThread { activity.webView.evaluateJavascript("window.shnoEndCall&&window.shnoEndCall()", null) }
            return true
        }

        const val EXTRA_URL = "url"
        const val EXTRA_AUTO_ACCEPT = "auto_accept"
        const val EXTRA_INCOMING = "incoming_call"
        const val EXTRA_GROUP_CALL = "group_call"
        const val EXTRA_CALL_ID = "call_id"
        const val EXTRA_FROM = "from"
        const val EXTRA_CONVERSATION_ID = "conversation_id"
        const val EXTRA_CALL_TYPE = "call_type"
        const val EXTRA_CALLER_NAME = "caller_name"
    }
}
