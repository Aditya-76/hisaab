package app.hisaab.capture

import android.content.Context
import android.provider.Telephony

/**
 * One-time inbox backfill on SMS grant (TECH-DESIGN §5.2): reads the last N
 * days of Telephony.Sms.Inbox, allowlist-filtered BEFORE anything is stored.
 * Dedupe keys make re-runs (and overlap with live capture) idempotent.
 */
object SmsBackfill {

    fun run(context: Context, days: Int): Int {
        if (days <= 0 || !SmsCapture.isEnabled(context)) return 0
        val cutoff = System.currentTimeMillis() - days.toLong() * 86_400_000L
        var imported = 0

        context.contentResolver.query(
            Telephony.Sms.Inbox.CONTENT_URI,
            arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE),
            "${Telephony.Sms.DATE} >= ?",
            arrayOf(cutoff.toString()),
            "${Telephony.Sms.DATE} ASC",
        )?.use { cursor ->
            val addressIdx = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
            val bodyIdx = cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)
            val dateIdx = cursor.getColumnIndexOrThrow(Telephony.Sms.DATE)
            while (cursor.moveToNext()) {
                val sender = cursor.getString(addressIdx) ?: continue
                if (!SenderAllowlist.matches(sender)) continue
                val body = cursor.getString(bodyIdx) ?: continue
                if (body.isBlank()) continue
                RawEventStore.insertSms(context, sender, body, cursor.getLong(dateIdx))
                imported++
            }
        }
        return imported
    }
}
