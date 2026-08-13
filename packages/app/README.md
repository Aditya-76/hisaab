# @hisaab/app

The hisaab Android app: a React Native shell around a Kotlin capture module.
**AGPL-3.0-only** (the parsers/core/cli packages are Apache-2.0 — see
[docs/DECISIONS.md](../../docs/DECISIONS.md)).

Phase 2 status: this package is the **capture pipeline + a dev shell**, not a
worker-facing app yet. The dashboard, onboarding and localized full UI arrive
in Phase 3 (see [TRACKER.md](../../TRACKER.md)).

## How data flows (TECH-DESIGN §1, §5)

```
NotificationListenerService ─┐  Kotlin writes straight to SQLite —
SMS BroadcastReceiver ───────┤  no JS involved, capture survives the
inbox backfill ──────────────┘  RN runtime being dead
              │
        raw_events (hisaab.db, WAL)
              │  JS drains in batches (app foreground)
        parseRawInput()  ← @hisaab/parsers, pure functions
              │
   earnings / incentive_events / payout_credits   (+ unparsed queue: kept, never dropped)
```

Contracts to know about (all CI-guarded by `src/db/schema-contract.test.ts`):

- **raw_events DDL is dual-owned** (D-024): `src/db/schema.ts` and
  `android/.../capture/RawEventStore.kt` carry byte-identical
  `CREATE TABLE IF NOT EXISTS` statements, because native must be able to
  bootstrap the table before JS ever runs.
- **Gap markers** (D-025): capture outages are `raw_events` rows from the
  pseudo-package `app.hisaab.capture`, pre-marked ignored.
- The Kotlin **package allowlist** must be a superset of the parser
  registry's `packageNames`.

## Layout

- `src/db/` — schema, `PRAGMA user_version` migrations, repos (`Db` interface;
  op-sqlite in production via `open.ts`)
- `src/pipeline/drainer.ts` — raw queue → parsers → normalized tables
- `src/capture/capture-module.ts` — typed mirror of the Kotlin bridge (§5.3)
- `src/screens/`, `src/i18n/` — dev shell + unparsed-queue stub, EN/HI/KN
- `src/testing/node-db.ts` — the same pipeline on `node:sqlite` for Linux CI
- `android/` — Kotlin capture module + Gradle project

## Building (needs Android SDK; not built in CI yet)

```sh
pnpm install                     # repo root
cd packages/app
pnpm android                     # debug build on a connected device
```

Notes:

- The Gradle **wrapper jar is not committed** (no binaries in the repo). Run
  `gradle wrapper` once inside `android/` (any local Gradle ≥ 8), or copy
  `gradlew`/`gradle-wrapper.jar` from a React Native 0.87 template.
- Two product flavors (§9): `full` (notification + opt-in SMS capture) and
  `notificationOnly` (no SMS permissions in the manifest at all — the future
  Play Store variant). `pnpm android` builds `fullDebug` by default.
- The manifest declares **no INTERNET permission** and `allowBackup="false"`.
  Verify a built APK yourself: `aapt dump permissions app.apk`.

## Testing

`pnpm test` at the repo root runs this package's pipeline tests (Vitest
project `app`) against real SQLite via `node:sqlite` — migrations, dedupe,
supersedence, drain convergence. UI and instrumented Android tests are
tracked in TRACKER.md as remaining Phase 2/3 work.
