const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const sql = require('mssql/msnodesqlv8');
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://admin:admin8118@pathlabpro.sij25zs.mongodb.net/PathoLabDB?retryWrites=true&w=majority';

const mssqlConfig = {
  server: 'localhost\\SQLEXPRESS',
  database: 'PathoLabDB',
  driver: 'msnodesqlv8',
  options: {
    trustedConnection: true,
    trustServerCertificate: true,
  },
};

async function migrate() {
  console.log('=== MSSQL → MongoDB Migration ===\n');

  // Connect to MSSQL
  console.log('1. Connecting to MSSQL...');
  let pool;
  try {
    pool = await sql.connect(mssqlConfig);
    console.log('   ✓ MSSQL connected\n');
  } catch (err) {
    console.error('   ✗ MSSQL connection failed:', err.message);
    process.exit(1);
  }

  // Connect to MongoDB
  console.log('2. Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  console.log('   ✓ MongoDB connected\n');

  // ========== Read from MSSQL ==========
  console.log('3. Reading data from MSSQL...');

  // Categories
  const catResult = await pool.request().query('SELECT * FROM test_categories ORDER BY id');
  const mssqlCategories = catResult.recordset;
  console.log(`   - ${mssqlCategories.length} categories`);

  // Tests
  const testResult = await pool.request().query('SELECT * FROM tests ORDER BY category_id, name');
  const mssqlTests = testResult.recordset;
  console.log(`   - ${mssqlTests.length} tests`);

  // Parameters
  const paramResult = await pool.request().query('SELECT * FROM test_parameters ORDER BY test_id, sort_order, id');
  const mssqlParams = paramResult.recordset;
  console.log(`   - ${mssqlParams.length} parameters\n`);

  // ========== Insert into MongoDB ==========
  const categoriesCollection = db.collection('test_categories');
  const testsCollection = db.collection('tests');

  // Clear existing data
  console.log('4. Clearing existing MongoDB data...');
  await categoriesCollection.deleteMany({});
  await testsCollection.deleteMany({});
  console.log('   ✓ Cleared\n');

  // Insert categories
  console.log('5. Inserting categories...');
  const catIdMap = {}; // mssql id -> mongo ObjectId

  for (const cat of mssqlCategories) {
    const result = await categoriesCollection.insertOne({
      name: (cat.name || '').trim().toUpperCase(),
    });
    catIdMap[cat.id] = result.insertedId;
    console.log(`   ✓ ${(cat.name || '').trim()}`);
  }

  // Group parameters by test_id
  const paramsByTest = {};
  for (const p of mssqlParams) {
    if (!paramsByTest[p.test_id]) paramsByTest[p.test_id] = [];
    paramsByTest[p.test_id].push(p);
  }

  // Insert tests with embedded parameters
  console.log('\n6. Inserting tests with parameters...');
  let testCount = 0;
  let paramCount = 0;

  for (const test of mssqlTests) {
    const testParams = paramsByTest[test.id] || [];
    const mongoCatId = catIdMap[test.category_id] || null;

    const parameters = testParams.map((p, idx) => {
      const param = {
        id: p.id || idx + 1,
        param_name: (p.param_name || '').trim(),
        unit: (p.unit || '').trim(),
        ref_range_male: (p.ref_range_male || '').trim(),
        ref_range_female: (p.ref_range_female || '').trim(),
        group_name: (p.group_name || (test.name || '')).trim(),
        sort_order: p.sort_order || idx + 1,
      };
      // Include ref_range_child if it exists
      if (p.ref_range_child && p.ref_range_child.trim()) {
        param.ref_range_child = p.ref_range_child.trim();
      }
      return param;
    });

    await testsCollection.insertOne({
      name: (test.name || '').trim(),
      category_id: mongoCatId,
      specimen: (test.specimen || 'BLOOD').trim(),
      parameters: parameters,
    });

    testCount++;
    paramCount += parameters.length;
    console.log(`   ✓ ${(test.name || '').trim()} (${parameters.length} params)`);
  }

  console.log(`\n========================================`);
  console.log(`✅ Migration complete!`);
  console.log(`   Categories: ${mssqlCategories.length}`);
  console.log(`   Tests:      ${testCount}`);
  console.log(`   Parameters: ${paramCount}`);
  console.log(`========================================\n`);

  await pool.close();
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
