import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
export function openDatabase(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path, { timeout: 5000 })
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS requests(
      id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL,
      author_id TEXT NOT NULL, author_name TEXT NOT NULL, author_nickname TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', note TEXT NOT NULL DEFAULT '', hidden INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS votes(request_id TEXT NOT NULL REFERENCES requests(id), user_id TEXT NOT NULL,
      choice TEXT NOT NULL CHECK(choice IN ('support','oppose')), PRIMARY KEY(request_id,user_id));
    CREATE TABLE IF NOT EXISTS commands(actor TEXT NOT NULL, key TEXT NOT NULL, fingerprint TEXT NOT NULL,
      response TEXT NOT NULL, PRIMARY KEY(actor,key));
    CREATE TABLE IF NOT EXISTS moderation_log(id INTEGER PRIMARY KEY, request_id TEXT NOT NULL,
      actor TEXT NOT NULL, input TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS requests_created ON requests(created_at DESC,id);
    INSERT OR IGNORE INTO migrations VALUES(1);`)
  return db
}
export type DB = ReturnType<typeof openDatabase>
export function transaction<T>(db: DB, work: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try { const value = work(); db.exec('COMMIT'); return value } catch (e) { db.exec('ROLLBACK'); throw e }
}
