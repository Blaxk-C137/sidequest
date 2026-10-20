import { buildApp } from './app.js';
import { loadConfig } from './config.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp(config);

  const close = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void close('SIGINT'));
  process.on('SIGTERM', () => void close('SIGTERM'));

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(
      {
        database: config.databasePath,
        gemini: config.geminiEnabled ? config.geminiModel : 'off (deterministic fallback)',
        host: config.host,
      },
      'BlaXaura API ready',
    );
    if (config.host !== '127.0.0.1' && config.host !== 'localhost') {
      app.log.warn(
        'The server is bound beyond loopback. Traffic to this port is unencrypted — only do this on a trusted Wi-Fi network.',
      );
    }
  } catch (error) {
    app.log.error({ err: error }, 'failed to start');
    process.exit(1);
  }
}

void main();
