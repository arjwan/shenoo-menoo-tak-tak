package com.shinomeno.taktak;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private static final String HOME_URL = "https://shino-mino-tak-tak.duckdns.org/";
    private static final int FILE_PICKER = 41;
    private static final int MEDIA_PERMISSIONS = 42;
    private WebView webView;
    private TextView offlineBanner;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest pendingPermissionRequest;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(17, 24, 39));
        buildView();
        if (state == null) webView.loadUrl(HOME_URL);
        else webView.restoreState(state);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void buildView() {
        FrameLayout root = new FrameLayout(this);
        webView = new WebView(this);
        offlineBanner = new TextView(this);
        offlineBanner.setText("وضع عدم الاتصال - سيتم استخدام المحتوى المحفوظ قدر الإمكان");
        offlineBanner.setTextColor(Color.WHITE);
        offlineBanner.setBackgroundColor(Color.rgb(127, 29, 29));
        offlineBanner.setGravity(17);
        offlineBanner.setPadding(12, 10, 12, 10);
        offlineBanner.setVisibility(isOnline() ? View.GONE : View.VISIBLE);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportMultipleWindows(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUserAgentString(settings.getUserAgentString() + " ShenooMenooTakTakAndroid/1.0");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) offlineBanner.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                offlineBanner.setVisibility(isOnline() ? View.GONE : View.VISIBLE);
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    pendingPermissionRequest = request;
                    requestMediaPermissions();
                });
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = params.createIntent();
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                try {
                    startActivityForResult(intent, FILE_PICKER);
                } catch (ActivityNotFoundException error) {
                    fileCallback = null;
                    callback.onReceiveValue(null);
                    return false;
                }
                return true;
            }
        });

        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        FrameLayout.LayoutParams bannerParams = new FrameLayout.LayoutParams(-1, -2);
        bannerParams.gravity = 48;
        root.addView(offlineBanner, bannerParams);
        setContentView(root);
    }

    private boolean isOnline() {
        ConnectivityManager manager = getSystemService(ConnectivityManager.class);
        Network network = manager == null ? null : manager.getActiveNetwork();
        return network != null;
    }

    private void requestMediaPermissions() {
        if (android.os.Build.VERSION.SDK_INT >= 23) {
            requestPermissions(new String[]{Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO}, MEDIA_PERMISSIONS);
        } else {
            grantWebPermission();
        }
    }

    private void grantWebPermission() {
        if (pendingPermissionRequest == null) return;
        pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
        pendingPermissionRequest = null;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == MEDIA_PERMISSIONS) {
            boolean granted = true;
            for (int result : results) granted &= result == PackageManager.PERMISSION_GRANTED;
            if (granted) grantWebPermission();
            else if (pendingPermissionRequest != null) pendingPermissionRequest.deny();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_PICKER && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        webView.saveState(state);
        super.onSaveInstanceState(state);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
