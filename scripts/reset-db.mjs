/**
 * Deletes the local SQLite database (and its WAL files).
 * Use this to wipe all saved contacts, feedback and session counters.
 */
import { rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

const root = process.cwd();
const dbPath = path.resolve(root, process.env.DATABASE_PATH ?? './data/blaxaura.sqlite');

if (!existsSync(dbPath)) {
  console.log(`Nothing to reset: ${dbPath} does not exist.`);
  process.exit(0);
}

if (!process.argv.includes('--yes')) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`Delete ${dbPath} and everything in it? Type "yes" to continue: `);
  rl.close();
  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Cancelled.');
    process.exit(0);
  }
}

for (const suffix of ['', '-wal', '-shm']) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}
console.log(`Deleted ${dbPath}. Stop the server first if it is running.`);
