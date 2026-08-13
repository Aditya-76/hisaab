package app.hisaab.capture

/**
 * Notification packages captured into raw_events (TECH-DESIGN §5.1).
 * Must stay a SUPERSET of the packageNames in packages/parsers/src registry —
 * capturing slightly wide is by design: unrecognized events land in the
 * unparsed queue and are rescued later by the re-parse pipeline; events never
 * captured are gone forever.
 */
object PackageAllowlist {

    private val WAVE1 = setOf(
        "in.swiggy.deliveryapp", // Swiggy + Instamart rider app
        "com.zomato.delivery", // Zomato rider app
        "com.grofers.delivery", // Blinkit rider app
        "com.zepto.rider", // Zepto rider app
    )

    /** Own package included for the "Test it" round-trip (TECH-DESIGN §5.4). */
    fun isCaptured(packageName: String, ownPackage: String): Boolean =
        packageName in WAVE1 || packageName == ownPackage
}
