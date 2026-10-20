/**
 * Forward-only SQLite migrations. Each entry runs once, in order, inside a
 * transaction; the applied id is recorded in `schema_migrations`.
 */
export type Migration = { id: number; name: string; sql: string };

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: 'initial-schema',
    sql: `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        report_mode TEXT CHECK (report_mode IN ('gemini', 'fallback'))
      );

      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
        stars INTEGER CHECK (stars IS NULL OR (stars BETWEEN 1 AND 5)),
        tags TEXT NOT NULL DEFAULT '[]',
        comment TEXT,
        retry_intent TEXT CHECK (retry_intent IN ('yes', 'maybe', 'no')),
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        display_name TEXT NOT NULL,
        normalized_phone TEXT NOT NULL UNIQUE,
        consent_text_version TEXT NOT NULL,
        consented_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);

      CREATE TABLE IF NOT EXISTS admin_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admin_sessions (
        token_hash TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        user_agent TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
    `,
  },
];

export const MIGRATION_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  );
`;
