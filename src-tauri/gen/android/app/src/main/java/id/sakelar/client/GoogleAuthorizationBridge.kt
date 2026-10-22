package id.sakelar.client

import android.accounts.Account
import android.app.Activity
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.ClearTokenRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.Scope
import org.json.JSONArray
import org.json.JSONObject
import java.net.URL
import java.util.concurrent.Executors
import javax.net.ssl.HttpsURLConnection

/** Google-owned authorization UI. No embedded login, client secret, refresh token or loopback callback. */
class GoogleAuthorizationBridge(private val activity: Activity) {
  companion object {
    private const val EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email"
    // Deliberately bounded to shared/googleWorkspace.json, plus account binding.
    private val ALLOWED_SCOPES = setOf(
      "gmail.readonly", "gmail.compose", "gmail.modify", "drive.readonly", "drive.file",
      "documents.readonly", "documents", "spreadsheets.readonly", "spreadsheets",
      "presentations.readonly", "presentations", "calendar.calendarlist.readonly",
      "calendar.events.readonly", "calendar.events.freebusy", "calendar.events",
      "chat.spaces.readonly", "chat.memberships.readonly", "chat.messages.readonly",
      "chat.messages.create", "chat.users.readstate", "contacts.readonly", "userinfo.profile",
      "userinfo.email", "classroom.courses.readonly", "classroom.rosters.readonly",
      "classroom.coursework.students.readonly", "classroom.courseworkmaterials.readonly",
      "classroom.topics.readonly", "classroom.announcements.readonly", "classroom.announcements",
      "classroom.coursework.students", "classroom.courseworkmaterials", "classroom.topics"
    ).map { "https://www.googleapis.com/auth/$it" }.toSet()
  }
  private data class Pending(
    val id: String, val scopes: Set<String>, val interactive: Boolean, val account: String?,
    val reply: JavaScriptReplyProxy, val view: WebView, val code: Int
  )
  private val handler = Handler(Looper.getMainLooper())
  private val executor = Executors.newSingleThreadExecutor()
  private val client by lazy { Identity.getAuthorizationClient(activity) }
  private val tokens = mutableSetOf<String>()
  private val resolutions = mutableMapOf<Int, Pending>()
  private var active: Pending? = null
  private var nextCode = 5200
  private var clearing = false
  private var destroyed = false
  private fun respond(view: WebView, reply: JavaScriptReplyProxy, id: String, result: JSONObject) {
    if (destroyed) return
    result.put("id", id)
    view.post { if (!destroyed) try { reply.postMessage(result.toString()) } catch (_: Exception) {} }
  }
  private fun fail(request: Pending, code: String) {
    if (active !== request) return
    active = null
    respond(request.view, request.reply, request.id, JSONObject().put("ok", false).put("error", code))
  }
  private fun invalidateToken(token: String) {
    if (token.isBlank()) return
    tokens.remove(token)
    try { client.clearToken(ClearTokenRequest.builder().setToken(token).build()) } catch (_: Exception) {}
  }
  private fun errorCode(error: Exception): String = when ((error as? ApiException)?.statusCode) {
    10 -> "google-registration-required"
    7 -> "network-error"
    16, 12501 -> "cancelled"
    17 -> "reconnect-required"
    else -> "authorization-failed"
  }
  private fun scopeGranted(scope: String, granted: Set<String>): Boolean {
    if (scope in granted) return true
    // Google canonicalizes this legacy Classroom read scope after consent.
    if (scope == "https://www.googleapis.com/auth/classroom.coursework.students.readonly" && "https://www.googleapis.com/auth/classroom.student-submissions.students.readonly" in granted) return true
    if (scope == EMAIL_SCOPE && "email" in granted) return true
    if (scope == "https://www.googleapis.com/auth/userinfo.profile" && "profile" in granted) return true
    if (scope.endsWith(".readonly") && scope.removeSuffix(".readonly") in granted) return true
    if (scope.startsWith("https://www.googleapis.com/auth/drive.") && "https://www.googleapis.com/auth/drive" in granted) return true
    if (scope.startsWith("https://www.googleapis.com/auth/calendar.") && "https://www.googleapis.com/auth/calendar" in granted) return true
    if (scope == "https://www.googleapis.com/auth/calendar.events.freebusy" && "https://www.googleapis.com/auth/calendar.events" in granted) return true
    if (scope == "https://www.googleapis.com/auth/gmail.readonly" && ("https://www.googleapis.com/auth/gmail.modify" in granted || "https://mail.google.com/" in granted)) return true
    return false
  }
  private fun accountEmail(token: String): String {
    // Fixed HTTPS endpoint only; bearer tokens never follow a redirect or leave Google.
    val connection = URL("https://www.googleapis.com/oauth2/v3/userinfo").openConnection() as HttpsURLConnection
    try {
      connection.instanceFollowRedirects = false
      connection.connectTimeout = 15000; connection.readTimeout = 15000
      connection.setRequestProperty("Authorization", "Bearer $token")
      connection.setRequestProperty("Accept", "application/json")
      connection.setRequestProperty("Cache-Control", "no-store")
      check(connection.responseCode == 200)
      val bytes = connection.inputStream.use { it.readBytesLimited(32000) }
      val profile = JSONObject(String(bytes, Charsets.UTF_8))
      val email = profile.getString("email")
      require(email.length in 3..320 && email.contains('@') && !email.any { it.isWhitespace() || it.code < 32 })
      require(profile.optBoolean("email_verified", profile.optBoolean("verified_email", false)))
      return email
    } finally { connection.disconnect() }
  }
  private fun java.io.InputStream.readBytesLimited(limit: Int): ByteArray {
    val output = java.io.ByteArrayOutputStream(); val buffer = ByteArray(4096)
    while (true) { val size = read(buffer); if (size < 0) break; require(output.size() + size <= limit); output.write(buffer, 0, size) }
    return output.toByteArray()
  }
  private fun complete(request: Pending, result: AuthorizationResult) {
    val token = result.accessToken.orEmpty()
    if (active !== request || destroyed) { invalidateToken(token); return }
    if (result.hasResolution()) {
      if (!request.interactive) { fail(request, "reconnect-required"); return }
      val intent = result.pendingIntent ?: run { fail(request, "authorization-failed"); return }
      resolutions[request.code] = request
      try {
        @Suppress("DEPRECATION")
        activity.startIntentSenderForResult(intent.intentSender, request.code, null, 0, 0, 0)
      } catch (_: Exception) { resolutions.remove(request.code); fail(request, "authorization-failed") }
      return
    }
    val granted = result.grantedScopes.toSet()
    if (token.isBlank() || token.length > 4096 || token.any { it == '\r' || it == '\n' } || !request.scopes.all { scopeGranted(it, granted) }) {
      invalidateToken(token); fail(request, "scope-not-granted"); return
    }
    executor.execute {
      try {
        val account = accountEmail(token)
        handler.post {
          if (active !== request || destroyed) { invalidateToken(token); return@post }
          if (request.account != null && !request.account.equals(account, ignoreCase = true)) { invalidateToken(token); fail(request, "account-mismatch"); return@post }
          active = null; tokens.add(token)
          // Keep only an in-memory inventory for explicit cache cleanup, never a token store.
          // Dropping an older inventory item must not invalidate an in-flight MCP request.
          while (tokens.size > 64) tokens.remove(tokens.first())
          respond(request.view, request.reply, request.id, JSONObject().put("ok", true).put("accessToken", token).put("account", account).put("grantedScopes", JSONArray(granted.sorted())))
        }
      } catch (_: Exception) { handler.post { invalidateToken(token); fail(request, "account-verification-failed") } }
    }
  }
  private fun authorize(request: Pending) {
    if (destroyed) return
    if (active != null || clearing) { respond(request.view, request.reply, request.id, JSONObject().put("ok", false).put("error", "busy")); return }
    if (!request.interactive && request.account == null) { respond(request.view, request.reply, request.id, JSONObject().put("ok", false).put("error", "reconnect-required")); return }
    active = request
    handler.postDelayed({ if (active === request) fail(request, "authorization-timeout") }, 300000)
    try {
      val builder = AuthorizationRequest.builder().setRequestedScopes(request.scopes.sorted().map { Scope(it) }).setOptOutIncludingGrantedScopes(true)
      if (request.account != null) builder.setAccount(Account(request.account, "com.google"))
      else if (request.interactive) builder.setPrompt(AuthorizationRequest.Prompt.SELECT_ACCOUNT)
      // Only the Google PendingIntent may show consent, and only for interactive requests.
      client.authorize(builder.build()).addOnSuccessListener { result -> complete(request, result) }
        .addOnFailureListener { error -> fail(request, errorCode(error)) }
    } catch (error: Exception) { fail(request, errorCode(error)) }
  }
  private fun clear(view: WebView, reply: JavaScriptReplyProxy, id: String) {
    active?.let { fail(it, "cancelled") }
    // Retain cancelled resolution identities so a late Activity result can be discarded safely.
    val previousTokens = tokens.toList(); tokens.clear()
    if (previousTokens.isEmpty()) { respond(view, reply, id, JSONObject().put("ok", true)); return }
    clearing = true
    var remaining = previousTokens.size; var failed = false
    fun finished() { remaining--; if (remaining == 0) { clearing = false; respond(view, reply, id, JSONObject().put("ok", !failed).apply { if (failed) put("error", "cache-clear-failed") }) } }
    for (token in previousTokens) {
      try { client.clearToken(ClearTokenRequest.builder().setToken(token).build()).addOnCompleteListener { task -> if (!task.isSuccessful) failed = true; finished() } }
      catch (_: Exception) { failed = true; finished() }
    }
  }
  fun result(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
    if (requestCode !in 5200 until nextCode) return false
    val request = resolutions.remove(requestCode) ?: return true
    if (resultCode != Activity.RESULT_OK || data == null) { fail(request, "cancelled"); return true }
    try { complete(request, client.getAuthorizationResultFromIntent(data)) }
    catch (error: Exception) { fail(request, errorCode(error)) }
    return true
  }
  fun destroy() {
    active = null; destroyed = true; tokens.clear(); resolutions.clear()
    handler.removeCallbacksAndMessages(null); executor.shutdownNow()
  }
  fun install(webView: WebView, origins: Set<String>) {
    WebViewCompat.addWebMessageListener(webView, "SuperGPTGoogleAuth", origins) { _, message, _, mainFrame, reply ->
      if (!mainFrame || message.type != WebMessageCompat.TYPE_STRING) return@addWebMessageListener
      val raw = message.data ?: return@addWebMessageListener
      if (raw.length > 16000) return@addWebMessageListener
      var id = ""
      try {
        val input = JSONObject(raw); id = input.getString("id"); require(id.isNotBlank() && id.length <= 100)
        val op = input.getString("op")
        when (op) {
          "authorize" -> {
            val values = input.getJSONArray("scopes"); require(values.length() in 1..40)
            val scopes = (0 until values.length()).map { values.getString(it) }.toSet()
            require(scopes.contains(EMAIL_SCOPE) && scopes.all { ALLOWED_SCOPES.contains(it) })
            val interactive = input.getBoolean("interactive")
            val account = if (input.has("account") && !input.isNull("account")) input.getString("account") else null
            require(account == null || account.length in 3..320 && account.contains('@') && !account.any { it.isWhitespace() || it.code < 32 })
            activity.runOnUiThread {
              if (nextCode >= 62000) { respond(webView, reply, id, JSONObject().put("ok", false).put("error", "restart-required")); return@runOnUiThread }
              authorize(Pending(id, scopes, interactive, account, reply, webView, nextCode++))
            }
          }
          "cancel" -> {
            val requestId = input.getString("requestId"); require(requestId.length <= 100)
            activity.runOnUiThread { active?.takeIf { it.id == requestId }?.let { fail(it, "cancelled") }; respond(webView, reply, id, JSONObject().put("ok", true)) }
          }
          "clear" -> activity.runOnUiThread { clear(webView, reply, id) }
          else -> error("Invalid operation")
        }
      } catch (_: Exception) { respond(webView, reply, id, JSONObject().put("ok", false).put("error", "invalid-request")) }
    }
  }
}
