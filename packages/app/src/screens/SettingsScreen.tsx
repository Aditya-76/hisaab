import { useTranslation } from "react-i18next";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Theme } from "../ui/theme.js";
import { useTheme } from "../ui/theme.js";

/**
 * Settings (UX §3.6), Phase 3 slice: language, capture status, diagnostics
 * entry, about/privacy pledge. SMS toggle, export and delete-all land with
 * Phase 4 (reconciliation + pilot readiness) and are honestly absent, not
 * greyed out.
 */
export interface SettingsScreenProps {
  language: string;
  onChangeLanguage(lng: "en" | "hi" | "kn"): void;
  notificationAccess: boolean | null;
  onOpenNotificationSettings(): void;
  onOpenDiagnostics(): void;
}

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "kn", label: "ಕನ್ನಡ" },
] as const;

const REPO_URL = "https://github.com/Aditya-76/hisaab";

export function SettingsScreen({
  language,
  onChangeLanguage,
  notificationAccess,
  onOpenNotificationSettings,
  onOpenDiagnostics,
}: SettingsScreenProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t("settings.title")}</Text>

      <Text style={styles.sectionTitle}>{t("settings.language")}</Text>
      <View style={styles.card}>
        {LANGUAGES.map((lang) => (
          <Pressable
            key={lang.code}
            style={styles.row}
            onPress={() => onChangeLanguage(lang.code)}
            accessibilityRole="button"
            accessibilityState={{ selected: language === lang.code }}
          >
            <Text style={styles.rowText}>{lang.label}</Text>
            {language === lang.code && <Text style={styles.check}>✓</Text>}
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>{t("settings.capture")}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowText}>{t("settings.notificationAccess")}</Text>
          <Text style={notificationAccess ? styles.statusOn : styles.statusOff}>
            {notificationAccess === null
              ? "…"
              : notificationAccess
                ? t("settings.on")
                : t("settings.off")}
          </Text>
        </View>
        {notificationAccess === false && (
          <Pressable
            style={styles.row}
            onPress={onOpenNotificationSettings}
            accessibilityRole="button"
          >
            <Text style={styles.link}>{t("settings.grantNotificationAccess")}</Text>
          </Pressable>
        )}
        <Pressable style={styles.row} onPress={onOpenDiagnostics} accessibilityRole="button">
          <Text style={styles.rowText}>{t("settings.diagnostics")}</Text>
          <Text style={styles.chevron}>→</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>{t("settings.about")}</Text>
      <View style={styles.card}>
        <Text style={styles.pledge}>{t("settings.pledge")}</Text>
        <Pressable
          style={styles.row}
          onPress={() => void Linking.openURL(REPO_URL)}
          accessibilityRole="link"
        >
          <Text style={styles.link}>{t("settings.verify")}</Text>
        </Pressable>
        <Text style={styles.comingSoon}>{t("settings.phase4Note")}</Text>
      </View>
    </ScrollView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16, paddingBottom: 96 },
    title: { fontSize: 20, fontWeight: "700", color: theme.text, marginBottom: 12 },
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
      justifyContent: "space-between",
      minHeight: 48,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    rowText: { fontSize: 15, color: theme.text },
    check: { fontSize: 16, color: theme.green, fontWeight: "700" },
    statusOn: { color: theme.green, fontWeight: "600" },
    statusOff: { color: theme.red, fontWeight: "600" },
    link: { fontSize: 15, color: theme.primary, fontWeight: "600" },
    chevron: { color: theme.subtext, fontSize: 16 },
    pledge: { fontSize: 13, color: theme.text, lineHeight: 20, paddingVertical: 12 },
    comingSoon: { fontSize: 12, color: theme.subtext, paddingVertical: 10 },
  });
}
