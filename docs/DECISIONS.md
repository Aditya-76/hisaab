# hisaab — Decision Log

Running log of product and technical decisions. **Append-only:** never edit or delete an entry — to change course, add a new entry that supersedes the old one and link the two. Every entry records what was decided, the alternatives considered, and why, so future contributors don't re-litigate settled questions blind.

Format: `D-NNN · date · status (Accepted | Superseded by D-XXX)`.

---

## D-001 · 2026-08-13 · Accepted — v1 targets food-delivery + quick-commerce riders

Wave 1 builds for Swiggy (food + Instamart), Zomato, Blinkit, Zepto riders. Ride-hailing (Uber, Ola, Rapido, inDrive, Namma Yatri), logistics/parcel (Porter, Amazon Flex, Ekart, Shadowfax, Delhivery, Loadshare, XpressBees), and home services (Urban Company) are roadmap waves 3–5, not v1.
**Alternatives considered:** ride-hailing-first (original CLAUDE.md draft), all segments at once.
**Why:** largest workforce, heaviest multi-apping, order-based earnings are the most parseable; one segment done well beats four done poorly. Data model stays segment-agnostic (D-013) so later waves are parser work only.

## D-002 · 2026-08-13 · Accepted — React Native + TypeScript, Kotlin only for capture

**Alternatives considered:** native Kotlin/Compose (better battery/APK size), Flutter, Kotlin Multiplatform.
**Why:** parsers in TypeScript run identically in the app, CLI, and Linux CI; biggest OSS contributor pool. The capture path (NotificationListenerService, SMS) is native Kotlin regardless.

## D-003 · 2026-08-13 · Accepted — Daily net earnings dashboard is the MVP hero feature

**Alternatives considered:** incentive-gap tracker, payout reconciliation, or per-km truth as the lead.
**Why:** the cross-platform daily number is the thing no platform can show and the reason to open the app every day. Reconciliation ships in v1 but as a supporting feature (F3); incentive gap and per-km/per-hour are roadmap.

## D-004 · 2026-08-13 · Accepted — Capture = notifications + opt-in SMS

**Alternatives considered:** notifications-only (less scary, no reconciliation), notifications + manual entry.
**Why:** SMS unlocks "money actually received." Mitigations: SMS is optional and skippable, the app is fully functional without it, sender-pattern allowlist means non-payment SMS are never read (Tech design §5.2).

## D-005 · 2026-08-13 · Accepted — Sideload APK pilot; F-Droid post-pilot; Play Store later

**Alternatives considered:** Play Store first.
**Why:** Play's SMS policy would force fights during iteration. GitHub Releases + WhatsApp-shareable link matches how gig workers actually get apps. A `notificationOnly` build flavor is planned from day one so the Play variant is a build flag, not a fork.

## D-006 · 2026-08-13 · Accepted — v1 UI languages: English, Hindi, Kannada

Kannada added when Bengaluru was chosen as pilot city (D-009). Hindi in conversational Hinglish register, not shuddh Hindi. More languages are roadmap and part of the pitch ("hisaab speaks the worker's language"); strings externalized (i18next) from day one.

## D-007 · 2026-08-13 · Accepted — Licensing split: Apache-2.0 packages, AGPL-3.0 app

`parsers`, `core`, `cli` are Apache-2.0 (reusable by researchers/unions/other worker tools); `app` and repo root are AGPL-3.0 (no proprietary forks).
**Alternatives considered:** all-AGPL (blocks parser reuse), all-permissive (allows closed-source forks of the whole app).

## D-008 · 2026-08-13 · Accepted — v1 manual entry is fuel & expenses only

**Alternatives considered:** manual earnings entry, COD tracking, work-hours logging.
**Why:** expenses are required for true net earnings; everything else risks turning hisaab into a data-entry app. Missed-earnings entry, COD, and hours are roadmap.

## D-009 · 2026-08-13 · Accepted — Pilot: Bengaluru, 50–100 riders

**Alternatives considered:** Delhi NCR, multi-city small, friends-and-family only.
**Why:** highest quick-commerce density, strong gig-worker communities, open-network (Namma Yatri) culture. Consequence: Kannada in v1 (D-006). Rollout stages: maintainer devices → ~10-worker alpha → full pilot (Tech design §9).

## D-010 · 2026-08-13 · Accepted — One committed metric: parse coverage ≥90%

D30 retention, reconciliation accuracy, and contributor counts are monitored, not gating.
**Why:** with zero telemetry we can only honestly *commit* to what pilot participants self-report via "Share my stats" (D-016); coverage is the core technical promise and is measurable on-device.

## D-011 · 2026-08-13 · Accepted — Forever free for workers; grants + optional hosted layer later

The app never charges workers and never sells data. Funding: digital-rights/worker-welfare grants under a fiscal sponsor; later an *optional* institutional hosted layer (backup, tax docs, Account Aggregator) — never required for the core app.
**Alternatives considered:** pure volunteer OSS (parser maintenance needs funded time), union co-ownership (kept as partnership channel, not funding dependency).

## D-012 · 2026-08-13 · Accepted — Contribution flow: in-app flag → anonymize → share sheet

**Alternatives considered:** prefilled GitHub issues (workers need accounts — too much friction), opt-in relay server (needs a server — contradicts zero-network v1; revisit post-pilot).
**Why:** zero backend, works over WhatsApp/Telegram where workers already are. Anonymizer is a fixture-tested pure function in `core`.

## D-013 · 2026-08-13 · Accepted — Single `Earning` type with `kind` field, not per-segment types

`kind: order | trip | job | shift | adjustment` replaces the original `TripEarning`.
**Why:** delivery orders, rides, and jobs share one aggregation path; later platform waves become parser work, not schema work. Negative adjustments (penalties) are `kind: adjustment` earnings so nets stay correct (UX E4).

## D-014 · 2026-08-13 · Accepted — Phase gates, no calendar dates

**Alternatives considered:** 3-month and 5–6-month timelines.
**Why:** honest for an OSS project with variable contributor time; each phase has an exit gate (PRD §18) and rollout only widens when the previous cohort holds ≥90% coverage.

## D-015 · 2026-08-13 · Accepted — Zero network, verifiable: no INTERNET permission in the v1 manifest

**Alternatives considered:** "we promise we don't phone home" with permission present; allowing a GitHub update-check ping.
**Why:** absence of the permission is verifiable from the manifest alone — the strongest privacy claim an Android app can make. Consequences accepted: no in-app update check (updates announced via pilot WhatsApp + GitHub), external links open in the system browser via intents. Related: `android:allowBackup="false"` because Google auto-backup would silently upload the DB to Google Drive (breaks the on-device pledge; restore = manual export/import).

## D-016 · 2026-08-13 · Accepted — Analytics = local-only instrumentation + user-initiated "Share my stats"

**Alternatives considered:** conventional telemetry (violates D-015), no measurement at all (can't verify PRD commitments).
**Why:** all events land in an on-device `diagnostics_log` the worker can inspect; counts/rates only (never amounts, raw text, or identifiers) leave the phone, and only when the worker taps share. Full taxonomy: [INSTRUMENTATION.md](./INSTRUMENTATION.md). Any future networked telemetry must be opt-in, aggregate-only, self-hosted, and decided publicly (Instrumentation §6).

## D-017 · 2026-08-13 · Accepted — Native capture writes SQLite directly; JS reads

**Alternatives considered:** streaming events over the RN bridge to JS for storage.
**Why:** capture must survive the RN runtime not being alive (OEM kills, background). Raw events persist before any parsing; parse failures lose nothing. Money stored as integer paise, never floats.

## D-018 · 2026-08-13 · Accepted — Storage: SQLite via op-sqlite

**Alternatives considered:** react-native-quick-sqlite (op-sqlite is its actively-maintained successor), WatermelonDB/Realm (heavier, wrong fit for SQL-first aggregation). WAL mode; migrations via `PRAGMA user_version` from day one.

## D-019 · 2026-08-13 · Accepted — Keep the name "hisaab"

**Alternatives considered:** a more pan-Indian name, deferring the decision.
**Why:** instantly meaningful ("apna hisaab"), works in the pilot city, short and typeable.

## D-020 · 2026-08-13 · Accepted — OSS-only dependency policy, enforced in CI

Every dependency must carry an OSI-approved license; CI license audit fails otherwise. Follows from the trust strategy: the whole stack must be auditable, not just our code.

## D-021 · 2026-08-13 · Accepted — Platform payout announcements are IncentiveEvents, not PayoutCredits

A platform notification saying "weekly payout of ₹X processed" is the platform's *claim* about money; it parses to an `IncentiveEvent` with `promisedAmount = creditedAmount = X`. `PayoutCredit` is reserved exclusively for money actually observed on the payment rails (bank/UPI credit SMS).
**Alternatives considered:** parsing payout announcements as `PayoutCredit` (double-counts against the bank SMS and destroys reconciliation's promised-vs-received semantics), a fourth event type (schema churn for no gain).
**Why:** reconciliation (F3) compares platform claims to observed credits; keeping the two on separate types makes that comparison structural rather than heuristic.

## D-022 · 2026-08-13 · Accepted — Bootstrap with a synthetic fixture corpus, replaced file-for-file by real captures

Phase 1 ships parsers backed by ~44 **synthetic** fixtures (representative formats from public knowledge), each marked `"_meta": {"synthetic": true}`, with per-platform `SUPPORTED_VERSIONS.md` stating no version is verified. Zomato/Blinkit/Zepto package names are TO-VERIFY placeholders. Real anonymized captures (maintainer devices in the Phase-2 spike, then the contribution flow) replace synthetic files one-for-one; a parser counts as validated only when its platform lists a real app version.
**Alternatives considered:** waiting for real captures before writing any parser (blocks the whole Phase-1 gate on device work), shipping unmarked synthetic fixtures (dishonest about coverage).
**Why:** the harness, registry semantics, and CI gates are testable now; the corpus's synthetic status is explicit everywhere so nobody mistakes bootstrap data for validated coverage.

## D-023 · 2026-08-13 · Accepted — IST day math uses a fixed +05:30 offset; no timezone database

`istDayKey`/`istWeekKey` in `core` compute Asia/Kolkata calendar dates by plain +05:30 offset arithmetic. No tz library (and no date-fns dependency in core for now — it enters with the app for formatting).
**Alternatives considered:** date-fns-tz/Intl zone lookups (pulls a tz database or host-dependent ICU into a hot path for a zone that never changes).
**Why:** IST has had no DST and no offset changes in the app's lifetime; fixed-offset math is exact, dependency-free, and fast on low-end devices. If India ever changes its offset, the constant lives in one file (`core/src/time.ts`).

---

## D-024 · 2026-08-13 · Accepted — raw_events DDL is dual-owned (Kotlin bootstrap + JS migration), guarded by a CI identity test

The Kotlin capture module executes the `raw_events` DDL (`CREATE TABLE IF NOT EXISTS`) on first write; JS migration 001 runs the identical statements. The DDL string lives twice — `packages/app/src/db/schema.ts` and `RawEventStore.kt` — and `schema-contract.test.ts` fails CI unless they are byte-identical (it also pins the DB filename, parsed-state codes, gap-marker package, and that the capture allowlist is a superset of the parser registry).
**Alternatives considered:** native waits for JS migrations (loses capture before first app open — unacceptable, capture must survive the RN runtime being dead, TECH-DESIGN §5.1); code-generating Kotlin from TS (build machinery for one table).
**Why:** two plain copies with a drift alarm is the simplest thing that keeps the invariant honest. Only `raw_events` is dual-owned; every other table belongs solely to JS migrations.

---

## D-025 · 2026-08-13 · Accepted — capture gap markers are ordinary raw_events rows, pre-marked ignored

Capture outages (listener reconnect, boot) are recorded as `raw_events` rows from the pseudo-package `app.hisaab.capture` with `parsed = ignored`, so they never enter the parse queue or the unparsed-queue UI but stay queryable for diagnostics and UX E2's "data may be missing" notices.
**Alternatives considered:** separate `capture_gaps` table (second write path in native code for the same information); SharedPreferences flags (not queryable next to the event timeline they annotate).
**Why:** one native write path, one timeline; the marker's `posted_at` sits exactly where the gap sits.

---

## D-026 · 2026-08-13 · Accepted — app pipeline is tested on Linux CI via node:sqlite behind a Db interface

The app's DB/pipeline code (migrations, repos, drainer) is written against a 4-method `Db` interface; production implements it over op-sqlite, tests over Node's built-in `node:sqlite` — real SQLite semantics (partial indexes, FK constraints, transactions) with zero React Native or emulator involvement. The app package stays OUT of the root tsc project references and gets its own CI typecheck step, so core/parsers/cli keep building with zero RN reach (TECH-DESIGN §2).
**Alternatives considered:** mocking SQL calls (tests would pass while real SQL fails — the partial-index and FK bugs caught on day one prove the point); emulator-only testing (slow, flaky, gates nothing on PRs).
**Why:** the pipeline is the part of the app where correctness is money; it now has the same fixture-grade CI coverage as the parsers. Instrumented tests on emulator remain the plan for the native capture layer itself.

---

## How to add an entry

1. Copy the format: ID, date, status, one-line decision, alternatives considered, why (and consequences).
2. Decisions worth logging: anything that changes scope, architecture, privacy posture, licensing, money handling, or that a future contributor might otherwise re-open. Routine implementation choices don't need entries.
3. Reversals: new entry with `Supersedes D-XXX`; mark the old one `Superseded by D-YYY`. Never rewrite history.
4. Update the affected doc(s) (PRD / UX / Tech / Instrumentation / CLAUDE.md) in the same PR — the log records the decision; the docs reflect its current state.
