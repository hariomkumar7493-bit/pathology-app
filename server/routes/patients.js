const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// GET all patients
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const patients = await db.collection('patients').find({}).sort({ created_at: -1 }).toArray();
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single patient
router.get('/:id', async (req, res) => {
  try {
    const db = getDB();
    const patient = await db.collection('patients').findOne({ _id: req.params.id });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create patient
router.post('/', async (req, res) => {
  try {
    const { name, age, gender, phone, email, address, referred_by } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const db = getDB();
    const _id = require('crypto').randomUUID();
    const patient = {
      _id,
      name,
      age: age || '',
      gender: gender || '',
      phone: phone || '',
      email: email || null,
      address: address || null,
      referred_by: referred_by || 'SELF',
      created_at: new Date().toISOString(),
    };

    await db.collection('patients').insertOne(patient);
    res.status(201).json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update patient
router.put('/:id', async (req, res) => {
  try {
    const { name, age, gender, phone, email, address, referred_by } = req.body;
    const db = getDB();

    const update = {};
    if (name !== undefined) update.name = name;
    if (age !== undefined) update.age = age;
    if (gender !== undefined) update.gender = gender;
    if (phone !== undefined) update.phone = phone;
    if (email !== undefined) update.email = email;
    if (address !== undefined) update.address = address;
    if (referred_by !== undefined) update.referred_by = referred_by;
    update.updated_at = new Date();

    await db.collection('patients').updateOne(
      { _id: req.params.id },
      { $set: update }
    );

    const updated = await db.collection('patients').findOne({ _id: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE patient
router.delete('/:id', async (req, res) => {
  try {
    const db = getDB();
    await db.collection('patients').deleteOne({ _id: req.params.id });
    // Also delete reports for this patient
    await db.collection('reports').deleteMany({ patient_id: req.params.id });
    res.json({ message: 'Patient deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search patients
router.get('/search/:query', async (req, res) => {
  try {
    const db = getDB();
    const query = req.params.query;
    const patients = await db.collection('patients').find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } },
      ]
    }).sort({ created_at: -1 }).toArray();
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
