const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { ObjectId } = require('mongodb');
const { sendPushNotification } = require('./notifications');

// GET all reports
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const reportsCollection = db.collection('reports');
    const patientsCollection = db.collection('patients');
    
    const reports = await reportsCollection.find({}).sort({ created_at: -1 }).toArray();
    
    const reportsWithPatient = await Promise.all(reports.map(async (report) => {
      const patient = await patientsCollection.findOne({ _id: report.patient_id });
      return {
        ...report,
        patient_name: patient?.name,
        patient_age: patient?.age,
        patient_gender: patient?.gender,
        patient_phone: patient?.phone,
        patient_referred_by: patient?.referred_by
      };
    }));
    
    res.json(reportsWithPatient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single report with full details
router.get('/:id', async (req, res) => {
  try {
    const db = getDB();
    const reportsCollection = db.collection('reports');
    const patientsCollection = db.collection('patients');
    const testsCollection = db.collection('tests');
    const categoriesCollection = db.collection('test_categories');
    
    const report = await reportsCollection.findOne({ _id: new ObjectId(req.params.id) });
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const patient = await patientsCollection.findOne({ _id: report.patient_id });
    
    const reportData = {
      ...report,
      patient_name: patient?.name,
      patient_age: patient?.age,
      patient_gender: patient?.gender,
      patient_phone: patient?.phone,
      patient_referred_by: patient?.referred_by,
      patient_address: patient?.address
    };

    // Get tests with category info
    const tests = report.tests || [];
    const testsWithCategory = await Promise.all(tests.map(async (test) => {
      const testDoc = await testsCollection.findOne({ _id: test.test_id });
      const category = await categoriesCollection.findOne({ _id: testDoc?.category_id });
      return {
        ...test,
        test_name: testDoc?.name,
        specimen: testDoc?.specimen,
        category_name: category?.name
      };
    }));

    // Get results with parameter info
    const results = report.results || [];
    const resultsWithInfo = await Promise.all(results.map(async (result) => {
      const testDoc = await testsCollection.findOne({ _id: result.test_id });
      const category = await categoriesCollection.findOne({ _id: testDoc?.category_id });
      const parameter = testDoc?.parameters?.find(p => p.param_name === result.param_name);
      return {
        ...result,
        unit: parameter?.unit,
        ref_range_male: parameter?.ref_range_male,
        ref_range_female: parameter?.ref_range_female,
        group_name: parameter?.group_name,
        sort_order: parameter?.sort_order,
        test_name: testDoc?.name,
        category_name: category?.name
      };
    }));

    resultsWithInfo.sort((a, b) => {
      if (a.test_name !== b.test_name) {
        return a.test_name.localeCompare(b.test_name);
      }
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    res.json({
      ...reportData,
      tests: testsWithCategory,
      results: resultsWithInfo,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create report (with test selection)
router.post('/', async (req, res) => {
  try {
    const { patient_id, test_ids, specimen, investigation, doctor_name, doctor_designation, date_of_collection } = req.body;
    const db = getDB();
    const reportsCollection = db.collection('reports');
    const testsCollection = db.collection('tests');

    // Generate ref_no
    const count = await reportsCollection.countDocuments();
    const refNo = (count + 1).toString();

    // Get test names for investigation field
    let investigationText = investigation;
    if (!investigationText && test_ids && test_ids.length) {
      const objectIds = test_ids.map(id => new ObjectId(id));
      const tests = await testsCollection.find({ _id: { $in: objectIds } }).toArray();
      investigationText = tests.map(t => t.name).join(', ');
    }

    // Build tests array with empty results
    const testsArray = [];
    const resultsArray = [];
    
    if (test_ids && test_ids.length) {
      for (const testId of test_ids) {
        const test = await testsCollection.findOne({ _id: new ObjectId(testId) });
        if (test) {
          testsArray.push({
            test_id: test._id,
            test_name: test.name,
            specimen: test.specimen
          });
          
          // Create empty result entries for each parameter
          const parameters = test.parameters || [];
          parameters.forEach(param => {
            resultsArray.push({
              test_id: test._id,
              param_name: param.param_name,
              result_value: '',
              is_abnormal: false,
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

    // Create report
    const report = {
      patient_id: new ObjectId(patient_id),
      ref_no: refNo,
      specimen: specimen || 'BLOOD',
      investigation: investigationText,
      doctor_name: doctor_name || 'Dr. C. Ashok',
      doctor_designation: doctor_designation || 'MBBS MD (PATH)',
      status: 'Pending',
      date_of_collection: date_of_collection ? new Date(date_of_collection) : new Date(),
      date_of_reporting: new Date(),
      created_at: new Date(),
      tests: testsArray,
      results: resultsArray
    };
    
    const result = await reportsCollection.insertOne(report);
    const newReport = await reportsCollection.findOne({ _id: result.insertedId });

    // Send push notification to mobile devices
    try { await sendPushNotification('New Report Created', `Report #${refNo} - ${investigationText || 'New report'}`, { type: 'report', reportId: String(result.insertedId) }); } catch(e) { console.error('Push error:', e); }

    res.status(201).json(newReport);
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
      updateData.date_of_reporting = new Date();
    }
    
    await reportsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );

    res.json({ message: 'Results updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST quick report (create patient + report + results in one go)
router.post('/quick', async (req, res) => {
  try {
    const { patient_name, age, gender, phone, referred_by, test_ids, results, specimen, doctor_name, doctor_designation, date_of_collection } = req.body;
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
        // Update patient info
        await patientsCollection.updateOne(
          { _id: patientId },
          { $set: { name: patient_name, age, gender, referred_by: referred_by || 'SELF' } }
        );
      }
    }

    if (!patientId) {
      const patient = {
        name: patient_name,
        age,
        gender,
        phone: phone || null,
        referred_by: referred_by || 'SELF',
        created_at: new Date()
      };
      const result = await patientsCollection.insertOne(patient);
      patientId = result.insertedId;
    }

    // Generate ref_no
    const count = await reportsCollection.countDocuments();
    const refNo = (count + 1).toString();

    // Get test names
    let investigationText = '';
    if (test_ids && test_ids.length) {
      const objectIds = test_ids.map(id => new ObjectId(id));
      const tests = await testsCollection.find({ _id: { $in: objectIds } }).toArray();
      investigationText = tests.map(t => t.name).join(', ');
    }

    // Build tests and results arrays
    const testsArray = [];
    const resultsArray = [];
    const categoriesCollection = db.collection('test_categories');
    
    if (test_ids && test_ids.length) {
      for (const testId of test_ids) {
        const test = await testsCollection.findOne({ _id: new ObjectId(testId) });
        if (test) {
          const category = await categoriesCollection.findOne({ _id: test.category_id });
          const categoryName = category?.name || null;
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
    const report = {
      patient_id: patientId,
      ref_no: refNo,
      specimen: specimen || 'BLOOD',
      investigation: investigationText,
      doctor_name: doctor_name || 'Dr. C. Ashok',
      doctor_designation: doctor_designation || 'MBBS MD (PATH)',
      status: 'Completed',
      date_of_collection: date_of_collection ? new Date(date_of_collection) : new Date(),
      date_of_reporting: new Date(),
      created_at: new Date(),
      tests: testsArray,
      results: resultsArray
    };
    
    const reportResult = await reportsCollection.insertOne(report);
    
    // Send push notification to mobile devices
    try { await sendPushNotification('New Quick Report', `${patient_name} - ${test_ids?.length || 0} test(s)`, { type: 'report', reportId: String(reportResult.insertedId) }); } catch(e) { console.error('Push error:', e); }
    
    // Return full report data so frontend doesn't need a second fetch
    res.status(201).json({ 
      reportId: reportResult.insertedId, 
      patientId, 
      refNo,
      report: {
        ...report,
        _id: reportResult.insertedId,
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
    await reportsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
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

    const report = await reportsCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const test = await testsCollection.findOne({ _id: new ObjectId(test_id) });
    if (!test) return res.status(404).json({ error: 'Test not found' });

    // Check if test already in report
    const existing = (report.tests || []).find(t => t.test_id.toString() === test_id);
    if (existing) return res.status(400).json({ error: 'Test already in report' });

    const category = await categoriesCollection.findOne({ _id: test.category_id });

    // Add test entry
    const newTest = { test_id: test._id, test_name: test.name, specimen: test.specimen };

    // Add result entries for all parameters
    const newResults = (test.parameters || []).map(param => ({
      test_id: test._id,
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
      { _id: new ObjectId(req.params.id) },
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
    const report = await reportsCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const testId = new ObjectId(req.params.testId);

    // Remove test and its results
    const updatedTests = (report.tests || []).filter(t => t.test_id.toString() !== req.params.testId);
    const updatedResults = (report.results || []).filter(r => r.test_id.toString() !== req.params.testId);

    await reportsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
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
