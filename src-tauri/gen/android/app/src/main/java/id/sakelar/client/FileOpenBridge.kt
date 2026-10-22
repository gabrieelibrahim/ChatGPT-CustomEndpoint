package id.sakelar.client

import android.app.Activity
import android.content.Intent
import android.webkit.WebView
import androidx.core.content.FileProvider
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import org.json.JSONObject
import java.io.File

/** Opens only bytes explicitly selected from the app's local attachment library. */
class FileOpenBridge(private val activity: Activity) {
  private val worker = java.util.concurrent.Executors.newSingleThreadExecutor()
  fun install(webView: WebView, origins: Set<String>) {
    WebViewCompat.addWebMessageListener(webView, "SuperGPTFile", origins) { _, message, _, mainFrame, _ ->
      if (!mainFrame || message.type != WebMessageCompat.TYPE_STRING) return@addWebMessageListener
      val raw = message.data ?: return@addWebMessageListener
      worker.execute {
        try {
          val request = JSONObject(raw)
          val name = request.getString("name").replace(Regex("[^\\p{L}\\p{N}._ -]"), "_").take(160).ifBlank { "attachment" }
          val type = request.optString("type").takeIf { it.matches(Regex("[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+")) } ?: "application/octet-stream"
          val encoded = request.getString("data")
          val bytes = android.util.Base64.decode(encoded, android.util.Base64.DEFAULT)
          val directory = File(activity.cacheDir, "attachment-previews").apply { mkdirs() }
          // Keep external readers usable for one day; clear only our own stale copies.
          directory.listFiles()?.filter { System.currentTimeMillis() - it.lastModified() > 86400000 }?.forEach { it.deleteRecursively() }
          val subdirectory = File(directory, java.util.UUID.randomUUID().toString()).apply { mkdirs() }
          val file = File(subdirectory, name); file.writeBytes(bytes)
          val uri = FileProvider.getUriForFile(activity, activity.packageName + ".fileprovider", file)
          activity.runOnUiThread {
            if (activity.isFinishing || activity.isDestroyed) return@runOnUiThread
            try {
              val target = if (request.optString("op") == "share") Intent(Intent.ACTION_SEND).setType(type).putExtra(Intent.EXTRA_STREAM, uri) else Intent(Intent.ACTION_VIEW).setDataAndType(uri, type)
              target.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
              activity.startActivity(Intent.createChooser(target, if (request.optString("op") == "share") "Bagikan log" else "Buka file"))
            }
            catch (_: Exception) { notice("Tidak ada aplikasi yang dapat membuka file ini.") }
          }
        } catch (_: Exception) { activity.runOnUiThread { notice("File belum dapat dibuka.") } }
      }
    }
  }
  private fun notice(message: String) { android.widget.Toast.makeText(activity, message, android.widget.Toast.LENGTH_SHORT).show() }
  fun destroy() { worker.shutdown() }
}
