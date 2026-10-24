package id.sakelar.client

import android.app.*
import android.content.*
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/** Only the fixed SuperGPT repository, matching package/signing key and newer versions are accepted. */
object ReleaseUpdater {
  private const val API = "https://api.github.com/repos/gabrieelibrahim/SuperGPT/releases/latest"
  private const val JOB = 2425
  private val worker = java.util.concurrent.Executors.newSingleThreadExecutor()
  @Volatile var observer: (() -> Unit)? = null
  private fun prefs(c: Context) = c.getSharedPreferences("supergpt-updates", Context.MODE_PRIVATE)
  private fun directory(c: Context) = File(c.getExternalFilesDir(null) ?: error("Penyimpanan unduhan tidak tersedia."), "updates").apply { mkdirs() }
  private fun apk(c: Context) = File(directory(c), "SuperGPT.apk")
  private fun manager(c: Context) = c.getSystemService(DownloadManager::class.java)
  @Suppress("DEPRECATION") private fun installed(c: Context) = c.packageManager.getPackageInfo(c.packageName, 0)
  private fun versionCode(info: android.content.pm.PackageInfo) = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()
  private fun state(c: Context, phase: String, message: String = "") { prefs(c).edit().putString("phase", phase).putString("message", message).apply(); observer?.invoke() }
  fun status(c: Context): JSONObject {
    val p = prefs(c); val info = installed(c)
    return JSONObject().put("phase", p.getString("phase", "idle")).put("message", p.getString("message", ""))
      .put("currentVersion", info.versionName ?: "").put("version", p.getString("version", ""))
      .put("autoCheck", p.getBoolean("autoCheck", true)).put("autoDownload", p.getBoolean("autoDownload", true)).put("autoInstall", p.getBoolean("autoInstall", true)).put("wifiOnly", p.getBoolean("wifiOnly", true))
      .put("lastChecked", p.getLong("lastChecked", 0)).put("native", true)
  }
  fun configure(c: Context, request: JSONObject) {
    val p = prefs(c); val edit = p.edit()
    for (key in listOf("autoCheck", "autoDownload", "autoInstall", "wifiOnly")) if (request.has(key) && request.get(key) is Boolean) edit.putBoolean(key, request.getBoolean(key))
    edit.apply(); schedule(c)
    if (!p.getBoolean("autoDownload", true) && p.getLong("downloadId", -1) != -1L) {
      manager(c).remove(p.getLong("downloadId", -1)); p.edit().remove("downloadId").apply(); state(c, "available", "Unduhan otomatis dihentikan.")
    }
  }
  fun schedule(c: Context) {
    val jobs = c.getSystemService(android.app.job.JobScheduler::class.java)
    if (!prefs(c).getBoolean("autoCheck", true)) { jobs.cancel(JOB); return }
    if (jobs.getPendingJob(JOB) == null) jobs.schedule(android.app.job.JobInfo.Builder(JOB, ComponentName(c, UpdateCheckJob::class.java))
      .setRequiredNetworkType(android.app.job.JobInfo.NETWORK_TYPE_ANY).setPeriodic(12 * 60 * 60 * 1000L).setPersisted(true).build())
  }
  fun resume(c: Context) { schedule(c); submit { reconcile(c); if (prefs(c).getBoolean("autoCheck", true)) check(c, false) } }
  fun background(c: Context) { android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({ submit { tryAutoInstall(c.applicationContext) } }, 2000) }
  fun submit(action: () -> Unit) { worker.execute { try { action() } catch (_: Exception) { android.util.Log.w("SuperGPTUpdates", "Optional update operation could not finish.") } } }
  private fun json(url: String): JSONObject {
    val connection = URL(url).openConnection() as HttpURLConnection
    connection.connectTimeout = 20000; connection.readTimeout = 20000; connection.instanceFollowRedirects = false
    connection.setRequestProperty("Accept", "application/vnd.github+json"); connection.setRequestProperty("User-Agent", "SuperGPT-Android-Updater")
    try {
      if (connection.responseCode != 200) error(if (connection.responseCode == 403 || connection.responseCode == 429) "Batas pemeriksaan GitHub tercapai. Coba lagi nanti." else "GitHub belum dapat diakses (HTTP ${connection.responseCode}).")
      val data = connection.inputStream.use { input -> val out = java.io.ByteArrayOutputStream(); val buf = ByteArray(8192); var n = input.read(buf); while (n != -1) { if (out.size() + n > 1024 * 1024) error("Metadata rilis terlalu besar."); out.write(buf, 0, n); n = input.read(buf) }; out.toString("UTF-8") }
      return JSONObject(data)
    } finally { connection.disconnect() }
  }
  fun check(c: Context, force: Boolean) {
    val p = prefs(c)
    if (!force && System.currentTimeMillis() - p.getLong("lastAttempt", 0) < 6 * 60 * 60 * 1000L) return
    if (p.getString("phase", "") == "installing") return
    val remembered = p.getString("version", "") ?: ""
    if (remembered.isNotEmpty() && !ReleasePolicy.newer(remembered, installed(c).versionName ?: "0.0.0")) { forgetRelease(c); apk(c).delete(); if (p.getString("phase", "") == "ready") state(c, "idle") }
    if (p.getLong("downloadId", -1) != -1L || p.getString("phase", "") == "ready") { reconcile(c); return }
    p.edit().putLong("lastAttempt", System.currentTimeMillis()).apply(); state(c, "checking")
    try {
      val release = json(API)
      require(!release.optBoolean("draft") && !release.optBoolean("prerelease")) { "Rilis bukan versi stabil." }
      val version = release.getString("tag_name")
      require(version.matches(Regex("v[0-9]+\\.[0-9]+\\.[0-9]+"))) { "Tag rilis harus berbentuk v1.2.0." }
      val newer = ReleasePolicy.newer(version, installed(c).versionName ?: "0.0.0")
      p.edit().putLong("lastChecked", System.currentTimeMillis()).apply()
      if (!newer) { state(c, "current", "SuperGPT sudah memakai versi terbaru."); return }
      val assets = release.getJSONArray("assets")
      val matches = (0 until assets.length()).map { assets.getJSONObject(it) }.filter { it.optString("name") == "SuperGPT.apk" }
      require(matches.size == 1) { "Rilis terbaru belum menyediakan SuperGPT.apk." }
      val asset = matches.single(); val url = asset.getString("browser_download_url")
      require(Uri.parse(url).scheme == "https" && Uri.parse(url).host == "github.com" && Uri.parse(url).path == "/gabrieelibrahim/SuperGPT/releases/download/$version/SuperGPT.apk") { "Alamat APK tidak valid." }
      val digest = asset.optString("digest")
      ReleasePolicy.validate(version, url, digest, asset.getLong("size"))
      p.edit().putString("version", version).putString("url", url).putString("sha256", digest.substringAfter(':').lowercase()).putLong("size", asset.getLong("size")).apply()
      state(c, "available", "Pembaruan $version tersedia.")
      if (p.getBoolean("autoDownload", true)) download(c)
    } catch (error: Exception) { state(c, "error", error.message ?: "Pemeriksaan pembaruan gagal.") }
  }
  fun download(c: Context) {
    val p = prefs(c)
    try {
      if (p.getLong("downloadId", -1) != -1L) { reconcile(c); return }
      val version = p.getString("version", "") ?: ""; val url = p.getString("url", "") ?: ""
      require(version.matches(Regex("v[0-9]+\\.[0-9]+\\.[0-9]+")) && url == "https://github.com/gabrieelibrahim/SuperGPT/releases/download/$version/SuperGPT.apk") { "Periksa rilis sebelum mengunduh." }
      val file = apk(c); if (file.exists()) require(file.delete()) { "Unduhan lama belum dapat dibersihkan." }
      val request = DownloadManager.Request(Uri.parse(url)).setTitle("SuperGPT $version").setDescription("Mengunduh pembaruan SuperGPT.apk")
        .setDestinationUri(Uri.fromFile(file)).setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
        .setAllowedOverRoaming(false).setAllowedNetworkTypes(if (p.getBoolean("wifiOnly", true)) DownloadManager.Request.NETWORK_WIFI else DownloadManager.Request.NETWORK_WIFI or DownloadManager.Request.NETWORK_MOBILE)
      val id = manager(c).enqueue(request); p.edit().putLong("downloadId", id).putBoolean("autoInstallBlocked", false).apply(); state(c, "downloading", if (p.getBoolean("wifiOnly", true)) "Mengunduh saat Wi-Fi tersedia…" else "Mengunduh pembaruan…")
    } catch (error: Exception) { state(c, "error", error.message ?: "Unduhan gagal.") }
  }
  fun reconcile(c: Context) {
    val p = prefs(c); val id = p.getLong("downloadId", -1)
    if (p.getString("phase", "") == "installing") {
      if ("v${installed(c).versionName}" == p.getString("version", "")) { clearSession(c); apk(c).delete(); state(c, "current", "SuperGPT berhasil diperbarui.") }
      else if (c.packageManager.packageInstaller.getSessionInfo(p.getInt("installSession", -1)) == null || System.currentTimeMillis() - p.getLong("installStarted", 0) > 15 * 60 * 1000L) {
        clearSession(c); p.edit().putBoolean("autoInstallBlocked", true).apply(); state(c, "ready", "Pemasangan belum selesai. Ketuk Pasang untuk melanjutkan.")
      }
      return
    }
    if (id == -1L) {
      if (p.getString("phase", "") == "ready") try { verify(c) } catch (_: Exception) { state(c, "idle"); apk(c).delete() }
      return
    }
    try {
      manager(c).query(DownloadManager.Query().setFilterById(id)).use { cursor ->
        if (!cursor.moveToFirst()) { forgetRelease(c); state(c, "error", "Unduhan tidak ditemukan. Ketuk Periksa pembaruan."); return }
        when (cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))) {
          DownloadManager.STATUS_SUCCESSFUL -> { p.edit().remove("downloadId").apply(); verify(c); state(c, "ready", "Pembaruan siap dipasang."); notifyReady(c); tryAutoInstall(c) }
          DownloadManager.STATUS_FAILED -> { forgetRelease(c); apk(c).delete(); state(c, "error", "Unduhan gagal. Periksa jaringan dan ruang penyimpanan, lalu periksa pembaruan lagi.") }
        }
      }
    } catch (error: Exception) { forgetRelease(c); apk(c).delete(); state(c, "error", error.message ?: "APK gagal diverifikasi.") }
  }
  @Suppress("DEPRECATION") private fun signers(info: android.content.pm.PackageInfo): Set<String> {
    val signatures = if (Build.VERSION.SDK_INT >= 28) info.signingInfo?.apkContentsSigners else info.signatures
    return signatures?.map { signature -> MessageDigest.getInstance("SHA-256").digest(signature.toByteArray()).joinToString("") { "%02x".format(it) } }?.toSet() ?: emptySet()
  }
  @Suppress("DEPRECATION") fun verify(c: Context) {
    val file = apk(c); val p = prefs(c)
    require(file.isFile && file.length() == p.getLong("size", -1)) { "Ukuran APK tidak cocok." }
    val hash = MessageDigest.getInstance("SHA-256"); file.inputStream().use { input -> val buffer = ByteArray(65536); var n = input.read(buffer); while (n != -1) { hash.update(buffer, 0, n); n = input.read(buffer) } }
    require(hash.digest().joinToString("") { "%02x".format(it) } == p.getString("sha256", "")) { "Checksum APK tidak cocok." }
    val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
    val target = c.packageManager.getPackageArchiveInfo(file.absolutePath, flags) ?: error("Arsip APK tidak valid.")
    val current = c.packageManager.getPackageInfo(c.packageName, flags)
    require(target.packageName == c.packageName && versionCode(target) > versionCode(current) && "v${target.versionName}" == p.getString("version", "")) { "Identitas atau versi APK tidak cocok dengan aplikasi ini." }
    require(signers(current).isNotEmpty() && signers(current) == signers(target)) { "Sertifikat APK berbeda. Pembaruan ditolak." }
  }
  fun install(activity: Activity) {
    submit { try {
      verify(activity)
      clearSession(activity)
      activity.runOnUiThread {
        try {
          if (Build.VERSION.SDK_INT >= 26 && !activity.packageManager.canRequestPackageInstalls()) {
            activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}"))); return@runOnUiThread
          }
          val uri = FileProvider.getUriForFile(activity, activity.packageName + ".fileprovider", apk(activity))
          activity.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
        } catch (_: Exception) { state(activity, "ready", "Installer belum dapat dibuka. Periksa izin pemasangan aplikasi.") }
      }
    } catch (error: Exception) { state(activity, "error", error.message ?: "Pembaruan ditolak.") } }
  }
  /** Drops a remembered release so the next tap checks GitHub again instead of reusing an old download. */
  private fun forgetRelease(c: Context) { prefs(c).edit().remove("downloadId").remove("version").remove("url").remove("sha256").remove("size").apply() }
  private fun clearSession(c: Context) {
    val p = prefs(c); val session = p.getInt("installSession", -1); p.edit().remove("installSession").apply()
    if (session != -1) try { c.packageManager.packageInstaller.abandonSession(session) } catch (_: Exception) { }
  }
  fun tryAutoInstall(c: Context) {
    val p = prefs(c)
    if (Build.VERSION.SDK_INT < 31 || p.getString("phase", "") != "ready") return
    if (!ReleasePolicy.canAutoInstall(Build.VERSION.SDK_INT, p.getBoolean("autoInstall", true), p.getBoolean("autoInstallBlocked", false), TaskForegroundService.active(), androidx.lifecycle.ProcessLifecycleOwner.get().lifecycle.currentState.isAtLeast(androidx.lifecycle.Lifecycle.State.STARTED), c.packageManager.canRequestPackageInstalls())) return
    try {
      verify(c); clearSession(c)
      val installer = c.packageManager.packageInstaller
      val params = android.content.pm.PackageInstaller.SessionParams(android.content.pm.PackageInstaller.SessionParams.MODE_FULL_INSTALL)
      params.setAppPackageName(c.packageName); params.setSize(apk(c).length())
      params.setRequireUserAction(android.content.pm.PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
      val id = installer.createSession(params); p.edit().putInt("installSession", id).putLong("installStarted", System.currentTimeMillis()).apply()
      installer.openSession(id).use { session ->
        session.openWrite("SuperGPT.apk", 0, apk(c).length()).use { output -> apk(c).inputStream().use { it.copyTo(output) }; session.fsync(output) }
        val result = PendingIntent.getBroadcast(c, 2426, Intent(c, UpdateInstallReceiver::class.java).putExtra("supergpt-session", id), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE)
        state(c, "installing", "Memasang pembaruan saat aplikasi tidak digunakan…")
        session.commit(result.intentSender)
      }
    } catch (_: Exception) { clearSession(c); p.edit().putBoolean("autoInstallBlocked", true).apply(); state(c, "ready", "Pembaruan siap. Ketuk Pasang untuk melanjutkan."); notifyReady(c) }
  }
  fun installResult(c: Context, intent: Intent) {
    val p = prefs(c); if (intent.getIntExtra("supergpt-session", -2) != p.getInt("installSession", -1)) return
    val status = intent.getIntExtra(android.content.pm.PackageInstaller.EXTRA_STATUS, android.content.pm.PackageInstaller.STATUS_FAILURE)
    clearSession(c)
    if (status == android.content.pm.PackageInstaller.STATUS_SUCCESS) { apk(c).delete(); state(c, "current", "SuperGPT berhasil diperbarui.") }
    else { p.edit().putBoolean("autoInstallBlocked", true).apply(); state(c, "ready", if (status == android.content.pm.PackageInstaller.STATUS_PENDING_USER_ACTION) "Android meminta konfirmasi. Ketuk Pasang untuk melanjutkan." else "Pemasangan otomatis belum berhasil. Ketuk Pasang untuk mencoba lagi."); notifyReady(c) }
  }
  private fun notifyReady(c: Context) {
    if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
    val notices = c.getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= 26) notices.createNotificationChannel(NotificationChannel("app-updates", "Pembaruan aplikasi", NotificationManager.IMPORTANCE_DEFAULT))
    val intent = PendingIntent.getActivity(c, JOB, Intent(c, MainActivity::class.java).putExtra("supergpt-open-updates", true), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    notices.notify(JOB, NotificationCompat.Builder(c, "app-updates").setSmallIcon(android.R.drawable.stat_sys_download_done).setContentTitle("Pembaruan SuperGPT siap").setContentText("Ketuk untuk membuka aplikasi dan memasang pembaruan.").setContentIntent(intent).setAutoCancel(true).build())
  }
}

class UpdateDownloadReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE) return
    val expected = context.getSharedPreferences("supergpt-updates", Context.MODE_PRIVATE).getLong("downloadId", -1)
    if (expected == -1L || intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -2) != expected) return
    val result = goAsync(); ReleaseUpdater.submit { try { ReleaseUpdater.reconcile(context.applicationContext) } finally { result.finish() } }
  }
}
class UpdateCheckJob : android.app.job.JobService() {
  override fun onStartJob(params: android.app.job.JobParameters): Boolean {
    ReleaseUpdater.submit { try { ReleaseUpdater.reconcile(applicationContext); ReleaseUpdater.check(applicationContext, false); ReleaseUpdater.tryAutoInstall(applicationContext) } finally { jobFinished(params, false) } }; return true
  }
  override fun onStopJob(params: android.app.job.JobParameters) = true
}
class UpdateInstallReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) { val result = goAsync(); ReleaseUpdater.submit { try { ReleaseUpdater.installResult(context.applicationContext, intent) } finally { result.finish() } } }
}
