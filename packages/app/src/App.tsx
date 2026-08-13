import type { Expense } from "@hisaab/core";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { type CaptureStatus, captureModule } from "./capture/capture-module.js";
import type { Db } from "./db/db.js";
import { DIAGNOSTICS_RETENTION_DAYS, logDiagnostic, pruneDiagnostics } from "./db/diagnostics.js";
import { addExpense, recentExpenseAmounts } from "./db/expenses.js";
import { migrate } from "./db/migrations.js";
import { openAppDb } from "./db/open.js";
import { countUnparsed, listUnparsed, type UnparsedListItem } from "./db/raw-events.js";
import { getSetting, SETTING_KEYS, setSetting } from "./db/settings.js";
import { initI18n } from "./i18n/index.js";
import { drainRawEvents } from "./pipeline/drainer.js";
import { AddExpenseSheet } from "./screens/AddExpenseSheet.js";
import { DiagnosticsScreen } from "./screens/DiagnosticsScreen.js";
import { HomeScreen } from "./screens/HomeScreen.js";
import { OrdersScreen } from "./screens/OrdersScreen.js";
import { SettingsScreen } from "./screens/SettingsScreen.js";
import { UnparsedQueueScreen } from "./screens/UnparsedQueueScreen.js";
import { useTheme } from "./ui/theme.js";

const i18n = initI18n();

type Tab = "home" | "orders" | "inbox" | "settings";

const DAY_MS = 86_400_000;

/**
 * Phase 3 shell (UX §2): bottom tabs + FAB over local SQLite. Boot is
 * migrate → language → drain → render; the number is on screen with no
 * network and no spinner in front of it (data is local).
 */
export default function App() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [db, setDb] = useState<Db | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [language, setLanguage] = useState("en");
  const [status, setStatus] = useState<CaptureStatus | null>(null);
  const [unparsedCount, setUnparsedCount] = useState(0);
  const [unparsedItems, setUnparsedItems] = useState<UnparsedListItem[]>([]);
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [recentAmounts, setRecentAmounts] = useState<number[]>([]);
  const [ordersPlatform, setOrdersPlatform] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (database: Db) => {
    await drainRawEvents(database);
    setUnparsedCount(await countUnparsed(database));
    setUnparsedItems(await listUnparsed(database, 50));
    try {
      setStatus(await captureModule().getCaptureStatus());
    } catch {
      // Native module absent (e.g. Metro without the Android build) —
      // capture status is simply unknown; the UI shows nothing scary.
      setStatus(null);
    }
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const database = openAppDb();
        await migrate(database);
        const savedLanguage = await getSetting(database, SETTING_KEYS.language);
        if (savedLanguage !== null) {
          await i18n.changeLanguage(savedLanguage);
          setLanguage(savedLanguage);
        }
        const now = new Date();
        await logDiagnostic(database, "app.open", now.toISOString());
        await pruneDiagnostics(
          database,
          new Date(now.getTime() - DIAGNOSTICS_RETENTION_DAYS * DAY_MS).toISOString(),
        );
        setDb(database);
        await refresh(database);
      } catch (e) {
        // Migration failure path = safe-mode screen; raw export before any
        // retry (UX §5.3) — export lands with Phase 4.
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [refresh]);

  const changeLanguage = useCallback(
    async (lng: "en" | "hi" | "kn") => {
      if (db === null || lng === language) return;
      await setSetting(db, SETTING_KEYS.language, lng);
      await logDiagnostic(db, "settings.language_changed", new Date().toISOString(), {
        from: language,
        to: lng,
      });
      await i18n.changeLanguage(lng);
      setLanguage(lng);
    },
    [db, language],
  );

  const openExpenseSheet = useCallback(async () => {
    if (db === null) return;
    setRecentAmounts(await recentExpenseAmounts(db, 3));
    setExpenseSheetOpen(true);
  }, [db]);

  const saveExpense = useCallback(
    async (expense: Expense) => {
      if (db === null) return;
      await addExpense(db, expense);
      await logDiagnostic(db, "expense.added", expense.timestamp, {
        category: expense.category,
      });
      setExpenseSheetOpen(false);
      await refresh(db);
    },
    [db, refresh],
  );

  const openNotificationSettings = useCallback(() => {
    try {
      captureModule().openNotificationAccessSettings();
    } catch {
      // Without the native module there is no settings page to open.
    }
  }, []);

  const styles = makeStyles(theme);

  if (error !== null) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.safeModeTitle}>{t("safeMode.title")}</Text>
        <Text style={styles.safeModeBody}>{t("safeMode.body")}</Text>
        <Text style={styles.safeModeError}>{error}</Text>
      </SafeAreaView>
    );
  }

  if (db === null) return <SafeAreaView style={styles.container} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>
        {tab === "home" && (
          <HomeScreen
            db={db}
            refreshKey={refreshKey}
            unparsedCount={unparsedCount}
            notificationAccess={status === null ? null : status.notificationAccess}
            onOpenInbox={() => setTab("inbox")}
            onFixAccess={openNotificationSettings}
            onOpenPlatform={(platform) => {
              setOrdersPlatform(platform);
              setTab("orders");
            }}
          />
        )}
        {tab === "orders" && (
          <OrdersScreen db={db} refreshKey={refreshKey} initialPlatform={ordersPlatform} />
        )}
        {tab === "inbox" && <UnparsedQueueScreen items={unparsedItems} />}
        {tab === "settings" &&
          (diagnosticsOpen ? (
            <DiagnosticsScreen
              db={db}
              refreshKey={refreshKey}
              onBack={() => setDiagnosticsOpen(false)}
            />
          ) : (
            <SettingsScreen
              language={language}
              onChangeLanguage={(lng) => void changeLanguage(lng)}
              notificationAccess={status === null ? null : status.notificationAccess}
              onOpenNotificationSettings={openNotificationSettings}
              onOpenDiagnostics={() => setDiagnosticsOpen(true)}
            />
          ))}
      </View>

      {(tab === "home" || tab === "orders") && (
        <Pressable
          style={styles.fab}
          onPress={() => void openExpenseSheet()}
          accessibilityRole="button"
          accessibilityLabel={t("expense.title")}
        >
          <Text style={styles.fabText}>＋</Text>
        </Pressable>
      )}

      <View style={styles.tabBar}>
        <TabButton
          label={t("tabs.home")}
          active={tab === "home"}
          onPress={() => setTab("home")}
          styles={styles}
        />
        <TabButton
          label={t("tabs.orders")}
          active={tab === "orders"}
          onPress={() => {
            setOrdersPlatform(null);
            setTab("orders");
          }}
          styles={styles}
        />
        <TabButton
          label={t("tabs.inbox")}
          active={tab === "inbox"}
          badge={unparsedCount > 0}
          onPress={() => setTab("inbox")}
          styles={styles}
        />
        <TabButton
          label={t("tabs.settings")}
          active={tab === "settings"}
          onPress={() => setTab("settings")}
          styles={styles}
        />
      </View>

      <AddExpenseSheet
        visible={expenseSheetOpen}
        recentAmountsPaise={recentAmounts}
        onSave={(expense) => void saveExpense(expense)}
        onClose={() => setExpenseSheetOpen(false)}
      />
    </SafeAreaView>
  );
}

function TabButton({
  label,
  active,
  badge = false,
  onPress,
  styles,
}: {
  label: string;
  active: boolean;
  badge?: boolean;
  onPress(): void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      style={styles.tabButton}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {label}
        {badge && <Text style={styles.badge}> •</Text>}
      </Text>
    </Pressable>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    screen: { flex: 1 },
    tabBar: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.bg,
    },
    tabButton: { flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center" },
    tabLabel: { fontSize: 13, color: theme.subtext },
    tabLabelActive: { color: theme.primary, fontWeight: "700" },
    badge: { color: theme.red, fontSize: 16 },
    fab: {
      position: "absolute",
      right: 20,
      bottom: 72,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      elevation: 4,
    },
    fabText: { color: theme.primaryText, fontSize: 26, fontWeight: "700" },
    safeModeTitle: { fontSize: 20, fontWeight: "700", color: theme.text, padding: 16 },
    safeModeBody: { fontSize: 14, color: theme.subtext, paddingHorizontal: 16 },
    safeModeError: { color: theme.red, padding: 16, fontSize: 12 },
  });
}
