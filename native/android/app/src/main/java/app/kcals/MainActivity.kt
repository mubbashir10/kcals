package app.kcals

import android.content.pm.PackageManager
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
import androidx.health.connect.client.records.metadata.DataOrigin
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.lifecycle.lifecycleScope
import com.getcapacitor.BridgeActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.Period
import java.time.ZoneId

// kcals runs in remote-URL mode (the WebView loads https://kcals.app). Health
// Connect is read HERE, in native Kotlin — NOT through the JS/Capacitor bridge,
// which proved unreliable in remote-URL mode. On every launch we read the last
// week of de-duped steps + active calories straight from Health Connect and POST
// them to the server (authenticated with the WebView's session cookie); the web
// UI just displays the synced numbers. The WebView never touches Health Connect.
class MainActivity : BridgeActivity() {

    companion object {
        private const val TAG = "KcalsHealth"
        private const val ORIGIN = "https://kcals.app"
        private const val SYNC_URL = "$ORIGIN/api/health/sync"

        // We can only read Health Connect while foregrounded, so a day used to
        // freeze at whatever partial total was on screen when the app last had
        // focus. Re-read a rolling window so yesterday gets its real closing
        // numbers once the band has finished uploading them. Keep in step with
        // HEALTH_SYNC_DAYS in src/lib/health-sync.ts — the server bounds it too.
        private const val SYNC_DAYS = 7L
    }

    private data class DayTotals(
        val dayKey: String,
        val steps: Long,
        val activeKcal: Long,
        /** Health Connect's own attribution, e.g. "Mi Fitness". Null if unresolvable. */
        val source: String?,
    )

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

    // On each launch/resume: if the user has the integration switched on, Health
    // Connect is available, and we're permitted, read the recent days' totals
    // and sync them. If not yet permitted, request it once per launch.
    private fun trySyncHealth() {
        val status = HealthConnectClient.getSdkStatus(this)
        if (status != HealthConnectClient.SDK_AVAILABLE) {
            Log.i(TAG, "Health Connect SDK not available (status=$status)")
            return
        }
        lifecycleScope.launch {
            try {
                // Ask the server first: switching the toggle off must stop the
                // permission prompt, not just the write.
                if (!isSyncEnabled()) {
                    Log.i(TAG, "Health Connect sync disabled for this account")
                    return@launch
                }
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

    // Offline (or signed out) reads as "off": we couldn't POST the numbers
    // anyway, and guessing "on" would prompt a user who switched it off.
    private suspend fun isSyncEnabled(): Boolean = withContext(Dispatchers.IO) {
        val cookie = CookieManager.getInstance().getCookie(ORIGIN)
        if (cookie.isNullOrBlank()) return@withContext false
        try {
            val conn = (URL(SYNC_URL).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 10000
                readTimeout = 10000
                setRequestProperty("Cookie", cookie)
            }
            val code = conn.responseCode
            val enabled = code in 200..299 &&
                JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
                    .optBoolean("enabled", false)
            conn.disconnect()
            enabled
        } catch (e: Exception) {
            Log.e(TAG, "isSyncEnabled failed", e)
            false
        }
    }

    private fun readAndSync(existing: HealthConnectClient? = null) {
        lifecycleScope.launch {
            try {
                val client = existing ?: HealthConnectClient.getOrCreate(this@MainActivity)
                val today = LocalDate.now(ZoneId.systemDefault())
                // Period slicing works in local wall-clock, so each bucket lands
                // on a calendar day the way the user experienced it. The window
                // ends at "now" — today's bucket is a partial day, the rest are
                // whole ones.
                val buckets = client.aggregateGroupByPeriod(
                    AggregateGroupByPeriodRequest(
                        metrics = setOf(
                            StepsRecord.COUNT_TOTAL,
                            ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL,
                        ),
                        timeRangeFilter = TimeRangeFilter.between(
                            today.minusDays(SYNC_DAYS - 1).atStartOfDay(),
                            LocalDateTime.now(),
                        ),
                        timeRangeSlicer = Period.ofDays(1),
                    )
                )
                // Empty days are dropped, not posted as zeros: the server would
                // skip them anyway, and a phone left at home must never wipe a
                // day the band did record.
                val days = buckets.mapNotNull { bucket ->
                    val steps = bucket.result[StepsRecord.COUNT_TOTAL] ?: 0L
                    val kcal = Math.round(
                        bucket.result[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]
                            ?.inKilocalories ?: 0.0
                    )
                    if (steps == 0L && kcal == 0L) null
                    else DayTotals(
                        dayKey = bucket.startTime.toLocalDate().toString(),
                        steps = steps,
                        activeKcal = kcal,
                        source = sourceLabel(bucket.result.dataOrigins),
                    )
                }
                Log.i(TAG, "read HC ${days.size} day(s): $days")
                postToServer(days, today.toString())
            } catch (e: Exception) {
                Log.e(TAG, "readAndSync failed", e)
            }
        }
    }

    // Who Health Connect says the day's numbers came from. The aggregate already
    // carries its contributing packages, so this costs no extra read. We resolve
    // each to the label the launcher shows ("Mi Fitness"), skipping our own app
    // and anything uninstalled since. Nothing is hardcoded — an unresolvable
    // package is simply dropped rather than shown as a raw package name.
    private fun sourceLabel(origins: Set<DataOrigin>): String? {
        val pm = packageManager
        val labels = origins
            .map { it.packageName }
            .filter { it.isNotBlank() && it != packageName }
            .mapNotNull { pkg ->
                try {
                    pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString().trim()
                } catch (e: PackageManager.NameNotFoundException) {
                    null
                }
            }
            .filter { it.isNotEmpty() }
            .distinct()
            .sorted()
        return if (labels.isEmpty()) null else labels.joinToString(", ")
    }

    private suspend fun postToServer(days: List<DayTotals>, todayKey: String) =
        withContext(Dispatchers.IO) {
            if (days.isEmpty()) {
                Log.i(TAG, "no Health Connect data in window — skipping sync")
                return@withContext
            }
            val cookie = CookieManager.getInstance().getCookie(ORIGIN)
            if (cookie.isNullOrBlank()) {
                Log.i(TAG, "no session cookie yet — skipping sync")
                return@withContext
            }
            try {
                val arr = JSONArray()
                for (day in days) {
                    arr.put(
                        JSONObject()
                            .put("dayKey", day.dayKey)
                            .put("steps", day.steps)
                            .put("activeKcal", day.activeKcal)
                            // JSONObject.put(String, null) omits the key, which
                            // the server reads as "no source" — exactly right.
                            .put("source", day.source)
                    )
                }
                val body = JSONObject().put("days", arr).toString()
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
                Log.i(TAG, "sync POST ${days.size} day(s) -> HTTP $code")
                conn.disconnect()
                if (code in 200..299) {
                    val today = days.firstOrNull { it.dayKey == todayKey }
                    notifyWebSynced(today?.steps ?: 0L, today?.activeKcal ?: 0L)
                }
            } catch (e: Exception) {
                Log.e(TAG, "postToServer failed", e)
            }
        }

    // Tell the web app a fresh sync landed (with today's numbers) so it
    // re-fetches and can show a subtle "synced" note without the user reopening
    // the app. Fired even when today is still empty, so an in-flight "Sync now"
    // button always settles.
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

        // Called when the user switches the integration on in settings. Clearing
        // the once-per-launch guard means the system permission sheet appears
        // right then, rather than on the next cold start.
        @JavascriptInterface
        fun requestHealthPermission() {
            runOnUiThread {
                promptedThisLaunch = false
                trySyncHealth()
            }
        }
    }

    private fun deleteRecursively(f: File?) {
        if (f == null || !f.exists()) return
        f.listFiles()?.forEach { deleteRecursively(it) }
        f.delete()
    }
}
