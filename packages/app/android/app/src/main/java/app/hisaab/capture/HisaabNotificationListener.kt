package app.hisaab.capture

import android.app.Notification
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * The capture heart of hisaab (TECH-DESIGN §5.1): filters by the platform
 * allowlist and writes raw events directly and synchronously into SQLite.
 * No parsing, no JS work — capture must survive the RN runtime not being up.
 */
class HisaabNotificationListener : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val notification = sbn?.notification ?: return
        val packageName = sbn.packageName ?: return
        if (!PackageAllowlist.isCaptured(packageName, applicationContext.packageName)) return

        val extras = notification.extras ?: return
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
        val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
        val text = bigText?.takeIf { it.isNotBlank() }
            ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
        if (text.isNullOrBlank()) return

        // Our own test notification is captured to prove the round-trip works
        // but pre-marked ignored so it never pollutes the unparsed queue.
        val isOwn = packageName == applicationContext.packageName
        RawEventStore.insertNotification(
            applicationContext,
            packageName = packageName,
            title = title,
            text = text,
            postedAtMillis = sbn.postTime,
            appVersion = VersionResolver.versionName(applicationContext, packageName),
            markIgnored = isOwn,
        )
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        val prefs = prefs(this)
        val disconnectedAt = prefs.getLong(KEY_DISCONNECTED_AT, -1L)
        if (disconnectedAt > 0) {
            // Reconnect after a disconnect — data may be missing (UX E2).
            RawEventStore.insertGapMarker(this, "listener-reconnected after $disconnectedAt")
        }
        prefs.edit().remove(KEY_DISCONNECTED_AT).apply()
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        prefs(this).edit().putLong(KEY_DISCONNECTED_AT, System.currentTimeMillis()).apply()
    }

    companion object {
        private const val KEY_DISCONNECTED_AT = "listener_disconnected_at"

        private fun prefs(context: Context) =
            context.getSharedPreferences("hisaab_capture", Context.MODE_PRIVATE)
    }
}
