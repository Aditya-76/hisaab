package app.hisaab.capture

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager

/**
 * SMS capture is strictly opt-in (TECH-DESIGN §5.2): every SMS code path
 * checks BOTH the worker's explicit opt-in AND the runtime grants. The
 * notificationOnly build flavor never has the permissions in its manifest,
 * so these checks fail closed there.
 */
object SmsCapture {

    private const val PREFS = "hisaab_capture"
    private const val KEY_OPT_IN = "sms_opt_in"

    fun permissionsGranted(context: Context): Boolean =
        context.checkSelfPermission(Manifest.permission.RECEIVE_SMS) ==
            PackageManager.PERMISSION_GRANTED &&
            context.checkSelfPermission(Manifest.permission.READ_SMS) ==
            PackageManager.PERMISSION_GRANTED

    fun isEnabled(context: Context): Boolean = optedIn(context) && permissionsGranted(context)

    fun optedIn(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_OPT_IN, false)

    fun setOptIn(context: Context, value: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_OPT_IN, value).apply()
    }
}
