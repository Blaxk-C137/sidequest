/**
 * Boots a throwaway BlaXaura instance for Playwright:
 *  - fresh SQLite database (deleted first)
 *  - Gemini disabled, so the deterministic fallback report is exercised
 *  - built web client served by the API on a single port
 */
import { rmSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dbPath = path.join(root, 'data', 'e2e.sqlite');
for (const suffix of ['', '-wal', '-shm']) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}

for (const required of ['packages/shared/dist/index.js', 'apps/server/dist/index.js', 'apps/web/dist/index.html']) {
  if (!existsSync(path.join(root, required))) {
    console.error(`Missing build output: ${required}. Run \`npm run build\` first.`);
    process.exit(1);
  }
}

process.env.NODE_ENV = 'production';
process.env.PORT = '8799';
process.env.HOST = '127.0.0.1';
process.env.DATABASE_PATH = dbPath;
process.env.SERVE_STATIC = 'true';
process.env.GEMINI_MODE = 'off';
process.env.GEMINI_API_KEY = '';
process.env.ADMIN_PASSWORD = 'e2e-host-password';
process.env.ADMIN_SESSION_HOURS = '2';
process.env.LOG_LEVEL = 'warn';

const { buildApp } = await import('../apps/server/dist/app.js');
const { loadConfig } = await import('../apps/server/dist/config.js');

const config = loadConfig();
const app = await buildApp(config, {});
await app.listen({ port: config.port, host: config.host });
console.log(`e2e server listening on http://${config.host}:${config.port}`);

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
