package com.purelab.app;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * PureLab 高通量重结晶实验助手 — WebView 壳。
 * 加载 assets/www/index.html（15 屏 UI，按设计基准板令牌体系实现）。
 */
public class MainActivity extends Activity {

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        WebSettings st = webView.getSettings();
        st.setJavaScriptEnabled(true);
        st.setDomStorageEnabled(true);
        st.setAllowFileAccess(true);
        st.setCacheMode(WebSettings.LOAD_NO_CACHE);

        webView.setBackgroundColor(0xFFF9F2EA);
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        webView.setWebViewClient(new WebViewClient());
        webView.addJavascriptInterface(new Bridge(), "Android");

        setContentView(webView);
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    /** 物理/手势返回键 → 先交给页面内导航栈处理，栈空才退出。 */
    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript("window.PureLab ? PureLab.onBack() : 'false'",
                    value -> {
                        if (value == null || !value.contains("true")) {
                            finish();
                        }
                    });
        } else {
            finish();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    /** 提供给 JS 的最小桥：退出应用。 */
    private class Bridge {
        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(() -> finish());
        }
    }
}
