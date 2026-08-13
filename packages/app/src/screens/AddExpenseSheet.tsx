import { EXPENSE_CATEGORIES, type Expense, formatPaise, parseInrToPaise } from "@hisaab/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { Theme } from "../ui/theme.js";
import { useTheme } from "../ui/theme.js";

/**
 * FAB → bottom sheet: two taps + amount (UX §3.3). Keypad text becomes
 * integer paise through core's parseInrToPaise — the single audited
 * text→money path; no floats.
 */
export interface AddExpenseSheetProps {
  visible: boolean;
  recentAmountsPaise: number[];
  onSave(expense: Expense): void;
  onClose(): void;
}

const CATEGORY_ICONS: Record<Expense["category"], string> = {
  fuel: "⛽",
  recharge: "📱",
  rent: "🏍",
  other: "⋯",
};

export function AddExpenseSheet({
  visible,
  recentAmountsPaise,
  onSave,
  onClose,
}: AddExpenseSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [category, setCategory] = useState<Expense["category"]>("fuel");
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  const amountPaise = parseInrToPaise(amountText.trim());
  const canSave = amountPaise !== null && amountPaise > 0;

  const reset = () => {
    setAmountText("");
    setNote("");
    setShowNote(false);
  };

  const save = () => {
    if (amountPaise === null || amountPaise <= 0) return;
    onSave({
      category,
      amount: amountPaise,
      timestamp: new Date().toISOString(),
      ...(note.trim().length > 0 ? { note: note.trim() } : {}),
    });
    reset();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={t("common.close")} />
      <View style={styles.sheet}>
        <Text style={styles.title}>{t("expense.title")}</Text>

        <View style={styles.chips}>
          {EXPENSE_CATEGORIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              accessibilityRole="button"
              accessibilityState={{ selected: category === c }}
              style={[styles.chip, category === c && styles.chipActive]}
            >
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
                {CATEGORY_ICONS[c]} {t(`expense.categories.${c}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.amountRow}>
          <Text style={styles.rupee}>₹</Text>
          <TextInput
            style={styles.amountInput}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={theme.subtext}
            accessibilityLabel={t("expense.amountLabel")}
          />
        </View>

        {recentAmountsPaise.length > 0 && (
          <View style={styles.recentRow}>
            <Text style={styles.recentLabel}>{t("expense.recent")}</Text>
            {recentAmountsPaise.map((paise) => (
              <Pressable
                key={paise}
                onPress={() => setAmountText(String(Math.trunc(paise / 100)))}
                style={styles.recentChip}
                accessibilityRole="button"
              >
                <Text style={styles.recentChipText}>{formatPaise(paise)}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {showNote ? (
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder={t("expense.notePlaceholder")}
            placeholderTextColor={theme.subtext}
          />
        ) : (
          <Pressable onPress={() => setShowNote(true)} accessibilityRole="button">
            <Text style={styles.addNote}>{t("expense.addNote")}</Text>
          </Pressable>
        )}

        <Pressable
          onPress={save}
          disabled={!canSave}
          accessibilityRole="button"
          style={[styles.saveButton, !canSave && styles.saveDisabled]}
        >
          <Text style={styles.saveText}>{t("expense.save")}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
    sheet: {
      backgroundColor: theme.bg,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 16,
      paddingBottom: 28,
    },
    title: { fontSize: 18, fontWeight: "700", color: theme.text, marginBottom: 12 },
    chips: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
    chip: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 20,
      paddingHorizontal: 12,
      minHeight: 48,
      justifyContent: "center",
      marginRight: 8,
      marginBottom: 8,
    },
    chipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    chipText: { color: theme.text, fontSize: 14 },
    chipTextActive: { color: theme.primaryText },
    amountRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
    rupee: { fontSize: 32, color: theme.text, marginRight: 8 },
    amountInput: {
      flex: 1,
      fontSize: 32,
      color: theme.text,
      borderBottomWidth: 2,
      borderBottomColor: theme.border,
      paddingVertical: 4,
      fontVariant: ["tabular-nums"],
    },
    recentRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, flexWrap: "wrap" },
    recentLabel: { color: theme.subtext, fontSize: 13, marginRight: 8 },
    recentChip: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginRight: 8,
    },
    recentChipText: { color: theme.text, fontSize: 13 },
    addNote: { color: theme.subtext, fontSize: 13, marginBottom: 12 },
    noteInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      color: theme.text,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 12,
    },
    saveButton: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    saveDisabled: { opacity: 0.4 },
    saveText: { color: theme.primaryText, fontSize: 16, fontWeight: "700" },
  });
}
