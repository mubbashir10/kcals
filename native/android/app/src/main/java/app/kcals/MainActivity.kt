package app.kcals

import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeightRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.DataOrigin
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.units.Length
import androidx.health.connect.client.units.Mass
import androidx.health.connect.client.units.Percentage
import androidx.lifecycle.lifecycleScope
import com.getcapacitor.Bridge
import com.getcapacitor.BridgeActivity
import com.getcapacitor.BridgeWebViewClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.Period
import java.time.ZoneId
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.reflect.KClass

// kcals runs in remote-URL mode (the WebView loads https://kcals.app). Health
// Connect is used HERE, in native Kotlin — NOT through the JS/Capacitor bridge,
// which proved unreliable in remote-URL mode. The WebView never touches Health
// Connect. On every launch (and on demand from the web UI) we:
//
//   • read the last week of de-duped steps + active calories and POST them to
//     the server (authenticated with the WebView's session cookie);
//   • mirror the server's weigh-ins / height / body fat INTO Health Connect
//     (the server sends its full desired state, we upsert by clientRecordId
//     and prune what fell off — idempotent, self-healing, backfills history);
//   • read the measurements OTHER apps wrote (smart scales etc.) and POST them
//     back so kcals imports them.
class MainActivity : BridgeActivity() {

    companion object {
        private const val TAG = "KcalsHealth"
        // Shell/WebView events aren't Health Connect — log them separately so
        // `adb logcat -s KcalsShell` shows just the app-loading story.
        private const val SHELL_TAG = "KcalsShell"

        // How long to wait before each quiet retry of a failed page load. Two
        // attempts spread over ~3s covers the common blip (a handover, a Wi-Fi
        // network that hasn't finished coming up) without leaving the user
        // staring at a spinner when the site is genuinely unreachable.
        private val RETRY_DELAYS_MS = longArrayOf(800L, 2_500L)
        private const val ORIGIN = "https://kcals.app"

        // Recovery-overlay palette, matched to the web app's dark theme in
        // globals.css so it doesn't read as a stock Android error page.
        private const val OVERLAY_BG = "#0A0A0A"
        private const val OVERLAY_TEXT = "#F8FAFC"
        private const val OVERLAY_MUTED = "#94A3B8"
        private const val OVERLAY_PRIMARY = "#AFF33E"
        private const val SYNC_URL = "$ORIGIN/api/health/sync"
        private const val MEASUREMENTS_URL = "$ORIGIN/api/health/measurements"

        // We can only read Health Connect while foregrounded, so a day used to
        // freeze at whatever partial total was on screen when the app last had
        // focus. Re-read a rolling window so yesterday gets its real closing
        // numbers once the band has finished uploading them. Keep in step with
        // HEALTH_SYNC_DAYS in src/lib/health-sync.ts — the server bounds it too.
        private const val SYNC_DAYS = 7L

        // Health Connect caps how much one insert call may carry; chunk well
        // below it so even a years-long weight history exports fine.
        private const val INSERT_CHUNK = 500

        // Launcher icons are square and get shown at 16dp; 96px is sharp on
        // any density and keeps the PNG a few kilobytes, which matters because
        // the server hands it to the dashboard on every render.
        private const val ICON_PX = 96

        // Health Connect has some eighty exercise types and the app's estimate
        // has two buckets, so everything that isn't strength work counts as
        // cardio. The two skipped types burn too little to call cardio and
        // would read as a workout the user didn't do.
        private val LIFTING_TYPES = setOf(
            ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING,
            ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING,
            ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS,
        )
        private val IGNORED_TYPES = setOf(
            ExerciseSessionRecord.EXERCISE_TYPE_GUIDED_BREATHING,
            ExerciseSessionRecord.EXERCISE_TYPE_STRETCHING,
        )
    }

    private data class DayTotals(
        val dayKey: String,
        val steps: Long,
        val activeKcal: Long,
        /** Minutes of logged exercise on the day, split into our two buckets. */
        val liftingMin: Long = 0,
        val cardioMin: Long = 0,
        /** Health Connect's own attribution, e.g. "Mi Fitness". Null if unresolvable. */
        val source: String?,
    )

    /** Minutes of exercise on one day, before they're folded into its totals. */
    private data class Workout(var liftingMin: Long = 0, var cardioMin: Long = 0)

    /** What the server says about syncing, asked once per pass. */
    private data class SyncState(
        val enabled: Boolean,
        /** Apps it already holds an icon for — we only send the others. */
        val knownSources: Set<String>,
    )

    // What the server wants written to Health Connect, already resolved to
    // record terms: `value` is kg for weight, cm for height, percent for body
    // fat. `version` is the record's clientRecordVersion — Health Connect
    // ignores replays and overwrites on a bump, which makes exports idempotent.
    private data class HcWrite(
        val clientId: String,
        val time: Instant,
        val version: Long,
        val value: Double,
    )

    private data class DesiredMeasurements(
        val weights: List<HcWrite>,
        val height: HcWrite?,
        val bodyFat: HcWrite?,
    )

    // Two independent permission sets: activity (steps/calories, read-only)
    // and body measurements (weight/height/body fat, both directions). Checked
    // separately so denying one never blocks syncing the other.
    private val activityPerms = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
    )

    // Workouts are asked for but not required. Anyone already using the app
    // granted steps and calories before this permission existed, and gating
    // the whole activity sync on it would silently stop their days syncing
    // until they noticed a prompt. So it's checked on its own, and a refusal
    // costs exactly the workout minutes.
    private val exercisePerm =
        HealthPermission.getReadPermission(ExerciseSessionRecord::class)
    private val measurementPerms = setOf(
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getWritePermission(WeightRecord::class),
        HealthPermission.getReadPermission(HeightRecord::class),
        HealthPermission.getWritePermission(HeightRecord::class),
        HealthPermission.getReadPermission(BodyFatRecord::class),
        HealthPermission.getWritePermission(BodyFatRecord::class),
    )
    private val hcPermissions = activityPerms + exercisePerm + measurementPerms

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

        // Catch a dead page load and recover from it (see onLoadFailed).
        bridge?.let { b -> b.setWebViewClient(KcalsWebViewClient(b)) }

        // Retry automatically when a usable network reappears.
        try {
            getSystemService(ConnectivityManager::class.java)
                ?.registerDefaultNetworkCallback(networkCallback)
        } catch (e: Exception) {
            Log.i(SHELL_TAG, "could not watch connectivity: $e")
        }

        // Register the Health Connect permission launcher in onCreate (before the
        // activity is started) so it can't throw — this is the exact lifecycle
        // trap that broke the capacitor-health plugin.
        permsLauncher = registerForActivityResult(
            PermissionController.createRequestPermissionResultContract()
        ) { granted ->
            // Run whatever the user did allow — a denied measurement grant
            // mustn't hold the activity sync hostage, or vice versa.
            if (granted.containsAll(activityPerms)) readAndSync()
            if (granted.containsAll(measurementPerms)) syncMeasurements()
            if (!granted.containsAll(hcPermissions)) {
                Log.i(TAG, "Health Connect permissions not fully granted: $granted")
            }
        }
    }

    // Sync on real window focus, not onResume: Health Connect rejects reads
    // ("must be in foreground") when the activity is resumed but behind the lock
    // screen / notification shade. onWindowFocusChanged(true) means we're
    // genuinely foregrounded, so a foreground read is always allowed.
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (!hasFocus) return
        // Coming back to a stranded app is the most common way this is noticed
        // — the network that failed is usually long gone by now, so just retry.
        retryNow()
        trySyncHealth()
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
                val state = syncState()
                if (!state.enabled) {
                    Log.i(TAG, "Health Connect sync disabled for this account")
                    return@launch
                }
                val client = HealthConnectClient.getOrCreate(this@MainActivity)
                val granted = client.permissionController.getGrantedPermissions()
                if (granted.containsAll(activityPerms)) {
                    readAndSync(client, state.knownSources)
                }
                if (granted.containsAll(measurementPerms)) syncMeasurements(client)
                if (!granted.containsAll(hcPermissions) && !promptedThisLaunch) {
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
    private suspend fun syncState(): SyncState {
        val json = apiJson(SYNC_URL) ?: return SyncState(false, emptySet())
        val arr = json.optJSONArray("sources")
        val known = buildSet {
            for (i in 0 until (arr?.length() ?: 0)) {
                arr?.optString(i)?.takeIf { it.isNotEmpty() }?.let { add(it) }
            }
        }
        return SyncState(json.optBoolean("enabled", false), known)
    }

    // `knownSources` empty means "send every icon you can resolve" — right for
    // the just-granted-permission path, which is exactly when the server has
    // never seen any of them.
    private fun readAndSync(
        existing: HealthConnectClient? = null,
        knownSources: Set<String> = emptySet(),
    ) {
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
                // Workouts are a separate record type, and only readable with
                // their own grant — without it the day still syncs, just
                // without its minutes.
                val workouts =
                    if (client.permissionController.getGrantedPermissions()
                            .contains(exercisePerm)
                    ) readWorkouts(client, today) else emptyMap()

                // Empty days are dropped, not posted as zeros: the server would
                // skip them anyway, and a phone left at home must never wipe a
                // day the band did record. A day with only a workout on it is
                // empty by this rule, and the server would refuse its minutes
                // anyway — see the double-count note in lib/health-sync.ts.
                val days = buckets.mapNotNull { bucket ->
                    val steps = bucket.result[StepsRecord.COUNT_TOTAL] ?: 0L
                    val kcal = Math.round(
                        bucket.result[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]
                            ?.inKilocalories ?: 0.0
                    )
                    if (steps == 0L && kcal == 0L) null
                    else {
                        val dayKey = bucket.startTime.toLocalDate().toString()
                        val workout = workouts[dayKey]
                        DayTotals(
                            dayKey = dayKey,
                            steps = steps,
                            activeKcal = kcal,
                            liftingMin = workout?.liftingMin ?: 0,
                            cardioMin = workout?.cardioMin ?: 0,
                            source = sourceLabel(bucket.result.dataOrigins),
                        )
                    }
                }
                Log.i(TAG, "read HC ${days.size} day(s): $days")
                val packages = buckets.flatMapTo(mutableSetOf()) { bucket ->
                    bucket.result.dataOrigins.map { it.packageName }
                }
                postToServer(days, today.toString(), newSourceIcons(packages, knownSources))
            } catch (e: Exception) {
                Log.e(TAG, "readAndSync failed", e)
            }
        }
    }

    /**
     * Exercise sessions in the window, as minutes per local day.
     *
     * Read as records rather than aggregated: the day's total exercise
     * duration is one number, and we need it split by what kind of exercise it
     * was. A session is credited to the day it started on — one that runs past
     * midnight belongs to the evening you did it, not the morning after.
     */
    private suspend fun readWorkouts(
        client: HealthConnectClient,
        today: LocalDate,
    ): Map<String, Workout> {
        val zone = ZoneId.systemDefault()
        val byDay = mutableMapOf<String, Workout>()
        var pageToken: String? = null
        do {
            val response = client.readRecords(
                ReadRecordsRequest(
                    recordType = ExerciseSessionRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(
                        today.minusDays(SYNC_DAYS - 1).atStartOfDay(),
                        LocalDateTime.now(),
                    ),
                    pageToken = pageToken,
                )
            )
            for (record in response.records) {
                if (record.exerciseType in IGNORED_TYPES) continue
                val minutes = Duration.between(record.startTime, record.endTime).toMinutes()
                if (minutes <= 0) continue
                val dayKey = record.startTime.atZone(zone).toLocalDate().toString()
                val day = byDay.getOrPut(dayKey) { Workout() }
                if (record.exerciseType in LIFTING_TYPES) day.liftingMin += minutes
                else day.cardioMin += minutes
            }
            pageToken = response.pageToken
        } while (pageToken != null)
        return byDay
    }

    // The label and launcher icon for apps the server hasn't got yet. An icon
    // runs to a few kilobytes and a sync fires on every window focus, so the
    // usual pass sends none of them.
    private fun newSourceIcons(
        packages: Set<String>,
        knownSources: Set<String>,
    ): List<Pair<String, String>> = packages.mapNotNull { pkg ->
        val label = appLabel(pkg) ?: return@mapNotNull null
        if (label in knownSources) return@mapNotNull null
        appIconDataUri(pkg)?.let { label to it }
    }

    // The launcher icon, drawn to a small PNG. Adaptive icons are a pair of
    // layers with no bitmap of their own, so this draws the Drawable rather
    // than reaching for one.
    private fun appIconDataUri(pkg: String): String? = try {
        val drawable = packageManager.getApplicationIcon(pkg)
        val bitmap = Bitmap.createBitmap(ICON_PX, ICON_PX, Bitmap.Config.ARGB_8888)
        drawable.setBounds(0, 0, ICON_PX, ICON_PX)
        drawable.draw(Canvas(bitmap))
        val png = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, png)
        bitmap.recycle()
        "data:image/png;base64," +
            Base64.encodeToString(png.toByteArray(), Base64.NO_WRAP)
    } catch (e: Exception) {
        Log.i(TAG, "no icon for $pkg: ${e.message}")
        null
    }

    // Who Health Connect says the day's numbers came from. The aggregate already
    // carries its contributing packages, so this costs no extra read.
    private fun sourceLabel(origins: Set<DataOrigin>): String? {
        val labels = origins.mapNotNull { appLabel(it.packageName) }.distinct().sorted()
        return if (labels.isEmpty()) null else labels.joinToString(", ")
    }

    // The label the launcher shows for a package ("Mi Fitness"), or null for
    // our own app, blanks, and anything uninstalled since — nothing is
    // hardcoded, an unresolvable package is dropped rather than shown raw.
    private fun appLabel(pkg: String): String? {
        if (pkg.isBlank() || pkg == packageName) return null
        return try {
            packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0))
                .toString().trim().ifEmpty { null }
        } catch (e: PackageManager.NameNotFoundException) {
            null
        }
    }

    // ── Body measurements: two-way sync ─────────────────────────────────────

    // One pass at a time: a permission grant and the focus-regain from its
    // sheet (or a web nudge racing a foreground sync) must not interleave two
    // export/prune passes.
    private val measurementSyncActive = AtomicBoolean(false)

    // Mirror the server's weigh-ins / height / body fat into Health Connect,
    // then import what other apps wrote. The server sends its FULL desired
    // state every time: the first sync backfills the whole history, edits
    // overwrite (version bump), deletions prune, and a wiped Health Connect
    // heals itself on the next pass. verifyPermission is for the web-nudge
    // path, which must check for itself and never prompt mid-flow.
    private fun syncMeasurements(
        existing: HealthConnectClient? = null,
        verifyPermission: Boolean = false,
    ) {
        lifecycleScope.launch {
            if (!measurementSyncActive.compareAndSet(false, true)) return@launch
            try {
                val client = existing ?: HealthConnectClient.getOrCreate(this@MainActivity)
                if (verifyPermission &&
                    !client.permissionController.getGrantedPermissions()
                        .containsAll(measurementPerms)
                ) return@launch
                runMeasurementSync(client)
            } catch (e: Exception) {
                Log.e(TAG, "syncMeasurements failed", e)
            } finally {
                measurementSyncActive.set(false)
            }
        }
    }

    private suspend fun runMeasurementSync(client: HealthConnectClient) {
        val desired = fetchDesiredMeasurements() ?: return
        insertDesired(client, desired)
        // One paged read per record type serves both directions: our own stale
        // records get pruned (deletes propagate), foreign ones get imported.
        val foreignWeights = pruneAndCollectForeign(
            client, WeightRecord::class,
            desired.weights.mapTo(mutableSetOf()) { it.clientId },
        )
        val foreignHeight = pruneAndCollectForeign(
            client, HeightRecord::class, setOfNotNull(desired.height?.clientId),
        ).maxByOrNull { it.time }
        val foreignBodyFat = pruneAndCollectForeign(
            client, BodyFatRecord::class, setOfNotNull(desired.bodyFat?.clientId),
        ).maxByOrNull { it.time }
        postImports(foreignWeights, foreignHeight, foreignBodyFat)
    }

    // Null when signed out, offline, or the integration is switched off — all
    // reasons to leave Health Connect untouched this pass.
    private suspend fun fetchDesiredMeasurements(): DesiredMeasurements? {
        val json = apiJson(MEASUREMENTS_URL) ?: return null
        if (!json.optBoolean("enabled", false)) {
            Log.i(TAG, "measurement sync disabled for this account")
            return null
        }
        // A missing/zero epochMs must not become a 1970-dated record.
        fun parseWrite(o: JSONObject?, valueKey: String): HcWrite? {
            if (o == null) return null
            val id = o.optString("id")
            val value = o.optDouble(valueKey)
            val epochMs = o.optLong("epochMs")
            if (id.isEmpty() || !value.isFinite() || epochMs <= 0) return null
            return HcWrite(id, Instant.ofEpochMilli(epochMs), o.optLong("version"), value)
        }
        val weights = mutableListOf<HcWrite>()
        val arr = json.optJSONArray("weights") ?: JSONArray()
        for (i in 0 until arr.length()) {
            parseWrite(arr.optJSONObject(i), "kg")?.let { weights += it }
        }
        return DesiredMeasurements(
            weights,
            parseWrite(json.optJSONObject("height"), "cm"),
            parseWrite(json.optJSONObject("bodyFat"), "pct"),
        )
    }

    // Idempotent: same clientRecordId + version → Health Connect keeps what it
    // has; a bumped version (edited weigh-in) overwrites in place.
    private suspend fun insertDesired(client: HealthConnectClient, desired: DesiredMeasurements) {
        fun meta(w: HcWrite): Metadata =
            Metadata.manualEntry(clientRecordId = w.clientId, clientRecordVersion = w.version)
        val records = mutableListOf<Record>()
        desired.weights.mapTo(records) { WeightRecord(it.time, null, Mass.kilograms(it.value), meta(it)) }
        desired.height?.let { records += HeightRecord(it.time, null, Length.meters(it.value / 100.0), meta(it)) }
        desired.bodyFat?.let { records += BodyFatRecord(it.time, null, Percentage(it.value), meta(it)) }
        records.chunked(INSERT_CHUNK).forEach { client.insertRecords(it) }
        if (records.isNotEmpty()) Log.i(TAG, "exported ${records.size} record(s) to Health Connect")
    }

    // Page through every record of a type ONCE, serving both directions. Our
    // own records — which Health Connect always lets us read back in full, so
    // pruning sees the complete export regardless of read-permission windows —
    // are deleted when their clientRecordId fell off the desired list (that's
    // how in-app deletes propagate). Everything foreign is returned for import.
    private suspend fun <T : Record> pruneAndCollectForeign(
        client: HealthConnectClient,
        type: KClass<T>,
        keep: Set<String>,
    ): List<T> {
        val stale = mutableListOf<String>()
        val foreign = mutableListOf<T>()
        var pageToken: String? = null
        do {
            val response = client.readRecords(
                ReadRecordsRequest(
                    recordType = type,
                    timeRangeFilter = TimeRangeFilter.after(Instant.EPOCH),
                    pageToken = pageToken,
                )
            )
            for (record in response.records) {
                if (record.metadata.dataOrigin.packageName == packageName) {
                    if (record.metadata.clientRecordId !in keep) stale += record.metadata.id
                } else {
                    foreign += record
                }
            }
            pageToken = response.pageToken
        } while (pageToken != null)
        if (stale.isNotEmpty()) {
            Log.i(TAG, "pruning ${stale.size} stale ${type.simpleName} record(s)")
            client.deleteRecords(type, stale, emptyList())
        }
        return foreign
    }

    // Hand what OTHER apps wrote — a smart scale's weigh-ins, a height set in
    // Mi Fitness — to the server, which de-dups by record id and decides what
    // applies. Weights go in bounded chunks so a years-long scale history
    // can't blow the request size or its timeout.
    private suspend fun postImports(
        weights: List<WeightRecord>,
        height: HeightRecord?,
        bodyFat: BodyFatRecord?,
    ) {
        if (weights.isEmpty() && height == null && bodyFat == null) return
        // One binder IPC per package, not per record ("" = known-unresolvable).
        val labelCache = mutableMapOf<String, String>()
        fun label(pkg: String): String? =
            labelCache.getOrPut(pkg) { appLabel(pkg) ?: "" }.ifEmpty { null }
        fun measurementJson(metadata: Metadata, time: Instant): JSONObject =
            JSONObject().put("hcId", metadata.id).put("epochMs", time.toEpochMilli())

        var imported = 0
        var profileChanged = false
        val chunks = if (weights.isEmpty()) listOf(emptyList()) else weights.chunked(INSERT_CHUNK)
        for ((i, chunk) in chunks.withIndex()) {
            val arr = JSONArray()
            for (r in chunk) {
                arr.put(
                    measurementJson(r.metadata, r.time)
                        .put("kg", r.weight.inKilograms)
                        .put("source", label(r.metadata.dataOrigin.packageName))
                )
            }
            val body = JSONObject().put("weights", arr)
            if (i == chunks.lastIndex) { // the singletons ride the last chunk
                height?.let {
                    body.put("height", measurementJson(it.metadata, it.time).put("cm", it.height.inMeters * 100))
                }
                bodyFat?.let {
                    body.put("bodyFat", measurementJson(it.metadata, it.time).put("pct", it.percentage.value))
                }
            }
            // Network hiccup mid-batch: stop here, the next pass re-sends.
            val resp = apiJson(MEASUREMENTS_URL, body) ?: return
            imported += resp.optInt("imported", 0)
            profileChanged = profileChanged ||
                resp.optBoolean("heightApplied", false) ||
                resp.optBoolean("bodyFatApplied", false)
        }
        Log.i(TAG, "measurement import: $imported weigh-in(s), profileChanged=$profileChanged")
        // Only poke the web app when something actually changed server-side —
        // the routine "nothing new" pass shouldn't cost a refresh.
        if (imported > 0 || profileChanged) {
            dispatchWebEvent("kcals:measurements-synced", "{imported:$imported}")
        }
    }

    // Cookie-authenticated JSON round-trip with the server. GET when `body` is
    // null, POST otherwise. Null result = signed out, offline, or non-2xx —
    // callers just skip their sync pass.
    private suspend fun apiJson(url: String, body: JSONObject? = null): JSONObject? =
        withContext(Dispatchers.IO) {
            val cookie = CookieManager.getInstance().getCookie(ORIGIN)
            if (cookie.isNullOrBlank()) {
                Log.i(TAG, "no session cookie yet — skipping $url")
                return@withContext null
            }
            try {
                val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                    requestMethod = if (body == null) "GET" else "POST"
                    connectTimeout = 15000
                    readTimeout = 15000
                    setRequestProperty("Cookie", cookie)
                    if (body != null) {
                        doOutput = true
                        setRequestProperty("Content-Type", "application/json")
                    }
                }
                if (body != null) conn.outputStream.use { it.write(body.toString().toByteArray()) }
                val code = conn.responseCode
                val json = if (code in 200..299) {
                    JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
                } else {
                    Log.i(TAG, "$url -> HTTP $code")
                    null
                }
                conn.disconnect()
                json
            } catch (e: Exception) {
                Log.e(TAG, "apiJson $url failed", e)
                null
            }
        }

    // Tell the web app something happened natively (a sync landed, imports
    // applied) so it can re-fetch without the user reopening the app.
    private fun dispatchWebEvent(name: String, detailJson: String) {
        runOnUiThread {
            bridge?.webView?.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('$name',{detail:$detailJson}));",
                null,
            )
        }
    }

    private suspend fun postToServer(
        days: List<DayTotals>,
        todayKey: String,
        sources: List<Pair<String, String>>,
    ) {
        if (days.isEmpty()) {
            Log.i(TAG, "no Health Connect data in window — skipping sync")
            return
        }
        val arr = JSONArray()
        for (day in days) {
            arr.put(
                JSONObject()
                    .put("dayKey", day.dayKey)
                    .put("steps", day.steps)
                    .put("activeKcal", day.activeKcal)
                    .put("liftingMin", day.liftingMin)
                    .put("cardioMin", day.cardioMin)
                    // JSONObject.put(String, null) omits the key, which
                    // the server reads as "no source" — exactly right.
                    .put("source", day.source)
            )
        }
        val body = JSONObject().put("days", arr)
        if (sources.isNotEmpty()) {
            val icons = JSONArray()
            for ((name, icon) in sources) {
                icons.put(JSONObject().put("name", name).put("icon", icon))
            }
            body.put("sources", icons)
            Log.i(TAG, "posting ${sources.size} new source icon(s)")
        }
        if (apiJson(SYNC_URL, body) == null) return
        Log.i(TAG, "sync POST ${days.size} day(s) ok")
        // Tell the web app the sync landed (with today's numbers) so it
        // re-fetches and can show a subtle "synced" note without the user
        // reopening the app. Fired even when today is still empty, so an
        // in-flight "Sync now" button always settles.
        val today = days.firstOrNull { it.dayKey == todayKey }
        dispatchWebEvent(
            "kcals:health-synced",
            "{steps:${today?.steps ?: 0L},activeKcal:${today?.activeKcal ?: 0L}}",
        )
    }

    // Exposed to the web app as window.KcalsNative. syncHealth() re-reads Health
    // Connect on demand (e.g. a "Sync now" button); the POST then fires the
    // kcals:health-synced event above.
    inner class NativeInterface {
        @JavascriptInterface
        fun syncHealth() {
            runOnUiThread { trySyncHealth() }
        }

        // A weigh-in (or the profile) just changed in the web UI — push it to
        // Health Connect now instead of waiting for the next app open. Checks
        // permission itself and never prompts mid-flow.
        @JavascriptInterface
        fun syncMeasurements() {
            runOnUiThread {
                if (HealthConnectClient.getSdkStatus(this@MainActivity) ==
                    HealthConnectClient.SDK_AVAILABLE
                ) {
                    this@MainActivity.syncMeasurements(verifyPermission = true)
                }
            }
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

    // ---- Site-unreachable recovery ----------------------------------------
    //
    // The WebView loads the live site fresh on every launch (LOAD_NO_CACHE
    // above, plus the service-worker wipe in onCreate), so there is nothing to
    // fall back on: one network blip — Wi-Fi associated but not routing, a
    // mobile-data handover while the app sat backgrounded — and Chromium
    // paints its own "Webpage not available" page.
    //
    // That page is a dead end. None of our JS ran, so the offline banner in
    // native-bridge.tsx can't render and there is no reload control; the only
    // way out is force-quitting the app. So recovery lives HERE, in native
    // Kotlin — the only layer still running when the page load fails.
    //
    // Most of these blips clear themselves within a second or two, so a failure
    // is NOT shown to the user straight away: we retry quietly behind a spinner
    // first, and only admit something is wrong once those retries are spent. A
    // hiccup that fixes itself should look like a slightly slow load, not an
    // error screen.
    private var overlay: RecoveryOverlay? = null
    private var sawMainFrameError = false
    private var retryAttempt = 0
    private val retryHandler = Handler(Looper.getMainLooper())

    // The URL that actually failed, so a retry resumes where the user was
    // heading rather than dumping them back on the home screen.
    private var failedUrl: String? = null

    private inner class KcalsWebViewClient(b: Bridge) : BridgeWebViewClient(b) {
        override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
            super.onPageStarted(view, url, favicon)
            sawMainFrameError = false
        }

        override fun onReceivedError(
            view: WebView,
            request: WebResourceRequest,
            error: WebResourceError,
        ) {
            super.onReceivedError(view, request, error)
            // A failed subresource (an image, a prefetch) is none of our
            // business — only a dead main frame strands the user.
            if (!request.isForMainFrame) return
            sawMainFrameError = true
            val url = request.url?.toString()
            failedUrl = if (url != null && url.startsWith(ORIGIN)) url else null
            Log.i(SHELL_TAG, "main-frame load failed: ${error.errorCode} ${error.description}")
            runOnUiThread { onLoadFailed() }
        }

        override fun onPageFinished(view: WebView, url: String) {
            super.onPageFinished(view, url)
            // onReceivedError fires before onPageFinished, so a clean finish
            // here means the site really did load.
            if (!sawMainFrameError) runOnUiThread { onLoadSucceeded() }
        }
    }

    // A dropped load usually fixes itself the moment a usable network is back
    // (walking into Wi-Fi range, mobile data waking up) — take that signal
    // instead of making the user notice and tap.
    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            runOnUiThread { retryNow() }
        }
    }

    private fun onLoadFailed() {
        val ui = showOverlay()
        if (retryAttempt < RETRY_DELAYS_MS.size) {
            // Still within the quiet budget — keep the spinner up and try
            // again without ever telling the user something went wrong.
            val delay = RETRY_DELAYS_MS[retryAttempt]
            retryAttempt++
            ui.connecting()
            retryHandler.removeCallbacksAndMessages(null)
            retryHandler.postDelayed({ loadRetry() }, delay)
        } else {
            // Out of quiet retries: say so plainly, and say the right thing —
            // "you're offline" and "the site isn't answering" want different
            // reactions from the user.
            ui.failed(offline = !hasUsableNetwork())
        }
    }

    private fun onLoadSucceeded() {
        retryHandler.removeCallbacksAndMessages(null)
        retryAttempt = 0
        failedUrl = null
        overlay?.hide()
    }

    // Triggered by the things that mean "conditions just changed": a tap on Try
    // again, a usable network arriving, the app being reopened. Each earns a
    // fresh quiet-retry budget.
    private fun retryNow() {
        if (overlay?.isShowing != true) return
        retryAttempt = 0
        loadRetry()
    }

    private fun loadRetry() {
        retryHandler.removeCallbacksAndMessages(null)
        overlay?.connecting()
        bridge?.webView?.loadUrl(failedUrl ?: ORIGIN)
    }

    private fun showOverlay(): RecoveryOverlay {
        overlay?.let { return it }
        val ui = RecoveryOverlay()
        overlay = ui
        // Added to the content view now, i.e. after the splash view, so it
        // covers a splash that never got hidden — hiding the splash is the web
        // bridge's job, and by definition the web bridge didn't run.
        addContentView(
            ui.root,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ),
        )
        return ui
    }

    // Whether Android currently has a network it has actually validated as
    // reaching the internet — "Wi-Fi connected, no internet" reads as false,
    // which is exactly the case worth naming for the user. Unknown counts as
    // usable: better to look like we're still trying than to wrongly accuse
    // the user of being offline.
    private fun hasUsableNetwork(): Boolean {
        val cm = getSystemService(ConnectivityManager::class.java) ?: return true
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun dp(value: Int): Int =
        TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value.toFloat(),
            resources.displayMetrics,
        ).toInt()

    // Full-bleed cover for the dead page, in the app's own dark palette so a
    // stumble still looks like kcals rather than a stock Android error. Two
    // states: a bare spinner while we retry quietly, and the explanation plus
    // a Try again button once we've stopped pretending.
    private inner class RecoveryOverlay {
        private val spinner = ProgressBar(this@MainActivity).apply {
            isIndeterminate = true
            indeterminateTintList =
                ColorStateList.valueOf(Color.parseColor(OVERLAY_PRIMARY))
        }

        private val title = TextView(this@MainActivity).apply {
            setTextColor(Color.parseColor(OVERLAY_TEXT))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
            gravity = Gravity.CENTER
        }

        private val body = TextView(this@MainActivity).apply {
            setTextColor(Color.parseColor(OVERLAY_MUTED))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            gravity = Gravity.CENTER
            setPadding(0, dp(10), 0, dp(24))
        }

        private val button = Button(this@MainActivity).apply {
            text = "Try again"
            isAllCaps = false
            setTextColor(Color.BLACK)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            background = GradientDrawable().apply {
                cornerRadius = dp(999).toFloat()
                setColor(Color.parseColor(OVERLAY_PRIMARY))
            }
            stateListAnimator = null
            setPadding(dp(32), 0, dp(32), 0)
            setOnClickListener { retryNow() }
        }

        val root: View = LinearLayout(this@MainActivity).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor(OVERLAY_BG))
            setPadding(dp(32), dp(32), dp(32), dp(32))
            // Swallow taps so nothing reaches the dead page underneath.
            isClickable = true
            addView(spinner, LinearLayout.LayoutParams(dp(36), dp(36)))
            addView(title)
            addView(body)
            addView(
                button,
                LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(48)),
            )
        }

        val isShowing: Boolean
            get() = root.visibility == View.VISIBLE

        fun connecting() = setState(spinnerVisible = true)

        fun failed(offline: Boolean) {
            title.text = if (offline) "You're offline" else "Can't reach kcals"
            body.text = if (offline) {
                "Reconnect to Wi-Fi or mobile data and kcals will pick up " +
                    "where you left off."
            } else {
                "kcals didn't answer. Nothing has been lost — your data is " +
                    "safe on the server."
            }
            setState(spinnerVisible = false)
        }

        fun hide() {
            root.visibility = View.GONE
        }

        private fun setState(spinnerVisible: Boolean) {
            spinner.visibility = if (spinnerVisible) View.VISIBLE else View.GONE
            val message = if (spinnerVisible) View.GONE else View.VISIBLE
            title.visibility = message
            body.visibility = message
            button.visibility = message
            root.visibility = View.VISIBLE
        }
    }

    override fun onDestroy() {
        retryHandler.removeCallbacksAndMessages(null)
        try {
            getSystemService(ConnectivityManager::class.java)
                ?.unregisterNetworkCallback(networkCallback)
        } catch (ignored: Exception) {
        }
        super.onDestroy()
    }

    private fun deleteRecursively(f: File?) {
        if (f == null || !f.exists()) return
        f.listFiles()?.forEach { deleteRecursively(it) }
        f.delete()
    }
}
