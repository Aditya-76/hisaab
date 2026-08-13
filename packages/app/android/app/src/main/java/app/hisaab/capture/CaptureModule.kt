package app.hisaab.capture

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener

/**
 * The JS bridge — the only "API contract" in a serverless app
 * (TECH-DESIGN §5.3). Raw-event flow needs no bridge marshalling: native
 * writes SQLite, JS reads SQLite. This module only answers status/permission
 * questions. TS mirror: packages/app/src/capture/capture-module.ts.
 */
class CaptureModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "CaptureModule"

    @ReactMethod
    fun getCaptureStatus(promise: Promise) {
        val map = Arguments.createMap()
        map.putBoolean("notificationAccess", notificationAccessGranted())
        map.putBoolean("smsGranted", SmsCapture.isEnabled(reactContext))
        val last = RawEventStore.lastEventAt(reactContext)
        if (last == null) map.putNull("lastEventAt") else map.putString("lastEventAt", last)
        promise.resolve(map)
    }

    @ReactMethod
    fun openNotificationAccessSettings() {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
    }

    @ReactMethod
    fun requestSmsPermission(promise: Promise) {
        if (SmsCapture.permissionsGranted(reactContext)) {
            SmsCapture.setOptIn(reactContext, true)
            promise.resolve(true)
            return
        }
        val activity = currentActivity as? PermissionAwareActivity
        if (activity == null) {
            promise.resolve(false)
            return
        }
        val listener = PermissionListener { requestCode, _, grantResults ->
            if (requestCode != SMS_PERMISSION_REQUEST) return@PermissionListener false
            val granted = grantResults.isNotEmpty() &&
                grantResults.all { it == PackageManager.PERMISSION_GRANTED }
            // The grant IS the opt-in: it can only be asked from the opt-in
            // screen, and revoking it in system settings disables capture.
            SmsCapture.setOptIn(reactContext, granted)
            promise.resolve(granted)
            true
        }
        activity.requestPermissions(
            arrayOf(android.Manifest.permission.RECEIVE_SMS, android.Manifest.permission.READ_SMS),
            SMS_PERMISSION_REQUEST,
            listener,
        )
    }

    @ReactMethod
    fun runSmsBackfill(days: Double, promise: Promise) {
        Thread {
            try {
                val imported = SmsBackfill.run(reactContext, days.toInt())
                val map = Arguments.createMap()
                map.putInt("imported", imported)
                promise.resolve(map)
            } catch (e: Exception) {
                promise.reject("backfill_failed", e)
            }
        }.start()
    }

    @ReactMethod
    fun getOemInfo(promise: Promise) {
        val manufacturer = Build.MANUFACTURER.lowercase()
        val map = Arguments.createMap()
        map.putString("manufacturer", manufacturer)
        map.putBoolean("knownAggressive", manufacturer in AGGRESSIVE_OEMS)
        promise.resolve(map)
    }

    @ReactMethod
    fun emitTestNotification(promise: Promise) {
        try {
            val manager =
                reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(
                NotificationChannel(
                    TEST_CHANNEL_ID,
                    "Capture test",
                    NotificationManager.IMPORTANCE_DEFAULT,
                ),
            )
            val notification = Notification.Builder(reactContext, TEST_CHANNEL_ID)
                .setContentTitle("hisaab capture test")
                .setContentText("If hisaab can read this, notification capture works.")
                .setSmallIcon(android.R.drawable.stat_notify_chat)
                .build()
            manager.notify(TEST_NOTIFICATION_ID, notification)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("test_notification_failed", e)
        }
    }

    private fun notificationAccessGranted(): Boolean {
        val enabled = Settings.Secure.getString(
            reactContext.contentResolver,
            "enabled_notification_listeners",
        ) ?: return false
        return enabled.split(":").any { it.startsWith("${reactContext.packageName}/") }
    }

    companion object {
        private const val SMS_PERMISSION_REQUEST = 7601
        private const val TEST_CHANNEL_ID = "capture_test"
        private const val TEST_NOTIFICATION_ID = 7602

        /** OEMs whose battery managers are known to kill listeners (UX §3.7). */
        private val AGGRESSIVE_OEMS = setOf(
            "xiaomi", "poco", "redmi", "oppo", "realme", "vivo", "iqoo",
            "oneplus", "huawei", "honor", "tecno", "infinix", "itel", "meizu", "asus",
        )
    }
}
