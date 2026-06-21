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

// ========== ADMIN: Category CRUD ==========

// POST create category
router.post('/categories', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });

    const db = getDB();
    const categoriesCollection = db.collection('test_categories');
    
    const existing = await categoriesCollection.findOne({ name: name.toUpperCase() });
    if (existing) return res.status(400).json({ error: 'Category already exists' });

    const result = await categoriesCollection.insertOne({ name: name.toUpperCase() });
    const newCat = await categoriesCollection.findOne({ _id: result.insertedId });
    res.status(201).json(newCat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update category
router.put('/categories/:id', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });

    const db = getDB();
    const categoriesCollection = db.collection('test_categories');
    
    await categoriesCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { name: name.toUpperCase() } }
    );
    res.json({ message: 'Category updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE category
router.delete('/categories/:id', async (req, res) => {
  try {
    const db = getDB();
    const categoriesCollection = db.collection('test_categories');
    const testsCollection = db.collection('tests');

    // Check if any tests use this category
    const testsUsingCat = await testsCollection.countDocuments({ category_id: new ObjectId(req.params.id) });
    if (testsUsingCat > 0) {
      return res.status(400).json({ error: `Cannot delete: ${testsUsingCat} test(s) use this category` });
    }

    await categoriesCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== ADMIN: Test CRUD ==========

// POST create test
router.post('/', async (req, res) => {
  try {
    const { name, category_id, specimen, parameters } = req.body;
    if (!name) return res.status(400).json({ error: 'Test name is required' });

    const db = getDB();
    const testsCollection = db.collection('tests');

    const test = {
      name,
      category_id: category_id ? new ObjectId(category_id) : null,
      specimen: specimen || 'BLOOD',
      parameters: (parameters || []).map((p, idx) => ({
        id: p.id || idx + 1,
        param_name: p.param_name || '',
        unit: p.unit || '',
        ref_range_male: p.ref_range_male || '',
        ref_range_female: p.ref_range_female || '',
        group_name: p.group_name || name,
        sort_order: p.sort_order || idx + 1,
      })),
    };

    const result = await testsCollection.insertOne(test);
    const newTest = await testsCollection.findOne({ _id: result.insertedId });
    res.status(201).json(newTest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update test
router.put('/:id', async (req, res) => {
  try {
    const { name, category_id, specimen, parameters } = req.body;
    const db = getDB();
    const testsCollection = db.collection('tests');

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (category_id !== undefined) updateData.category_id = category_id ? new ObjectId(category_id) : null;
    if (specimen !== undefined) updateData.specimen = specimen;
    if (parameters !== undefined) {
      updateData.parameters = parameters.map((p, idx) => ({
        id: p.id || idx + 1,
        param_name: p.param_name || '',
        unit: p.unit || '',
        ref_range_male: p.ref_range_male || '',
        ref_range_female: p.ref_range_female || '',
        group_name: p.group_name || '',
        sort_order: p.sort_order || idx + 1,
      }));
    }

    await testsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );

    const updated = await testsCollection.findOne({ _id: new ObjectId(req.params.id) });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE test
router.delete('/:id', async (req, res) => {
  try {
    const db = getDB();
    const testsCollection = db.collection('tests');
    await testsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ message: 'Test deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
