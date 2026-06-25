const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.8.4']);
const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://admin:admin8118@pathlabpro.sij25zs.mongodb.net/PathoLabDB?retryWrites=true&w=majority';

async function run() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const tests = await db.collection('tests').find({}).toArray();

  let missingUnit = [];
  let missingMale = [];
  let missingFemale = [];
  let missingBoth = [];
  let calcParams = [];
  let totalParams = 0;

  for (const test of tests) {
    for (const p of (test.parameters || [])) {
      totalParams++;
      
      if (!p.unit || p.unit === '' || p.unit === '-') {
        // Allow '-' for qualitative tests
      }
      if (!p.ref_range_male || p.ref_range_male === '' || p.ref_range_male === '-') {
        // Allow '-' for descriptive tests
      }
      
      // Check for truly missing data (empty string, not '-')
      if (p.unit === '') missingUnit.push(`${test.name} -> ${p.param_name}`);
      if (p.ref_range_male === '') missingMale.push(`${test.name} -> ${p.param_name}`);
      if (p.ref_range_female === '') missingFemale.push(`${test.name} -> ${p.param_name}`);
      if (p.ref_range_male === '' && p.ref_range_female === '') missingBoth.push(`${test.name} -> ${p.param_name}`);
      
      if (p.calc_formula && p.calc_formula !== '') {
        calcParams.push({
          test: test.name,
          param: p.param_name,
          unit: p.unit,
          male: p.ref_range_male,
          female: p.ref_range_female,
          formula: p.calc_formula,
          decimals: p.calc_decimals,
        });
      }
    }
  }

  console.log('=== DATA VERIFICATION REPORT ===\n');
  console.log(`Total tests: ${tests.length}`);
  console.log(`Total parameters: ${totalParams}\n`);

  console.log('--- CALCULATED PARAMETERS ---');
  console.log(`Count: ${calcParams.length}\n`);
  calcParams.forEach(c => {
    console.log(`  Test: ${c.test}`);
    console.log(`  Param: ${c.param}`);
    console.log(`  Unit: ${c.unit || '(MISSING)'}`);
    console.log(`  Ref Male: ${c.male || '(MISSING)'}`);
    console.log(`  Ref Female: ${c.female || '(MISSING)'}`);
    console.log(`  Formula: ${c.formula}`);
    console.log(`  Decimals: ${c.decimals ?? 2}`);
    console.log('');
  });

  console.log('--- MISSING UNITS (empty string) ---');
  console.log(`Count: ${missingUnit.length}`);
  missingUnit.forEach(m => console.log(`  ${m}`));

  console.log('\n--- MISSING MALE REF RANGE (empty string) ---');
  console.log(`Count: ${missingMale.length}`);
  missingMale.forEach(m => console.log(`  ${m}`));

  console.log('\n--- MISSING FEMALE REF RANGE (empty string) ---');
  console.log(`Count: ${missingFemale.length}`);
  missingFemale.forEach(m => console.log(`  ${m}`));

  // Check for tests with placeholder '-' for both ranges (may need real ranges)
  console.log('\n--- TESTS WITH "-" PLACEHOLDER RANGES (review needed) ---');
  let placeholderCount = 0;
  for (const test of tests) {
    for (const p of (test.parameters || [])) {
      if ((p.ref_range_male === '-' || p.ref_range_male === '') && 
          (p.ref_range_female === '-' || p.ref_range_female === '') &&
          !p.calc_formula) {
        // Skip culture/cytology/histopathology descriptive tests
        const isDescriptive = ['Culture', 'Cytology', 'FNAC', 'PAP', 'Histopathology', 'Gene', 'Report', 'Examination', 'Medical', 'Drug', 'Wound', 'Swab'].some(k => p.param_name.includes(k));
        if (!isDescriptive) {
          placeholderCount++;
          console.log(`  ${test.name} -> ${p.param_name} (unit: ${p.unit})`);
        }
      }
    }
  }
  console.log(`\nNon-descriptive tests with placeholder ranges: ${placeholderCount}`);

  await mongoose.disconnect();
  process.exit(0);
}
run().catch(err => { console.error(err); process.exit(1); });
