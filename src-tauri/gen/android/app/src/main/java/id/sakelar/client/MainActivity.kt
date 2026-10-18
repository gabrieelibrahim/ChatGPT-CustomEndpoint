package id.sakelar.client

import android.os.Bundle
import android.content.res.Configuration
import android.graphics.Color
import android.webkit.WebView
import androidx.appcompat.app.AppCompatDelegate
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebMessageCompat

class MainActivity : TauriActivity() {
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
    applySystemBars(mode())
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    applySystemBars(mode())
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webView.setBackgroundColor(if (mode() == "light" || (mode() == "system" && resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK != Configuration.UI_MODE_NIGHT_YES)) Color.WHITE else Color.BLACK)
    // CSS owns the palette. Prevent WebView from darkening explicit Light colors.
    if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) WebSettingsCompat.setAlgorithmicDarkeningAllowed(webView.settings, false)
    @Suppress("DEPRECATION")
    if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) WebSettingsCompat.setForceDark(webView.settings, WebSettingsCompat.FORCE_DARK_OFF)
    if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
      val origins = mutableSetOf("http://tauri.localhost", "https://tauri.localhost")
      if (BuildConfig.DEBUG) origins.addAll(listOf("http://127.0.0.1:1420", "http://localhost:1420", "http://10.0.2.2:1420"))
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
