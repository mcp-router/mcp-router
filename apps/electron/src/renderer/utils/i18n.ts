import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enTranslation from "../../locales/en.json";

// Initialize i18next (English-only)
i18n
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Set up i18next
  .init({
    resources: {
      en: {
        translation: enTranslation,
      },
    },
    lng: "en",
    fallbackLng: "en",
    debug: false,

    // Common namespace used around the app
    ns: ["translation"],
    defaultNS: "translation",

    interpolation: {
      escapeValue: false, // React already safes from XSS
    },

    // Allow returning objects from translation keys
    returnObjects: true,

    // React settings
    react: {
      useSuspense: true,
    },
  });
