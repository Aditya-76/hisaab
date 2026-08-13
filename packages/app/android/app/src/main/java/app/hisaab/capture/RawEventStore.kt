package app.hisaab.capture

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import java.security.MessageDigest
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

// BEGIN raw_events DDL — dual-owned with packages/app/src/db/schema.ts (D-024).
// Native bootstraps the table so capture works before the JS runtime has ever
// run; JS migration 001 runs the same IF NOT EXISTS statements. This string
// must stay BYTE-IDENTICAL to RAW_EVENTS_SQL in schema.ts —
// schema-contract.test.ts fails CI if the two drift.
const val RAW_EVENTS_SQL = """
CREATE TABLE IF NOT EXISTS raw_events (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  package_name TEXT,
  sender TEXT,
  title TEXT,
  text TEXT NOT NULL,
  posted_at TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  app_version TEXT,
  parsed INTEGER NOT NULL DEFAULT 0,
  parser_pack_version TEXT,
  contributed INTEGER NOT NULL DEFAULT 0,
  dedupe_key TEXT
);
CREATE INDEX IF NOT EXISTS idx_raw_parsed ON raw_events(parsed, posted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_dedupe ON raw_events(dedupe_key) WHERE dedupe_key IS NOT NULL
"""
// END raw_events DDL

/**
 * Writes captured raw events straight into the app's SQLite database —
 * synchronously, on the caller's thread, with no React Native involvement:
 * capture must survive the RN runtime not being up (TECH-DESIGN §5.1).
 * WAL mode makes the cross-thread (and cross-connection, once JS opens the
 * same file via op-sqlite) writes safe.
 */
object RawEventStore {

    /** Must match DB_NAME in packages/app/src/db/schema.ts. */
    private const val DB_NAME = "hisaab.db"

    /**
     * Pseudo-package for capture gap markers (UX E2, D-025). Matches
     * CAPTURE_MARKER_PACKAGE in packages/app/src/db/schema.ts.
     */
    const val CAPTURE_MARKER_PACKAGE = "app.hisaab.capture"

    /** raw_events.parsed codes — order of PARSED_STATES in @hisaab/core. */
    private const val PARSED_UNPARSED = 0
    private const val PARSED_IGNORED = 3

    /** Repeat posts of the same notification within this window dedupe (§5.1). */
    private const val DEDUPE_BUCKET_MS = 90_000L

    @Volatile
    private var db: SQLiteDatabase? = null

    @Synchronized
    fun open(context: Context): SQLiteDatabase {
        db?.let { if (it.isOpen) return it }
        val file = context.getDatabasePath(DB_NAME)
        file.parentFile?.mkdirs()
        val opened = SQLiteDatabase.openOrCreateDatabase(file, null)
        opened.enableWriteAheadLogging()
        for (statement in RAW_EVENTS_SQL.split(";")) {
            if (statement.isNotBlank()) opened.execSQL(statement)
        }
        db = opened
        return opened
    }

    fun insertNotification(
        context: Context,
        packageName: String,
        title: String?,
        text: String,
        postedAtMillis: Long,
        appVersion: String?,
        markIgnored: Boolean = false,
    ) {
        insert(
            context,
            source = "notification",
            packageName = packageName,
            sender = null,
            title = title,
            text = text,
            postedAtMillis = postedAtMillis,
            appVersion = appVersion,
            parsed = if (markIgnored) PARSED_IGNORED else PARSED_UNPARSED,
            dedupeIdentity = packageName,
        )
    }

    fun insertSms(context: Context, sender: String, body: String, postedAtMillis: Long) {
        insert(
            context,
            source = "sms",
            packageName = null,
            sender = sender,
            title = null,
            text = body,
            postedAtMillis = postedAtMillis,
            appVersion = null,
            parsed = PARSED_UNPARSED,
            dedupeIdentity = sender,
        )
    }

    /**
     * Capture outage marker (UX E2, D-025): an ordinary raw_events row from
     * the pseudo-package, pre-marked ignored so it never enters the parse
     * queue but stays visible to diagnostics and "data may be missing" UI.
     */
    fun insertGapMarker(context: Context, reason: String) {
        val now = System.currentTimeMillis()
        insert(
            context,
            source = "notification",
            packageName = CAPTURE_MARKER_PACKAGE,
            sender = null,
            title = "capture-gap",
            text = reason,
            postedAtMillis = now,
            appVersion = null,
            parsed = PARSED_IGNORED,
            dedupeIdentity = CAPTURE_MARKER_PACKAGE,
        )
    }

    /** Latest capture time (gap markers excluded) for getCaptureStatus(). */
    fun lastEventAt(context: Context): String? {
        open(context).rawQuery(
            "SELECT MAX(captured_at) FROM raw_events WHERE package_name IS NULL OR package_name != ?",
            arrayOf(CAPTURE_MARKER_PACKAGE),
        ).use { cursor ->
            if (cursor.moveToFirst() && !cursor.isNull(0)) return cursor.getString(0)
        }
        return null
    }

    private fun insert(
        context: Context,
        source: String,
        packageName: String?,
        sender: String?,
        title: String?,
        text: String,
        postedAtMillis: Long,
        appVersion: String?,
        parsed: Int,
        dedupeIdentity: String,
    ) {
        val database = open(context)
        val dedupeKey = dedupeKey(dedupeIdentity, title, text, postedAtMillis)
        val capturedAt = isoOffset(System.currentTimeMillis())

        // Repeat posts update, not insert (§5.1). UPSERT needs SQLite 3.24+
        // which Android 9's OS SQLite predates, so: update-then-insert.
        database.compileStatement("UPDATE raw_events SET captured_at = ? WHERE dedupe_key = ?")
            .use { update ->
                update.bindString(1, capturedAt)
                update.bindString(2, dedupeKey)
                if (update.executeUpdateDelete() > 0) return
            }
        database.compileStatement(
            "INSERT INTO raw_events (source, package_name, sender, title, text, posted_at, captured_at, app_version, parsed, dedupe_key) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).use { insert ->
            insert.bindString(1, source)
            bindStringOrNull(insert, 2, packageName)
            bindStringOrNull(insert, 3, sender)
            bindStringOrNull(insert, 4, title)
            insert.bindString(5, text)
            insert.bindString(6, isoOffset(postedAtMillis))
            insert.bindString(7, capturedAt)
            bindStringOrNull(insert, 8, appVersion)
            insert.bindLong(9, parsed.toLong())
            insert.bindString(10, dedupeKey)
            insert.executeInsert()
        }
    }

    private fun bindStringOrNull(
        statement: android.database.sqlite.SQLiteStatement,
        index: Int,
        value: String?,
    ) {
        if (value == null) statement.bindNull(index) else statement.bindString(index, value)
    }

    /** ISO 8601 with the device's UTC offset — the postedAt contract (§3). */
    private fun isoOffset(epochMillis: Long): String =
        OffsetDateTime.ofInstant(Instant.ofEpochMilli(epochMillis), ZoneId.systemDefault())
            .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)

    /** hash(identity, title, text, postTime/90s bucket) per TECH-DESIGN §5.1. */
    private fun dedupeKey(identity: String, title: String?, text: String, postedAtMillis: Long): String {
        val bucket = postedAtMillis / DEDUPE_BUCKET_MS
        val payload = "$identity|${title.orEmpty()}|$text|$bucket"
        val digest = MessageDigest.getInstance("SHA-256").digest(payload.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }
}
