const { getDb, generateId, parseJson, stringifyJson } = require('./db.cjs');
const https = require('https');
const http = require('http');

const REMOTE_API = 'https://patholabpro.online/api';
const ELECTRON_API = `${REMOTE_API}/electron`;

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
    await fetchJson(`${REMOTE_API}/health`, { method: 'GET' });
    return true;
  } catch {
    return false;
  }
}

// ============ PULL: fetch from electron_* collections ============
// The MongoDB _id IS the local _id — no mismatch possible

async function pullAllFromRemote(token) {
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const db = getDb();

  try {
    // Pull patients from electron_patients
    const patientsRes = await fetchJson(`${ELECTRON_API}/patients`, { headers });
    if (patientsRes.status === 200 && Array.isArray(patientsRes.data)) {
      for (const p of patientsRes.data) {
        const id = String(p._id); // This IS the local _id
        const local = db.prepare('SELECT _id, sync_status FROM patients WHERE _id = ?').get(id);
        if (local && (local.sync_status === 'pending' || local.sync_status === 'deleted')) continue;
        db.prepare('INSERT OR REPLACE INTO patients (_id, remote_id, name, age, gender, phone, email, address, referred_by, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, id, p.name || '', String(p.age || ''), p.gender || '', p.phone || '', p.email || '', p.address || '', p.referred_by || 'SELF', p.created_at || new Date().toISOString(), 'synced');
      }
      // Re-mark synced locals not on server as pending (will re-push)
      const remoteIds = new Set(patientsRes.data.map(p => String(p._id)));
      const localSynced = db.prepare("SELECT _id FROM patients WHERE sync_status = 'synced'").all();
      for (const local of localSynced) {
        if (!remoteIds.has(local._id)) {
          db.prepare("UPDATE patients SET sync_status = 'pending' WHERE _id = ?").run(local._id);
        }
      }
    }

    // Pull test categories from electron_test_categories
    const catRes = await fetchJson(`${ELECTRON_API}/test-categories`, { headers });
    if (catRes.status === 200 && Array.isArray(catRes.data)) {
      for (const c of catRes.data) {
        const id = String(c._id);
        const local = db.prepare('SELECT _id, sync_status FROM test_categories WHERE _id = ?').get(id);
        if (local && local.sync_status === 'pending') continue;
        db.prepare('INSERT OR REPLACE INTO test_categories (_id, remote_id, name, description, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?)')
          .run(id, id, c.name || '', c.description || '', c.created_at || new Date().toISOString(), 'synced');
      }
      const remoteIds = new Set(catRes.data.map(c => String(c._id)));
      const localSynced = db.prepare("SELECT _id FROM test_categories WHERE sync_status = 'synced'").all();
      for (const local of localSynced) {
        if (!remoteIds.has(local._id)) db.prepare("UPDATE test_categories SET sync_status = 'pending' WHERE _id = ?").run(local._id);
      }
    }

    // Pull tests from electron_tests
    const testsRes = await fetchJson(`${ELECTRON_API}/tests`, { headers });
    if (testsRes.status === 200 && Array.isArray(testsRes.data)) {
      for (const t of testsRes.data) {
        const id = String(t._id);
        const local = db.prepare('SELECT _id, sync_status FROM tests WHERE _id = ?').get(id);
        if (local && local.sync_status === 'pending') continue;
        db.prepare('INSERT OR REPLACE INTO tests (_id, remote_id, name, category_id, category_name, specimen, price, parameters, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, id, t.name || '', t.category_id ? String(t.category_id) : null, t.category_name || null, t.specimen || '', String(t.price || ''), stringifyJson(t.parameters || []), t.created_at || new Date().toISOString(), 'synced');
      }
      const remoteIds = new Set(testsRes.data.map(t => String(t._id)));
      const localSynced = db.prepare("SELECT _id FROM tests WHERE sync_status = 'synced'").all();
      for (const local of localSynced) {
        if (!remoteIds.has(local._id)) db.prepare("UPDATE tests SET sync_status = 'pending' WHERE _id = ?").run(local._id);
      }
    }

    // Pull reports from electron_reports
    const reportsRes = await fetchJson(`${ELECTRON_API}/reports`, { headers });
    if (reportsRes.status === 200 && Array.isArray(reportsRes.data)) {
      for (const r of reportsRes.data) {
        const id = String(r._id);
        const local = db.prepare('SELECT _id, sync_status FROM reports WHERE _id = ?').get(id);
        if (local && (local.sync_status === 'pending' || local.sync_status === 'deleted')) continue;
        db.prepare('INSERT OR REPLACE INTO reports (_id, remote_id, patient_id, patient_name, age, gender, referred_by, ref_no, specimen, investigation, doctor_name, doctor_designation, status, date_of_collection, date_of_reporting, created_at, tests, results, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, id, r.patient_id ? String(r.patient_id) : null, r.patient_name || '', r.age != null ? String(r.age) : '', r.gender || '', r.referred_by || 'SELF', r.ref_no || '', r.specimen || 'BLOOD', r.investigation || '', r.doctor_name || '', r.doctor_designation || '', r.status || 'Completed', r.date_of_collection || new Date().toISOString(), r.date_of_reporting || new Date().toISOString(), r.created_at || new Date().toISOString(), stringifyJson(r.tests || []), stringifyJson(r.results || []), 'synced');
      }
      const remoteIds = new Set(reportsRes.data.map(r => String(r._id)));
      const localSynced = db.prepare("SELECT _id FROM reports WHERE sync_status = 'synced'").all();
      for (const local of localSynced) {
        if (!remoteIds.has(local._id)) db.prepare("UPDATE reports SET sync_status = 'pending' WHERE _id = ?").run(local._id);
      }
    }

    // Pull settings (from main API, not electron-specific)
    const layoutRes = await fetchJson(`${REMOTE_API}/settings/report-layout`, { headers });
    if (layoutRes.status === 200 && layoutRes.data) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run('report_layout', stringifyJson(layoutRes.data), new Date().toISOString());
    }
    const docsRes = await fetchJson(`${REMOTE_API}/settings/referring-doctors`, { headers });
    if (docsRes.status === 200 && docsRes.data) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run('referring_doctors', stringifyJson(docsRes.data.doctors || ['SELF']), new Date().toISOString());
    }

    // Pull users from electron_users
    const usersRes = await fetchJson(`${ELECTRON_API}/users`, { headers });
    if (usersRes.status === 200 && Array.isArray(usersRes.data)) {
      for (const u of usersRes.data) {
        const id = String(u._id);
        const local = db.prepare('SELECT _id, password FROM users WHERE _id = ?').get(id);
        if (local) {
          const password = u.password || local.password || '';
          db.prepare('UPDATE users SET remote_id = ?, name = ?, phone = ?, role = ?, password = ?, created_at = ?, sync_status = ? WHERE _id = ?')
            .run(id, u.name || '', u.phone || '', u.role || 'staff', password, u.created_at || new Date().toISOString(), 'synced', id);
        } else {
          db.prepare('INSERT OR REPLACE INTO users (_id, remote_id, name, phone, role, password, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, id, u.name || '', u.phone || '', u.role || 'staff', u.password || '', u.created_at || new Date().toISOString(), 'synced');
        }
      }
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============ PUSH: upsert to electron_* collections ============
// PUT /api/electron/{resource}/{local_id} — server upserts by _id = local_id
// No POST/404 dance — server creates or updates in one operation

async function pushPendingToRemote(token) {
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const db = getDb();
  let pushed = 0;
  let errors = 0;

  // Push deleted patients (tombstones)
  const deletedPatients = db.prepare("SELECT _id FROM patients WHERE sync_status = 'deleted'").all();
  for (const p of deletedPatients) {
    try {
      const res = await fetchJson(`${ELECTRON_API}/patients/${p._id}`, { method: 'DELETE', headers });
      if (res.status === 200 || res.status === 204 || res.status === 404) {
        db.prepare('DELETE FROM patients WHERE _id = ?').run(p._id);
        pushed++;
      }
    } catch { errors++; }
  }

  // Push deleted reports (tombstones)
  const deletedReports = db.prepare("SELECT _id FROM reports WHERE sync_status = 'deleted'").all();
  for (const r of deletedReports) {
    try {
      const res = await fetchJson(`${ELECTRON_API}/reports/${r._id}`, { method: 'DELETE', headers });
      if (res.status === 200 || res.status === 204 || res.status === 404) {
        db.prepare('DELETE FROM reports WHERE _id = ?').run(r._id);
        pushed++;
      }
    } catch { errors++; }
  }

  // Push pending patients — PUT upsert, local _id is the MongoDB _id
  const pendingPatients = db.prepare("SELECT * FROM patients WHERE sync_status = 'pending'").all();
  for (const p of pendingPatients) {
    try {
      const payload = {
        name: p.name, age: p.age, gender: p.gender, phone: p.phone,
        email: p.email, address: p.address, referred_by: p.referred_by, created_at: p.created_at
      };
      const res = await fetchJson(`${ELECTRON_API}/patients/${p._id}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
      if (res.status === 200) {
        db.prepare('UPDATE patients SET remote_id = ?, sync_status = ? WHERE _id = ?').run(p._id, 'synced', p._id);
        pushed++;
      } else {
        console.error('[sync] Patient PUT failed:', res.status, JSON.stringify(res.data));
        errors++;
      }
    } catch (err) { console.error('[sync] Patient push error:', err.message); errors++; }
  }

  // Push pending reports — PUT upsert
  const pendingReports = db.prepare("SELECT * FROM reports WHERE sync_status = 'pending'").all();
  for (const r of pendingReports) {
    try {
      const payload = {
        patient_id: r.patient_id, patient_name: r.patient_name, age: r.age, gender: r.gender,
        referred_by: r.referred_by, ref_no: r.ref_no, specimen: r.specimen, investigation: r.investigation,
        doctor_name: r.doctor_name, doctor_designation: r.doctor_designation,
        status: r.status, date_of_collection: r.date_of_collection, date_of_reporting: r.date_of_reporting,
        created_at: r.created_at,
        tests: parseJson(r.tests) || [], results: parseJson(r.results) || [],
      };
      const res = await fetchJson(`${ELECTRON_API}/reports/${r._id}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
      if (res.status === 200) {
        db.prepare('UPDATE reports SET remote_id = ?, sync_status = ? WHERE _id = ?').run(r._id, 'synced', r._id);
        pushed++;
      } else {
        console.error('[sync] Report PUT failed:', res.status, JSON.stringify(res.data));
        errors++;
      }
    } catch (err) { console.error('[sync] Report push error:', err.message); errors++; }
  }

  // Push pending test categories — PUT upsert
  const pendingCats = db.prepare("SELECT * FROM test_categories WHERE sync_status = 'pending'").all();
  for (const c of pendingCats) {
    try {
      const payload = { name: c.name, description: c.description || '', created_at: c.created_at };
      const res = await fetchJson(`${ELECTRON_API}/test-categories/${c._id}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
      if (res.status === 200) {
        db.prepare('UPDATE test_categories SET remote_id = ?, sync_status = ? WHERE _id = ?').run(c._id, 'synced', c._id);
        pushed++;
      } else { console.error('[sync] Category PUT failed:', res.status, JSON.stringify(res.data)); errors++; }
    } catch (err) { console.error('[sync] Category push error:', err.message); errors++; }
  }

  // Push pending tests — PUT upsert
  const pendingTests = db.prepare("SELECT * FROM tests WHERE sync_status = 'pending'").all();
  for (const t of pendingTests) {
    try {
      const payload = {
        name: t.name, category_id: t.category_id, category_name: t.category_name,
        specimen: t.specimen, price: t.price, parameters: parseJson(t.parameters) || [],
        created_at: t.created_at
      };
      const res = await fetchJson(`${ELECTRON_API}/tests/${t._id}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
      if (res.status === 200) {
        db.prepare('UPDATE tests SET remote_id = ?, sync_status = ? WHERE _id = ?').run(t._id, 'synced', t._id);
        pushed++;
      } else { console.error('[sync] Test PUT failed:', res.status, JSON.stringify(res.data)); errors++; }
    } catch (err) { console.error('[sync] Test push error:', err.message); errors++; }
  }

  // Push pending users — PUT upsert
  const pendingUsers = db.prepare("SELECT * FROM users WHERE sync_status = 'pending'").all();
  for (const u of pendingUsers) {
    try {
      const payload = { name: u.name, phone: u.phone, role: u.role, password: u.password, created_at: u.created_at };
      const res = await fetchJson(`${ELECTRON_API}/users/${u._id}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
      if (res.status === 200) {
        db.prepare('UPDATE users SET remote_id = ?, sync_status = ? WHERE _id = ?').run(u._id, 'synced', u._id);
        pushed++;
      } else { console.error('[sync] User PUT failed:', res.status, JSON.stringify(res.data)); errors++; }
    } catch (err) { console.error('[sync] User push error:', err.message); errors++; }
  }

  return { pushed, errors };
}

// Full sync: push local changes, then pull remote changes
async function sync(token) {
  try {
    const pushResult = await pushPendingToRemote(token);
    const pullResult = await pullAllFromRemote(token);
    return { success: true, push: pushResult, pull: pullResult };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { sync, isOnline, pullAllFromRemote, pushPendingToRemote };
