package id.sakelar.client

import android.os.Bundle
import android.content.res.Configuration
import android.graphics.Color
import android.webkit.WebView
import androidx.appcompat.app.AppCompatDelegate
import androidx.activity.enableEdgeToEdge
import androidx.activity.OnBackPressedCallback
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebMessageCompat
import org.json.JSONObject

class MainActivity : TauriActivity() {
  private var settingsBackReply: androidx.webkit.JavaScriptReplyProxy? = null
  private val settingsBack = object : OnBackPressedCallback(false) {
    override fun handleOnBackPressed() {
      try { settingsBackReply?.postMessage("back") } catch (_: Exception) {
        isEnabled = false
        onBackPressedDispatcher.onBackPressed()
      }
    }
  }
  private var taskWebView: WebView? = null
  private val speechCapture by lazy { SpeechCaptureBridge(this) }
  private var pendingComposerKeyboard = false
  private fun showComposerKeyboard() {
    val webView = taskWebView ?: return
    if (!pendingComposerKeyboard || !hasWindowFocus()) return
    webView.post {
      if (!pendingComposerKeyboard || !hasWindowFocus()) return@post
      webView.requestFocus()
      val keyboard = getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
      if (keyboard.showSoftInput(webView, android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT)) pendingComposerKeyboard = false
    }
  }
  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    speechCapture.onWindowFocusChanged(hasFocus)
    if (hasFocus) showComposerKeyboard()
  }
  private fun resumeTaskWebView() {
    if (TaskForegroundService.active()) { taskWebView?.onResume(); taskWebView?.resumeTimers() }
  }
  override fun onResume() { super.onResume(); speechCapture.onResume() }
  override fun onPause() { speechCapture.onPause(); super.onPause(); resumeTaskWebView() }
  override fun onStop() { speechCapture.onStop(); super.onStop(); resumeTaskWebView() }
  override fun onDestroy() { settingsBack.isEnabled = false; settingsBackReply = null; speechCapture.destroy(); taskWebView = null; super.onDestroy() }
  override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    speechCapture.onPermissionResult(requestCode, grantResults)
  }
  private val themePrefs by lazy { getSharedPreferences("supergpt-appearance", MODE_PRIVATE) }
  private fun mode() = themePrefs.getString("theme", "system") ?: "system"

  private fun applyTheme(preference: String) {
    AppCompatDelegate.setDefaultNightMode(when (preference) {
      "light" -> AppCompatDelegate.MODE_NIGHT_NO
      "dark" -> AppCompatDelegate.MODE_NIGHT_YES
      else -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
    })
    applySystemBars(preference)
  }

  private fun applySystemBars(preference: String) {
    val light = when (preference) {
      "light" -> true
      "dark" -> false
      else -> resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK != Configuration.UI_MODE_NIGHT_YES
    }
    WindowInsetsControllerCompat(window, window.decorView).apply {
      isAppearanceLightStatusBars = light
      isAppearanceLightNavigationBars = light
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    AppCompatDelegate.setDefaultNightMode(when (mode()) {
      "light" -> AppCompatDelegate.MODE_NIGHT_NO
      "dark" -> AppCompatDelegate.MODE_NIGHT_YES
      else -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
    })
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    onBackPressedDispatcher.addCallback(this, settingsBack)
    applySystemBars(mode())
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    applySystemBars(mode())
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    settingsBack.isEnabled = false; settingsBackReply = null
    taskWebView = webView
    webView.setBackgroundColor(if (mode() == "light" || (mode() == "system" && resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK != Configuration.UI_MODE_NIGHT_YES)) Color.WHITE else Color.BLACK)
    // CSS owns the palette. Prevent WebView from darkening explicit Light colors.
    if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) WebSettingsCompat.setAlgorithmicDarkeningAllowed(webView.settings, false)
    @Suppress("DEPRECATION")
    if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) WebSettingsCompat.setForceDark(webView.settings, WebSettingsCompat.FORCE_DARK_OFF)
    if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
      val origins = mutableSetOf("http://tauri.localhost", "https://tauri.localhost")
      if (BuildConfig.DEBUG) origins.addAll(listOf("http://127.0.0.1:1420", "http://localhost:1420", "http://10.0.2.2:1420"))
      WebViewCompat.addWebMessageListener(webView, "SuperGPTSettingsBack", origins) { _, message, _, mainFrame, reply ->
        if (!mainFrame || message.type != WebMessageCompat.TYPE_STRING) return@addWebMessageListener
        val value = message.data
        if (value != "enabled" && value != "disabled") return@addWebMessageListener
        runOnUiThread { settingsBackReply = if (value == "enabled") reply else null; settingsBack.isEnabled = value == "enabled" }
      }
      WebViewCompat.addWebMessageListener(webView, "SuperGPTComposer", origins) { _, message, _, mainFrame, _ ->
        if (!mainFrame || message.type != WebMessageCompat.TYPE_STRING) return@addWebMessageListener
        val action = message.data ?: return@addWebMessageListener
        if (action != "show" && action != "hide") return@addWebMessageListener
        pendingComposerKeyboard = action == "show"
        if (pendingComposerKeyboard) showComposerKeyboard() else webView.post {
          val keyboard = getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
          keyboard.hideSoftInputFromWindow(webView.windowToken, 0)
        }
      }
      EndpointVault.install(webView, origins)
      speechCapture.install(webView, origins)
      WebViewCompat.addWebMessageListener(webView, "SuperGPTTask", origins) { _, message, _, mainFrame, reply ->
        if (!mainFrame || message.type != WebMessageCompat.TYPE_STRING) return@addWebMessageListener
        val raw = message.data ?: return@addWebMessageListener
        if (raw.length > 1024) return@addWebMessageListener
        runOnUiThread {
          val status = JSONObject()
          try {
            val request = JSONObject(raw); val id = request.getString("id")
            require(id.isNotEmpty() && id.length <= 100)
            when (request.getString("op")) {
              "start" -> {
                TaskForegroundService.begin(this, id)
                if (android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                  val backgroundPrefs = getSharedPreferences("supergpt-background", MODE_PRIVATE)
                  if (!backgroundPrefs.getBoolean("notification-asked", false)) {
                    backgroundPrefs.edit().putBoolean("notification-asked", true).apply()
                    requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 2416)
                  }
                }
              }
              "finish" -> TaskForegroundService.finish(this, id)
              else -> error("Unsupported task operation")
            }
            status.put("ok", true)
          } catch (_: Exception) { status.put("ok", false) }
          reply.postMessage(status.toString())
        }
      }
      WebViewCompat.addWebMessageListener(webView, "SuperGPTTheme", origins) { _, message, _, mainFrame, _ ->
        if (!mainFrame || message.type != WebMessageCompat.TYPE_STRING) return@addWebMessageListener
        val value = message.data ?: return@addWebMessageListener
        if (value in listOf("system", "light", "dark")) runOnUiThread {
          if (mode() != value) themePrefs.edit().putString("theme", value).apply()
          applyTheme(value)
        }
      }
    }
  }
}
