const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { ObjectId } = require('mongodb');

// GET all tests with categories
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const testsCollection = db.collection('tests');
    const categoriesCollection = db.collection('test_categories');
    
    const tests = await testsCollection.find({}).toArray();
    const categories = await categoriesCollection.find({}).toArray();
    
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat._id.toString()] = cat.name;
    });
    
    const testsWithCategory = tests.map(test => ({
      ...test,
      category_name: categoryMap[test.category_id?.toString()] || null
    }));
    
    testsWithCategory.sort((a, b) => {
      if (a.category_name !== b.category_name) {
        return (a.category_name || '').localeCompare(b.category_name || '');
      }
      return a.name.localeCompare(b.name);
    });
    
    res.json(testsWithCategory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all categories
router.get('/categories', async (req, res) => {
  try {
    const db = getDB();
    const categoriesCollection = db.collection('test_categories');
    const categories = await categoriesCollection.find({}).sort({ name: 1 }).toArray();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET test parameters
router.get('/:id/parameters', async (req, res) => {
  try {
    const db = getDB();
    const testsCollection = db.collection('tests');
    const test = await testsCollection.findOne({ _id: new ObjectId(req.params.id) });
    
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    
    const parameters = test.parameters || [];
    parameters.sort((a, b) => a.sort_order - b.sort_order);
    
    res.json(parameters);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET parameters for multiple tests
router.post('/parameters/bulk', async (req, res) => {
  try {
    const { testIds } = req.body;
    if (!testIds || !testIds.length) return res.json([]);
    
    const db = getDB();
    const testsCollection = db.collection('tests');
    const categoriesCollection = db.collection('test_categories');
    
    const objectIds = testIds.map(id => new ObjectId(id));
    const tests = await testsCollection.find({ _id: { $in: objectIds } }).toArray();
    const categories = await categoriesCollection.find({}).toArray();
    
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat._id.toString()] = cat.name;
    });
    
    let allParameters = [];
    tests.forEach(test => {
      const parameters = test.parameters || [];
      parameters.forEach(param => {
        allParameters.push({
          ...param,
          test_name: test.name,
          category_name: categoryMap[test.category_id?.toString()] || null
        });
      });
    });
    
    allParameters.sort((a, b) => {
      if (a.test_name !== b.test_name) {
        return a.test_name.localeCompare(b.test_name);
      }
      return a.sort_order - b.sort_order;
    });
    
    res.json(allParameters);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
