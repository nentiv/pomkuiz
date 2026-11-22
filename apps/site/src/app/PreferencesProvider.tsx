import { createContext, type ComponentChildren } from "preact";
import { useContext, useEffect, useMemo, useState } from "preact/hooks";
import { APP_CONFIG } from "../shared/config/app-config.ts";
import { browserStorage } from "../shared/local-storage.ts";
import { createProgressStore, type ProgressStore } from "../features/progress/progress-store.ts";
import { loadSettings, saveSettings, type Settings } from "../features/settings/user-settings.ts";

interface Preferences {
  settings: Settings;
  updateSettings(patch: Partial<Settings>): void;
  progress: ProgressStore;
}

const PreferencesContext = createContext<Preferences | null>(null);

function PreferencesProvider({ children }: { children: ComponentChildren }) {
  const storage = useMemo(() => browserStorage(), []);
  const progress = useMemo(() => createProgressStore(storage), [storage]);
  const [settings, setSettings] = useState(() => loadSettings(storage));

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "system") root.removeAttribute(APP_CONFIG.themeAttribute);
    else root.setAttribute(APP_CONFIG.themeAttribute, settings.theme);
  }, [settings.theme]);

  const value = useMemo<Preferences>(
    () => ({
      settings,
      progress,
      updateSettings(patch) {
        setSettings((current) => {
          const next = { ...current, ...patch };
          saveSettings(storage, next);
          return next;
        });
      },
    }),
    [settings, progress, storage],
  );
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

function usePreferences(): Preferences {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("PreferencesProvider manquant");
  return value;
}

export { PreferencesProvider, usePreferences };
