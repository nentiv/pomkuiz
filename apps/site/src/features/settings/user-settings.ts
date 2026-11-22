import {
  APP_CONFIG,
  CORRECTION_MODES,
  THEMES,
  type CorrectionMode,
  type Theme,
} from "../../shared/config/app-config.ts";
import { readJson, writeJson, type KeyValueStorage } from "../../shared/local-storage.ts";

interface Settings {
  correctionMode: CorrectionMode;
  theme: Theme;
  shuffle: boolean;
}

const DEFAULT_SETTINGS: Settings = Object.freeze({
  correctionMode: APP_CONFIG.defaultCorrectionMode,
  theme: APP_CONFIG.defaultTheme,
  shuffle: APP_CONFIG.defaultShuffle,
});

function parseSettings(raw: unknown): Settings {
  const value = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    correctionMode: CORRECTION_MODES.includes(value.correctionMode as CorrectionMode)
      ? (value.correctionMode as CorrectionMode)
      : DEFAULT_SETTINGS.correctionMode,
    theme: THEMES.includes(value.theme as Theme) ? (value.theme as Theme) : DEFAULT_SETTINGS.theme,
    shuffle: typeof value.shuffle === "boolean" ? value.shuffle : DEFAULT_SETTINGS.shuffle,
  };
}

function loadSettings(storage: KeyValueStorage | null): Settings {
  return parseSettings(readJson(storage, APP_CONFIG.storage.settingsKey));
}

function saveSettings(storage: KeyValueStorage | null, settings: Settings): void {
  writeJson(storage, APP_CONFIG.storage.settingsKey, settings);
}

export { parseSettings, loadSettings, saveSettings };
export type { Settings };
