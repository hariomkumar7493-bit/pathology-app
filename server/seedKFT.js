/**
 * Update KIDNEY FUNCTION TEST(KFT) under BIOCHEMISTRY with full parameter set.
 * Merges new params into existing ones (Blood Urea, Creatinine, Uric Acid already exist).
 * Renames "Creatinine" → "Serum Creatinine" for formula compatibility.
 * Adds: Sodium, Potassium, Chloride, Calcium, Phosphorus, BUN, eGFR, BUN/Creatinine Ratio
 * 
 * Run: node server/seedKFT.js
 */

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:admin8118@ac-yyrjnud-shard-00-00.sij25zs.mongodb.net:27017,ac-yyrjnud-shard-00-01.sij25zs.mongodb.net:27017,ac-yyrjnud-shard-00-02.sij25zs.mongodb.net:27017/PathoLabDB?ssl=true&replicaSet=atlas-brasg8-shard-0&authSource=admin&appName=PathLabPro';

const KFT_PARAMETERS = [
  {
    id: 1,
    param_name: 'Blood Urea',
    unit: 'mg/dL',
    ref_range_male: '15 - 40',
    ref_range_female: '15 - 40',
    group_name: 'KFT',
    sort_order: 1,
    calc_formula: '',
    calc_decimals: null,
  },
  {
    id: 2,
    param_name: 'Serum Creatinine',
    unit: 'mg/dL',
    ref_range_male: '0.7 - 1.3',
    ref_range_female: '0.6 - 1.1',
    group_name: 'KFT',
    sort_order: 2,
    calc_formula: '',
    calc_decimals: null,
  },
  {
    id: 3,
    param_name: 'Uric Acid',
    unit: 'mg/dL',
    ref_range_male: '3.4 - 7.0',
    ref_range_female: '2.4 - 6.0',
    group_name: 'KFT',
    sort_order: 3,
    calc_formula: '',
    calc_decimals: null,
  },
  {
    id: 4,
    param_name: 'Sodium',
    unit: 'mmol/L',
    ref_range_male: '135 - 155',
    ref_range_female: '135 - 155',
    group_name: 'KFT',
    sort_order: 4,
    calc_formula: '',
    calc_decimals: null,
  },
  {
    id: 5,
    param_name: 'Potassium',
    unit: 'mmol/L',
    ref_range_male: '3.5 - 5.5',
    ref_range_female: '3.5 - 5.5',
    group_name: 'KFT',
    sort_order: 5,
    calc_formula: '',
    calc_decimals: null,
  },
  {
    id: 6,
    param_name: 'Chloride',
    unit: 'mmol/L',
    ref_range_male: '98 - 107',
    ref_range_female: '98 - 107',
    group_name: 'KFT',
    sort_order: 6,
    calc_formula: '',
    calc_decimals: null,
  },
  {
    id: 7,
    param_name: 'Calcium',
    unit: 'mg/dL',
    ref_range_male: '8.5 - 10.5',
    ref_range_female: '8.5 - 10.5',
    group_name: 'KFT',
    sort_order: 7,
    calc_formula: '',
    calc_decimals: null,
  },
  {
    id: 8,
    param_name: 'Phosphorus',
    unit: 'mg/dL',
    ref_range_male: '2.5 - 4.5',
    ref_range_female: '2.5 - 4.5',
    group_name: 'KFT',
    sort_order: 8,
    calc_formula: '',
    calc_decimals: null,
  },
  {
    id: 9,
    param_name: 'BUN',
    unit: 'mg/dL',
    ref_range_male: '7 - 20',
    ref_range_female: '7 - 20',
    group_name: 'KFT',
    sort_order: 9,
    // BUN = Blood Urea / 2.14
    calc_formula: 'Blood Urea / 2.14',
    calc_decimals: 1,
  },
  {
    id: 10,
    param_name: 'eGFR',
    unit: 'mL/min/1.73m²',
    ref_range_male: '> 90',
    ref_range_female: '> 90',
    group_name: 'KFT',
    sort_order: 10,
    // CKD-EPI 2021 (race-free) equation:
    // eGFR = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^-1.200 × 0.9938^age × 1.012 (if female)
    // κ = 0.7 (female), 0.9 (male) → 0.9 - 0.2 * {gender_female}
    // α = -0.241 (female), -0.302 (male) → -0.302 + 0.061 * {gender_female}
    calc_formula: '142 * pow(min(Serum Creatinine / (0.9 - 0.2 * {gender_female}), 1), -0.302 + 0.061 * {gender_female}) * pow(max(Serum Creatinine / (0.9 - 0.2 * {gender_female}), 1), -1.200) * pow(0.9938, {age}) * (1 + 0.012 * {gender_female})',
    calc_decimals: 0,
  },
  {
    id: 11,
    param_name: 'BUN/Creatinine Ratio',
    unit: 'Ratio',
    ref_range_male: '10 - 20',
    ref_range_female: '10 - 20',
    group_name: 'KFT',
    sort_order: 11,
    // BUN/Creat Ratio = (Blood Urea / 2.14) / Serum Creatinine
    calc_formula: 'Blood Urea / (2.14 * Serum Creatinine)',
    calc_decimals: 1,
  },
];

async function run() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('PathoLabDB');

  const testsCollection = db.collection('tests');
  const categoriesCollection = db.collection('test_categories');

  // Find the existing KIDNEY FUNCTION TEST(KFT) test
  const existingTest = await testsCollection.findOne({
    name: { $regex: /kidney function test/i }
  });

  // Find BIOCHEMISTRY category
  const biochemCategory = await categoriesCollection.findOne({ name: { $regex: /biochem/i } });
  if (!biochemCategory) {
    console.error('BIOCHEMISTRY category not found!');
    await client.close();
    return;
  }

  if (existingTest) {
    console.log('Found existing test:', existingTest.name);
    console.log('Existing params:', (existingTest.parameters || []).map(p => p.param_name).join(', '));

    const existingParams = existingTest.parameters || [];

    // Build the final parameter list — merge existing with new
    const updatedParams = KFT_PARAMETERS.map(newParam => {
      // Try exact match first
      let existing = existingParams.find(ep => ep.param_name.toLowerCase() === newParam.param_name.toLowerCase());
      // Special case: "Creatinine" matches "Serum Creatinine"
      if (!existing && newParam.param_name === 'Serum Creatinine') {
        existing = existingParams.find(ep => ep.param_name.toLowerCase() === 'creatinine');
      }
      if (existing) {
        return { ...newParam, id: existing.id };
      }
      return newParam;
    });

    // Re-assign IDs to be sequential
    updatedParams.forEach((p, idx) => { p.id = idx + 1; });

    await testsCollection.updateOne(
      { _id: existingTest._id },
      { $set: { parameters: updatedParams, category_id: biochemCategory._id } }
    );
    console.log(`Updated test with ${updatedParams.length} parameters`);
  } else {
    console.log('KIDNEY FUNCTION TEST(KFT) not found, creating under BIOCHEMISTRY...');
    await testsCollection.insertOne({
      name: 'KIDNEY FUNCTION TEST(KFT)',
      category_id: biochemCategory._id,
      specimen: 'BLOOD',
      parameters: KFT_PARAMETERS,
    });
    console.log(`Created test with ${KFT_PARAMETERS.length} parameters`);
  }

  // Print summary
  const finalTest = await testsCollection.findOne({ name: { $regex: /kidney function test/i } });
  console.log('\nFinal parameters for "' + finalTest.name + '":');
  (finalTest.parameters || []).forEach(p => {
    console.log(`  ${p.sort_order}. ${p.param_name} (${p.unit}) | M: ${p.ref_range_male} | F: ${p.ref_range_female} | ${p.calc_formula ? 'CALC: ' + p.calc_formula : 'Numeric'}`);
  });

  await client.close();
  console.log('\nDone!');
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
