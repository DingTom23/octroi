import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

export interface MigrateOptions {
  databaseUrl: string;
  migrationsDir: string;
}

export interface MigrateResult {
  applied: string[];
  alreadyApplied: string[];
}

/**
 * Apply pending SQL migrations in lexical order. Each migration runs inside
 * a transaction; failure rolls back and aborts the run.
 *
 * The runner tracks state in `_crawlpay_migrations(filename TEXT PK, applied_at TIMESTAMPTZ)`.
 * Re-running is idempotent — already-applied files are skipped silently.
 */
export async function runMigrations(opts: MigrateOptions): Promise<MigrateResult> {
  const pool = new Pool({ connectionString: opts.databaseUrl });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _crawlpay_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = readdirSync(opts.migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const { rows } = await pool.query<{ filename: string }>(
      'SELECT filename FROM _crawlpay_migrations',
    );
    const applied = new Set(rows.map((r) => r.filename));
    const alreadyApplied = files.filter((f) => applied.has(f));
    const pending = files.filter((f) => !applied.has(f));

    const result: MigrateResult = { applied: [], alreadyApplied };

    for (const file of pending) {
      const sql = readFileSync(join(opts.migrationsDir, file), 'utf-8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO _crawlpay_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        result.applied.push(file);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw new Error(
          `Migration ${file} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        client.release();
      }
    }

    return result;
  } finally {
    await pool.end();
  }
}
