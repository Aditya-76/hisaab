package app.hisaab.capture

/**
 * SMS sender (DLT header) allowlist — the FIRST gate (TECH-DESIGN §5.2):
 * non-matching SMS are never read into hisaab's tables at all. Must stay a
 * SUPERSET of the senderPatterns in packages/parsers/src/upi-sms — plus
 * UPI-app senders future parsers will handle; their messages wait in the
 * unparsed queue for the re-parse pipeline.
 */
object SenderAllowlist {

    private val PATTERNS = listOf(
        // Banks (mirrors parsers/src/upi-sms SENDER_PATTERNS)
        "HDFCBK", "SBIINB", "SBIUPI", "SBIPSG", "SBIBNK", "ICICIB", "ICICIT",
        "AXISBK", "KOTAKB", "PYTMBK", "PAYTMB", "YESBNK", "IDFCFB", "INDUSB",
        "CANBNK", "UNIONB", "BOIIND", "PNBSMS", "FEDBNK", "AUBANK",
        // UPI apps (capture-only for now; parsers follow)
        "PHONPE", "GPAY", "PAYTM",
    ).map { Regex(it, RegexOption.IGNORE_CASE) }

    fun matches(sender: String?): Boolean =
        sender != null && PATTERNS.any { it.containsMatchIn(sender) }
}
