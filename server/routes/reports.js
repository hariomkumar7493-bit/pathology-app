const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { sendPushNotification } = require('./notifications');

// GET all reports with patient info via $lookup
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const reportsCollection = db.collection('reports');

    const pipeline = [
      {
        $lookup: {
          from: 'patients',
          localField: 'patient_id',
          foreignField: '_id',
          as: 'patient_info'
        }
      },
      { $unwind: { path: '$patient_info', preserveNullAndEmptyArrays: true } },
      { $sort: { created_at: -1 } }
    ];

    const reports = await reportsCollection.aggregate(pipeline).toArray();

    const formatted = reports.map(r => ({
      ...r,
      patient_name: r.patient_info?.name || r.patient_name || 'Unknown',
      age: r.patient_info?.age != null ? r.patient_info.age : r.age,
      gender: r.patient_info?.gender || r.gender || '',
      referred_by: r.patient_info?.referred_by || r.referred_by || 'SELF',
    }));
    delete formatted.patient_info;

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET next sample ID (for display in UI before report creation)
router.get('/next-sample-id', async (req, res) => {
  try {
    const db = getDB();
    const reportsCollection = db.collection('reports');
    const sampleId = await generateSampleId(reportsCollection);
    res.json({ sampleId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single report
router.get('/:id', async (req, res) => {
  try {
    const db = getDB();
    const reportsCollection = db.collection('reports');

    const report = await reportsCollection.findOne({ _id: req.params.id });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Enrich with patient info
    let patientInfo = null;
    if (report.patient_id) {
      patientInfo = await db.collection('patients').findOne({ _id: report.patient_id });
    }

    res.json({
      ...report,
      patient_name: patientInfo?.name || report.patient_name || 'Unknown',
      age: patientInfo?.age != null ? patientInfo.age : report.age,
      gender: patientInfo?.gender || report.gender || '',
      referred_by: patientInfo?.referred_by || report.referred_by || 'SELF',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate sample ID: DDMMYY + daily sequence
async function generateSampleId(reportsCollection) {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const datePrefix = `${dd}${mm}${yy}`;
  const count = await reportsCollection.countDocuments({ sample_id: { $regex: `^${datePrefix}` } });
  return `${datePrefix}${count + 1}`;
}

// POST create report
router.post('/', async (req, res) => {
  try {
    const { patient_id, patient_name, age, gender, referred_by, ref_no, specimen, investigation, doctor_name, doctor_designation, status, date_of_collection, date_of_reporting, tests, results } = req.body;
    const db = getDB();
    const reportsCollection = db.collection('reports');

    const _id = require('crypto').randomUUID();
    const sampleId = await generateSampleId(reportsCollection);
    const report = {
      _id,
      patient_id: patient_id || null,
      patient_name: patient_name || '',
      age,
      gender: gender || '',
      referred_by: referred_by || 'SELF',
      ref_no: ref_no || '',
      sample_id: sampleId,
      specimen: specimen || 'BLOOD',
      investigation: investigation || '',
      doctor_name: doctor_name || '',
      doctor_designation: doctor_designation || '',
      status: status || 'Pending',
      date_of_collection: date_of_collection || new Date().toISOString(),
      date_of_reporting: date_of_reporting || new Date().toISOString(),
      created_at: new Date().toISOString(),
      tests: tests || [],
      results: results || [],
    };

    await reportsCollection.insertOne(report);

    try { await sendPushNotification('New Report', `${patient_name || 'Unknown'} - ${investigation || ''}`, { type: 'report', reportId: _id }); } catch(e) { console.error('Push error:', e); }

    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update report results
router.put('/:id/results', async (req, res) => {
  try {
    const { results, status } = req.body;
    const db = getDB();
    const reportsCollection = db.collection('reports');

    const updateData = {};

    if (results && results.length) {
      updateData.results = results;
    }

    if (status) {
      updateData.status = status;
      updateData.date_of_reporting = new Date().toISOString();
    }

    await reportsCollection.updateOne(
      { _id: req.params.id },
      { $set: updateData }
    );

    res.json({ message: 'Results updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update report
router.put('/:id', async (req, res) => {
  try {
    const db = getDB();
    const reportsCollection = db.collection('reports');

    const updateData = { ...req.body };
    delete updateData._id;
    updateData.updated_at = new Date().toISOString();

    await reportsCollection.updateOne(
      { _id: req.params.id },
      { $set: updateData }
    );

    const updated = await reportsCollection.findOne({ _id: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST quick report (create patient + report + results in one go)
router.post('/quick', async (req, res) => {
  try {
    const { patient_name, age, gender, phone, email, referred_by, test_ids, results, specimen, doctor_name, doctor_designation, date_of_collection, sample_id: clientSampleId } = req.body;
    const db = getDB();
    const patientsCollection = db.collection('patients');
    const reportsCollection = db.collection('reports');
    const testsCollection = db.collection('tests');

    // Create or find patient
    let patientId;
    if (phone) {
      const existing = await patientsCollection.findOne({ phone });
      if (existing) {
        patientId = existing._id;
        await patientsCollection.updateOne(
          { _id: patientId },
          { $set: { name: patient_name, age, gender, email: email || existing.email || null, referred_by: referred_by || 'SELF' } }
        );
      }
    }

    if (!patientId) {
      patientId = require('crypto').randomUUID();
      const patient = {
        _id: patientId,
        name: patient_name,
        age,
        gender,
        phone: phone || null,
        email: email || null,
        referred_by: referred_by || 'SELF',
        created_at: new Date().toISOString(),
      };
      await patientsCollection.insertOne(patient);
    }

    // Generate ref_no and sample_id
    const count = await reportsCollection.countDocuments();
    const refNo = (count + 1).toString();
    const sampleId = clientSampleId || await generateSampleId(reportsCollection);

    // Get test names
    let investigationText = '';
    if (test_ids && test_ids.length) {
      const tests = await testsCollection.find({ _id: { $in: test_ids } }).toArray();
      investigationText = tests.map(t => t.name).join(', ');
    }

    // Build tests and results arrays
    const testsArray = [];
    const resultsArray = [];
    const categoriesCollection = db.collection('test_categories');

    if (test_ids && test_ids.length) {
      for (const testId of test_ids) {
        const test = await testsCollection.findOne({ _id: testId });
        if (test) {
          const category = test.category_id ? await categoriesCollection.findOne({ _id: test.category_id }) : null;
          const categoryName = category?.name || test.category_name || null;
          testsArray.push({
            test_id: test._id,
            test_name: test.name,
            specimen: test.specimen,
            category_name: categoryName
          });

          const parameters = test.parameters || [];
          parameters.forEach(param => {
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
          });
        }
      }
    }

    // Sort results
    resultsArray.sort((a, b) => {
      if (a.test_name !== b.test_name) return a.test_name.localeCompare(b.test_name);
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    // Create report
    const reportId = require('crypto').randomUUID();
    const report = {
      _id: reportId,
      patient_id: patientId,
      ref_no: refNo,
      sample_id: sampleId,
      specimen: specimen || 'BLOOD',
      investigation: investigationText,
      doctor_name: doctor_name || 'Dr. C. Ashok',
      doctor_designation: doctor_designation || 'MBBS MD (PATH)',
      status: 'Completed',
      date_of_collection: date_of_collection || new Date().toISOString(),
      date_of_reporting: new Date().toISOString(),
      created_at: new Date().toISOString(),
      tests: testsArray,
      results: resultsArray
    };

    await reportsCollection.insertOne(report);

    try { await sendPushNotification('New Quick Report', `${patient_name} - ${test_ids?.length || 0} test(s)`, { type: 'report', reportId }); } catch(e) { console.error('Push error:', e); }

    res.status(201).json({
      reportId,
      patientId,
      refNo,
      sampleId,
      report: {
        ...report,
        patient_name: patient_name,
        age,
        gender,
        referred_by: referred_by || 'SELF',
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE report
router.delete('/:id', async (req, res) => {
  try {
    const db = getDB();
    const reportsCollection = db.collection('reports');
    await reportsCollection.deleteOne({ _id: req.params.id });
    res.json({ message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add test to report
router.post('/:id/tests', async (req, res) => {
  try {
    const { test_id } = req.body;
    const db = getDB();
    const reportsCollection = db.collection('reports');
    const testsCollection = db.collection('tests');
    const categoriesCollection = db.collection('test_categories');

    const report = await reportsCollection.findOne({ _id: req.params.id });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const test = await testsCollection.findOne({ _id: test_id });
    if (!test) return res.status(404).json({ error: 'Test not found' });

    // Check if test already in report
    const existing = (report.tests || []).find(t => String(t.test_id) === String(test_id));
    if (existing) return res.status(400).json({ error: 'Test already in report' });

    const category = test.category_id ? await categoriesCollection.findOne({ _id: test.category_id }) : null;

    const newTest = { test_id: test._id, test_name: test.name, specimen: test.specimen, category_name: category?.name || test.category_name || null };

    const newResults = (test.parameters || []).map(param => ({
      test_id: test._id,
      test_name: test.name,
      category_name: category?.name || test.category_name || null,
      param_name: param.param_name,
      result_value: '',
      is_abnormal: false,
      unit: param.unit,
      ref_range_male: param.ref_range_male,
      ref_range_female: param.ref_range_female,
      group_name: param.group_name,
      sort_order: param.sort_order,
    }));

    await reportsCollection.updateOne(
      { _id: req.params.id },
      {
        $push: {
          tests: newTest,
          results: { $each: newResults }
        },
        $set: {
          investigation: [...(report.tests || []), newTest].map(t => t.test_name).join(', ')
        }
      }
    );

    res.json({ message: 'Test added successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE remove test from report
router.delete('/:id/tests/:testId', async (req, res) => {
  try {
    const db = getDB();
    const reportsCollection = db.collection('reports');
    const report = await reportsCollection.findOne({ _id: req.params.id });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const testId = req.params.testId;

    const updatedTests = (report.tests || []).filter(t => String(t.test_id) !== testId);
    const updatedResults = (report.results || []).filter(r => String(r.test_id) !== testId);

    await reportsCollection.updateOne(
      { _id: req.params.id },
      {
        $set: {
          tests: updatedTests,
          results: updatedResults,
          investigation: updatedTests.map(t => t.test_name).join(', ')
        }
      }
    );

    res.json({ message: 'Test removed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
