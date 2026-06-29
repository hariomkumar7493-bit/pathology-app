'use strict';

/**
 * Tests for electron/sync.cjs
 *
 * Covers:
 * - pushPendingToRemote: pushes pending patients, reports, tests to remote
 * - pushPendingToRemote: pushes deleted (tombstones) as DELETE to remote, then hard-deletes locally
 * - pullAllFromRemote: smart merge — skips locally pending/deleted rows
 * - pullAllFromRemote: removes locally-synced rows not present in remote (remotely deleted)
 * - pullAllFromRemote: upserts new/updated rows from remote
 * - isOnline: returns true when remote responds, false otherwise
 * - Full sync: push → pull order
 */

const { createMemoryDb, generateId, parseJson, stringifyJson } = require('./helpers/memoryDb.cjs');

// ── Shared in-memory DB and https mock state ───────────────────────────────────

let db;
let mockResponses = {}; // url+method → { status, data }

jest.mock('../electron/db.cjs', () => {
  const { createMemoryDb, generateId, parseJson, stringifyJson } = require('./helpers/memoryDb.cjs');
  const db = createMemoryDb();
  return { getDb: () => db, getDbPath: () => ':memory:', generateId, parseJson, stringifyJson };
});

// Mock https to intercept all HTTP calls made by sync.cjs
jest.mock('https', () => {
  const makeReq = jest.fn((options, callback) => {
    const { get } = require('./helpers/mockHttp.cjs');
    const method = options.method || 'GET';
    const response = get(method, options.hostname, options.path) || { status: 500, data: {} };

    const mockRes = {
      statusCode: response.status,
      on: jest.fn((event, cb) => {
        if (event === 'data') cb(JSON.stringify(response.data));
        if (event === 'end') cb();
      }),
    };
    if (callback) callback(mockRes);

    return {
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      setTimeout: jest.fn(),
      destroy: jest.fn(),
    };
  });
  return { request: makeReq };
});

jest.mock('http', () => ({ request: jest.fn() }));

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  db = require('../electron/db.cjs').getDb();
  db.prepare('DELETE FROM patients').run();
  db.prepare('DELETE FROM reports').run();
  db.prepare('DELETE FROM tests').run();
  db.prepare('DELETE FROM test_categories').run();
  db.prepare('DELETE FROM settings').run();
  db.prepare('DELETE FROM users').run();
  require('./helpers/mockHttp.cjs').reset();
});

const { pushPendingToRemote, pullAllFromRemote, isOnline } = require('../electron/sync.cjs');
const mockHttp = require('./helpers/mockHttp.cjs');
const TOKEN = 'test-token';

// ══════════════════════════════════════════════════════════════════════════════
// isOnline
// ══════════════════════════════════════════════════════════════════════════════

describe('isOnline', () => {
  test('returns true when health endpoint responds', async () => {
    mockHttp.set('GET patholabpro.online/api/../api/health', { status: 200, data: { ok: true } });
    const online = await isOnline();
    expect(online).toBe(true);
  });

  test('returns false when request fails (offline)', async () => {
    // No mock set → https.request throws
    const https = require('https');
    https.request.mockImplementationOnce((opts, cb) => {
      const req = {
        on: jest.fn((ev, handler) => { if (ev === 'error') handler(new Error('ENOTFOUND')); }),
        write: jest.fn(), end: jest.fn(), setTimeout: jest.fn(), destroy: jest.fn(),
      };
      return req;
    });
    const online = await isOnline();
    expect(online).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// pushPendingToRemote — pending patients
// ══════════════════════════════════════════════════════════════════════════════

describe('pushPendingToRemote — pending patients', () => {
  test('pushes a pending patient with PUT and marks as synced', async () => {
    const pid = generateId();
    db.prepare("INSERT INTO patients (_id, name, age, gender, sync_status) VALUES (?, 'Alice', '30', 'Female', 'pending')").run(pid);

    mockHttp.set(`PUT patholabpro.online/api/patients/${pid}`, { status: 200, data: { success: true } });

    const result = await pushPendingToRemote(TOKEN);
    expect(result.pushed).toBeGreaterThanOrEqual(1);
    expect(result.errors).toBe(0);

    const row = db.prepare('SELECT sync_status FROM patients WHERE _id = ?').get(pid);
    expect(row.sync_status).toBe('synced');
  });

  test('falls back to POST if remote returns 404 on PUT', async () => {
    const pid = generateId();
    db.prepare("INSERT INTO patients (_id, name, age, gender, sync_status) VALUES (?, 'Bob', '25', 'Male', 'pending')").run(pid);

    mockHttp.set(`PUT patholabpro.online/api/patients/${pid}`, { status: 404, data: {} });
    mockHttp.set('POST patholabpro.online/api/patients', { status: 201, data: { _id: pid } });

    const result = await pushPendingToRemote(TOKEN);
    expect(result.pushed).toBeGreaterThanOrEqual(1);

    const row = db.prepare('SELECT sync_status FROM patients WHERE _id = ?').get(pid);
    expect(row.sync_status).toBe('synced');
  });

  test('increments errors when remote is unreachable', async () => {
    const pid = generateId();
    db.prepare("INSERT INTO patients (_id, name, age, gender, sync_status) VALUES (?, 'Carol', '40', 'Female', 'pending')").run(pid);

    const https = require('https');
    https.request.mockImplementationOnce((opts, cb) => ({
      on: jest.fn((ev, handler) => { if (ev === 'error') handler(new Error('Network error')); }),
      write: jest.fn(), end: jest.fn(), setTimeout: jest.fn(), destroy: jest.fn(),
    }));

    const result = await pushPendingToRemote(TOKEN);
    expect(result.errors).toBeGreaterThanOrEqual(1);

    const row = db.prepare('SELECT sync_status FROM patients WHERE _id = ?').get(pid);
    expect(row.sync_status).toBe('pending');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// pushPendingToRemote — deleted tombstones
// ══════════════════════════════════════════════════════════════════════════════

describe('pushPendingToRemote — deleted tombstones', () => {
  test('sends DELETE request for tombstoned patient and hard-deletes row on success', async () => {
    const pid = generateId();
    db.prepare("INSERT INTO patients (_id, name, age, gender, sync_status) VALUES (?, 'Ghost', '30', 'Male', 'deleted')").run(pid);

    mockHttp.set(`DELETE patholabpro.online/api/patients/${pid}`, { status: 200, data: { success: true } });

    const result = await pushPendingToRemote(TOKEN);
    expect(result.pushed).toBeGreaterThanOrEqual(1);

    const row = db.prepare('SELECT * FROM patients WHERE _id = ?').get(pid);
    expect(row).toBeUndefined();
  });

  test('treats 404 DELETE as success and hard-deletes row (already gone remotely)', async () => {
    const pid = generateId();
    db.prepare("INSERT INTO patients (_id, name, age, gender, sync_status) VALUES (?, 'AlreadyGone', '30', 'Male', 'deleted')").run(pid);

    mockHttp.set(`DELETE patholabpro.online/api/patients/${pid}`, { status: 404, data: {} });

    const result = await pushPendingToRemote(TOKEN);
    expect(result.pushed).toBeGreaterThanOrEqual(1);

    const row = db.prepare('SELECT * FROM patients WHERE _id = ?').get(pid);
    expect(row).toBeUndefined();
  });

  test('keeps tombstone row if DELETE request fails (offline)', async () => {
    const pid = generateId();
    db.prepare("INSERT INTO patients (_id, name, age, gender, sync_status) VALUES (?, 'FailedDelete', '30', 'Male', 'deleted')").run(pid);

    const https = require('https');
    https.request.mockImplementationOnce((opts, cb) => ({
      on: jest.fn((ev, handler) => { if (ev === 'error') handler(new Error('Offline')); }),
      write: jest.fn(), end: jest.fn(), setTimeout: jest.fn(), destroy: jest.fn(),
    }));

    await pushPendingToRemote(TOKEN);

    const row = db.prepare('SELECT * FROM patients WHERE _id = ?').get(pid);
    expect(row).toBeDefined();
    expect(row.sync_status).toBe('deleted');
  });

  test('sends DELETE for tombstoned report and hard-deletes on success', async () => {
    const rid = generateId();
    db.prepare("INSERT INTO reports (_id, patient_name, sync_status) VALUES (?, 'Alice', 'deleted')").run(rid);

    mockHttp.set(`DELETE patholabpro.online/api/reports/${rid}`, { status: 200, data: { success: true } });

    const result = await pushPendingToRemote(TOKEN);
    expect(result.pushed).toBeGreaterThanOrEqual(1);

    const row = db.prepare('SELECT * FROM reports WHERE _id = ?').get(rid);
    expect(row).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// pullAllFromRemote — smart merge
// ══════════════════════════════════════════════════════════════════════════════

describe('pullAllFromRemote — smart merge', () => {
  const baseRemotePatients = [
    { _id: 'remote1', name: 'Remote Alice', age: '30', gender: 'Female', referred_by: 'SELF', phone: '', email: '', address: '', created_at: new Date().toISOString() },
    { _id: 'remote2', name: 'Remote Bob', age: '25', gender: 'Male', referred_by: 'SELF', phone: '', email: '', address: '', created_at: new Date().toISOString() },
  ];

  function setRemoteMocks(patients = baseRemotePatients, reports = [], tests = [], categories = []) {
    mockHttp.set('GET patholabpro.online/api/patients', { status: 200, data: patients });
    mockHttp.set('GET patholabpro.online/api/reports', { status: 200, data: reports });
    mockHttp.set('GET patholabpro.online/api/tests', { status: 200, data: tests });
    mockHttp.set('GET patholabpro.online/api/tests/categories', { status: 200, data: categories });
    mockHttp.set('GET patholabpro.online/api/settings', { status: 200, data: {} });
    mockHttp.set('GET patholabpro.online/api/auth/users', { status: 200, data: [] });
  }

  test('inserts new remote patients into local DB', async () => {
    setRemoteMocks();
    await pullAllFromRemote(TOKEN);
    const all = db.prepare("SELECT * FROM patients WHERE sync_status != 'deleted'").all();
    expect(all.find(p => p._id === 'remote1')).toBeDefined();
    expect(all.find(p => p._id === 'remote2')).toBeDefined();
  });

  test('does NOT overwrite locally pending patient with remote data', async () => {
    const pid = generateId();
    db.prepare("INSERT INTO patients (_id, name, age, gender, sync_status) VALUES (?, 'Local Edit', '99', 'Male', 'pending')").run(pid);

    const remotePatients = [
      ...baseRemotePatients,
      { _id: pid, name: 'Remote Overwrite', age: '1', gender: 'Female', referred_by: 'SELF', phone: '', email: '', address: '', created_at: new Date().toISOString() },
    ];
    setRemoteMocks(remotePatients);
    await pullAllFromRemote(TOKEN);

    const row = db.prepare('SELECT * FROM patients WHERE _id = ?').get(pid);
    expect(row.name).toBe('Local Edit');
    expect(row.sync_status).toBe('pending');
  });

  test('does NOT restore a locally deleted (tombstoned) patient', async () => {
    const pid = generateId();
    db.prepare("INSERT INTO patients (_id, name, age, gender, sync_status) VALUES (?, 'Deleted Locally', '30', 'Male', 'deleted')").run(pid);

    const remotePatients = [
      ...baseRemotePatients,
      { _id: pid, name: 'Should Not Restore', age: '30', gender: 'Male', referred_by: 'SELF', phone: '', email: '', address: '', created_at: new Date().toISOString() },
    ];
    setRemoteMocks(remotePatients);
    await pullAllFromRemote(TOKEN);

    const row = db.prepare('SELECT * FROM patients WHERE _id = ?').get(pid);
    expect(row.sync_status).toBe('deleted');
    expect(row.name).toBe('Deleted Locally');
  });

  test('removes locally-synced patient that no longer exists on remote (remote delete)', async () => {
    const pid = generateId();
    db.prepare("INSERT INTO patients (_id, name, age, gender, sync_status) VALUES (?, 'Remotely Deleted', '30', 'Female', 'synced')").run(pid);

    setRemoteMocks(baseRemotePatients); // pid not in remote
    await pullAllFromRemote(TOKEN);

    const row = db.prepare('SELECT * FROM patients WHERE _id = ?').get(pid);
    expect(row).toBeUndefined();
  });

  test('does NOT remove locally pending patient missing from remote', async () => {
    const pid = generateId();
    db.prepare("INSERT INTO patients (_id, name, age, gender, sync_status) VALUES (?, 'New Local', '22', 'Female', 'pending')").run(pid);

    setRemoteMocks(baseRemotePatients); // pid not in remote yet
    await pullAllFromRemote(TOKEN);

    const row = db.prepare('SELECT * FROM patients WHERE _id = ?').get(pid);
    expect(row).toBeDefined();
    expect(row.sync_status).toBe('pending');
  });

  test('removes locally-synced reports for remotely deleted patients', async () => {
    const pid = generateId();
    const rid = generateId();
    db.prepare("INSERT INTO patients (_id, name, age, gender, sync_status) VALUES (?, 'Ghost', '30', 'Male', 'synced')").run(pid);
    db.prepare("INSERT INTO reports (_id, patient_id, patient_name, sync_status) VALUES (?, ?, 'Ghost', 'synced')").run(rid, pid);

    setRemoteMocks(baseRemotePatients); // pid not in remote
    await pullAllFromRemote(TOKEN);

    const report = db.prepare('SELECT * FROM reports WHERE _id = ?').get(rid);
    expect(report).toBeUndefined();
  });

  test('does NOT overwrite locally pending report', async () => {
    const rid = generateId();
    db.prepare("INSERT INTO reports (_id, patient_name, sync_status) VALUES (?, 'Pending Report', 'pending')").run(rid);

    const remoteReports = [
      { _id: rid, patient_name: 'Remote Overwrite', tests: [], results: [], ref_no: '1', specimen: 'BLOOD', investigation: '', doctor_name: '', doctor_designation: '', status: 'Completed', date_of_collection: new Date().toISOString(), date_of_reporting: new Date().toISOString(), created_at: new Date().toISOString() },
    ];
    setRemoteMocks(baseRemotePatients, remoteReports);
    await pullAllFromRemote(TOKEN);

    const row = db.prepare('SELECT * FROM reports WHERE _id = ?').get(rid);
    expect(row.patient_name).toBe('Pending Report');
    expect(row.sync_status).toBe('pending');
  });

  test('gracefully handles remote returning 500 (no local data wiped)', async () => {
    const pid = generateId();
    db.prepare("INSERT INTO patients (_id, name, age, gender, sync_status) VALUES (?, 'Existing', '30', 'Female', 'synced')").run(pid);

    mockHttp.set('GET patholabpro.online/api/patients', { status: 500, data: [] });
    mockHttp.set('GET patholabpro.online/api/reports', { status: 500, data: [] });
    mockHttp.set('GET patholabpro.online/api/tests', { status: 500, data: [] });
    mockHttp.set('GET patholabpro.online/api/tests/categories', { status: 500, data: [] });
    mockHttp.set('GET patholabpro.online/api/settings', { status: 500, data: {} });
    mockHttp.set('GET patholabpro.online/api/auth/users', { status: 500, data: [] });

    await pullAllFromRemote(TOKEN);

    const row = db.prepare('SELECT * FROM patients WHERE _id = ?').get(pid);
    expect(row).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Full sync — push then pull order
// ══════════════════════════════════════════════════════════════════════════════

describe('Full sync — push then pull', () => {
  test('pending patient is pushed and then pulled back as synced', async () => {
    const pid = generateId();
    db.prepare("INSERT INTO patients (_id, name, age, gender, sync_status) VALUES (?, 'New Patient', '30', 'Male', 'pending')").run(pid);

    mockHttp.set(`PUT patholabpro.online/api/patients/${pid}`, { status: 200, data: { success: true } });

    const remoteAfterPush = [
      { _id: pid, name: 'New Patient', age: '30', gender: 'Male', referred_by: 'SELF', phone: '', email: '', address: '', created_at: new Date().toISOString() },
    ];
    mockHttp.set('GET patholabpro.online/api/patients', { status: 200, data: remoteAfterPush });
    mockHttp.set('GET patholabpro.online/api/reports', { status: 200, data: [] });
    mockHttp.set('GET patholabpro.online/api/tests', { status: 200, data: [] });
    mockHttp.set('GET patholabpro.online/api/tests/categories', { status: 200, data: [] });
    mockHttp.set('GET patholabpro.online/api/settings', { status: 200, data: {} });
    mockHttp.set('GET patholabpro.online/api/auth/users', { status: 200, data: [] });

    const { sync } = require('../electron/sync.cjs');
    const result = await sync(TOKEN);
    expect(result.success).toBe(true);
    expect(result.push.pushed).toBeGreaterThanOrEqual(1);

    const row = db.prepare('SELECT sync_status FROM patients WHERE _id = ?').get(pid);
    expect(row.sync_status).toBe('synced');
  });

  test('deleted tombstone is removed after successful push and pull does not restore it', async () => {
    const pid = generateId();
    db.prepare("INSERT INTO patients (_id, name, age, gender, sync_status) VALUES (?, 'ToDelete', '30', 'Male', 'deleted')").run(pid);

    mockHttp.set(`DELETE patholabpro.online/api/patients/${pid}`, { status: 200, data: { success: true } });

    const remoteAfterDelete = [
      { _id: 'other1', name: 'Other', age: '25', gender: 'Female', referred_by: 'SELF', phone: '', email: '', address: '', created_at: new Date().toISOString() },
    ];
    mockHttp.set('GET patholabpro.online/api/patients', { status: 200, data: remoteAfterDelete });
    mockHttp.set('GET patholabpro.online/api/reports', { status: 200, data: [] });
    mockHttp.set('GET patholabpro.online/api/tests', { status: 200, data: [] });
    mockHttp.set('GET patholabpro.online/api/tests/categories', { status: 200, data: [] });
    mockHttp.set('GET patholabpro.online/api/settings', { status: 200, data: {} });
    mockHttp.set('GET patholabpro.online/api/auth/users', { status: 200, data: [] });

    const { sync } = require('../electron/sync.cjs');
    await sync(TOKEN);

    const row = db.prepare('SELECT * FROM patients WHERE _id = ?').get(pid);
    expect(row).toBeUndefined();
  });
});
