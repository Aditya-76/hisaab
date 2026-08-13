import { REGISTRY } from "@hisaab/parsers";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Db } from "../db/db.js";
import {
  type CaptureCounts,
  captureCounts,
  coverageByPlatform,
  type PlatformCoverage,
} from "../db/diagnostics.js";
import type { Theme } from "../ui/theme.js";
import { useTheme } from "../ui/theme.js";

/**
 * Diagnostics (F7, INSTRUMENTATION §3): the worker sees exactly what hisaab
 * measures about itself — counts and rates only, all local. "Share my
 * stats" (the only way any of this ever leaves the phone) ships in Phase 4.
 */
export interface DiagnosticsScreenProps {
  db: Db;
  refreshKey: number;
  onBack(): void;
}

/** package name → platform id, from the parser registry (single source). */
const PACKAGE_TO_PLATFORM: ReadonlyMap<string, string> = new Map(
  REGISTRY.flatMap((entry) => (entry.packageNames ?? []).map((p) => [p, entry.platform])),
);

export function DiagnosticsScreen({ db, refreshKey, onBack }: DiagnosticsScreenProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [counts, setCounts] = useState<CaptureCounts | null>(null);
  const [coverage, setCoverage] = useState<PlatformCoverage[]>([]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey deliberately re-runs the query after drains/saves
  useEffect(() => {
    let alive = true;
    (async () => {
      const [c, cov] = await Promise.all([
        captureCounts(db),
        coverageByPlatform(db, PACKAGE_TO_PLATFORM),
      ]);
      if (!alive) return;
      setCounts(c);
      setCoverage(cov);
    })();
    return () => {
      alive = false;
    };
  }, [db, refreshKey]);

  if (counts === null) return <View style={styles.container} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} accessibilityRole="button" style={styles.back}>
        <Text style={styles.backText}>← {t("common.back")}</Text>
      </Pressable>
      <Text style={styles.title}>{t("diagnostics.title")}</Text>
      <Text style={styles.localNote}>{t("diagnostics.localNote")}</Text>

      {counts.captured === 0 ? (
        <Text style={styles.empty}>{t("diagnostics.empty")}</Text>
      ) : (
        <>
          <Text style={styles.sectionTitle}>{t("diagnostics.coverage")}</Text>
          <View style={styles.card}>
            {coverage.map((row) => (
              <View key={row.platform} style={styles.row}>
                <Text style={styles.rowText}>
                  {t(`platforms.${row.platform}`, { defaultValue: row.platform })}
                </Text>
                <Text style={styles.rowMeta}>
                  {t("diagnostics.readOf", {
                    parsed: row.parsed,
                    total: row.parsed + row.unparsed,
                  })}
                </Text>
                <Text style={styles.rowValue}>
                  {row.coverage === null ? "—" : `${Math.round(row.coverage * 100)}%`}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>{t("diagnostics.counts")}</Text>
          <View style={styles.card}>
            <CountRow label={t("diagnostics.captured")} value={counts.captured} styles={styles} />
            <CountRow label={t("diagnostics.parsed")} value={counts.parsed} styles={styles} />
            <CountRow label={t("diagnostics.unparsed")} value={counts.unparsed} styles={styles} />
            <CountRow label={t("diagnostics.ignored")} value={counts.ignored} styles={styles} />
            <CountRow label={t("diagnostics.errors")} value={counts.errors} styles={styles} />
            <CountRow
              label={t("diagnostics.gapMarkers")}
              value={counts.gapMarkers}
              styles={styles}
            />
          </View>
        </>
      )}

      <Text style={styles.shareSoon}>{t("diagnostics.shareSoon")}</Text>
    </ScrollView>
  );
}

function CountRow({
  label,
  value,
  styles,
}: {
  label: string;
  value: number;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowText}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16, paddingBottom: 96 },
    back: { minHeight: 40, justifyContent: "center" },
    backText: { color: theme.primary, fontSize: 15, fontWeight: "600" },
    title: { fontSize: 20, fontWeight: "700", color: theme.text },
    localNote: { fontSize: 12, color: theme.subtext, marginTop: 4, marginBottom: 12 },
    empty: { color: theme.subtext, fontSize: 14, marginTop: 8 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.subtext,
      marginTop: 8,
      marginBottom: 6,
      textTransform: "uppercase",
    },
    card: {
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 44,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    rowText: { flex: 1, fontSize: 14, color: theme.text },
    rowMeta: { fontSize: 12, color: theme.subtext, marginRight: 10 },
    rowValue: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.text,
      fontVariant: ["tabular-nums"],
    },
    shareSoon: { fontSize: 12, color: theme.subtext, lineHeight: 18 },
  });
}
