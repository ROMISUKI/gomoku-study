package com.duan.gomokustudy;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private WebView web;
    private String pendingExport;
    private static final String BASE = "https://app.local/";
    private static final int EXPORT = 10, IMPORT = 11, MAX = 1048576;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setBlockNetworkLoads(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setDefaultTextEncodingName("utf-8");
        s.setTextZoom(Math.round(100 * getResources().getConfiguration().fontScale));
        web.addJavascriptInterface(new Bridge(), "AndroidApp");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest r) { return true; }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) { return true; }
        });
        setBars(false);
        setContentView(web);
        try {
            InputStream in = getResources().openRawResource(R.raw.app);
            String html;
            try { html = readLimited(in, MAX * 4); } finally { in.close(); }
            web.loadDataWithBaseURL(BASE, html, "text/html", "utf-8", null);
        } catch (Exception e) {
            web.loadDataWithBaseURL(BASE, "<!doctype html><meta charset='utf-8'><h1>本地资源读取失败</h1><p>请保留数据，不要卸载。请使用完整的同签名安装包覆盖安装。</p>", "text/html", "utf-8", null);
        }
    }

    private String readLimited(InputStream in, int max) throws Exception {
        if (in == null) throw new Exception("无法打开文件");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] b = new byte[8192];
        int n;
        while ((n = in.read(b)) != -1) {
            if (out.size() + n > max) throw new Exception("文件超过大小限制");
            out.write(b, 0, n);
        }
        return out.toString("UTF-8");
    }

    private void setBars(boolean dark) {
        int c = Color.parseColor(dark ? "#16221E" : "#F7F5EF");
        getWindow().setStatusBarColor(c);
        getWindow().setNavigationBarColor(c);
        int f = dark ? 0 : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (Build.VERSION.SDK_INT >= 26 && !dark) f |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        getWindow().getDecorView().setSystemUiVisibility(f);
        if (web != null) web.setBackgroundColor(c);
    }

    private void notifyPage(String event, String text) {
        if (web != null) web.evaluateJavascript("window.nativeResult && window.nativeResult(" + JSONObject.quote(event) + "," + JSONObject.quote(text) + ")", null);
    }

    public class Bridge {
        @JavascriptInterface public boolean isSystemDark() {
            return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        }
        @JavascriptInterface public void setDark(final boolean dark) { runOnUiThread(() -> setBars(dark)); }
        @JavascriptInterface public void exportBackup(final String json) {
            runOnUiThread(() -> {
                if (json == null || json.length() > MAX) { notifyPage("error", "备份内容过大"); return; }
                if (pendingExport != null) { notifyPage("error", "请先完成当前保存操作"); return; }
                pendingExport = json;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("application/json");
                i.putExtra(Intent.EXTRA_TITLE, "五子棋研习-备份.json");
                try { startActivityForResult(i, EXPORT); }
                catch (Exception e) { pendingExport = null; notifyPage("error", "无法打开文件保存器"); }
            });
        }
        @JavascriptInterface public void importBackup() {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                try { startActivityForResult(i, IMPORT); }
                catch (Exception e) { notifyPage("error", "无法打开文件选择器"); }
            });
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != EXPORT && request != IMPORT) return;
        if (result != RESULT_OK || data == null || data.getData() == null) {
            if (request == EXPORT) pendingExport = null;
            notifyPage("cancel", "已取消，原数据未改动");
            return;
        }
        try {
            if (request == EXPORT) {
                if (pendingExport == null) throw new Exception("保存内容已失效，请重新导出");
                OutputStream out = getContentResolver().openOutputStream(data.getData(), "wt");
                if (out == null) throw new Exception("无法写入文件");
                try { out.write(pendingExport.getBytes("UTF-8")); out.flush(); } finally { out.close(); }
                notifyPage("saved", "备份已保存");
            } else {
                InputStream in = getContentResolver().openInputStream(data.getData());
                String text;
                try { text = readLimited(in, MAX); } finally { if (in != null) in.close(); }
                notifyPage("import", text);
            }
        } catch (Exception e) { notifyPage("error", "文件操作失败：" + e.getMessage()); }
        finally { if (request == EXPORT) pendingExport = null; }
    }

    @Override public void onBackPressed() {
        web.evaluateJavascript("window.appHandleBack ? window.appHandleBack() : false", new ValueCallback<String>() {
            @Override public void onReceiveValue(String v) { if (!"true".equals(v)) finish(); }
        });
    }
    @Override public void onConfigurationChanged(Configuration c) {
        super.onConfigurationChanged(c);
        web.getSettings().setTextZoom(Math.round(100 * c.fontScale));
        web.evaluateJavascript("window.appThemeChanged && window.appThemeChanged()", null);
    }
    @Override protected void onPause() { super.onPause(); if (web != null) web.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() {
        if (web != null) { web.removeJavascriptInterface("AndroidApp"); web.destroy(); web = null; }
        super.onDestroy();
    }
}
