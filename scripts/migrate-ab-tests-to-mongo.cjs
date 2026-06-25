const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.8.4']);

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
  console.log('=== MSSQL ab_tests_da -> MongoDB Migration ===\n');

  // Connect to MSSQL
  console.log('1. Connecting to MSSQL...');
  let pool;
  try {
    pool = await sql.connect(mssqlConfig);
    console.log('   Connected to MSSQL\n');
  } catch (err) {
    console.error('   MSSQL connection failed:', err.message);
    process.exit(1);
  }

  // Connect to MongoDB
  console.log('2. Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  console.log('   Connected to MongoDB\n');

  // Read all rows from ab_tests_da
  console.log('3. Reading data from ab_tests_da...');
  const result = await pool.request().query('SELECT * FROM ab_tests_da ORDER BY Department, [Test Name]');
  const rows = result.recordset;
  console.log(`   ${rows.length} rows, ${new Set(rows.map(r => r['Test Name'])).size} distinct tests\n`);

  // Group rows by Test Name
  const testsMap = {}; // testName -> { department, testCode, sample, parameters: [] }

  for (const row of rows) {
    const testName = (row['Test Name'] || '').trim();
    if (!testName) continue;

    if (!testsMap[testName]) {
      testsMap[testName] = {
        department: (row['Department'] || '').trim().toUpperCase(),
        testCode: (row['Test Code'] || '').trim(),
        sample: (row['Sample'] || 'BLOOD').trim(),
        parameters: [],
      };
    }

    const paramName = (row['Parameter Name'] || '').trim();
    if (paramName) {
      testsMap[testName].parameters.push({
        param_name: paramName,
        sub_parameter: (row['Sub Parameter Name'] || '').trim(),
        unit: (row['Parameter Unit'] || '').trim(),
        ref_range: (row['Parameter Range'] || '').trim(),
      });
    }
  }

  // Get unique departments (categories)
  const departments = [...new Set(Object.values(testsMap).map(t => t.department))].sort();
  console.log(`4. Found ${departments.length} departments/categories:`);
  departments.forEach(d => console.log(`   - ${d}`));
  console.log('');

  // Clear existing data
  const categoriesCollection = db.collection('test_categories');
  const testsCollection = db.collection('tests');

  console.log('5. Clearing existing MongoDB test data...');
  await testsCollection.deleteMany({});
  await categoriesCollection.deleteMany({});
  console.log('   Cleared\n');

  // Insert categories
  console.log('6. Inserting categories...');
  const catIdMap = {}; // department name -> ObjectId

  for (const dept of departments) {
    const existing = await categoriesCollection.findOne({ name: dept });
    if (existing) {
      catIdMap[dept] = existing._id;
    } else {
      const insertResult = await categoriesCollection.insertOne({ name: dept });
      catIdMap[dept] = insertResult.insertedId;
    }
    console.log(`   + ${dept}`);
  }
  console.log('');

  // Insert tests with embedded parameters
  console.log('7. Inserting tests with parameters...');
  let testCount = 0;
  let paramCount = 0;

  for (const [testName, testData] of Object.entries(testsMap)) {
    const categoryId = catIdMap[testData.department] || null;
    
    const parameters = testData.parameters.map((p, idx) => ({
      id: idx + 1,
      param_name: p.param_name,
      unit: p.unit,
      ref_range_male: p.ref_range,
      ref_range_female: p.ref_range,
      group_name: p.sub_parameter || testName,
      sort_order: idx + 1,
    }));

    const testDoc = {
      name: testName,
      category_id: categoryId,
      specimen: testData.sample || 'BLOOD',
      test_code: testData.testCode,
      parameters: parameters,
    };

    await testsCollection.insertOne(testDoc);
    testCount++;
    paramCount += parameters.length;
    console.log(`   + ${testName} (${parameters.length} params) [${testData.department}]`);
  }

  console.log(`\n========================================`);
  console.log(`Migration complete!`);
  console.log(`   Categories: ${departments.length}`);
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
