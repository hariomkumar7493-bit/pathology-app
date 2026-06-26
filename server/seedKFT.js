/**
 * Seed/update KFT (Kidney Function Test) parameters with Indian standard reference ranges.
 * Run: node server/seedKFT.js
 * 
 * If KFT test already exists, updates its parameters (does not duplicate).
 * If not, creates it under the first available category (or creates a KFT category).
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
    param_name: 'eGFR',
    unit: 'mL/min/1.73m²',
    ref_range_male: '> 90',
    ref_range_female: '> 90',
    group_name: 'KFT',
    sort_order: 9,
    calc_formula: '',
    calc_decimals: 0,
  },
  {
    id: 10,
    param_name: 'BUN/Creatinine Ratio',
    unit: 'Ratio',
    ref_range_male: '10 - 20',
    ref_range_female: '10 - 20',
    group_name: 'KFT',
    sort_order: 10,
    // BUN = Blood Urea / 2.14; BUN/Creat Ratio = (Blood Urea / 2.14) / Serum Creatinine
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

  // Check if KFT test already exists (case-insensitive)
  const existingKFT = await testsCollection.findOne({
    name: { $regex: /^KFT$/i }
  });

  // Find or create a category for KFT
  let category = await categoriesCollection.findOne({ name: { $regex: /^KFT$/i } });
  if (!category) {
    // Try "Kidney Function" or "Clinical Pathology"
    category = await categoriesCollection.findOne({ name: { $regex: /kidney/i } });
  }
  if (!category) {
    // Create KFT category
    const result = await categoriesCollection.insertOne({ name: 'KFT' });
    category = await categoriesCollection.findOne({ _id: result.insertedId });
    console.log('Created category: KFT');
  }

  if (existingKFT) {
    // Update existing KFT test with new parameters
    console.log('KFT test found, updating parameters...');
    
    // Check which parameters already exist (by param_name) to avoid duplicates
    const existingParamNames = (existingKFT.parameters || []).map(p => p.param_name.toLowerCase());
    const newParams = KFT_PARAMETERS.filter(p => !existingParamNames.includes(p.param_name.toLowerCase()));
    const updatedParams = KFT_PARAMETERS.map(p => {
      const existing = (existingKFT.parameters || []).find(ep => ep.param_name.toLowerCase() === p.param_name.toLowerCase());
      if (existing) {
        // Update reference ranges but keep existing id
        return { ...p, id: existing.id };
      }
      return p;
    });

    await testsCollection.updateOne(
      { _id: existingKFT._id },
      { $set: { parameters: updatedParams, category_id: category._id } }
    );
    console.log(`KFT updated with ${updatedParams.length} parameters (${newParams.length} new added)`);
  } else {
    // Create new KFT test
    console.log('KFT test not found, creating...');
    await testsCollection.insertOne({
      name: 'KFT',
      category_id: category._id,
      specimen: 'BLOOD',
      parameters: KFT_PARAMETERS,
    });
    console.log(`KFT test created with ${KFT_PARAMETERS.length} parameters`);
  }

  // Print summary
  const finalTest = await testsCollection.findOne({ name: { $regex: /^KFT$/i } });
  console.log('\nFinal KFT parameters:');
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
