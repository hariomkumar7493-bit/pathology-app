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

    // Run independent counts in parallel
    const [totalPatients, pendingReports, completedReports, todayTests, allTests, allCategories] = await Promise.all([
      patientsCollection.countDocuments(),
      reportsCollection.countDocuments({ status: 'Pending' }),
      reportsCollection.countDocuments({ status: 'Completed' }),
      // Today's tests - check both Date and string formats
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
      // All tests (for category mapping)
      testsCollection.find({}, { projection: { _id: 1, category_id: 1 } }).toArray(),
      // All categories
      categoriesCollection.find({}).toArray(),
    ]);

    const totalReports = pendingReports + completedReports;

    // Build category lookup maps (in-memory, no extra queries)
    const testCategoryMap = {};
    allTests.forEach(t => { if (t.category_id) testCategoryMap[t._id.toString()] = t.category_id.toString(); });
    const categoryNameMap = {};
    allCategories.forEach(c => { categoryNameMap[c._id.toString()] = c.name; });

    // Category stats from recent reports using aggregation pipeline
    const categoryPipeline = [
      { $unwind: '$tests' },
      { $group: { _id: '$tests.test_id', count: { $sum: 1 } } }
    ];
    const testCounts = await reportsCollection.aggregate(categoryPipeline).toArray();

    const categoryCountMap = {};
    testCounts.forEach(tc => {
      const catId = testCategoryMap[tc._id?.toString()];
      if (catId) {
        const catName = categoryNameMap[catId];
        if (catName) categoryCountMap[catName] = (categoryCountMap[catName] || 0) + tc.count;
      }
    });

    const categoryStats = Object.entries(categoryCountMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Recent reports with patient names via $lookup (avoids N+1)
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

    const recentReportsFormatted = recentReportsAgg.map(r => ({
      id: r._id,
      patient_name: r.patient_info?.name || r.patient_name || 'Unknown',
      investigation: r.investigation || '',
      status: r.status,
      ref_no: r.ref_no,
    }));

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
