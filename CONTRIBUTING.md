# Contributing to hisaab

Thank you for helping build hisaab — a free, open-source, on-device earnings tracker for Indian gig workers. **Data never leaves the phone; the app is forever free for workers.** Every contribution, from a pasted notification to a new parser, keeps it working.

There are two ways to contribute, and the first one needs no coding at all.

## 1. Contribute a notification sample (no coding needed)

Parsers rot: platforms change their notification wording, and hisaab stops understanding them. The fix is always a real sample. If hisaab misreads or misses one of your notifications — or you work for a platform hisaab doesn't support yet — paste it using the template below in a [new issue](../../issues/new?template=notification-sample.yml), or share it via the in-app **"Help hisaab learn this"** flow.

### Paste your notification — template

```
Platform / app:        (e.g. Swiggy Delivery, Zomato rider, HDFC bank SMS)
App version:           (Settings → About in the platform app, if you can find it; "don't know" is fine)
Language of the text:  (English / Hindi / Kannada / mixed / other)
Notification title:    (exactly as shown)
Notification text:     (full text, anonymized — see below)
When it arrived:       (approx date and time, e.g. "12 Aug, around 7:40 pm")
What it meant:         (e.g. "I delivered an order and earned ₹42 including ₹10 tip")
```

**Anonymize before pasting** — replace, don't delete:

- your name and any customer name → `<NAME>`
- phone numbers → `<PHONE>`
- addresses and localities → `<ADDRESS>`
- order/trip/reference IDs → `<ID>`
- vehicle numbers → `<VEHICLE>`
- bank account fragments beyond the bank's own masking (`XX1234` is fine to keep) → `<ACCT>`

**Keep** the amounts (₹), the sentence structure, and the exact wording — that is what parsers need. If in doubt, the in-app flow shows a preview of exactly what will be shared.

## 2. Contribute code

### Setup

```sh
pnpm install
pnpm build        # tsc --build (project references; also the typecheck)
pnpm test         # vitest
pnpm lint         # biome ci .
```

Node ≥ 20 and pnpm (see `packageManager` in package.json). `packages/core`, `packages/parsers`, and `packages/cli` run on plain Node — no Android toolchain needed for parser work.

### Ground rules (from [CLAUDE.md](CLAUDE.md) and [docs/](docs/))

- **Parsers are pure functions.** `(input: RawInput) => NormalizedEvent | null`. No I/O, no `Date.now()`, no locale access — everything comes in via the input.
- **Every parser change ships with fixtures.** Fixtures are anonymized real samples in `packages/parsers/fixtures/<platform>/<type>.<lang>.<n>.json`. A parser PR without fixtures will be asked to add them.
- **Money is integer paise.** Never floats in money paths.
- **No `any`** in `parsers` or `core`. TypeScript strict throughout.
- **Dependencies must be OSI-licensed** — CI runs a license audit and fails otherwise.
- **Zero React Native** in `core`/`parsers`/`cli` — CI enforces the boundary.
- **Decision log:** any change to scope, architecture, privacy posture, licensing, or money handling gets a new entry in [docs/DECISIONS.md](docs/DECISIONS.md) (append-only) in the same PR. Check the log before re-opening a settled question.

### Commits and PRs

- [Conventional commits](https://www.conventionalcommits.org/): `feat(parsers): …`, `fix(core): …`, `docs: …`, `chore(ci): …`.
- CI must be green: lint → typecheck/build → tests → fixture run → license audit → dependency boundaries.
- Good first issues: adding a language variant to an existing parser, or turning a contributed notification sample into a fixture + parser tweak.

### Adding or fixing a parser

1. Add the fixture first: `packages/parsers/fixtures/<platform>/<type>.<lang>.<n>.json` with `{ "input": RawInput, "expected": NormalizedEvent | null | "ignored" }`.
2. Run `pnpm test` — the fixture harness picks it up automatically and fails.
3. Write or fix the parser (one file per notification type in `packages/parsers/src/<platform>/`).
4. Update the platform's `SUPPORTED_VERSIONS.md` with the app version the sample came from.
5. `pnpm build && pnpm test && pnpm lint` — all green → open the PR.

## Licensing of contributions

Contributions to `packages/core`, `packages/parsers`, and `packages/cli` are accepted under **Apache-2.0**; contributions to `packages/app` and the repo root under **AGPL-3.0**. By contributing you agree your contribution is licensed accordingly.
