import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportSchema } from '@blaxaura/shared';
import { GeminiWriter } from '../services/gemini.js';
import { buildReport } from '../services/report.js';
import { fakeGemini, getReport, makeApp, sampleAnswers } from './helpers.js';

const apps: Awaited<ReturnType<typeof makeApp>>['app'][] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function app(options: Parameters<typeof makeApp>[0] = {}) {
  const built = await makeApp(options);
  apps.push(built.app);
  return built.app;
}

describe('POST /api/report', () => {
  it('returns a deterministic fallback report when Gemini is not configured', async () => {
    const server = await app();
    const report = await getReport(server);
    expect(() => reportSchema.parse(report)).not.toThrow();
    expect(report.mode).toBe('fallback');
    expect(report.summary).toContain('earth tones');
    expect(report.dimensions).toHaveLength(3);
  });

  it('rejects malformed answer payloads', async () => {
    const server = await app();
    const response = await server.inject({
      method: 'POST',
      url: '/api/report',
      payload: { answers: { energy: 'not-a-real-option', hacked: 'x' } },
    });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe('invalid_answers');
  });

  it('accepts a completely empty quiz and still produces a valid report', async () => {
    const server = await app();
    const response = await server.inject({ method: 'POST', url: '/api/report', payload: { answers: {} } });
    expect(response.statusCode).toBe(200);
    const report = reportSchema.parse(JSON.parse(response.body).report);
    expect(report.expressionScore).toBe(35);
    expect(report.mode).toBe('fallback');
  });

  it('uses Gemini copy while keeping deterministic scores', async () => {
    const server = await app({ geminiWriter: fakeGemini() });
    const deterministic = await getReport(await app());
    const report = await getReport(server);
    expect(report.mode).toBe('gemini');
    expect(report.summary).toContain('did the talking');
    expect(report.expressionScore).toBe(deterministic.expressionScore);
    expect(report.dimensions).toEqual(deterministic.dimensions);
    expect(report.archetypeId).toBe(deterministic.archetypeId);
  });

  it('falls back when the AI writer throws', async () => {
    const server = await app({
      geminiWriter: {
        write: async () => {
          throw new Error('upstream exploded');
        },
      },
    });
    const report = await getReport(server);
    expect(report.mode).toBe('fallback');
  });

  it('falls back when the AI writer returns nothing', async () => {
    const server = await app({ geminiWriter: { write: async () => null } });
    const report = await getReport(server);
    expect(report.mode).toBe('fallback');
  });

  it('records a session marker without storing answers', async () => {
    const server = await app();
    const start = await server.inject({ method: 'POST', url: '/api/session/start' });
    const { sessionId } = JSON.parse(start.body) as { sessionId: string };
    const response = await server.inject({
      method: 'POST',
      url: '/api/report',
      payload: { answers: sampleAnswers, sessionId },
    });
    expect(response.statusCode).toBe(200);
    const row = server.db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as Record<string, unknown>;
    expect(row.completed_at).toBeTruthy();
    expect(row.report_mode).toBe('fallback');
    expect(Object.keys(row).sort()).toEqual(['completed_at', 'created_at', 'id', 'report_mode']);
  });

  it('never exposes the API key or model input in the response', async () => {
    const server = await app({ geminiWriter: fakeGemini() });
    const response = await server.inject({ method: 'POST', url: '/api/report', payload: { answers: sampleAnswers } });
    expect(response.body).not.toMatch(/api[_-]?key|AIza/i);
  });
});

describe('GeminiWriter', () => {
  const baseOptions = {
    apiKey: 'test-key',
    model: 'test-model',
    timeoutMs: 1000,
    logger: { warn: vi.fn(), info: vi.fn() },
  };
  const deterministic = {
    archetypeId: 'heritage-romantic',
    archetypeTitle: 'The Heritage Romantic',
    expressionScore: 82,
    dimensions: [{ label: 'Creative Exploration', score: 80 }],
  };

  function writerWith(responseText: string | undefined) {
    const generateContent = vi.fn().mockResolvedValue({ text: responseText });
    return { writer: new GeminiWriter(baseOptions, { models: { generateContent } }), generateContent };
  }

  it('parses valid structured output', async () => {
    const payload = {
      archetype: 'The Heritage Romantic',
      summary:
        'Your earth tones and headwear carry a clear story, and the cultural detail is treated as the centre of the look rather than a decoration.',
      strengths: ['You use headwear as punctuation.', 'Your palette is consistent and intentional.'],
      experiments: [
        { title: 'Swap one layer', detail: 'Try the same look with a modern jacket over it and notice the shift.' },
        { title: 'One colour echo', detail: 'Repeat one earth tone in a small accessory for cohesion.' },
      ],
      conversationStarter: 'Where did you find the piece you are wearing?',
    };
    const { writer } = writerWith(JSON.stringify(payload));
    const copy = await writer.write(sampleAnswers, deterministic);
    expect(copy?.archetype).toBe('The Heritage Romantic');
    expect(copy?.strengths).toHaveLength(2);
  });

  it('rejects output that judges appearance', async () => {
    const payload = {
      archetype: 'The Heritage Romantic',
      summary: 'You look attractive today and your body shape suits these clothes beautifully, which is great.',
      strengths: ['You look great.', 'You look attractive.'],
      experiments: [
        { title: 'Lose weight', detail: 'Try a diet to improve how you look in these clothes overall.' },
        { title: 'Fix your face', detail: 'Use more makeup to improve your appearance for others.' },
      ],
      conversationStarter: 'You look nice, how are you?',
    };
    const { writer } = writerWith(JSON.stringify(payload));
    expect(await writer.write(sampleAnswers, deterministic)).toBeNull();
  });

  it('rejects unknown archetypes by mapping to a reviewed title', async () => {
    const payload = {
      archetype: 'The Unverified Vibe Oracle',
      summary:
        'Your earth tones and headwear carry a clear story, and the cultural detail is treated as the centre of the look rather than a decoration.',
      strengths: ['You use headwear as punctuation.', 'Your palette is consistent and intentional.'],
      experiments: [
        { title: 'Swap one layer', detail: 'Try the same look with a modern jacket over it and notice the shift.' },
        { title: 'One colour echo', detail: 'Repeat one earth tone in a small accessory for cohesion.' },
      ],
      conversationStarter: 'Where did you find the piece you are wearing?',
    };
    const { writer } = writerWith(JSON.stringify(payload));
    const copy = await writer.write(sampleAnswers, deterministic);
    expect(copy?.archetype).toBe('The Bold Curator');
  });

  it('retries once then returns null on bad JSON', async () => {
    const { writer, generateContent } = writerWith('not json at all');
    expect(await writer.write(sampleAnswers, deterministic)).toBeNull();
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('does not include names, phones or feedback in the prompt', async () => {
    const { writer, generateContent } = writerWith(undefined);
    await writer.write({ ...sampleAnswers, name: 'Ada', phone: '+2348012345678' }, deterministic);
    const request = generateContent.mock.calls[0]?.[0] as { contents: string };
    expect(request.contents).not.toContain('+2348012345678');
    expect(request.contents).not.toContain('Ada');
  });

  it('buildReport falls back if the sanitised copy fails schema validation', async () => {
    const report = await buildReport(sampleAnswers, {
      gemini: {
        write: async () => ({
          archetype: 'The Heritage Romantic',
          summary: 'too short',
          strengths: ['a', 'b'],
          experiments: [
            { title: 'x', detail: 'y' },
            { title: 'z', detail: 'w' },
          ],
          conversationStarter: 'q',
        }),
      },
      logger: { warn: vi.fn() },
    });
    expect(report.mode).toBe('fallback');
  });
});
