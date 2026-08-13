import { formatPaise } from "@hisaab/core";
import type { TFunction } from "i18next";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { type EarningListItem, listEarnings } from "../db/dashboard.js";
import type { Db } from "../db/db.js";
import { dayParts, istClock } from "../ui/format.js";
import type { Theme } from "../ui/theme.js";
import { useTheme } from "../ui/theme.js";

/**
 * Orders tab (UX §2): earnings history newest first with platform filter
 * chips. Day headers group rows; penalties render red (UX E4). Drill-down
 * to the raw notification comes with the contribute flow (Phase 4).
 */
export interface OrdersScreenProps {
  db: Db;
  refreshKey: number;
  /** Preselected platform filter (tap-through from Home), if any. */
  initialPlatform: string | null;
}

const LIST_LIMIT = 300;

export function OrdersScreen({ db, refreshKey, initialPlatform }: OrdersScreenProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [platform, setPlatform] = useState<string | null>(initialPlatform);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [items, setItems] = useState<EarningListItem[] | null>(null);

  useEffect(() => setPlatform(initialPlatform), [initialPlatform]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey deliberately re-runs the query after drains/saves
  useEffect(() => {
    let alive = true;
    (async () => {
      const [list, platformRows] = await Promise.all([
        listEarnings(db, {
          limit: LIST_LIMIT,
          ...(platform !== null ? { platform } : {}),
        }),
        db.execute(
          "SELECT DISTINCT platform FROM earnings WHERE superseded_by IS NULL ORDER BY platform",
        ),
      ]);
      if (!alive) return;
      setItems(list);
      setPlatforms(platformRows.rows.map((r) => String(r.platform)));
    })();
    return () => {
      alive = false;
    };
  }, [db, platform, refreshKey]);

  if (items === null) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("orders.title")}</Text>
      {platforms.length > 0 && (
        <View style={styles.chips}>
          <FilterChip
            label={t("orders.all")}
            active={platform === null}
            onPress={() => setPlatform(null)}
            theme={theme}
          />
          {platforms.map((p) => (
            <FilterChip
              key={p}
              label={t(`platforms.${p}`, { defaultValue: p })}
              active={platform === p}
              onPress={() => setPlatform(p)}
              theme={theme}
            />
          ))}
        </View>
      )}
      {items.length === 0 ? (
        <Text style={styles.empty}>
          {platform === null
            ? t("orders.empty")
            : t("orders.emptyPlatform", {
                platform: t(`platforms.${platform}`, { defaultValue: platform }),
              })}
        </Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => (
            <>
              {(index === 0 || items[index - 1]?.day !== item.day) && (
                <Text style={styles.dayHeader}>{dayLabel(t, item.day)}</Text>
              )}
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowName}>
                    {t(`platforms.${item.platform}`, { defaultValue: item.platform })}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {timeLabel(t, item.occurredAt)}
                    {item.kind === "adjustment" ? ` · ${t("orders.adjustment")}` : ""}
                    {item.tipsPaise !== null && item.tipsPaise > 0
                      ? ` · ${t("orders.tip", { amount: formatPaise(item.tipsPaise) })}`
                      : ""}
                  </Text>
                </View>
                <Text style={[styles.rowAmount, item.netPaise < 0 && styles.negative]}>
                  {formatPaise(item.netPaise)}
                </Text>
              </View>
            </>
          )}
        />
      )}
    </View>
  );
}

function dayLabel(t: TFunction, day: string): string {
  const parts = dayParts(day);
  return `${parts.dayOfMonth} ${t(`monthsShort.${parts.monthIndex}`)}`;
}

function timeLabel(t: TFunction, iso: string): string {
  const clock = istClock(iso);
  return `${clock.hour}:${clock.minute} ${t(`time.${clock.period}`)}`;
}

function FilterChip({
  label,
  active,
  onPress,
  theme,
}: {
  label: string;
  active: boolean;
  onPress(): void;
  theme: Theme;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        filterStyles.chip,
        { borderColor: theme.border },
        active && { backgroundColor: theme.primary, borderColor: theme.primary },
      ]}
    >
      <Text style={{ color: active ? theme.primaryText : theme.text, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const filterStyles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    minHeight: 32,
    justifyContent: "center",
    marginRight: 8,
    marginBottom: 8,
  },
});

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg, padding: 16 },
    title: { fontSize: 20, fontWeight: "700", color: theme.text, marginBottom: 12 },
    chips: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
    empty: { color: theme.subtext, fontSize: 14, marginTop: 12 },
    dayHeader: { color: theme.subtext, fontSize: 12, fontWeight: "600", marginTop: 12 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 52,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    rowLeft: { flex: 1 },
    rowName: { fontSize: 15, color: theme.text },
    rowMeta: { fontSize: 12, color: theme.subtext, marginTop: 1 },
    rowAmount: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.text,
      fontVariant: ["tabular-nums"],
    },
    negative: { color: theme.red },
  });
}
