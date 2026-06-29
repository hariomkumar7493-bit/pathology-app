const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// Helper: get collection by name
function col(db, name) {
  return db.collection(name);
}

// Helper: upsert a document by _id (string, not ObjectId)
async function upsertById(db, collectionName, _id, data) {
  const collection = col(db, collectionName);
  await collection.updateOne(
    { _id },
    { $set: { ...data, _id } },
    { upsert: true }
  );
  return await collection.findOne({ _id });
}

// Helper: delete by _id (string)
async function deleteById(db, collectionName, _id) {
  const collection = col(db, collectionName);
  const result = await collection.deleteOne({ _id });
  return result.deletedCount > 0;
}

// ============ PATIENTS ============

// GET all electron patients
router.get('/patients', async (req, res) => {
  try {
    const db = getDB();
    const patients = await col(db, 'electron_patients').find({}).sort({ created_at: -1 }).toArray();
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT upsert patient (local _id is the MongoDB _id — no ObjectId, no mismatch)
router.put('/patients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, age, gender, phone, email, address, referred_by, created_at } = req.body;
    const db = getDB();
    
    const data = {
      name: name || '',
      age: age,
      gender: gender || '',
      phone: phone || '',
      email: email || null,
      address: address || null,
      referred_by: referred_by || 'SELF',
      created_at: created_at || new Date().toISOString(),
      source: 'electron',
      updated_at: new Date()
    };
    
    const result = await upsertById(db, 'electron_patients', id, data);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE electron patient
router.delete('/patients/:id', async (req, res) => {
  try {
    const db = getDB();
    await deleteById(db, 'electron_patients', req.params.id);
    // Also delete electron reports for this patient
    await col(db, 'electron_reports').deleteMany({ patient_id: req.params.id });
    res.json({ message: 'Patient deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ REPORTS ============

// GET all electron reports
router.get('/reports', async (req, res) => {
  try {
    const db = getDB();
    const reports = await col(db, 'electron_reports').find({}).sort({ created_at: -1 }).toArray();
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT upsert report (local _id is the MongoDB _id)
router.put('/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const db = getDB();
    
    const data = {
      patient_id: body.patient_id || null,
      patient_name: body.patient_name || '',
      age: body.age,
      gender: body.gender || '',
      referred_by: body.referred_by || 'SELF',
      ref_no: body.ref_no || '',
      specimen: body.specimen || 'BLOOD',
      investigation: body.investigation || '',
      doctor_name: body.doctor_name || '',
      doctor_designation: body.doctor_designation || '',
      status: body.status || 'Pending',
      date_of_collection: body.date_of_collection || new Date().toISOString(),
      date_of_reporting: body.date_of_reporting || new Date().toISOString(),
      created_at: body.created_at || new Date().toISOString(),
      tests: body.tests || [],
      results: body.results || [],
      source: 'electron',
      updated_at: new Date()
    };
    
    const result = await upsertById(db, 'electron_reports', id, data);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE electron report
router.delete('/reports/:id', async (req, res) => {
  try {
    const db = getDB();
    await deleteById(db, 'electron_reports', req.params.id);
    res.json({ message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ TEST CATEGORIES ============

// GET all electron test categories
router.get('/test-categories', async (req, res) => {
  try {
    const db = getDB();
    const cats = await col(db, 'electron_test_categories').find({}).sort({ name: 1 }).toArray();
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT upsert test category
router.put('/test-categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, created_at } = req.body;
    const db = getDB();
    
    const data = {
      name: name || '',
      description: description || '',
      created_at: created_at || new Date().toISOString(),
      source: 'electron',
      updated_at: new Date()
    };
    
    const result = await upsertById(db, 'electron_test_categories', id, data);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE electron test category
router.delete('/test-categories/:id', async (req, res) => {
  try {
    const db = getDB();
    await deleteById(db, 'electron_test_categories', req.params.id);
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ TESTS ============

// GET all electron tests
router.get('/tests', async (req, res) => {
  try {
    const db = getDB();
    const tests = await col(db, 'electron_tests').find({}).toArray();
    res.json(tests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT upsert test
router.put('/tests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const db = getDB();
    
    const data = {
      name: body.name || '',
      category_id: body.category_id || null,
      category_name: body.category_name || null,
      specimen: body.specimen || 'BLOOD',
      price: body.price || '0',
      parameters: body.parameters || [],
      created_at: body.created_at || new Date().toISOString(),
      source: 'electron',
      updated_at: new Date()
    };
    
    const result = await upsertById(db, 'electron_tests', id, data);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE electron test
router.delete('/tests/:id', async (req, res) => {
  try {
    const db = getDB();
    await deleteById(db, 'electron_tests', req.params.id);
    res.json({ message: 'Test deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ USERS ============

// GET all electron users
router.get('/users', async (req, res) => {
  try {
    const db = getDB();
    const users = await col(db, 'electron_users').find({}).toArray();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT upsert user
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, role, password, created_at } = req.body;
    const db = getDB();
    
    const data = {
      name: name || '',
      phone: phone || '',
      role: role || 'staff',
      password: password || '',
      created_at: created_at || new Date().toISOString(),
      source: 'electron',
      updated_at: new Date()
    };
    
    const result = await upsertById(db, 'electron_users', id, data);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE electron user
router.delete('/users/:id', async (req, res) => {
  try {
    const db = getDB();
    await deleteById(db, 'electron_users', req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
