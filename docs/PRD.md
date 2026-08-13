# hisaab — Product Requirements Document

**Status:** v1.0 (finalized for Phase 0 kickoff)
**Related docs:** [UX design](./UX-DESIGN.md) · [Technical design](./TECH-DESIGN.md) · [Instrumentation plan](./INSTRUMENTATION.md)

## 1. One-liner

**hisaab** is a free, open-source, on-device earnings tracker for Indian gig workers. It reads the worker's own order/payout notifications and UPI/bank SMS locally on their Android phone and shows true net earnings — per order, per day, per platform. **Data never leaves the phone. The app is forever free for workers.**

## 2. The problem

- Gig workers routinely run 2–4 apps simultaneously (Swiggy + Zepto + Blinkit is a normal Tuesday). No platform shows them a cross-platform view of what they actually earned.
- "Earnings" as shown by platforms is not net income: incentives are promised but partially credited, payouts arrive days later, and fuel/recharge/vehicle costs are invisible.
- Platforms expose no public APIs (Uber's driver API is limited and revocable; Swiggy/Zomato/Zepto/Blinkit have none). The worker's own notifications and SMS are the only durable, worker-controlled data source.
- Any app asking for notification + SMS access must be auditable to be trustworthy. **Open source is the trust strategy, not a nice-to-have.**

## 3. Who it's for

**Primary (v1):** food delivery and quick-commerce riders in Bengaluru — Swiggy (food + Instamart), Zomato, Blinkit, Zepto. Order-based earnings, weekly payout cycles, heavy multi-apping.

**Secondary (roadmap, not v1):** ride-hailing drivers, logistics/parcel riders, home-services workers — see platform waves in §6.

**Persona anchor:** Ravi, 26, rides for Zepto and Swiggy in HSR Layout. Checks three apps at day's end and still doesn't know if today beat yesterday. Reads Kannada and Hinglish. Won't do data entry. Suspicious (rightly) of apps that want SMS access.

## 4. Goals and non-goals

**Goals (v1)**

1. A worker sees today's and this week's **net earnings across all their platforms** in one screen, in their language.
2. ≥90% of earnings notifications from wave-1 platforms parse correctly.
3. Workers can verify money promised vs. money actually received (UPI/bank credit reconciliation).
4. The unrecognized-notification → community contribution loop works end to end without a server.

**Non-goals (v1)**

- iOS (NotificationListenerService is Android-only). Cloud sync, accounts, any server or network call. Play Store polish. Monetization of any kind. Tax reports / Account Aggregator (possible later optional hosted layer — never required, never paid-for by workers).

## 5. Product principles (non-negotiable)

1. **On-device only.** SQLite local storage. Zero network calls in v1. No analytics SDKs, no crash reporters shipping data off-device without explicit opt-in.
2. **Forever free for workers.** Sustained by grants and (later) optional institutional services — never by charging workers or selling data. This pledge goes in the README's first lines.
3. **Open source, end to end** — the app, the parsers, and every library in the stack (see §10).
4. **Earn scary permissions honestly.** Onboarding explains in plain Hinglish/Kannada exactly what is read, what is stored, and that nothing leaves the phone — before asking.
5. **Parsers are pure functions.** `(rawText, meta) => NormalizedEvent | null`. All platform knowledge lives in `packages/parsers`; fixture-driven, community-maintained.
6. **Never silently drop data.** Unrecognized notifications go to a local "unparsed" queue the worker can see and contribute.
7. **Multi-language from the architecture up** — India's gig workforce works in many languages; hisaab meeting workers in their own language is part of the pitch, not an afterthought.

## 6. Platform coverage

**Wave 1 (v1 pilot — parsers built and fixture-tested):**

| Platform | Segment | Notes |
|---|---|---|
| Swiggy (food + Instamart) | Food + quick commerce | One delivery app covers both — best fixture leverage |
| Zomato | Food delivery | |
| Blinkit | Quick commerce | Zomato ecosystem |
| Zepto | Quick commerce | Standalone app, strong Bengaluru fleet |
| UPI/bank credit SMS | Payout rails | GPay, PhonePe, Paytm, major bank SMS formats — most stable formats, built first |

**Wave 2 (community + maintainer, post-pilot):** BigBasket (bbnow), Flipkart Minutes, Amazon Fresh, JioMart, Domino's/EatSure fleet apps.

**Wave 3 — ride-hailing:** Uber, Ola, Rapido, inDrive, Namma Yatri (+ metro equivalents).

**Wave 4 — logistics/parcel:** Porter, Amazon Flex, Ekart, Shadowfax, Delhivery, Loadshare, XpressBees.

**Wave 5 — services:** Urban Company and similar job-based platforms.

The normalized data model (§9) is segment-agnostic (order-based, trip-based, and job-based earnings all map to `Earning`), so later waves are parser work, not re-architecture.

## 7. v1 features

**F1 — Daily net earnings dashboard (the hero).** Today / this week / custom range; net = parsed earnings + credited incentives − expenses. Per-platform split. Per-order list with drill-down to the raw notification. Works offline always (there is no online).

**F2 — Automatic capture.** Android `NotificationListenerService` for platform app notifications; SMS read (opt-in, separately consented) for UPI/bank credits. Raw events queue natively, JS drains in batches (battery-friendly). Every capture stored raw before parsing — parse failures lose nothing.

**F3 — Payout reconciliation.** Match UPI/bank credit SMS against expected platform payouts for the cycle; show "promised vs. received" per platform and flag gaps. (Ships when SMS opt-in granted; app is fully functional on notifications alone.)

**F4 — Expenses.** Quick-add fuel, mobile recharge, vehicle rent/EMI, other. Two-tap entry, recent-amounts shortcuts. Feeds net earnings and per-day cost view.

**F5 — Unparsed queue + contribution flow.** Unrecognized notifications listed in-app → one tap anonymizes (strip names, phones, addresses, order IDs; keep amounts and structure) → preview → Android share sheet (WhatsApp/Telegram/GitHub link). Zero backend.

**F6 — Honest onboarding.** Language pick (English / हिन्दी / ಕನ್ನಡ) → what hisaab is → what it reads and why → notification access grant → SMS grant (optional, skippable, re-promptable later) → done. No account, no phone number, no sign-in — the app never asks who you are.

**F7 — Local diagnostics ("Share my stats").** Settings screen showing the worker's own capture/parse health (counts only), with a user-initiated share of aggregate stats for pilot measurement. No amounts, no raw text, nothing automatic. See [Instrumentation plan](./INSTRUMENTATION.md).

## 8. UX outline

Home (net earnings + platform split + today's orders) · Orders/history · Add expense (FAB) · Unparsed queue (badge when non-empty) · Settings (language, platforms, SMS toggle, export data as CSV/JSON, delete everything, diagnostics). Design for sunlight readability, one-handed use, low-end devices (2–4GB RAM Androids), and instant comprehension of "aaj ka hisaab". Full flows, wireframes, edge cases, and empty states: [UX design](./UX-DESIGN.md).

## 9. Core data model (`packages/core`)

- `Earning`: platform, timestamp, kind (`order` | `trip` | `job` | `shift`), grossAmount, tips?, surge?, netPayout?, distanceKm?, externalId?
- `IncentiveEvent`: platform, promisedAmount, creditedAmount?, criteriaText, timestamp
- `PayoutCredit`: source (UPI app / bank / wallet), amount, timestamp, matchedEarningIds[]
- `Expense`: category (fuel/recharge/rent/other), amount, timestamp, note?
- `RawEvent`: source (notification/SMS), platformGuess?, rawText, timestamp, parsed (bool), flaggedForContribution (bool)

Derived views: net per day/week/platform, promised-vs-credited gap, per-day cost line. (Per-km/per-hour: roadmap, needs distance/hours signals.)

## 10. Architecture & tech stack — fully open source

```
hisaab/
├── packages/
│   ├── parsers/        # Apache-2.0 — pure functions + fixtures (swiggy/, zomato/, blinkit/, zepto/, upi/)
│   ├── core/           # Apache-2.0 — types + aggregation
│   ├── cli/            # Apache-2.0 — fixture-in, JSON-out harness + coverage %
│   └── app/            # AGPL-3.0 — React Native Android app
├── docs/  ·  CONTRIBUTING.md  ·  CLAUDE.md
```

| Layer | Choice | License |
|---|---|---|
| App framework | React Native + TypeScript (strict) | MIT / Apache-2.0 |
| Native capture | Kotlin NotificationListenerService + SMS BroadcastReceiver/content provider | Apache-2.0 (Kotlin) |
| Storage | SQLite via `op-sqlite`, migrations from day one | MIT |
| Validation | Zod (parser output schemas) | MIT |
| i18n | i18next + react-i18next | MIT |
| Dates | date-fns | MIT |
| Charts | react-native-svg + minimal custom charts | MIT |
| Monorepo/tests | pnpm workspaces, TS project references, Vitest | MIT |
| Lint/format | Biome | MIT/Apache-2.0 |
| CI | GitHub Actions: lint, typecheck, parser fixture tests + coverage % on every PR | — |

Rules: `parsers`, `core`, `cli` build and test with **zero React Native dependencies** (plain Node on Linux CI). No `any` in parsers/core. Conventional commits. A CI check rejects dependencies with non-OSI licenses. Full architecture: [Technical design](./TECH-DESIGN.md).

## 11. Privacy & permissions

Reads only: notifications from an allowlist of platform apps, and (opt-in) SMS matching payment-credit patterns. Stores locally in app-private SQLite. Never transmits — v1 binary makes zero network calls, verifiable in source and via network monitor. Worker owns everything: export (CSV/JSON) and irreversible delete-all in Settings. Anonymization for contributed fixtures: strip names, phone numbers, addresses, vehicle/order IDs; keep amounts, fuzzed timestamps, structural text. A short `PRIVACY.md` states all this in EN/HI/KN.

## 12. Localization

v1 UI: English, Hindi (conversational Hinglish register — "Aaj ki kamai", not shuddh Hindi), Kannada (pilot city). Parser fixtures treat notification-language variants (Hindi/Kannada platform notifications) as first-class test cases. Roadmap: Tamil, Telugu, Marathi, Bengali and beyond — community-translatable via simple JSON locale files; **"speaks the worker's language" is a core pitch**.

## 13. Licensing

- `packages/parsers`, `core`, `cli`: **Apache-2.0** — researchers, unions, and other worker tools can reuse the parsing corpus freely.
- `packages/app` and repo root: **AGPL-3.0** — nobody can take the app proprietary; platform/aggregator forks must stay open.

## 14. Distribution & pilot

- **Channel:** signed APK on GitHub Releases; WhatsApp-shareable download link; F-Droid submission after pilot; Play Store later (accepting its SMS-policy constraints may require a notification-only build variant).
- **Pilot:** Bengaluru, 50–100 riders, recruited via gig-worker communities/unions. Fixture priority follows pilot platform mix. Feedback via WhatsApp group + in-app unparsed flow.

## 15. Success metrics

**Committed (v1 exit):** parse coverage ≥90% of earnings notifications from wave-1 platforms during the pilot — measured on-device and reported by pilot participants via the user-initiated "Share my stats" export (no telemetry). Definitions and formulas: [Instrumentation plan](./INSTRUMENTATION.md).

**Monitored (not gating):** share of pilot users opening the app ≥3 days/week; % of UPI credits auto-matched; # community-contributed notification samples; # external contributors.

## 16. Community & contribution

`CONTRIBUTING.md` with a "paste your notification" issue template; per-parser `SUPPORTED_VERSIONS.md` recording which platform-app versions fixtures came from; the in-app flag → anonymize → share-sheet flow (F5) as the non-developer contribution path; good-first-issue parser tasks as the developer on-ramp. The fixture corpus is the community's shared asset — parsers rot as platform apps update; the corpus is what keeps them alive.

## 17. Sustainability

**The app is forever free for workers** — stated in README line 1. Funding: digital-rights and worker-welfare grants under a fiscal sponsor. Later (explicitly not v1): an **optional** hosted layer (cloud backup, tax documents, Account Aggregator integration) that institutions might pay for — never required for the core app, which remains fully functional offline and free.

## 18. Phase plan — gates, not dates

| Phase | Scope | Exit gate |
|---|---|---|
| **0 — Scaffolding** | pnpm monorepo, TS/lint/CI, licenses, README privacy pledge, CONTRIBUTING | CI green on a trivial parser test; licenses and pledge in place |
| **1 — Parsers first, no UI** | `core` types; UPI/bank SMS parser; Swiggy, Zomato, Blinkit, Zepto parsers; CLI harness | All wave-1 parsers pass fixtures; CLI prints normalized JSON + coverage % |
| **2 — Capture pipeline** | Kotlin capture module; raw queue → parser → SQLite; unparsed queue UI stub | Live notifications on a test device land parsed in SQLite; nothing dropped |
| **3 — Dashboard MVP** | Home/net earnings, per-platform split, expenses, EN/HI/KN, honest onboarding | Maintainers self-track a full week accurately in all 3 languages |
| **4 — Pilot readiness** | Reconciliation, contribution share-sheet, export/delete, diagnostics, signed APK | ≥90% parse coverage across team devices; pilot kit ready → **launch Bengaluru pilot** |
| **5+ — Roadmap** | Wave 2–5 platforms, more languages, F-Droid, per-km/per-hour, COD tracking, Play Store, optional hosted layer | — |

## 19. Risks & mitigations

- **Platforms change notification formats** → fixture corpus + community contribution loop + parse-coverage CI; unparsed queue means data is never lost while parsers catch up.
- **Platforms reduce notification detail or retaliate** → app reads the worker's own device data (legally the worker's); AGPL + public repo makes suppression a reputational cost; manual-entry fallback on roadmap.
- **SMS permission scares users** → SMS is optional and skippable; app fully works notification-only; honest multilingual onboarding; open source as verifiable proof.
- **Android OEM battery killers (Xiaomi/Oppo/Vivo)** silently kill listeners → native-side queueing, re-bind logic, per-OEM setup guidance in onboarding; test matrix on cheap devices.
- **Parser maintenance outlives volunteer energy** → grants fund a maintainer; parsers stay small pure functions; contribution flow keeps sample supply cheap.
- **Play Store SMS policy** → not a v1 problem (sideload); notification-only build variant planned for Play.

## 20. Open questions

1. Which Bengaluru worker community/union partners anchor the pilot recruitment?
2. Fiscal sponsor selection and first grant applications — who drives this?
3. Fixture sourcing before pilot: which team/test devices run which platform apps?
4. Does Zepto's rider app expose enough in notifications, or is it aggressive about in-app-only updates? (Needs a spike — first real fixture-gathering task.)
