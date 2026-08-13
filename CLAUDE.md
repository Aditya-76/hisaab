# hisaab

Open-source, on-device earnings tracker for Indian gig workers. v1 targets food-delivery and quick-commerce riders (Swiggy + Instamart, Zomato, Blinkit, Zepto); ride-hailing (Uber, Ola, Rapido, inDrive, Namma Yatri), logistics (Porter, Amazon Flex, Ekart, Shadowfax, Delhivery, Loadshare, XpressBees) and services (Urban Company) follow in later waves. Parses order/payout notifications and UPI/bank SMS locally on Android to show workers their true net earnings — per order, per day, per platform. **Data never leaves the phone. The app is forever free for workers.**

Authoritative docs — read these before making product or architecture decisions:

- [docs/PRD.md](docs/PRD.md) — problem, scope, platform waves, success metrics, phase gates
- [docs/UX-DESIGN.md](docs/UX-DESIGN.md) — flows, wireframes, edge cases, empty states
- [docs/TECH-DESIGN.md](docs/TECH-DESIGN.md) — architecture, schema, native/JS contracts, rollout
- [docs/INSTRUMENTATION.md](docs/INSTRUMENTATION.md) — local-only metrics, "Share my stats" protocol
- [docs/DECISIONS.md](docs/DECISIONS.md) — append-only decision log (D-001…) with alternatives and rationale

**Decision log rule:** any change to scope, architecture, privacy posture, licensing, or money handling gets a new entry in `docs/DECISIONS.md` (append-only; supersede, never edit) in the same PR that makes the change. Check the log before re-opening a settled question.

## Why this exists

- Workers run 2–4 apps simultaneously and have no cross-platform view of net earnings (gross − commissions/penalties − fuel − incentives actually credited vs. promised).
- Platforms have no public APIs. On-device notification + SMS parsing is the only durable data source, and it's the worker's own data.
- Open source is the trust strategy: an app reading notifications/SMS must be auditable.

## Architecture principles (non-negotiable)

1. **On-device only.** SQLite local storage. Zero network calls in v1 — the app manifest declares **no INTERNET permission**. No analytics SDKs, no crash reporters. `android:allowBackup="false"`.
2. **Parsers are pure functions.** `(input: RawInput) => NormalizedEvent | null`. No side effects, no I/O, no Date.now(). All platform knowledge lives in `packages/parsers`.
3. **Fixture-driven testing.** Every parser change must be backed by anonymized real samples in `packages/parsers/fixtures/`. The fixture corpus is the community asset.
4. **Never silently drop data.** Raw events persist before parsing; unrecognized ones go to a local "unparsed" queue workers can flag for contribution.
5. **Money is integer paise.** Never floats in money paths.

## Monorepo layout

```
hisaab/
├── packages/
│   ├── parsers/   # Apache-2.0. Pure parsing functions + fixtures
│   │   ├── src/{swiggy,zomato,blinkit,zepto,upi}/
│   │   └── fixtures/          # anonymized, named platform/type.lang.n.json
│   ├── core/      # Apache-2.0. Zod types + aggregation + reconciliation + anonymizer
│   ├── cli/       # Apache-2.0. Fixture harness: fixtures in, JSON + coverage % out
│   └── app/       # AGPL-3.0. React Native Android app + Kotlin capture module
├── docs/ · CONTRIBUTING.md · PRIVACY.md · CLAUDE.md
```

## Tech stack (all open source)

- **App:** React Native, TypeScript strict (Android-first; iOS out of scope — NotificationListenerService is Android-only).
- **Native module:** Kotlin `NotificationListenerService` + SMS `BroadcastReceiver`/inbox backfill. Native writes raw events straight to SQLite; JS drains and parses in batches (capture never depends on the RN runtime being alive).
- **Storage:** SQLite via `op-sqlite`, WAL mode, migrations from day one (`PRAGMA user_version`).
- **Monorepo:** pnpm workspaces + TS project references. `parsers`, `core`, `cli` must build/test with zero React Native dependencies (Vitest on Linux CI).
- **CI:** GitHub Actions — Biome lint, typecheck, fixture tests + coverage %, license audit (OSI-only deps) on every PR.

## Core data model (packages/core)

- `Earning`: platform, timestamp, kind (`order`|`trip`|`job`|`shift`|`adjustment`), grossAmount, tips?, surge?, netPayout?, distanceKm?, externalId?
- `IncentiveEvent`: platform, promised vs. credited, criteria text, timestamp
- `PayoutCredit`: source (UPI/bank/wallet), amount, timestamp, match status
- `Expense`: category (fuel/recharge/rent/other), amount, timestamp, note?
- `RawEvent`: source, platform guess, raw text, timestamps, parsed state, contributed flag

Derived views: net per day/week/platform, promised-vs-credited incentive gap, expense overlay. Day = Asia/Kolkata calendar date.

## Phase plan (gates, not dates — see PRD §18)

- **0 — Scaffolding:** pnpm monorepo, TS/lint/CI, licenses (Apache-2.0 packages, AGPL-3.0 root/app), README with privacy pledge first, CONTRIBUTING with "paste your notification" template.
- **1 — Parsers first, no UI:** core types; UPI/bank SMS parser first (most stable formats); Swiggy, Zomato, Blinkit, Zepto parsers; CLI harness.
- **2 — Capture pipeline:** Kotlin capture module; raw queue → parser → SQLite; unparsed queue UI stub.
- **3 — Dashboard MVP:** net earnings home, per-platform split, expenses, EN/हिन्दी/ಕನ್ನಡ, honest permission onboarding.
- **4 — Pilot readiness:** UPI reconciliation, contribute-notification share flow, export/delete, diagnostics, signed APK → Bengaluru pilot (50–100 riders), gate: ≥90% parse coverage.

## Conventions

- TypeScript strict; no `any` in parsers or core. Conventional commits.
- Every parser: one file per notification type, exhaustive fixtures, per-platform `SUPPORTED_VERSIONS.md`.
- Fixture anonymization: strip names, phone numbers, addresses, order/vehicle IDs; keep amounts, fuzzed timestamps, structural text.
- Hindi/Kannada notification variants are first-class; fixtures must capture language variants. UI strings externalized (i18next) from day one — EN/HI/KN in v1, more languages community-translatable.

## Out of scope (v1)

iOS. Cloud sync. Accounts/auth. Any server or network call. Play Store polish (sideload APK for pilot; a notification-only build flavor is planned for Play later). Monetization — the app is forever free for workers; sustainability is grants + an optional institutional hosted layer much later, never required.
