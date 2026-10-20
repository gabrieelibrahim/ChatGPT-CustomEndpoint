package id.sakelar.client

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import org.json.JSONObject
import java.io.File

/** Bounded, foreground-only recording for the user's configured transcription API.
 * No credentials enter this bridge; files are deleted on stop, error or cancel. */
class AudioCaptureBridge(private val activity: Activity) {
  companion object { const val PERMISSION_REQUEST = 2418 }
  private class Session(val id: String, val reply: JavaScriptReplyProxy, val continuous: Boolean) {
    var recorder: MediaRecorder? = null
    var file: File? = null
    var started = false
    var timeout: Runnable? = null
    var meter: Runnable? = null
  }
  private val handler = Handler(Looper.getMainLooper())
  private var current: Session? = null
  private var permission: Session? = null
  private var pending: Session? = null
  private var resumed = false

  fun install(webView: WebView, origins: Set<String>) {
    WebViewCompat.addWebMessageListener(webView, "SuperGPTAudio", origins) { _, message, _, mainFrame, reply ->
      if (!mainFrame || message.type != WebMessageCompat.TYPE_STRING) return@addWebMessageListener
      val raw = message.data ?: return@addWebMessageListener
      if (raw.length > 1024) return@addWebMessageListener
      activity.runOnUiThread {
        try {
          val request = JSONObject(raw); val id = request.getString("id")
          if (!id.matches(Regex("[A-Za-z0-9-]{1,100}"))) return@runOnUiThread
          when (request.getString("op")) {
            "start" -> start(id, reply, request.optBoolean("continuous", true))
            "stop" -> current?.takeIf { it.id == id }?.let { stop(it) }
            "cancel" -> current?.takeIf { it.id == id }?.let { dispose(it) }
          }
        } catch (_: Exception) { /* Reject malformed bridge input. */ }
      }
    }
  }
  private fun emit(session: Session, event: String, key: String? = null, value: Any? = null) {
    if (current !== session) return
    val result = JSONObject().put("id", session.id).put("event", event)
    if (key != null) result.put(key, value)
    try { session.reply.postMessage(result.toString()) } catch (_: Exception) { dispose(session) }
  }
  private fun dispose(session: Session) {
    if (current === session) current = null
    if (pending === session) pending = null
    session.timeout?.let { handler.removeCallbacks(it) }; session.meter?.let { handler.removeCallbacks(it) }
    try { session.recorder?.reset() } catch (_: Exception) { }
    try { session.recorder?.release() } catch (_: Exception) { }
    session.recorder = null
    session.file?.delete(); session.file = null
  }
  private fun fail(session: Session, code: String) { emit(session, "error", "code", code); dispose(session) }
  private fun start(id: String, reply: JavaScriptReplyProxy, continuous: Boolean) {
    if (activity.isFinishing || activity.isDestroyed) return
    current?.let { fail(it, "interrupted") }
    val session = Session(id, reply, continuous); current = session
    if (permission != null) { fail(session, "busy"); return }
    session.timeout = Runnable { if (current === session) fail(session, "timeout") }.also { handler.postDelayed(it, 60000) }
    if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      permission = session
      try { activity.requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), PERMISSION_REQUEST) }
      catch (_: Exception) { permission = null; fail(session, "not-allowed") }
    } else { pending = session; resumePending() }
  }
  fun onPermissionResult(requestCode: Int, grantResults: IntArray): Boolean {
    if (requestCode != PERMISSION_REQUEST) return false
    val session = permission; permission = null
    if (session == null || current !== session) return true
    if (grantResults.firstOrNull() != PackageManager.PERMISSION_GRANTED) fail(session, "not-allowed")
    else { pending = session; resumePending() }
    return true
  }
  @Suppress("DEPRECATION")
  private fun resumePending() {
    if (!resumed || !activity.hasWindowFocus() || activity.isFinishing || activity.isDestroyed) return
    val session = pending ?: return; pending = null
    if (current !== session) return
    try {
      session.timeout?.let { handler.removeCallbacks(it) }
      val file = File.createTempFile("dictation-", ".m4a", activity.cacheDir); session.file = file
      val recorder = MediaRecorder(); session.recorder = recorder
      recorder.setAudioSource(MediaRecorder.AudioSource.MIC)
      recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
      recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
      recorder.setAudioChannels(1); recorder.setAudioSamplingRate(16000); recorder.setAudioEncodingBitRate(64000)
      recorder.setOutputFile(file.absolutePath); recorder.setMaxDuration(63000); recorder.setMaxFileSize(5L * 1024 * 1024)
      recorder.setOnErrorListener { _, _, _ -> if (current === session) fail(session, "audio-capture-failed") }
      recorder.setOnInfoListener { _, what, _ -> if (current === session && (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED || what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_FILESIZE_REACHED)) stop(session) }
      recorder.prepare(); recorder.start(); session.started = true
      emit(session, "started")
      val meter = object : Runnable {
        var speechAt = 0L
        override fun run() {
          if (current !== session || !session.started) return
          try {
            val amplitude = recorder.maxAmplitude
            emit(session, "level", "level", (amplitude / 12000.0).coerceIn(0.0, 1.0))
            val now = android.os.SystemClock.elapsedRealtime()
            if (amplitude > 1800) speechAt = now
            if (!session.continuous && speechAt > 0 && now - speechAt > 1600) { stop(session); return }
          } catch (_: Exception) { }
          if (current === session) handler.postDelayed(this, 90)
        }
      }
      session.meter = meter; handler.post(meter)
      session.timeout = Runnable { if (current === session) stop(session) }.also { handler.postDelayed(it, 60000) }
    } catch (_: SecurityException) { fail(session, "not-allowed") }
    catch (_: Exception) { fail(session, "audio-capture-failed") }
  }
  private fun stop(session: Session) {
    if (!session.started) { fail(session, "no-speech"); return }
    session.started = false
    try {
      session.recorder?.stop()
      val file = session.file ?: error("Missing audio")
      if (file.length() < 128 || file.length() > 5L * 1024 * 1024) { fail(session, "no-speech"); return }
      emit(session, "audio", "data", Base64.encodeToString(file.readBytes(), Base64.NO_WRAP))
      dispose(session)
    } catch (_: Exception) { fail(session, "audio-capture-failed") }
  }
  fun onResume() { resumed = true; resumePending() }
  fun onPause() { resumed = false }
  fun onWindowFocusChanged(hasFocus: Boolean) { if (hasFocus) resumePending() }
  fun onStop() { resumed = false; current?.let { if (it !== permission && it !== pending) fail(it, "interrupted") } }
  fun destroy() { resumed = false; current?.let { dispose(it) }; permission = null; pending = null }
}
