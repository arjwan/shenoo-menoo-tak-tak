package com.shnomano.call

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import com.shnomano.call.data.SessionStore
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

class WebSectionActivity : ComponentActivity() {
    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this).apply {
            setBackgroundColor(android.graphics.Color.rgb(7, 9, 16))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webChromeClient = WebChromeClient()
            webViewClient = WebViewClient()
        }
        setContentView(FrameLayout(this).apply { addView(webView, FrameLayout.LayoutParams(-1, -1)) })

        val target = intent.getStringExtra(EXTRA_URL)?.takeIf { it.startsWith(BASE) } ?: BASE
        val token = SessionStore(this).token.orEmpty()
        val escapedToken = token.replace("\\", "\\\\").replace("'", "\\'")
        val escapedTarget = target.replace("'", "%27")
        val bootstrap = """
            <!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>
            <style>html,body{margin:0;background:#070910;color:white;font-family:sans-serif}body{display:grid;place-items:center;height:100vh}</style>
            </head><body>جارٍ فتح شنو منو…<script>
            try {
              localStorage.setItem('token','$escapedToken');
              sessionStorage.setItem('token','$escapedToken');
            } catch(e) {}
            location.replace('$escapedTarget');
            </script></body></html>
        """.trimIndent()
        webView.loadDataWithBaseURL(BASE, bootstrap, "text/html", "UTF-8", null)
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

    companion object {
        const val EXTRA_URL = "url"
        const val BASE = "https://shino-mino-tak-tak.duckdns.org/"
    }
}
