import { buildApp } from '../app.js';
import { loadConfig, type AppConfig } from '../config.js';
import type { GeminiCopyWriter } from '../services/gemini.js';
import { reportSchema, type Report } from '@blaxaura/shared';

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return loadConfig({
    nodeEnv: 'test',
    databasePath: ':memory:',
    port: 0,
    host: '127.0.0.1',
    geminiEnabled: false,
    geminiApiKey: '',
    adminPassword: '',
    adminSessionHours: 1,
    geminiTimeoutMs: 1500,
    serveStatic: false,
    trustProxy: false,
    cookieSecure: false,
    commitInfo: 'test',
    ...overrides,
  });
}

export async function makeApp(options: { geminiWriter?: GeminiCopyWriter | null; databasePath?: string; config?: Partial<AppConfig> } = {}) {
  const config = testConfig(options.config);
  const app = await buildApp(config, {
    geminiWriter: options.geminiWriter ?? null,
    databasePath: options.databasePath,
  });
  await app.ready();
  return { app, config };
}

export const sampleAnswers = {
  energy: 'traditional',
  inspiration: 'color',
  palette: 'earth',
  accessory: 'headwear',
  hair: 'protective',
  makeup: 'natural',
  values: 'tradition',
  explore: 'layering',
};

export function fakeGemini(overrides: Partial<Awaited<ReturnType<GeminiCopyWriter['write']>>> = {}): GeminiCopyWriter {
  return {
    async write() {
      return {
        archetype: 'The Heritage Romantic',
        summary:
          'You wear stories rather than trends, and today the earth tones and headwear did the talking. There is a calm confidence in how you pair cultural detail with a favourite colour.',
        strengths: [
          'You treated headwear as the exclamation mark of the look, not an afterthought.',
          'Your earth-tone palette gives everything you wear a shared vocabulary.',
        ],
        experiments: [
          { title: 'One unexpected pairing', detail: 'Set a rust piece beside a lilac one and wear it somewhere low-stakes first.' },
          { title: 'Heritage, modern setting', detail: 'Style one heirloom piece with something plainly modern and see how the outfit reads.' },
        ],
        conversationStarter: 'What is the story behind the piece you wore today?',
        ...overrides,
      };
    },
  };
}

export async function getReport(app: Awaited<ReturnType<typeof buildApp>>, answers: Record<string, string> = sampleAnswers): Promise<Report> {
  const response = await app.inject({ method: 'POST', url: '/api/report', payload: { answers } });
  if (response.statusCode !== 200) throw new Error(`report failed: ${response.statusCode} ${response.body}`);
  return reportSchema.parse(JSON.parse(response.body).report);
}

/** Logs in and returns cookies + csrf token for authenticated admin calls. */
export async function adminLogin(
  app: Awaited<ReturnType<typeof buildApp>>,
  password = 'correct-horse-battery',
): Promise<{ cookie: string; csrf: string }> {
  const setup = await app.inject({ method: 'POST', url: '/api/admin/setup', payload: { password } });
  if (setup.statusCode !== 201 && setup.statusCode !== 409) {
    throw new Error(`setup failed: ${setup.statusCode} ${setup.body}`);
  }
  let response = setup;
  if (setup.statusCode === 409) {
    response = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password } });
  }
  const rawCookies = response.headers['set-cookie'];
  const cookieList = Array.isArray(rawCookies) ? rawCookies : [rawCookies ?? ''];
  const cookie = cookieList.map((value) => value.split(';')[0]).join('; ');
  const csrf = JSON.parse(response.body).csrfToken as string;
  return { cookie, csrf };
}
