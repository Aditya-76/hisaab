import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { type CaptureStatus, captureModule } from "./capture/capture-module.js";
import type { Db } from "./db/db.js";
import { migrate } from "./db/migrations.js";
import { openAppDb } from "./db/open.js";
import { listUnparsed, type UnparsedListItem } from "./db/raw-events.js";
import { initI18n } from "./i18n/index.js";
import { type DrainResult, drainRawEvents } from "./pipeline/drainer.js";
import { UnparsedQueueScreen } from "./screens/UnparsedQueueScreen.js";

initI18n();

/**
 * Phase 2 dev shell — a deliberately thin harness around the capture
 * pipeline so maintainers can watch it work on-device: migrate → drain →
 * show capture status + the unparsed queue. The real dashboard replaces
 * this in Phase 3 (UX §3.2).
 */
export default function App() {
  const { t } = useTranslation();
  const [db, setDb] = useState<Db | null>(null);
  const [status, setStatus] = useState<CaptureStatus | null>(null);
  const [drain, setDrain] = useState<DrainResult | null>(null);
  const [items, setItems] = useState<UnparsedListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (database: Db) => {
    const result = await drainRawEvents(database);
    setDrain(result);
    setItems(await listUnparsed(database, 50));
    setStatus(await captureModule().getCaptureStatus());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const database = openAppDb();
        await migrate(database);
        setDb(database);
        await refresh(database);
      } catch (e) {
        // Migration failure path = safe-mode screen with raw export
        // (UX §5.3) — honest stub until that screen exists.
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [refresh]);

  if (error !== null) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>{t("shell.title")}</Text>
        <Text style={styles.error}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{t("shell.title")}</Text>
      <Text style={styles.subtitle}>{t("shell.subtitle")}</Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>{t("shell.captureStatus")}</Text>
        <Text style={styles.statusLine}>
          {t("shell.notificationAccess")}:{" "}
          {status?.notificationAccess ? t("shell.granted") : t("shell.denied")}
        </Text>
        {status !== null && !status.notificationAccess && (
          <Button
            title={t("shell.grantNotificationAccess")}
            onPress={() => captureModule().openNotificationAccessSettings()}
          />
        )}
        <Text style={styles.statusLine}>
          {t("shell.lastEvent")}: {status?.lastEventAt ?? t("shell.never")}
        </Text>
        {drain !== null && (
          <Text style={styles.statusLine}>
            {t("shell.drained", {
              parsed: drain.parsed,
              unparsed: drain.unparsed,
              ignored: drain.ignored,
            })}
          </Text>
        )}
      </View>

      <UnparsedQueueScreen items={items} />

      {db !== null && <Button title="↻" onPress={() => void refresh(db)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 24, fontWeight: "700", paddingHorizontal: 16, paddingTop: 12 },
  subtitle: { fontSize: 12, opacity: 0.6, paddingHorizontal: 16, marginBottom: 8 },
  statusCard: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    margin: 16,
    marginTop: 4,
    padding: 12,
  },
  statusTitle: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  statusLine: { fontSize: 13, marginVertical: 2 },
  error: { color: "#b00020", padding: 16 },
});
