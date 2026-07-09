package app.kcals

import android.os.Bundle
import android.util.Log
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.lifecycle.lifecycleScope
import com.getcapacitor.BridgeActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

// kcals runs in remote-URL mode (the WebView loads https://kcals.app). Health
// Connect is read HERE, in native Kotlin — NOT through the JS/Capacitor bridge,
// which proved unreliable in remote-URL mode. On every launch we read today's
// de-duped steps + active calories straight from Health Connect and POST them to
// the server (authenticated with the WebView's session cookie); the web UI just
// displays the synced numbers. The WebView never touches Health Connect.
class MainActivity : BridgeActivity() {

    companion object {
        private const val TAG = "KcalsHealth"
        private const val ORIGIN = "https://kcals.app"
        private const val SYNC_URL = "$ORIGIN/api/health/sync"
    }

    private val hcPermissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
    )

    private lateinit var permsLauncher: ActivityResultLauncher<Set<String>>
    private var promptedThisLaunch = false

    override fun onCreate(savedInstanceState: Bundle?) {
        // Wipe any stale service-worker storage before the WebView starts, so a
        // cached shell can't serve an old build. Cookies/session live elsewhere
        // and are preserved.
        try {
            val webview = File(applicationInfo.dataDir, "app_webview")
            deleteRecursively(File(webview, "Default/Service Worker"))
            deleteRecursively(File(webview, "Service Worker"))
        } catch (ignored: Exception) {
        }

        // Inspectable WebView (this build is debuggable).
        WebView.setWebContentsDebuggingEnabled(true)

        // Pass null so the WebView never restores its last URL — always load
        // server.url fresh so Capacitor injects its bridge into the load.
        super.onCreate(null)

        // Never use the WebView HTTP cache — always pull the live site.
        bridge?.webView?.let { wv ->
            wv.settings.cacheMode = WebSettings.LOAD_NO_CACHE
            wv.clearCache(true)
            // Direct JS interface (the reliable low-level primitive, NOT the
            // Capacitor plugin layer): lets the web app trigger an on-demand
            // Health Connect re-read via window.KcalsNative.syncHealth().
            wv.addJavascriptInterface(NativeInterface(), "KcalsNative")
        }

        // Register the Health Connect permission launcher in onCreate (before the
        // activity is started) so it can't throw — this is the exact lifecycle
        // trap that broke the capacitor-health plugin.
        permsLauncher = registerForActivityResult(
            PermissionController.createRequestPermissionResultContract()
        ) { granted ->
            if (granted.containsAll(hcPermissions)) {
                readAndSync()
            } else {
                Log.i(TAG, "Health Connect permissions not granted: $granted")
            }
        }
    }

    // Sync on real window focus, not onResume: Health Connect rejects reads
    // ("must be in foreground") when the activity is resumed but behind the lock
    // screen / notification shade. onWindowFocusChanged(true) means we're
    // genuinely foregrounded, so a foreground read is always allowed.
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) trySyncHealth()
    }

    // On each launch/resume: if Health Connect is available and permitted, read
    // today's totals and sync them. If not yet permitted, request it once per
    // launch.
    private fun trySyncHealth() {
        val status = HealthConnectClient.getSdkStatus(this)
        if (status != HealthConnectClient.SDK_AVAILABLE) {
            Log.i(TAG, "Health Connect SDK not available (status=$status)")
            return
        }
        lifecycleScope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(this@MainActivity)
                val granted = client.permissionController.getGrantedPermissions()
                if (granted.containsAll(hcPermissions)) {
                    readAndSync(client)
                } else if (!promptedThisLaunch) {
                    promptedThisLaunch = true
                    Log.i(TAG, "requesting Health Connect permissions")
                    permsLauncher.launch(hcPermissions)
                }
            } catch (e: Exception) {
                Log.e(TAG, "trySyncHealth failed", e)
            }
        }
    }

    private fun readAndSync(existing: HealthConnectClient? = null) {
        lifecycleScope.launch {
            try {
                val client = existing ?: HealthConnectClient.getOrCreate(this@MainActivity)
                val zone = ZoneId.systemDefault()
                val start = LocalDate.now(zone).atStartOfDay(zone).toInstant()
                val end = Instant.now()
                val result = client.aggregate(
                    AggregateRequest(
                        metrics = setOf(
                            StepsRecord.COUNT_TOTAL,
                            ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL,
                        ),
                        timeRangeFilter = TimeRangeFilter.between(start, end),
                    )
                )
                val steps = result[StepsRecord.COUNT_TOTAL] ?: 0L
                val kcal = result[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]
                    ?.inKilocalories ?: 0.0
                Log.i(TAG, "read HC today: steps=$steps activeKcal=$kcal")
                postToServer(steps, kcal)
            } catch (e: Exception) {
                Log.e(TAG, "readAndSync failed", e)
            }
        }
    }

    private suspend fun postToServer(steps: Long, activeKcal: Double) =
        withContext(Dispatchers.IO) {
            val cookie = CookieManager.getInstance().getCookie(ORIGIN)
            if (cookie.isNullOrBlank()) {
                Log.i(TAG, "no session cookie yet — skipping sync")
                return@withContext
            }
            val kcal = Math.round(activeKcal)
            try {
                val body = JSONObject()
                    .put("steps", steps)
                    .put("activeKcal", kcal)
                    .toString()
                val conn = (URL(SYNC_URL).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    connectTimeout = 15000
                    readTimeout = 15000
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Cookie", cookie)
                }
                conn.outputStream.use { it.write(body.toByteArray()) }
                val code = conn.responseCode
                Log.i(TAG, "sync POST -> HTTP $code")
                conn.disconnect()
                if (code in 200..299) notifyWebSynced(steps, kcal)
            } catch (e: Exception) {
                Log.e(TAG, "postToServer failed", e)
            }
        }

    // Tell the web app a fresh sync landed (with the numbers) so it re-fetches
    // and can show a subtle "synced" note without the user reopening the app.
    private fun notifyWebSynced(steps: Long, activeKcal: Long) {
        runOnUiThread {
            bridge?.webView?.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('kcals:health-synced'," +
                    "{detail:{steps:$steps,activeKcal:$activeKcal}}));",
                null,
            )
        }
    }

    // Exposed to the web app as window.KcalsNative. syncHealth() re-reads Health
    // Connect on demand (e.g. a "Sync now" button); the POST then fires the
    // kcals:health-synced event above.
    inner class NativeInterface {
        @JavascriptInterface
        fun syncHealth() {
            runOnUiThread { trySyncHealth() }
        }
    }

    private fun deleteRecursively(f: File?) {
        if (f == null || !f.exists()) return
        f.listFiles()?.forEach { deleteRecursively(it) }
        f.delete()
    }
}
