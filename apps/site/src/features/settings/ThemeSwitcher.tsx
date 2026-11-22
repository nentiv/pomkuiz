import { usePreferences } from "../../app/PreferencesProvider.tsx";
import { THEMES, type Theme } from "../../shared/config/app-config.ts";
import { MESSAGES } from "../../shared/i18n/messages-fr.ts";
import { Monitor, Moon, Sun, type LucideIcon } from "@pomkuiz/design-system/icons";
import { Segmented } from "@pomkuiz/design-system";

const THEME_ICONS: Readonly<Record<Theme, LucideIcon>> = Object.freeze({ light: Sun, system: Monitor, dark: Moon });

const OPTIONS = THEMES.map((theme) => ({ value: theme, label: MESSAGES.theme[theme], icon: THEME_ICONS[theme] }));

function ThemeSwitcher() {
  const { settings, updateSettings } = usePreferences();
  return (
    <Segmented
      name="theme"
      legend={MESSAGES.theme.label}
      options={OPTIONS}
      value={settings.theme}
      onChange={(theme) => updateSettings({ theme })}
      iconOnly
      hideLegend
    />
  );
}

export { ThemeSwitcher };
