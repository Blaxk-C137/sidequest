import { isAnswered, labelFor, type QuizAnswers } from './questions.js';

/**
 * Archetypes are descriptive, not diagnostic. Each one is matched against the
 * participant's actual option ids (see `pickArchetype`) — never against
 * appearance, body, gender or anything else.
 */
export type Archetype = {
  id: string;
  title: string;
  /** One-line essence, used as a fallback tagline. */
  essence: string;
  /** optionId matches that pull toward this archetype. */
  signals: { questionId: string; optionIds: string[]; weight: number }[];
};

export const ARCHETYPES: Archetype[] = [
  {
    id: 'bold-curator',
    title: 'The Bold Curator',
    essence: 'You treat getting dressed like hanging a small exhibition.',
    signals: [
      { questionId: 'palette', optionIds: ['bold', 'mixed'], weight: 3 },
      { questionId: 'energy', optionIds: ['street', 'mixed'], weight: 2 },
      { questionId: 'values', optionIds: ['creativity'], weight: 2 },
      { questionId: 'accessory', optionIds: ['headwear', 'jewelry'], weight: 1 },
    ],
  },
  {
    id: 'effortless-muse',
    title: 'The Effortless Muse',
    essence: 'Your style looks unstudied, and that is exactly the skill.',
    signals: [
      { questionId: 'energy', optionIds: ['casual'], weight: 3 },
      { questionId: 'inspiration', optionIds: ['instinct'], weight: 2 },
      { questionId: 'hair', optionIds: ['practical', 'natural'], weight: 1 },
      { questionId: 'values', optionIds: ['comfort'], weight: 2 },
    ],
  },
  {
    id: 'minimalist-spark',
    title: 'The Minimalist Spark',
    essence: 'You know that one excellent detail beats five loud ones.',
    signals: [
      { questionId: 'energy', optionIds: ['minimal'], weight: 3 },
      { questionId: 'palette', optionIds: ['neutrals'], weight: 2 },
      { questionId: 'accessory', optionIds: ['none', 'watch'], weight: 2 },
      { questionId: 'values', optionIds: ['simplicity'], weight: 3 },
    ],
  },
  {
    id: 'heritage-romantic',
    title: 'The Heritage Romantic',
    essence: 'You wear stories, not just clothes.',
    signals: [
      { questionId: 'energy', optionIds: ['traditional'], weight: 4 },
      { questionId: 'values', optionIds: ['tradition'], weight: 3 },
      { questionId: 'hair', optionIds: ['protective'], weight: 1 },
      { questionId: 'palette', optionIds: ['earth'], weight: 1 },
    ],
  },
  {
    id: 'studio-artist',
    title: 'The Studio Artist',
    essence: 'Your face and hair are part of the composition.',
    signals: [
      { questionId: 'makeup', optionIds: ['bold'], weight: 4 },
      { questionId: 'hair', optionIds: ['creative'], weight: 3 },
      { questionId: 'palette', optionIds: ['mixed', 'pastels'], weight: 1 },
      { questionId: 'explore', optionIds: ['makeup', 'hairstyles'], weight: 1 },
    ],
  },
  {
    id: 'quiet-icon',
    title: 'The Quiet Icon',
    essence: 'Considered, calm and quietly magnetic.',
    signals: [
      { questionId: 'energy', optionIds: ['chic'], weight: 3 },
      { questionId: 'values', optionIds: ['confidence'], weight: 2 },
      { questionId: 'accessory', optionIds: ['watch', 'bag'], weight: 2 },
      { questionId: 'makeup', optionIds: ['softglam', 'natural'], weight: 1 },
    ],
  },
  {
    id: 'street-poet',
    title: 'The Street Poet',
    essence: 'You read the city and write it back in sneakers.',
    signals: [
      { questionId: 'energy', optionIds: ['street'], weight: 4 },
      { questionId: 'accessory', optionIds: ['shoes'], weight: 2 },
      { questionId: 'inspiration', optionIds: ['trend'], weight: 2 },
      { questionId: 'hair', optionIds: ['creative'], weight: 1 },
    ],
  },
  {
    id: 'free-spirit',
    title: 'The Free Spirit',
    essence: 'You dress by mood, and the mood is always interesting.',
    signals: [
      { questionId: 'inspiration', optionIds: ['instinct', 'color'], weight: 2 },
      { questionId: 'makeup', optionIds: ['depends'], weight: 2 },
      { questionId: 'values', optionIds: ['versatility'], weight: 2 },
      { questionId: 'explore', optionIds: ['layering', 'colors'], weight: 1 },
    ],
  },
];

/** Stable, order-independent hash used only for tie-breaking & copy variety. */
export function hashAnswers(answers: QuizAnswers): number {
  const keys = Object.keys(answers).sort();
  let h = 2166136261;
  for (const key of keys) {
    const value = `${key}=${answers[key] ?? ''};`;
    for (let i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return Math.abs(h);
}

export function pickArchetype(answers: QuizAnswers): Archetype {
  const scored = ARCHETYPES.map((archetype) => {
    let score = 0;
    for (const signal of archetype.signals) {
      const chosen = answers[signal.questionId];
      if (isAnswered(answers, signal.questionId) && chosen && signal.optionIds.includes(chosen)) {
        score += signal.weight;
      }
    }
    return { archetype, score };
  });

  const best = Math.max(...scored.map((s) => s.score));
  const tied = scored.filter((s) => s.score === best);
  if (best === 0) {
    // No signals: pick deterministically from the hash so repeat sessions vary.
    return ARCHETYPES[hashAnswers(answers) % ARCHETYPES.length] as Archetype;
  }
  return (tied[hashAnswers(answers) % tied.length] as { archetype: Archetype }).archetype;
}

/** Titles Gemini may choose from — keeps AI-written copy inside reviewed bounds. */
export const ARCHETYPE_TITLES = ARCHETYPES.map((a) => a.title);

/** Short phrases used to ground copy in what the participant actually said. */
export function answerLabels(answers: QuizAnswers): Record<string, string | null> {
  return {
    energy: labelFor('energy', answers.energy),
    inspiration: labelFor('inspiration', answers.inspiration),
    palette: labelFor('palette', answers.palette),
    accessory: labelFor('accessory', answers.accessory),
    hair: labelFor('hair', answers.hair),
    makeup: labelFor('makeup', answers.makeup),
    values: labelFor('values', answers.values),
    explore: labelFor('explore', answers.explore),
  };
}
