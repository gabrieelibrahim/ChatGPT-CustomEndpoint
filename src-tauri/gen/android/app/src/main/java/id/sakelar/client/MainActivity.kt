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
import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon

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
  private val audioCapture by lazy { AudioCaptureBridge(this) }
  private val fileOpen by lazy { FileOpenBridge(this) }
  private val deviceActions by lazy { DeviceActionsBridge(this) }
  private val launch by lazy { LaunchBridge(this) }
  private var homeReply: androidx.webkit.JavaScriptReplyProxy? = null
  private fun openShortcut() {
    val title = intent?.getStringExtra("supergpt-chat-title") ?: return
    val reply = homeReply ?: return
    try { reply.postMessage(JSONObject().put("event", "open").put("title", title).toString()); intent.removeExtra("supergpt-chat-title") } catch (_: Exception) { }
  }
  override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); openShortcut() }
  @Deprecated("Android activity result compatibility")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    if (!deviceActions.result(requestCode, resultCode, data)) super.onActivityResult(requestCode, resultCode, data)
  }
  private var pendingComposerKeyboard = false
  private var keyboardObserver: android.view.ViewTreeObserver.OnGlobalLayoutListener? = null
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
    audioCapture.onWindowFocusChanged(hasFocus)
    if (hasFocus) showComposerKeyboard()
  }
  private fun resumeTaskWebView() {
    if (TaskForegroundService.active()) { taskWebView?.onResume(); taskWebView?.resumeTimers() }
  }
  override fun onResume() { super.onResume(); speechCapture.onResume(); audioCapture.onResume() }
  override fun onPause() { speechCapture.onPause(); audioCapture.onPause(); super.onPause(); resumeTaskWebView() }
  override fun onStop() { speechCapture.onStop(); audioCapture.onStop(); super.onStop(); resumeTaskWebView() }
  override fun onDestroy() { settingsBack.isEnabled = false; settingsBackReply = null; homeReply = null; launch.destroy(); speechCapture.destroy(); audioCapture.destroy(); fileOpen.destroy(); deviceActions.destroy(); keyboardObserver?.let { taskWebView?.viewTreeObserver?.removeOnGlobalLayoutListener(it) }; keyboardObserver = null; taskWebView = null; super.onDestroy() }
  override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    speechCapture.onPermissionResult(requestCode, grantResults)
    audioCapture.onPermissionResult(requestCode, grantResults)
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
    launch.install(mode() == "light" || (mode() == "system" && resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK != Configuration.UI_MODE_NIGHT_YES))
    onBackPressedDispatcher.addCallback(this, settingsBack)
    applySystemBars(mode())
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    applySystemBars(mode())
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    settingsBack.isEnabled = false; settingsBackReply = null; homeReply = null
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
      WebViewCompat.addWebMessageListener(webView, "SuperGPTComposer", origins) { _, message, _, mainFrame, reply ->
        if (!mainFrame || message.type != WebMessageCompat.TYPE_STRING) return@addWebMessageListener
        val action = message.data ?: return@addWebMessageListener
        if (action == "observe") {
          runOnUiThread {
            keyboardObserver?.let { webView.viewTreeObserver.removeOnGlobalLayoutListener(it) }
            var previous: Boolean? = null
            val listener = android.view.ViewTreeObserver.OnGlobalLayoutListener {
              val insets = androidx.core.view.ViewCompat.getRootWindowInsets(webView)
              if (insets != null) {
                val open = insets.isVisible(androidx.core.view.WindowInsetsCompat.Type.ime())
                if (open != previous) { previous = open; try { reply.postMessage(JSONObject().put("event", "keyboard").put("open", open).toString()) } catch (_: Exception) { } }
              }
            }
            keyboardObserver = listener; webView.viewTreeObserver.addOnGlobalLayoutListener(listener)
          }
          return@addWebMessageListener
        }
        if (action != "show" && action != "hide") return@addWebMessageListener
        pendingComposerKeyboard = action == "show"
        if (pendingComposerKeyboard) showComposerKeyboard() else webView.post {
          val keyboard = getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
          keyboard.hideSoftInputFromWindow(webView.windowToken, 0)
        }
      }
      EndpointVault.install(webView, origins)
      launch.bind(webView, origins)
      speechCapture.install(webView, origins)
      audioCapture.install(webView, origins)
      fileOpen.install(webView, origins)
      deviceActions.install(webView, origins)
      WebViewCompat.addWebMessageListener(webView, "SuperGPTShare", origins) { _, message, _, mainFrame, _ ->
        if (!mainFrame || message.type != WebMessageCompat.TYPE_STRING) return@addWebMessageListener
        val text = message.data ?: return@addWebMessageListener
        if (text.isBlank() || text.length > 200000) return@addWebMessageListener
        runOnUiThread {
          try { startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "Bagikan")) }
          catch (_: Exception) { android.widget.Toast.makeText(this, "Berbagi tidak tersedia.", android.widget.Toast.LENGTH_SHORT).show() }
        }
      }
      WebViewCompat.addWebMessageListener(webView, "SuperGPTHome", origins) { _, message, _, mainFrame, reply ->
        if (!mainFrame || message.type != WebMessageCompat.TYPE_STRING) return@addWebMessageListener
        val raw = message.data ?: return@addWebMessageListener
        if (raw.length > 2048) return@addWebMessageListener
        runOnUiThread {
          try {
            val request = JSONObject(raw)
            if (request.optString("op") == "ready") { homeReply = reply; openShortcut() }
            else if (request.optString("op") == "pin") {
              val title = request.getString("title"); require(title.isNotBlank() && title.length <= 200)
              var accepted = false
              if (android.os.Build.VERSION.SDK_INT >= 26) {
                val manager = getSystemService(ShortcutManager::class.java)
                if (manager?.isRequestPinShortcutSupported == true) {
                  val shortcutIntent = Intent(this, MainActivity::class.java).setAction(Intent.ACTION_VIEW).putExtra("supergpt-chat-title", title)
                  val id = java.security.MessageDigest.getInstance("SHA-256").digest(title.toByteArray()).joinToString("") { "%02x".format(it) }
                  val shortcut = ShortcutInfo.Builder(this, "chat-" + id).setShortLabel(title.take(40)).setLongLabel(title).setIcon(Icon.createWithResource(this, applicationInfo.icon)).setIntent(shortcutIntent).build()
                  accepted = manager.requestPinShortcut(shortcut, null)
                }
              }
              reply.postMessage(JSONObject().put("event", "pin").put("ok", accepted).toString())
            }
          } catch (_: Exception) { try { reply.postMessage(JSONObject().put("event", "pin").put("ok", false).toString()) } catch (_: Exception) { } }
        }
      }
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
