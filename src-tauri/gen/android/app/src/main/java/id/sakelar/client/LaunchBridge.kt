package id.sakelar.client

import android.app.Activity
import android.graphics.Color
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.ImageView
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat

/** One launch surface: hand off the system splash only after React has painted. */
class LaunchBridge(private val activity: Activity) {
  private var ready = false
  private var remove: (() -> Unit)? = null
  private val handler = Handler(Looper.getMainLooper())
  private val fallback = Runnable { finish() }
  fun install(light: Boolean) {
    if (Build.VERSION.SDK_INT >= 31) installSystem()
    else if (!ready) {
      val root = activity.window.decorView as android.view.ViewGroup
      val overlay = FrameLayout(activity).apply { setBackgroundColor(if (light) Color.WHITE else Color.BLACK); isClickable = true }
      val logo = ImageView(activity)
      val resource = activity.resources.getIdentifier("supergpt_launch_mark", "drawable", activity.packageName)
      logo.setImageResource(if (resource != 0) resource else activity.applicationInfo.icon)
      logo.setColorFilter(if (light) Color.BLACK else Color.WHITE)
      val size = (68 * activity.resources.displayMetrics.density).toInt()
      overlay.addView(logo, FrameLayout.LayoutParams(size, size, android.view.Gravity.CENTER))
      root.addView(overlay, android.view.ViewGroup.LayoutParams(-1, -1))
      remove = { overlay.animate().alpha(0f).setDuration(120).withEndAction { root.removeView(overlay) }.start() }
    }
    handler.postDelayed(fallback, 15000)
  }
  @android.annotation.TargetApi(31)
  private fun installSystem() {
    activity.splashScreen.setOnExitAnimationListener { screen ->
      remove = { screen.animate().alpha(0f).setDuration(120).withEndAction { screen.remove() }.start() }
      if (ready) dismiss()
    }
  }
  fun bind(webView: WebView, origins: Set<String>) {
    WebViewCompat.addWebMessageListener(webView, "SuperGPTLaunch", origins) { _, message, _, mainFrame, _ ->
      if (mainFrame && message.type == WebMessageCompat.TYPE_STRING && message.data == "ready") activity.runOnUiThread { finish() }
    }
  }
  private fun dismiss() { val action = remove; remove = null; action?.invoke() }
  private fun finish() { ready = true; handler.removeCallbacks(fallback); dismiss() }
  fun destroy() { handler.removeCallbacks(fallback); dismiss() }
}
