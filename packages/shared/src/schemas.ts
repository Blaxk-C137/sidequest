import { z } from 'zod';

/** Max lengths keep the report readable on a 320px screen. */
export const reportSchema = z.object({
  archetype: z.string().min(3).max(64),
  archetypeId: z.string().min(3).max(64),
  summary: z.string().min(40).max(600),
  expressionScore: z.number().int().min(0).max(100),
  dimensions: z
    .array(
      z.object({
        key: z.enum(['creative', 'intention', 'versatility']),
        label: z.string().min(3).max(48),
        score: z.number().int().min(0).max(100),
        note: z.string().min(8).max(180),
      }),
    )
    .length(3),
  strengths: z.array(z.string().min(10).max(200)).length(2),
  experiments: z
    .array(
      z.object({
        title: z.string().min(4).max(64),
        detail: z.string().min(20).max(280),
      }),
    )
    .length(2),
  conversationStarter: z.string().min(10).max(200),
  disclaimer: z.string().min(10).max(200),
  mode: z.enum(['gemini', 'fallback']),
});

export type Report = z.infer<typeof reportSchema>;

export const quizAnswersSchema = z
  .object({
    energy: z.string().max(32).optional(),
    inspiration: z.string().max(32).optional(),
    palette: z.string().max(32).optional(),
    accessory: z.string().max(32).optional(),
    hair: z.string().max(32).optional(),
    makeup: z.string().max(32).optional(),
    values: z.string().max(32).optional(),
    explore: z.string().max(32).optional(),
  })
  .strict();

export const reportRequestSchema = z.object({
  answers: quizAnswersSchema,
  /** Optional participant-supplied session id (random UUID, no PII). */
  sessionId: z.string().uuid().optional(),
});

export const feedbackRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  stars: z.number().int().min(1).max(5).nullish(),
  tags: z.array(z.string().max(40)).max(10).default([]),
  comment: z.string().max(500).nullish(),
  retryIntent: z.enum(['yes', 'maybe', 'no']).nullish(),
});

export const FEEDBACK_TAGS = [
  'Fun',
  'Easy to use',
  'Loved my report',
  'Questions were interesting',
  'Too long',
  'Suggestions could improve',
  "Something didn't work",
] as const;

export const contactRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  phone: z.string().trim().min(6).max(24),
  consent: z.literal(true),
});

export const adminLoginSchema = z.object({
  password: z.string().min(1).max(200),
});

export const adminSetupSchema = z.object({
  password: z.string().min(10).max(200),
});

export const adminQuerySchema = z.object({
  q: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const deleteRequestSchema = z.object({
  confirm: z.literal(true),
});

export type FeedbackInput = z.infer<typeof feedbackRequestSchema>;
export type ContactInput = z.infer<typeof contactRequestSchema>;
