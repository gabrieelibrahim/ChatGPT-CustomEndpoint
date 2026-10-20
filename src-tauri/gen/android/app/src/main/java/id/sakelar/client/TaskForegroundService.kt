package id.sakelar.client

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import java.util.Collections

/** Bounded assistance for an already user-started request, never a restart worker. */
class TaskForegroundService : Service() {
  companion object {
    private const val CHANNEL = "supergpt-active-requests"
    private const val NOTICE = 2416
    private const val MAX_MS = 3630000L
    private val tasks = Collections.synchronizedSet(mutableSetOf<String>())
    fun active() = tasks.isNotEmpty()
    fun begin(context: Context, id: String) {
      require(id.isNotEmpty() && id.length <= 100)
      if (!tasks.add(id)) return
      try {
        val intent = Intent(context, TaskForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
      } catch (error: Exception) { tasks.remove(id); throw error }
    }
    fun finish(context: Context, id: String) {
      tasks.remove(id)
      if (tasks.isEmpty()) context.stopService(Intent(context, TaskForegroundService::class.java))
    }
  }
  private val handler = Handler(Looper.getMainLooper())
  private var wakeLock: PowerManager.WakeLock? = null
  private val timeout = Runnable { tasks.clear(); stopSelf() }
  override fun onCreate() {
    super.onCreate()
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel(CHANNEL, "Permintaan aktif", NotificationManager.IMPORTANCE_LOW))
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    if (launch != null) builder.setContentIntent(PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    val notice = builder.setSmallIcon(android.R.drawable.stat_notify_sync).setContentTitle("SuperGPT sedang merespons")
      .setContentText("Permintaanmu tetap berjalan saat aplikasi diminimalkan.").setOngoing(true).setOnlyAlertOnce(true).build()
    if (Build.VERSION.SDK_INT >= 29) startForeground(NOTICE, notice, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC) else startForeground(NOTICE, notice)
    wakeLock = (getSystemService(Context.POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SuperGPT:active-request").apply {
      setReferenceCounted(false); acquire(MAX_MS)
    }
    handler.postDelayed(timeout, MAX_MS)
  }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!active()) stopSelf()
    return START_NOT_STICKY
  }
  override fun onTimeout(startId: Int, fgsType: Int) { tasks.clear(); stopSelf() }
  override fun onBind(intent: Intent?): IBinder? = null
  override fun onDestroy() {
    handler.removeCallbacks(timeout)
    if (wakeLock?.isHeld == true) wakeLock?.release()
    // A new user request may already have registered while the previous empty
    // service is stopping. Do not erase that newer request's registration.
    wakeLock = null
    stopForeground(STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }
}
