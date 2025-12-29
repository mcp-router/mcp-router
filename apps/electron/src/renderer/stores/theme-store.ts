import { create, StoreApi, UseBoundStore } from "zustand";
import type { PlatformAPI, Theme } from "@mcp_router/shared";

export interface ThemeStoreState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const createThemeStore = (
  getPlatformAPI: () => PlatformAPI,
): UseBoundStore<StoreApi<ThemeStoreState>> =>
  create<ThemeStoreState>((set) => ({
    theme: "system",
    setTheme: (theme: Theme) => {
      set({ theme });

      if (typeof window === "undefined") {
        return;
      }

      applyTheme(theme);
      // Persist theme to settings via PlatformAPI
      try {
        const platformAPI = getPlatformAPI();
        platformAPI.settings
          .get()
          .then((settings) =>
            platformAPI.settings.save({
              ...settings,
              theme,
            }),
          )
          .catch((error) => {
            console.error("Failed to save theme settings:", error);
          });
      } catch (error) {
        console.error("Failed to access PlatformAPI for theme:", error);
      }
    },
  }));

function applyTheme(theme: Theme) {
  if (typeof window === "undefined") {
    return;
  }

  const root = window.document.documentElement;

  root.classList.remove("light", "dark");

  if (theme === "system") {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
      .matches
      ? "dark"
      : "light";
    root.classList.add(systemTheme);
  } else {
    root.classList.add(theme);
  }
}

export function initializeThemeStore(
  useThemeStore: UseBoundStore<StoreApi<ThemeStoreState>>,
  getPlatformAPI: () => PlatformAPI,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const platformAPI = getPlatformAPI();
    platformAPI.settings.get().then((settings) => {
      const initialTheme: Theme = settings.theme ?? "system";
      // Update store state and apply theme without persisting again
      useThemeStore.setState({ theme: initialTheme });
      applyTheme(initialTheme);
    });
  } catch (error) {
    console.error(
      "Failed to access PlatformAPI for theme initialization:",
      error,
    );
  }

  // Listen for system theme changes while in "system" mode
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", () => {
    const currentTheme = useThemeStore.getState().theme;
    if (currentTheme === "system") {
      applyTheme("system");
    }
  });
}
