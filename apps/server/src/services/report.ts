import { reportSchema, type QuizAnswers, type Report } from '@blaxaura/shared';
import { generateFallbackReport } from '@blaxaura/shared';
import type { AiCopy } from './gemini.js';

export type ReportDeps = {
  /** Present only when Gemini is configured and enabled. */
  gemini?: { write: (answers: QuizAnswers, deterministic: DeterministicSummary) => Promise<AiCopy | null> };
  logger?: { warn: (obj: Record<string, unknown>, msg?: string) => void };
};

export type DeterministicSummary = {
  archetypeId: string;
  archetypeTitle: string;
  expressionScore: number;
  dimensions: { label: string; score: number }[];
};

export function deterministicSummary(report: Report): DeterministicSummary {
  return {
    archetypeId: report.archetypeId,
    archetypeTitle: report.archetype,
    expressionScore: report.expressionScore,
    dimensions: report.dimensions.map((dimension) => ({ label: dimension.label, score: dimension.score })),
  };
}

/**
 * Builds the participant's report.
 *
 * Deterministic scores, archetype id and dimension readings are computed first
 * and are never replaced. Gemini may only write the prose, and only if every
 * field passes sanitisation and schema validation.
 */
export async function buildReport(answers: QuizAnswers, deps: ReportDeps = {}): Promise<Report> {
  const deterministic = generateFallbackReport(answers);
  if (!deps.gemini) return deterministic;

  try {
    const copy = await deps.gemini.write(answers, deterministicSummary(deterministic));
    if (!copy) return deterministic;

    const merged = reportSchema.parse({
      ...deterministic,
      archetype: copy.archetype,
      summary: copy.summary,
      strengths: copy.strengths,
      experiments: copy.experiments,
      conversationStarter: copy.conversationStarter,
      mode: 'gemini',
    });
    return merged;
  } catch (error) {
    deps.logger?.warn(
      { error: error instanceof Error ? error.message : 'unknown' },
      'gemini report rejected; served deterministic fallback',
    );
    return deterministic;
  }
}
