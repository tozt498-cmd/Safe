import pg from 'pg';
import { config } from '../config.js';
import { generateKey } from '../utils/keys.js';

const { Pool } = pg;

// Neon/Postgres managé exige SSL ; en local sans SSL on désactive.
const isLocal = /localhost|127\.0\.0\.1/.test(config.databaseUrl);
export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 10,
});

/** Renvoie toutes les lignes. */
export async function all<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool.query(text, params);
  return r.rows as T[];
}

/** Renvoie la première ligne (ou undefined). */
export async function one<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const r = await pool.query(text, params);
  return r.rows[0] as T | undefined;
}

/** Exécute une requête d'écriture, renvoie le nombre de lignes affectées. */
export async function run(text: string, params: unknown[] = []): Promise<number> {
  const r = await pool.query(text, params);
  return r.rowCount ?? 0;
}

/** Transaction : tout ou rien. */
export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Crée le schéma s'il n'existe pas + sème une clé admin au premier démarrage. */
export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id                 TEXT PRIMARY KEY,
      email              TEXT NOT NULL UNIQUE,
      password_hash      TEXT NOT NULL,
      role               TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
      status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
      hwid               TEXT,
      hwid_label         TEXT,
      hwid_registered_at TIMESTAMPTZ,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS activation_keys (
      id          TEXT PRIMARY KEY,
      key         TEXT NOT NULL UNIQUE,
      type        TEXT NOT NULL DEFAULT 'user' CHECK (type IN ('user','admin')),
      status      TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('unused','used','revoked')),
      used_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
      note        TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      used_at     TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS broadcasts (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      body        TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info','update','important')),
      blocking    INTEGER NOT NULL DEFAULT 0,
      created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_keys_status ON activation_keys(status);
    CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON broadcasts(created_at DESC);
  `);

  const row = await one<{ n: string }>(
    `SELECT COUNT(*)::int AS n FROM activation_keys WHERE type = 'admin'`,
  );
  if (Number(row?.n ?? 0) === 0) {
    const key = config.seedAdminKey?.trim() || generateKey();
    await run(
      `INSERT INTO activation_keys (id, key, type, status, note) VALUES ($1, $2, 'admin', 'unused', $3)`,
      [crypto.randomUUID(), key, 'Clé admin initiale (générée automatiquement)'],
    );
    console.log('\n========================================================');
    console.log('  CLÉ ADMIN INITIALE — utilisez-la pour créer le compte admin');
    console.log(`  ${key}`);
    console.log('========================================================\n');
  }
}
