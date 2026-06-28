const { ipcMain } = require('electron');
const { getDb, generateId, parseJson, stringifyJson } = require('./db.cjs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const https = require('https');
const http = require('http');

const JWT_SECRET = process.env.JWT_SECRET || 'pathlab-pro-v2-secret-2024';
const REMOTE_API = 'https://patholabpro.online/api';

// Simple fetch helper
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

function registerIpcHandlers(log) {

  // ===== AUTH =====
  ipcMain.handle('db:login', async (event, { phone, password }) => {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    
    // Try local DB first
    if (user && user.password) {
      const valid = bcrypt.compareSync(password, user.password);
      if (valid) {
        const token = jwt.sign({ id: user._id, phone: user.phone, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        return { token, user: { _id: user._id, name: user.name, phone: user.phone, role: user.role } };
      }
      // Password mismatch — try remote in case it was changed
    }
    
    // Fall back to remote server (online login)
    try {
      const res = await fetchJson(`${REMOTE_API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      if (res.status === 200 && res.data.token) {
        // Store/update user in local DB for future offline login
        const hashedPassword = bcrypt.hashSync(password, 10);
        const userData = res.data.user || {};
        const userId = userData._id || generateId();
        db.prepare(`INSERT OR REPLACE INTO users (_id, name, phone, role, password, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, 'synced')`).run(
          String(userId), userData.name || '', phone, userData.role || 'staff', hashedPassword, new Date().toISOString()
        );
        return { token: res.data.token, user: { _id: userId, name: userData.name, phone, role: userData.role } };
      }
      return { error: (res.data && res.data.error) || 'Invalid phone or password' };
    } catch (err) {
      // Network error and no local user matched
      if (!user) return { error: 'User not found (offline)' };
      return { error: 'Invalid password (offline)' };
    }
  });

  ipcMain.handle('db:getUsers', async () => {
    const db = getDb();
    const users = db.prepare('SELECT _id, name, phone, role, created_at FROM users').all();
    return users;
  });

  ipcMain.handle('db:createUser', async (event, { name, phone, password, role }) => {
    const db = getDb();
    const existing = db.prepare('SELECT _id FROM users WHERE phone = ?').get(phone);
    if (existing) return { error: 'Phone already registered' };
    const id = generateId();
    const hashed = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (_id, name, phone, role, password, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, name, phone, role, hashed, new Date().toISOString(), 'pending');
    return { _id: id, name, phone, role };
  });

  ipcMain.handle('db:updateUser', async (event, { id, name, phone, role, password }) => {
    const db = getDb();
    if (password) {
      const hashed = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET name = ?, phone = ?, role = ?, password = ?, sync_status = ? WHERE _id = ?').run(name, phone, role, hashed, 'pending', id);
    } else {
      db.prepare('UPDATE users SET name = ?, phone = ?, role = ?, sync_status = ? WHERE _id = ?').run(name, phone, role, 'pending', id);
    }
    return { success: true };
  });

  ipcMain.handle('db:deleteUser', async (event, { id }) => {
    const db = getDb();
    db.prepare('DELETE FROM users WHERE _id = ?').run(id);
    return { success: true };
  });

  // ===== DASHBOARD =====
  ipcMain.handle('db:getDashboard', async () => {
    const db = getDb();
    const totalPatients = db.prepare('SELECT COUNT(*) as c FROM patients').get().c;
    const totalReports = db.prepare('SELECT COUNT(*) as c FROM reports').get().c;
    const totalTests = db.prepare('SELECT COUNT(*) as c FROM tests').get().c;
    const today = new Date().toISOString().split('T')[0];
    const todayReports = db.prepare("SELECT COUNT(*) as c FROM reports WHERE date_of_reporting LIKE ?").get(today + '%').c;
    return {
      totalPatients,
      totalReports,
      totalTests,
      todayReports,
      recentReports: db.prepare('SELECT * FROM reports ORDER BY created_at DESC LIMIT 5').all().map(r => ({ ...r, tests: parseJson(r.tests), results: parseJson(r.results) })),
    };
  });

  // ===== PATIENTS =====
  ipcMain.handle('db:getPatients', async () => {
    const db = getDb();
    return db.prepare('SELECT * FROM patients ORDER BY created_at DESC').all();
  });

  ipcMain.handle('db:getPatient', async (event, { id }) => {
    const db = getDb();
    return db.prepare('SELECT * FROM patients WHERE _id = ?').get(id);
  });

  ipcMain.handle('db:createPatient', async (event, data) => {
    const db = getDb();
    const id = generateId();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO patients (_id, name, age, gender, phone, email, address, referred_by, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, data.name || '', String(data.age || ''), data.gender || '', data.phone || '', data.email || '', data.address || '', data.referred_by || 'SELF', now, 'pending'
    );
    return { _id: id, ...data };
  });

  ipcMain.handle('db:updatePatient', async (event, { id, data }) => {
    const db = getDb();
    db.prepare(`UPDATE patients SET name = ?, age = ?, gender = ?, phone = ?, email = ?, address = ?, referred_by = ?, sync_status = ? WHERE _id = ?`).run(
      data.name || '', String(data.age || ''), data.gender || '', data.phone || '', data.email || '', data.address || '', data.referred_by || 'SELF', 'pending', id
    );
    return { success: true };
  });

  ipcMain.handle('db:deletePatient', async (event, { id }) => {
    const db = getDb();
    db.prepare('DELETE FROM patients WHERE _id = ?').run(id);
    return { success: true };
  });

  ipcMain.handle('db:searchPatients', async (event, { term }) => {
    const db = getDb();
    const like = `%${term}%`;
    return db.prepare('SELECT * FROM patients WHERE name LIKE ? OR phone LIKE ? ORDER BY created_at DESC LIMIT 20').all(like, like);
  });

  // ===== TESTS =====
  ipcMain.handle('db:getTests', async () => {
    const db = getDb();
    const categories = db.prepare('SELECT * FROM test_categories').all();
    const categoryMap = {};
    categories.forEach(c => { categoryMap[c._id] = c.name; });
    const tests = db.prepare('SELECT * FROM tests').all();
    const testsWithCategory = tests.map(t => ({
      ...t,
      parameters: (parseJson(t.parameters) || []).map((p, idx) => ({ ...p, id: p.id || idx + 1 })),
      category_name: t.category_name || categoryMap[t.category_id] || null,
    }));
    testsWithCategory.sort((a, b) => {
      if ((a.category_name || '') !== (b.category_name || '')) {
        return (a.category_name || '').localeCompare(b.category_name || '');
      }
      return (a.name || '').localeCompare(b.name || '');
    });
    return testsWithCategory;
  });

  ipcMain.handle('db:getCategories', async () => {
    const db = getDb();
    return db.prepare('SELECT * FROM test_categories ORDER BY name').all();
  });

  ipcMain.handle('db:getTestParameters', async (event, { id }) => {
    const db = getDb();
    const test = db.prepare('SELECT parameters FROM tests WHERE _id = ?').get(id);
    return parseJson(test?.parameters) || [];
  });

  ipcMain.handle('db:getBulkParameters', async (event, { testIds }) => {
    const db = getDb();
    const placeholders = testIds.map(() => '?').join(',');
    const tests = db.prepare(`SELECT * FROM tests WHERE _id IN (${placeholders})`).all(...testIds);
    const categories = db.prepare('SELECT * FROM test_categories').all();
    const categoryMap = {};
    categories.forEach(c => { categoryMap[c._id] = c.name; });
    
    let allParameters = [];
    tests.forEach(test => {
      const params = parseJson(test.parameters) || [];
      params.forEach((param, idx) => {
        allParameters.push({
          ...param,
          id: param.id || idx + 1,
          test_name: test.name,
          category_name: test.category_name || categoryMap[test.category_id] || null,
        });
      });
    });
    
    allParameters.sort((a, b) => {
      if ((a.test_name || '') !== (b.test_name || '')) {
        return (a.test_name || '').localeCompare(b.test_name || '');
      }
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
    
    return allParameters;
  });

  ipcMain.handle('db:createTest', async (event, data) => {
    const db = getDb();
    const id = generateId();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO tests (_id, name, category_id, category_name, specimen, price, parameters, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      id, data.name, data.category_id || null, data.category_name || null, data.specimen || '', data.price || '', stringifyJson(data.parameters || []), now, 'pending'
    );
    return { _id: id, ...data };
  });

  ipcMain.handle('db:updateTest', async (event, { id, data }) => {
    const db = getDb();
    db.prepare('UPDATE tests SET name = ?, category_id = ?, category_name = ?, specimen = ?, price = ?, parameters = ?, sync_status = ? WHERE _id = ?').run(
      data.name, data.category_id || null, data.category_name || null, data.specimen || '', data.price || '', stringifyJson(data.parameters || []), 'pending', id
    );
    return { success: true };
  });

  ipcMain.handle('db:deleteTest', async (event, { id }) => {
    const db = getDb();
    db.prepare('DELETE FROM tests WHERE _id = ?').run(id);
    return { success: true };
  });

  ipcMain.handle('db:createCategory', async (event, data) => {
    const db = getDb();
    const id = generateId();
    db.prepare('INSERT INTO test_categories (_id, name, description, created_at, sync_status) VALUES (?, ?, ?, ?, ?)').run(id, data.name, data.description || '', new Date().toISOString(), 'pending');
    return { _id: id, ...data };
  });

  ipcMain.handle('db:updateCategory', async (event, { id, data }) => {
    const db = getDb();
    db.prepare('UPDATE test_categories SET name = ?, description = ?, sync_status = ? WHERE _id = ?').run(data.name, data.description || '', 'pending', id);
    return { success: true };
  });

  ipcMain.handle('db:deleteCategory', async (event, { id }) => {
    const db = getDb();
    db.prepare('DELETE FROM test_categories WHERE _id = ?').run(id);
    return { success: true };
  });

  // ===== REPORTS =====
  ipcMain.handle('db:getReports', async () => {
    const db = getDb();
    const reports = db.prepare('SELECT * FROM reports ORDER BY created_at DESC').all();
    return reports.map(r => ({ ...r, tests: parseJson(r.tests), results: parseJson(r.results) }));
  });

  ipcMain.handle('db:getReport', async (event, { id }) => {
    const db = getDb();
    const r = db.prepare('SELECT * FROM reports WHERE _id = ?').get(id);
    if (!r) return null;
    return { ...r, tests: parseJson(r.tests), results: parseJson(r.results) };
  });

  ipcMain.handle('db:createReport', async (event, data) => {
    const db = getDb();
    const id = generateId();
    const now = new Date().toISOString();
    const count = db.prepare('SELECT COUNT(*) as c FROM reports').get().c;
    const refNo = String(count + 1);
    db.prepare(`INSERT INTO reports (_id, patient_id, patient_name, age, gender, referred_by, ref_no, specimen, investigation, doctor_name, doctor_designation, status, date_of_collection, date_of_reporting, created_at, tests, results, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, data.patient_id || null, data.patient_name || '', String(data.age || ''), data.gender || '', data.referred_by || 'SELF',
      refNo, data.specimen || 'BLOOD', data.investigation || '', data.doctor_name || 'Dr. C. Ashok', data.doctor_designation || 'MBBS MD (PATH)',
      'Completed', data.date_of_collection || now, now, now, stringifyJson(data.tests || []), stringifyJson(data.results || []), 'pending'
    );
    return { _id: id, refNo, ...data };
  });

  ipcMain.handle('db:updateReportResults', async (event, { id, results }) => {
    const db = getDb();
    db.prepare('UPDATE reports SET results = ?, sync_status = ? WHERE _id = ?').run(stringifyJson(results), 'pending', id);
    return { success: true };
  });

  ipcMain.handle('db:createQuickReport', async (event, data) => {
    const db = getDb();
    const { patient_name, age, gender, phone, email, referred_by, test_ids, results, specimen, doctor_name, doctor_designation, date_of_collection } = data;

    // Create or find patient
    let patientId;
    if (phone) {
      const existing = db.prepare('SELECT * FROM patients WHERE phone = ?').get(phone);
      if (existing) {
        patientId = existing._id;
        db.prepare('UPDATE patients SET name = ?, age = ?, gender = ?, email = ?, referred_by = ?, sync_status = ? WHERE _id = ?').run(
          patient_name, String(age || ''), gender, email || existing.email || null, referred_by || 'SELF', 'pending', patientId
        );
      }
    }
    if (!patientId) {
      patientId = generateId();
      db.prepare('INSERT INTO patients (_id, name, age, gender, phone, email, referred_by, created_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        patientId, patient_name, String(age || ''), gender, phone || null, email || null, referred_by || 'SELF', new Date().toISOString(), 'pending'
      );
    }

    // Get test names and build tests/results arrays
    let investigationText = '';
    const testsArray = [];
    const resultsArray = [];

    if (test_ids && test_ids.length) {
      const placeholders = test_ids.map(() => '?').join(',');
      const tests = db.prepare(`SELECT * FROM tests WHERE _id IN (${placeholders})`).all(...test_ids);
      investigationText = tests.map(t => t.name).join(', ');

      for (const test of tests) {
        const params = parseJson(test.parameters) || [];
        const categoryName = test.category_name || null;
        testsArray.push({
          test_id: test._id,
          test_name: test.name,
          specimen: test.specimen,
          category_name: categoryName
        });
        for (const param of params) {
          const resultEntry = results ? results.find(r => r.param_name === param.param_name) : null;
          resultsArray.push({
            test_id: test._id,
            test_name: test.name,
            category_name: categoryName,
            param_name: param.param_name,
            result_value: resultEntry ? resultEntry.result_value : '',
            is_abnormal: resultEntry ? resultEntry.is_abnormal : false,
            unit: param.unit,
            ref_range_male: param.ref_range_male,
            ref_range_female: param.ref_range_female,
            group_name: param.group_name,
            sort_order: param.sort_order
          });
        }
      }
    }

    resultsArray.sort((a, b) => {
      if (a.test_name !== b.test_name) return a.test_name.localeCompare(b.test_name);
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    const reportId = generateId();
    const now = new Date().toISOString();
    const count = db.prepare('SELECT COUNT(*) as c FROM reports').get().c;
    const refNo = String(count + 1);

    const report = {
      patient_id: patientId,
      ref_no: refNo,
      specimen: specimen || 'BLOOD',
      investigation: investigationText,
      doctor_name: doctor_name || 'Dr. C. Ashok',
      doctor_designation: doctor_designation || 'MBBS MD (PATH)',
      status: 'Completed',
      date_of_collection: date_of_collection || now,
      date_of_reporting: now,
      created_at: now,
      tests: testsArray,
      results: resultsArray
    };

    db.prepare(`INSERT INTO reports (_id, patient_id, patient_name, age, gender, referred_by, ref_no, specimen, investigation, doctor_name, doctor_designation, status, date_of_collection, date_of_reporting, created_at, tests, results, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      reportId, patientId, patient_name, String(age || ''), gender, referred_by || 'SELF',
      refNo, report.specimen, report.investigation, report.doctor_name, report.doctor_designation,
      report.status, report.date_of_collection, report.date_of_reporting, report.created_at,
      stringifyJson(testsArray), stringifyJson(resultsArray), 'pending'
    );

    return {
      reportId,
      patientId,
      refNo,
      report: {
        ...report,
        _id: reportId,
        patient_name,
        age,
        gender,
        referred_by: referred_by || 'SELF',
      }
    };
  });

  ipcMain.handle('db:deleteReport', async (event, { id }) => {
    const db = getDb();
    db.prepare('DELETE FROM reports WHERE _id = ?').run(id);
    return { success: true };
  });

  ipcMain.handle('db:addTestToReport', async (event, { reportId, testId }) => {
    const db = getDb();
    const report = db.prepare('SELECT * FROM reports WHERE _id = ?').get(reportId);
    if (!report) return { error: 'Report not found' };
    const tests = parseJson(report.tests) || [];
    const test = db.prepare('SELECT * FROM tests WHERE _id = ?').get(testId);
    if (!test) return { error: 'Test not found' };
    const params = parseJson(test.parameters) || [];
    const results = parseJson(report.results) || [];
    tests.push({ test_id: test._id, test_name: test.name, specimen: test.specimen, category_name: test.category_name });
    for (const param of params) {
      results.push({
        test_id: test._id, test_name: test.name, category_name: test.category_name,
        param_name: param.param_name, result_value: '', is_abnormal: false,
        unit: param.unit, ref_range_male: param.ref_range_male, ref_range_female: param.ref_range_female,
        group_name: param.group_name, sort_order: param.sort_order
      });
    }
    db.prepare('UPDATE reports SET tests = ?, results = ?, sync_status = ? WHERE _id = ?').run(stringifyJson(tests), stringifyJson(results), 'pending', reportId);
    return { success: true };
  });

  ipcMain.handle('db:removeTestFromReport', async (event, { reportId, testId }) => {
    const db = getDb();
    const report = db.prepare('SELECT * FROM reports WHERE _id = ?').get(reportId);
    if (!report) return { error: 'Report not found' };
    let tests = parseJson(report.tests) || [];
    let results = parseJson(report.results) || [];
    tests = tests.filter(t => t.test_id !== testId);
    results = results.filter(r => r.test_id !== testId);
    db.prepare('UPDATE reports SET tests = ?, results = ?, sync_status = ? WHERE _id = ?').run(stringifyJson(tests), stringifyJson(results), 'pending', reportId);
    return { success: true };
  });

  // ===== SETTINGS =====
  ipcMain.handle('db:getReportLayout', async () => {
    const db = getDb();
    const s = db.prepare('SELECT value FROM settings WHERE key = ?').get('report_layout');
    return parseJson(s?.value) || { pdf: {}, print: {} };
  });

  ipcMain.handle('db:updateReportLayout', async (event, data) => {
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run('report_layout', stringifyJson(data), new Date().toISOString());
    return { success: true };
  });

  ipcMain.handle('db:resetReportLayout', async () => {
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run('report_layout', stringifyJson({ pdf: {}, print: {} }), new Date().toISOString());
    return { success: true };
  });

  ipcMain.handle('db:getReferringDoctors', async () => {
    const db = getDb();
    const s = db.prepare('SELECT value FROM settings WHERE key = ?').get('referring_doctors');
    return { doctors: parseJson(s?.value) || ['SELF'] };
  });

  ipcMain.handle('db:updateReferringDoctors', async (event, { doctors }) => {
    const db = getDb();
    if (!doctors.includes('SELF')) doctors.unshift('SELF');
    db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run('referring_doctors', stringifyJson(doctors), new Date().toISOString());
    return { success: true, doctors };
  });

  // ===== SYNC STATUS =====
  ipcMain.handle('db:getSyncStatus', async () => {
    const db = getDb();
    const pending = db.prepare("SELECT COUNT(*) as c FROM patients WHERE sync_status = 'pending'").get().c;
    const pendingReports = db.prepare("SELECT COUNT(*) as c FROM reports WHERE sync_status = 'pending'").get().c;
    const pendingTests = db.prepare("SELECT COUNT(*) as c FROM tests WHERE sync_status = 'pending'").get().c;
    return { pendingChanges: pending + pendingReports + pendingTests };
  });

  log('INFO', 'IPC database handlers registered');
}

module.exports = { registerIpcHandlers };
