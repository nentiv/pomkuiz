const CONTRACT_LIMITS = Object.freeze({
  slugCharacters: 80,
  titleCharacters: 200,
  descriptionCharacters: 2000,
  sectionCharacters: 80,
  tagCharacters: 40,
  maxTags: 20,
  richTextCharacters: 10000,
  maxImages: 10,
  minChoices: 2,
  maxChoices: 26,
  maxQuestions: 500,
});

const CONTRACT_PATTERNS = Object.freeze({
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
});

export { CONTRACT_LIMITS, CONTRACT_PATTERNS };
