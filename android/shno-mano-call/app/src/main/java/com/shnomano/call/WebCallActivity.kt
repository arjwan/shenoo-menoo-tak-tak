package com.shnomano.call

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
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
    private var bootstrapped = false
    private var pendingPermissionRequest: PermissionRequest? = null
    private var audioFocusRequest: AudioFocusRequest? = null

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
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        prepareCallAudio()

        targetUrl = intent.getStringExtra(EXTRA_URL).orEmpty()
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
                    if (url?.contains("messages.html") == true) injectCallStage()
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

        val close = controlButton("×") { finish() }
        root.addView(close, FrameLayout.LayoutParams(60, 60).apply { gravity = Gravity.TOP or Gravity.END; topMargin = 18; marginEnd = 18 })

        val tools = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(8, 8, 8, 8)
            addView(controlButton("↔ تبديل") { webView.evaluateJavascript("window.shnoSwapVideo&&window.shnoSwapVideo()", null) })
            addView(controlButton("⛶ تكبير") { webView.evaluateJavascript("window.shnoToggleVideoSize&&window.shnoToggleVideoSize()", null) })
            addView(controlButton("＋ مشارك") {
                Toast.makeText(this@WebCallActivity, "واجهة إضافة المشاركين جاهزة، والربط الجماعي بالخادم هو الخطوة التالية", Toast.LENGTH_SHORT).show()
            })
        }
        root.addView(tools, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT).apply {
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            bottomMargin = 28
        })

        setContentView(root)
        webView.visibility = View.VISIBLE
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

    private fun injectCallStage() {
        val js = """
            (function(){
              if(window.__shnoCallStageReady) return;
              window.__shnoCallStageReady=true;
              var style=document.createElement('style');
              style.textContent=`
                [data-call-modal]{background:#050b09!important;z-index:9999!important}
                [data-call-modal] [data-remote-video]{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;object-fit:cover!important;background:#050b09!important;border-radius:0!important;z-index:1!important}
                [data-call-modal] [data-local-video]{position:fixed!important;right:18px!important;top:96px!important;width:30vw!important;max-width:170px!important;height:22vh!important;object-fit:cover!important;border-radius:18px!important;border:2px solid rgba(255,255,255,.65)!important;z-index:5!important;box-shadow:0 12px 36px rgba(0,0,0,.45)!important}
                [data-call-modal].shno-swap [data-local-video]{inset:0!important;width:100vw!important;max-width:none!important;height:100vh!important;border:0!important;border-radius:0!important;z-index:1!important}
                [data-call-modal].shno-swap [data-remote-video]{right:18px!important;left:auto!important;top:96px!important;bottom:auto!important;width:30vw!important;height:22vh!important;border-radius:18px!important;border:2px solid rgba(255,255,255,.65)!important;z-index:5!important}
                [data-call-modal].shno-focus [data-local-video]{width:46vw!important;max-width:240px!important;height:34vh!important}
              `;
              document.head.appendChild(style);
              window.shnoSwapVideo=function(){var m=document.querySelector('[data-call-modal]');if(m)m.classList.toggle('shno-swap')};
              window.shnoToggleVideoSize=function(){var m=document.querySelector('[data-call-modal]');if(m)m.classList.toggle('shno-focus')};
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    private fun prepareCallAudio() {
        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
        @Suppress("DEPRECATION")
        if (!audioManager.isBluetoothScoOn && !audioManager.isWiredHeadsetOn) audioManager.isSpeakerphoneOn = true
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
        @Suppress("DEPRECATION") runCatching { audioManager.stopBluetoothSco() }
        audioManager.mode = AudioManager.MODE_NORMAL
        @Suppress("DEPRECATION") runCatching { audioManager.isSpeakerphoneOn = false }
    }

    override fun onResume() { super.onResume(); if (::audioManager.isInitialized) prepareCallAudio() }

    override fun onBackPressed() { finish() }

    override fun onDestroy() {
        pendingPermissionRequest?.deny(); pendingPermissionRequest = null
        if (::webView.isInitialized) { webView.stopLoading(); webView.loadUrl("about:blank"); webView.removeAllViews(); webView.destroy() }
        if (::audioManager.isInitialized) releaseCallAudio()
        super.onDestroy()
    }

    companion object { const val EXTRA_URL = "url" }
}
