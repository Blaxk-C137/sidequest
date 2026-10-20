/**
 * The BlaXaura question bank.
 *
 * Everything here is content + shape only. Scoring lives in `scoring.ts` and
 * never looks at names, photos or anything outside the chosen option ids.
 *
 * Design rules baked into this file:
 *  - No gender, body, skin-tone or attractiveness framing anywhere.
 *  - "Prefer not to say" is always a first-class, non-penalised option.
 *  - Every option is written to feel like a compliment, never a diagnostic.
 */

export type QuestionOption = {
  id: string;
  label: string;
  /** One short, warm line shown under the label. */
  note?: string;
  /**
   * Grammatical noun-phrase version of the label, used when assembling report
   * copy ("You reached for easy, comfy dressing" rather than "casual & comfy").
   * Only needed where the label alone would read awkwardly in a sentence.
   */
  phrase?: string;
  /** Lucide icon name used by the web client. */
  icon?: string;
};

export type Question = {
  id: string;
  /** Short eyebrow label, e.g. "01 — Today". */
  kicker: string;
  prompt: string;
  helper?: string;
  options: QuestionOption[];
  /** Skipping is allowed on every question; this flag is kept for future packs. */
  allowSkip: boolean;
  /** Optional icebreaker shown to the pair after this answer. */
  conversationCard?: string;
};

export const QUESTIONS: Question[] = [
  {
    id: 'energy',
    kicker: '01 — Today',
    prompt: "Today's outfit energy?",
    helper: 'Pick whichever feels closest. There is no wrong door.',
    allowSkip: true,
    conversationCard: "What's the story behind that choice today?",
    options: [
      { id: 'casual', label: 'Casual & comfy', phrase: 'easy, comfy dressing', note: 'Soft fabrics, easy movement', icon: 'Feather' },
      { id: 'minimal', label: 'Minimal & clean', phrase: 'clean minimalism', note: 'Quiet lines, nothing extra', icon: 'Minus' },
      { id: 'street', label: 'Streetwear', phrase: 'streetwear', note: 'Sneakers, layers, attitude', icon: 'Zap' },
      { id: 'chic', label: 'Chic & polished', phrase: 'polished chic', note: 'Sharp, considered, put-together', icon: 'Sparkles' },
      { id: 'traditional', label: 'Traditional or cultural-inspired', phrase: 'traditional, cultural-inspired dressing', note: 'Ankara, aso-oke, heritage details', icon: 'Crown' },
      { id: 'mixed', label: 'My own mix', phrase: 'a little bit of everything', note: 'A little of everything, on purpose', icon: 'Shuffle' },
    ],
  },
  {
    id: 'inspiration',
    kicker: '02 — The why',
    prompt: 'What inspired your look today?',
    helper: 'Even "no real reason" is a real answer.',
    allowSkip: true,
    options: [
      { id: 'comfort', label: 'Comfort', phrase: 'comfort', note: 'I dressed for how I want to feel', icon: 'Cloud' },
      { id: 'occasion', label: 'The occasion', phrase: 'the occasion', note: 'Dressed for the room I am walking into', icon: 'CalendarDays' },
      { id: 'color', label: 'A favourite colour', phrase: 'a favourite colour', note: 'One shade set the whole thing off', icon: 'Palette' },
      { id: 'trend', label: 'A trend I liked', phrase: 'a trend I liked', note: 'Something I saw and wanted to try', icon: 'TrendingUp' },
      { id: 'instinct', label: 'Just felt right', phrase: 'instinct', note: 'Pulled it together on instinct', icon: 'Wind' },
    ],
  },
  {
    id: 'palette',
    kicker: '03 — Colour',
    prompt: 'Favourite colour direction?',
    helper: 'Think of the palette you reach for most.',
    allowSkip: true,
    options: [
      { id: 'neutrals', label: 'Neutrals', phrase: 'neutrals', note: 'Stone, cream, charcoal, camel', icon: 'Circle' },
      { id: 'pastels', label: 'Soft pastels', phrase: 'soft pastels', note: 'Blush, lilac, mint', icon: 'Flower2' },
      { id: 'bold', label: 'Bold colours', phrase: 'bold colours', note: 'High saturation, high confidence', icon: 'Flame' },
      { id: 'earth', label: 'Earth tones', phrase: 'earth tones', note: 'Clay, olive, ochre, cocoa', icon: 'Mountain' },
      { id: 'mixed', label: 'A mixed palette', phrase: 'a mixed palette', note: 'Unexpected pairings are the point', icon: 'Blend' },
    ],
  },
  {
    id: 'accessory',
    kicker: '04 — Detail',
    prompt: 'Which accessory speaks to you?',
    helper: 'The piece you reach for without thinking.',
    allowSkip: true,
    options: [
      { id: 'jewelry', label: 'Jewellery', phrase: 'jewellery', note: 'Rings, chains, earrings, bangles', icon: 'Gem' },
      { id: 'bag', label: 'A bag', phrase: 'a bag', note: 'Structure or slouch, it finishes the look', icon: 'Briefcase' },
      { id: 'watch', label: 'A watch', phrase: 'a watch', note: 'Quiet precision on the wrist', icon: 'Watch' },
      { id: 'shoes', label: 'Shoes', phrase: 'shoes', note: 'The look starts from the ground up', icon: 'Footprints' },
      { id: 'headwear', label: 'Headwear', phrase: 'headwear', note: 'Hats, wraps, head ties, caps', icon: 'Crown' },
      { id: 'none', label: 'None — I keep it simple', phrase: 'keeping it simple', note: 'Less, on purpose, is its own statement', icon: 'Minus' },
    ],
  },
  {
    id: 'hair',
    kicker: '05 — Hair',
    prompt: "What's your hairstyle story today?",
    helper: 'Every answer here is celebrated equally.',
    allowSkip: true,
    conversationCard: "What's one look you've always wanted to try?",
    options: [
      { id: 'practical', label: 'Easy & practical', phrase: 'an easy, practical style', note: 'Low effort, high function', icon: 'Feather' },
      { id: 'protective', label: 'A protective style', phrase: 'a protective style', note: 'Braids, twists, locs, wraps', icon: 'Shield' },
      { id: 'creative', label: 'Creative expression', phrase: 'creative expression', note: 'Colour, shape, sculpting', icon: 'Wand2' },
      { id: 'occasion', label: 'Special occasion', phrase: 'an occasion style', note: 'Styled for something specific', icon: 'PartyPopper' },
      { id: 'natural', label: 'Natural everyday look', phrase: 'a natural everyday look', note: 'My texture, as it is', icon: 'Leaf' },
      { id: 'private', label: 'Prefer not to say', note: 'Skipped entirely in your report', icon: 'EyeOff' },
    ],
  },
  {
    id: 'makeup',
    kicker: '06 — Face',
    prompt: 'Makeup mood?',
    helper: 'No answer is ranked higher than another. Truly.',
    allowSkip: true,
    options: [
      { id: 'none', label: 'No makeup', phrase: 'bare skin', note: 'A complete look on its own', icon: 'Sun' },
      { id: 'natural', label: 'Natural look', phrase: 'a natural look', note: 'Skin still doing the talking', icon: 'Leaf' },
      { id: 'softglam', label: 'Soft glam', phrase: 'soft glam', note: 'Glow, definition, a little drama', icon: 'Sparkles' },
      { id: 'bold', label: 'Bold & artistic', phrase: 'a bold, artistic look', note: 'Liner, pigment, brushwork', icon: 'Brush' },
      { id: 'depends', label: 'Depends on the day', phrase: 'a mood-led approach', note: 'Mood-led, never fixed', icon: 'CloudSun' },
      { id: 'private', label: 'Prefer not to say', note: 'Skipped entirely in your report', icon: 'EyeOff' },
    ],
  },
  {
    id: 'values',
    kicker: '07 — Values',
    prompt: 'What matters most in personal style?',
    helper: 'The thing you would defend in a conversation.',
    allowSkip: true,
    options: [
      { id: 'comfort', label: 'Comfort', note: 'If it itches, it is not the look', icon: 'Cloud' },
      { id: 'creativity', label: 'Creativity', note: 'A fresh idea beats a safe one', icon: 'Wand2' },
      { id: 'confidence', label: 'Confidence', note: 'The outfit is only the beginning', icon: 'Flame' },
      { id: 'tradition', label: 'Tradition', note: 'Roots, meaning, and memory', icon: 'Crown' },
      { id: 'simplicity', label: 'Simplicity', note: 'Editing is the real skill', icon: 'Minus' },
      { id: 'versatility', label: 'Versatility', note: 'One piece, many lives', icon: 'Repeat' },
    ],
  },
  {
    id: 'explore',
    kicker: '08 — Next',
    prompt: 'What would you like to explore?',
    helper: 'This only shapes your two suggestions at the end.',
    allowSkip: true,
    options: [
      { id: 'colors', label: 'New colour pairings', note: 'Combinations you have not tried', icon: 'Palette' },
      { id: 'accessories', label: 'Accessories', note: 'The finishing piece', icon: 'Gem' },
      { id: 'layering', label: 'Layering', note: 'Building depth with what you own', icon: 'Layers' },
      { id: 'hairstyles', label: "Hairstyles", note: 'New silhouettes and shapes', icon: 'Scissors' },
      { id: 'makeup', label: 'Makeup looks', note: 'New textures and finishes', icon: 'Brush' },
      { id: 'nothing', label: "Nothing — I'm happy with my style", note: 'A genuinely great answer', icon: 'Heart' },
    ],
  },
];

export const QUESTION_IDS = QUESTIONS.map((q) => q.id);

export const OPTION_IDS: Record<string, string[]> = Object.fromEntries(
  QUESTIONS.map((q) => [q.id, q.options.map((o) => o.id)]),
);

export function getQuestion(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

export function getOption(questionId: string, optionId: string): QuestionOption | undefined {
  return getQuestion(questionId)?.options.find((o) => o.id === optionId);
}

/** Human label for an option, used to ground reports in the actual answers. */
export function labelFor(questionId: string, optionId: string | undefined): string | null {
  if (!optionId) return null;
  return getOption(questionId, optionId)?.label ?? null;
}

/**
 * Sentence-ready noun phrase for an option (falls back to the label).
 * Phrases are authored in the schema, never lowercased at runtime, so names
 * like "I" and brand-ish capitalisation survive.
 */
export function phraseFor(questionId: string, optionId: string | undefined): string | null {
  if (!optionId) return null;
  const option = getOption(questionId, optionId);
  if (!option) return null;
  return option.phrase ?? option.label;
}

/** True when the participant explicitly declined to answer. */
export function isPrivate(questionId: string, optionId: string | undefined): boolean {
  return optionId === 'private' && getOption(questionId, 'private') !== undefined;
}

export const SKIPPED = 'skipped' as const;

/** A quiz response is a sparse map of questionId -> optionId ("skipped" when passed). */
export type QuizAnswers = Record<string, string>;

export function isAnswered(answers: QuizAnswers, questionId: string): boolean {
  const value = answers[questionId];
  return typeof value === 'string' && value.length > 0 && value !== SKIPPED;
}

export const CONSENT_TEXT_VERSION = '2026-10-v1';

export const CONSENT_TEXT =
  'I agree to share this number with the person showing me BlaXaura. It will be stored on their device so they can contact me.';

export const REPORT_DISCLAIMER =
  'Based on your answers, for fun — not an objective judgment of appearance.';
