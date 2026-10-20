import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

/**
 * Configuration is read once, at boot, and never exposed to the client.
 * `.env` is loaded from the repo root (two levels up from apps/server/src).
 */
const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith('apps/server') ? '../..' : '.');
const envFiles = [path.join(repoRoot, '.env'), path.join(process.cwd(), '.env')];
for (const file of envFiles) {
  if (existsSync(file)) {
    dotenv.config({ path: file, override: false, quiet: true });
  }
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export type AppConfig = {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  host: string;
  databasePath: string;
  geminiApiKey: string;
  geminiModel: string;
  geminiTimeoutMs: number;
  geminiEnabled: boolean;
  adminPassword: string;
  adminSessionHours: number;
  trustProxy: boolean;
  cookieSecure: boolean;
  serveStatic: boolean;
  commitInfo: string;
};

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as AppConfig['nodeEnv'];
  const rawDbPath = process.env.DATABASE_PATH ?? './data/blaxaura.sqlite';
  const databasePath = path.isAbsolute(rawDbPath) ? rawDbPath : path.resolve(repoRoot, rawDbPath);
  const geminiMode = (process.env.GEMINI_MODE ?? 'auto').toLowerCase();

  const config: AppConfig = {
    nodeEnv,
    port: int(process.env.PORT, 8787),
    host: process.env.HOST ?? '127.0.0.1',
    databasePath,
    geminiApiKey: (process.env.GEMINI_API_KEY ?? '').trim(),
    geminiModel: (process.env.GEMINI_MODEL ?? '').trim() || 'gemini-3.8-flash',
    geminiTimeoutMs: int(process.env.GEMINI_TIMEOUT_MS, 12000),
    // Gemini is only attempted when a key exists and nobody forced offline mode.
    geminiEnabled: geminiMode !== 'off' && geminiMode !== 'false' && Boolean((process.env.GEMINI_API_KEY ?? '').trim()),
    adminPassword: process.env.ADMIN_PASSWORD ?? '',
    adminSessionHours: Math.max(1, int(process.env.ADMIN_SESSION_HOURS, 8)),
    trustProxy: bool(process.env.TRUST_PROXY, false),
    cookieSecure: bool(process.env.COOKIE_SECURE, false),
    serveStatic: bool(process.env.SERVE_STATIC, nodeEnv === 'production'),
    commitInfo: process.env.BLAXAURA_COMMIT ?? 'dev',
  };
  return { ...config, ...overrides };
}

/** Package version for the health endpoint. */
export function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}
