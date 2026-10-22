package id.sakelar.client

import android.os.Build
import android.webkit.WebView
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsAnimationCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.JavaScriptReplyProxy
import org.json.JSONObject

/**
 * Lets the chat page move its composer together with the keyboard, frame by frame.
 *
 * Without this, WebView resizes its viewport once when the keyboard appears or leaves, so the composer jumps while
 * the keyboard slides. Here WebView no longer sees the keyboard inset; instead every frame of the system keyboard
 * animation is sent to the page as `{event:"ime", height, nav}` in CSS pixels and the page sizes itself.
 * Android 11+ only: older versions keep the plain resize.
 */
object KeyboardInsets {
  fun install(webView: WebView, reply: JavaScriptReplyProxy): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return false
    val density = webView.resources.displayMetrics.density
    var animating = false
    fun send(insets: WindowInsetsCompat, phase: String) {
      val ime = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
      val nav = insets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom
      try { reply.postMessage(JSONObject().put("event", "ime").put("height", ime / density).put("nav", nav / density).put("phase", phase).toString()) } catch (_: Exception) { }
    }
    ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
      if (!animating) send(insets, "settle")
      val withoutKeyboard = WindowInsetsCompat.Builder(insets).setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE).setVisible(WindowInsetsCompat.Type.ime(), false).build()
      ViewCompat.onApplyWindowInsets(view, withoutKeyboard)
      insets
    }
    ViewCompat.setWindowInsetsAnimationCallback(webView, object : WindowInsetsAnimationCompat.Callback(WindowInsetsAnimationCompat.Callback.DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
      private fun isIme(animation: WindowInsetsAnimationCompat) = (animation.typeMask and WindowInsetsCompat.Type.ime()) != 0
      override fun onPrepare(animation: WindowInsetsAnimationCompat) { if (isIme(animation)) animating = true }
      override fun onProgress(insets: WindowInsetsCompat, running: MutableList<WindowInsetsAnimationCompat>): WindowInsetsCompat {
        if (running.any { isIme(it) }) send(insets, "progress")
        return insets
      }
      override fun onEnd(animation: WindowInsetsAnimationCompat) {
        if (!isIme(animation)) return
        animating = false
        ViewCompat.getRootWindowInsets(webView)?.let { send(it, "settle") }
      }
    })
    ViewCompat.requestApplyInsets(webView)
    return true
  }
}
