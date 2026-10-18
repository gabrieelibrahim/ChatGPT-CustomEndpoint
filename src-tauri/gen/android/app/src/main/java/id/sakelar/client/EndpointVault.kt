package id.sakelar.client

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.webkit.WebView
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import org.json.JSONObject
import java.security.KeyStore
import java.util.concurrent.Executors
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Only the allowlisted top-level app origin can access this encrypted store. */
object EndpointVault {
  private const val ALIAS = "supergpt.endpoint-keys.v1"
  private const val PREFS = "supergpt-endpoint-vault"
  private val executor = Executors.newSingleThreadExecutor()
  private fun key(): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (store.getKey(ALIAS, null) as? SecretKey)?.let { return it }
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setRandomizedEncryptionRequired(true).build())
    }.generateKey()
  }
  private fun validate(keys: JSONObject): JSONObject {
    require(keys.length() <= 50)
    val result = JSONObject()
    keys.keys().forEach { id ->
      val value = keys.get(id)
      require(id.isNotEmpty() && id.length <= 100 && value is String && value.length <= 4096)
      result.put(id, value)
    }
    return result
  }
  fun install(webView: WebView, origins: Set<String>) {
    val context = webView.context.applicationContext
    WebViewCompat.addWebMessageListener(webView, "SuperGPTEndpointVault", origins) { _, message, _, mainFrame, reply ->
      if (!mainFrame || message.type != WebMessageCompat.TYPE_STRING) return@addWebMessageListener
      val raw = message.data ?: return@addWebMessageListener
      if (raw.length > 250000) return@addWebMessageListener
      executor.execute {
        var id = ""
        val response = JSONObject()
        try {
          val request = JSONObject(raw)
          id = request.getString("id"); require(id.length <= 100)
          val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
          val keys = when (request.getString("op")) {
            "load" -> {
              val encrypted = prefs.getString("ciphertext", null)
              if (encrypted == null) JSONObject() else {
                val iv = Base64.decode(prefs.getString("iv", null) ?: error("Missing IV"), Base64.NO_WRAP)
                val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
                validate(JSONObject(String(cipher.doFinal(Base64.decode(encrypted, Base64.NO_WRAP)), Charsets.UTF_8)))
              }
            }
            "save" -> {
              val values = validate(request.getJSONObject("keys"))
              val cipher = Cipher.getInstance("AES/GCM/NoPadding")
              cipher.init(Cipher.ENCRYPT_MODE, key())
              val encrypted = cipher.doFinal(values.toString().toByteArray(Charsets.UTF_8))
              check(prefs.edit().putString("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
                .putString("ciphertext", Base64.encodeToString(encrypted, Base64.NO_WRAP)).commit())
              JSONObject()
            }
            "clear" -> { check(prefs.edit().clear().commit()); JSONObject() }
            else -> error("Unsupported operation")
          }
          response.put("ok", true).put("keys", keys)
        } catch (_: Exception) { response.put("ok", false) }
        response.put("id", id)
        webView.post { reply.postMessage(response.toString()) }
      }
    }
  }
}
