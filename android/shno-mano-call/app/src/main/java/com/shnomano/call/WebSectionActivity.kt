package com.shnomano.call

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.CookieManager
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import com.shnomano.call.data.SessionStore

class WebSectionActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private var pendingMediaRequest: android.webkit.PermissionRequest? = null
    private val mediaPermissions = registerForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        val req = pendingMediaRequest
        pendingMediaRequest = null
        if (req != null) {
            if (result.values.all { it }) req.grant(req.resources.filter {
                it == android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE || it == android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE
            }.toTypedArray())
            else req.deny()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val requestedUrl = intent.getStringExtra(EXTRA_URL).orEmpty()
        if (isCallSurface(requestedUrl)) {
            startActivity(android.content.Intent(this, WebCallActivity::class.java).apply {
                putExtra(WebCallActivity.EXTRA_URL, requestedUrl)
                putExtra(WebCallActivity.EXTRA_GROUP_CALL, android.net.Uri.parse(requestedUrl).path == "/call-groups.html")
            })
            finish()
            return
        }
        if (intent.getBooleanExtra(EXTRA_GROUP_INVITE, false)) {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(true)
                setTurnScreenOn(true)
            } else {
                @Suppress("DEPRECATION")
                window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
            }
        }
        webView = WebView(this).apply {
            setBackgroundColor(android.graphics.Color.rgb(7, 9, 16))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: android.webkit.PermissionRequest) {
                    runOnUiThread {
                        val requested = request.resources.filter { it == android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE || it == android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE }
                        if (requested.isEmpty()) { request.deny(); return@runOnUiThread }
                        val needed = mutableListOf<String>()
                        if (android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE in requested && androidx.core.content.ContextCompat.checkSelfPermission(this@WebSectionActivity, android.Manifest.permission.RECORD_AUDIO) != android.content.pm.PackageManager.PERMISSION_GRANTED) needed += android.Manifest.permission.RECORD_AUDIO
                        if (android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE in requested && androidx.core.content.ContextCompat.checkSelfPermission(this@WebSectionActivity, android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) needed += android.Manifest.permission.CAMERA
                        if (needed.isEmpty()) request.grant(requested.toTypedArray())
                        else { pendingMediaRequest?.deny(); pendingMediaRequest = request; mediaPermissions.launch(needed.toTypedArray()) }
                    }
                }
            }
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: android.webkit.WebResourceRequest?): Boolean {
                    val target = request?.url?.toString().orEmpty()
                    if (!isCallSurface(target)) return false
                    startActivity(Intent(this@WebSectionActivity, WebCallActivity::class.java).apply {
                        putExtra(WebCallActivity.EXTRA_URL, target)
                        putExtra(WebCallActivity.EXTRA_GROUP_CALL, android.net.Uri.parse(target).path == "/call-groups.html")
                    })
                    return true
                }
            }
        }
        setContentView(FrameLayout(this).apply { addView(webView, FrameLayout.LayoutParams(-1, -1)) })

        val target = intent.getStringExtra(EXTRA_URL)?.takeIf { it.startsWith(BASE) } ?: BASE
        val cookie = SessionStore(this).sessionCookie
        if (cookie.isNullOrBlank()) {
            finish()
            return
        }
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setCookie(
            BASE, "__Host-shino_session=$cookie; Path=/; Secure; HttpOnly; SameSite=Lax"
        )
        CookieManager.getInstance().flush()
        webView.loadUrl(target)
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else finish()
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.removeAllViews()
            webView.destroy()
        }
        super.onDestroy()
    }

    private fun isCallSurface(url: String): Boolean = android.net.Uri.parse(url).let {
        it.scheme == "https" && it.host == "shinomino.com" && it.port in listOf(-1, 443) &&
            it.path in listOf("/messages.html", "/call-groups.html")
    }

    companion object {
        const val EXTRA_URL = "url"
        const val EXTRA_GROUP_INVITE = "group_invite"
        const val BASE = "https://shinomino.com/"
    }
}
