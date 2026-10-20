import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { MIGRATIONS, MIGRATION_TABLE } from './migrations.js';

export type Db = Database.Database;

/**
 * Opens (and creates) the local SQLite database, applying pending migrations.
 * The file lives outside any public directory and is git-ignored.
 */
export function openDatabase(databasePath: string): Db {
  if (databasePath !== ':memory:') {
    mkdirSync(path.dirname(databasePath), { recursive: true });
  }
  const db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  return db;
}

export function migrate(db: Db): void {
  db.exec(MIGRATION_TABLE);
  const applied = new Set(
    db.prepare('SELECT id FROM schema_migrations').all().map((row) => (row as { id: number }).id),
  );
  const record = db.prepare('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)');
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    const run = db.transaction(() => {
      db.exec(migration.sql);
      record.run(migration.id, migration.name, new Date().toISOString());
    });
    run();
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}
