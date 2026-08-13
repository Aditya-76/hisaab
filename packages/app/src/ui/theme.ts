import { useColorScheme } from "react-native";

/**
 * Visual language (UX §6): neutral high-contrast base, green/red only as
 * accents on money. Light + dark from day one — many riders work nights.
 * High contrast targets sunlight readability on cheap panels.
 */
export interface Theme {
  bg: string;
  card: string;
  text: string;
  subtext: string;
  border: string;
  /** Earnings accent. */
  green: string;
  /** Expense / gap / penalty accent. */
  red: string;
  /** Interactive elements (buttons, active tab, FAB). */
  primary: string;
  primaryText: string;
  /** Warning banner background (gaps, unparsed, revoked access). */
  warnBg: string;
  warnText: string;
}

export const LIGHT: Theme = {
  bg: "#ffffff",
  card: "#f6f6f4",
  text: "#171717",
  subtext: "#555550",
  border: "#dcdcd7",
  green: "#0a6d38",
  red: "#b00020",
  primary: "#14532d",
  primaryText: "#ffffff",
  warnBg: "#fdf3d7",
  warnText: "#5c4400",
};

export const DARK: Theme = {
  bg: "#121212",
  card: "#1e1e1c",
  text: "#f2f2ef",
  subtext: "#a5a59d",
  border: "#3a3a36",
  green: "#4ade80",
  red: "#ff6b6b",
  primary: "#22c55e",
  primaryText: "#04150a",
  warnBg: "#3a3212",
  warnText: "#ffe08a",
};

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? DARK : LIGHT;
}
