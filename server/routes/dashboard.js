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

    const [totalPatients, pendingReports, completedReports, todayTests, allTests, allCategories] = await Promise.all([
      patientsCollection.countDocuments(),
      reportsCollection.countDocuments({ status: 'Pending' }),
      reportsCollection.countDocuments({ status: 'Completed' }),
      (async () => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const countDate = await reportsCollection.countDocuments({
          date_of_collection: { $gte: today, $lt: tomorrow }
        });
        if (countDate > 0) return countDate;
        return reportsCollection.countDocuments({ date_of_collection: todayStr });
      })(),
      testsCollection.find({}, { projection: { _id: 1, category_id: 1 } }).toArray(),
      categoriesCollection.find({}).toArray(),
    ]);

    const totalReports = pendingReports + completedReports;

    // Build category lookup maps
    const testCategoryMap = {};
    allTests.forEach(t => { if (t.category_id) testCategoryMap[String(t._id)] = String(t.category_id); });
    const categoryNameMap = {};
    allCategories.forEach(c => { categoryNameMap[String(c._id)] = c.name; });

    // Category stats from reports
    const categoryPipeline = [
      { $unwind: '$tests' },
      { $group: { _id: '$tests.test_id', count: { $sum: 1 } } }
    ];
    const testCounts = await reportsCollection.aggregate(categoryPipeline).toArray();

    const categoryCountMap = {};
    testCounts.forEach(tc => {
      const catId = testCategoryMap[String(tc._id)];
      if (catId) {
        const catName = categoryNameMap[catId];
        if (catName) categoryCountMap[catName] = (categoryCountMap[catName] || 0) + tc.count;
      }
    });

    const categoryStats = Object.entries(categoryCountMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Recent reports with patient names via $lookup
    const recentReportsAgg = await reportsCollection.aggregate([
      { $sort: { created_at: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'patients',
          localField: 'patient_id',
          foreignField: '_id',
          as: 'patient_info'
        }
      },
      { $unwind: { path: '$patient_info', preserveNullAndEmptyArrays: true } },
    ]).toArray();

    const recentReportsFormatted = recentReportsAgg.map(r => {
      const { patient_info, created_at, ...rest } = r;
      return {
        ...rest,
        patient_name: patient_info?.name || r.patient_name || 'Unknown',
      };
    });

    res.json({
      totalPatients,
      totalReports,
      pendingReports,
      completedReports,
      todayTests,
      recentReports: recentReportsFormatted,
      categoryStats,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
