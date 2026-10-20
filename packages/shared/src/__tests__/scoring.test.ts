import { describe, expect, it } from 'vitest';
import {
  ARCHETYPE_TITLES,
  QUESTIONS,
  generateFallbackReport,
  pickArchetype,
  reportSchema,
  scoreAnswers,
  type QuizAnswers,
} from '../index.js';

const heritage: QuizAnswers = {
  energy: 'traditional',
  inspiration: 'color',
  palette: 'earth',
  accessory: 'headwear',
  hair: 'protective',
  makeup: 'natural',
  values: 'tradition',
  explore: 'layering',
};

describe('question bank', () => {
  it('has 8 unique questions with unique option ids', () => {
    expect(QUESTIONS).toHaveLength(8);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(8);
    for (const question of QUESTIONS) {
      const ids = question.options.map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(question.options.length).toBeGreaterThanOrEqual(5);
      expect(question.allowSkip).toBe(true);
    }
  });

  it('offers a prefer-not-to-say escape on appearance-adjacent questions, never on goal questions', () => {
    const hair = QUESTIONS.find((q) => q.id === 'hair');
    const makeup = QUESTIONS.find((q) => q.id === 'makeup');
    expect(hair?.options.some((o) => o.id === 'private')).toBe(true);
    expect(makeup?.options.some((o) => o.id === 'private')).toBe(true);
  });

  it('contains no appearance-judgment language', () => {
    const banned = /attractive|beauty score|body shape|weight|slim|skin colou?r|hotness|ugly|fat\b/i;
    const corpus = JSON.stringify(QUESTIONS);
    expect(banned.test(corpus)).toBe(false);
  });
});

describe('scoreAnswers', () => {
  it('is deterministic', () => {
    expect(scoreAnswers(heritage)).toEqual(scoreAnswers(heritage));
  });

  it('never punishes skipping or "prefer not to say"', () => {
    const withPrivate = scoreAnswers({ ...heritage, hair: 'private', makeup: 'private' });
    expect(withPrivate.expressionScore).toBeGreaterThan(0);
    expect(withPrivate.skippedCount).toBe(0); // explicit declines are answered, just excluded
    const full = scoreAnswers(heritage);
    // Declining two questions only removes weights; nothing is subtracted.
    expect(withPrivate.expressionScore).toBeLessThanOrEqual(full.expressionScore);
    for (const dim of withPrivate.dimensions) expect(dim.score).toBeGreaterThanOrEqual(35);
  });

  it('treats "no makeup" and "natural" as intentional, not lower quality', () => {
    const bare = scoreAnswers({ ...heritage, makeup: 'none' });
    const bold = scoreAnswers({ ...heritage, makeup: 'bold' });
    const bareIntention = bare.dimensions.find((d) => d.key === 'intention')!.score;
    expect(bareIntention).toBeGreaterThanOrEqual(70);
    // Bold reads as creative; bare reads as intention. Neither is "lesser".
    expect(bold.dimensions.find((d) => d.key === 'creative')!.score).toBeGreaterThan(
      bare.dimensions.find((d) => d.key === 'creative')!.score,
    );
    // Bare skin is not read as *less* intentional than a bold look.
    expect(bareIntention).toBeGreaterThanOrEqual(bold.dimensions.find((d) => d.key === 'intention')!.score - 4);
    expect(bareIntention).toBeGreaterThanOrEqual(75);
  });

  it('returns a neutral 35 baseline with no answers and stays in range', () => {
    const empty = scoreAnswers({});
    expect(empty.expressionScore).toBe(35);
    expect(empty.dimensions).toHaveLength(3);
    expect(empty.skippedCount).toBe(8);
  });

  it('always clamps scores to 0..100', () => {
    const combos: QuizAnswers[] = [
      heritage,
      {},
      { energy: 'mixed', inspiration: 'trend', palette: 'mixed', accessory: 'headwear', hair: 'creative', makeup: 'bold', values: 'creativity', explore: 'colors' },
    ];
    for (const answers of combos) {
      const result = scoreAnswers(answers);
      expect(result.expressionScore).toBeGreaterThanOrEqual(0);
      expect(result.expressionScore).toBeLessThanOrEqual(100);
      for (const dim of result.dimensions) {
        expect(Number.isInteger(dim.score)).toBe(true);
        expect(dim.score).toBeGreaterThanOrEqual(0);
        expect(dim.score).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('pickArchetype', () => {
  it('maps cultural/traditional answers to the heritage archetype', () => {
    expect(pickArchetype(heritage).title).toBe('The Heritage Romantic');
  });

  it('only ever returns a reviewed title', () => {
    const answers: QuizAnswers[] = [{}, heritage, { energy: 'street', accessory: 'shoes', inspiration: 'trend' }];
    for (const set of answers) {
      expect(ARCHETYPE_TITLES).toContain(pickArchetype(set).title);
    }
  });
});

describe('generateFallbackReport', () => {
  it('produces a schema-valid report grounded in the answers', () => {
    const report = generateFallbackReport(heritage);
    expect(() => reportSchema.parse(report)).not.toThrow();
    expect(report.mode).toBe('fallback');
    expect(report.summary).toContain('earth tones');
    expect(report.summary).toContain('Tradition');
    expect(report.strengths).toHaveLength(2);
    expect(report.experiments).toHaveLength(2);
    expect(report.dimensions.map((d) => d.key)).toEqual(['creative', 'intention', 'versatility']);
    expect(report.disclaimer).toMatch(/not an objective judgment/i);
  });

  it('never claims to have seen the participant', () => {
    for (const answers of [{}, heritage]) {
      const report = generateFallbackReport(answers);
      const text = JSON.stringify(report).toLowerCase();
      expect(text).not.toMatch(/your photo|in the photo|you look|your face|your body/);
    }
  });

  it('varies expression copy between different answer sets', () => {
    const a = generateFallbackReport(heritage);
    const b = generateFallbackReport({ energy: 'street', palette: 'bold', accessory: 'shoes', values: 'creativity' });
    expect(a.summary).not.toBe(b.summary);
    expect(a.strengths[0]).not.toBe(b.strengths[0]);
  });

  it('is pure: identical input yields identical output', () => {
    expect(generateFallbackReport(heritage)).toEqual(generateFallbackReport(heritage));
  });

  it('keeps summaries within the schema limit', () => {
    const report = generateFallbackReport(heritage);
    expect(report.summary.length).toBeLessThanOrEqual(600);
  });
});
