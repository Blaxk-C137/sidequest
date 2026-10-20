import { GoogleGenAI } from '@google/genai';
import { ARCHETYPE_TITLES, QUESTIONS, labelFor, type QuizAnswers } from '@blaxaura/shared';
import { sanitizeCopy, type SanitizedCopy } from '../lib/sanitize.js';

/**
 * Gemini is used for *copy only* — never for measurements.
 *
 * The deterministic engine (packages/shared) decides the archetype id, the
 * expression index and the three dimension scores. Gemini receives the chosen
 * option labels, is told what the deterministic result is, and may write a
 * warmer summary, two strengths, two experiments and one conversation starter.
 *
 * Privacy: only quiz option ids/labels are sent. No name, phone number,
 * feedback, IP address or session id ever leaves this machine.
 */

export type GeminiOptions = {
  apiKey: string;
  model: string;
  timeoutMs: number;
  logger: { warn: (obj: Record<string, unknown>, msg?: string) => void; info?: (obj: Record<string, unknown>, msg?: string) => void };
};

export type AiCopy = SanitizedCopy & { archetype: string };

/** Minimal contract the report service needs; lets tests inject a fake. */
export type GeminiCopyWriter = {
  write: (
    answers: QuizAnswers,
    deterministic: { archetypeId: string; archetypeTitle: string; expressionScore: number; dimensions: { label: string; score: number }[] },
  ) => Promise<AiCopy | null>;
};

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    archetype: { type: 'string', enum: [...ARCHETYPE_TITLES] },
    summary: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    experiments: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, detail: { type: 'string' } },
        required: ['title', 'detail'],
      },
    },
    conversationStarter: { type: 'string' },
  },
  required: ['archetype', 'summary', 'strengths', 'experiments', 'conversationStarter'],
} as const;

const SYSTEM_INSTRUCTION = `You are BlaXaura's style writer: warm, witty, editorial, and brief.

You receive a stranger's self-reported style answers. Write like a smart friend who works in fashion — never like a judge.

HARD RULES
- You have NOT seen this person, their outfit, their face, their body or any photo. Never imply otherwise.
- Never comment on attractiveness, body shape, weight, skin colour, ethnicity, age, gender or "flattering".
- Never say lifestyle or appearance choices are wrong, unkempt, or need fixing.
- No makeup, natural hair, protective styles, modest dress and cultural/traditional dress are all first-class, high-style choices. Treat them with the same respect and enthusiasm as bold or experimental choices.
- Do not invent brands, purchases, prices or events. No medical, financial or fitness advice.
- No emoji. No markdown. No headings. Plain sentences only.
- You do not produce numbers or scores. Scores are calculated elsewhere; never mention or invent one.

VOICE
- Second person, present tense, specific and grounded in the exact options chosen.
- British spelling (colour, jewellery, favourite).
- Summary: 2–3 sentences, max 600 characters.
- Strengths: exactly 2 short sentences, each max 200 characters, each naming something they actually chose.
- Experiments: exactly 2, phrased as invitations ("try", "experiment with"), achievable with clothes they likely already own.
- Conversation starter: one light, open question (max 200 characters) that the two people could actually talk about.
- Pick the archetype from the provided list that best fits.`;

export function buildPrompt(
  answers: QuizAnswers,
  deterministic: { archetypeId: string; archetypeTitle: string; expressionScore: number; dimensions: { label: string; score: number }[] },
): string {
  const lines: string[] = [];
  for (const question of QUESTIONS) {
    const optionId = answers[question.id];
    const label = labelFor(question.id, optionId);
    lines.push(`- ${question.prompt} → ${label ?? 'skipped'}`);
  }
  const scores = deterministic.dimensions.map((d) => `${d.label} ${d.score}/100`).join(', ');

  return `STYLE ANSWERS
${lines.join('\n')}

DETERMINISTIC RESULT (fixed, do not contradict or restate as a judgment)
Chosen archetype: ${deterministic.archetypeTitle}
Dimension readings: ${scores}

ALLOWED ARCHETYPES
${ARCHETYPE_TITLES.join(', ')}

Write the report copy now.`;
}

type GeminiLikeClient = {
  models: {
    generateContent: (params: Record<string, unknown>) => Promise<{ text?: string }>;
  };
};

export class GeminiWriter implements GeminiCopyWriter {
  private readonly client: GeminiLikeClient;
  private readonly options: GeminiOptions;

  constructor(options: GeminiOptions, client?: GeminiLikeClient) {
    this.options = options;
    this.client =
      client ??
      (new GoogleGenAI({
        apiKey: options.apiKey,
        httpOptions: { timeout: options.timeoutMs },
      }) as unknown as GeminiLikeClient);
  }

  /** Returns null on any failure; callers fall back to the deterministic report. */
  async write(
    answers: QuizAnswers,
    deterministic: { archetypeId: string; archetypeTitle: string; expressionScore: number; dimensions: { label: string; score: number }[] },
  ): Promise<AiCopy | null> {
    const prompt = buildPrompt(answers, deterministic);
    const delays = [0, 400];

    for (let attempt = 0; attempt < delays.length; attempt += 1) {
      if (delays[attempt]) await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      try {
        const response = await this.withTimeout(
          this.client.models.generateContent({
            model: this.options.model,
            contents: prompt,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              responseMimeType: 'application/json',
              responseSchema: RESPONSE_SCHEMA,
              temperature: 0.85,
              maxOutputTokens: 1024,
            },
          }),
        );
        const copy = this.parse(response.text);
        if (copy) return copy;
        this.options.logger.warn({ attempt }, 'gemini returned unusable copy; retrying or falling back');
      } catch (error) {
        this.options.logger.warn(
          { attempt, error: error instanceof Error ? error.message : 'unknown' },
          'gemini request failed',
        );
      }
    }
    return null;
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('gemini timeout')), this.options.timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private parse(text: string | undefined): AiCopy | null {
    if (!text) return null;
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return null;
    }
    if (!raw || typeof raw !== 'object') return null;
    const value = raw as Record<string, unknown>;
    const strings = (input: unknown): input is string[] =>
      Array.isArray(input) && input.every((item) => typeof item === 'string');

    if (typeof value.summary !== 'string' || typeof value.conversationStarter !== 'string') return null;
    if (!strings(value.strengths) || value.strengths.length !== 2) return null;
    if (!Array.isArray(value.experiments) || value.experiments.length !== 2) return null;
    const experiments = value.experiments.map((item) => {
      const record = item as Record<string, unknown>;
      return { title: String(record.title ?? ''), detail: String(record.detail ?? '') };
    });
    if (experiments.some((e) => !e.title || !e.detail)) return null;

    const archetype =
      typeof value.archetype === 'string' && ARCHETYPE_TITLES.includes(value.archetype)
        ? value.archetype
        : deterministicFallbackTitle(deterministicIdFromTitle(value.archetype));

    const copy = sanitizeCopy({
      summary: value.summary,
      strengths: value.strengths as string[],
      experiments,
      conversationStarter: value.conversationStarter,
    });
    if (!copy) return null;
    return { ...copy, archetype };
  }
}

/** Used only when the model returns an unknown title; keeps output reviewed. */
function deterministicIdFromTitle(title: unknown): string {
  return typeof title === 'string' ? title : '';
}

function deterministicFallbackTitle(value: string): string {
  return ARCHETYPE_TITLES.includes(value) ? value : (ARCHETYPE_TITLES[0] as string);
}
