package com.shnomano.call

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.media.ToneGenerator
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.CookieManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
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
    private var pendingPermissionRequest: PermissionRequest? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private var ringbackTone: ToneGenerator? = null
    private var ringbackRingtone: Ringtone? = null
    private var pendingIncomingCall: IncomingCall? = null
    private var incomingGroupCall = false
    private var webPageReady = false
    private var speakerRouteButton: Button? = null
    private var earpieceRouteButton: Button? = null
    private var callNameLabel: TextView? = null
    private var callStatusLabel: TextView? = null
    private var incomingActions: LinearLayout? = null
    private var muteControl: Button? = null
    private var muted = false
    private var callType = "audio"
    private var callSurface: FrameLayout? = null
    private var connectedAt = 0L
    private var autoAcceptIncoming = false
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
        // Incoming ring remains active until the user answers.

        targetUrl = intent.getStringExtra(EXTRA_URL).orEmpty()
        incomingGroupCall = intent.getBooleanExtra(EXTRA_GROUP_CALL, false)
        pendingIncomingCall = incomingCallFrom(intent)
        callType = pendingIncomingCall?.type ?: if (targetUrl.contains("call=video")) "video" else "audio"
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
        if (targetUrl.isBlank()) { finish(); return }

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
                    if (url?.contains("messages.html") == true) {
                        webPageReady = true
                        injectCallStage()
                        webView.visibility = View.VISIBLE
                        if (!incomingGroupCall) deliverPendingIncomingCall()
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


        // The web view owns WebRTC media; one native, always-visible call UI
        // owns presentation and controls for both outgoing and incoming calls.
        val tint = GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            intArrayOf(Color.rgb(18, 13, 25), Color.rgb(56, 30, 51), Color.rgb(8, 13, 23))
        )
        val surface = FrameLayout(this).apply {
            background = tint
            if (callType == "video") setBackgroundColor(Color.TRANSPARENT)
        }
        root.addView(surface, FrameLayout.LayoutParams(-1, -1))
        callSurface = surface

        val heading = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(20), dp(22), dp(20), dp(22))
        }
        callNameLabel = TextView(this).apply {
            text = pendingIncomingCall?.callerName ?: "شنو منو اتصال"
            textSize = 30f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            maxLines = 2
        }
        callStatusLabel = TextView(this).apply {
            text = if (pendingIncomingCall != null) "مكالمة واردة" else "جارٍ الاتصال…"
            textSize = 16f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(218, 213, 222))
        }
        heading.addView(callNameLabel)
        heading.addView(callStatusLabel)
        surface.addView(heading, FrameLayout.LayoutParams(-1, -2).apply {
            gravity = Gravity.TOP
            topMargin = dp(68)
        })

        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(12), dp(8), dp(12), dp(24))
        }
        val first = LinearLayout(this).apply { gravity = Gravity.CENTER }
        val second = LinearLayout(this).apply { gravity = Gravity.CENTER }
        val white = Color.WHITE
        val outline = Color.argb(190, 226, 221, 231)
        val mute = circleAction("♩", "كتم الصوت", outline) {
            if (invokeCallControl("[data-call-mute]")) muted = !muted
        }
        first.addView(mute, LinearLayout.LayoutParams(0, -2, 1f))
        first.addView(circleAction("▦", "تقسيم الشاشة", outline) {
            if (callType == "video" && webPageReady)
                webView.evaluateJavascript("window.shnoSplitVideo&&window.shnoSplitVideo()", null)
            else Toast.makeText(this, "تقسيم الشاشة متاح أثناء مكالمة الفيديو", Toast.LENGTH_SHORT).show()
        }, LinearLayout.LayoutParams(0, -2, 1f))
        first.addView(circleAction("◖))", "السماعة", white) {
            setAudioRoute(!SettingsStore(this).speakerphoneEnabled)
        }, LinearLayout.LayoutParams(0, -2, 1f))
        second.addView(circleAction("+", "إضافة مشارك", outline) {
            showParticipantPicker()
        }, LinearLayout.LayoutParams(0, -2, 1f))
        second.addView(circleAction("▣", "فيديو / صوت", outline) {
            if (!webPageReady) {
                Toast.makeText(this, "انتظر اتصال المكالمة", Toast.LENGTH_SHORT).show()
            } else {
                val nextMode = if (callType == "video") "audio" else "video"
                webView.evaluateJavascript(
                    "(function(){if(!window.shnoSwitchCallMedia)return 'false';window.shnoSwitchCallMedia('$nextMode');return 'true'})()"
                ) { result ->
                    if (result != "\"true\"") Toast.makeText(this, "التحويل غير متاح قبل اتصال الطرفين", Toast.LENGTH_SHORT).show()
                }
            }
        }, LinearLayout.LayoutParams(0, -2, 1f))
        second.addView(circleAction("♙", "جهات الاتصال", outline) {
            showParticipantPicker()
        }, LinearLayout.LayoutParams(0, -2, 1f))
        controls.addView(first)
        controls.addView(second)
        val incoming = LinearLayout(this).apply {
            gravity = Gravity.CENTER
            setPadding(0, dp(12), 0, 0)
        }
        incoming.addView(controlButton("✓ قبول") {
            if (invokeCallControl("[data-call-accept]")) {
                prepareCallAudio()
                callStatusLabel?.text = "جارٍ إنشاء الاتصال…"
            }
        }, LinearLayout.LayoutParams(0, dp(52), 1f))
        incoming.addView(controlButton("✕ رفض") {
            invokeCallControl("[data-call-reject]")
            stopRingback()
            finish()
        }, LinearLayout.LayoutParams(0, dp(52), 1f))
        incoming.visibility = if (pendingIncomingCall != null) View.VISIBLE else View.GONE
        incomingActions = incoming
        controls.addView(incoming)

        val endContainer = LinearLayout(this).apply {
            gravity = Gravity.CENTER
            setPadding(0, dp(24), 0, 0)
        }
        endContainer.addView(Button(this).apply {
            text = "☎"
            textSize = 32f
            setTextColor(Color.WHITE)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.rgb(228, 56, 44))
            }
            setOnClickListener {
                if (incomingActions?.visibility == View.VISIBLE) invokeCallControl("[data-call-reject]")
                else invokeCallControl("[data-call-end]")
                stopRingback()
                finish()
            }
        }, LinearLayout.LayoutParams(dp(84), dp(84)))
        controls.addView(endContainer)
        surface.addView(controls, FrameLayout.LayoutParams(-1, -2).apply {
            gravity = Gravity.BOTTOM
            bottomMargin = dp(54)
        })

        setContentView(root)
        webView.visibility = View.INVISIBLE
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
        )
        CookieManager.getInstance().flush()
        webView.loadUrl(targetUrl)
    }

    private fun invokeCallControl(selector: String): Boolean {
        if (!webPageReady || !::webView.isInitialized) {
            Toast.makeText(this, "الاتصال لم يجهز بعد", Toast.LENGTH_SHORT).show()
            return false
        }
        val quoted = JSONObject.quote(selector)
        webView.evaluateJavascript(
            "(function(){var button=document.querySelector($quoted);if(!button)return false;button.click();return true;})()"
        ) { result ->
            if (result != "true") Toast.makeText(this, "تعذر تنفيذ الإجراء؛ لا تزال المكالمة قيد التحميل", Toast.LENGTH_SHORT).show()
        }
        return true
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density + 0.5f).toInt()

    private fun circleAction(symbol: String, caption: String, ringColor: Int, action: () -> Unit): LinearLayout {
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(2), dp(10), dp(2), dp(10))
        }
        val button = Button(this).apply {
            text = symbol
            textSize = 27f
            setTextColor(Color.WHITE)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(if (ringColor == Color.WHITE) Color.WHITE else Color.argb(38, 255, 255, 255))
                setStroke(dp(1), ringColor)
            }
            if (ringColor == Color.WHITE) setTextColor(Color.BLACK)
            setPadding(0, 0, 0, 0)
            setOnClickListener { action() }
        }
        column.addView(button, LinearLayout.LayoutParams(dp(70), dp(70)))
        column.addView(TextView(this).apply {
            text = caption
            textSize = 12f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, dp(8), 0, 0)
        })
        return column
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
                        if (result?.contains("not-ready") == true) Toast.makeText(this@WebCallActivity, "تعذر إضافة المشارك الآن", Toast.LENGTH_SHORT).show()
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
                body{margin:0!important;background:#050b09!important}
                /* Keep page content available while the call is being prepared. */
                [data-call-modal][hidden]{display:none!important}
                [data-call-modal] .call-controls,[data-call-modal] .incoming-call-actions,[data-call-modal] [data-call-name],[data-call-modal] [data-call-status]{visibility:hidden!important}
                [data-call-modal]{position:fixed!important;inset:0!important;display:flex!important;align-items:center!important;justify-content:center!important;background:#050b09!important;z-index:9999!important}
                [data-call-modal] [data-remote-video]{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;object-fit:cover!important;background:#050b09!important;border-radius:0!important;z-index:1!important}
                [data-call-modal] [data-local-video]{position:fixed!important;right:18px!important;top:96px!important;width:30vw!important;max-width:170px!important;height:22vh!important;object-fit:cover!important;border-radius:18px!important;border:2px solid rgba(255,255,255,.65)!important;z-index:5!important;box-shadow:0 12px 36px rgba(0,0,0,.45)!important}
                [data-call-modal].shno-swap [data-local-video]{inset:0!important;width:100vw!important;max-width:none!important;height:100vh!important;border:0!important;border-radius:0!important;z-index:1!important}
                [data-call-modal].shno-swap [data-remote-video]{right:18px!important;left:auto!important;top:96px!important;bottom:auto!important;width:30vw!important;height:22vh!important;border-radius:18px!important;border:2px solid rgba(255,255,255,.65)!important;z-index:5!important}
                [data-call-modal].shno-focus [data-local-video]{width:46vw!important;max-width:240px!important;height:34vh!important}
                [data-call-modal].shno-split [data-remote-video]{position:fixed!important;top:8vh!important;right:0!important;left:auto!important;width:50vw!important;height:76vh!important;object-fit:contain!important;border:1px solid #6a6570!important;border-radius:12px!important;z-index:5!important}
                [data-call-modal].shno-split [data-local-video]{position:fixed!important;top:8vh!important;right:auto!important;left:0!important;width:50vw!important;max-width:none!important;height:76vh!important;object-fit:contain!important;border:1px solid #6a6570!important;border-radius:12px!important;z-index:5!important}
              `;
              document.head.appendChild(style);
              window.shnoSplitVideo=function(){var m=document.querySelector('[data-call-modal]');if(m)m.classList.toggle('shno-split')};
              window.shnoSwapVideo=function(){var m=document.querySelector('[data-call-modal]');if(m)m.classList.toggle('shno-swap')};
              window.shnoToggleVideoSize=function(){var m=document.querySelector('[data-call-modal]');if(m)m.classList.toggle('shno-focus')};
              var modal=document.querySelector('[data-call-modal]');
              var status=document.querySelector('[data-call-status]');
              var feedback=document.querySelector('[data-message-feedback]');
              var terminal=/انتهت المكالمة|لا يوجد رد|تعذر الاتصال|تعذر الوصول|رفض|غير متصل|مشغول/;
              var report=function(){
                var text=(status&&status.textContent||'').trim();
                if(text) ShnoAndroidCall.onState(text);
                if(typeof window.shnoGetCallMediaType==='function'){var media=window.shnoGetCallMediaType();if(media)ShnoAndroidCall.onMediaType(media)}
                var name=document.querySelector('[data-call-name]');
                if(name&&name.textContent)ShnoAndroidCall.onName(name.textContent.trim());
                var accept=document.querySelector('[data-incoming-call-actions]');
                ShnoAndroidCall.onIncoming(Boolean(accept&&!accept.hidden));
                if(modal&&modal.hidden){
                  var done=(feedback&&feedback.textContent||'').trim();
                  if(terminal.test(done)) ShnoAndroidCall.onEnded(done);
                  // Do not force the modal open: the original call state owns it.
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
        @JavascriptInterface fun onMediaType(type: String) = runOnUiThread {
            if (type != "video" && type != "audio") return@runOnUiThread
            callType = type
            if (type == "video") {
                callSurface?.setBackgroundColor(Color.TRANSPARENT)
            } else {
                callSurface?.background = GradientDrawable(
                    GradientDrawable.Orientation.TL_BR,
                    intArrayOf(Color.rgb(18, 13, 25), Color.rgb(56, 30, 51), Color.rgb(8, 13, 23))
                )
            }
        }
        @JavascriptInterface fun onName(name: String) = runOnUiThread {
            if (name.isNotBlank()) callNameLabel?.text = name
        }
        @JavascriptInterface fun onIncoming(show: Boolean) = runOnUiThread {
            incomingActions?.visibility = if (show) View.VISIBLE else View.GONE
        }
        @JavascriptInterface fun onState(state: String) = runOnUiThread {
            when {
                state.contains("متصل الآن") -> {
                    stopRingback()
                    if (connectedAt == 0L) {
                        connectedAt = SystemClock.elapsedRealtime()
                        updateCallDuration()
                    }
                }
                else -> {
                    if (connectedAt == 0L) callStatusLabel?.text = state
                    if (state.contains("يرن")) startRingback()
                    else if (state.contains("واردة") || state.contains("إنشاء")) stopRingback()
                }
            }
        }
        @JavascriptInterface fun onEnded(message: String) = runOnUiThread {
            stopRingback()
            if (message.contains("غير متصل") || message.contains("مشغول")) Toast.makeText(this@WebCallActivity, message, Toast.LENGTH_LONG).show()
            if (!isFinishing) finish()
        }
    }

    private fun updateCallDuration() {
        if (connectedAt == 0L || isFinishing) return
        val seconds = (SystemClock.elapsedRealtime() - connectedAt) / 1000
        callStatusLabel?.text = "متصل • %02d:%02d".format(seconds / 60, seconds % 60)
        mainHandler.postDelayed({ updateCallDuration() }, 1000)
    }

    private fun startRingback() {
        if (!SettingsStore(this).callSoundEnabled) return
        if (ringbackRingtone?.isPlaying == true || ringbackTone != null) return

        val uri = SettingsStore(this).ringtoneUri?.let(Uri::parse)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        val ringtone = runCatching { RingtoneManager.getRingtone(applicationContext, uri) }.getOrNull()
        if (ringtone != null) {
            runCatching {
                ringtone.audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION_SIGNALLING)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) ringtone.isLooping = true
                ringbackRingtone = ringtone
                ringtone.play()
            }.onFailure {
                ringbackRingtone = null
            }
        }

        if (ringbackRingtone?.isPlaying != true) {
            ringbackTone = runCatching {
                ToneGenerator(AudioManager.STREAM_RING, 100).also {
                    it.startTone(ToneGenerator.TONE_SUP_RINGTONE)
                }
            }.getOrNull()
        }
    }

    private fun stopRingback() {
        ringbackRingtone?.let { runCatching { if (it.isPlaying) it.stop() } }
        ringbackRingtone = null
        ringbackTone?.stopTone()
        ringbackTone?.release()
        ringbackTone = null
    }

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
        val conversationId = source.getStringExtra(EXTRA_CONVERSATION_ID).orEmpty().ifBlank { callId }
        val type = source.getStringExtra(EXTRA_CALL_TYPE).orEmpty().takeIf { it == "audio" || it == "video" } ?: "audio"
        if (callId.isBlank() || from.isBlank()) return null
        return IncomingCall(callId, from, conversationId, type, source.getStringExtra(EXTRA_CALLER_NAME).orEmpty().ifBlank { "مستخدم شنو منو" })
    }

    private fun deliverPendingIncomingCall() {
        val call = pendingIncomingCall ?: return
        if (incomingGroupCall || !webPageReady || !::webView.isInitialized) return
        val payload = JSONObject().apply { put("callId", call.callId); put("from", call.from); put("conversationId", call.conversationId); put("type", call.type); put("callerName", call.callerName) }.toString()
        webView.evaluateJavascript("(function(){var p=$payload;if(typeof window.shnoHandleIncomingCall==='function'){window.shnoHandleIncomingCall(p);var modal=document.querySelector('[data-call-modal]');var incoming=document.querySelector('[data-incoming-call-actions]');if(modal)modal.hidden=false;if(incoming)incoming.hidden=false;return modal&&incoming?'ready':'waiting';}return 'waiting';})()") { result ->
            if (result?.contains("ready") == true) {
                callNameLabel?.text = call.callerName
                callStatusLabel?.text = "مكالمة واردة"
                incomingActions?.visibility = View.VISIBLE
                BackgroundRealtimeService.acknowledgeIncomingCall(call.callId)
                pendingIncomingCall = null
                if (autoAcceptIncoming) {
                    autoAcceptIncoming = false
                    invokeCallControl("[data-call-accept]")
                    prepareCallAudio()
                    callStatusLabel?.text = "جارٍ إنشاء الاتصال…"
                }
            }
            else mainHandler.postDelayed({ deliverPendingIncomingCall() }, 250)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        incomingGroupCall = intent.getBooleanExtra(EXTRA_GROUP_CALL, false)
        incomingCallFrom(intent)?.let { call ->
            pendingIncomingCall = call
            callNameLabel?.text = call.callerName
            callStatusLabel?.text = "مكالمة واردة"
            incomingActions?.visibility = View.VISIBLE
            targetUrl = intent.getStringExtra(EXTRA_URL).orEmpty().ifBlank { targetUrl }
            if (!incomingGroupCall) deliverPendingIncomingCall()
        }
    }

    override fun onResume() { super.onResume(); if (::audioManager.isInitialized && pendingIncomingCall == null && !autoAcceptIncoming && incomingActions?.visibility != View.VISIBLE) prepareCallAudio() }

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
