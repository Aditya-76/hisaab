# Anonymizer fixtures

Each `*.json` file is `{ "input": string, "expected": string }` — the raw text
a worker might share, and exactly what the anonymizer must turn it into.
Amounts (₹) are always preserved; names, phone numbers, VPAs, addresses,
order/vehicle IDs are replaced with `<TOKEN>` placeholders. Bank-masked
account fragments (`XX1234`) are kept as-is — the bank already masked them.

Naming: `<what>.<lang>.<n>.json` (lang: en/hi/kn). These fixtures define the
anonymizer's contract; change behavior by adding/adjusting fixtures in the
same PR as the code change.
