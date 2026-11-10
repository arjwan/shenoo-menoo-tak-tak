package com.shnomano.call

import android.app.Activity
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.SystemClock
import android.util.Base64
import androidx.core.app.NotificationCompat
import java.io.ByteArrayOutputStream

/** Captures after Android's per-session consent; never records or stores frames. */
class ScreenShareService : Service() {
    private var projection: MediaProjection? = null
    private var display: VirtualDisplay? = null
    private var reader: ImageReader? = null
    private val worker = HandlerThread("ShnoScreenFrames")
    private lateinit var frames: Handler
    private var lastFrame = 0L
    private var stopping = false
    private var width = 0
    private var height = 0

    override fun onCreate() { super.onCreate(); worker.start(); frames = Handler(worker.looper) }
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) { stopSelf(); return START_NOT_STICKY }
        if (projection != null) return START_NOT_STICKY
        @Suppress("DEPRECATION")
        val consent = intent?.getParcelableExtra<Intent>(EXTRA_CONSENT)
        if (consent == null || intent.getIntExtra(EXTRA_RESULT, Activity.RESULT_CANCELED) != Activity.RESULT_OK) {
            stopSelf(); return START_NOT_STICKY
        }
        val stop = PendingIntent.getService(this, NOTICE,
            Intent(this, ScreenShareService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(this, ShnoManoApp.CHANNEL_REALTIME)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle("مشاركة الشاشة تعمل")
            .setContentText("يتم بث الشاشة إلى المشاركين في المكالمة")
            .setOngoing(true).setOnlyAlertOnce(true)
            .addAction(R.drawable.ic_launcher, "إيقاف المشاركة", stop).build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) startForeground(NOTICE, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
        else startForeground(NOTICE, notification)
        try {
            projection = getSystemService(MediaProjectionManager::class.java).getMediaProjection(Activity.RESULT_OK, consent)
            projection?.registerCallback(object : MediaProjection.Callback() {
                override fun onStop() { stopSelf() }
                override fun onCapturedContentResize(newWidth: Int, newHeight: Int) {
                    if (Build.VERSION.SDK_INT >= 34 && display != null && newWidth > 0 && newHeight > 0) resize(newWidth, newHeight)
                }
            }, frames)
            val metrics = resources.displayMetrics
            resize(metrics.widthPixels, metrics.heightPixels)
            display = projection?.createVirtualDisplay("ShnoScreenShare", width, height, metrics.densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, reader?.surface, null, frames)
        } catch (_: Exception) {
            WebCallActivity.screenShareStopped("تعذر بدء مشاركة الشاشة؛ حاول منح موافقة جديدة")
            stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun resize(sourceWidth: Int, sourceHeight: Int) {
        val scale = minOf(1.0, 720.0 / sourceWidth, 1280.0 / sourceHeight)
        val nextWidth = maxOf(2, (sourceWidth * scale).toInt() / 2 * 2)
        val nextHeight = maxOf(2, (sourceHeight * scale).toInt() / 2 * 2)
        if (nextWidth == width && nextHeight == height) return
        width = nextWidth; height = nextHeight
        val old = reader
        reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2).also { source ->
            source.setOnImageAvailableListener({ images ->
                val frame = runCatching { images.acquireLatestImage() }.getOrNull() ?: return@setOnImageAvailableListener
                try {
                    if (stopping || SystemClock.elapsedRealtime() - lastFrame < 125) return@setOnImageAvailableListener
                    lastFrame = SystemClock.elapsedRealtime()
                    val plane = frame.planes[0]
                    val paddedWidth = frame.width + (plane.rowStride - plane.pixelStride * frame.width) / plane.pixelStride
                    val padded = Bitmap.createBitmap(paddedWidth, frame.height, Bitmap.Config.ARGB_8888)
                    padded.copyPixelsFromBuffer(plane.buffer)
                    val cropped = Bitmap.createBitmap(padded, 0, 0, frame.width, frame.height)
                    val bytes = ByteArrayOutputStream()
                    cropped.compress(Bitmap.CompressFormat.JPEG, 65, bytes)
                    WebCallActivity.screenShareFrame(Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP), frame.width, frame.height)
                    if (cropped !== padded) cropped.recycle()
                    padded.recycle()
                } catch (_: Exception) {
                    WebCallActivity.screenShareStopped("تعذر التقاط الشاشة")
                    stopSelf()
                } finally { frame.close() }
            }, frames)
        }
        display?.resize(width, height, resources.displayMetrics.densityDpi)
        display?.surface = reader?.surface
        old?.close()
    }

    override fun onDestroy() {
        stopping = true
        display?.release(); display = null
        reader?.close(); reader = null
        projection?.stop(); projection = null
        worker.quitSafely()
        WebCallActivity.screenShareStopped("")
        super.onDestroy()
    }

    companion object {
        const val EXTRA_CONSENT = "screen_consent"
        const val EXTRA_RESULT = "screen_result"
        private const val ACTION_STOP = "com.shnomano.call.STOP_SCREEN_SHARE"
        private const val NOTICE = 4104
    }
}
