const TONES = ["neutral", "accent", "low", "medium", "high"] as const;
type Tone = (typeof TONES)[number];

const toneClass = (tone: Tone): string => `tone-${tone}`;

export { toneClass };
export type { Tone };
