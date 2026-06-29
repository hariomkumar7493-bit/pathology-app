'use strict';
const Database = require('better-sqlite3');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS patients (
    _id TEXT PRIMARY KEY, name TEXT, age TEXT, gender TEXT,
    phone TEXT, email TEXT, address TEXT, referred_by TEXT DEFAULT 'SELF',
    created_at TEXT, updated_at TEXT, sync_status TEXT DEFAULT 'synced'
  );
  CREATE TABLE IF NOT EXISTS test_categories (
    _id TEXT PRIMARY KEY, name TEXT, description TEXT,
    created_at TEXT, sync_status TEXT DEFAULT 'synced'
  );
  CREATE TABLE IF NOT EXISTS tests (
    _id TEXT PRIMARY KEY, name TEXT, category_id TEXT, category_name TEXT,
    specimen TEXT, price TEXT, parameters TEXT, created_at TEXT,
    sync_status TEXT DEFAULT 'synced'
  );
  CREATE TABLE IF NOT EXISTS reports (
    _id TEXT PRIMARY KEY, patient_id TEXT, patient_name TEXT, age TEXT,
    gender TEXT, referred_by TEXT, ref_no TEXT, specimen TEXT,
    investigation TEXT, doctor_name TEXT, doctor_designation TEXT,
    status TEXT DEFAULT 'Completed', date_of_collection TEXT,
    date_of_reporting TEXT, created_at TEXT, tests TEXT, results TEXT,
    sync_status TEXT DEFAULT 'synced'
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY, value TEXT, updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS users (
    _id TEXT PRIMARY KEY, name TEXT, phone TEXT, role TEXT,
    password TEXT, created_at TEXT, sync_status TEXT DEFAULT 'synced'
  );
  CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT, collection TEXT,
    operation TEXT, doc_id TEXT, data TEXT, created_at TEXT
  );
`;

function createMemoryDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

function generateId() {
  const ts = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const rand = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return (ts + rand).substring(0, 24);
}

function parseJson(val) {
  if (!val) return null;
  try { return JSON.parse(val); } catch { return val; }
}

function stringifyJson(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}

module.exports = { createMemoryDb, generateId, parseJson, stringifyJson };
