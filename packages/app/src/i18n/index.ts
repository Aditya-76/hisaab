import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import hi from "./locales/hi.json";
import kn from "./locales/kn.json";

/**
 * UI strings externalized from day one (CLAUDE.md conventions): EN/HI/KN in
 * v1, more languages community-translatable. Language selection UI comes
 * with onboarding (Phase 3); until then the device language decides via the
 * caller passing `lng`.
 */
export function initI18n(lng = "en"): typeof i18next {
  if (!i18next.isInitialized) {
    void i18next.use(initReactI18next).init({
      lng,
      fallbackLng: "en",
      resources: {
        en: { translation: en },
        hi: { translation: hi },
        kn: { translation: kn },
      },
      interpolation: { escapeValue: false },
    });
  }
  return i18next;
}
