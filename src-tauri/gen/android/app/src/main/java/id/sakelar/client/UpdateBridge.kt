package id.sakelar.client

import android.app.Activity
import android.webkit.WebView
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import org.json.JSONObject

class UpdateBridge(private val activity: Activity) {
  private var publish: (() -> Unit)? = null
  fun install(webView: WebView, origins: Set<String>) {
    WebViewCompat.addWebMessageListener(webView, "SuperGPTUpdates", origins) { _, message, _, mainFrame, reply ->
      if (!mainFrame || message.type != WebMessageCompat.TYPE_STRING) return@addWebMessageListener
      val raw = message.data ?: return@addWebMessageListener
      if (raw.length > 2048) return@addWebMessageListener
      activity.runOnUiThread { try {
        val value = JSONObject(raw)
        val notify = { activity.runOnUiThread { if (!activity.isDestroyed) try { reply.postMessage(ReleaseUpdater.status(activity).toString()) } catch (_: Exception) { } } }
        when (value.optString("op")) {
          "observe" -> { publish = notify; ReleaseUpdater.observer = notify; notify() }
          "status" -> ReleaseUpdater.submit { ReleaseUpdater.reconcile(activity.applicationContext); notify() }
          "configure" -> { ReleaseUpdater.configure(activity.applicationContext, value); notify() }
          "check" -> ReleaseUpdater.submit { ReleaseUpdater.check(activity.applicationContext, true) }
          "download" -> ReleaseUpdater.submit { ReleaseUpdater.download(activity.applicationContext) }
          "install" -> ReleaseUpdater.install(activity)
        }
      } catch (_: Exception) { } }
    }
  }
  fun destroy() { if (ReleaseUpdater.observer === publish) ReleaseUpdater.observer = null; publish = null }
}
