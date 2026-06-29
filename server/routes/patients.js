const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { ObjectId } = require('mongodb');
const { sendPushNotification } = require('./notifications');

// GET all patients (unions web patients + electron patients)
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const patientsCollection = db.collection('patients');
    const electronCollection = db.collection('electron_patients');
    
    const [webPatients, electronPatients] = await Promise.all([
      patientsCollection.find({}).sort({ created_at: -1 }).toArray(),
      electronCollection.find({}).sort({ created_at: -1 }).toArray()
    ]);
    
    // Merge: electron patients already have all fields, web patients use ObjectId
    const allPatients = [
      ...webPatients.map(p => ({ ...p, _id: String(p._id), source: 'web' })),
      ...electronPatients.map(p => ({ ...p, _id: String(p._id), source: 'electron' }))
    ];
    
    // Sort by created_at descending
    allPatients.sort((a, b) => {
      const aDate = new Date(a.created_at).getTime() || 0;
      const bDate = new Date(b.created_at).getTime() || 0;
      return bDate - aDate;
    });
    
    res.json(allPatients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single patient (checks both web + electron collections)
router.get('/:id', async (req, res) => {
  try {
    const db = getDB();
    // Try electron collection first (string _id)
    const electronPatient = await db.collection('electron_patients').findOne({ _id: req.params.id });
    if (electronPatient) return res.json(electronPatient);
    // Try web collection (ObjectId)
    try {
      const patient = await db.collection('patients').findOne({ _id: new ObjectId(req.params.id) });
      if (patient) return res.json(patient);
    } catch {}
    return res.status(404).json({ error: 'Patient not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create patient
router.post('/', async (req, res) => {
  try {
    const { name, age, gender, phone, email, address, referred_by } = req.body;
    const db = getDB();
    const patientsCollection = db.collection('patients');
    
    const patient = {
      name,
      age,
      gender,
      phone,
      email: email || null,
      address: address || null,
      referred_by: referred_by || 'SELF',
      created_at: new Date()
    };
    
    const result = await patientsCollection.insertOne(patient);
    const newPatient = await patientsCollection.findOne({ _id: result.insertedId });

    // Send push notification to mobile devices
    try { await sendPushNotification('New Patient Registered', `${name} - ${age}Y/${gender || ''}`, { type: 'patient', patientId: String(result.insertedId) }); } catch(e) { console.error('Push error:', e); }

    res.status(201).json(newPatient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update patient (checks both web + electron collections)
router.put('/:id', async (req, res) => {
  try {
    const { name, age, gender, phone, email, address, referred_by } = req.body;
    const db = getDB();
    const updateData = {
      name,
      age,
      gender,
      phone,
      email: email || null,
      address: address || null,
      referred_by: referred_by || 'SELF'
    };
    
    // Try electron collection first (string _id)
    const electronCol = db.collection('electron_patients');
    const electronExisting = await electronCol.findOne({ _id: req.params.id });
    if (electronExisting) {
      await electronCol.updateOne({ _id: req.params.id }, { $set: updateData });
      const updated = await electronCol.findOne({ _id: req.params.id });
      return res.json(updated);
    }
    // Try web collection (ObjectId)
    const patientsCollection = db.collection('patients');
    await patientsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );
    const updatedPatient = await patientsCollection.findOne({ _id: new ObjectId(req.params.id) });
    res.json(updatedPatient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE patient (checks both web + electron collections)
router.delete('/:id', async (req, res) => {
  try {
    const db = getDB();
    
    // Try electron collection first (string _id)
    const electronCol = db.collection('electron_patients');
    const electronExisting = await electronCol.findOne({ _id: req.params.id });
    if (electronExisting) {
      await db.collection('electron_reports').deleteMany({ patient_id: req.params.id });
      await electronCol.deleteOne({ _id: req.params.id });
      return res.json({ message: 'Patient deleted' });
    }
    
    // Try web collection (ObjectId)
    const patientId = new ObjectId(req.params.id);
    const reportsCollection = db.collection('reports');
    await reportsCollection.deleteMany({ patient_id: patientId });
    const patientsCollection = db.collection('patients');
    await patientsCollection.deleteOne({ _id: patientId });
    
    res.json({ message: 'Patient deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search patients (searches both web + electron collections)
router.get('/search/:term', async (req, res) => {
  try {
    const db = getDB();
    const term = req.params.term;
    const regex = { $regex: term, $options: 'i' };
    
    const [webPatients, electronPatients] = await Promise.all([
      db.collection('patients').find({
        $or: [{ name: regex }, { phone: regex }]
      }).sort({ created_at: -1 }).toArray(),
      db.collection('electron_patients').find({
        $or: [{ name: regex }, { phone: regex }]
      }).sort({ created_at: -1 }).toArray()
    ]);
    
    const allPatients = [
      ...webPatients.map(p => ({ ...p, _id: String(p._id), source: 'web' })),
      ...electronPatients.map(p => ({ ...p, _id: String(p._id), source: 'electron' }))
    ];
    
    res.json(allPatients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
