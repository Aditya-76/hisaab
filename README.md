# hisaab

**Your data never leaves your phone. hisaab is forever free for workers.**

hisaab is a free, open-source, on-device earnings tracker for Indian gig workers. It reads your own order and payout notifications — and, only if you allow it, your bank/UPI credit SMS — locally on your Android phone, and shows your true net earnings across every platform you work for: per order, per day, per app.

- **v1 platforms:** Swiggy (food + Instamart), Zomato, Blinkit, Zepto — ride-hailing (Uber, Ola, Rapido, inDrive, Namma Yatri), logistics, and services platforms follow.
- **Languages:** English · हिन्दी · ಕನ್ನಡ (more coming — hisaab speaks the worker's language).
- **Privacy by architecture:** the app requests **no internet permission** — it cannot phone home even by accident. No account, no sign-in, no analytics. The code is public so anyone can verify.

## Development quickstart

The parsing engine (`packages/core`, `packages/parsers`, `packages/cli`) runs on plain Node — no Android toolchain needed:

```sh
pnpm install
pnpm build     # tsc --build (project references; doubles as the typecheck)
pnpm test      # vitest — every fixture in packages/parsers/fixtures must pass
pnpm lint      # biome ci .
node packages/cli/dist/index.js run-fixtures   # fixture pass table per platform
```

The easiest way to help: [contribute a notification sample](CONTRIBUTING.md) — no coding needed.

## Docs

| Doc | What's in it |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Problem, scope, platform waves, success metrics, phase plan |
| [docs/UX-DESIGN.md](docs/UX-DESIGN.md) | Flows, wireframes, edge cases, empty states |
| [docs/TECH-DESIGN.md](docs/TECH-DESIGN.md) | Architecture, data model, native capture, rollout |
| [docs/INSTRUMENTATION.md](docs/INSTRUMENTATION.md) | Privacy-preserving measurement ("Share my stats") |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Append-only log of every product/technical decision and why |

## Licensing

Parsers, core, and CLI: **Apache-2.0** (reusable by researchers, unions, and other worker tools). The app: **AGPL-3.0** (nobody can take it proprietary).

## Contributing

The parser fixture corpus is the community's shared asset — when platforms change their notification formats, contributed samples keep hisaab working for everyone. See `CONTRIBUTING.md` (coming with Phase 0) and the in-app "Help hisaab learn this" flow.
