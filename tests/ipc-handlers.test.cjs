'use strict';

/**
 * Tests for electron/ipc-handlers.cjs
 * Covers:
 * - Patient CRUD with tombstone deletes
 * - Report CRUD with tombstone deletes
 * - Cascade delete: patient deletion tombstones their reports
 * - All GET queries exclude sync_status = 'deleted'
 * - getSyncStatus counts both pending + deleted
 * - Dashboard stats exclude deleted records
 * - Search patients excludes deleted
 */

const { generateId } = require('./helpers/memoryDb.cjs');
const handlers = {};

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn((channel, fn) => { handlers[channel] = fn; }),
  },
}));

jest.mock('../electron/db.cjs', () => {
  const { createMemoryDb, generateId, parseJson, stringifyJson } = require('./helpers/memoryDb.cjs');
  const db = createMemoryDb();
  return { getDb: () => db, getDbPath: () => ':memory:', generateId, parseJson, stringifyJson };
});

jest.mock('bcryptjs', () => ({
  hash: jest.fn(async (pw) => `hashed:${pw}`),
  compare: jest.fn(async (pw, hash) => hash === `hashed:${pw}`),
  hashSync: jest.fn((pw) => `hashed:${pw}`),
  compareSync: jest.fn((pw, hash) => hash === `hashed:${pw}`),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-jwt-token'),
  verify: jest.fn(() => ({ id: 'user1', role: 'admin' })),
}));

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(() => {
  const { registerIpcHandlers } = require('../electron/ipc-handlers.cjs');
  registerIpcHandlers(jest.fn());
});

const call = (channel, ...args) => handlers[channel](null, ...args);
const getDb = () => require('../electron/db.cjs').getDb();

beforeEach(() => {
  const db = getDb();
  db.prepare('DELETE FROM patients').run();
  db.prepare('DELETE FROM reports').run();
  db.prepare('DELETE FROM tests').run();
  db.prepare('DELETE FROM test_categories').run();
  db.prepare('DELETE FROM users').run();
  db.prepare('DELETE FROM settings').run();
});

// ══════════════════════════════════════════════════════════════════════════════
// PATIENT — CREATE
// ══════════════════════════════════════════════════════════════════════════════

describe('Patient — create', () => {
  test('returns a 24-char _id and echoes name', async () => {
    const result = await call('db:createPatient', { name: 'Alice', age: 30, gender: 'Female', phone: '9876543210' });
    expect(result._id).toHaveLength(24);
    expect(result.name).toBe('Alice');
  });

  test('new patient has sync_status = pending', async () => {
    const { _id } = await call('db:createPatient', { name: 'Bob', age: 25, gender: 'Male' });
    const row = getDb().prepare('SELECT sync_status FROM patients WHERE _id = ?').get(_id);
    expect(row.sync_status).toBe('pending');
  });

  test('persists all fields correctly', async () => {
    await call('db:createPatient', { name: 'Priya', age: 28, gender: 'Female', phone: '1234567890', referred_by: 'Dr. Sharma' });
    const all = await call('db:getPatients');
    expect(all[0].name).toBe('Priya');
    expect(all[0].referred_by).toBe('Dr. Sharma');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PATIENT — READ
// ══════════════════════════════════════════════════════════════════════════════

describe('Patient — read', () => {
  test('getPatients returns all active patients', async () => {
    await call('db:createPatient', { name: 'Alice', age: 30, gender: 'Female' });
    await call('db:createPatient', { name: 'Bob', age: 25, gender: 'Male' });
    const all = await call('db:getPatients');
    expect(all.length).toBe(2);
  });

  test('getPatients excludes deleted patients', async () => {
    const { _id } = await call('db:createPatient', { name: 'Deleted', age: 30, gender: 'Female' });
    await call('db:deletePatient', { id: _id });
    const all = await call('db:getPatients');
    expect(all.find(p => p._id === _id)).toBeUndefined();
  });

  test('getPatient returns null for a deleted patient', async () => {
    const { _id } = await call('db:createPatient', { name: 'Alice', age: 30, gender: 'Female' });
    await call('db:deletePatient', { id: _id });
    const result = await call('db:getPatient', { id: _id });
    expect(result).toBeNull();
  });

  test('getPatient returns correct patient when active', async () => {
    const { _id } = await call('db:createPatient', { name: 'Alice', age: 30, gender: 'Female' });
    const result = await call('db:getPatient', { id: _id });
    expect(result.name).toBe('Alice');
  });

  test('searchPatients matches by name', async () => {
    await call('db:createPatient', { name: 'Ravi Kumar', age: 40, gender: 'Male', phone: '9999999999' });
    const results = await call('db:searchPatients', { term: 'Ravi' });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].name).toBe('Ravi Kumar');
  });

  test('searchPatients excludes deleted patients', async () => {
    const { _id } = await call('db:createPatient', { name: 'GhostUser', age: 30, gender: 'Male', phone: '0000000000' });
    await call('db:deletePatient', { id: _id });
    const results = await call('db:searchPatients', { term: 'GhostUser' });
    expect(results.find(p => p._id === _id)).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PATIENT — UPDATE
// ══════════════════════════════════════════════════════════════════════════════

describe('Patient — update', () => {
  test('updates name and sets sync_status = pending', async () => {
    const { _id } = await call('db:createPatient', { name: 'Alice', age: 30, gender: 'Female' });
    getDb().prepare("UPDATE patients SET sync_status = 'synced' WHERE _id = ?").run(_id);
    await call('db:updatePatient', { id: _id, data: { name: 'Alice Updated', age: 31, gender: 'Female' } });
    const row = getDb().prepare('SELECT * FROM patients WHERE _id = ?').get(_id);
    expect(row.name).toBe('Alice Updated');
    expect(row.sync_status).toBe('pending');
  });

  test('returns success true', async () => {
    const { _id } = await call('db:createPatient', { name: 'Alice', age: 30, gender: 'Female' });
    const result = await call('db:updatePatient', { id: _id, data: { name: 'X', age: 1, gender: 'Male' } });
    expect(result.success).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PATIENT — DELETE (TOMBSTONE)
// ══════════════════════════════════════════════════════════════════════════════

describe('Patient — delete (tombstone)', () => {
  test('marks patient as deleted, does NOT hard-delete the row', async () => {
    const { _id } = await call('db:createPatient', { name: 'Alice', age: 30, gender: 'Female' });
    await call('db:deletePatient', { id: _id });
    const row = getDb().prepare('SELECT sync_status FROM patients WHERE _id = ?').get(_id);
    expect(row).toBeDefined();
    expect(row.sync_status).toBe('deleted');
  });

  test('cascades: tombstones synced reports belonging to the patient', async () => {
    const { _id: pid } = await call('db:createPatient', { name: 'Alice', age: 30, gender: 'Female' });
    const rid = generateId();
    getDb().prepare(
      "INSERT INTO reports (_id, patient_id, patient_name, sync_status) VALUES (?, ?, ?, 'synced')"
    ).run(rid, pid, 'Alice');

    await call('db:deletePatient', { id: pid });
    const report = getDb().prepare('SELECT sync_status FROM reports WHERE _id = ?').get(rid);
    expect(report.sync_status).toBe('deleted');
  });

  test('cascades: hard-deletes pending (never-synced) reports immediately', async () => {
    const { _id: pid } = await call('db:createPatient', { name: 'Alice', age: 30, gender: 'Female' });
    const rid = generateId();
    getDb().prepare(
      "INSERT INTO reports (_id, patient_id, patient_name, sync_status) VALUES (?, ?, ?, 'pending')"
    ).run(rid, pid, 'Alice');

    await call('db:deletePatient', { id: pid });
    const report = getDb().prepare('SELECT * FROM reports WHERE _id = ?').get(rid);
    expect(report).toBeUndefined();
  });

  test('deleted patient is invisible in getPatients (offline → online flow)', async () => {
    const { _id } = await call('db:createPatient', { name: 'Offline Delete', age: 22, gender: 'Male' });
    await call('db:deletePatient', { id: _id });

    // Simulate sync pull restoring patient (should be skipped by pull logic, but test UI layer)
    const visible = await call('db:getPatients');
    expect(visible.find(p => p._id === _id)).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// REPORT — CREATE
// ══════════════════════════════════════════════════════════════════════════════

describe('Report — create', () => {
  test('creates report with pending sync_status', async () => {
    const { _id: pid } = await call('db:createPatient', { name: 'Alice', age: 30, gender: 'Female' });
    const result = await call('db:createReport', {
      patient_id: pid, patient_name: 'Alice', age: '30', gender: 'Female',
      tests: [], results: [],
    });
    expect(result._id).toHaveLength(24);
    const row = getDb().prepare('SELECT sync_status FROM reports WHERE _id = ?').get(result._id);
    expect(row.sync_status).toBe('pending');
  });

  test('auto-increments ref_no across successive reports', async () => {
    const r1 = await call('db:createReport', { patient_name: 'A', tests: [], results: [] });
    const r2 = await call('db:createReport', { patient_name: 'B', tests: [], results: [] });
    expect(Number(r1.refNo)).toBeLessThan(Number(r2.refNo));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// REPORT — READ
// ══════════════════════════════════════════════════════════════════════════════

describe('Report — read', () => {
  test('getReports returns active reports', async () => {
    await call('db:createReport', { patient_name: 'Alice', tests: [], results: [] });
    await call('db:createReport', { patient_name: 'Bob', tests: [], results: [] });
    const all = await call('db:getReports');
    expect(all.length).toBe(2);
  });

  test('getReports excludes deleted reports', async () => {
    const r = await call('db:createReport', { patient_name: 'Alice', tests: [], results: [] });
    await call('db:deleteReport', { id: r._id });
    const all = await call('db:getReports');
    expect(all.find(x => x._id === r._id)).toBeUndefined();
  });

  test('getReport returns null for deleted report', async () => {
    const r = await call('db:createReport', { patient_name: 'Alice', tests: [], results: [] });
    await call('db:deleteReport', { id: r._id });
    const result = await call('db:getReport', { id: r._id });
    expect(result).toBeNull();
  });

  test('getReport parses tests and results as arrays', async () => {
    const r = await call('db:createReport', {
      patient_name: 'Alice', tests: [{ _id: 'test1', name: 'CBC' }], results: [],
    });
    const fetched = await call('db:getReport', { id: r._id });
    expect(Array.isArray(fetched.tests)).toBe(true);
    expect(fetched.tests[0].name).toBe('CBC');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// REPORT — DELETE (TOMBSTONE)
// ══════════════════════════════════════════════════════════════════════════════

describe('Report — delete (tombstone)', () => {
  test('marks synced report as deleted (row kept for sync push)', async () => {
    const r = await call('db:createReport', { patient_name: 'Alice', tests: [], results: [] });
    getDb().prepare("UPDATE reports SET sync_status = 'synced' WHERE _id = ?").run(r._id);
    await call('db:deleteReport', { id: r._id });
    const row = getDb().prepare('SELECT sync_status FROM reports WHERE _id = ?').get(r._id);
    expect(row).toBeDefined();
    expect(row.sync_status).toBe('deleted');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// REPORT — UPDATE RESULTS
// ══════════════════════════════════════════════════════════════════════════════

describe('Report — update results', () => {
  test('updating results sets sync_status = pending', async () => {
    const r = await call('db:createReport', { patient_name: 'Alice', tests: [], results: [] });
    getDb().prepare("UPDATE reports SET sync_status = 'synced' WHERE _id = ?").run(r._id);
    await call('db:updateReportResults', {
      id: r._id, results: [{ param_name: 'Hb', result_value: '14.5' }],
    });
    const row = getDb().prepare('SELECT sync_status FROM reports WHERE _id = ?').get(r._id);
    expect(row.sync_status).toBe('pending');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SYNC STATUS
// ══════════════════════════════════════════════════════════════════════════════

describe('Sync Status', () => {
  test('returns 0 pending when all records are synced', async () => {
    const status = await call('db:getSyncStatus');
    expect(status.pendingChanges).toBe(0);
  });

  test('counts newly created (pending) patient', async () => {
    await call('db:createPatient', { name: 'Alice', age: 30, gender: 'Female' });
    const status = await call('db:getSyncStatus');
    expect(status.pendingChanges).toBeGreaterThanOrEqual(1);
  });

  test('counts tombstoned (deleted) patient', async () => {
    const { _id } = await call('db:createPatient', { name: 'Alice', age: 30, gender: 'Female' });
    getDb().prepare("UPDATE patients SET sync_status = 'synced' WHERE _id = ?").run(_id);
    await call('db:deletePatient', { id: _id });
    const status = await call('db:getSyncStatus');
    expect(status.pendingChanges).toBeGreaterThanOrEqual(1);
  });

  test('counts tombstoned (deleted) report', async () => {
    const r = await call('db:createReport', { patient_name: 'Alice', tests: [], results: [] });
    getDb().prepare("UPDATE reports SET sync_status = 'synced' WHERE _id = ?").run(r._id);
    await call('db:deleteReport', { id: r._id });
    const status = await call('db:getSyncStatus');
    expect(status.pendingChanges).toBeGreaterThanOrEqual(1);
  });

  test('returns 0 after all tombstones are pushed (hard-deleted)', async () => {
    const { _id } = await call('db:createPatient', { name: 'Alice', age: 30, gender: 'Female' });
    getDb().prepare("UPDATE patients SET sync_status = 'synced' WHERE _id = ?").run(_id);
    await call('db:deletePatient', { id: _id });
    // Simulate sync engine hard-deleting after successful remote delete
    getDb().prepare('DELETE FROM patients WHERE _id = ?').run(_id);
    const status = await call('db:getSyncStatus');
    expect(status.pendingChanges).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

describe('Dashboard', () => {
  test('totalPatients excludes deleted', async () => {
    const { _id } = await call('db:createPatient', { name: 'Alice', age: 30, gender: 'Female' });
    await call('db:createPatient', { name: 'Bob', age: 25, gender: 'Male' });
    await call('db:deletePatient', { id: _id });
    const dash = await call('db:getDashboard');
    expect(dash.totalPatients).toBe(1);
  });

  test('totalReports excludes deleted', async () => {
    const r = await call('db:createReport', { patient_name: 'Alice', tests: [], results: [] });
    await call('db:createReport', { patient_name: 'Bob', tests: [], results: [] });
    getDb().prepare("UPDATE reports SET sync_status = 'synced' WHERE _id = ?").run(r._id);
    await call('db:deleteReport', { id: r._id });
    const dash = await call('db:getDashboard');
    expect(dash.totalReports).toBe(1);
  });

  test('recentReports list excludes deleted', async () => {
    const r = await call('db:createReport', { patient_name: 'Deleted', tests: [], results: [] });
    getDb().prepare("UPDATE reports SET sync_status = 'synced' WHERE _id = ?").run(r._id);
    await call('db:deleteReport', { id: r._id });
    const dash = await call('db:getDashboard');
    expect(dash.recentReports.find(x => x._id === r._id)).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// OFFLINE FLOW — end-to-end scenarios
// ══════════════════════════════════════════════════════════════════════════════

describe('Offline → Online flow scenarios', () => {
  test('patient created offline is visible immediately', async () => {
    const { _id } = await call('db:createPatient', { name: 'Offline Patient', age: 35, gender: 'Male' });
    const row = getDb().prepare("SELECT sync_status FROM patients WHERE _id = ?").get(_id);
    expect(row.sync_status).toBe('pending');
    const all = await call('db:getPatients');
    expect(all.find(p => p._id === _id)).toBeDefined();
  });

  test('patient deleted offline disappears immediately from UI', async () => {
    const { _id } = await call('db:createPatient', { name: 'Doomed', age: 20, gender: 'Female' });
    getDb().prepare("UPDATE patients SET sync_status = 'synced' WHERE _id = ?").run(_id);
    await call('db:deletePatient', { id: _id });
    const all = await call('db:getPatients');
    expect(all.find(p => p._id === _id)).toBeUndefined();
  });

  test('patient deleted offline keeps tombstone row for sync engine', async () => {
    const { _id } = await call('db:createPatient', { name: 'Doomed', age: 20, gender: 'Female' });
    getDb().prepare("UPDATE patients SET sync_status = 'synced' WHERE _id = ?").run(_id);
    await call('db:deletePatient', { id: _id });
    const row = getDb().prepare("SELECT * FROM patients WHERE _id = ?").get(_id);
    expect(row).toBeDefined();
    expect(row.sync_status).toBe('deleted');
  });

  test('pull does not restore a locally-deleted patient (simulated)', async () => {
    // Arrange: patient exists, was synced, deleted locally
    const pid = generateId();
    getDb().prepare(
      "INSERT INTO patients (_id, name, age, gender, sync_status) VALUES (?, 'Ghost', '30', 'Male', 'deleted')"
    ).run(pid);

    // Simulate the pull upsert logic: skip rows where sync_status = 'deleted'
    const localRow = getDb().prepare('SELECT sync_status FROM patients WHERE _id = ?').get(pid);
    const shouldSkip = localRow && (localRow.sync_status === 'pending' || localRow.sync_status === 'deleted');
    expect(shouldSkip).toBe(true);

    // Verify getPatients does NOT return it
    const all = await call('db:getPatients');
    expect(all.find(p => p._id === pid)).toBeUndefined();
  });

  test('pending patient is not overwritten by pull (simulated)', async () => {
    const { _id } = await call('db:createPatient', { name: 'Offline New Patient', age: 22, gender: 'Female' });
    // Still pending (not yet pushed)
    const localRow = getDb().prepare('SELECT sync_status FROM patients WHERE _id = ?').get(_id);
    const shouldSkip = localRow && localRow.sync_status === 'pending';
    expect(shouldSkip).toBe(true);
  });
});
