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

// Pull remote data and merge using remote_id matching (local _id never changes)
async function pullAllFromRemote(token) {
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const db = getDb();

  try {
    // Pull patients — match by remote_id, never delete local
    const patientsRes = await fetchJson(`${REMOTE_API}/patients`, { headers });
    if (patientsRes.status === 200 && Array.isArray(patientsRes.data)) {
      const remoteIdSet = new Set();
      for (const p of patientsRes.data) {
        const rid = String(p._id);
        remoteIdSet.add(rid);
        const local = db.prepare('SELECT _id, sync_status FROM patients WHERE remote_id = ?').get(rid);
        if (local && (local.sync_status === 'pending' || local.sync_status === 'deleted')) continue;
        if (local) {
          // Update existing row — keep local _id, update data
          db.prepare('UPDATE patients SET name = ?, age = ?, gender = ?, phone = ?, email = ?, address = ?, referred_by = ?, created_at = ?, sync_status = ? WHERE _id = ?')
            .run(p.name || '', String(p.age || ''), p.gender || '', p.phone || '', p.email || '', p.address || '', p.referred_by || 'SELF', p.created_at || new Date().toISOString(), 'synced', local._id);
        } else {
          // New from server — insert with local _id = server _id (they match for server-originated data)
          db.prepare('INSERT OR REPLACE INTO patients (_id, remote_id, name, age, gender, phone, email, address, referred_by, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(rid, rid, p.name || '', String(p.age || ''), p.gender || '', p.phone || '', p.email || '', p.address || '', p.referred_by || 'SELF', p.created_at || new Date().toISOString(), 'synced');
        }
      }
      // Re-mark synced locals not found on remote as pending (will re-push, not delete)
      const localSynced = db.prepare("SELECT _id, remote_id FROM patients WHERE sync_status = 'synced'").all();
      for (const local of localSynced) {
        const matchId = local.remote_id || local._id;
        if (!remoteIdSet.has(matchId)) {
          db.prepare("UPDATE patients SET sync_status = 'pending' WHERE _id = ?").run(local._id);
        }
      }
    }

    // Pull categories — match by remote_id
    const catRes = await fetchJson(`${REMOTE_API}/tests/categories`, { headers });
    if (catRes.status === 200 && Array.isArray(catRes.data)) {
      const remoteCatIds = new Set();
      for (const c of catRes.data) {
        const rid = String(c._id);
        remoteCatIds.add(rid);
        const local = db.prepare('SELECT _id, sync_status FROM test_categories WHERE remote_id = ?').get(rid);
        if (local && local.sync_status === 'pending') continue;
        if (local) {
          db.prepare('UPDATE test_categories SET name = ?, description = ?, created_at = ?, sync_status = ? WHERE _id = ?')
            .run(c.name || '', c.description || '', c.created_at || new Date().toISOString(), 'synced', local._id);
        } else {
          db.prepare('INSERT OR REPLACE INTO test_categories (_id, remote_id, name, description, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?)')
            .run(rid, rid, c.name || '', c.description || '', c.created_at || new Date().toISOString(), 'synced');
        }
      }
      const localSyncedCats = db.prepare("SELECT _id, remote_id FROM test_categories WHERE sync_status = 'synced'").all();
      for (const local of localSyncedCats) {
        const matchId = local.remote_id || local._id;
        if (!remoteCatIds.has(matchId)) {
          db.prepare("UPDATE test_categories SET sync_status = 'pending' WHERE _id = ?").run(local._id);
        }
      }
    }

    // Pull tests — match by remote_id
    const testsRes = await fetchJson(`${REMOTE_API}/tests`, { headers });
    if (testsRes.status === 200 && Array.isArray(testsRes.data)) {
      const remoteTestIds = new Set();
      for (const t of testsRes.data) {
        const rid = String(t._id);
        remoteTestIds.add(rid);
        const local = db.prepare('SELECT _id, sync_status FROM tests WHERE remote_id = ?').get(rid);
        if (local && local.sync_status === 'pending') continue;
        if (local) {
          db.prepare('UPDATE tests SET name = ?, category_id = ?, category_name = ?, specimen = ?, price = ?, parameters = ?, created_at = ?, sync_status = ? WHERE _id = ?')
            .run(t.name || '', t.category_id ? String(t.category_id) : null, t.category_name || null, t.specimen || '', String(t.price || ''), stringifyJson(t.parameters || []), t.created_at || new Date().toISOString(), 'synced', local._id);
        } else {
          db.prepare('INSERT OR REPLACE INTO tests (_id, remote_id, name, category_id, category_name, specimen, price, parameters, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(rid, rid, t.name || '', t.category_id ? String(t.category_id) : null, t.category_name || null, t.specimen || '', String(t.price || ''), stringifyJson(t.parameters || []), t.created_at || new Date().toISOString(), 'synced');
        }
      }
      const localSyncedTests = db.prepare("SELECT _id, remote_id FROM tests WHERE sync_status = 'synced'").all();
      for (const local of localSyncedTests) {
        const matchId = local.remote_id || local._id;
        if (!remoteTestIds.has(matchId)) {
          db.prepare("UPDATE tests SET sync_status = 'pending' WHERE _id = ?").run(local._id);
        }
      }
    }

    // Pull reports — match by remote_id, preserve local patient data
    const reportsRes = await fetchJson(`${REMOTE_API}/reports`, { headers });
    if (reportsRes.status === 200 && Array.isArray(reportsRes.data)) {
      const remoteReportIds = new Set();
      for (const r of reportsRes.data) {
        const rid = String(r._id);
        remoteReportIds.add(rid);
        const local = db.prepare('SELECT _id, sync_status, patient_name, age, gender, patient_id FROM reports WHERE remote_id = ?').get(rid);
        if (local && (local.sync_status === 'pending' || local.sync_status === 'deleted')) continue;
        // Preserve local patient data if server doesn't return it
        const patientName = r.patient_name || (local && local.patient_name) || '';
        const patientAge = r.age != null ? String(r.age) : (local && local.age) || '';
        const patientGender = r.gender || (local && local.gender) || '';
        const patientId = r.patient_id ? String(r.patient_id) : (local && local.patient_id) || null;
        if (local) {
          db.prepare('UPDATE reports SET patient_id = ?, patient_name = ?, age = ?, gender = ?, referred_by = ?, ref_no = ?, specimen = ?, investigation = ?, doctor_name = ?, doctor_designation = ?, status = ?, date_of_collection = ?, date_of_reporting = ?, created_at = ?, tests = ?, results = ?, sync_status = ? WHERE _id = ?')
            .run(patientId, patientName, patientAge, patientGender, r.referred_by || 'SELF', r.ref_no || '', r.specimen || 'BLOOD', r.investigation || '', r.doctor_name || '', r.doctor_designation || '', r.status || 'Completed', r.date_of_collection || new Date().toISOString(), r.date_of_reporting || new Date().toISOString(), r.created_at || new Date().toISOString(), stringifyJson(r.tests || []), stringifyJson(r.results || []), 'synced', local._id);
        } else {
          db.prepare('INSERT OR REPLACE INTO reports (_id, remote_id, patient_id, patient_name, age, gender, referred_by, ref_no, specimen, investigation, doctor_name, doctor_designation, status, date_of_collection, date_of_reporting, created_at, tests, results, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(rid, rid, patientId, patientName, patientAge, patientGender, r.referred_by || 'SELF', r.ref_no || '', r.specimen || 'BLOOD', r.investigation || '', r.doctor_name || '', r.doctor_designation || '', r.status || 'Completed', r.date_of_collection || new Date().toISOString(), r.date_of_reporting || new Date().toISOString(), r.created_at || new Date().toISOString(), stringifyJson(r.tests || []), stringifyJson(r.results || []), 'synced');
        }
      }
      const localSyncedReports = db.prepare("SELECT _id, remote_id FROM reports WHERE sync_status = 'synced'").all();
      for (const local of localSyncedReports) {
        const matchId = local.remote_id || local._id;
        if (!remoteReportIds.has(matchId)) {
          db.prepare("UPDATE reports SET sync_status = 'pending' WHERE _id = ?").run(local._id);
        }
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

    // Pull users — match by remote_id
    const usersRes = await fetchJson(`${REMOTE_API}/auth/users`, { headers });
    if (usersRes.status === 200 && Array.isArray(usersRes.data)) {
      for (const u of usersRes.data) {
        const rid = String(u._id);
        const local = db.prepare('SELECT _id, password FROM users WHERE remote_id = ?').get(rid);
        if (local) {
          db.prepare('UPDATE users SET name = ?, phone = ?, role = ?, created_at = ?, sync_status = ? WHERE _id = ?')
            .run(u.name || '', u.phone || '', u.role || 'staff', u.created_at || new Date().toISOString(), 'synced', local._id);
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
      const payload = { _id: p._id, name: p.name, age: p.age, gender: p.gender, phone: p.phone, email: p.email, address: p.address, referred_by: p.referred_by };
      const urlId = p.remote_id || p._id;
      const updateRes = await fetchJson(`${REMOTE_API}/patients/${urlId}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
      if (updateRes.status === 404) {
        // New patient — POST to server, store server _id in remote_id (keep local _id unchanged)
        const createRes = await fetchJson(`${REMOTE_API}/patients`, { method: 'POST', headers, body: JSON.stringify(payload) });
        const serverId = createRes.data?._id ? String(createRes.data._id) : null;
        if (serverId) {
          db.prepare('UPDATE patients SET remote_id = ?, sync_status = ? WHERE _id = ?').run(serverId, 'synced', p._id);
          pushed++; continue;
        }
      }
      db.prepare("UPDATE patients SET sync_status = 'synced' WHERE _id = ?").run(p._id);
      pushed++;
    } catch { errors++; }
  }

  // Push pending reports — use remote_id for PUT URL, store server _id in remote_id after POST
  const pendingReports = db.prepare("SELECT * FROM reports WHERE sync_status = 'pending'").all();
  for (const r of pendingReports) {
    try {
      const reportData = {
        _id: r._id, patient_id: r.patient_id, patient_name: r.patient_name, age: r.age, gender: r.gender,
        referred_by: r.referred_by, specimen: r.specimen, investigation: r.investigation,
        doctor_name: r.doctor_name, doctor_designation: r.doctor_designation,
        status: r.status, date_of_collection: r.date_of_collection,
        tests: parseJson(r.tests) || [], results: parseJson(r.results) || [],
      };
      const urlId = r.remote_id || r._id;
      const updateRes = await fetchJson(`${REMOTE_API}/reports/${urlId}`, { method: 'PUT', headers, body: JSON.stringify(reportData) });
      if (updateRes.status === 404) {
        const createRes = await fetchJson(`${REMOTE_API}/reports`, { method: 'POST', headers, body: JSON.stringify(reportData) });
        const serverId = createRes.data?._id ? String(createRes.data._id) : null;
        if (serverId) {
          db.prepare('UPDATE reports SET remote_id = ?, sync_status = ? WHERE _id = ?').run(serverId, 'synced', r._id);
          pushed++; continue;
        }
      }
      db.prepare("UPDATE reports SET sync_status = 'synced' WHERE _id = ?").run(r._id);
      pushed++;
    } catch { errors++; }
  }

  // Push pending test categories — use remote_id for PUT URL
  const pendingCats = db.prepare("SELECT * FROM test_categories WHERE sync_status = 'pending'").all();
  for (const c of pendingCats) {
    try {
      const payload = { _id: c._id, name: c.name, description: c.description || '' };
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
      const payload = { _id: t._id, name: t.name, category_id: t.category_id, category_name: t.category_name, specimen: t.specimen, price: t.price, parameters: parseJson(t.parameters) || [] };
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
      const payload = { _id: u._id, name: u.name, phone: u.phone, role: u.role, password: u.password };
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
