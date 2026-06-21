const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const patientsCollection = db.collection('patients');
    const reportsCollection = db.collection('reports');
    const testsCollection = db.collection('tests');
    const categoriesCollection = db.collection('test_categories');

    const totalPatients = await patientsCollection.countDocuments();
    const totalReports = await reportsCollection.countDocuments();
    const pendingReports = await reportsCollection.countDocuments({ status: 'Pending' });
    const completedReports = await reportsCollection.countDocuments({ status: 'Completed' });
    
    // Get today's tests
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayTests = await reportsCollection.countDocuments({
      date_of_collection: { $gte: today, $lt: tomorrow }
    });

    // Get recent reports with patient info
    const recentReports = await reportsCollection
      .find({})
      .sort({ created_at: -1 })
      .limit(10)
      .toArray();
    
    const recentReportsWithPatient = await Promise.all(recentReports.map(async (report) => {
      const patient = await patientsCollection.findOne({ _id: report.patient_id });
      return {
        ...report,
        patient_name: patient?.name,
        patient_age: patient?.age,
        patient_gender: patient?.gender
      };
    }));

    // Get category stats
    const reports = await reportsCollection.find({}).toArray();
    const categoryCountMap = {};
    
    for (const report of reports) {
      const tests = report.tests || [];
      for (const test of tests) {
        const testDoc = await testsCollection.findOne({ _id: test.test_id });
        if (testDoc && testDoc.category_id) {
          const category = await categoriesCollection.findOne({ _id: testDoc.category_id });
          if (category) {
            categoryCountMap[category.name] = (categoryCountMap[category.name] || 0) + 1;
          }
        }
      }
    }
    
    const categoryStats = Object.entries(categoryCountMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      totalPatients,
      totalReports,
      pendingReports,
      completedReports,
      todayTests,
      recentReports: recentReportsWithPatient,
      categoryStats,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
