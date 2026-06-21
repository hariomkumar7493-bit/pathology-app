const { connectDB, mongoose } = require('./db');
const bcrypt = require('bcryptjs');

async function initDatabase() {
  try {
    await connectDB();
    const db = mongoose.connection.db;

    // Seed default admin user
    const usersCollection = db.collection('users');
    const userCount = await usersCollection.countDocuments();
    if (userCount === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await usersCollection.insertOne({
        name: 'Dr. C. Ashok',
        email: 'admin@pathlab.com',
        password: hashedPassword,
        role: 'admin',
        lab_name: 'S & S Diagnostic Center',
        created_at: new Date()
      });
      console.log('Default admin user created with hashed password');
    }

    // Seed test categories
    const categoriesCollection = db.collection('test_categories');
    const catCount = await categoriesCollection.countDocuments();
    if (catCount === 0) {
      const categories = [
        { name: 'Hematology', description: 'Blood related tests' },
        { name: 'Biochemistry', description: 'Chemical analysis of blood and body fluids' },
        { name: 'Endocrinology', description: 'Hormone related tests' },
        { name: 'Serology', description: 'Antibody and antigen tests' },
        { name: 'Clinical Pathology', description: 'Urine and body fluid analysis' },
        { name: 'Molecular Biology', description: 'DNA/RNA based tests' },
        { name: 'Microbiology', description: 'Culture and sensitivity tests' },
        { name: 'Immunology', description: 'Immune system related tests' }
      ];
      await categoriesCollection.insertMany(categories);
      console.log('Test categories created');
    }

    // Get categories for reference
    const categories = await categoriesCollection.find({}).toArray();
    const catMap = {};
    categories.forEach(cat => {
      catMap[cat.name] = cat._id;
    });

    // Seed tests with embedded parameters
    const testsCollection = db.collection('tests');
    const testCount = await testsCollection.countDocuments();
    if (testCount === 0) {
      const tests = [
        {
          name: 'Complete Blood Count (CBC)',
          category_id: catMap['Hematology'],
          specimen: 'BLOOD (EDTA)',
          price: 350,
          turnaround: '4-6 hours',
          parameters: [
            { group_name: 'COMPLETE BLOOD COUNT', param_name: 'Total W.B.C. Count', unit: '/cumm', ref_range_male: '4000 - 11000', ref_range_female: '4000 - 11000', sort_order: 1 },
            { group_name: 'COMPLETE BLOOD COUNT', param_name: 'R.B.C. Count (Erythrocytes)', unit: 'million/cumm', ref_range_male: '4.5 - 6.5', ref_range_female: '4.5 - 6.5', sort_order: 2 },
            { group_name: 'COMPLETE BLOOD COUNT', param_name: 'Haemoglobin', unit: 'gms/dl', ref_range_male: '13.0-16.0 M', ref_range_female: '11.5-13.5 F', sort_order: 3 },
            { group_name: 'COMPLETE BLOOD COUNT', param_name: 'Platelets Count', unit: 'lakhs/cumm', ref_range_male: '1.5 - 4.5', ref_range_female: '1.5 - 4.5', sort_order: 4 },
            { group_name: 'DIFFERENTIAL PERCENTAGE COUNT', param_name: 'Neutrophils', unit: '%', ref_range_male: '55 - 70', ref_range_female: '55 - 70', sort_order: 5 },
            { group_name: 'DIFFERENTIAL PERCENTAGE COUNT', param_name: 'Lymphocytes', unit: '%', ref_range_male: '20 - 35', ref_range_female: '20 - 35', sort_order: 6 },
            { group_name: 'DIFFERENTIAL PERCENTAGE COUNT', param_name: 'Monocytes', unit: '%', ref_range_male: '02 - 06', ref_range_female: '02 - 06', sort_order: 7 },
            { group_name: 'DIFFERENTIAL PERCENTAGE COUNT', param_name: 'Eosinophils', unit: '%', ref_range_male: '01 - 06', ref_range_female: '01 - 06', sort_order: 8 },
            { group_name: 'DIFFERENTIAL PERCENTAGE COUNT', param_name: 'Basophils', unit: '%', ref_range_male: '00 - 01', ref_range_female: '00 - 01', sort_order: 9 },
            { group_name: 'RED CELL ABSOLUTE VALUE', param_name: 'P C V (HCT)', unit: '%', ref_range_male: '35-50', ref_range_female: '35-50', sort_order: 10 },
            { group_name: 'RED CELL ABSOLUTE VALUE', param_name: 'M C V', unit: 'fl', ref_range_male: '78 - 94', ref_range_female: '78 - 94', sort_order: 11 },
            { group_name: 'RED CELL ABSOLUTE VALUE', param_name: 'M C H', unit: 'pg', ref_range_male: '27 - 32', ref_range_female: '27 - 32', sort_order: 12 },
            { group_name: 'RED CELL ABSOLUTE VALUE', param_name: 'MCHC', unit: '', ref_range_male: '32 - 38', ref_range_female: '32 - 38', sort_order: 13 },
            { group_name: 'RED CELL ABSOLUTE VALUE', param_name: 'RDW-CV', unit: '', ref_range_male: '11.6-16.0', ref_range_female: '11.6-16.0', sort_order: 14 },
            { group_name: 'RED CELL ABSOLUTE VALUE', param_name: 'RDW-SD', unit: '%', ref_range_male: '35.0-56.0', ref_range_female: '35.0-56.0', sort_order: 15 }
          ]
        },
        {
          name: 'ESR (Erythrocyte Sedimentation Rate)',
          category_id: catMap['Hematology'],
          specimen: 'BLOOD (EDTA)',
          price: 100,
          turnaround: '2-4 hours',
          parameters: [
            { group_name: 'ESR', param_name: 'ESR (Westergren)', unit: 'mm/1st hr', ref_range_male: '0 - 10', ref_range_female: '0 - 20', sort_order: 1 }
          ]
        },
        {
          name: 'Blood Group & Rh Typing',
          category_id: catMap['Hematology'],
          specimen: 'BLOOD (EDTA)',
          price: 150,
          turnaround: '1-2 hours',
          parameters: [
            { group_name: 'BLOOD GROUP', param_name: 'ABO Group', unit: '', ref_range_male: '-', ref_range_female: '-', sort_order: 1 },
            { group_name: 'BLOOD GROUP', param_name: 'Rh (D) Type', unit: '', ref_range_male: '-', ref_range_female: '-', sort_order: 2 }
          ]
        },
        {
          name: 'Blood Sugar Fasting',
          category_id: catMap['Biochemistry'],
          specimen: 'BLOOD (FLUORIDE)',
          price: 100,
          turnaround: '2-4 hours',
          parameters: [
            { group_name: 'BLOOD SUGAR', param_name: 'Fasting Blood Sugar', unit: 'mg/dl', ref_range_male: '70 - 110', ref_range_female: '70 - 110', sort_order: 1 }
          ]
        },
        {
          name: 'Blood Sugar PP (Post Prandial)',
          category_id: catMap['Biochemistry'],
          specimen: 'BLOOD (FLUORIDE)',
          price: 100,
          turnaround: '2-4 hours',
          parameters: [
            { group_name: 'BLOOD SUGAR', param_name: 'Post Prandial Blood Sugar', unit: 'mg/dl', ref_range_male: '< 140', ref_range_female: '< 140', sort_order: 1 }
          ]
        },
        {
          name: 'Blood Sugar Random',
          category_id: catMap['Biochemistry'],
          specimen: 'BLOOD (FLUORIDE)',
          price: 100,
          turnaround: '2-4 hours',
          parameters: [
            { group_name: 'BLOOD SUGAR', param_name: 'Random Blood Sugar', unit: 'mg/dl', ref_range_male: '< 200', ref_range_female: '< 200', sort_order: 1 }
          ]
        },
        {
          name: 'HbA1c (Glycosylated Hemoglobin)',
          category_id: catMap['Biochemistry'],
          specimen: 'BLOOD (EDTA)',
          price: 450,
          turnaround: '4-6 hours',
          parameters: [
            { group_name: 'HbA1c', param_name: 'HbA1c', unit: '%', ref_range_male: '4.0 - 6.0 (Normal), 6.0-6.5 (Pre-diabetic), >6.5 (Diabetic)', ref_range_female: '4.0 - 6.0 (Normal), 6.0-6.5 (Pre-diabetic), >6.5 (Diabetic)', sort_order: 1 }
          ]
        },
        {
          name: 'Lipid Profile',
          category_id: catMap['Biochemistry'],
          specimen: 'BLOOD (SERUM)',
          price: 600,
          turnaround: '6-8 hours',
          parameters: [
            { group_name: 'LIPID PROFILE', param_name: 'Total Cholesterol', unit: 'mg/dl', ref_range_male: '< 200 Desirable', ref_range_female: '< 200 Desirable', sort_order: 1 },
            { group_name: 'LIPID PROFILE', param_name: 'Triglycerides', unit: 'mg/dl', ref_range_male: '< 150', ref_range_female: '< 150', sort_order: 2 },
            { group_name: 'LIPID PROFILE', param_name: 'HDL Cholesterol', unit: 'mg/dl', ref_range_male: '35 - 80', ref_range_female: '35 - 80', sort_order: 3 },
            { group_name: 'LIPID PROFILE', param_name: 'LDL Cholesterol', unit: 'mg/dl', ref_range_male: '< 130', ref_range_female: '< 130', sort_order: 4 },
            { group_name: 'LIPID PROFILE', param_name: 'VLDL Cholesterol', unit: 'mg/dl', ref_range_male: '5 - 40', ref_range_female: '5 - 40', sort_order: 5 },
            { group_name: 'LIPID PROFILE', param_name: 'Total Cholesterol/HDL Ratio', unit: '', ref_range_male: '< 4.5', ref_range_female: '< 4.5', sort_order: 6 }
          ]
        },
        {
          name: 'Liver Function Test (LFT)',
          category_id: catMap['Biochemistry'],
          specimen: 'BLOOD (SERUM)',
          price: 750,
          turnaround: '6-8 hours',
          parameters: [
            { group_name: 'LIVER FUNCTION TEST', param_name: 'Total Bilirubin', unit: 'mg/dl', ref_range_male: '0.2 - 1.2', ref_range_female: '0.2 - 1.2', sort_order: 1 },
            { group_name: 'LIVER FUNCTION TEST', param_name: 'Direct Bilirubin', unit: 'mg/dl', ref_range_male: '0.0 - 0.3', ref_range_female: '0.0 - 0.3', sort_order: 2 },
            { group_name: 'LIVER FUNCTION TEST', param_name: 'Indirect Bilirubin', unit: 'mg/dl', ref_range_male: '0.1 - 0.9', ref_range_female: '0.1 - 0.9', sort_order: 3 },
            { group_name: 'LIVER FUNCTION TEST', param_name: 'SGOT (AST)', unit: 'U/L', ref_range_male: '5 - 40', ref_range_female: '5 - 40', sort_order: 4 },
            { group_name: 'LIVER FUNCTION TEST', param_name: 'SGPT (ALT)', unit: 'U/L', ref_range_male: '5 - 40', ref_range_female: '5 - 40', sort_order: 5 },
            { group_name: 'LIVER FUNCTION TEST', param_name: 'Alkaline Phosphatase', unit: 'U/L', ref_range_male: '30 - 120', ref_range_female: '30 - 120', sort_order: 6 },
            { group_name: 'LIVER FUNCTION TEST', param_name: 'Total Protein', unit: 'g/dl', ref_range_male: '6.0 - 8.0', ref_range_female: '6.0 - 8.0', sort_order: 7 },
            { group_name: 'LIVER FUNCTION TEST', param_name: 'Albumin', unit: 'g/dl', ref_range_male: '3.5 - 5.5', ref_range_female: '3.5 - 5.5', sort_order: 8 },
            { group_name: 'LIVER FUNCTION TEST', param_name: 'Globulin', unit: 'g/dl', ref_range_male: '2.0 - 3.5', ref_range_female: '2.0 - 3.5', sort_order: 9 },
            { group_name: 'LIVER FUNCTION TEST', param_name: 'A/G Ratio', unit: '', ref_range_male: '1.0 - 2.0', ref_range_female: '1.0 - 2.0', sort_order: 10 }
          ]
        },
        {
          name: 'Kidney Function Test (KFT/RFT)',
          category_id: catMap['Biochemistry'],
          specimen: 'BLOOD (SERUM)',
          price: 700,
          turnaround: '6-8 hours',
          parameters: [
            { group_name: 'KIDNEY FUNCTION TEST', param_name: 'Blood Urea', unit: 'mg/dl', ref_range_male: '15 - 40', ref_range_female: '15 - 40', sort_order: 1 },
            { group_name: 'KIDNEY FUNCTION TEST', param_name: 'Blood Urea Nitrogen (BUN)', unit: 'mg/dl', ref_range_male: '7 - 18', ref_range_female: '7 - 18', sort_order: 2 },
            { group_name: 'KIDNEY FUNCTION TEST', param_name: 'Serum Creatinine', unit: 'mg/dl', ref_range_male: '0.6 - 1.4', ref_range_female: '0.6 - 1.2', sort_order: 3 },
            { group_name: 'KIDNEY FUNCTION TEST', param_name: 'Serum Uric Acid', unit: 'mg/dl', ref_range_male: '3.5 - 7.0', ref_range_female: '2.5 - 6.0', sort_order: 4 },
            { group_name: 'KIDNEY FUNCTION TEST', param_name: 'Sodium (Na+)', unit: 'mEq/L', ref_range_male: '136 - 145', ref_range_female: '136 - 145', sort_order: 5 },
            { group_name: 'KIDNEY FUNCTION TEST', param_name: 'Potassium (K+)', unit: 'mEq/L', ref_range_male: '3.5 - 5.0', ref_range_female: '3.5 - 5.0', sort_order: 6 },
            { group_name: 'KIDNEY FUNCTION TEST', param_name: 'Chloride (Cl-)', unit: 'mEq/L', ref_range_male: '98 - 106', ref_range_female: '98 - 106', sort_order: 7 },
            { group_name: 'KIDNEY FUNCTION TEST', param_name: 'Calcium', unit: 'mg/dl', ref_range_male: '8.5 - 10.5', ref_range_female: '8.5 - 10.5', sort_order: 8 }
          ]
        },
        {
          name: 'Vitamin D (25-OH)',
          category_id: catMap['Biochemistry'],
          specimen: 'BLOOD (SERUM)',
          price: 1200,
          turnaround: '12-24 hours',
          parameters: [
            { group_name: 'VITAMIN D', param_name: 'Vitamin D Total (25-OH)', unit: 'ng/ml', ref_range_male: '30 - 100 (Sufficient), 20-30 (Insufficient), <20 (Deficient)', ref_range_female: '30 - 100 (Sufficient), 20-30 (Insufficient), <20 (Deficient)', sort_order: 1 }
          ]
        },
        {
          name: 'Vitamin B12',
          category_id: catMap['Biochemistry'],
          specimen: 'BLOOD (SERUM)',
          price: 900,
          turnaround: '12-24 hours',
          parameters: [
            { group_name: 'VITAMIN B12', param_name: 'Vitamin B12', unit: 'pg/ml', ref_range_male: '200 - 900', ref_range_female: '200 - 900', sort_order: 1 }
          ]
        },
        {
          name: 'Iron Studies',
          category_id: catMap['Hematology'],
          specimen: 'BLOOD (SERUM)',
          price: 650,
          turnaround: '6-8 hours',
          parameters: [
            { group_name: 'IRON STUDIES', param_name: 'Serum Iron', unit: 'mcg/dl', ref_range_male: '60 - 170', ref_range_female: '60 - 170', sort_order: 1 },
            { group_name: 'IRON STUDIES', param_name: 'TIBC', unit: 'mcg/dl', ref_range_male: '250 - 400', ref_range_female: '250 - 400', sort_order: 2 },
            { group_name: 'IRON STUDIES', param_name: 'Transferrin Saturation', unit: '%', ref_range_male: '20 - 50', ref_range_female: '20 - 50', sort_order: 3 },
            { group_name: 'IRON STUDIES', param_name: 'Serum Ferritin', unit: 'ng/ml', ref_range_male: '20 - 250', ref_range_female: '10 - 120', sort_order: 4 }
          ]
        },
        {
          name: 'Thyroid Profile (T3, T4, TSH)',
          category_id: catMap['Endocrinology'],
          specimen: 'BLOOD (SERUM)',
          price: 800,
          turnaround: '8-12 hours',
          parameters: [
            { group_name: 'THYROID PROFILE', param_name: 'T3 (Triiodothyronine)', unit: 'ng/dl', ref_range_male: '0.8 - 2.0', ref_range_female: '0.8 - 2.0', sort_order: 1 },
            { group_name: 'THYROID PROFILE', param_name: 'T4 (Thyroxine)', unit: 'mcg/dl', ref_range_male: '4.5 - 12.5', ref_range_female: '4.5 - 12.5', sort_order: 2 },
            { group_name: 'THYROID PROFILE', param_name: 'TSH (Thyroid Stimulating Hormone)', unit: 'mIU/L', ref_range_male: '0.3 - 5.0', ref_range_female: '0.3 - 5.0', sort_order: 3 }
          ]
        },
        {
          name: 'Widal Test',
          category_id: catMap['Serology'],
          specimen: 'BLOOD (SERUM)',
          price: 250,
          turnaround: '4-6 hours',
          parameters: [
            { group_name: 'WIDAL TEST', param_name: 'S. Typhi O', unit: '', ref_range_male: '< 1:80', ref_range_female: '< 1:80', sort_order: 1 },
            { group_name: 'WIDAL TEST', param_name: 'S. Typhi H', unit: '', ref_range_male: '< 1:80', ref_range_female: '< 1:80', sort_order: 2 },
            { group_name: 'WIDAL TEST', param_name: 'S. Paratyphi AH', unit: '', ref_range_male: '< 1:80', ref_range_female: '< 1:80', sort_order: 3 },
            { group_name: 'WIDAL TEST', param_name: 'S. Paratyphi BH', unit: '', ref_range_male: '< 1:80', ref_range_female: '< 1:80', sort_order: 4 }
          ]
        },
        {
          name: 'Dengue NS1 Antigen',
          category_id: catMap['Serology'],
          specimen: 'BLOOD (SERUM)',
          price: 800,
          turnaround: '4-6 hours',
          parameters: [
            { group_name: 'DENGUE', param_name: 'NS1 Antigen', unit: '', ref_range_male: 'Negative', ref_range_female: 'Negative', sort_order: 1 },
            { group_name: 'DENGUE', param_name: 'IgM Antibody', unit: '', ref_range_male: 'Negative', ref_range_female: 'Negative', sort_order: 2 },
            { group_name: 'DENGUE', param_name: 'IgG Antibody', unit: '', ref_range_male: 'Negative', ref_range_female: 'Negative', sort_order: 3 }
          ]
        },
        {
          name: 'Urine Routine & Microscopy',
          category_id: catMap['Clinical Pathology'],
          specimen: 'URINE',
          price: 150,
          turnaround: '2-4 hours',
          parameters: [
            { group_name: 'PHYSICAL EXAMINATION', param_name: 'Colour', unit: '', ref_range_male: 'Pale Yellow', ref_range_female: 'Pale Yellow', sort_order: 1 },
            { group_name: 'PHYSICAL EXAMINATION', param_name: 'Appearance', unit: '', ref_range_male: 'Clear', ref_range_female: 'Clear', sort_order: 2 },
            { group_name: 'PHYSICAL EXAMINATION', param_name: 'Specific Gravity', unit: '', ref_range_male: '1.005 - 1.030', ref_range_female: '1.005 - 1.030', sort_order: 3 },
            { group_name: 'PHYSICAL EXAMINATION', param_name: 'pH', unit: '', ref_range_male: '4.5 - 8.0', ref_range_female: '4.5 - 8.0', sort_order: 4 },
            { group_name: 'CHEMICAL EXAMINATION', param_name: 'Protein/Albumin', unit: '', ref_range_male: 'Nil', ref_range_female: 'Nil', sort_order: 5 },
            { group_name: 'CHEMICAL EXAMINATION', param_name: 'Sugar/Glucose', unit: '', ref_range_male: 'Nil', ref_range_female: 'Nil', sort_order: 6 },
            { group_name: 'CHEMICAL EXAMINATION', param_name: 'Ketone Bodies', unit: '', ref_range_male: 'Nil', ref_range_female: 'Nil', sort_order: 7 },
            { group_name: 'CHEMICAL EXAMINATION', param_name: 'Bile Salts', unit: '', ref_range_male: 'Nil', ref_range_female: 'Nil', sort_order: 8 },
            { group_name: 'CHEMICAL EXAMINATION', param_name: 'Bile Pigments', unit: '', ref_range_male: 'Nil', ref_range_female: 'Nil', sort_order: 9 },
            { group_name: 'CHEMICAL EXAMINATION', param_name: 'Blood (Occult)', unit: '', ref_range_male: 'Nil', ref_range_female: 'Nil', sort_order: 10 },
            { group_name: 'MICROSCOPIC EXAMINATION', param_name: 'Pus Cells', unit: '/hpf', ref_range_male: '0 - 5', ref_range_female: '0 - 5', sort_order: 11 },
            { group_name: 'MICROSCOPIC EXAMINATION', param_name: 'RBC', unit: '/hpf', ref_range_male: '0 - 2', ref_range_female: '0 - 2', sort_order: 12 },
            { group_name: 'MICROSCOPIC EXAMINATION', param_name: 'Epithelial Cells', unit: '/hpf', ref_range_male: 'Few', ref_range_female: 'Few', sort_order: 13 },
            { group_name: 'MICROSCOPIC EXAMINATION', param_name: 'Casts', unit: '', ref_range_male: 'Nil', ref_range_female: 'Nil', sort_order: 14 },
            { group_name: 'MICROSCOPIC EXAMINATION', param_name: 'Crystals', unit: '', ref_range_male: 'Nil', ref_range_female: 'Nil', sort_order: 15 },
            { group_name: 'MICROSCOPIC EXAMINATION', param_name: 'Bacteria', unit: '', ref_range_male: 'Nil', ref_range_female: 'Nil', sort_order: 16 }
          ]
        },
        {
          name: 'Serum Calcium',
          category_id: catMap['Biochemistry'],
          specimen: 'BLOOD (SERUM)',
          price: 200,
          turnaround: '4-6 hours',
          parameters: [
            { group_name: 'SERUM CALCIUM', param_name: 'Serum Calcium', unit: 'mg/dl', ref_range_male: '8.5 - 10.5', ref_range_female: '8.5 - 10.5', sort_order: 1 }
          ]
        },
        {
          name: 'Serum Uric Acid',
          category_id: catMap['Biochemistry'],
          specimen: 'BLOOD (SERUM)',
          price: 200,
          turnaround: '4-6 hours',
          parameters: [
            { group_name: 'URIC ACID', param_name: 'Serum Uric Acid', unit: 'mg/dl', ref_range_male: '3.5 - 7.0', ref_range_female: '2.5 - 6.0', sort_order: 1 }
          ]
        },
        {
          name: 'RA Factor (Rheumatoid Factor)',
          category_id: catMap['Serology'],
          specimen: 'BLOOD (SERUM)',
          price: 350,
          turnaround: '4-6 hours',
          parameters: [
            { group_name: 'RA FACTOR', param_name: 'RA Factor', unit: 'IU/ml', ref_range_male: '< 14 (Negative)', ref_range_female: '< 14 (Negative)', sort_order: 1 }
          ]
        },
        {
          name: 'CRP (C-Reactive Protein)',
          category_id: catMap['Serology'],
          specimen: 'BLOOD (SERUM)',
          price: 400,
          turnaround: '4-6 hours',
          parameters: [
            { group_name: 'CRP', param_name: 'C-Reactive Protein', unit: 'mg/L', ref_range_male: '< 6.0 (Negative)', ref_range_female: '< 6.0 (Negative)', sort_order: 1 }
          ]
        },
        {
          name: 'ASO Titre',
          category_id: catMap['Serology'],
          specimen: 'BLOOD (SERUM)',
          price: 350,
          turnaround: '4-6 hours',
          parameters: [
            { group_name: 'ASO TITRE', param_name: 'ASO Titre', unit: 'IU/ml', ref_range_male: '< 200', ref_range_female: '< 200', sort_order: 1 }
          ]
        },
        {
          name: 'HBsAg (Hepatitis B Surface Antigen)',
          category_id: catMap['Serology'],
          specimen: 'BLOOD (SERUM)',
          price: 350,
          turnaround: '4-6 hours',
          parameters: [
            { group_name: 'HBsAg', param_name: 'HBsAg', unit: '', ref_range_male: 'Non-Reactive', ref_range_female: 'Non-Reactive', sort_order: 1 }
          ]
        },
        {
          name: 'HIV I & II',
          category_id: catMap['Serology'],
          specimen: 'BLOOD (SERUM)',
          price: 400,
          turnaround: '4-6 hours',
          parameters: [
            { group_name: 'HIV', param_name: 'HIV I & II Antibody', unit: '', ref_range_male: 'Non-Reactive', ref_range_female: 'Non-Reactive', sort_order: 1 }
          ]
        },
        {
          name: 'Malaria Parasite (MP)',
          category_id: catMap['Hematology'],
          specimen: 'BLOOD (EDTA)',
          price: 150,
          turnaround: '2-4 hours',
          parameters: [
            { group_name: 'MALARIA', param_name: 'Peripheral Smear for MP', unit: '', ref_range_male: 'Not Detected', ref_range_female: 'Not Detected', sort_order: 1 }
          ]
        },
        {
          name: 'Urine Pregnancy Test (UPT)',
          category_id: catMap['Clinical Pathology'],
          specimen: 'URINE',
          price: 200,
          turnaround: '1-2 hours',
          parameters: [
            { group_name: 'PREGNANCY TEST', param_name: 'hCG (Urine)', unit: '', ref_range_male: '-', ref_range_female: 'Negative', sort_order: 1 }
          ]
        }
      ];

      await testsCollection.insertMany(tests);
      console.log('All tests and parameters seeded successfully!');
    }

    console.log('Database initialized successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Database initialization failed:', err);
    process.exit(1);
  }
}

initDatabase();
