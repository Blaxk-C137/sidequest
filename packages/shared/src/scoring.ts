import { QUESTIONS, isAnswered, type QuizAnswers } from './questions.js';

/**
 * DETERMINISTIC SCORING RULES — documented on purpose.
 *
 * BlaXaura shows a playful "style-expression index" plus three dimension
 * meters. None of it is a judgment of appearance. The rules below are fixed,
 * auditable, and computed on the server from the participant's self-reported
 * option ids. Gemini is never allowed to produce or alter these numbers.
 *
 * 1. Each option carries a weight of 0–10 for each dimension, in
 *    `WEIGHTS` below. Unlisted options (including "Prefer not to say") carry
 *    no weight and are excluded from the average — skipping never lowers a
 *    score.
 * 2. A dimension score is `round(35 + 6.5 × mean(weight))`, clamped to
 *    0–100. With no answers at all every dimension is 35 (a neutral baseline);
 *    a fully expressive set of answers lands near 100.
 * 3. The expression index is `round(0.4 × creative + 0.3 × intention +
 *    0.3 × versatility)` plus a "signature" bonus of 1 point per distinct
 *    signature choice (max 5), clamped to 0–100.
 * 4. Every option — including no makeup, natural hair and "keep it simple" —
 *    has positive weights somewhere. Nothing is scored as worse for being
 *    natural, cultural or minimal; those choices simply read as intention.
 */

export type DimensionKey = 'creative' | 'intention' | 'versatility';

export const DIMENSIONS: { key: DimensionKey; label: string; short: string }[] = [
  { key: 'creative', label: 'Creative Exploration', short: 'How far you push colour, texture and ideas.' },
  { key: 'intention', label: 'Style Intention', short: 'How deliberately you put a look together.' },
  { key: 'versatility', label: 'Versatility', short: 'How comfortably your style moves between settings.' },
];

type Weight = Partial<Record<DimensionKey, number>>;

/** questionId -> optionId -> dimension weights (0–10). */
export const WEIGHTS: Record<string, Record<string, Weight>> = {
  energy: {
    casual: { versatility: 8, intention: 5 },
    minimal: { intention: 9, versatility: 7 },
    street: { creative: 9, versatility: 6 },
    chic: { intention: 10, creative: 5 },
    traditional: { intention: 9, creative: 7 },
    mixed: { creative: 10, versatility: 7 },
  },
  inspiration: {
    comfort: { intention: 4, versatility: 8 },
    occasion: { intention: 9, versatility: 6 },
    color: { creative: 8, intention: 6 },
    trend: { creative: 9, versatility: 5 },
    instinct: { creative: 7, intention: 4 },
  },
  palette: {
    neutrals: { intention: 8, versatility: 9 },
    pastels: { creative: 7, versatility: 6 },
    bold: { creative: 10, intention: 5 },
    earth: { intention: 7, versatility: 8 },
    mixed: { creative: 10, versatility: 5 },
  },
  accessory: {
    jewelry: { creative: 6, intention: 7 },
    bag: { intention: 8, versatility: 6 },
    watch: { intention: 8, versatility: 7 },
    shoes: { creative: 5, versatility: 8, intention: 6 },
    headwear: { creative: 9, intention: 6 },
    none: { versatility: 9, intention: 8 },
  },
  hair: {
    practical: { versatility: 8, intention: 5 },
    protective: { intention: 8, creative: 6 },
    creative: { creative: 10, intention: 6 },
    occasion: { intention: 8, creative: 5 },
    natural: { versatility: 7, creative: 5 },
    private: {},
  },
  makeup: {
    none: { versatility: 8, intention: 5 },
    natural: { versatility: 7, intention: 6 },
    softglam: { intention: 8, creative: 5 },
    bold: { creative: 10, intention: 6 },
    depends: { versatility: 9, creative: 5 },
    private: {},
  },
  values: {
    comfort: { versatility: 8, intention: 5 },
    creativity: { creative: 10, intention: 6 },
    confidence: { intention: 8, creative: 4 },
    tradition: { intention: 8, creative: 7 },
    simplicity: { intention: 9, versatility: 7 },
    versatility: { versatility: 10, intention: 6 },
  },
  explore: {
    colors: { creative: 8 },
    accessories: { intention: 6, creative: 5 },
    layering: { versatility: 8, creative: 6 },
    hairstyles: { creative: 7 },
    makeup: { creative: 8, intention: 5 },
    nothing: { intention: 9, versatility: 7 },
  },
};

/** Choices that signal a distinct personal signature; each adds +1 (max 5). */
export const SIGNATURE_CHOICES: Record<string, string[]> = {
  palette: ['bold', 'mixed'],
  accessory: ['headwear', 'jewelry'],
  hair: ['creative', 'protective'],
  makeup: ['bold', 'softglam'],
  energy: ['traditional', 'street', 'mixed'],
  inspiration: ['trend', 'instinct'],
};

export type DimensionScore = {
  key: DimensionKey;
  label: string;
  score: number;
  note: string;
};

export type ScoreResult = {
  expressionScore: number;
  dimensions: DimensionScore[];
  answeredCount: number;
  skippedCount: number;
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, n));
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function dimensionNote(key: DimensionKey, score: number): string {
  const band = score >= 78 ? 'high' : score >= 58 ? 'mid' : 'low';
  const notes: Record<DimensionKey, Record<typeof band, string>> = {
    creative: {
      high: 'You reach for colour, texture and unexpected pairings.',
      mid: 'You enjoy a creative twist when it feels right.',
      low: 'Your creativity shows up in restraint and clean choices.',
    },
    intention: {
      high: 'Your looks are deliberate — every piece has a job.',
      mid: 'You balance planning with mood.',
      low: 'You dress from instinct, letting the day decide.',
    },
    versatility: {
      high: 'Your style can move from class to dinner without a reset.',
      mid: 'You shift between comfort and occasion with ease.',
      low: 'You have a signature lane, and you commit to it.',
    },
  };
  return notes[key][band];
}

export function scoreAnswers(answers: QuizAnswers): ScoreResult {
  const sums: Record<DimensionKey, number[]> = { creative: [], intention: [], versatility: [] };
  let answeredCount = 0;
  let skippedCount = 0;

  for (const question of QUESTIONS) {
    const optionId = answers[question.id];
    if (!isAnswered(answers, question.id)) {
      skippedCount += 1;
      continue;
    }
    answeredCount += 1;
    const weights = WEIGHTS[question.id]?.[optionId as string];
    if (!weights) continue;
    for (const dim of DIMENSIONS) {
      const weight = weights[dim.key];
      if (typeof weight === 'number') sums[dim.key].push(weight);
    }
  }

  const scored: Record<DimensionKey, number> = { creative: 35, intention: 35, versatility: 35 };
  for (const dim of DIMENSIONS) {
    const avg = mean(sums[dim.key]);
    if (avg !== null) scored[dim.key] = Math.round(clamp(35 + 6.5 * avg));
  }

  let signatureBonus = 0;
  for (const [questionId, options] of Object.entries(SIGNATURE_CHOICES)) {
    if (options.includes(answers[questionId] ?? '')) signatureBonus += 1;
  }
  signatureBonus = Math.min(signatureBonus, 5);

  const expressionScore = Math.round(
    clamp(0.4 * scored.creative + 0.3 * scored.intention + 0.3 * scored.versatility + signatureBonus),
  );

  return {
    expressionScore,
    answeredCount,
    skippedCount,
    dimensions: DIMENSIONS.map((dim) => ({
      key: dim.key,
      label: dim.label,
      score: scored[dim.key],
      note: dimensionNote(dim.key, scored[dim.key]),
    })),
  };
}
