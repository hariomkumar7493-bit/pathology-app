const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { ObjectId } = require('mongodb');
const { sendPushNotification } = require('./notifications');

// GET all patients
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const patientsCollection = db.collection('patients');
    const patients = await patientsCollection.find({}).sort({ created_at: -1 }).toArray();
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single patient
router.get('/:id', async (req, res) => {
  try {
    const db = getDB();
    const patientsCollection = db.collection('patients');
    const patient = await patientsCollection.findOne({ _id: new ObjectId(req.params.id) });
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
    sendPushNotification('New Patient Registered', `${name} - ${age}Y/${gender || ''}`).catch(e => console.error('Push error:', e));

    res.status(201).json(newPatient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update patient
router.put('/:id', async (req, res) => {
  try {
    const { name, age, gender, phone, email, address, referred_by } = req.body;
    const db = getDB();
    const patientsCollection = db.collection('patients');
    
    const updateData = {
      name,
      age,
      gender,
      phone,
      email: email || null,
      address: address || null,
      referred_by: referred_by || 'SELF'
    };
    
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

// DELETE patient
router.delete('/:id', async (req, res) => {
  try {
    const db = getDB();
    const patientId = new ObjectId(req.params.id);
    
    // Delete all reports (with embedded tests and results)
    const reportsCollection = db.collection('reports');
    await reportsCollection.deleteMany({ patient_id: patientId });
    
    // Delete patient
    const patientsCollection = db.collection('patients');
    await patientsCollection.deleteOne({ _id: patientId });
    
    res.json({ message: 'Patient deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search patients
router.get('/search/:term', async (req, res) => {
  try {
    const db = getDB();
    const patientsCollection = db.collection('patients');
    const term = req.params.term;
    
    const patients = await patientsCollection.find({
      $or: [
        { name: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } }
      ]
    }).sort({ created_at: -1 }).toArray();
    
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
