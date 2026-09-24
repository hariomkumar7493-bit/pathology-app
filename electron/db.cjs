const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let db = null;

function getDbPath() {
  const userData = app.getPath('userData');
  return path.join(userData, 'pathlabpro.db');
}

function getDb() {
  if (db) return db;
  const dbPath = getDbPath();
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  return db;
}

function initSchema(d) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      _id TEXT PRIMARY KEY,
      name TEXT,
      age TEXT,
      gender TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      referred_by TEXT DEFAULT 'SELF',
      created_at TEXT,
      updated_at TEXT,
      sync_status TEXT DEFAULT 'synced'
    );

    CREATE TABLE IF NOT EXISTS test_categories (
      _id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      created_at TEXT,
      sync_status TEXT DEFAULT 'synced'
    );

    CREATE TABLE IF NOT EXISTS tests (
      _id TEXT PRIMARY KEY,
      name TEXT,
      category_id TEXT,
      category_name TEXT,
      specimen TEXT,
      price TEXT,
      parameters TEXT,
      created_at TEXT,
      sync_status TEXT DEFAULT 'synced'
    );

    CREATE TABLE IF NOT EXISTS reports (
      _id TEXT PRIMARY KEY,
      patient_id TEXT,
      patient_name TEXT,
      age TEXT,
      gender TEXT,
      referred_by TEXT,
      ref_no TEXT,
      specimen TEXT,
      investigation TEXT,
      doctor_name TEXT,
      doctor_designation TEXT,
      status TEXT DEFAULT 'Completed',
      date_of_collection TEXT,
      date_of_reporting TEXT,
      created_at TEXT,
      tests TEXT,
      results TEXT,
      sync_status TEXT DEFAULT 'synced'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      _id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      role TEXT,
      referring_doctor_name TEXT DEFAULT '',
      password TEXT,
      created_at TEXT,
      sync_status TEXT DEFAULT 'synced'
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection TEXT,
      operation TEXT,
      doc_id TEXT,
      data TEXT,
      created_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
    CREATE INDEX IF NOT EXISTS idx_reports_patient_id ON reports(patient_id);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_collection ON sync_queue(collection);
  `);

  // Migration: add sample_id column to reports
  try {
    d.exec(`ALTER TABLE reports ADD COLUMN sample_id TEXT`);
  } catch (e) { /* column already exists */ }
  try {
    d.exec(`CREATE INDEX IF NOT EXISTS idx_reports_sample_id ON reports(sample_id)`);
  } catch (e) { /* ignore */ }

  // Migration: add referring_doctor_name column to users (doctor role mapping)
  try {
    d.exec(`ALTER TABLE users ADD COLUMN referring_doctor_name TEXT DEFAULT ''`);
  } catch (e) { /* column already exists */ }

  // Migration: add remote_id column to all tables (stores MongoDB _id from server)
  // local _id stays as primary key and never changes; remote_id is used for sync matching
  const tables = ['patients', 'reports', 'tests', 'test_categories', 'users'];
  for (const table of tables) {
    try {
      d.exec(`ALTER TABLE ${table} ADD COLUMN remote_id TEXT`);
    } catch (e) {
      // Column already exists — ignore
    }
  }
  // Index remote_id for fast lookups during pull
  for (const table of tables) {
    try {
      d.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_remote_id ON ${table}(remote_id)`);
    } catch (e) { /* ignore */ }
  }

  // Backfill: for existing synced rows, set remote_id = _id (they were synced with server IDs)
  for (const table of tables) {
    try {
      d.exec(`UPDATE ${table} SET remote_id = _id WHERE remote_id IS NULL AND sync_status = 'synced'`);
    } catch (e) { /* ignore */ }
  }
}

// Generate a unique ID (compatible with MongoDB ObjectId format)
function generateId() {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const random = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return (timestamp + random).substring(0, 24);
}

// Generate sample ID in format DDMMYY + sequence (e.g., 0704261, 0704262)
// Sequence resets daily — counts reports created today
function generateSampleId(db) {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const datePrefix = `${dd}${mm}${yy}`;

  // Count existing sample_ids with today's prefix to determine next sequence
  const row = db.prepare("SELECT COUNT(*) as c FROM reports WHERE sample_id LIKE ?").get(`${datePrefix}%`);
  const seq = (row.c || 0) + 1;

  return `${datePrefix}${seq}`;
}

// Helper: parse JSON field safely
function parseJson(val) {
  if (!val) return null;
  try { return JSON.parse(val); } catch { return val; }
}

// Helper: stringify JSON field
function stringifyJson(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}

module.exports = { getDb, getDbPath, generateId, generateSampleId, parseJson, stringifyJson };
