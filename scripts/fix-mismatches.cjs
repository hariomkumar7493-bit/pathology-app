const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.8.4']);
const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://admin:admin8118@pathlabpro.sij25zs.mongodb.net/PathoLabDB?retryWrites=true&w=majority';

const FIXES = {
  'ADA (ADENOSINE DEAMINASE)-BODY FLUID': { 'ADA': { male: '< 40', female: '< 40' } },
  'Bleeding Time & Clotting Time': { 
    'Bleeding Time': { male: '1 - 3', female: '1 - 3' },
    'Clotting Time': { male: '4 - 10', female: '4 - 10' },
  },
  'AMH (Anti Mullerian Hormone)': { 'AMH (Anti Mullerian Hormone)': { unit: 'ng/mL', male: '-', female: '0.2 - 10.0' } },
  'Ca 15.3-Breast Cancer Marker': { 'Ca 15.3-Breast Cancer Marker': { male: '< 31', female: '< 31', unit: 'U/mL' } },
  'BLOOD GAS ANALYSIS, ARTERIAL': { 
    'pH': { male: '7.35 - 7.45', female: '7.35 - 7.45' }, // arterial pH, not urine pH - DB is correct, standard DB matched wrong pH
    'Bicarbonate (HCO3)': { unit: 'mmol/L', male: '22 - 26', female: '22 - 26' },
  },
  'Protein Electrophoresis': { 'Albumin': { unit: '%', male: '55 - 70', female: '55 - 70' } }, // electrophoresis is %, not g/dL - DB is correct
  'Semen Analysis': { 'pH': { male: '7.2 - 8.0', female: '-' } }, // semen pH, not urine pH - DB is correct
  'Progesterone': { 'Progesterone': { male: '0.2 - 1.4', female: '0.2 - 25' } },
  'Estradiol E2': { 'Estradiol (E2)': { male: '10 - 40', female: '20 - 400' } },
  'DENGUE PROFILE - CARD TEST': { 
    'Dengue IgG': { male: 'Negative', female: 'Negative' }, // card test is qualitative - DB is correct
    'Dengue IgM': { male: 'Negative', female: 'Negative' },
  },
};

async function run() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const testsCol = db.collection('tests');

  let fixed = 0;
  for (const [testName, paramFixes] of Object.entries(FIXES)) {
    const test = await testsCol.findOne({ name: testName });
    if (!test) { console.log(`! Not found: ${testName}`); continue; }

    let modified = false;
    const params = test.parameters.map(p => {
      const fix = paramFixes[p.param_name];
      if (!fix) return p;
      modified = true;
      return {
        ...p,
        unit: fix.unit !== undefined ? fix.unit : p.unit,
        ref_range_male: fix.male || p.ref_range_male,
        ref_range_female: fix.female || p.ref_range_female,
      };
    });

    if (modified) {
      await testsCol.updateOne({ _id: test._id }, { $set: { parameters: params } });
      fixed++;
      const changed = Object.keys(paramFixes).join(', ');
      console.log(`+ Fixed: ${testName} -> ${changed}`);
    }
  }

  console.log(`\nFixed: ${fixed} tests`);
  console.log('\nNote: Some "mismatches" were false positives:');
  console.log('  - ABG pH (7.35-7.45) is arterial blood pH, not urine pH (5.0-8.0) - DB was correct');
  console.log('  - Semen pH (7.2-8.0) is semen-specific, not urine pH - DB was correct');
  console.log('  - Protein Electrophoresis Albumin is in %, not g/dL - DB was correct');
  console.log('  - Dengue Card Test is qualitative (Negative), not quantitative Index - DB was correct');
  console.log('  - Progesterone/Estradiol female ranges with "(cycle dependent)" note - simplified to match standard');
  
  await mongoose.disconnect();
  process.exit(0);
}
run().catch(err => { console.error(err); process.exit(1); });
