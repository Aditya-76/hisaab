/** Plain-text and GitHub-markdown renderers for CLI reports. */

export function renderTable(
  header: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const all = [header, ...rows];
  const widths = header.map((_, col) => Math.max(...all.map((r) => (r[col] ?? "").length)));
  const line = (r: readonly string[]) =>
    r.map((cell, col) => (cell ?? "").padEnd(widths[col] as number)).join("  ");
  const separator = widths.map((w) => "-".repeat(w)).join("  ");
  return [line(header), separator, ...rows.map(line)].join("\n");
}

export function renderMarkdownTable(
  header: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const row = (r: readonly string[]) => `| ${r.join(" | ")} |`;
  return [row(header), row(header.map(() => "---")), ...rows.map(row)].join("\n");
}

export function formatRate(rate: number | null): string {
  return rate === null ? "n/a" : `${(rate * 100).toFixed(1)}%`;
}
