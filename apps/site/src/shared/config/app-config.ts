const CORRECTION_MODES = ["end", "per-question"] as const;
type CorrectionMode = (typeof CORRECTION_MODES)[number];

const THEMES = ["light", "system", "dark"] as const;
type Theme = (typeof THEMES)[number];

const STORAGE_PREFIX = "pomkuiz.v1";

const APP_CONFIG = Object.freeze({
  storage: Object.freeze({
    settingsKey: `${STORAGE_PREFIX}.settings`,
    quizKeyPrefix: `${STORAGE_PREFIX}.quiz.`,
  }),
  progressVersion: 1,
  maxAttemptsPerQuiz: 50,
  defaultCorrectionMode: "end" as CorrectionMode,
  defaultTheme: "system" as Theme,
  defaultShuffle: false,
  dataDirectory: "data",
  percentDigits: 0,
  pointDigits: 2,
  themeAttribute: "data-theme",
  scoreLevels: Object.freeze({ mediumFrom: 0.5, highFrom: 0.75 }),
});

const KEYBOARD = Object.freeze({
  previous: "ArrowLeft",
  next: "ArrowRight",
  confirm: "Enter",
  choiceLetters: "abcdefghijklmnopqrstuvwxyz",
  choiceDigits: "123456789",
});

export { CORRECTION_MODES, THEMES, APP_CONFIG, KEYBOARD };
export type { CorrectionMode, Theme };
