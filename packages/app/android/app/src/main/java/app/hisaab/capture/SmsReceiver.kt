package app.hisaab.capture

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

/**
 * Live SMS capture (TECH-DESIGN §5.2). Registered only in the `full`
 * flavor's manifest; every invocation re-checks the opt-in + grants, and the
 * sender allowlist decides before any message body is stored.
 */
class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        if (!SmsCapture.isEnabled(context)) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        if (messages.isEmpty()) return
        val first = messages.first() ?: return
        val sender = first.originatingAddress
        if (!SenderAllowlist.matches(sender)) return

        // Multipart SMS arrive as ordered parts of one message — join them.
        val body = messages.filterNotNull().joinToString("") { it.messageBody.orEmpty() }
        if (body.isBlank() || sender == null) return

        RawEventStore.insertSms(context, sender, body, first.timestampMillis)
    }
}
