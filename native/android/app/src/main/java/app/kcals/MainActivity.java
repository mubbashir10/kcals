package app.kcals;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

import java.io.File;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // kcals runs in remote-URL mode (server.url = https://kcals.app). A stale,
    // service-worker-cached app shell was breaking deploys AND bypassing
    // Capacitor's native-bridge injection (isNative stayed false, all native
    // features off). The SW lives in its own storage that clearCache() doesn't
    // touch and that MIUI won't clear any other way — so wipe it here, BEFORE
    // the WebView starts. Cookies/session live elsewhere and are preserved.
    try {
      File webview = new File(getApplicationInfo().dataDir, "app_webview");
      deleteRecursively(new File(webview, "Default/Service Worker"));
      deleteRecursively(new File(webview, "Service Worker"));
    } catch (Exception ignored) {
    }

    // Let me inspect/force-clear the WebView remotely if anything else lingers.
    WebView.setWebContentsDebuggingEnabled(true);

    super.onCreate(savedInstanceState);

    // Also never use the WebView HTTP cache — always pull the live site.
    WebView webView = this.bridge != null ? this.bridge.getWebView() : null;
    if (webView != null) {
      webView.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
      webView.clearCache(true);
    }
  }

  private static void deleteRecursively(File f) {
    if (f == null || !f.exists()) return;
    File[] kids = f.listFiles();
    if (kids != null) {
      for (File k : kids) deleteRecursively(k);
    }
    f.delete();
  }
}
