# hisaab — task tracker

Running log of what's done, what's in flight, and what's next, organized by the
phase gates in [docs/PRD.md §18](docs/PRD.md) / [CLAUDE.md](CLAUDE.md).

**How to update:** tick tasks as they land (same PR), add new tasks under their
phase, and move the "Now" marker when a phase gate is met. Keep entries short —
the PRD owns scope, [docs/DECISIONS.md](docs/DECISIONS.md) owns rationale; this
file only tracks execution. Never delete history; strike through abandoned
tasks with a one-line reason.

## Phase status

| Phase | Gate | Status |
|---|---|---|
| 0 — Scaffolding | Monorepo, CI, licenses, docs | ✅ Done |
| 1 — Parsers first, no UI | Core types, wave-1 parsers, CLI harness | ✅ Done |
| 2 — Capture pipeline | Kotlin capture → raw queue → parser → SQLite; unparsed queue stub | 🔶 Code done; device verification pending |
| 3 — Dashboard MVP | Net earnings home, per-platform, expenses, EN/HI/KN | 🔨 **Now** |
| 4 — Pilot readiness | Reconciliation, contribute flow, export/delete, signed APK, ≥90% parse coverage | ⬜ |

## Phase 0 — Scaffolding ✅

- [x] PRD, UX design, tech design, instrumentation plan (PR #1)
- [x] Append-only decision log `docs/DECISIONS.md` (PR #1)
- [x] pnpm monorepo, TS strict project references, Biome, Vitest (PR #2)
- [x] Licenses: Apache-2.0 packages, AGPL-3.0 root/app; PRIVACY (EN/HI/KN); CONTRIBUTING with notification template (PR #2)
- [x] CI: lint, typecheck, tests, fixture coverage, license audit, dependency-boundary gate (PR #2)

## Phase 1 — Parsers first, no UI ✅

- [x] Core: Zod event schemas, paise money helpers, IST day math, aggregation, anonymizer (PR #2)
- [x] Parser registry + wave-1 parsers: upi-sms, swiggy, zomato, blinkit, zepto, with synthetic fixture corpus (PR #2, D-022)
- [x] CLI fixture harness: `parse`, `run-fixtures`, `coverage` (PR #2)
- [ ] Replace synthetic fixtures file-for-file with anonymized real captures (ongoing, D-022 — carries into Phase 4 gate)

## Phase 2 — Capture pipeline 🔶

- [x] `packages/app` scaffold (AGPL-3.0, React Native, TS strict)
- [x] SQLite schema + ordered migrations, `PRAGMA user_version` gate (TECH-DESIGN §4)
- [x] Drainer: unparsed batch → `parseRawInput` → normalized tables, re-parse on parser-pack upgrade (TECH-DESIGN §3, §5.3)
- [x] Earning dedupe + revision supersedence on `(platform, external_id)` (UX E1/E3)
- [x] Kotlin capture: `NotificationListenerService` → direct SQLite writes, capture-time dedupe, gap markers (TECH-DESIGN §5.1, D-025)
- [x] Kotlin capture: SMS `BroadcastReceiver` + inbox backfill behind opt-in grant, sender allowlist (TECH-DESIGN §5.2)
- [x] JS bridge: `CaptureModule` contract (TECH-DESIGN §5.3)
- [x] `raw_events` DDL contract shared by Kotlin and JS, guarded by a cross-language CI test (D-024)
- [x] Unparsed queue UI stub with EN/HI/KN strings (UX §3.4)
- [x] `notificationOnly` build flavor split (SMS permissions only in `full` manifest, TECH-DESIGN §9)
- [x] CI: app typecheck + app pipeline tests on Linux via `node:sqlite` (D-026)
- [ ] Instrumented Android test set (listener insert, dedupe, gap marker) on emulator CI
- [ ] Verify capture end-to-end on maintainer devices (MIUI + stock Android minimum) — **phase gate**

## Phase 3 — Dashboard MVP 🔨

- [x] SQL dashboard views cross-checked against core aggregation: day summary, platform split, week strip, earnings list (TECH-DESIGN §6)
- [x] Net earnings home (today/yesterday, hero number, platform split, week strip, unparsed + access-revoked banners, empty/zero-day states) (UX §3.2, §5.1)
- [x] Expense entry: FAB → bottom sheet, category chips, recent amounts, paise-only path (UX §3.3)
- [x] Orders history tab: newest-first list, platform filter, day headers, penalties in red (UX §2, E4)
- [x] 4-tab shell (Home / Orders / Inbox / Settings) with Inbox badge (UX §2)
- [x] Settings v1: language switch persisted in DB (migration 002, D-027), capture status, about/pledge
- [x] Diagnostics screen: per-platform parse coverage + capture counts, local-only (INSTRUMENTATION §3); coverage/counts repos CI-tested
- [x] i18next EN/हिन्दी/ಕನ್ನಡ full UI pass (incl. months/weekdays; light + dark theme)
- [x] Local diagnostics events wired: `app.open`, `expense.added`, `settings.language_changed`; 180-day prune (INSTRUMENTATION §2)
- [ ] Honest permission onboarding + OEM hardening flow (UX §3.1, §3.7)
- [ ] "Share my stats" preview on Diagnostics (may slip to Phase 4 with the share flow)
- [ ] Component tests for UX §5 states; EN/HI/KN manual screenshot pass on device — **phase gate**

## Phase 4 — Pilot readiness ⬜

- [ ] UPI reconciliation engine (TECH-DESIGN §7)
- [ ] Contribute-notification share flow (anonymizer + review screen)
- [ ] Export / delete-all (UX E11)
- [ ] Signed APK release pipeline, key fingerprint in README
- [ ] Bengaluru pilot (50–100 riders); gate: ≥90% parse coverage
