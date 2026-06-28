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

// Pull all data from remote and replace local (initial sync)
async function pullAllFromRemote(token) {
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const db = getDb();

  try {
    // Pull patients
    const patientsRes = await fetchJson(`${REMOTE_API}/patients`, { headers });
    if (patientsRes.status === 200 && Array.isArray(patientsRes.data)) {
      const upsert = db.prepare(`INSERT OR REPLACE INTO patients (_id, name, age, gender, phone, email, address, referred_by, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`);
      const delAll = db.prepare('DELETE FROM patients');
      delAll.run();
      for (const p of patientsRes.data) {
        upsert.run(String(p._id), p.name || '', String(p.age || ''), p.gender || '', p.phone || '', p.email || '', p.address || '', p.referred_by || 'SELF', p.created_at || new Date().toISOString());
      }
    }

    // Pull categories
    const catRes = await fetchJson(`${REMOTE_API}/tests/categories`, { headers });
    if (catRes.status === 200 && Array.isArray(catRes.data)) {
      db.prepare('DELETE FROM test_categories').run();
      const upsert = db.prepare(`INSERT OR REPLACE INTO test_categories (_id, name, description, created_at, sync_status) VALUES (?, ?, ?, ?, 'synced')`);
      for (const c of catRes.data) {
        upsert.run(String(c._id), c.name || '', c.description || '', c.created_at || new Date().toISOString());
      }
    }

    // Pull tests
    const testsRes = await fetchJson(`${REMOTE_API}/tests`, { headers });
    if (testsRes.status === 200 && Array.isArray(testsRes.data)) {
      db.prepare('DELETE FROM tests').run();
      const upsert = db.prepare(`INSERT OR REPLACE INTO tests (_id, name, category_id, category_name, specimen, price, parameters, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')`);
      for (const t of testsRes.data) {
        upsert.run(String(t._id), t.name || '', t.category_id ? String(t.category_id) : null, t.category_name || null, t.specimen || '', String(t.price || ''), stringifyJson(t.parameters || []), t.created_at || new Date().toISOString());
      }
    }

    // Pull reports
    const reportsRes = await fetchJson(`${REMOTE_API}/reports`, { headers });
    if (reportsRes.status === 200 && Array.isArray(reportsRes.data)) {
      db.prepare('DELETE FROM reports').run();
      const upsert = db.prepare(`INSERT OR REPLACE INTO reports (_id, patient_id, patient_name, age, gender, referred_by, ref_no, specimen, investigation, doctor_name, doctor_designation, status, date_of_collection, date_of_reporting, created_at, tests, results, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`);
      for (const r of reportsRes.data) {
        upsert.run(
          String(r._id), r.patient_id ? String(r.patient_id) : null, r.patient_name || '', String(r.age || ''), r.gender || '', r.referred_by || 'SELF',
          r.ref_no || '', r.specimen || 'BLOOD', r.investigation || '', r.doctor_name || '', r.doctor_designation || '',
          r.status || 'Completed', r.date_of_collection || new Date().toISOString(), r.date_of_reporting || new Date().toISOString(), r.created_at || new Date().toISOString(),
          stringifyJson(r.tests || []), stringifyJson(r.results || [])
        );
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

    // Pull users (for offline login)
    const usersRes = await fetchJson(`${REMOTE_API}/auth/users`, { headers });
    if (usersRes.status === 200 && Array.isArray(usersRes.data)) {
      const upsert = db.prepare(`INSERT OR REPLACE INTO users (_id, name, phone, role, password, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, 'synced')`);
      for (const u of usersRes.data) {
        // Note: remote users don't return password, so preserve existing password if present
        const existing = db.prepare('SELECT password FROM users WHERE _id = ?').get(String(u._id));
        upsert.run(String(u._id), u.name || '', u.phone || '', u.role || 'staff', existing?.password || '', u.created_at || new Date().toISOString());
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

  // Push pending patients
  const pendingPatients = db.prepare("SELECT * FROM patients WHERE sync_status = 'pending'").all();
  for (const p of pendingPatients) {
    try {
      const body = JSON.stringify({ name: p.name, age: p.age, gender: p.gender, phone: p.phone, email: p.email, address: p.address, referred_by: p.referred_by });
      // Try update first, if 404 then create
      const updateRes = await fetchJson(`${REMOTE_API}/patients/${p._id}`, { method: 'PUT', headers, body });
      if (updateRes.status === 404) {
        await fetchJson(`${REMOTE_API}/patients`, { method: 'POST', headers, body });
      }
      db.prepare("UPDATE patients SET sync_status = 'synced' WHERE _id = ?").run(p._id);
      pushed++;
    } catch (err) {
      errors++;
    }
  }

  // Push pending reports
  const pendingReports = db.prepare("SELECT * FROM reports WHERE sync_status = 'pending'").all();
  for (const r of pendingReports) {
    try {
      const reportData = {
        patient_id: r.patient_id,
        patient_name: r.patient_name,
        age: r.age,
        gender: r.gender,
        referred_by: r.referred_by,
        specimen: r.specimen,
        investigation: r.investigation,
        doctor_name: r.doctor_name,
        doctor_designation: r.doctor_designation,
        date_of_collection: r.date_of_collection,
        tests: parseJson(r.tests) || [],
        results: parseJson(r.results) || [],
      };
      const body = JSON.stringify(reportData);
      // Try update results, if 404 then create
      const updateRes = await fetchJson(`${REMOTE_API}/reports/${r._id}/results`, { method: 'PUT', headers, body: JSON.stringify({ results: parseJson(r.results) || [] }) });
      if (updateRes.status === 404) {
        await fetchJson(`${REMOTE_API}/reports`, { method: 'POST', headers, body });
      }
      db.prepare("UPDATE reports SET sync_status = 'synced' WHERE _id = ?").run(r._id);
      pushed++;
    } catch (err) {
      errors++;
    }
  }

  // Push pending tests
  const pendingTests = db.prepare("SELECT * FROM tests WHERE sync_status = 'pending'").all();
  for (const t of pendingTests) {
    try {
      const body = JSON.stringify({ name: t.name, category_id: t.category_id, specimen: t.specimen, price: t.price, parameters: parseJson(t.parameters) || [] });
      const updateRes = await fetchJson(`${REMOTE_API}/tests/${t._id}`, { method: 'PUT', headers, body });
      if (updateRes.status === 404) {
        await fetchJson(`${REMOTE_API}/tests`, { method: 'POST', headers, body });
      }
      db.prepare("UPDATE tests SET sync_status = 'synced' WHERE _id = ?").run(t._id);
      pushed++;
    } catch (err) {
      errors++;
    }
  }

  // Push pending users
  const pendingUsers = db.prepare("SELECT * FROM users WHERE sync_status = 'pending'").all();
  for (const u of pendingUsers) {
    try {
      const body = JSON.stringify({ name: u.name, phone: u.phone, role: u.role, password: u.password });
      const updateRes = await fetchJson(`${REMOTE_API}/auth/users/${u._id}`, { method: 'PUT', headers, body });
      if (updateRes.status === 404) {
        await fetchJson(`${REMOTE_API}/auth/users`, { method: 'POST', headers, body });
      }
      db.prepare("UPDATE users SET sync_status = 'synced' WHERE _id = ?").run(u._id);
      pushed++;
    } catch (err) {
      errors++;
    }
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
