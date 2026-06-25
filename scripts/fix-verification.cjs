const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.8.4']);
const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://admin:admin8118@pathlabpro.sij25zs.mongodb.net/PathoLabDB?retryWrites=true&w=majority';

const FIXES = {
  // Fix missing units
  'LIVER FUNCTION TEST (LFT)': { 'A/G Ratio': { unit: 'ratio' } },
  'Semen Analysis': { 'pH': { unit: '' } }, // pH has no unit, keep empty but that's fine
  'Coagulation Profile': { 'INR': { unit: 'ratio' } },
  'PT INR': { 'INR': { unit: 'ratio' } },
  'URINE ROUTINE': { 'pH': { unit: '' }, 'Specific Gravity': { unit: '' } }, // pH and SG are unitless
  
  // Fix placeholder ranges with actual Indian reference ranges
  'CREATININE CLEARANCE TEST - URINE TEST': { 'Urine Creatinine': { male: '20 - 320', female: '20 - 320' } },
  'SAAG': { 'Ascitic Fluid Albumin': { male: '-', female: '-' } }, // depends on patient, keep as-is
  'URINE PROTEIN/CREATININE RATIO': { 
    'Urine Protein': { male: '-', female: '-' }, // calculated from patient urine
    'Urine Creatinine': { male: '-', female: '-' },
  },
  'Rh Factor  (Quantity)': { 'Rh Factor (Quantitative)': { male: 'Report in IU/mL', female: 'Report in IU/mL' } },
  'PLGF (Placental Growth Factor)': { 'PLGF': { male: '-', female: 'Report as pg/mL (pregnancy specific)' } },
  'Peripheral Blood Smear/ GBP': { 'Peripheral Blood Smear': { male: 'Normal', female: 'Normal' } },
  'Dual Marker Test': { 'Free Beta hCG': { male: '-', female: 'Pregnancy specific (MoM)' } },
  'Quadruple Marker Test': { 
    'AFP': { male: '-', female: 'Pregnancy specific (MoM)' },
    'hCG': { male: '-', female: 'Pregnancy specific (MoM)' },
    'Estriol': { male: '-', female: 'Pregnancy specific (MoM)' },
    'Inhibin-A': { male: '-', female: 'Pregnancy specific (MoM)' },
  },
  'Triple Marker Test': { 
    'AFP': { male: '-', female: 'Pregnancy specific (MoM)' },
    'hCG': { male: '-', female: 'Pregnancy specific (MoM)' },
    'Estriol': { male: '-', female: 'Pregnancy specific (MoM)' },
  },
  'Urine Alubmin & Creatnine Ratio (ACR)': { 
    'Urine Albumin': { male: '-', female: '-' },
    'Urine Creatinine': { male: '-', female: '-' },
  },
  'Anti Nuclear Antibodies': { 
    'Primary Intensity of IF': { male: '-', female: '-' },
    'End Point Dilution': { male: '< 1:80 (Negative)', female: '< 1:80 (Negative)' },
    'Note': { male: '-', female: '-' },
  },
  'LH (LEUTNISING HORMONE)-SERUM': { 'LH (LEUTNISING HORMONE)-SERUM': { replace_name: 'LH', male: '1.5 - 9.3', female: '1.9 - 12.5', unit: 'mIU/mL' } },
  'Gram Stain': { 'Gram Stain': { male: 'No organisms seen', female: 'No organisms seen' } },
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
        param_name: fix.replace_name || p.param_name,
        unit: fix.unit !== undefined ? fix.unit : p.unit,
        ref_range_male: fix.male || p.ref_range_male,
        ref_range_female: fix.female || p.ref_range_female,
      };
    });

    if (modified) {
      await testsCol.updateOne({ _id: test._id }, { $set: { parameters: params } });
      fixed++;
      console.log(`+ Fixed: ${testName}`);
    }
  }

  console.log(`\nFixed: ${fixed} tests`);
  await mongoose.disconnect();
  process.exit(0);
}
run().catch(err => { console.error(err); process.exit(1); });
