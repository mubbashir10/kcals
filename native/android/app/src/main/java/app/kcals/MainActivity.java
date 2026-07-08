package app.kcals;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // kcals runs in remote-URL mode (server.url = https://kcals.app): the
    // WebView loads the live site on every launch, so its HTTP cache is pure
    // downside — a stale cached app shell was breaking deploys AND bypassing
    // Capacitor's native-bridge injection (isNative stayed false, all native
    // features off). Force the WebView to always hit the network and wipe any
    // cache that a previous build left behind. Some OEMs (MIUI) never clear
    // this cache on uninstall, so doing it in-app is the only reliable fix.
    WebView webView = this.bridge != null ? this.bridge.getWebView() : null;
    if (webView != null) {
      webView.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
      webView.clearCache(true);
    }
  }
}
