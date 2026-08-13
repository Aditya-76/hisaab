package app.hisaab.capture

import android.content.Context
import android.content.pm.PackageManager

/**
 * Resolves a platform app's versionName for RawInput.appVersion, cached per
 * package per day (TECH-DESIGN §5.1) — parsers use it to pick format variants.
 */
object VersionResolver {

    private data class Cached(val dayStamp: Long, val versionName: String?)

    private val cache = HashMap<String, Cached>()

    @Synchronized
    fun versionName(context: Context, packageName: String): String? {
        val today = System.currentTimeMillis() / 86_400_000L
        cache[packageName]?.let { if (it.dayStamp == today) return it.versionName }
        val resolved = try {
            context.packageManager.getPackageInfo(packageName, 0).versionName
        } catch (_: PackageManager.NameNotFoundException) {
            null
        }
        cache[packageName] = Cached(today, resolved)
        return resolved
    }
}
