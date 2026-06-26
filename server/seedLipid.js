/**
 * Update LIPID PROFILE under BIOCHEMISTRY with formulas and missing parameters.
 * Existing: Total Cholesterol, Triglycerides, HDL, LDL, VLDL (5 params, no formulas)
 * Adding: Non-HDL Cholesterol, TC/HDL Ratio, LDL/HDL Ratio (3 calculated params)
 * Adding formulas to: LDL (Friedewald), VLDL (TG/5)
 * 
 * Run: node server/seedLipid.js
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:admin8118@ac-yyrjnud-shard-00-00.sij25zs.mongodb.net:27017,ac-yyrjnud-shard-00-01.sij25zs.mongodb.net:27017,ac-yyrjnud-shard-00-02.sij25zs.mongodb.net:27017/PathoLabDB?ssl=true&replicaSet=atlas-brasg8-shard-0&authSource=admin&appName=PathLabPro';

const LIPID_PARAMETERS = [
  {
    id: 1,
    param_name: 'Total Cholesterol',
    unit: 'mg/dL',
    ref_range_male: '< 200',
    ref_range_female: '< 200',
    group_name: 'Lipid Profile',
    sort_order: 1,
    calc_formula: '',
    calc_decimals: null,
  },
  {
    id: 2,
    param_name: 'Triglycerides',
    unit: 'mg/dL',
    ref_range_male: '< 150',
    ref_range_female: '< 150',
    group_name: 'Lipid Profile',
    sort_order: 2,
    calc_formula: '',
    calc_decimals: null,
  },
  {
    id: 3,
    param_name: 'HDL Cholesterol',
    unit: 'mg/dL',
    ref_range_male: '> 40',
    ref_range_female: '> 50',
    group_name: 'Lipid Profile',
    sort_order: 3,
    calc_formula: '',
    calc_decimals: null,
  },
  {
    id: 4,
    param_name: 'LDL Cholesterol',
    unit: 'mg/dL',
    ref_range_male: '< 100',
    ref_range_female: '< 100',
    group_name: 'Lipid Profile',
    sort_order: 4,
    // Friedewald formula: LDL = Total Cholesterol - HDL - (Triglycerides / 5)
    calc_formula: 'Total Cholesterol - HDL Cholesterol - (Triglycerides / 5)',
    calc_decimals: 0,
  },
  {
    id: 5,
    param_name: 'VLDL Cholesterol',
    unit: 'mg/dL',
    ref_range_male: '5 - 40',
    ref_range_female: '5 - 40',
    group_name: 'Lipid Profile',
    sort_order: 5,
    // VLDL = Triglycerides / 5
    calc_formula: 'Triglycerides / 5',
    calc_decimals: 0,
  },
  {
    id: 6,
    param_name: 'Non-HDL Cholesterol',
    unit: 'mg/dL',
    ref_range_male: '< 130',
    ref_range_female: '< 130',
    group_name: 'Lipid Profile',
    sort_order: 6,
    // Non-HDL = Total Cholesterol - HDL Cholesterol
    calc_formula: 'Total Cholesterol - HDL Cholesterol',
    calc_decimals: 0,
  },
  {
    id: 7,
    param_name: 'Total Cholesterol / HDL Ratio',
    unit: 'Ratio',
    ref_range_male: '< 4.5',
    ref_range_female: '< 4.5',
    group_name: 'Lipid Profile',
    sort_order: 7,
    // TC/HDL Ratio
    calc_formula: 'Total Cholesterol / HDL Cholesterol',
    calc_decimals: 1,
  },
  {
    id: 8,
    param_name: 'LDL / HDL Ratio',
    unit: 'Ratio',
    ref_range_male: '< 3.0',
    ref_range_female: '< 3.0',
    group_name: 'Lipid Profile',
    sort_order: 8,
    // LDL/HDL Ratio
    calc_formula: 'LDL Cholesterol / HDL Cholesterol',
    calc_decimals: 1,
  },
];

async function run() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('PathoLabDB');

  const testsCollection = db.collection('tests');
  const categoriesCollection = db.collection('test_categories');

  // Find existing LIPID PROFILE test
  const existingTest = await testsCollection.findOne({
    name: { $regex: /lipid profile/i }
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

    // Merge: update existing params, add new ones
    const updatedParams = LIPID_PARAMETERS.map(newParam => {
      const existing = existingParams.find(ep => ep.param_name.toLowerCase() === newParam.param_name.toLowerCase());
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
    console.log('LIPID PROFILE not found, creating under BIOCHEMISTRY...');
    await testsCollection.insertOne({
      name: 'LIPID PROFILE',
      category_id: biochemCategory._id,
      specimen: 'BLOOD',
      parameters: LIPID_PARAMETERS,
    });
    console.log(`Created test with ${LIPID_PARAMETERS.length} parameters`);
  }

  // Print summary
  const finalTest = await testsCollection.findOne({ name: { $regex: /lipid profile/i } });
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
