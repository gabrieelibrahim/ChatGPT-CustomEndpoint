package id.sakelar.client

import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.webkit.WebView
import androidx.core.app.NotificationCompat
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import org.json.JSONObject

/** User-initiated exports and locally requested task notifications. */
class DeviceActionsBridge(private val activity: Activity) {
  private data class Export(val id: String, val text: String, val reply: JavaScriptReplyProxy)
  private var pending: Export? = null
  private val worker = java.util.concurrent.Executors.newSingleThreadExecutor()
  private val prefs = activity.getSharedPreferences("supergpt-notifications", Activity.MODE_PRIVATE)
  private var lastHapticTick = 0L
  private var lastHapticComplete = 0L
  fun install(webView: WebView, origins: Set<String>) {
    WebViewCompat.addWebMessageListener(webView, "SuperGPTHaptics", origins) { _, message, _, mainFrame, _ ->
      if (!mainFrame || message.type != WebMessageCompat.TYPE_STRING || message.data !in listOf("tick", "complete")) return@addWebMessageListener
      activity.runOnUiThread {
        val complete = message.data == "complete"; val now = android.os.SystemClock.elapsedRealtime()
        val elapsed = now - if (complete) lastHapticComplete else lastHapticTick
        if (activity.hasWindowFocus() && elapsed >= if (complete) 150 else 750) {
          if (complete) lastHapticComplete = now else lastHapticTick = now
          val kind = if (complete && Build.VERSION.SDK_INT >= 30) android.view.HapticFeedbackConstants.CONFIRM else if (complete) android.view.HapticFeedbackConstants.KEYBOARD_TAP else android.view.HapticFeedbackConstants.CLOCK_TICK
          webView.performHapticFeedback(kind)
        }
      }
    }
    WebViewCompat.addWebMessageListener(webView, "SuperGPTExport", origins) { _, message, _, mainFrame, reply ->
      if (!mainFrame || message.type != WebMessageCompat.TYPE_STRING) return@addWebMessageListener
      val raw = message.data ?: return@addWebMessageListener
      activity.runOnUiThread {
        var id = ""
        try {
          val value = JSONObject(raw); id = value.getString("id")
          require(raw.length <= 64 * 1024 * 1024) { "Ekspor melebihi 64 MB." }
          require(pending == null) { "Selesaikan ekspor yang sedang terbuka." }
          val text = value.getString("text")
          val name = value.getString("name").replace(Regex("[^\\p{L}\\p{N}._ -]"), "_").take(160)
          pending = Export(id, text, reply)
          val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE, name)
          @Suppress("DEPRECATION")
          activity.startActivityForResult(intent, 2420)
        } catch (error: Exception) { if (pending?.id == id) pending = null; respond(reply, id, "error", error.message ?: "Ekspor tidak tersedia.") }
      }
    }
    WebViewCompat.addWebMessageListener(webView, "SuperGPTNotifications", origins) { _, message, _, mainFrame, _ ->
      if (!mainFrame || message.type != WebMessageCompat.TYPE_STRING) return@addWebMessageListener
      val raw = message.data ?: return@addWebMessageListener
      if (raw.length > 4096) return@addWebMessageListener
      activity.runOnUiThread { try {
        val value = JSONObject(raw)
        when (value.optString("op")) {
          "configure" -> {
            val enabled = value.optBoolean("enabled")
            prefs.edit().putBoolean("enabled", enabled).apply()
            if (enabled && value.optBoolean("requestPermission") && Build.VERSION.SDK_INT >= 33 && activity.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) activity.requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 2421)
          }
          "notify" -> if (prefs.getBoolean("enabled", false)) notify(value.optString("title").take(160), value.optString("body").take(300))
        }
      } catch (_: Exception) { } }
    }
  }
  fun result(requestCode: Int, resultCode: Int, intent: Intent?): Boolean {
    if (requestCode != 2420) return false
    val export = pending ?: return true; pending = null
    val uri = intent?.data
    if (resultCode != Activity.RESULT_OK || uri == null) { respond(export.reply, export.id, "cancelled"); return true }
    worker.execute { try {
      val stream = activity.contentResolver.openOutputStream(uri, "wt") ?: error("Lokasi tidak dapat ditulis.")
      stream.bufferedWriter(Charsets.UTF_8).use { it.write(export.text) }
      activity.runOnUiThread { respond(export.reply, export.id, "saved") }
    } catch (_: Exception) { activity.runOnUiThread { respond(export.reply, export.id, "error", "File belum tersimpan. Periksa ruang dan lokasi penyimpanan.") } } }
    return true
  }
  private fun respond(reply: JavaScriptReplyProxy, id: String, status: String, error: String? = null) { try { reply.postMessage(JSONObject().put("id", id).put("status", status).apply { if (error != null) put("error", error) }.toString()) } catch (_: Exception) { } }
  private fun notify(title: String, body: String) {
    val manager = activity.getSystemService(NotificationManager::class.java) ?: return
    if (Build.VERSION.SDK_INT >= 33 && activity.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) return
    if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel("task-complete", "Tugas selesai", NotificationManager.IMPORTANCE_DEFAULT))
    val intent = Intent(activity, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra("supergpt-chat-title", title)
    val content = PendingIntent.getActivity(activity, title.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    manager.notify(title.hashCode(), NotificationCompat.Builder(activity, "task-complete").setSmallIcon(android.R.drawable.stat_notify_chat).setContentTitle(title.ifBlank { "SuperGPT" }).setContentText(body).setContentIntent(content).setAutoCancel(true).build())
  }
  fun destroy() { pending = null; worker.shutdown() }
}
