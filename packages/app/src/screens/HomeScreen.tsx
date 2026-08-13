import { type DaySummary, formatPaise, istWeekDays, type PlatformSummary } from "@hisaab/core";
import type { TFunction } from "i18next";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { daySummary, platformSplit, weekStrip } from "../db/dashboard.js";
import type { Db } from "../db/db.js";
import { istTodayKey, previousDayKey } from "../ui/format.js";
import type { Theme } from "../ui/theme.js";
import { useTheme } from "../ui/theme.js";

/**
 * F1 dashboard (UX §3.2): the number first — today's net is the biggest
 * thing on screen, rendered from local SQLite with no spinner in front of
 * it. Date switcher v1 is today/yesterday; the week strip carries context.
 */
export interface HomeScreenProps {
  db: Db;
  /** Bumped by the shell after drains/expense saves to requery. */
  refreshKey: number;
  unparsedCount: number;
  notificationAccess: boolean | null;
  onOpenInbox(): void;
  onFixAccess(): void;
  onOpenPlatform(platform: string, day: string): void;
}

interface HomeData {
  day: DaySummary;
  platforms: PlatformSummary[];
  week: DaySummary[];
  hasAnyEarnings: boolean;
}

export function HomeScreen({
  db,
  refreshKey,
  unparsedCount,
  notificationAccess,
  onOpenInbox,
  onFixAccess,
  onOpenPlatform,
}: HomeScreenProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const todayKey = istTodayKey(Date.now());
  const [dayKey, setDayKey] = useState(todayKey);
  const [data, setData] = useState<HomeData | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey deliberately re-runs the query after drains/saves
  useEffect(() => {
    let alive = true;
    (async () => {
      const nowIso = new Date().toISOString();
      const [day, platforms, week, anyRow] = await Promise.all([
        daySummary(db, dayKey),
        platformSplit(db, dayKey),
        weekStrip(db, istWeekDays(nowIso)),
        db.execute("SELECT 1 AS one FROM earnings LIMIT 1"),
      ]);
      if (!alive) return;
      setData({ day, platforms, week, hasAnyEarnings: anyRow.rows.length > 0 });
    })();
    return () => {
      alive = false;
    };
  }, [db, dayKey, refreshKey]);

  if (data === null) return <View style={styles.container} />;

  const { day, platforms, week, hasAnyEarnings } = data;
  const weekNet = week.reduce((sum, d) => sum + d.netPaise, 0);
  const isToday = dayKey === todayKey;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("home.title")}</Text>
        <View style={styles.dayToggle}>
          <DayChip
            label={t("home.today")}
            active={isToday}
            onPress={() => setDayKey(todayKey)}
            theme={theme}
          />
          <DayChip
            label={t("home.yesterday")}
            active={!isToday}
            onPress={() => setDayKey(previousDayKey(todayKey))}
            theme={theme}
          />
        </View>
      </View>

      {notificationAccess === false && (
        <Pressable
          style={styles.warnBanner}
          onPress={onFixAccess}
          accessibilityRole="button"
          accessibilityLabel={t("home.accessRevoked")}
        >
          <Text style={styles.warnText}>
            {t("home.accessRevoked")} <Text style={styles.warnAction}>{t("home.fix")}</Text>
          </Text>
        </Pressable>
      )}

      <View style={styles.hero} accessible accessibilityLabel={heroA11y(t, day)}>
        <Text style={styles.heroAmount}>{formatPaise(day.netPaise)}</Text>
        <Text style={styles.heroSub}>{t("home.netOrders", { count: day.earningCount })}</Text>
      </View>

      {!hasAnyEarnings && (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>{t("home.emptyFirstRunTitle")}</Text>
          <Text style={styles.emptyBody}>{t("home.emptyFirstRunBody")}</Text>
        </View>
      )}
      {hasAnyEarnings && day.earningCount === 0 && day.expensesPaise === 0 && (
        <Text style={styles.zeroDay}>{t("home.zeroDay")}</Text>
      )}

      {(platforms.length > 0 || day.expensesPaise > 0) && (
        <View style={styles.card}>
          {platforms.map((p) => (
            <Pressable
              key={p.platform}
              style={styles.row}
              onPress={() => onOpenPlatform(p.platform, dayKey)}
              accessibilityRole="button"
              accessibilityLabel={`${platformName(t, p.platform)}, ${formatPaise(p.netPaise)}, ${t(
                "home.orderCount",
                { count: p.earningCount },
              )}`}
            >
              <Text style={styles.rowName}>{platformName(t, p.platform)}</Text>
              <Text style={[styles.rowAmount, p.netPaise < 0 && styles.negative]}>
                {formatPaise(p.netPaise)}
              </Text>
              <Text style={styles.rowMeta}>{t("home.orderCount", { count: p.earningCount })}</Text>
            </Pressable>
          ))}
          {day.expensesPaise > 0 && (
            <View style={styles.row}>
              <Text style={styles.rowName}>{t("home.expenses")}</Text>
              <Text style={[styles.rowAmount, styles.negative]}>
                −{formatPaise(day.expensesPaise)}
              </Text>
              <Text style={styles.rowMeta} />
            </View>
          )}
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.weekHeader}>
          <Text style={styles.rowName}>{t("home.thisWeek")}</Text>
          <Text style={styles.rowAmount}>{formatPaise(weekNet)}</Text>
        </View>
        <WeekStripBars week={week} theme={theme} />
      </View>

      {unparsedCount > 0 && (
        <Pressable
          style={styles.warnBanner}
          onPress={onOpenInbox}
          accessibilityRole="button"
          accessibilityLabel={t("home.unparsedBanner", { count: unparsedCount })}
        >
          <Text style={styles.warnText}>
            ⚠ {t("home.unparsedBanner", { count: unparsedCount })} →
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function heroA11y(t: TFunction, day: DaySummary): string {
  return `${formatPaise(day.netPaise)}, ${t("home.netOrders", { count: day.earningCount })}`;
}

function platformName(t: TFunction, platform: string): string {
  return t(`platforms.${platform}`, { defaultValue: platform });
}

function DayChip({
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
        chipStyles.chip,
        { borderColor: theme.border },
        active && { backgroundColor: theme.primary, borderColor: theme.primary },
      ]}
    >
      <Text style={{ color: active ? theme.primaryText : theme.text, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const BAR_MAX_HEIGHT = 36;

function WeekStripBars({ week, theme }: { week: DaySummary[]; theme: Theme }) {
  const { t } = useTranslation();
  const max = Math.max(...week.map((d) => d.netPaise), 1);
  return (
    <View style={chipStyles.strip}>
      {week.map((d, i) => (
        <View key={d.day} style={chipStyles.stripDay}>
          <View
            style={{
              height: Math.max(2, Math.round((Math.max(d.netPaise, 0) / max) * BAR_MAX_HEIGHT)),
              backgroundColor: d.netPaise > 0 ? theme.green : theme.border,
              width: 16,
              borderRadius: 3,
            }}
          />
          <Text style={{ fontSize: 10, color: theme.subtext, marginTop: 2 }}>
            {t(`weekdaysShort.${i}`)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
    minHeight: 32,
    justifyContent: "center",
  },
  strip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 8,
  },
  stripDay: { alignItems: "center", height: BAR_MAX_HEIGHT + 16, justifyContent: "flex-end" },
});

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16, paddingBottom: 96 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    title: { fontSize: 20, fontWeight: "700", color: theme.text },
    dayToggle: { flexDirection: "row" },
    hero: { alignItems: "center", marginVertical: 20 },
    heroAmount: {
      fontSize: 52,
      fontWeight: "800",
      color: theme.text,
      fontVariant: ["tabular-nums"],
    },
    heroSub: { fontSize: 15, color: theme.subtext, marginTop: 2 },
    card: {
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 48,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    weekHeader: { flexDirection: "row", alignItems: "center" },
    rowName: { flex: 1, fontSize: 15, color: theme.text },
    rowAmount: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.text,
      fontVariant: ["tabular-nums"],
    },
    rowMeta: { fontSize: 12, color: theme.subtext, width: 84, textAlign: "right" },
    negative: { color: theme.red },
    zeroDay: { textAlign: "center", color: theme.subtext, marginBottom: 12, fontSize: 14 },
    emptyTitle: { fontSize: 15, fontWeight: "600", color: theme.text, marginBottom: 4 },
    emptyBody: { fontSize: 13, color: theme.subtext, lineHeight: 19 },
    warnBanner: {
      backgroundColor: theme.warnBg,
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
      minHeight: 48,
      justifyContent: "center",
    },
    warnText: { color: theme.warnText, fontSize: 13 },
    warnAction: { fontWeight: "700" },
  });
}
