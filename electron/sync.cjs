const { getDb, generateId, parseJson, stringifyJson } = require('./db.cjs');
const https = require('https');
const http = require('http');

const REMOTE_API = 'https://patholabpro.online/api';

// Simple fetch helper for Node.js (no native fetch in older Electron)
function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const lib = urlObj.protocol === 'https:' ? https : http;
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };
    const req = lib.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

// Check if we have internet connectivity
async function isOnline() {
  try {
    await fetchJson(`${REMOTE_API}/../api/health`, { method: 'GET' });
    return true;
  } catch {
    return false;
  }
}

// Helper: find a local row by matching local_id, remote_id, or _id (in that order)
// Returns the local _id if found, null otherwise
function findLocalRow(db, table, remoteDoc) {
  const rid = String(remoteDoc._id);
  const lid = remoteDoc.local_id ? String(remoteDoc.local_id) : null;
  // 1. Match by local_id field (sent in push payload, stored by MongoDB)
  if (lid) {
    const row = db.prepare(`SELECT _id FROM ${table} WHERE _id = ?`).get(lid);
    if (row) return row;
  }
  // 2. Match by remote_id column (set after previous successful push)
  const row = db.prepare(`SELECT _id FROM ${table} WHERE remote_id = ?`).get(rid);
  if (row) return row;
  // 3. Match by _id = server _id (backwards compat for server-originated data)
  const row3 = db.prepare(`SELECT _id FROM ${table} WHERE _id = ?`).get(rid);
  if (row3) return row3;
  return null;
}

// Helper: resolve a foreign key (patient_id) from server data to local _id
// Server may store either local_id or MongoDB _id as patient_id
function resolvePatientId(db, serverPatientId) {
  if (!serverPatientId) return null;
  const pid = String(serverPatientId);
  // 1. Direct match on local _id
  const p1 = db.prepare('SELECT _id FROM patients WHERE _id = ?').get(pid);
  if (p1) return p1._id;
  // 2. Match on remote_id
  const p2 = db.prepare('SELECT _id FROM patients WHERE remote_id = ?').get(pid);
  if (p2) return p2._id;
  // 3. Not found — return as-is (patient may not be synced yet)
  return pid;
}

// Helper: resolve a foreign key (category_id) from server data to local _id
function resolveCategoryId(db, serverCatId) {
  if (!serverCatId) return null;
  const cid = String(serverCatId);
  // 1. Direct match on local _id
  const c1 = db.prepare('SELECT _id FROM test_categories WHERE _id = ?').get(cid);
  if (c1) return c1._id;
  // 2. Match on remote_id
  const c2 = db.prepare('SELECT _id FROM test_categories WHERE remote_id = ?').get(cid);
  if (c2) return c2._id;
  // 3. Not found — return as-is
  return cid;
}

// Pull remote data and merge using local_id matching (full-proof, no duplicates)
async function pullAllFromRemote(token) {
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const db = getDb();

  try {
    // Pull patients — match by local_id first, then remote_id, then _id
    const patientsRes = await fetchJson(`${REMOTE_API}/patients`, { headers });
    if (patientsRes.status === 200 && Array.isArray(patientsRes.data)) {
      const remoteIdSet = new Set();
      for (const p of patientsRes.data) {
        const rid = String(p._id);
        remoteIdSet.add(rid);
        const local = findLocalRow(db, 'patients', p);
        if (local) {
          // Check sync_status — skip if pending or deleted (local changes take priority)
          const row = db.prepare('SELECT sync_status FROM patients WHERE _id = ?').get(local._id);
          if (row && (row.sync_status === 'pending' || row.sync_status === 'deleted')) continue;
          // Update existing row — keep local _id, set remote_id, update data
          db.prepare('UPDATE patients SET remote_id = ?, name = ?, age = ?, gender = ?, phone = ?, email = ?, address = ?, referred_by = ?, created_at = ?, sync_status = ? WHERE _id = ?')
            .run(rid, p.name || '', String(p.age || ''), p.gender || '', p.phone || '', p.email || '', p.address || '', p.referred_by || 'SELF', p.created_at || new Date().toISOString(), 'synced', local._id);
        } else {
          // New from server (created from other source like web) — insert with _id = server _id
          db.prepare('INSERT OR REPLACE INTO patients (_id, remote_id, name, age, gender, phone, email, address, referred_by, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(rid, rid, p.name || '', String(p.age || ''), p.gender || '', p.phone || '', p.email || '', p.address || '', p.referred_by || 'SELF', p.created_at || new Date().toISOString(), 'synced');
        }
      }
      // Re-mark synced locals not found on remote as pending — only if no remote_id (never pushed)
      const localSynced = db.prepare("SELECT _id, remote_id FROM patients WHERE sync_status = 'synced'").all();
      for (const local of localSynced) {
        if (!local.remote_id) {
          db.prepare("UPDATE patients SET sync_status = 'pending' WHERE _id = ?").run(local._id);
        }
      }
    }

    // Pull categories — match by local_id first, then remote_id, then _id
    const catRes = await fetchJson(`${REMOTE_API}/tests/categories`, { headers });
    if (catRes.status === 200 && Array.isArray(catRes.data)) {
      const remoteCatIds = new Set();
      for (const c of catRes.data) {
        const rid = String(c._id);
        remoteCatIds.add(rid);
        const local = findLocalRow(db, 'test_categories', c);
        if (local) {
          const row = db.prepare('SELECT sync_status FROM test_categories WHERE _id = ?').get(local._id);
          if (row && row.sync_status === 'pending') continue;
          db.prepare('UPDATE test_categories SET remote_id = ?, name = ?, description = ?, created_at = ?, sync_status = ? WHERE _id = ?')
            .run(rid, c.name || '', c.description || '', c.created_at || new Date().toISOString(), 'synced', local._id);
        } else {
          db.prepare('INSERT OR REPLACE INTO test_categories (_id, remote_id, name, description, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?)')
            .run(rid, rid, c.name || '', c.description || '', c.created_at || new Date().toISOString(), 'synced');
        }
      }
      const localSyncedCats = db.prepare("SELECT _id, remote_id FROM test_categories WHERE sync_status = 'synced'").all();
      for (const local of localSyncedCats) {
        if (!local.remote_id) db.prepare("UPDATE test_categories SET sync_status = 'pending' WHERE _id = ?").run(local._id);
      }
    }

    // Pull tests — match by local_id first, then remote_id, then _id
    const testsRes = await fetchJson(`${REMOTE_API}/tests`, { headers });
    if (testsRes.status === 200 && Array.isArray(testsRes.data)) {
      const remoteTestIds = new Set();
      for (const t of testsRes.data) {
        const rid = String(t._id);
        remoteTestIds.add(rid);
        const local = findLocalRow(db, 'tests', t);
        if (local) {
          const row = db.prepare('SELECT sync_status FROM tests WHERE _id = ?').get(local._id);
          if (row && row.sync_status === 'pending') continue;
          // Resolve category_id from server (could be local_id or MongoDB _id)
          const catId = t.category_id ? resolveCategoryId(db, t.category_id) : null;
          db.prepare('UPDATE tests SET remote_id = ?, name = ?, category_id = ?, category_name = ?, specimen = ?, price = ?, parameters = ?, created_at = ?, sync_status = ? WHERE _id = ?')
            .run(rid, t.name || '', catId, t.category_name || null, t.specimen || '', String(t.price || ''), stringifyJson(t.parameters || []), t.created_at || new Date().toISOString(), 'synced', local._id);
        } else {
          const catId = t.category_id ? resolveCategoryId(db, t.category_id) : null;
          db.prepare('INSERT OR REPLACE INTO tests (_id, remote_id, name, category_id, category_name, specimen, price, parameters, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(rid, rid, t.name || '', catId, t.category_name || null, t.specimen || '', String(t.price || ''), stringifyJson(t.parameters || []), t.created_at || new Date().toISOString(), 'synced');
        }
      }
      const localSyncedTests = db.prepare("SELECT _id, remote_id FROM tests WHERE sync_status = 'synced'").all();
      for (const local of localSyncedTests) {
        if (!local.remote_id) db.prepare("UPDATE tests SET sync_status = 'pending' WHERE _id = ?").run(local._id);
      }
    }

    // Pull reports — match by local_id first, then remote_id, then _id
    // Resolve patient_id from server (could be local_id or MongoDB _id)
    const reportsRes = await fetchJson(`${REMOTE_API}/reports`, { headers });
    if (reportsRes.status === 200 && Array.isArray(reportsRes.data)) {
      const remoteReportIds = new Set();
      for (const r of reportsRes.data) {
        const rid = String(r._id);
        remoteReportIds.add(rid);
        const local = findLocalRow(db, 'reports', r);
        if (local) {
          const row = db.prepare('SELECT sync_status, patient_name, age, gender, patient_id FROM reports WHERE _id = ?').get(local._id);
          if (row && (row.sync_status === 'pending' || row.sync_status === 'deleted')) continue;
          // Resolve patient_id: server may store local_id or MongoDB _id
          const resolvedPid = resolvePatientId(db, r.patient_id);
          // Preserve local patient data if server doesn't return it
          const patientName = r.patient_name || row.patient_name || '';
          const patientAge = r.age != null ? String(r.age) : row.age || '';
          const patientGender = r.gender || row.gender || '';
          const patientId = resolvedPid || row.patient_id || null;
          db.prepare('UPDATE reports SET remote_id = ?, patient_id = ?, patient_name = ?, age = ?, gender = ?, referred_by = ?, ref_no = ?, specimen = ?, investigation = ?, doctor_name = ?, doctor_designation = ?, status = ?, date_of_collection = ?, date_of_reporting = ?, created_at = ?, tests = ?, results = ?, sync_status = ? WHERE _id = ?')
            .run(rid, patientId, patientName, patientAge, patientGender, r.referred_by || 'SELF', r.ref_no || '', r.specimen || 'BLOOD', r.investigation || '', r.doctor_name || '', r.doctor_designation || '', r.status || 'Completed', r.date_of_collection || new Date().toISOString(), r.date_of_reporting || new Date().toISOString(), r.created_at || new Date().toISOString(), stringifyJson(r.tests || []), stringifyJson(r.results || []), 'synced', local._id);
        } else {
          // New from server — resolve patient_id
          const resolvedPid = resolvePatientId(db, r.patient_id);
          db.prepare('INSERT OR REPLACE INTO reports (_id, remote_id, patient_id, patient_name, age, gender, referred_by, ref_no, specimen, investigation, doctor_name, doctor_designation, status, date_of_collection, date_of_reporting, created_at, tests, results, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(rid, rid, resolvedPid, r.patient_name || '', r.age != null ? String(r.age) : '', r.gender || '', r.referred_by || 'SELF', r.ref_no || '', r.specimen || 'BLOOD', r.investigation || '', r.doctor_name || '', r.doctor_designation || '', r.status || 'Completed', r.date_of_collection || new Date().toISOString(), r.date_of_reporting || new Date().toISOString(), r.created_at || new Date().toISOString(), stringifyJson(r.tests || []), stringifyJson(r.results || []), 'synced');
        }
      }
      const localSyncedReports = db.prepare("SELECT _id, remote_id FROM reports WHERE sync_status = 'synced'").all();
      for (const local of localSyncedReports) {
        if (!local.remote_id) db.prepare("UPDATE reports SET sync_status = 'pending' WHERE _id = ?").run(local._id);
      }
    }

    // Pull settings
    const layoutRes = await fetchJson(`${REMOTE_API}/settings/report-layout`, { headers });
    if (layoutRes.status === 200 && layoutRes.data) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run('report_layout', stringifyJson(layoutRes.data), new Date().toISOString());
    }
    const docsRes = await fetchJson(`${REMOTE_API}/settings/referring-doctors`, { headers });
    if (docsRes.status === 200 && docsRes.data) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run('referring_doctors', stringifyJson(docsRes.data.doctors || ['SELF']), new Date().toISOString());
    }

    // Pull users — match by local_id first, then remote_id, then _id
    const usersRes = await fetchJson(`${REMOTE_API}/auth/users`, { headers });
    if (usersRes.status === 200 && Array.isArray(usersRes.data)) {
      for (const u of usersRes.data) {
        const rid = String(u._id);
        const local = findLocalRow(db, 'users', u);
        if (local) {
          const existing = db.prepare('SELECT password FROM users WHERE _id = ?').get(local._id);
          db.prepare('UPDATE users SET remote_id = ?, name = ?, phone = ?, role = ?, created_at = ?, sync_status = ? WHERE _id = ?')
            .run(rid, u.name || '', u.phone || '', u.role || 'staff', u.created_at || new Date().toISOString(), 'synced', local._id);
        } else {
          db.prepare('INSERT OR REPLACE INTO users (_id, remote_id, name, phone, role, password, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(rid, rid, u.name || '', u.phone || '', u.role || 'staff', '', u.created_at || new Date().toISOString(), 'synced');
        }
      }
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Push pending local changes to remote
async function pushPendingToRemote(token) {
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const db = getDb();
  let pushed = 0;
  let errors = 0;

  // Push deleted patients (tombstones) — use remote_id for URL
  const deletedPatients = db.prepare("SELECT _id, remote_id FROM patients WHERE sync_status = 'deleted'").all();
  for (const p of deletedPatients) {
    try {
      const urlId = p.remote_id || p._id;
      const res = await fetchJson(`${REMOTE_API}/patients/${urlId}`, { method: 'DELETE', headers });
      if (res.status === 200 || res.status === 204 || res.status === 404) {
        db.prepare('DELETE FROM patients WHERE _id = ?').run(p._id);
        pushed++;
      }
    } catch { errors++; }
  }

  // Push deleted reports (tombstones) — use remote_id for URL
  const deletedReports = db.prepare("SELECT _id, remote_id FROM reports WHERE sync_status = 'deleted'").all();
  for (const r of deletedReports) {
    try {
      const urlId = r.remote_id || r._id;
      const res = await fetchJson(`${REMOTE_API}/reports/${urlId}`, { method: 'DELETE', headers });
      if (res.status === 200 || res.status === 204 || res.status === 404) {
        db.prepare('DELETE FROM reports WHERE _id = ?').run(r._id);
        pushed++;
      }
    } catch { errors++; }
  }

  // Push pending patients — use remote_id for PUT URL, store server _id in remote_id after POST
  const pendingPatients = db.prepare("SELECT * FROM patients WHERE sync_status = 'pending'").all();
  for (const p of pendingPatients) {
    try {
      const payload = { _id: p._id, local_id: p._id, name: p.name, age: p.age, gender: p.gender, phone: p.phone, email: p.email, address: p.address, referred_by: p.referred_by };
      const urlId = p.remote_id || p._id;
      const updateRes = await fetchJson(`${REMOTE_API}/patients/${urlId}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
      if (updateRes.status === 404) {
        // New patient — POST to server, store server _id in remote_id (keep local _id unchanged)
        const createRes = await fetchJson(`${REMOTE_API}/patients`, { method: 'POST', headers, body: JSON.stringify(payload) });
        // Handle different response formats: { data: { _id } }, { _id }, { data: "..." }
        const serverId = createRes.data?._id ? String(createRes.data._id)
          : createRes._id ? String(createRes._id)
          : (typeof createRes.data === 'string' ? createRes.data : null);
        if (serverId) {
          db.prepare('UPDATE patients SET remote_id = ?, sync_status = ? WHERE _id = ?').run(serverId, 'synced', p._id);
          pushed++; continue;
        } else {
          console.error('[sync] Patient POST succeeded but no _id in response:', JSON.stringify(createRes));
          // Don't mark as synced — keep pending so it retries and stays visible locally
          continue;
        }
      }
      // PUT succeeded (200) — mark as synced
      db.prepare("UPDATE patients SET sync_status = 'synced' WHERE _id = ?").run(p._id);
      pushed++;
    } catch (err) { console.error('[sync] Patient push error:', err.message); errors++; }
  }

  // Push pending reports — use remote_id for PUT URL, store server _id in remote_id after POST
  const pendingReports = db.prepare("SELECT * FROM reports WHERE sync_status = 'pending'").all();
  for (const r of pendingReports) {
    try {
      const reportData = {
        _id: r._id, local_id: r._id, patient_id: r.patient_id, patient_name: r.patient_name, age: r.age, gender: r.gender,
        referred_by: r.referred_by, specimen: r.specimen, investigation: r.investigation,
        doctor_name: r.doctor_name, doctor_designation: r.doctor_designation,
        status: r.status, date_of_collection: r.date_of_collection,
        tests: parseJson(r.tests) || [], results: parseJson(r.results) || [],
      };
      const urlId = r.remote_id || r._id;
      const updateRes = await fetchJson(`${REMOTE_API}/reports/${urlId}`, { method: 'PUT', headers, body: JSON.stringify(reportData) });
      if (updateRes.status === 404) {
        const createRes = await fetchJson(`${REMOTE_API}/reports`, { method: 'POST', headers, body: JSON.stringify(reportData) });
        const serverId = createRes.data?._id ? String(createRes.data._id)
          : createRes._id ? String(createRes._id)
          : (typeof createRes.data === 'string' ? createRes.data : null);
        if (serverId) {
          db.prepare('UPDATE reports SET remote_id = ?, sync_status = ? WHERE _id = ?').run(serverId, 'synced', r._id);
          pushed++; continue;
        } else {
          console.error('[sync] Report POST succeeded but no _id in response:', JSON.stringify(createRes));
          continue;
        }
      }
      db.prepare("UPDATE reports SET sync_status = 'synced' WHERE _id = ?").run(r._id);
      pushed++;
    } catch (err) { console.error('[sync] Report push error:', err.message); errors++; }
  }

  // Push pending test categories — use remote_id for PUT URL
  const pendingCats = db.prepare("SELECT * FROM test_categories WHERE sync_status = 'pending'").all();
  for (const c of pendingCats) {
    try {
      const payload = { _id: c._id, local_id: c._id, name: c.name, description: c.description || '' };
      const urlId = c.remote_id || c._id;
      const updateRes = await fetchJson(`${REMOTE_API}/tests/categories/${urlId}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
      if (updateRes.status === 404) {
        const createRes = await fetchJson(`${REMOTE_API}/tests/categories`, { method: 'POST', headers, body: JSON.stringify(payload) });
        const serverId = createRes.data?._id ? String(createRes.data._id) : null;
        if (serverId) {
          db.prepare('UPDATE test_categories SET remote_id = ?, sync_status = ? WHERE _id = ?').run(serverId, 'synced', c._id);
          pushed++; continue;
        }
      }
      db.prepare("UPDATE test_categories SET sync_status = 'synced' WHERE _id = ?").run(c._id);
      pushed++;
    } catch { errors++; }
  }

  // Push pending tests — use remote_id for PUT URL
  const pendingTests = db.prepare("SELECT * FROM tests WHERE sync_status = 'pending'").all();
  for (const t of pendingTests) {
    try {
      const payload = { _id: t._id, local_id: t._id, name: t.name, category_id: t.category_id, category_name: t.category_name, specimen: t.specimen, price: t.price, parameters: parseJson(t.parameters) || [] };
      const body = JSON.stringify(payload);
      const urlId = t.remote_id || t._id;
      const updateRes = await fetchJson(`${REMOTE_API}/tests/${urlId}`, { method: 'PUT', headers, body });
      if (updateRes.status === 404) {
        const createRes = await fetchJson(`${REMOTE_API}/tests`, { method: 'POST', headers, body });
        const serverId = createRes.data?._id ? String(createRes.data._id) : null;
        if (serverId) {
          db.prepare('UPDATE tests SET remote_id = ?, sync_status = ? WHERE _id = ?').run(serverId, 'synced', t._id);
          pushed++; continue;
        }
      }
      db.prepare("UPDATE tests SET sync_status = 'synced' WHERE _id = ?").run(t._id);
      pushed++;
    } catch { errors++; }
  }

  // Push pending users — use remote_id for PUT URL
  const pendingUsers = db.prepare("SELECT * FROM users WHERE sync_status = 'pending'").all();
  for (const u of pendingUsers) {
    try {
      const payload = { _id: u._id, local_id: u._id, name: u.name, phone: u.phone, role: u.role, password: u.password };
      const body = JSON.stringify(payload);
      const urlId = u.remote_id || u._id;
      const updateRes = await fetchJson(`${REMOTE_API}/auth/users/${urlId}`, { method: 'PUT', headers, body });
      if (updateRes.status === 404) {
        const createRes = await fetchJson(`${REMOTE_API}/auth/users`, { method: 'POST', headers, body });
        const serverId = createRes.data?._id ? String(createRes.data._id) : null;
        if (serverId) {
          db.prepare('UPDATE users SET remote_id = ?, sync_status = ? WHERE _id = ?').run(serverId, 'synced', u._id);
          pushed++; continue;
        }
      }
      db.prepare("UPDATE users SET sync_status = 'synced' WHERE _id = ?").run(u._id);
      pushed++;
    } catch { errors++; }
  }

  return { pushed, errors };
}

// Full sync: push local changes, then pull remote changes
async function sync(token) {
  const db = getDb();
  try {
    // Step 1: Push pending local changes
    const pushResult = await pushPendingToRemote(token);

    // Step 2: Pull all remote data (replace local)
    const pullResult = await pullAllFromRemote(token);

    return { success: true, push: pushResult, pull: pullResult };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { sync, isOnline, pullAllFromRemote, pushPendingToRemote };
