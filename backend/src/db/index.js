import { newDb } from 'pg-mem';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance = null;
let pgClient = null;

export function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  // Use pg-mem in-memory PostgreSQL emulator for fast, reliable, zero-config domain and invariant tests
  const db = newDb();

  // Register gen_random_uuid() function in pg-mem as impure so it evaluates uniquely per row
  db.public.registerFunction({
    name: 'gen_random_uuid',
    impure: true,
    returns: db.public.getType('text'),
    implementation: () => crypto.randomUUID()
  });

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Execute schema
  db.public.none(schemaSql);

  const adapter = db.adapters.createPg();
  pgClient = new adapter.Client();
  pgClient.connect();

  dbInstance = {
    query: async (text, params = []) => {
      return await pgClient.query(text, params);
    },
    // Transaction helper
    transaction: async (callback) => {
      const client = pgClient;
      await client.query('BEGIN');
      try {
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    },
    reset: () => {
      dbInstance = null;
    }
  };

  return dbInstance;
}
