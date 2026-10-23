package id.sakelar.client

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.webkit.WebView
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import org.json.JSONObject
import java.net.InetAddress
import java.net.ServerSocket
import java.security.KeyStore
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** System-browser OAuth with a temporary IPv4 loopback callback, never an embedded login page. */
class McpOAuthBridge(private val activity: Activity) {
  private val executor = Executors.newCachedThreadPool()
  private data class Login(val socket: ServerSocket, val path: String, val redirect: String, val created: Long)
  private val logins = ConcurrentHashMap<String, Login>()
  private val alias = "supergpt.mcp-oauth.v1"
  private val storageLock = Any()
  private fun key(): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (store.getKey(alias, null) as? SecretKey)?.let { return it }
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setRandomizedEncryptionRequired(true).build())
    }.generateKey()
  }
  private fun credential(request: JSONObject): String = synchronized(storageLock) {
    val id = request.getString("key"); require(id.isNotBlank() && id.length <= 100)
    val name = MessageDigest.getInstance("SHA-256").digest(id.toByteArray()).joinToString("") { "%02x".format(it) }
    val prefs = activity.getSharedPreferences("supergpt-mcp-oauth", Context.MODE_PRIVATE)
    if (request.getString("op") == "save") {
      val value = request.getString("value"); require(value.length <= 32000)
      if (value.isEmpty()) { check(prefs.edit().remove(name).commit()); return@synchronized "" }
      val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
      val encrypted = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
      val packed = Base64.encodeToString(cipher.iv + encrypted, Base64.NO_WRAP)
      check(prefs.edit().putString(name, packed).commit()); return@synchronized ""
    }
    val packed = prefs.getString(name, null) ?: return@synchronized ""
    val bytes = Base64.decode(packed, Base64.NO_WRAP); require(bytes.size > 12)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12))) }
    String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8)
  }
  fun close() { logins.values.forEach { try { it.socket.close() } catch (_: Exception) {} }; logins.clear(); executor.shutdownNow() }
  // The browser tab the provider redirected to. supergpt://sakelar brings the waiting app back (singleTask).
  private fun callbackPage(valid: Boolean): String {
    val title = if (valid) "Login berhasil" else "Login tidak cocok"
    val text = if (valid) "Kembali ke SuperGPT untuk menyelesaikan koneksi." else "Ulangi login dari SuperGPT."
    val refresh = if (valid) "<meta http-equiv=\"refresh\" content=\"0;url=supergpt://sakelar/oauth-done\">" else ""
    return "<!doctype html><html lang=\"id\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">$refresh<title>$title</title>" +
      "<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fff;color:#1f1f1f;font:16px/1.5 system-ui,sans-serif}main{max-width:320px;padding:24px;text-align:center}" +
      "h1{font-size:24px;font-weight:500;margin:0 0 8px}p{color:#5f6368;margin:0 0 28px}a{display:inline-block;padding:12px 28px;border-radius:24px;background:#0b57d0;color:#fff;text-decoration:none;font-weight:500}" +
      "@media(prefers-color-scheme:dark){body{background:#131314;color:#e3e3e3}p{color:#9aa0a6}a{background:#a8c7fa;color:#062e6f}}</style></head>" +
      "<body><main><h1>$title</h1><p>$text</p>" + (if (valid) "<a href=\"supergpt://sakelar/oauth-done\">Kembali ke SuperGPT</a>" else "") + "</main></body></html>"
  }

  fun install(webView: WebView, origins: Set<String>) {
    WebViewCompat.addWebMessageListener(webView, "SuperGPTMcpOAuth", origins) { _, message, _, mainFrame, reply ->
      if (!mainFrame || message.type != WebMessageCompat.TYPE_STRING) return@addWebMessageListener
      val raw = message.data ?: return@addWebMessageListener
      if (raw.length > 40000) return@addWebMessageListener
      executor.execute {
        var id = ""; val result = JSONObject()
        try {
          val request = JSONObject(raw); id = request.getString("id"); require(id.length <= 100)
          when (request.getString("op")) {
            "load", "save" -> result.put("value", credential(request))
            "clear" -> synchronized(storageLock) { check(activity.getSharedPreferences("supergpt-mcp-oauth", Context.MODE_PRIVATE).edit().clear().commit()) }
            "prepare" -> {
              logins.entries.removeIf { (_, login) -> if (System.currentTimeMillis() - login.created > 300000) { login.socket.close(); true } else false }
              require(logins.isEmpty())
              val socket = ServerSocket(0, 4, InetAddress.getByName("127.0.0.1")).apply { soTimeout = 300000 }
              // Google desktop clients accept loopback redirects at the root path only; state still binds the callback.
              val handle = UUID.randomUUID().toString(); val path = if (request.optBoolean("root", false)) "/" else "/oauth/" + UUID.randomUUID().toString()
              val redirect = "http://127.0.0.1:${socket.localPort}$path"
              logins[handle] = Login(socket, path, redirect, System.currentTimeMillis())
              result.put("handle", handle).put("redirectUri", redirect)
            }
            "cancel" -> { logins.remove(request.optString("handle"))?.socket?.close() }
            "authorize" -> {
              val handle = request.getString("handle"); val login = logins[handle] ?: error("Expired login")
              try {
                val url = Uri.parse(request.getString("url")); val state = request.getString("state")
                require(url.scheme == "https" && url.host != null && url.userInfo == null && url.fragment == null)
                require(state.length in 32..100 && url.getQueryParameter("state") == state && url.getQueryParameter("redirect_uri") == login.redirect)
                activity.runOnUiThread {
                  try { activity.startActivity(Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE)) }
                  catch (_: Exception) { login.socket.close() }
                }
                val deadline = login.created + 300000
                var callback: String? = null
                while (callback == null && System.currentTimeMillis() < deadline) {
                  login.socket.soTimeout = (deadline - System.currentTimeMillis()).coerceIn(1, 300000).toInt()
                  login.socket.accept().use { socket ->
                    socket.soTimeout = 3000
                    val reader = socket.getInputStream()
                    val line = StringBuilder()
                    while (line.length < 12000) { val char = reader.read(); if (char == -1 || char == 10) break; line.append(char.toChar()) }
                    val parts = line.toString().trim().split(' ')
                    val target = parts.getOrNull(1) ?: ""
                    val uri = Uri.parse("http://127.0.0.1:${login.socket.localPort}$target")
                    val valid = parts.firstOrNull() == "GET" && target.startsWith(login.path + "?") && uri.path == login.path && uri.getQueryParameters("state") == listOf(state)
                    val bytes = callbackPage(valid).toByteArray(Charsets.UTF_8)
                    socket.getOutputStream().write(("HTTP/1.1 " + (if (valid) "200 OK" else "400 Bad Request") + "\r\nContent-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'none'; style-src 'unsafe-inline'\r\nConnection: close\r\nContent-Length: ${bytes.size}\r\n\r\n").toByteArray(Charsets.UTF_8) + bytes)
                    if (valid) callback = login.redirect + target.removePrefix(login.path)
                  }
                }
                result.put("callback", callback ?: error("Login timeout"))
              } finally { logins.remove(handle); login.socket.close() }
            }
            else -> error("Unknown OAuth operation")
          }
          result.put("ok", true)
        } catch (_: Exception) { result.put("ok", false) }
        result.put("id", id)
        webView.post { try { reply.postMessage(result.toString()) } catch (_: Exception) {} }
      }
    }
  }
}
