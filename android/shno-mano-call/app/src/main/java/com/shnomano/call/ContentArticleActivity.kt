package com.shnomano.call

import android.content.Intent
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.Button
import androidx.activity.ComponentActivity

/** Isolated source reader: no app bridge, camera, microphone or file access. */
class ContentArticleActivity : ComponentActivity() {
    private lateinit var reader: WebView
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val url = intent.getStringExtra(WebSectionActivity.EXTRA_URL).orEmpty()
        if (!isAllowed(url)) { finish(); return }
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val tools = LinearLayout(this)
        tools.addView(Button(this).apply { text = "رجوع"; setOnClickListener { finish() } })
        tools.addView(Button(this).apply { text = "مشاركة"; setOnClickListener {
            val current = reader.url?.takeIf(::isAllowed) ?: url
            startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, current) }, "مشاركة الخبر"))
        } })
        root.addView(tools)
        reader = WebView(this).apply {
            settings.javaScriptEnabled = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.domStorageEnabled = false
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: android.webkit.WebResourceRequest?): Boolean = !isAllowed(request?.url.toString())
            }
        }
        root.addView(reader, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(root)
        reader.loadUrl(url)
    }
    private fun isAllowed(url: String): Boolean = android.net.Uri.parse(url).let {
        it.scheme == "https" && !it.host.isNullOrBlank() && it.host != "localhost" && !it.host.orEmpty().contains(':') && !it.host.orEmpty().matches(Regex("[0-9.]+")) && it.port in listOf(-1, 443)
    }
    override fun onDestroy() { if (::reader.isInitialized) { reader.stopLoading(); reader.destroy() }; super.onDestroy() }
}
