import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { config } from '../config.js';
import { generateKey } from '../utils/keys.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', '..', 'data');
mkdirSync(dataDir, { recursive: true });

export const db = new Database(join(dataDir, 'safemarket.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                 TEXT PRIMARY KEY,
    email              TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash      TEXT NOT NULL,
    role               TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
    status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
    hwid               TEXT,
    hwid_label         TEXT,
    hwid_registered_at TEXT,
    created_at         TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activation_keys (
    id          TEXT PRIMARY KEY,
    key         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    type        TEXT NOT NULL DEFAULT 'user' CHECK (type IN ('user','admin')),
    status      TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('unused','used','revoked')),
    used_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
    note        TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    used_at     TEXT
  );

  CREATE TABLE IF NOT EXISTS broadcasts (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info','update','important')),
    blocking    INTEGER NOT NULL DEFAULT 0,
    created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_keys_status ON activation_keys(status);
  CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON broadcasts(created_at DESC);
`);

// Seed: garantir qu'au moins une clé admin existe au premier démarrage.
const adminKeyCount = db
  .prepare(`SELECT COUNT(*) AS n FROM activation_keys WHERE type = 'admin'`)
  .get() as { n: number };

if (adminKeyCount.n === 0) {
  const key = config.seedAdminKey?.trim() || generateKey();
  db.prepare(
    `INSERT INTO activation_keys (id, key, type, status, note) VALUES (?, ?, 'admin', 'unused', ?)`,
  ).run(crypto.randomUUID(), key, 'Clé admin initiale (générée automatiquement)');

  console.log('\n========================================================');
  console.log('  CLÉ ADMIN INITIALE — utilisez-la pour créer le compte admin');
  console.log(`  ${key}`);
  console.log('========================================================\n');
}
