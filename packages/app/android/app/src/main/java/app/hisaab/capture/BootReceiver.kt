package app.hisaab.capture

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Records a gap marker at boot (TECH-DESIGN §5.4): notifications posted
 * while the phone was off were never seen, and the listener re-binds some
 * time after boot — the marker keeps "today" numbers honest (UX E2).
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent?.action != Intent.ACTION_BOOT_COMPLETED) return
        RawEventStore.insertGapMarker(context, "boot-completed")
    }
}
