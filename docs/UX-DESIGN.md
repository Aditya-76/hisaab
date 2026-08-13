# hisaab — UX / UI Design

**Status:** v1.0 (companion to [PRD](./PRD.md) — feature IDs F1–F7 reference PRD §7)
**Related docs:** [PRD](./PRD.md) · [Technical design](./TECH-DESIGN.md) · [Instrumentation plan](./INSTRUMENTATION.md)

## 1. Design principles

1. **Glanceable in sunlight, one-handed, on a ₹8,000 phone.** High contrast, large numbers, bottom-reachable actions, no animation-heavy UI. Target devices: 2–4GB RAM Androids, small/cracked screens, Android 9+.
2. **The number first.** Today's net earnings is the product. It is the biggest thing on the screen, visible within one second of app open, no spinner in front of it (data is local).
3. **Zero data entry required.** Everything auto-captures. Manual actions (expenses, contribution) are optional and never block the core value.
4. **Honesty is a UI feature.** Permission screens, data gaps, and unparsed notifications are shown plainly, never hidden. Trust is earned per screen.
5. **Language is identity.** EN / हिन्दी / ಕನ್ನಡ switchable everywhere, chosen first at onboarding. Hindi copy uses conversational Hinglish register ("Aaj ki kamai"), Kannada equivalent register ("ಇಂದಿನ ದುಡಿಮೆ").

## 2. Information architecture

Bottom tab bar (4 tabs) + one floating action button:

```
┌──────────────────────────────────────┐
│              (screen)                │
│                                      │
│                              [ + ]   │  ← FAB: Add expense (F4)
├──────────────────────────────────────┤
│  Home   Orders   Inbox(•)   Settings │
└──────────────────────────────────────┘
```

- **Home** — F1 dashboard (today/week net, platform split).
- **Orders** — full earnings history, filter by platform/date, drill-down to raw notification.
- **Inbox** — unparsed queue (F5) + reconciliation alerts (F3). Badge dot when non-empty.
- **Settings** — language, platforms, SMS toggle, export, delete-all, diagnostics (F7), about/licenses.

## 3. Key flows

### 3.1 First-run onboarding (F6)

```
[1 Language] → [2 What is hisaab] → [3 Privacy pledge] → [4 Notification access]
     → [5 SMS opt-in (skippable)] → [6 Pick your platforms] → [7 Home (empty state)]
```

1. **Language:** three large buttons — English / हिन्दी / ಕನ್ನಡ. No splash marketing before this; the user's first tap is choosing their language.
2. **What is hisaab:** one screen, one sentence + illustration. "All your apps. One hisaab. See what you really earned today."
3. **Privacy pledge:** plain-language, in their language: "hisaab reads earning notifications on *your* phone. Everything stays on *your* phone. No account. No internet. Free forever. The code is public — anyone can check." Link: "How do I verify this?" → short explainer with GitHub link (opens external browser; the app itself makes no network calls).
4. **Notification access:** explains *why* before the scary system screen: "To count your orders, hisaab needs to read notifications from Swiggy, Zomato, Blinkit, Zepto — and only those apps." Button deep-links to the system Notification Access settings page; on return, we detect grant state (see §5.2 for the denied path).
5. **SMS opt-in:** clearly marked **optional**. "Want hisaab to check that payouts actually reached your bank? Allow SMS reading. hisaab only looks at bank/UPI credit messages. You can skip this — hisaab works without it." Buttons: "Allow" / "Skip for now" (equal visual weight — skip is not a shame button).
6. **Pick your platforms:** grid of wave-1 platform logos, multi-select. Pre-informs the notification allowlist and keeps the dashboard uncluttered. "More platforms coming — hisaab is built by workers and coders together."
7. Land on Home in its empty state (§5.1).

Onboarding is re-enterable: every permission screen is reachable later from Settings.

### 3.2 Daily use (F1)

Open app → Home. No login, no sync spinner. Number is already there.

```
┌──────────────────────────────────────┐
│  Aaj ka hisaab        13 Aug ▾       │
│                                      │
│        ₹ 1,240                       │
│        net · 18 orders               │
│   ────────────────────────────       │
│   Swiggy      ₹520   9 orders        │
│   Zepto       ₹460   6 orders        │
│   Blinkit     ₹310   3 orders        │
│   Expenses   −₹150   fuel ₹150       │
│   ────────────────────────────       │
│   This week   ₹6,830  ▁▃▅▂▆▇▄        │
│                                      │
│   ⚠ 2 notifications not understood → │
│                              [ + ]   │
├──────────────────────────────────────┤
│  Home   Orders   Inbox(•)   Settings │
└──────────────────────────────────────┘
```

- Date switcher: today ▾ → yesterday, this week, custom range.
- Tapping a platform row → Orders filtered to that platform/day.
- The "not understood" banner appears only when the unparsed queue is non-empty; tapping opens Inbox.

### 3.3 Add expense (F4)

FAB → bottom sheet. Two taps + amount:

```
┌──────────────────────────────────────┐
│  Kharcha add karo                    │
│  [⛽ Fuel] [📱 Recharge] [🏍 Rent] [⋯] │
│                                      │
│  ₹ [____]                            │
│  Recent: ₹100  ₹150  ₹200            │
│                                      │
│            [ Save ]                  │
└──────────────────────────────────────┘
```

Category chip → amount (numeric keypad, recent-amount shortcuts) → Save. Defaults to now; date editable. Note field optional and collapsed.

### 3.4 Unparsed → contribute (F5)

Inbox lists unrecognized notifications grouped by platform guess:

```
Inbox
─ Not understood (2)
   Swiggy? · 7:42 pm · "You have a new..."   →
   Unknown · 1:15 pm · "₹120 added to..."     →
─ Payout alerts (1)
   Zomato payout ₹2,140 expected, ₹1,980 received →
```

Detail screen: full raw text → button **"Help hisaab learn this"** → anonymization preview showing exactly what will be shared, before/after:

```
Will share:            Will NOT share:
"Order delivered!      your name ✗
 You earned ₹42 …"     phone number ✗
platform: Swiggy       addresses ✗
app version: 4.2.1     order ID ✗
```

→ Android share sheet (worker sends via WhatsApp/Telegram to the maintainer group, or "Open GitHub" for developers). Item is marked contributed; it stays in local history.

### 3.5 Reconciliation (F3)

Inbox "Payout alerts" section + per-platform payout screen:

```
Zomato · this week's payout
Promised (from app)     ₹2,140
Received (bank SMS)     ₹1,980   ✓ matched HDFC …4471
Gap                     −₹160    [What's this?]
```

"What's this?" explains honestly: gap may be platform deductions (penalties, gear, insurance) or a parsing miss — with a "raw messages" drill-down so the worker can judge. hisaab states facts, never accuses.

If SMS was skipped: this screen shows a locked state — "Payout checking needs SMS access. Your bank credit messages stay on your phone. [Enable] [Not now]".

### 3.6 Settings

Language · My platforms (edit allowlist) · SMS reading (on/off with the same honest copy) · Export my data (CSV/JSON via share sheet/file save) · Diagnostics & Share my stats (F7, see [Instrumentation](./INSTRUMENTATION.md)) · Delete everything (type-to-confirm, irreversible, instant) · About (version, licenses, GitHub link, privacy pledge).

### 3.7 OEM battery-killer setup

After onboarding, on known-aggressive OEMs (Xiaomi/MIUI, Oppo/ColorOS, Vivo/FuntouchOS, Realme, OnePlus): one extra guided screen — "Your phone may stop hisaab from counting orders. 2 quick settings fix this." with per-OEM illustrated steps (autostart permission, battery no-restriction) and a "Test it" check (see Tech design §5.4). Re-shown as a Home banner if we later detect a listener gap.

## 4. Edge cases

| # | Case | Behavior |
|---|---|---|
| E1 | Duplicate notifications (platform re-posts/updates the same order notification) | Dedupe on (platform, externalId) when parsed, else (platform, amount, ±90s window). Never double-count; keep both raw events. |
| E2 | Notification arrives while listener was dead (OEM kill, reboot) | On listener rebind, log a **gap marker**. Home shows: "hisaab may have missed orders between 2:10–4:35 pm" with link to OEM fix flow (§3.7). Never silently show a wrong total. |
| E3 | Order correction (platform revises earning: cancelled order, adjusted payout) | Later notification with same externalId supersedes; history shows the revision trail, not just the final number. |
| E4 | Negative events (penalty, deduction, COD adjustment) | Parsed as negative-amount `Earning` adjustments, shown in red in the order list, included in net. |
| E5 | Shift crosses midnight | A "day" is the calendar day (Asia/Kolkata) of the earning event. Week view absorbs the boundary; no shift logic in v1 (roadmap: work-hours tracking). |
| E6 | Same UPI credit could match two platforms' payouts | Reconciliation marks it "needs your confirmation" with a one-tap chooser, rather than guessing (see Tech design §7). |
| E7 | Platform app update changes notification format | Parse coverage drops → unparsed items accumulate → Inbox groups them: "Swiggy changed something? 14 new notifications not understood. Help hisaab learn →". This turns parser rot into a contribution moment. |
| E8 | Mixed-language notifications (Hindi text from platform while UI is Kannada) | Parsers handle language variants via fixtures; UI renders raw text as-is in drill-downs. |
| E9 | Multiple bank accounts / UPI apps | All credit sources parsed independently; reconciliation matches across all of them. |
| E10 | Storage pressure | SQLite with raw-text retention policy: raw text of *parsed* events prunable after 90 days (setting), normalized data kept forever. Unparsed raw kept until contributed or dismissed. |
| E11 | Phone change / reinstall | v1 answer: export → manual import (JSON). Stated honestly in Settings ("hisaab has no cloud — your data is only here"). Auto-backup is disabled to keep the on-device pledge (Tech design §8). |
| E12 | Notification access revoked mid-use | Persistent (non-dismissable) Home banner: "hisaab can't see new orders. [Fix]". Existing data untouched. |
| E13 | Worker uninstalls a platform app / stops working for it | Platform stays in history; hidden from empty dashboards after 30 inactive days; removable in Settings → My platforms. |
| E14 | Clock skew / manual date change | Events timestamped by notification postTime; aggregation trusts stored timestamps; a sanity check flags events "in the future". |

## 5. Empty, denied, and error states

### 5.1 Empty states (all illustrated, all in the worker's language)

- **Home, first run:** "Go online. Deliver. hisaab will do the hisaab. 📈 Your orders will appear here automatically — nothing to type." If notification access granted <1 hour ago, add: "Counting starts now — earlier orders can't be read."
- **Home, zero-earnings day:** show ₹0 with warmth, not blankness: "Chutti ka din? Kal phir milte hain." Week strip still visible for context.
- **Orders, filtered to empty:** "No orders from Zepto this day."
- **Inbox, empty:** "All clear — hisaab understood everything. 💪"
- **Reconciliation, no SMS permission:** locked state per §3.5.
- **Diagnostics, no data yet:** "Stats appear after your first day of orders."

### 5.2 Permission-denied paths

- **Notification access declined at onboarding:** app does not dead-end. Home renders in "demo state" with sample data watermarked "EXAMPLE", plus one clear card: "hisaab needs notification access to start counting. [Grant access]". Nothing else nags.
- **SMS declined:** zero nagging. The only reminder surface is the reconciliation locked state, plus the Settings toggle.
- **Notification access granted but OEM kills the listener:** E2 gap markers + §3.7 banner.

### 5.3 Error states

- **Parser crash on an event:** caught per-event; event goes to unparsed queue tagged "parse error" (never crashes the app; never lost).
- **DB migration failure on update:** app boots into a safe screen offering "Export raw data" before any retry — data safety over feature availability.
- **Export failure (no storage/share target):** actionable message, retry.

## 6. Visual language

- **Type & numerals:** system font stack; tabular numerals for amounts; ₹ always with the amount, Indian digit grouping (₹1,23,456).
- **Color:** earnings green / expense & gap red only as accents on a neutral high-contrast base; must pass WCAG AA in sunlight-ish conditions (target contrast ≥ 7:1 for the hero number). Full palette defined at implementation, light + dark themes from day one (many riders work nights — dark mode is a courtesy, OLED battery saver).
- **Touch targets:** ≥48dp; FAB and tab bar within thumb reach.
- **Motion:** none required for meaning; subtle count-up on the hero number only, disabled with system "remove animations".

## 7. Accessibility & localization mechanics

- Font scaling honored to 200% without truncating the hero number (layout reflows, never ellipsizes amounts).
- TalkBack: all amounts labeled with platform + date context ("Swiggy, five hundred twenty rupees, nine orders, today").
- All strings externalized day one (i18next JSON per locale); no concatenated sentences (word order differs across EN/HI/KN); ICU plurals.
- Numbers/dates localized via standard i18n formatting (Devanagari/Kannada numerals **not** used — workers universally read Arabic numerals for money).

## 8. Copy tone guide

- Warm, direct, worker-to-worker. Never corporate ("Your request has been processed"), never patronizing.
- Hindi = Hinglish register: "Aaj ki kamai", "Kharcha", "Sab clear!". Kannada = equivalent conversational register.
- Money facts are stated neutrally; hisaab never editorializes about platforms ("gap −₹160" + explain possible causes, not "Zomato cheated you").
- Every scary moment (permissions, delete-all, share) gets a plain-language explanation *before* the action, in the user's language.
