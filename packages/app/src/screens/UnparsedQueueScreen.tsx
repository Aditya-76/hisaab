import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { UnparsedListItem } from "../db/raw-events.js";

/**
 * Unparsed-queue stub (Phase 2, UX §3.4): shows what hisaab captured but
 * couldn't read, honestly. Never silently drop data — workers can see the
 * queue exists; the contribute flow that lets them share an item (anonymized,
 * after review) lands in Phase 4.
 */
export interface UnparsedQueueScreenProps {
  items: UnparsedListItem[];
}

export function UnparsedQueueScreen({ items }: UnparsedQueueScreenProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("unparsed.title")}</Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>{t("unparsed.empty")}</Text>
      ) : (
        <>
          <Text style={styles.count}>{t("unparsed.count", { count: items.length })}</Text>
          <Text style={styles.hint}>{t("unparsed.hint")}</Text>
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardMeta}>
                  {item.platformHint ?? item.source} · {item.postedAt}
                </Text>
                {item.title != null && <Text style={styles.cardTitle}>{item.title}</Text>}
                <Text style={styles.cardText} numberOfLines={3}>
                  {item.text}
                </Text>
                <Text style={styles.contributeSoon}>{t("unparsed.contributeSoon")}</Text>
              </View>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  empty: { fontSize: 14, opacity: 0.7 },
  count: { fontSize: 14, marginBottom: 4 },
  hint: { fontSize: 12, opacity: 0.7, marginBottom: 12 },
  card: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12, marginBottom: 8 },
  cardMeta: { fontSize: 11, opacity: 0.6, marginBottom: 4 },
  cardTitle: { fontSize: 14, fontWeight: "600" },
  cardText: { fontSize: 13 },
  contributeSoon: { fontSize: 11, opacity: 0.5, marginTop: 8 },
});
