package com.shnomano.call

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.graphics.Color
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
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.shnomano.call.data.SessionStore
import org.json.JSONObject

class WebCallActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private var targetUrl: String = ""
    private var bootstrapped = false
    private var pendingPermissionRequest: PermissionRequest? = null

    private val mediaPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        val granted = result.values.all { it }
        val request = pendingPermissionRequest
        pendingPermissionRequest = null
        if (granted) request?.grant(request.resources) else request?.deny()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(7, 9, 16)
        window.navigationBarColor = Color.rgb(7, 9, 16)

        targetUrl = intent.getStringExtra(EXTRA_URL).orEmpty()
        if (targetUrl.isBlank()) {
            finish()
            return
        }

        val root = FrameLayout(this).apply { setBackgroundColor(Color.rgb(7, 9, 16)) }
        webView = WebView(this).apply {
            setBackgroundColor(Color.rgb(7, 9, 16))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    if (!bootstrapped && url?.contains("signin.html") == true) {
                        bootstrapped = true
                        val token = SessionStore(this@WebCallActivity).token.orEmpty()
                        val tokenJs = JSONObject.quote(token)
                        val targetJs = JSONObject.quote(targetUrl)
                        evaluateJavascript(
                            "localStorage.setItem('token',$tokenJs);sessionStorage.setItem('token',$tokenJs);location.replace($targetJs);",
                            null
                        )
                    }
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) {
                    runOnUiThread {
                        val needsAudio = request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
                        val needsVideo = request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                        val missing = mutableListOf<String>()
                        if (needsAudio && ContextCompat.checkSelfPermission(this@WebCallActivity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) missing += Manifest.permission.RECORD_AUDIO
                        if (needsVideo && ContextCompat.checkSelfPermission(this@WebCallActivity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) missing += Manifest.permission.CAMERA
                        if (missing.isEmpty()) request.grant(request.resources) else {
                            pendingPermissionRequest = request
                            mediaPermissionLauncher.launch(missing.toTypedArray())
                        }
                    }
                }
            }
        }
        root.addView(webView, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))

        val close = Button(this).apply {
            text = "×"
            textSize = 24f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.argb(180, 17, 21, 34))
            setOnClickListener { finish() }
            contentDescription = "إغلاق شاشة الاتصال"
        }
        val closeParams = FrameLayout.LayoutParams(64, 64).apply {
            gravity = Gravity.TOP or Gravity.END
            topMargin = 18
            marginEnd = 18
        }
        root.addView(close, closeParams)

        setContentView(root)
        webView.visibility = View.VISIBLE
        webView.loadUrl("https://shino-mino-tak-tak.duckdns.org/signin.html")
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.loadUrl("about:blank")
            webView.removeAllViews()
            webView.destroy()
        }
        super.onDestroy()
    }

    companion object {
        const val EXTRA_URL = "url"
    }
}
