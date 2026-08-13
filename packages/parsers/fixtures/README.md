# Parser fixture corpus

Every file is `{ "input": RawInput, "expected": NormalizedEvent | null | "ignored", "_meta": {...} }`:

- `expected` as an **event object** — the registry must parse the input to exactly this event (amounts in **integer paise**).
- `expected: null` — the input must land in the **unparsed** queue (unknown sender, or an allowlisted source in a format we don't understand yet).
- `expected: "ignored"` — known no-earnings chatter from an allowlisted source (marketing, OTPs, debits). The ignore list is fixture-tested here so it can never silently inflate parse coverage.

Naming: `<platform>/<type>.<lang>.<n>.json` (lang: `en`/`hi`/`kn`). Hindi and Kannada variants are first-class test cases (PRD §12).

## ⚠️ This corpus is currently SYNTHETIC

**No fixture in this directory is a real captured notification yet.** Each file is a representative format written from public knowledge to bootstrap the parsers, marked `"_meta": { "synthetic": true }`. Real anonymized captures (from maintainer devices during the Phase 2 spike, and from workers via the in-app "Help hisaab learn this" flow) replace these file-for-file. Treat every parser as unvalidated until its platform's `SUPPORTED_VERSIONS.md` lists a real app version.

To contribute a real sample, see [CONTRIBUTING.md](../../../CONTRIBUTING.md) — anonymize first (names, phones, addresses, IDs out; amounts and structure stay).
