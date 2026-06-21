const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI environment variable is required');
  process.exit(1);
}

async function seedTests() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully!');

    const db = mongoose.connection.db;
    const categoriesCollection = db.collection('test_categories');
    const testsCollection = db.collection('tests');

    // Check if already seeded
    const existingTests = await testsCollection.countDocuments();
    if (existingTests > 0) {
      console.log(`Tests already exist (${existingTests} found). Skipping seed.`);
      process.exit(0);
    }

    // ========== CATEGORIES ==========
    console.log('Seeding test categories...');
    const categories = [
      { name: 'HEMATOLOGY' },
      { name: 'BIOCHEMISTRY' },
      { name: 'LIVER FUNCTION' },
      { name: 'KIDNEY FUNCTION' },
      { name: 'LIPID PROFILE' },
      { name: 'THYROID' },
      { name: 'DIABETES' },
      { name: 'URINE ANALYSIS' },
      { name: 'SEROLOGY' },
      { name: 'COAGULATION' },
    ];

    const catResult = await categoriesCollection.insertMany(categories);
    const catIds = Object.values(catResult.insertedIds);
    console.log(`  ✓ ${catIds.length} categories created`);

    // Map for easy reference
    const catMap = {};
    categories.forEach((cat, i) => {
      catMap[cat.name] = catIds[i];
    });

    // ========== TESTS ==========
    console.log('Seeding tests...');

    const tests = [
      // HEMATOLOGY
      {
        name: 'Complete Blood Count (CBC)',
        category_id: catMap['HEMATOLOGY'],
        specimen: 'BLOOD (EDTA)',
        parameters: [
          { id: 1, param_name: 'Haemoglobin (Hb)', unit: 'g/dL', ref_range_male: '13.0 - 17.0', ref_range_female: '12.0 - 15.0', group_name: 'Complete Blood Count', sort_order: 1 },
          { id: 2, param_name: 'Total RBC Count', unit: 'mill/cumm', ref_range_male: '4.5 - 5.5', ref_range_female: '3.8 - 4.8', group_name: 'Complete Blood Count', sort_order: 2 },
          { id: 3, param_name: 'Total WBC Count', unit: 'cells/cumm', ref_range_male: '4000 - 11000', ref_range_female: '4000 - 11000', group_name: 'Complete Blood Count', sort_order: 3 },
          { id: 4, param_name: 'Platelet Count', unit: 'lakhs/cumm', ref_range_male: '1.5 - 4.0', ref_range_female: '1.5 - 4.0', group_name: 'Complete Blood Count', sort_order: 4 },
          { id: 5, param_name: 'PCV / Hematocrit', unit: '%', ref_range_male: '40 - 50', ref_range_female: '36 - 46', group_name: 'Complete Blood Count', sort_order: 5 },
          { id: 6, param_name: 'MCV', unit: 'fL', ref_range_male: '83 - 101', ref_range_female: '83 - 101', group_name: 'RBC Indices', sort_order: 6 },
          { id: 7, param_name: 'MCH', unit: 'pg', ref_range_male: '27 - 32', ref_range_female: '27 - 32', group_name: 'RBC Indices', sort_order: 7 },
          { id: 8, param_name: 'MCHC', unit: 'g/dL', ref_range_male: '31.5 - 34.5', ref_range_female: '31.5 - 34.5', group_name: 'RBC Indices', sort_order: 8 },
          { id: 9, param_name: 'Neutrophils', unit: '%', ref_range_male: '40 - 70', ref_range_female: '40 - 70', group_name: 'Differential Count', sort_order: 9 },
          { id: 10, param_name: 'Lymphocytes', unit: '%', ref_range_male: '20 - 40', ref_range_female: '20 - 40', group_name: 'Differential Count', sort_order: 10 },
          { id: 11, param_name: 'Eosinophils', unit: '%', ref_range_male: '1 - 6', ref_range_female: '1 - 6', group_name: 'Differential Count', sort_order: 11 },
          { id: 12, param_name: 'Monocytes', unit: '%', ref_range_male: '2 - 10', ref_range_female: '2 - 10', group_name: 'Differential Count', sort_order: 12 },
          { id: 13, param_name: 'Basophils', unit: '%', ref_range_male: '0 - 2', ref_range_female: '0 - 2', group_name: 'Differential Count', sort_order: 13 },
          { id: 14, param_name: 'ESR', unit: 'mm/hr', ref_range_male: '0 - 10', ref_range_female: '0 - 20', group_name: 'Complete Blood Count', sort_order: 14 },
        ]
      },

      // BIOCHEMISTRY
      {
        name: 'Blood Sugar (Fasting)',
        category_id: catMap['DIABETES'],
        specimen: 'BLOOD (FLUORIDE)',
        parameters: [
          { id: 1, param_name: 'Fasting Blood Sugar', unit: 'mg/dL', ref_range_male: '70 - 100', ref_range_female: '70 - 100', group_name: 'Blood Sugar', sort_order: 1 },
        ]
      },
      {
        name: 'Blood Sugar (PP)',
        category_id: catMap['DIABETES'],
        specimen: 'BLOOD (FLUORIDE)',
        parameters: [
          { id: 1, param_name: 'Post Prandial Blood Sugar', unit: 'mg/dL', ref_range_male: '< 140', ref_range_female: '< 140', group_name: 'Blood Sugar', sort_order: 1 },
        ]
      },
      {
        name: 'Blood Sugar (Random)',
        category_id: catMap['DIABETES'],
        specimen: 'BLOOD (FLUORIDE)',
        parameters: [
          { id: 1, param_name: 'Random Blood Sugar', unit: 'mg/dL', ref_range_male: '< 200', ref_range_female: '< 200', group_name: 'Blood Sugar', sort_order: 1 },
        ]
      },
      {
        name: 'HbA1c (Glycated Hemoglobin)',
        category_id: catMap['DIABETES'],
        specimen: 'BLOOD (EDTA)',
        parameters: [
          { id: 1, param_name: 'HbA1c', unit: '%', ref_range_male: '4.0 - 5.6', ref_range_female: '4.0 - 5.6', group_name: 'Glycated Hemoglobin', sort_order: 1 },
          { id: 2, param_name: 'Estimated Average Glucose', unit: 'mg/dL', ref_range_male: '68 - 114', ref_range_female: '68 - 114', group_name: 'Glycated Hemoglobin', sort_order: 2 },
        ]
      },

      // LIPID PROFILE
      {
        name: 'Lipid Profile',
        category_id: catMap['LIPID PROFILE'],
        specimen: 'BLOOD (SERUM)',
        parameters: [
          { id: 1, param_name: 'Total Cholesterol', unit: 'mg/dL', ref_range_male: '< 200', ref_range_female: '< 200', group_name: 'Lipid Profile', sort_order: 1 },
          { id: 2, param_name: 'Triglycerides', unit: 'mg/dL', ref_range_male: '< 150', ref_range_female: '< 150', group_name: 'Lipid Profile', sort_order: 2 },
          { id: 3, param_name: 'HDL Cholesterol', unit: 'mg/dL', ref_range_male: '40 - 60', ref_range_female: '50 - 60', group_name: 'Lipid Profile', sort_order: 3 },
          { id: 4, param_name: 'LDL Cholesterol', unit: 'mg/dL', ref_range_male: '< 100', ref_range_female: '< 100', group_name: 'Lipid Profile', sort_order: 4 },
          { id: 5, param_name: 'VLDL Cholesterol', unit: 'mg/dL', ref_range_male: '5 - 40', ref_range_female: '5 - 40', group_name: 'Lipid Profile', sort_order: 5 },
          { id: 6, param_name: 'Total Cholesterol / HDL Ratio', unit: '', ref_range_male: '< 5.0', ref_range_female: '< 5.0', group_name: 'Lipid Profile', sort_order: 6 },
        ]
      },

      // LIVER FUNCTION
      {
        name: 'Liver Function Test (LFT)',
        category_id: catMap['LIVER FUNCTION'],
        specimen: 'BLOOD (SERUM)',
        parameters: [
          { id: 1, param_name: 'Total Bilirubin', unit: 'mg/dL', ref_range_male: '0.1 - 1.2', ref_range_female: '0.1 - 1.2', group_name: 'Bilirubin', sort_order: 1 },
          { id: 2, param_name: 'Direct Bilirubin', unit: 'mg/dL', ref_range_male: '0.0 - 0.3', ref_range_female: '0.0 - 0.3', group_name: 'Bilirubin', sort_order: 2 },
          { id: 3, param_name: 'Indirect Bilirubin', unit: 'mg/dL', ref_range_male: '0.1 - 0.9', ref_range_female: '0.1 - 0.9', group_name: 'Bilirubin', sort_order: 3 },
          { id: 4, param_name: 'SGOT (AST)', unit: 'U/L', ref_range_male: '5 - 40', ref_range_female: '5 - 35', group_name: 'Enzymes', sort_order: 4 },
          { id: 5, param_name: 'SGPT (ALT)', unit: 'U/L', ref_range_male: '7 - 56', ref_range_female: '7 - 45', group_name: 'Enzymes', sort_order: 5 },
          { id: 6, param_name: 'Alkaline Phosphatase', unit: 'U/L', ref_range_male: '44 - 147', ref_range_female: '44 - 147', group_name: 'Enzymes', sort_order: 6 },
          { id: 7, param_name: 'Total Protein', unit: 'g/dL', ref_range_male: '6.0 - 8.3', ref_range_female: '6.0 - 8.3', group_name: 'Proteins', sort_order: 7 },
          { id: 8, param_name: 'Albumin', unit: 'g/dL', ref_range_male: '3.5 - 5.5', ref_range_female: '3.5 - 5.5', group_name: 'Proteins', sort_order: 8 },
          { id: 9, param_name: 'Globulin', unit: 'g/dL', ref_range_male: '2.0 - 3.5', ref_range_female: '2.0 - 3.5', group_name: 'Proteins', sort_order: 9 },
          { id: 10, param_name: 'A/G Ratio', unit: '', ref_range_male: '1.1 - 2.5', ref_range_female: '1.1 - 2.5', group_name: 'Proteins', sort_order: 10 },
        ]
      },

      // KIDNEY FUNCTION
      {
        name: 'Kidney Function Test (KFT)',
        category_id: catMap['KIDNEY FUNCTION'],
        specimen: 'BLOOD (SERUM)',
        parameters: [
          { id: 1, param_name: 'Blood Urea', unit: 'mg/dL', ref_range_male: '15 - 40', ref_range_female: '15 - 40', group_name: 'Kidney Function', sort_order: 1 },
          { id: 2, param_name: 'Blood Urea Nitrogen (BUN)', unit: 'mg/dL', ref_range_male: '7 - 20', ref_range_female: '7 - 20', group_name: 'Kidney Function', sort_order: 2 },
          { id: 3, param_name: 'Serum Creatinine', unit: 'mg/dL', ref_range_male: '0.7 - 1.3', ref_range_female: '0.6 - 1.1', group_name: 'Kidney Function', sort_order: 3 },
          { id: 4, param_name: 'Serum Uric Acid', unit: 'mg/dL', ref_range_male: '3.4 - 7.0', ref_range_female: '2.4 - 6.0', group_name: 'Kidney Function', sort_order: 4 },
          { id: 5, param_name: 'Serum Sodium', unit: 'mEq/L', ref_range_male: '136 - 145', ref_range_female: '136 - 145', group_name: 'Electrolytes', sort_order: 5 },
          { id: 6, param_name: 'Serum Potassium', unit: 'mEq/L', ref_range_male: '3.5 - 5.1', ref_range_female: '3.5 - 5.1', group_name: 'Electrolytes', sort_order: 6 },
          { id: 7, param_name: 'Serum Calcium', unit: 'mg/dL', ref_range_male: '8.5 - 10.5', ref_range_female: '8.5 - 10.5', group_name: 'Electrolytes', sort_order: 7 },
          { id: 8, param_name: 'Serum Phosphorus', unit: 'mg/dL', ref_range_male: '2.5 - 4.5', ref_range_female: '2.5 - 4.5', group_name: 'Electrolytes', sort_order: 8 },
        ]
      },

      // THYROID
      {
        name: 'Thyroid Profile (T3, T4, TSH)',
        category_id: catMap['THYROID'],
        specimen: 'BLOOD (SERUM)',
        parameters: [
          { id: 1, param_name: 'T3 (Triiodothyronine)', unit: 'ng/dL', ref_range_male: '80 - 200', ref_range_female: '80 - 200', group_name: 'Thyroid Profile', sort_order: 1 },
          { id: 2, param_name: 'T4 (Thyroxine)', unit: 'µg/dL', ref_range_male: '4.5 - 12.0', ref_range_female: '4.5 - 12.0', group_name: 'Thyroid Profile', sort_order: 2 },
          { id: 3, param_name: 'TSH (Thyroid Stimulating Hormone)', unit: 'µIU/mL', ref_range_male: '0.3 - 4.2', ref_range_female: '0.3 - 4.2', group_name: 'Thyroid Profile', sort_order: 3 },
        ]
      },

      // URINE ANALYSIS
      {
        name: 'Urine Routine & Microscopy',
        category_id: catMap['URINE ANALYSIS'],
        specimen: 'URINE',
        parameters: [
          { id: 1, param_name: 'Colour', unit: '', ref_range_male: 'Pale Yellow', ref_range_female: 'Pale Yellow', group_name: 'Physical Examination', sort_order: 1 },
          { id: 2, param_name: 'Appearance', unit: '', ref_range_male: 'Clear', ref_range_female: 'Clear', group_name: 'Physical Examination', sort_order: 2 },
          { id: 3, param_name: 'Specific Gravity', unit: '', ref_range_male: '1.005 - 1.030', ref_range_female: '1.005 - 1.030', group_name: 'Physical Examination', sort_order: 3 },
          { id: 4, param_name: 'pH', unit: '', ref_range_male: '4.6 - 8.0', ref_range_female: '4.6 - 8.0', group_name: 'Chemical Examination', sort_order: 4 },
          { id: 5, param_name: 'Protein', unit: '', ref_range_male: 'Nil', ref_range_female: 'Nil', group_name: 'Chemical Examination', sort_order: 5 },
          { id: 6, param_name: 'Glucose', unit: '', ref_range_male: 'Nil', ref_range_female: 'Nil', group_name: 'Chemical Examination', sort_order: 6 },
          { id: 7, param_name: 'Ketone Bodies', unit: '', ref_range_male: 'Nil', ref_range_female: 'Nil', group_name: 'Chemical Examination', sort_order: 7 },
          { id: 8, param_name: 'Bile Salts', unit: '', ref_range_male: 'Absent', ref_range_female: 'Absent', group_name: 'Chemical Examination', sort_order: 8 },
          { id: 9, param_name: 'Bile Pigments', unit: '', ref_range_male: 'Absent', ref_range_female: 'Absent', group_name: 'Chemical Examination', sort_order: 9 },
          { id: 10, param_name: 'RBC', unit: '/HPF', ref_range_male: '0 - 2', ref_range_female: '0 - 2', group_name: 'Microscopic Examination', sort_order: 10 },
          { id: 11, param_name: 'Pus Cells', unit: '/HPF', ref_range_male: '0 - 5', ref_range_female: '0 - 5', group_name: 'Microscopic Examination', sort_order: 11 },
          { id: 12, param_name: 'Epithelial Cells', unit: '/HPF', ref_range_male: '0 - 5', ref_range_female: '0 - 5', group_name: 'Microscopic Examination', sort_order: 12 },
          { id: 13, param_name: 'Casts', unit: '', ref_range_male: 'Nil', ref_range_female: 'Nil', group_name: 'Microscopic Examination', sort_order: 13 },
          { id: 14, param_name: 'Crystals', unit: '', ref_range_male: 'Nil', ref_range_female: 'Nil', group_name: 'Microscopic Examination', sort_order: 14 },
        ]
      },

      // SEROLOGY
      {
        name: 'Widal Test',
        category_id: catMap['SEROLOGY'],
        specimen: 'BLOOD (SERUM)',
        parameters: [
          { id: 1, param_name: 'S. Typhi O', unit: '', ref_range_male: '< 1:80', ref_range_female: '< 1:80', group_name: 'Widal Test', sort_order: 1 },
          { id: 2, param_name: 'S. Typhi H', unit: '', ref_range_male: '< 1:80', ref_range_female: '< 1:80', group_name: 'Widal Test', sort_order: 2 },
          { id: 3, param_name: 'S. Paratyphi AH', unit: '', ref_range_male: '< 1:80', ref_range_female: '< 1:80', group_name: 'Widal Test', sort_order: 3 },
          { id: 4, param_name: 'S. Paratyphi BH', unit: '', ref_range_male: '< 1:80', ref_range_female: '< 1:80', group_name: 'Widal Test', sort_order: 4 },
        ]
      },
      {
        name: 'Dengue NS1 Antigen',
        category_id: catMap['SEROLOGY'],
        specimen: 'BLOOD (SERUM)',
        parameters: [
          { id: 1, param_name: 'Dengue NS1 Antigen', unit: '', ref_range_male: 'Negative', ref_range_female: 'Negative', group_name: 'Dengue', sort_order: 1 },
        ]
      },
      {
        name: 'Dengue IgM / IgG',
        category_id: catMap['SEROLOGY'],
        specimen: 'BLOOD (SERUM)',
        parameters: [
          { id: 1, param_name: 'Dengue IgM', unit: '', ref_range_male: 'Negative', ref_range_female: 'Negative', group_name: 'Dengue Antibodies', sort_order: 1 },
          { id: 2, param_name: 'Dengue IgG', unit: '', ref_range_male: 'Negative', ref_range_female: 'Negative', group_name: 'Dengue Antibodies', sort_order: 2 },
        ]
      },
      {
        name: 'Malaria Antigen (Rapid)',
        category_id: catMap['SEROLOGY'],
        specimen: 'BLOOD (EDTA)',
        parameters: [
          { id: 1, param_name: 'P. Vivax', unit: '', ref_range_male: 'Negative', ref_range_female: 'Negative', group_name: 'Malaria', sort_order: 1 },
          { id: 2, param_name: 'P. Falciparum', unit: '', ref_range_male: 'Negative', ref_range_female: 'Negative', group_name: 'Malaria', sort_order: 2 },
        ]
      },

      // COAGULATION
      {
        name: 'Prothrombin Time (PT/INR)',
        category_id: catMap['COAGULATION'],
        specimen: 'BLOOD (CITRATE)',
        parameters: [
          { id: 1, param_name: 'Prothrombin Time (PT)', unit: 'seconds', ref_range_male: '11 - 16', ref_range_female: '11 - 16', group_name: 'Coagulation', sort_order: 1 },
          { id: 2, param_name: 'Control', unit: 'seconds', ref_range_male: '12 - 14', ref_range_female: '12 - 14', group_name: 'Coagulation', sort_order: 2 },
          { id: 3, param_name: 'INR', unit: '', ref_range_male: '0.8 - 1.2', ref_range_female: '0.8 - 1.2', group_name: 'Coagulation', sort_order: 3 },
        ]
      },

      // BIOCHEMISTRY extras
      {
        name: 'Serum Vitamin D (25-OH)',
        category_id: catMap['BIOCHEMISTRY'],
        specimen: 'BLOOD (SERUM)',
        parameters: [
          { id: 1, param_name: 'Vitamin D (25-OH)', unit: 'ng/mL', ref_range_male: '30 - 100', ref_range_female: '30 - 100', group_name: 'Vitamin D', sort_order: 1 },
        ]
      },
      {
        name: 'Serum Vitamin B12',
        category_id: catMap['BIOCHEMISTRY'],
        specimen: 'BLOOD (SERUM)',
        parameters: [
          { id: 1, param_name: 'Vitamin B12', unit: 'pg/mL', ref_range_male: '200 - 900', ref_range_female: '200 - 900', group_name: 'Vitamin B12', sort_order: 1 },
        ]
      },
      {
        name: 'Serum Iron Profile',
        category_id: catMap['BIOCHEMISTRY'],
        specimen: 'BLOOD (SERUM)',
        parameters: [
          { id: 1, param_name: 'Serum Iron', unit: 'µg/dL', ref_range_male: '65 - 175', ref_range_female: '50 - 170', group_name: 'Iron Studies', sort_order: 1 },
          { id: 2, param_name: 'TIBC', unit: 'µg/dL', ref_range_male: '250 - 370', ref_range_female: '250 - 370', group_name: 'Iron Studies', sort_order: 2 },
          { id: 3, param_name: 'Transferrin Saturation', unit: '%', ref_range_male: '20 - 50', ref_range_female: '20 - 50', group_name: 'Iron Studies', sort_order: 3 },
          { id: 4, param_name: 'Serum Ferritin', unit: 'ng/mL', ref_range_male: '20 - 250', ref_range_female: '10 - 120', group_name: 'Iron Studies', sort_order: 4 },
        ]
      },
    ];

    const testResult = await testsCollection.insertMany(tests);
    console.log(`  ✓ ${Object.keys(testResult.insertedIds).length} tests created`);

    console.log('\n✅ Seed complete! Your database now has:');
    console.log(`   - ${catIds.length} test categories`);
    console.log(`   - ${Object.keys(testResult.insertedIds).length} tests with parameters`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding tests:', error.message);
    process.exit(1);
  }
}

seedTests();
