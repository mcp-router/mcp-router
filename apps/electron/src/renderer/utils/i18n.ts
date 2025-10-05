import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import enTranslation from "../../locales/en.json";
import jaTranslation from "../../locales/ja.json";
import zhTranslation from "../../locales/zh.json";

// Initialize i18next
i18n
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Set up i18next
  .init({
    resources: {
      en: {
        translation: enTranslation,
      },
      ja: {
        translation: jaTranslation,
      },
      zh: {
        translation: zhTranslation,
      },
    },
    fallbackLng: "en",
    // Debug mode in development environment
    debug: process.env.NODE_ENV === "development",

    // Common namespace used around the app
    ns: ["translation"],
    defaultNS: "translation",

    // Caching
    load: "currentOnly",

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
