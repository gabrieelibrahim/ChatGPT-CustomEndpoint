package id.sakelar.client

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import org.json.JSONObject
import java.util.Locale

/** One explicit user-initiated utterance. Audio is owned by the Android speech
 * service, never persisted in web storage or sent to the chat endpoint here. */
class SpeechCaptureBridge(private val activity: Activity) {
  companion object { const val PERMISSION_REQUEST = 2417 }
  private val handler = Handler(Looper.getMainLooper())
  private class Session(val id: String, val language: String, val reply: JavaScriptReplyProxy) {
    val startDeadline = SystemClock.elapsedRealtime() + 60000
    var recognizer: SpeechRecognizer? = null
    var text = ""
    var ready = false
    var stopping = false
    var timeout: Runnable? = null
  }
  private var current: Session? = null
  // Remains set after cancellation until Android returns the permission result.
  // A newer session cannot inherit a grant from a dismissed older request.
  private var permissionSession: Session? = null
  private var awaitingFocus: Session? = null
  private var resumed = false

  fun install(webView: WebView, origins: Set<String>) {
    WebViewCompat.addWebMessageListener(webView, "SuperGPTSpeech", origins) { _, message, _, mainFrame, reply ->
      if (!mainFrame || message.type != WebMessageCompat.TYPE_STRING) return@addWebMessageListener
      val raw = message.data ?: return@addWebMessageListener
      if (raw.length > 1024) return@addWebMessageListener
      activity.runOnUiThread {
        try {
          val request = JSONObject(raw)
          val id = request.getString("id")
          if (!id.matches(Regex("[A-Za-z0-9-]{1,100}"))) return@runOnUiThread
          when (request.getString("op")) {
            "start" -> start(id, request.optString("language", Locale.getDefault().toLanguageTag()), reply)
            "stop" -> current?.takeIf { it.id == id }?.let { stop(it) }
            "cancel" -> current?.takeIf { it.id == id }?.let { dispose(it) }
          }
        } catch (_: Exception) { /* Reject malformed requests, never execute input. */ }
      }
    }
  }

  private fun emit(session: Session, event: String, key: String? = null, value: Any? = null) {
    if (current !== session) return
    val payload = JSONObject().put("id", session.id).put("event", event)
    if (key != null) payload.put(key, value)
    try { session.reply.postMessage(payload.toString()) } catch (_: Exception) { dispose(session) }
  }
  private fun dispose(session: Session) {
    if (current === session) current = null // Invalidate before cancel invokes callbacks.
    if (awaitingFocus === session) awaitingFocus = null
    session.timeout?.let { handler.removeCallbacks(it) }; session.timeout = null
    val recognizer = session.recognizer; session.recognizer = null
    try { recognizer?.cancel() } catch (_: Exception) { }
    try { recognizer?.destroy() } catch (_: Exception) { }
  }
  private fun fail(session: Session, code: String) { emit(session, "error", "code", code); dispose(session) }
  private fun finish(session: Session) { emit(session, "end", "text", session.text); dispose(session) }
  private fun deadline(session: Session, delay: Long, code: String) {
    if (current !== session) return
    session.timeout?.let { handler.removeCallbacks(it) }
    session.timeout = Runnable { if (current === session) fail(session, code) }.also { handler.postDelayed(it, delay) }
  }

  private fun start(id: String, language: String, reply: JavaScriptReplyProxy) {
    if (activity.isFinishing || activity.isDestroyed) return
    if (current?.id == id) return
    current?.let { fail(it, "interrupted") }
    val session = Session(id, language.take(64), reply); current = session
    if (permissionSession != null) { fail(session, "busy"); return }
    if (!SpeechRecognizer.isRecognitionAvailable(activity)) { fail(session, "unavailable"); return }
    deadline(session, 60000, "timeout")
    if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      permissionSession = session
      try { activity.requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), PERMISSION_REQUEST) }
      catch (_: Exception) { permissionSession = null; fail(session, "not-allowed") }
      return
    }
    queueListen(session)
  }

  fun onPermissionResult(requestCode: Int, grantResults: IntArray): Boolean {
    if (requestCode != PERMISSION_REQUEST) return false
    val waiting = permissionSession; permissionSession = null
    if (waiting == null || current !== waiting) return true
    if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) queueListen(waiting)
    else fail(waiting, "not-allowed")
    return true
  }

  private fun queueListen(session: Session) {
    if (current !== session || session.stopping) return
    awaitingFocus = session
    resumePending()
  }
  private fun resumePending() {
    if (!resumed || !activity.hasWindowFocus() || activity.isFinishing || activity.isDestroyed) return
    val session = awaitingFocus ?: return
    awaitingFocus = null
    if (current !== session) return
    // A suspended WebView timer must not revive a much older microphone request.
    if (SystemClock.elapsedRealtime() >= session.startDeadline) fail(session, "timeout")
    else listen(session)
  }

  private fun listen(session: Session) {
    if (current !== session || session.stopping) return
    try {
      val recognizer = SpeechRecognizer.createSpeechRecognizer(activity)
      session.recognizer = recognizer
      recognizer.setRecognitionListener(object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {
          if (current !== session || session.stopping) return
          session.ready = true; emit(session, "started")
        }
        override fun onBeginningOfSpeech() { }
        override fun onRmsChanged(rmsdB: Float) { if (rmsdB.isFinite()) emit(session, "level", "level", ((rmsdB + 2f) / 12f).coerceIn(0f, 1f).toDouble()) }
        override fun onBufferReceived(buffer: ByteArray?) { }
        override fun onEndOfSpeech() {
          if (current !== session) return
          emit(session, "processing")
          deadline(session, 15000, "timeout")
        }
        override fun onPartialResults(partialResults: Bundle?) {
          if (current !== session) return
          partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.let {
            session.text = it; emit(session, "text", "text", it)
          }
        }
        override fun onResults(results: Bundle?) {
          if (current !== session) return
          session.text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: session.text
          finish(session)
        }
        override fun onError(error: Int) {
          if (current !== session) return
          fail(session, when (error) {
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "not-allowed"
            SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "no-speech"
            SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED, SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE -> "language-unavailable"
            else -> "recognition-failed"
          })
        }
        override fun onEvent(eventType: Int, params: Bundle?) { }
      })
      val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, session.language)
        putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
      }
      // Bound one foreground utterance; do not silently restart the microphone.
      deadline(session, 60000, "timeout")
      recognizer.startListening(intent)
    } catch (_: SecurityException) { fail(session, "not-allowed") }
    catch (_: Exception) { fail(session, "unavailable") }
  }

  private fun stop(session: Session) {
    if (session.stopping) return
    session.stopping = true
    // Stop while a permission dialog / recognizer startup is pending means no
    // recording, including when its delayed permission grant later arrives.
    if (!session.ready || session.recognizer == null) { finish(session); return }
    deadline(session, 15000, "timeout")
    try { session.recognizer?.stopListening() } catch (_: Exception) { fail(session, "recognition-failed") }
  }
  fun onStop() {
    resumed = false
    // A permission controller may cover/stop the Activity on some devices. Keep
    // its non-recording request, but only start after resume AND window focus.
    current?.let { if (it !== permissionSession && it !== awaitingFocus) fail(it, "interrupted") }
  }
  fun onResume() { resumed = true; resumePending() }
  fun onPause() { resumed = false }
  fun onWindowFocusChanged(hasFocus: Boolean) { if (hasFocus) resumePending() }
  fun destroy() { resumed = false; current?.let { dispose(it) }; permissionSession = null; awaitingFocus = null }
}
