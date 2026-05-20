import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = resolve(root, 'db', 'carbon.sqlite');
const schemaPath = resolve(root, 'db', 'schema.sql');
const seedPath = resolve(root, 'db', 'seed.sql');
const shouldReset = process.argv.includes('--reset');

mkdirSync(dirname(dbPath), { recursive: true });

if (shouldReset && existsSync(dbPath)) {
  unlinkSync(dbPath);
}

const sql = [
  readFileSync(schemaPath, 'utf8'),
  readFileSync(seedPath, 'utf8'),
].join('\n\n');

const result = spawnSync('sqlite3', [dbPath], {
  input: sql,
  encoding: 'utf8',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(result.stderr || 'sqlite3 failed');
  process.exit(result.status ?? 1);
}

console.log(`Database ready: ${dbPath}`);
