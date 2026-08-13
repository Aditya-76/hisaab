# hisaab — Instrumentation Plan (privacy-preserving)

**Status:** v1.0 (companion to [PRD](./PRD.md))
**Related docs:** [PRD](./PRD.md) · [UX design](./UX-DESIGN.md) · [Technical design](./TECH-DESIGN.md)

## 1. Stance

hisaab has **zero telemetry**. The v1 binary has no `INTERNET` permission, so nothing *can* phone home. But "no telemetry" cannot mean "no measurement" — the PRD commits to parse coverage ≥90% and we need real product signal from the pilot. This plan reconciles the two:

1. All instrumentation is **local-only**: events land in the on-device `diagnostics_log` table, visible to the worker in Settings → Diagnostics.
2. Measurement leaves the phone **only when the worker taps "Share my stats"** — a user-initiated share-sheet export of **counts and rates only**. Never amounts, never raw text, never identifiers.
3. Everything collected is enumerated in this doc and in `PRIVACY.md`. If it's not listed here, the app doesn't log it.

## 2. Local event taxonomy (day 1)

Events are `(event, at, props)` rows in `diagnostics_log` (Tech design §4). Props never contain money amounts, raw notification/SMS text, or free-form user input.

### Capture & parse health (the core signal)

| Event | Props | Why |
|---|---|---|
| `capture.notification` | platform, appVersion | Volume baseline per platform |
| `capture.sms` | senderClass (bank/upi/wallet) | SMS pipeline health |
| `capture.gap_marker` | gapMinutes, cause (reboot/rebind) | OEM kill detection (UX E2) |
| `parse.ok` | platform, eventKind, parserPackVersion | Numerator of coverage |
| `parse.unparsed` | platformGuess, parserPackVersion | Denominator + rot detector (UX E7) |
| `parse.error` | platform, parserId (no payload) | Parser crash tracking |
| `reparse.rescued` | platform, count | Did community fixtures rescue backlog? |

### Product usage (lightweight, local)

| Event | Props | Why |
|---|---|---|
| `app.open` | — | Days-active (PRD monitored metric) |
| `expense.added` | category | Is F4 used at all? |
| `recon.viewed` / `recon.confirmed` / `recon.ambiguous` | platform | Is reconciliation trustworthy/used? |
| `contrib.shared` | platformGuess | Contribution loop throughput |
| `onboarding.step` | step, outcome (granted/denied/skipped) | Where trust breaks in F6 |
| `settings.language_changed` | from, to | Language mix in pilot |
| `stats.shared` | — | Who's reporting (self-referential, still local) |

Retention: `diagnostics_log` rows auto-prune after 180 days. "Delete everything" deletes this table too.

## 3. Metric definitions

- **Parse coverage (the committed metric):**
  `parse.ok / (parse.ok + parse.unparsed)` per platform per week, computed on-device over `raw_events` (not the log — the tables are ground truth; the same formula ships in `cli` so CI, maintainers, and the app all compute coverage identically).
  Excluded from the denominator: notifications from allowlisted apps marked `ignored` (marketing/chatter types that carry no earnings data — the ignore-list is itself in `parsers` and fixture-tested, so "ignored" can't become a coverage-inflating dumping ground).
- **Days-active:** distinct days with `app.open`, per week.
- **Reconciliation auto-match rate:** `auto + confirmed` / all payout credits in cycle.
- **Contribution throughput:** `contrib.shared` count; maintainer side tracks samples → merged fixtures in GitHub.

## 4. "Share my stats" export (pilot measurement protocol)

Settings → Diagnostics → **Share my stats** renders a preview (worker sees exactly what leaves the phone), then opens the Android share sheet. Format — plain text + JSON, e.g.:

```json
{
  "hisaabVersion": "0.4.1",
  "parserPackVersion": "0.9.2",
  "weekOf": "2026-08-10",
  "language": "kn",
  "coverage": { "swiggy": 0.94, "zepto": 0.88, "blinkit": 0.91, "zomato": 0.93, "upi-sms": 0.97 },
  "counts": { "captured": 412, "parsed": 379, "unparsed": 33, "gapMarkers": 2 },
  "daysActive": 6,
  "reconAutoMatchRate": 0.86,
  "device": { "android": 13, "oem": "Xiaomi" }
}
```

Explicitly **absent**: amounts, earnings, raw text, phone/device identifiers, names, location. The export is stable-schema (`statsSchemaVersion`) so pilot aggregation is scriptable.

**Pilot cadence:** weekly nudge card on Diagnostics screen during pilot ("Help improve hisaab — share this week's stats in the pilot group"). Workers share into the pilot WhatsApp group; a maintainer script aggregates JSON blobs into the pilot dashboard (a spreadsheet, not a service). Sharing is optional; non-sharing workers stay in the pilot.

## 5. What we never collect

No earnings amounts off-device. No raw notification/SMS text off-device (the contribution flow F5 is separate, worker-initiated per item, and anonymized with preview). No advertising IDs, no device fingerprints, no location, no contact data, no behavioral session recording. No third-party analytics/crash SDKs — crash logs are local files shareable only by the worker (Tech design §8).

## 6. Future (post-pilot, explicitly not v1)

If the project ever needs population-scale signal beyond pilot self-reports, the only acceptable design is: **opt-in**, aggregate-counts-only submission to a **self-hosted, open-source** endpoint, off by default, with the payload identical to the "Share my stats" JSON and inspectable before send. This would require adding the `INTERNET` permission — a decision to be made publicly with the community, never slipped into a release. Until then: no network, period.
