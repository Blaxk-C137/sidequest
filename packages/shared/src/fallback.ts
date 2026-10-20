import {
  isAnswered,
  isPrivate,
  labelFor,
  phraseFor,
  REPORT_DISCLAIMER,
  type QuizAnswers,
} from './questions.js';
import { hashAnswers, pickArchetype } from './archetypes.js';
import { scoreAnswers } from './scoring.js';
import type { Report } from './schemas.js';

/**
 * Offline deterministic report generator.
 *
 * This is the source of truth for BlaXaura's copy quality: it runs with no
 * network, no API key and no model, and it is also the fallback whenever
 * Gemini is unavailable, times out or returns something that fails validation.
 *
 * Every sentence is assembled from the participant's own chosen option labels,
 * so a report can never invent an outfit, a photograph or a physical detail.
 */

function pick<T>(items: T[], seed: number): T {
  return items[seed % items.length] as T;
}

function stripArticle(text: string): string {
  return text.replace(/^(a|an|the)\s+/i, '');
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Noun phrase for an answer, or null when skipped / declined. */
function phrase(answers: QuizAnswers, questionId: string): string | null {
  const value = answers[questionId];
  if (!isAnswered(answers, questionId) || isPrivate(questionId, value)) return null;
  return phraseFor(questionId, value);
}

/** Label for an answer, or null when skipped / declined. */
function label(answers: QuizAnswers, questionId: string): string | null {
  const value = answers[questionId];
  if (!isAnswered(answers, questionId) || isPrivate(questionId, value)) return null;
  return labelFor(questionId, value);
}

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buildSummary(answers: QuizAnswers, archetypeTitle: string, essence: string): string {
  const seed = hashAnswers(answers);
  const energy = phrase(answers, 'energy');
  const inspiration = phrase(answers, 'inspiration');
  const palette = phrase(answers, 'palette');
  const accessory = phrase(answers, 'accessory');
  const values = label(answers, 'values');
  const hair = phrase(answers, 'hair');
  const makeup = phrase(answers, 'makeup');
  const hasAccessoryNone = answers.accessory === 'none';

  // Sentence budget: the report is read on a phone, so we compose in priority
  // order and stop at ~440 characters (hard schema cap is 600).
  const BUDGET = 440;
  const sentences: string[] = [];
  const push = (sentence: string | null) => {
    if (!sentence) return;
    const candidate = [...sentences, sentence].join(' ');
    if (candidate.length > BUDGET && sentences.length > 0) return;
    sentences.push(sentence);
  };

  push(
    pick(
      [
        essence,
        `You are ${archetypeTitle} — ${essence.charAt(0).toLowerCase()}${essence.slice(1)}`,
        `${essence} That is the thread running through every answer you chose.`,
      ],
      seed,
    ),
  );

  if (energy && inspiration) {
    push(
      pick(
        [
          `Today you reached for ${energy}, shaped by ${inspiration}.`,
          `Your look today was built on ${energy}, with ${inspiration} doing the leading.`,
          `You built today's look on ${energy}, and ${inspiration} set the direction.`,
        ],
        seed >> 2,
      ),
    );
  } else if (energy) {
    push(`Today you reached for ${energy}, on your own terms.`);
  } else if (inspiration) {
    push(`Your look today started with ${inspiration}, and you built from there.`);
  }

  if (values) {
    push(
      palette
        ? `${values} is the standard you hold your style to, and your palette of ${palette} is how you express it without saying a word.`
        : `${values} is the standard you hold your style to, and it shows in how you choose.`,
    );
  }

  // The values sentence already names the palette, so the detail sentence uses
  // the accessory alone to avoid repeating "earth tones" twice.
  const accessoryDetail = accessory && !hasAccessoryNone ? accessory : null;
  const details = [
    ...(values && palette ? [] : palette ? [palette] : []),
    ...(accessoryDetail ? [accessoryDetail] : []),
  ];
  if (details.length > 1) {
    push(
      pick(
        [
          `The details you named — ${joinList(details)} — do a lot of the quiet work.`,
          `Your details lean ${joinList(details)}, which keeps the whole look coherent rather than loud.`,
          `${cap(joinList(details))} show up as your signature elements.`,
        ],
        seed >> 4,
      ),
    );
  } else if (details.length === 1) {
    push(
      pick(
        [
          `${cap(details[0] as string)} — that is where your signature lives.`,
          `The quiet finishing move in your answers: ${details[0]}.`,
        ],
        seed >> 4,
      ),
    );
  }

  const beauty = [hair, makeup].filter((value): value is string => Boolean(value));
  if (beauty.length === 2) {
    push(
      `Your ${stripArticle(beauty[0] as string)} and ${stripArticle(
        beauty[1] as string,
      )} read as deliberate parts of the composition, not afterthoughts.`,
    );
  } else if (beauty.length === 1) {
    push(`Your ${stripArticle(beauty[0] as string)} reads as a deliberate part of the composition, not an afterthought.`);
  }

  if (sentences.length === 1) {
    sentences.push('Every answer you gave points to a look that is deliberate rather than accidental.');
  }
  const summary = sentences.join(' ').replace(/\s+/g, ' ').trim();
  return summary.length > 600 ? `${summary.slice(0, 597).trimEnd()}…` : summary;
}

type Experiment = { title: string; detail: string };

const EXPLORE_EXPERIMENTS: Record<string, Experiment[]> = {
  colors: [
    {
      title: 'One unexpected pairing',
      detail:
        'Take a colour you already wear and sit one unexpected shade beside it — rust with lilac, olive with cobalt. Wear it somewhere low-stakes first.',
    },
    {
      title: 'The two-colour rule',
      detail:
        'Build one outfit from exactly two colours you love, then let texture do the rest. It is the quickest way to find new pairings that still feel like you.',
    },
  ],
  accessories: [
    {
      title: 'The finishing object',
      detail:
        'Choose one accessory you already own and make it the loudest thing in an otherwise plain outfit. Notice how differently the same clothes read.',
    },
    {
      title: 'Stack, don’t swap',
      detail:
        'Instead of replacing an accessory, layer a second one — another chain, a scarf through a bag strap. Small additions, new silhouette.',
    },
  ],
  layering: [
    {
      title: 'Three pieces, one colour',
      detail:
        'Try a three-layer look in a single colour family: base, mid, outer. Length and fabric do the talking while the palette stays calm.',
    },
    {
      title: 'The overshirt experiment',
      detail:
        'Use an overshirt, blazer or light jacket you already own as a layer over a look you would normally wear alone, then roll or push the sleeves.',
    },
  ],
  hairstyles: [
    {
      title: 'One change at a time',
      detail:
        'Pick a single variable next time — a parting, a height, a tucked edge, a head wrap — and keep everything else familiar. One change reads clearly.',
    },
    {
      title: 'Occasion styling, ordinary day',
      detail:
        'Take the style you save for events and wear a softened version of it on a normal day. Same shape, much less pressure.',
    },
  ],
  makeup: [
    {
      title: 'One feature forward',
      detail:
        'Choose one feature to emphasise and keep the rest quiet — a strong lip with bare skin, or a defined eye with nothing else. Contrast is the look.',
    },
    {
      title: 'Change the finish',
      detail:
        'Keep your usual routine but switch the finish: matte to satin, satin to gloss. The lowest-effort way to make a familiar look feel new.',
    },
  ],
  nothing: [
    {
      title: 'Keep the signature, document it',
      detail:
        'You already like your style, so photograph the formulas that work. A small album of your best three outfits becomes a reference for rushed mornings.',
    },
    {
      title: 'One deliberate swap',
      detail:
        'No overhaul needed: swap exactly one element of a look you love — shoes, or a bag — and see whether the formula still holds. Curiosity without cost.',
    },
  ],
};

const ARCHETYPE_EXPERIMENTS: Record<string, Experiment> = {
  'bold-curator': {
    title: 'Edit one loud piece',
    detail:
      'Take your boldest piece and pair it with the calmest thing you own. The contrast usually makes both look more expensive.',
  },
  'effortless-muse': {
    title: 'Upgrade the fabric',
    detail:
      'Keep the exact silhouette you already reach for, but choose a version in a heavier or softer fabric. Comfort stays, presence grows.',
  },
  'minimalist-spark': {
    title: 'One perfect outlier',
    detail:
      'Keep the clean base and add a single piece with texture — raw denim, brushed metal, a printed scarf. Restraint plus one surprise.',
  },
  'heritage-romantic': {
    title: 'Heritage, modern setting',
    detail:
      'Take one cultural or heirloom piece and style it with something plainly modern. The conversation between the two is the outfit.',
  },
  'studio-artist': {
    title: 'Colour echo',
    detail:
      'Pull one colour from your hair or makeup and repeat it once elsewhere — a nail, a strap, a liner flick. It reads as intentional from across a room.',
  },
  'quiet-icon': {
    title: 'The precise accessory',
    detail:
      'Choose one accessory and wear it with real intention — same side, same scale, same finish. Consistency is what makes quiet looks read as iconic.',
  },
  'street-poet': {
    title: 'Silhouette first',
    detail:
      'Plan the next outfit from the shoe up, choosing the shape before the colour. Strong proportions carry even the plainest pieces.',
  },
  'free-spirit': {
    title: 'Mood board, not rules',
    detail:
      'Collect five images that feel like your style right now, then name the one thing they all share. That is your current signature.',
  },
};

export function buildExperiments(answers: QuizAnswers, archetypeId: string): Experiment[] {
  const seed = hashAnswers(answers);
  const explore = answers.explore;
  const secondary = ARCHETYPE_EXPERIMENTS[archetypeId] ?? (ARCHETYPE_EXPERIMENTS['free-spirit'] as Experiment);
  const nothingAgain = pick(EXPLORE_EXPERIMENTS.nothing as Experiment[], seed >> 3);
  const layering = pick(EXPLORE_EXPERIMENTS.layering as Experiment[], seed >> 5);

  if (!isAnswered(answers, 'explore') || !explore || !EXPLORE_EXPERIMENTS[explore]) {
    return [secondary, nothingAgain];
  }

  const library = EXPLORE_EXPERIMENTS[explore] as Experiment[];
  const primary = pick(library, seed);
  if (primary.title === secondary.title) return [primary, layering];
  return [primary, secondary];
}

export function buildStrengths(answers: QuizAnswers): [string, string] {
  const seed = hashAnswers(answers);
  const energy = phrase(answers, 'energy');
  const accessory = phrase(answers, 'accessory');
  const palette = phrase(answers, 'palette');
  const values = label(answers, 'values');
  const hair = phrase(answers, 'hair');
  const makeup = phrase(answers, 'makeup');
  const accessoryNone = answers.accessory === 'none';
  const strengths: string[] = [];

  if (energy && accessory && !accessoryNone) {
    strengths.push(
      pick(
        [
          `You reached for ${energy} and finished it with ${accessory} — a clear point of view, which is the part people remember.`,
          `You pair ${energy} with ${accessory} without over-explaining it. That kind of clarity reads as confidence.`,
        ],
        seed,
      ),
    );
  } else if (energy && accessoryNone) {
    strengths.push(
      `You keep accessories restrained on purpose, which lets ${energy} carry the look. That is editing, not absence.`,
    );
  } else if (energy) {
    strengths.push(`You commit to ${energy} as an idea, not just a default — the look has a direction.`);
  } else if (palette) {
    strengths.push(`Your instinct for ${palette} gives your looks a recognisable through-line.`);
  } else {
    strengths.push(
      'You treat style as something to think about, not just something to wear — that curiosity is the strongest signal in your answers.',
    );
  }

  if (values && palette) {
    strengths.push(
      `${values} matters most to you, and your palette of ${palette} is how you express it without saying a word.`,
    );
  } else if (values) {
    strengths.push(
      `Leading with ${values} is a coherent style philosophy — it makes decisions faster and looks more like you.`,
    );
  } else if (hair || makeup) {
    const detail = joinList(
      [hair, makeup].filter((value): value is string => Boolean(value)).map(stripArticle),
    );
    strengths.push(
      `Your approach to ${detail} is deliberate; you treat those choices as styling, which is exactly what they are.`,
    );
  } else {
    strengths.push(
      'You are already editing rather than accumulating — the answers you did share point to a look with a point of view.',
    );
  }

  return [strengths[0] as string, strengths[1] as string];
}

export function buildConversationStarter(answers: QuizAnswers): string {
  const seed = hashAnswers(answers);
  const options: string[] = [];
  if (phrase(answers, 'palette')) {
    options.push('What is a colour you love but rarely wear — and what stops you?');
    options.push('If your palette had one more shade in it, what would it be?');
  }
  if (phrase(answers, 'accessory') && answers.accessory !== 'none') {
    options.push('Which accessory do you reach for so often it has become your signature?');
  }
  if (phrase(answers, 'energy')) {
    options.push('What is the outfit you would wear to feel most like yourself?');
  }
  if (phrase(answers, 'hair')) {
    options.push('What is one look you have always wanted to try?');
  }
  if (label(answers, 'values')) {
    options.push('Where did your sense of style come from — someone, somewhere, or something you saw?');
  }
  options.push('What is the piece in your wardrobe you would rescue first?');
  options.push('Whose style do you quietly admire, and what exactly do you admire about it?');
  return pick(options, seed >> 3);
}

export function generateFallbackReport(answers: QuizAnswers): Report {
  const archetype = pickArchetype(answers);
  const scores = scoreAnswers(answers);
  return {
    archetype: archetype.title,
    archetypeId: archetype.id,
    summary: buildSummary(answers, archetype.title, archetype.essence),
    expressionScore: scores.expressionScore,
    dimensions: scores.dimensions,
    strengths: buildStrengths(answers),
    experiments: buildExperiments(answers, archetype.id),
    conversationStarter: buildConversationStarter(answers),
    disclaimer: REPORT_DISCLAIMER,
    mode: 'fallback',
  };
}
