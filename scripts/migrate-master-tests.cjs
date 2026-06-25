const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.8.4']);
const sql = require('mssql/msnodesqlv8');
const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://admin:admin8118@pathlabpro.sij25zs.mongodb.net/PathoLabDB?retryWrites=true&w=majority';
const mssqlConfig = { server: 'localhost\\SQLEXPRESS', database: 'PathoLabDB', driver: 'msnodesqlv8', options: { trustedConnection: true, trustServerCertificate: true } };

// Parameter database: test name -> { specimen, parameters: [{param_name, unit, male, female, calc_formula?, calc_decimals?}] }
// Indian NABL reference ranges
const TEST_PARAMS = {
  // ===== BIOCHEMISTRY =====
  'Cholesterol': { s: 'Serum', p: [{ n: 'Total Cholesterol', u: 'mg/dL', m: '< 200', f: '< 200' }] },
  'COPPER-SERUM': { s: 'Serum', p: [{ n: 'Copper', u: 'mcg/dL', m: '70 - 140', f: '80 - 155' }] },
  'CPK MB': { s: 'Serum', p: [{ n: 'CPK-MB', u: 'U/L', m: '< 25', f: '< 25' }] },
  'Creatine Phosphokinase (CPK)': { s: 'Serum', p: [{ n: 'Creatine Phosphokinase (CPK)', u: 'U/L', m: '30 - 200', f: '30 - 150' }] },
  'CREATININE (URINE SPOT TEST)': { s: 'Urine', p: [{ n: 'Urine Creatinine', u: 'mg/dL', m: '20 - 320', f: '20 - 320' }] },
  'CREATININE CLEARANCE TEST - URINE TEST': { s: '24hrs Urine', p: [{ n: 'Urine Creatinine', u: 'mg/dL', m: '-', f: '-' }, { n: 'Serum Creatinine', u: 'mg/dL', m: '0.7 - 1.3', f: '0.6 - 1.1' }, { n: 'Creatinine Clearance', u: 'mL/min', m: '90 - 140', f: '80 - 125' }] },
  'Creatinine, 24hrs Urine': { s: '24hrs Urine', p: [{ n: '24hrs Urine Creatinine', u: 'mg/24hrs', m: '800 - 2000', f: '600 - 1700' }] },
  'ESTIMATED GLOMERULAR FILTRATION RATE(EGFR)': { s: 'Serum', p: [{ n: 'eGFR', u: 'mL/min/1.73m²', m: '> 90', f: '> 90' }] },
  'Fasting Urine Sugar': { s: 'Urine', p: [{ n: 'Fasting Urine Sugar', u: '-', m: 'Nil', f: 'Nil' }] },
  'Folic Acid': { s: 'Serum', p: [{ n: 'Folic Acid', u: 'ng/mL', m: '> 3.0', f: '> 3.0' }] },
  'Gamma Glutamyl Transferase - GGT/GGTP': { s: 'Serum', p: [{ n: 'GGT', u: 'U/L', m: '9 - 48', f: '9 - 48' }] },
  'Globulin': { s: 'Serum', p: [{ n: 'Globulin', u: 'g/dL', m: '2.0 - 3.5', f: '2.0 - 3.5' }] },
  'HbA1c / Glycosylated': { s: 'Whole Blood', p: [{ n: 'HbA1c', u: '%', m: '4.0 - 6.0', f: '4.0 - 6.0' }] },
  'HDL Cholesterol': { s: 'Serum', p: [{ n: 'HDL Cholesterol', u: 'mg/dL', m: '> 40', f: '> 50' }] },
  'High Sensitive CRP (hsCRP)': { s: 'Serum', p: [{ n: 'hsCRP', u: 'mg/L', m: '< 3.0', f: '< 3.0' }] },
  'Ionic Calcium': { s: 'Serum', p: [{ n: 'Ionized Calcium', u: 'mmol/L', m: '1.10 - 1.35', f: '1.10 - 1.35' }] },
  'IRON': { s: 'Serum', p: [{ n: 'Serum Iron', u: 'mcg/dL', m: '65 - 175', f: '50 - 170' }] },
  'Iron Profile Test': { s: 'Serum', p: [{ n: 'Serum Iron', u: 'mcg/dL', m: '65 - 175', f: '50 - 170' }, { n: 'TIBC', u: 'mcg/dL', m: '250 - 370', f: '250 - 370' }, { n: 'Transferrin Saturation', u: '%', m: '20 - 50', f: '20 - 50' }, { n: 'Ferritin', u: 'ng/mL', m: '20 - 250', f: '10 - 120' }] },
  'KIDNEY FUNCTION TEST(KFT)': { s: 'Serum', p: [{ n: 'Blood Urea', u: 'mg/dL', m: '15 - 40', f: '15 - 40' }, { n: 'Creatinine', u: 'mg/dL', m: '0.7 - 1.3', f: '0.6 - 1.1' }, { n: 'Uric Acid', u: 'mg/dL', m: '3.4 - 7.0', f: '2.4 - 6.0' }] },
  'Lactate Dehydrogenase- Serum (LDH)': { s: 'Serum', p: [{ n: 'LDH', u: 'U/L', m: '140 - 280', f: '140 - 280' }] },
  'LDL Cholesterol': { s: 'Serum', p: [{ n: 'LDL Cholesterol', u: 'mg/dL', m: '< 100', f: '< 100' }] },
  'Lipase': { s: 'Serum', p: [{ n: 'Lipase', u: 'U/L', m: '13 - 60', f: '13 - 60' }] },
  'LIPID PROFILE': { s: 'Serum', p: [{ n: 'Total Cholesterol', u: 'mg/dL', m: '< 200', f: '< 200' }, { n: 'Triglycerides', u: 'mg/dL', m: '< 150', f: '< 150' }, { n: 'HDL Cholesterol', u: 'mg/dL', m: '> 40', f: '> 50' }, { n: 'LDL Cholesterol', u: 'mg/dL', m: '< 100', f: '< 100' }, { n: 'VLDL Cholesterol', u: 'mg/dL', m: '5 - 40', f: '5 - 40' }] },
  'LIVER FUNCTION TEST (LFT)': { s: 'Serum', p: [{ n: 'Total Bilirubin', u: 'mg/dL', m: '0.2 - 1.2', f: '0.2 - 1.2' }, { n: 'Direct Bilirubin', u: 'mg/dL', m: '0.0 - 0.3', f: '0.0 - 0.3' }, { n: 'Indirect Bilirubin', u: 'mg/dL', m: '0.1 - 0.9', f: '0.1 - 0.9', cf: 'Total Bilirubin - Direct Bilirubin', cd: 2 }, { n: 'SGOT (AST)', u: 'U/L', m: '10 - 40', f: '10 - 40' }, { n: 'SGPT (ALT)', u: 'U/L', m: '7 - 56', f: '7 - 56' }, { n: 'Alkaline Phosphatase', u: 'U/L', m: '44 - 147', f: '44 - 147' }, { n: 'Total Protein', u: 'g/dL', m: '6.0 - 8.0', f: '6.0 - 8.0' }, { n: 'Albumin', u: 'g/dL', m: '3.5 - 5.5', f: '3.5 - 5.5' }, { n: 'Globulin', u: 'g/dL', m: '2.0 - 3.5', f: '2.0 - 3.5' }, { n: 'A/G Ratio', u: '', m: '1.0 - 2.0', f: '1.0 - 2.0' }] },
  'MICROALBUMINURIA, 24 HR URINE': { s: '24hrs Urine', p: [{ n: '24hrs Urine Microalbumin', u: 'mg/day', m: '< 30', f: '< 30' }] },
  'Oral Glucose Challenge Test': { s: 'Serum', p: [{ n: 'Glucose (0 hr)', u: 'mg/dL', m: '< 140', f: '< 140' }, { n: 'Glucose (1 hr)', u: 'mg/dL', m: '< 180', f: '< 180' }, { n: 'Glucose (2 hr)', u: 'mg/dL', m: '< 140', f: '< 140' }] },
  'ORAL GLUCOSE TOLERANCE TEST (OGTT)': { s: 'Serum', p: [{ n: 'Fasting Glucose', u: 'mg/dL', m: '70 - 100', f: '70 - 100' }, { n: '1 hr Post Glucose', u: 'mg/dL', m: '< 180', f: '< 180' }, { n: '2 hr Post Glucose', u: 'mg/dL', m: '< 140', f: '< 140' }] },
  'OSMOLALITY-URINE': { s: 'Urine', p: [{ n: 'Urine Osmolality', u: 'mOsm/kg', m: '300 - 900', f: '300 - 900' }] },
  'Post Prandial Urine Sugar': { s: 'Urine', p: [{ n: 'Post Prandial Urine Sugar', u: '-', m: 'Nil', f: 'Nil' }] },
  'POTASSIUM (K+)': { s: 'Serum', p: [{ n: 'Potassium', u: 'mEq/L', m: '3.5 - 5.0', f: '3.5 - 5.0' }] },
  'Prostatic Acid Phosphatase': { s: 'Serum', p: [{ n: 'Prostatic Acid Phosphatase', u: 'U/L', m: '0.5 - 2.0', f: '0.5 - 2.0' }] },
  'PROTEIN (URINE SPOT TEST)': { s: 'Urine', p: [{ n: 'Urine Protein', u: 'mg/dL', m: '< 20', f: '< 20' }] },
  'Random Blood Sugar Test': { s: 'Serum', p: [{ n: 'Random Blood Glucose', u: 'mg/dL', m: '< 200', f: '< 200' }] },
  'S. Proteins (Protein Fraction)': { s: 'Serum', p: [{ n: 'Total Protein', u: 'g/dL', m: '6.0 - 8.0', f: '6.0 - 8.0' }, { n: 'Albumin', u: 'g/dL', m: '3.5 - 5.5', f: '3.5 - 5.5' }, { n: 'Alpha 1 Globulin', u: 'g/dL', m: '0.1 - 0.3', f: '0.1 - 0.3' }, { n: 'Alpha 2 Globulin', u: 'g/dL', m: '0.6 - 1.0', f: '0.6 - 1.0' }, { n: 'Beta Globulin', u: 'g/dL', m: '0.7 - 1.2', f: '0.7 - 1.2' }, { n: 'Gamma Globulin', u: 'g/dL', m: '0.7 - 1.5', f: '0.7 - 1.5' }] },
  'SAAG': { s: 'Fluid', p: [{ n: 'Serum Albumin', u: 'g/dL', m: '3.5 - 5.5', f: '3.5 - 5.5' }, { n: 'Ascitic Fluid Albumin', u: 'g/dL', m: '-', f: '-' }, { n: 'SAAG', u: 'g/dL', m: '< 1.1 (Transudate)', f: '< 1.1 (Transudate)' }] },
  'Serum Calcium': { s: 'Serum', p: [{ n: 'Total Calcium', u: 'mg/dL', m: '8.5 - 10.5', f: '8.5 - 10.5' }] },
  'SERUM CREATININE': { s: 'Serum', p: [{ n: 'Creatinine', u: 'mg/dL', m: '0.7 - 1.3', f: '0.6 - 1.1' }] },
  'Serum Magnesium': { s: 'Serum', p: [{ n: 'Magnesium', u: 'mg/dL', m: '1.7 - 2.2', f: '1.7 - 2.2' }] },
  'Serum Transferrin': { s: 'Serum', p: [{ n: 'Transferrin', u: 'mg/dL', m: '200 - 400', f: '200 - 400' }] },
  'SGOT (AST)- SERUM': { s: 'Serum', p: [{ n: 'SGOT (AST)', u: 'U/L', m: '10 - 40', f: '10 - 40' }] },
  'SGPT(ALT) - SERUM': { s: 'Serum', p: [{ n: 'SGPT (ALT)', u: 'U/L', m: '7 - 56', f: '7 - 56' }] },
  'Sodium (Na)': { s: 'Serum', p: [{ n: 'Sodium', u: 'mEq/L', m: '136 - 145', f: '136 - 145' }] },
  'TORCH PROFILE': { s: 'Serum', p: [{ n: 'Toxoplasma IgG', u: 'IU/mL', m: '< 8 (Negative)', f: '< 8 (Negative)' }, { n: 'Toxoplasma IgM', u: 'IU/mL', m: '< 0.8 (Negative)', f: '< 0.8 (Negative)' }, { n: 'Rubella IgG', u: 'IU/mL', m: '< 10 (Negative)', f: '< 10 (Negative)' }, { n: 'Rubella IgM', u: 'IU/mL', m: '< 8 (Negative)', f: '< 8 (Negative)' }, { n: 'CMV IgG', u: 'IU/mL', m: '< 6 (Negative)', f: '< 6 (Negative)' }, { n: 'CMV IgM', u: 'IU/mL', m: '< 0.7 (Negative)', f: '< 0.7 (Negative)' }, { n: 'HSV 1 IgG', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }, { n: 'HSV 2 IgG', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Total Iron Binding Capacity': { s: 'Serum', p: [{ n: 'TIBC', u: 'mcg/dL', m: '250 - 370', f: '250 - 370' }] },
  'Total Protein': { s: 'Serum', p: [{ n: 'Total Protein', u: 'g/dL', m: '6.0 - 8.0', f: '6.0 - 8.0' }] },
  'Transferrin Saturation': { s: 'Serum', p: [{ n: 'Transferrin Saturation', u: '%', m: '20 - 50', f: '20 - 50' }] },
  'Triglycerides': { s: 'Serum', p: [{ n: 'Triglycerides', u: 'mg/dL', m: '< 150', f: '< 150' }] },
  'UREA': { s: 'Serum', p: [{ n: 'Blood Urea', u: 'mg/dL', m: '15 - 40', f: '15 - 40' }] },
  'URIC ACID': { s: 'Serum', p: [{ n: 'Uric Acid', u: 'mg/dL', m: '3.4 - 7.0', f: '2.4 - 6.0' }] },
  'URINE PROTEIN/CREATININE RATIO': { s: 'Urine', p: [{ n: 'Urine Protein', u: 'mg/dL', m: '-', f: '-' }, { n: 'Urine Creatinine', u: 'mg/dL', m: '-', f: '-' }, { n: 'Protein/Creatinine Ratio', u: 'g/g', m: '< 0.2', f: '< 0.2' }] },
  'VLDL Cholesterol': { s: 'Serum', p: [{ n: 'VLDL Cholesterol', u: 'mg/dL', m: '5 - 40', f: '5 - 40' }] },

  // ===== CLINICAL BIOCHEMISTRY =====
  'Drug Screening': { s: 'Urine', p: [{ n: 'Drug Screening Report', u: '-', m: 'Negative', f: 'Negative' }] },
  'Protein Electrophoresis': { s: 'Serum', p: [{ n: 'Total Protein', u: 'g/dL', m: '6.0 - 8.0', f: '6.0 - 8.0' }, { n: 'Albumin', u: '%', m: '55 - 70', f: '55 - 70' }, { n: 'Alpha 1', u: '%', m: '2 - 4', f: '2 - 4' }, { n: 'Alpha 2', u: '%', m: '8 - 13', f: '8 - 13' }, { n: 'Beta', u: '%', m: '9 - 15', f: '9 - 15' }, { n: 'Gamma', u: '%', m: '12 - 20', f: '12 - 20' }] },
  'Rh Factor  (Quantity)': { s: 'Whole Blood', p: [{ n: 'Rh Factor (Quantitative)', u: 'IU/mL', m: '-', f: '-' }] },
  'Rh Factor  (Slide)': { s: 'Whole Blood', p: [{ n: 'Rh Factor (Slide)', u: '-', m: 'Positive / Negative', f: 'Positive / Negative' }] },
  'Serum Zinc': { s: 'Serum', p: [{ n: 'Zinc', u: 'mcg/dL', m: '70 - 120', f: '70 - 120' }] },
  'THYROID ANTIBODIES': { s: 'Serum', p: [{ n: 'Anti-TPO', u: 'IU/mL', m: '0 - 34', f: '0 - 34' }, { n: 'Anti-Thyroglobulin', u: 'IU/mL', m: '0 - 40', f: '0 - 40' }] },

  // ===== CLINICAL PATHOLOGY =====
  'Semen Analysis': { s: 'Semen', p: [{ n: 'Volume', u: 'mL', m: '1.5 - 5.0', f: '-' }, { n: 'Sperm Count', u: 'million/mL', m: '> 15', f: '-' }, { n: 'Motility', u: '%', m: '> 40', f: '-' }, { n: 'Morphology', u: '%', m: '> 4', f: '-' }, { n: 'Liquefaction Time', u: 'minutes', m: '20 - 30', f: '-' }, { n: 'pH', u: '', m: '7.2 - 8.0', f: '-' }] },

  // ===== COAGULATION =====
  'Coagulation Profile': { s: 'Citrate Plasma', p: [{ n: 'PT', u: 'seconds', m: '11 - 14', f: '11 - 14' }, { n: 'INR', u: '', m: '0.8 - 1.2', f: '0.8 - 1.2' }, { n: 'APTT', u: 'seconds', m: '25 - 35', f: '25 - 35' }] },
  'D Dimer': { s: 'Citrate Plasma', p: [{ n: 'D-Dimer', u: 'ng/mL', m: '< 500', f: '< 500' }] },
  'PT INR': { s: 'Citrate Plasma', p: [{ n: 'PT', u: 'seconds', m: '11 - 14', f: '11 - 14' }, { n: 'INR', u: '', m: '0.8 - 1.2', f: '0.8 - 1.2' }, { n: 'PT Control', u: 'seconds', m: '11 - 14', f: '11 - 14' }] },

  // ===== CYTOLOGY =====
  'Cytology': { s: 'Fluid', p: [{ n: 'Cytology Report', u: '-', m: '-', f: '-' }] },
  'FNAC (Fine needle aspiration cytology)': { s: 'FNAC', p: [{ n: 'FNAC Report', u: '-', m: '-', f: '-' }] },
  'PAP SMEAR (GYNEC CYTOLOGY)': { s: 'Cervical Swab', p: [{ n: 'PAP Smear Report', u: '-', m: '-', f: '-' }] },
  'URINE CYTOLOGY': { s: 'Urine', p: [{ n: 'Urine Cytology Report', u: '-', m: '-', f: '-' }] },

  // ===== ELECTROLYTES =====
  'Electrolytes Panel': { s: 'Serum', p: [{ n: 'Sodium', u: 'mEq/L', m: '136 - 145', f: '136 - 145' }, { n: 'Potassium', u: 'mEq/L', m: '3.5 - 5.0', f: '3.5 - 5.0' }, { n: 'Chloride', u: 'mEq/L', m: '98 - 106', f: '98 - 106' }] },
  'PHOSPHROUS (PO4)': { s: 'Serum', p: [{ n: 'Phosphorus', u: 'mg/dL', m: '2.5 - 4.5', f: '2.5 - 4.5' }] },
  'Sodium Potassium (Na,K)': { s: 'Serum', p: [{ n: 'Sodium', u: 'mEq/L', m: '136 - 145', f: '136 - 145' }, { n: 'Potassium', u: 'mEq/L', m: '3.5 - 5.0', f: '3.5 - 5.0' }] },

  // ===== ENDOCRINOLOGY =====
  'Cortisol AM': { s: 'Serum', p: [{ n: 'Cortisol (AM)', u: 'mcg/dL', m: '5 - 25', f: '5 - 25' }] },
  'Cortisol PM': { s: 'Serum', p: [{ n: 'Cortisol (PM)', u: 'mcg/dL', m: '3 - 15', f: '3 - 15' }] },
  'Dehydroepiandrosterone (DHEA)': { s: 'Serum', p: [{ n: 'DHEA', u: 'ng/dL', m: '180 - 1250', f: '130 - 980' }] },
  'Dehydroepiandrosterone Sulphate (DHEAS)': { s: 'Serum', p: [{ n: 'DHEAS', u: 'mcg/dL', m: '80 - 560', f: '35 - 430' }] },
  'Dihydrotestosterone (DHT)': { s: 'Serum', p: [{ n: 'DHT', u: 'pg/mL', m: '30 - 85', f: '5 - 30' }] },
  'Free Thyroid Function Test (FTFT)': { s: 'Serum', p: [{ n: 'TSH', u: 'mIU/L', m: '0.4 - 4.0', f: '0.4 - 4.0' }, { n: 'Free T3', u: 'pg/mL', m: '2.3 - 4.2', f: '2.3 - 4.2' }, { n: 'Free T4', u: 'ng/dL', m: '0.8 - 1.8', f: '0.8 - 1.8' }] },
  'PLGF (Placental Growth Factor)': { s: 'Serum', p: [{ n: 'PLGF', u: 'pg/mL', m: '-', f: '-' }] },
  'Progesterone': { s: 'Serum', p: [{ n: 'Progesterone', u: 'ng/mL', m: '0.2 - 1.4', f: '0.2 - 25 (cycle dependent)' }] },

  // ===== EXAMINATION OF BODY FLUID =====
  'CSF/ Pleural/ Ascitic/ Synovial Fluid': { s: 'Fluid', p: [{ n: 'Physical Examination', u: '-', m: '-', f: '-' }, { n: 'Protein', u: 'mg/dL', m: '15 - 45 (CSF)', f: '15 - 45 (CSF)' }, { n: 'Glucose', u: 'mg/dL', m: '40 - 70 (CSF)', f: '40 - 70 (CSF)' }, { n: 'Cell Count', u: '/cumm', m: '0 - 5 (CSF)', f: '0 - 5 (CSF)' }] },
  'MEDICAL EXAMINATION': { s: 'Various', p: [{ n: 'Medical Examination Report', u: '-', m: '-', f: '-' }] },

  // ===== HAEMATOLOGY =====
  'Complete Blood Count (CBC)': { s: 'EDTA Blood', p: [{ n: 'Haemoglobin', u: 'g/dL', m: '13.0 - 17.0', f: '12.0 - 15.5' }, { n: 'Total WBC Count', u: '/cumm', m: '4000 - 11000', f: '4000 - 11000' }, { n: 'RBC Count', u: 'million/cumm', m: '4.5 - 5.5', f: '4.0 - 5.0' }, { n: 'Platelet Count', u: 'lakhs/cumm', m: '1.5 - 4.5', f: '1.5 - 4.5' }, { n: 'PCV (HCT)', u: '%', m: '38 - 50', f: '36 - 46' }, { n: 'MCV', u: 'fL', m: '80 - 100', f: '80 - 100' }, { n: 'MCH', u: 'pg', m: '27 - 33', f: '27 - 33' }, { n: 'MCHC', u: 'g/dL', m: '32 - 36', f: '32 - 36' }, { n: 'RDW', u: '%', m: '11.6 - 16.0', f: '11.6 - 16.0' }, { n: 'Neutrophils', u: '%', m: '40 - 70', f: '40 - 70' }, { n: 'Lymphocytes', u: '%', m: '20 - 40', f: '20 - 40' }, { n: 'Monocytes', u: '%', m: '2 - 8', f: '2 - 8' }, { n: 'Eosinophils', u: '%', m: '1 - 6', f: '1 - 6' }, { n: 'Basophils', u: '%', m: '0 - 1', f: '0 - 1' }] },
  'DLC- Differential Leucocytes Count': { s: 'EDTA Blood', p: [{ n: 'Neutrophils', u: '%', m: '40 - 70', f: '40 - 70' }, { n: 'Lymphocytes', u: '%', m: '20 - 40', f: '20 - 40' }, { n: 'Monocytes', u: '%', m: '2 - 8', f: '2 - 8' }, { n: 'Eosinophils', u: '%', m: '1 - 6', f: '1 - 6' }, { n: 'Basophils', u: '%', m: '0 - 1', f: '0 - 1' }] },
  'Erythrocyte Sedimentation Rate (Westergren)': { s: 'EDTA Blood', p: [{ n: 'ESR', u: 'mm/hr', m: '0 - 15', f: '0 - 20' }] },
  'Fibrinogen': { s: 'Citrate Plasma', p: [{ n: 'Fibrinogen', u: 'mg/dL', m: '200 - 400', f: '200 - 400' }] },
  'Glucose-6-Phosphate Dehydrogenase': { s: 'Whole Blood', p: [{ n: 'G6PD', u: 'U/g Hb', m: '6.8 - 11.6', f: '6.8 - 11.6' }] },
  'Haemoglobin (Hb)': { s: 'EDTA Blood', p: [{ n: 'Haemoglobin', u: 'g/dL', m: '13.0 - 17.0', f: '12.0 - 15.5' }] },
  'HAEMOGLOBIN ELECTROPHORESIS (HPLC)': { s: 'Whole Blood', p: [{ n: 'HbA', u: '%', m: '95 - 98', f: '95 - 98' }, { n: 'HbA2', u: '%', m: '1.5 - 3.5', f: '1.5 - 3.5' }, { n: 'HbF', u: '%', m: '< 1.0', f: '< 1.0' }] },
  'Hb TLC DLC': { s: 'EDTA Blood', p: [{ n: 'Haemoglobin', u: 'g/dL', m: '13.0 - 17.0', f: '12.0 - 15.5' }, { n: 'Total WBC Count', u: '/cumm', m: '4000 - 11000', f: '4000 - 11000' }, { n: 'Neutrophils', u: '%', m: '40 - 70', f: '40 - 70' }, { n: 'Lymphocytes', u: '%', m: '20 - 40', f: '20 - 40' }, { n: 'Monocytes', u: '%', m: '2 - 8', f: '2 - 8' }, { n: 'Eosinophils', u: '%', m: '1 - 6', f: '1 - 6' }, { n: 'Basophils', u: '%', m: '0 - 1', f: '0 - 1' }] },
  'Hb TLC DLC & ESR': { s: 'EDTA Blood', p: [{ n: 'Haemoglobin', u: 'g/dL', m: '13.0 - 17.0', f: '12.0 - 15.5' }, { n: 'Total WBC Count', u: '/cumm', m: '4000 - 11000', f: '4000 - 11000' }, { n: 'Neutrophils', u: '%', m: '40 - 70', f: '40 - 70' }, { n: 'Lymphocytes', u: '%', m: '20 - 40', f: '20 - 40' }, { n: 'Monocytes', u: '%', m: '2 - 8', f: '2 - 8' }, { n: 'Eosinophils', u: '%', m: '1 - 6', f: '1 - 6' }, { n: 'Basophils', u: '%', m: '0 - 1', f: '0 - 1' }, { n: 'ESR', u: 'mm/hr', m: '0 - 15', f: '0 - 20' }] },
  'HLA B27': { s: 'EDTA Blood', p: [{ n: 'HLA B27', u: '-', m: 'Negative', f: 'Negative' }] },
  'Immature Platelet Fraction (IPF)': { s: 'EDTA Blood', p: [{ n: 'IPF', u: '%', m: '1.0 - 6.0', f: '1.0 - 6.0' }] },
  "Indirect Coomb's Test (ICT)": { s: 'Serum', p: [{ n: 'Indirect Coombs Test', u: '-', m: 'Negative', f: 'Negative' }] },
  'LE Cells': { s: 'EDTA Blood', p: [{ n: 'LE Cells', u: '-', m: 'Not Seen', f: 'Not Seen' }] },
  'LUPUS ANTICOAGULANT': { s: 'Citrate Plasma', p: [{ n: 'Lupus Anticoagulant', u: '-', m: 'Negative', f: 'Negative' }] },
  'Malaria Parasite': { s: 'EDTA Blood', p: [{ n: 'Malaria Parasite', u: '-', m: 'Not Seen', f: 'Not Seen' }] },
  'Microfilaria Test QBC': { s: 'EDTA Blood', p: [{ n: 'Microfilaria', u: '-', m: 'Not Seen', f: 'Not Seen' }] },
  'PCV (Haematocrit)': { s: 'EDTA Blood', p: [{ n: 'PCV (HCT)', u: '%', m: '38 - 50', f: '36 - 46' }] },
  'Peripheral Blood Smear/ GBP': { s: 'EDTA Blood', p: [{ n: 'Peripheral Blood Smear', u: '-', m: '-', f: '-' }] },
  'Platelet Count': { s: 'EDTA Blood', p: [{ n: 'Platelet Count', u: 'lakhs/cumm', m: '1.5 - 4.5', f: '1.5 - 4.5' }] },
  'RBC Count': { s: 'EDTA Blood', p: [{ n: 'RBC Count', u: 'million/cumm', m: '4.5 - 5.5', f: '4.0 - 5.0' }] },
  'Reticulocyte Count': { s: 'EDTA Blood', p: [{ n: 'Reticulocyte Count', u: '%', m: '0.5 - 2.0', f: '0.5 - 2.0' }] },
  'Sickling Test': { s: 'EDTA Blood', p: [{ n: 'Sickling Test', u: '-', m: 'Negative', f: 'Negative' }] },
  'TLC DLC': { s: 'EDTA Blood', p: [{ n: 'Total WBC Count', u: '/cumm', m: '4000 - 11000', f: '4000 - 11000' }, { n: 'Neutrophils', u: '%', m: '40 - 70', f: '40 - 70' }, { n: 'Lymphocytes', u: '%', m: '20 - 40', f: '20 - 40' }, { n: 'Monocytes', u: '%', m: '2 - 8', f: '2 - 8' }, { n: 'Eosinophils', u: '%', m: '1 - 6', f: '1 - 6' }, { n: 'Basophils', u: '%', m: '0 - 1', f: '0 - 1' }] },
  'TLC- Total Leucocytes Count': { s: 'EDTA Blood', p: [{ n: 'Total WBC Count', u: '/cumm', m: '4000 - 11000', f: '4000 - 11000' }] },
  "Direct Coomb's Test (DCT)": { s: 'EDTA Blood', p: [{ n: 'Direct Coombs Test', u: '-', m: 'Negative', f: 'Negative' }] },
  'Weilfilix Test': { s: 'Serum', p: [{ n: 'OX-2', u: '-', m: '< 1:80', f: '< 1:80' }, { n: 'OX-19', u: '-', m: '< 1:80', f: '< 1:80' }, { n: 'OX-K', u: '-', m: '< 1:80', f: '< 1:80' }] },

  // ===== HISTOPATHOLOGY =====
  'Histopathology Small': { s: 'Tissue', p: [{ n: 'Histopathology Report', u: '-', m: '-', f: '-' }] },

  // ===== HORMONAL ASSAY =====
  'Growth Hormone': { s: 'Serum', p: [{ n: 'Growth Hormone', u: 'ng/mL', m: '< 8', f: '< 8' }] },
  'PARATHYROID HORMONE (PTH)': { s: 'Serum', p: [{ n: 'PTH', u: 'pg/mL', m: '15 - 65', f: '15 - 65' }] },
  'Total Testosterone': { s: 'Serum', p: [{ n: 'Total Testosterone', u: 'ng/dL', m: '300 - 1000', f: '15 - 70' }] },

  // ===== IMMUNOASSAY =====
  'Vitamin D3': { s: 'Serum', p: [{ n: 'Vitamin D3', u: 'ng/mL', m: '30 - 100', f: '30 - 100' }] },
  'Dual Marker Test': { s: 'Serum', p: [{ n: 'PAPP-A', u: 'mIU/mL', m: '-', f: '-' }, { n: 'Free Beta hCG', u: 'ng/mL', m: '-', f: '-' }] },
  'Estradiol E2': { s: 'Serum', p: [{ n: 'Estradiol (E2)', u: 'pg/mL', m: '10 - 40', f: '20 - 400 (cycle dependent)' }] },
  'Ferritin': { s: 'Serum', p: [{ n: 'Ferritin', u: 'ng/mL', m: '20 - 250', f: '10 - 120' }] },
  'FREE PSA:TOTAL PSA RATIO': { s: 'Serum', p: [{ n: 'Free PSA', u: 'ng/mL', m: '< 1.0', f: '< 1.0' }, { n: 'Total PSA', u: 'ng/mL', m: '< 4.0', f: '< 4.0' }, { n: 'Free:Total PSA Ratio', u: '%', m: '> 25', f: '> 25' }] },
  'Free Testosterone': { s: 'Serum', p: [{ n: 'Free Testosterone', u: 'pg/mL', m: '50 - 210', f: '1 - 8.5' }] },
  'FT3-TRIIODOTHYRONINE FREE': { s: 'Serum', p: [{ n: 'Free T3', u: 'pg/mL', m: '2.3 - 4.2', f: '2.3 - 4.2' }] },
  'FT4 (THYROXINE)-SERUM': { s: 'Serum', p: [{ n: 'Free T4', u: 'ng/dL', m: '0.8 - 1.8', f: '0.8 - 1.8' }] },
  'Insulin': { s: 'Serum', p: [{ n: 'Insulin (Fasting)', u: 'uIU/mL', m: '2.6 - 24.9', f: '2.6 - 24.9' }] },
  'Interferon Gamma Release Assay - TB Gold QuantiFERON': { s: 'Whole Blood', p: [{ n: 'QuantiFERON TB Gold', u: '-', m: 'Negative', f: 'Negative' }] },
  'Interleukin- 6 (IL - 6)': { s: 'Serum', p: [{ n: 'IL-6', u: 'pg/mL', m: '< 7.0', f: '< 7.0' }] },
  'LH FSH Prolactin': { s: 'Serum', p: [{ n: 'LH', u: 'mIU/mL', m: '1.5 - 9.3', f: '1.9 - 12.5' }, { n: 'FSH', u: 'mIU/mL', m: '1.4 - 15.4', f: '4.0 - 13.8' }, { n: 'Prolactin', u: 'ng/mL', m: '4.0 - 15.2', f: '4.8 - 23.3' }] },
  'Procalcitonin': { s: 'Serum', p: [{ n: 'Procalcitonin', u: 'ng/mL', m: '< 0.5', f: '< 0.5' }] },
  'PSA (PROSTATE SPECIFIC ANTIGEN)-Serum': { s: 'Serum', p: [{ n: 'PSA', u: 'ng/mL', m: '< 4.0', f: '< 4.0' }] },
  'Quadruple Marker Test': { s: 'Serum', p: [{ n: 'AFP', u: 'ng/mL', m: '-', f: '-' }, { n: 'hCG', u: 'mIU/mL', m: '-', f: '-' }, { n: 'Estriol', u: 'ng/mL', m: '-', f: '-' }, { n: 'Inhibin-A', u: 'pg/mL', m: '-', f: '-' }] },
  'T3': { s: 'Serum', p: [{ n: 'Total T3', u: 'ng/dL', m: '0.8 - 2.0', f: '0.8 - 2.0' }] },
  'T4': { s: 'Serum', p: [{ n: 'Total T4', u: 'mcg/dL', m: '4.5 - 12.5', f: '4.5 - 12.5' }] },
  'TB GOLD': { s: 'Whole Blood', p: [{ n: 'TB Gold', u: '-', m: 'Negative', f: 'Negative' }] },
  'Thyroid Function Test (TFT)': { s: 'Serum', p: [{ n: 'TSH', u: 'mIU/L', m: '0.4 - 4.0', f: '0.4 - 4.0' }, { n: 'Total T3', u: 'ng/dL', m: '0.8 - 2.0', f: '0.8 - 2.0' }, { n: 'Total T4', u: 'mcg/dL', m: '4.5 - 12.5', f: '4.5 - 12.5' }] },
  'THYROID STIMULATING HORMONE(TSH)-SERUM': { s: 'Serum', p: [{ n: 'TSH', u: 'mIU/L', m: '0.4 - 4.0', f: '0.4 - 4.0' }] },
  'TOTAL IGE': { s: 'Serum', p: [{ n: 'Total IgE', u: 'IU/mL', m: '< 100', f: '< 100' }] },
  'TOTAL PSA': { s: 'Serum', p: [{ n: 'Total PSA', u: 'ng/mL', m: '< 4.0', f: '< 4.0' }] },
  'Triple Marker Test': { s: 'Serum', p: [{ n: 'AFP', u: 'ng/mL', m: '-', f: '-' }, { n: 'hCG', u: 'mIU/mL', m: '-', f: '-' }, { n: 'Estriol', u: 'ng/mL', m: '-', f: '-' }] },
  'TROPONIN - I (Card)': { s: 'Serum', p: [{ n: 'Troponin I', u: 'ng/mL', m: '< 0.04', f: '< 0.04' }] },
  'TROPONIN - I (Quantity)': { s: 'Serum', p: [{ n: 'Troponin I (Quantitative)', u: 'ng/mL', m: '< 0.04', f: '< 0.04' }] },
  'Troponin T (Card)': { s: 'Serum', p: [{ n: 'Troponin T', u: 'ng/mL', m: '< 0.1', f: '< 0.1' }] },
  'Troponin T (Quantity)': { s: 'Serum', p: [{ n: 'Troponin T (Quantitative)', u: 'ng/mL', m: '< 0.1', f: '< 0.1' }] },
  'VITAMIN B12': { s: 'Serum', p: [{ n: 'Vitamin B12', u: 'pg/mL', m: '200 - 900', f: '200 - 900' }] },
  'VITAMIN D - TOTAL (25-OH-VIT D)- SERUM': { s: 'Serum', p: [{ n: '25-OH Vitamin D', u: 'ng/mL', m: '30 - 100', f: '30 - 100' }] },

  // ===== MICROBIOLOGY =====
  'ET for Culture & Sensitivity': { s: 'Swab', p: [{ n: 'Report Status', u: '-', m: 'Preliminary / Final', f: 'Preliminary / Final' }, { n: 'Culture Report', u: '-', m: 'No Growth / Growth', f: 'No Growth / Growth' }, { n: 'Antibiotic Sensitivity', u: '-', m: '-', f: '-' }] },
  'FLUID FOR CULTURE & SENSTIVITY': { s: 'Fluid', p: [{ n: 'Report Status', u: '-', m: 'Preliminary / Final', f: 'Preliminary / Final' }, { n: 'Culture Report', u: '-', m: 'No Growth / Growth', f: 'No Growth / Growth' }, { n: 'Antibiotic Sensitivity', u: '-', m: '-', f: '-' }] },
  'Fungal for culture & Sensitivity': { s: 'Sample', p: [{ n: 'Report Status', u: '-', m: 'Preliminary / Final', f: 'Preliminary / Final' }, { n: 'Fungal Culture', u: '-', m: 'No Growth / Growth', f: 'No Growth / Growth' }, { n: 'Antibiotic Sensitivity', u: '-', m: '-', f: '-' }] },
  'Gene Expert': { s: 'Sample', p: [{ n: 'GeneXpert Report', u: '-', m: 'Not Detected', f: 'Not Detected' }] },
  'PUS FOR  CULTURE & SENSTIVITY': { s: 'Pus', p: [{ n: 'Report Status', u: '-', m: 'Preliminary / Final', f: 'Preliminary / Final' }, { n: 'Culture Report', u: '-', m: 'No Growth / Growth', f: 'No Growth / Growth' }, { n: 'Antibiotic Sensitivity', u: '-', m: '-', f: '-' }] },
  'SEMEN FOR CULTURE & SENSTIVITY': { s: 'Semen', p: [{ n: 'Report Status', u: '-', m: 'Preliminary / Final', f: 'Preliminary / Final' }, { n: 'Culture Report', u: '-', m: 'No Growth / Growth', f: 'No Growth / Growth' }, { n: 'Antibiotic Sensitivity', u: '-', m: '-', f: '-' }] },
  'STOOL FOR CULTURE & SENSTIVITY': { s: 'Stool', p: [{ n: 'Report Status', u: '-', m: 'Preliminary / Final', f: 'Preliminary / Final' }, { n: 'Culture Report', u: '-', m: 'No Growth / Growth', f: 'No Growth / Growth' }, { n: 'Antibiotic Sensitivity', u: '-', m: '-', f: '-' }] },
  'SWAB FOR CULTURE & SENSITIVITY': { s: 'Swab', p: [{ n: 'Report Status', u: '-', m: 'Preliminary / Final', f: 'Preliminary / Final' }, { n: 'Culture Report', u: '-', m: 'No Growth / Growth', f: 'No Growth / Growth' }, { n: 'Antibiotic Sensitivity', u: '-', m: '-', f: '-' }] },
  'T T FOR  CULTURE & SENSTIVITY': { s: 'Sample', p: [{ n: 'Report Status', u: '-', m: 'Preliminary / Final', f: 'Preliminary / Final' }, { n: 'Culture Report', u: '-', m: 'No Growth / Growth', f: 'No Growth / Growth' }, { n: 'Antibiotic Sensitivity', u: '-', m: '-', f: '-' }] },
  'THROAT SWAB FOR CULTURE & SENSTIVITY': { s: 'Throat Swab', p: [{ n: 'Report Status', u: '-', m: 'Preliminary / Final', f: 'Preliminary / Final' }, { n: 'Culture Report', u: '-', m: 'No Growth / Growth', f: 'No Growth / Growth' }, { n: 'Antibiotic Sensitivity', u: '-', m: '-', f: '-' }] },
  'TISSUE FOR CULTURE & SENSTIVITY': { s: 'Tissue', p: [{ n: 'Report Status', u: '-', m: 'Preliminary / Final', f: 'Preliminary / Final' }, { n: 'Culture Report', u: '-', m: 'No Growth / Growth', f: 'No Growth / Growth' }, { n: 'Antibiotic Sensitivity', u: '-', m: '-', f: '-' }] },
  'Urine Alubmin & Creatnine Ratio (ACR)': { s: 'Urine', p: [{ n: 'Urine Albumin', u: 'mg/dL', m: '-', f: '-' }, { n: 'Urine Creatinine', u: 'mg/dL', m: '-', f: '-' }, { n: 'Albumin/Creatinine Ratio', u: 'mg/g', m: '< 30', f: '< 30' }] },
  'URINE FOR CULTURE & SENSTIVITY': { s: 'Urine', p: [{ n: 'Report Status', u: '-', m: 'Preliminary / Final', f: 'Preliminary / Final' }, { n: 'Culture Report', u: '-', m: 'No Growth / Growth', f: 'No Growth / Growth' }, { n: 'Colony Count', u: 'CFU/mL', m: '< 100,000', f: '< 100,000' }, { n: 'Antibiotic Sensitivity', u: '-', m: '-', f: '-' }] },
  'VAGINAL SWAB FOR CULTURE & SENSTIVITY': { s: 'Vaginal Swab', p: [{ n: 'Report Status', u: '-', m: 'Preliminary / Final', f: 'Preliminary / Final' }, { n: 'Culture Report', u: '-', m: 'No Growth / Growth', f: 'No Growth / Growth' }, { n: 'Antibiotic Sensitivity', u: '-', m: '-', f: '-' }] },
  'WATER FOR CULTURE AND SENSTIVITY': { s: 'Water', p: [{ n: 'Report Status', u: '-', m: 'Preliminary / Final', f: 'Preliminary / Final' }, { n: 'Culture Report', u: '-', m: 'No Growth / Growth', f: 'No Growth / Growth' }, { n: 'Antibiotic Sensitivity', u: '-', m: '-', f: '-' }] },
  'Wound Swab': { s: 'Wound Swab', p: [{ n: 'Report Status', u: '-', m: 'Preliminary / Final', f: 'Preliminary / Final' }, { n: 'Culture Report', u: '-', m: 'No Growth / Growth', f: 'No Growth / Growth' }, { n: 'Antibiotic Sensitivity', u: '-', m: '-', f: '-' }] },

  // ===== MISCELLANEOUS =====
  'Nt- ProBNP (N-Terminal Pro B Type Natriuretic Peptide)': { s: 'Serum', p: [{ n: 'NT-proBNP', u: 'pg/mL', m: '< 125', f: '< 125' }] },

  // ===== MOLECULAR BIOLOGY =====
  'HIV VIRAL LOAD': { s: 'Plasma', p: [{ n: 'HIV-1 RNA', u: 'copies/mL', m: 'Not Detected (< 20)', f: 'Not Detected (< 20)' }] },
  'HCV Viral Load': { s: 'Plasma', p: [{ n: 'HCV RNA', u: 'IU/mL', m: 'Not Detected (< 15)', f: 'Not Detected (< 15)' }] },
  'SARS-CoV-2 (Covid-19) RT-PCR': { s: 'Swab', p: [{ n: 'SARS-CoV-2 RNA', u: '-', m: 'Not Detected', f: 'Not Detected' }] },

  // ===== PROFILE TEST =====
  'FSH (FOLLICLE STIMULATING HORMONE)- SERUM': { s: 'Serum', p: [{ n: 'FSH', u: 'mIU/mL', m: '1.4 - 15.4', f: '4.0 - 13.8' }] },
  'LH (LEUTINISING HORMONE)-SERUM': { s: 'Serum', p: [{ n: 'LH', u: 'mIU/mL', m: '1.5 - 9.3', f: '1.9 - 12.5' }] },
  'PROLACTIN-SERUM': { s: 'Serum', p: [{ n: 'Prolactin', u: 'ng/mL', m: '4.0 - 15.2', f: '4.8 - 23.3' }] },

  // ===== SEROLOGY & IMMUNOLOGY =====
  'Cysticercosis IgG': { s: 'Serum', p: [{ n: 'Cysticercosis IgG', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Cysticercosis IgM': { s: 'Serum', p: [{ n: 'Cysticercosis IgM', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Cytomegalovirus (CMV) Antibody-IgG': { s: 'Serum', p: [{ n: 'CMV IgG', u: 'IU/mL', m: '< 6 (Negative)', f: '< 6 (Negative)' }] },
  'Cytomegalovirus (CMV) Antibody-IgM': { s: 'Serum', p: [{ n: 'CMV IgM', u: 'Index', m: '< 0.7 (Negative)', f: '< 0.7 (Negative)' }] },
  'DENGUE IgG': { s: 'Serum', p: [{ n: 'Dengue IgG', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Dengue IgG/IgM': { s: 'Serum', p: [{ n: 'Dengue IgG', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }, { n: 'Dengue IgM', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'DENGUE IGM': { s: 'Serum', p: [{ n: 'Dengue IgM', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Dengue NS1': { s: 'Serum', p: [{ n: 'Dengue NS1 Antigen', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'DENGUE PROFILE - CARD TEST': { s: 'Serum', p: [{ n: 'Dengue NS1', u: '-', m: 'Negative', f: 'Negative' }, { n: 'Dengue IgG', u: '-', m: 'Negative', f: 'Negative' }, { n: 'Dengue IgM', u: '-', m: 'Negative', f: 'Negative' }] },
  'EBV (VCA) - IgM Serum': { s: 'Serum', p: [{ n: 'EBV VCA IgM', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'HCV -HEPATITIS C VIRUS ANTIBODIES': { s: 'Serum', p: [{ n: 'HCV Antibodies', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'HCV Rapid': { s: 'Serum', p: [{ n: 'HCV Rapid Test', u: '-', m: 'Negative', f: 'Negative' }] },
  'Helicobacter Pylorii IgM': { s: 'Serum', p: [{ n: 'H. pylori IgM', u: 'U/mL', m: '< 20 (Negative)', f: '< 20 (Negative)' }] },
  'Hepatitis A virus - IgG': { s: 'Serum', p: [{ n: 'HAV IgG', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Hepatitis A virus - IgM': { s: 'Serum', p: [{ n: 'HAV IgM', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Hepatitis A virus - Total (HAV Total)': { s: 'Serum', p: [{ n: 'HAV Total', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Hepatitis B Surface Antibodies': { s: 'Serum', p: [{ n: 'Anti-HBs', u: 'mIU/mL', m: '< 10 (Negative)', f: '< 10 (Negative)' }] },
  'Hepatitis B surface antigen': { s: 'Serum', p: [{ n: 'HBsAg', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Hepatitis B surface antigen- Quantitative (Anti Hbs)': { s: 'Serum', p: [{ n: 'HBsAg Quantitative', u: 'IU/mL', m: '< 0.05 (Negative)', f: '< 0.05 (Negative)' }] },
  'Hepatitis Core Antibody - Hbc Total': { s: 'Serum', p: [{ n: 'Anti-HBc Total', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Hepatitis Core Antibody IgM (Anti HBc - IgM)': { s: 'Serum', p: [{ n: 'Anti-HBc IgM', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Hepatitis D Virus - HDV IgG': { s: 'Serum', p: [{ n: 'HDV IgG', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Hepatitis D Virus - HDV IgM': { s: 'Serum', p: [{ n: 'HDV IgM', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Herpes Simplex Virus (HSV) 1-IgG': { s: 'Serum', p: [{ n: 'HSV 1 IgG', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Herpes Simplex Virus (HSV) 1-IgM': { s: 'Serum', p: [{ n: 'HSV 1 IgM', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Herpes Simplex Virus (HSV) 2-IgG': { s: 'Serum', p: [{ n: 'HSV 2 IgG', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Herpes Simplex Virus (HSV) 2-IgM': { s: 'Serum', p: [{ n: 'HSV 2 IgM', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'HIV BY CHEMILUMINESCENCE': { s: 'Serum', p: [{ n: 'HIV (CLIA)', u: 'Index', m: '< 1.0 (Negative)', f: '< 1.0 (Negative)' }] },
  'HIV ELISA': { s: 'Serum', p: [{ n: 'HIV ELISA', u: '-', m: 'Negative', f: 'Negative' }] },
  'HIV I & II': { s: 'Serum', p: [{ n: 'HIV I & II', u: '-', m: 'Negative', f: 'Negative' }] },
  'HIV Proviral DNA': { s: 'Whole Blood', p: [{ n: 'HIV Proviral DNA', u: '-', m: 'Not Detected', f: 'Not Detected' }] },
  'Immunoglobulin A (IgA)': { s: 'Serum', p: [{ n: 'IgA', u: 'mg/dL', m: '70 - 400', f: '70 - 400' }] },
  'Immunoglobulin G (IgG)': { s: 'Serum', p: [{ n: 'IgG', u: 'mg/dL', m: '700 - 1600', f: '700 - 1600' }] },
  'Immunoglobulin M (IgM)': { s: 'Serum', p: [{ n: 'IgM', u: 'mg/dL', m: '40 - 230', f: '40 - 230' }] },
  'Leptospira antibodies': { s: 'Serum', p: [{ n: 'Leptospira IgM', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Measles (Rubeola) Antibody IgG': { s: 'Serum', p: [{ n: 'Measles IgG', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Measles (Rubeola) Antibody IgM': { s: 'Serum', p: [{ n: 'Measles IgM', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'MT MANTOUX': { s: 'Skin', p: [{ n: 'Mantoux Reading', u: 'mm', m: '< 10 (Negative)', f: '< 10 (Negative)' }] },
  'Mumps Virus Antibody IgG': { s: 'Serum', p: [{ n: 'Mumps IgG', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Mumps Virus Antibody IgM': { s: 'Serum', p: [{ n: 'Mumps IgM', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'RH Antibody Titre': { s: 'Serum', p: [{ n: 'Rh Antibody Titre', u: 'Dilution', m: '< 1:4', f: '< 1:4' }] },
  'Rheumatoid Factor (RA Qualitative)': { s: 'Serum', p: [{ n: 'RA Factor (Qualitative)', u: '-', m: 'Negative', f: 'Negative' }] },
  'Rheumatoid Factor (RA Quantitative)': { s: 'Serum', p: [{ n: 'RA Factor', u: 'IU/mL', m: '< 20', f: '< 20' }] },
  'RK39': { s: 'Serum', p: [{ n: 'RK39', u: '-', m: 'Negative', f: 'Negative' }] },
  'Rubella -IgG': { s: 'Serum', p: [{ n: 'Rubella IgG', u: 'IU/mL', m: '< 10 (Negative)', f: '< 10 (Negative)' }] },
  'Rubella -IgM': { s: 'Serum', p: [{ n: 'Rubella IgM', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Scrub Typhus': { s: 'Serum', p: [{ n: 'Scrub Typhus', u: '-', m: 'Negative', f: 'Negative' }] },
  'Scrub Typhus IgG and IgM': { s: 'Serum', p: [{ n: 'Scrub Typhus IgG', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }, { n: 'Scrub Typhus IgM', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Torch IgG': { s: 'Serum', p: [{ n: 'Toxoplasma IgG', u: 'IU/mL', m: '< 8 (Negative)', f: '< 8 (Negative)' }, { n: 'Rubella IgG', u: 'IU/mL', m: '< 10 (Negative)', f: '< 10 (Negative)' }, { n: 'CMV IgG', u: 'IU/mL', m: '< 6 (Negative)', f: '< 6 (Negative)' }, { n: 'HSV 1 IgG', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }, { n: 'HSV 2 IgG', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Torch IgM': { s: 'Serum', p: [{ n: 'Toxoplasma IgM', u: 'IU/mL', m: '< 0.8 (Negative)', f: '< 0.8 (Negative)' }, { n: 'Rubella IgM', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }, { n: 'CMV IgM', u: 'Index', m: '< 0.7 (Negative)', f: '< 0.7 (Negative)' }, { n: 'HSV 1 IgM', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }, { n: 'HSV 2 IgM', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Toxoplasma-IgG': { s: 'Serum', p: [{ n: 'Toxoplasma IgG', u: 'IU/mL', m: '< 8 (Negative)', f: '< 8 (Negative)' }] },
  'Toxoplasma-IgM': { s: 'Serum', p: [{ n: 'Toxoplasma IgM', u: 'IU/mL', m: '< 0.8 (Negative)', f: '< 0.8 (Negative)' }] },
  'TPHA (Treponema Pallidum Hemagglutination Assay)': { s: 'Serum', p: [{ n: 'TPHA', u: 'Dilution', m: '< 1:80 (Negative)', f: '< 1:80 (Negative)' }] },
  'Typhi dot IgG/IgM': { s: 'Serum', p: [{ n: 'Typhi Dot IgG', u: '-', m: 'Negative', f: 'Negative' }, { n: 'Typhi Dot IgM', u: '-', m: 'Negative', f: 'Negative' }] },
  'URINE COTININE': { s: 'Urine', p: [{ n: 'Cotinine', u: 'ng/mL', m: '< 10 (Non-smoker)', f: '< 10 (Non-smoker)' }] },
  'Urine Pregnancy Test': { s: 'Urine', p: [{ n: 'Urine Pregnancy Test (UPT)', u: '-', m: 'Negative', f: 'Negative' }] },
  'Varicella Zoster IgG': { s: 'Serum', p: [{ n: 'Varicella Zoster IgG', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'Varicella Zoster IgM': { s: 'Serum', p: [{ n: 'Varicella Zoster IgM', u: 'Index', m: '< 0.9 (Negative)', f: '< 0.9 (Negative)' }] },
  'VDRL': { s: 'Serum', p: [{ n: 'VDRL', u: 'Dilution', m: '< 1:8 (Negative)', f: '< 1:8 (Negative)' }] },
  'WIDAL BY SLIDE AGGLUTINATION': { s: 'Serum', p: [{ n: 'S. Typhi O', u: 'Dilution', m: '< 1:80', f: '< 1:80' }, { n: 'S. Typhi H', u: 'Dilution', m: '< 1:160', f: '< 1:160' }, { n: 'S. Paratyphi A H', u: 'Dilution', m: '< 1:80', f: '< 1:80' }, { n: 'S. Paratyphi B H', u: 'Dilution', m: '< 1:80', f: '< 1:80' }] },
  'WIDAL Test': { s: 'Serum', p: [{ n: 'S. Typhi O', u: 'Dilution', m: '< 1:80', f: '< 1:80' }, { n: 'S. Typhi H', u: 'Dilution', m: '< 1:160', f: '< 1:160' }, { n: 'S. Paratyphi A H', u: 'Dilution', m: '< 1:80', f: '< 1:80' }, { n: 'S. Paratyphi B H', u: 'Dilution', m: '< 1:80', f: '< 1:80' }] },

  // ===== SPUTUM EXAMINATION =====
  'Gram Stain': { s: 'Sputum', p: [{ n: 'Gram Stain', u: '-', m: '-', f: '-' }] },
  'SPUTUM FOR ACID FAST BACILLI ( AFB )': { s: 'Sputum', p: [{ n: 'AFB', u: '-', m: 'Not Seen', f: 'Not Seen' }] },

  // ===== STOOL EXAMINATION =====
  'Stool for Hanging Drop': { s: 'Stool', p: [{ n: 'Hanging Drop', u: '-', m: 'Not Seen', f: 'Not Seen' }] },
  'Stool for Occult Blood': { s: 'Stool', p: [{ n: 'Occult Blood', u: '-', m: 'Negative', f: 'Negative' }] },
  'Stool for Reducing Substances': { s: 'Stool', p: [{ n: 'Reducing Substances', u: '-', m: 'Negative', f: 'Negative' }] },
  'Stool Routine': { s: 'Stool', p: [{ n: 'Consistency', u: '-', m: 'Semi-formed', f: 'Semi-formed' }, { n: 'Colour', u: '-', m: 'Brown', f: 'Brown' }, { n: 'Mucus', u: '-', m: 'Absent', f: 'Absent' }, { n: 'Blood', u: '-', m: 'Absent', f: 'Absent' }, { n: 'Pus Cells', u: '/hpf', m: '0 - 2', f: '0 - 2' }, { n: 'RBC', u: '/hpf', m: 'Nil', f: 'Nil' }, { n: 'Ova/Cyst', u: '-', m: 'Not Seen', f: 'Not Seen' }] },

  // ===== URINE EXAMINATION =====
  'Drug of abuse, Panel Qualitative': { s: 'Urine', p: [{ n: 'Drug Panel', u: '-', m: 'Negative', f: 'Negative' }] },
  'URINE ALBUMIN': { s: 'Urine', p: [{ n: 'Urine Albumin', u: '-', m: 'Nil', f: 'Nil' }] },
  'URINE BS & BP': { s: 'Urine', p: [{ n: 'Urine Sugar (BS)', u: '-', m: 'Nil', f: 'Nil' }, { n: 'Urine Protein (BP)', u: '-', m: 'Nil', f: 'Nil' }] },
  'URINE KETONE': { s: 'Urine', p: [{ n: 'Urine Ketone', u: '-', m: 'Negative', f: 'Negative' }] },
  'URINE ROUTINE': { s: 'Urine', p: [{ n: 'Colour', u: '-', m: 'Pale Yellow', f: 'Pale Yellow' }, { n: 'Appearance', u: '-', m: 'Clear', f: 'Clear' }, { n: 'pH', u: '', m: '5.0 - 8.0', f: '5.0 - 8.0' }, { n: 'Specific Gravity', u: '', m: '1.005 - 1.030', f: '1.005 - 1.030' }, { n: 'Protein', u: '-', m: 'Nil', f: 'Nil' }, { n: 'Sugar', u: '-', m: 'Nil', f: 'Nil' }, { n: 'Ketone', u: '-', m: 'Negative', f: 'Negative' }, { n: 'Bilirubin', u: '-', m: 'Negative', f: 'Negative' }, { n: 'Blood', u: '-', m: 'Negative', f: 'Negative' }, { n: 'Urobilinogen', u: 'mg/dL', m: '0.1 - 1.0', f: '0.1 - 1.0' }, { n: 'Pus Cells', u: '/hpf', m: '0 - 2', f: '0 - 2' }, { n: 'RBC', u: '/hpf', m: '0 - 2', f: '0 - 2' }, { n: 'Epithelial Cells', u: '/hpf', m: '0 - 2', f: '0 - 2' }, { n: 'Casts', u: '/lpf', m: 'Nil', f: 'Nil' }, { n: 'Crystals', u: '/hpf', m: 'Nil', f: 'Nil' }, { n: 'Bacteria', u: '-', m: 'Nil', f: 'Nil' }] },
};

async function migrate() {
  console.log('=== Migrating master_test_list to MongoDB ===\n');
  
  // Get MSSQL data
  const pool = await sql.connect(mssqlConfig);
  const result = await pool.request().query("SELECT * FROM master_test_list WHERE Department NOT LIKE '%RADIOLOGY%' ORDER BY Department, [Test Name]");
  const mssqlTests = result.recordset.map(r => ({
    name: (r['Test Name'] || '').trim(),
    department: (r['Department'] || '').trim().toUpperCase(),
    test_code: (r['Test Code'] || '').trim(),
  }));
  await pool.close();
  console.log(`MSSQL non-radiology tests: ${mssqlTests.length}`);

  // Connect to MongoDB
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const testsCol = db.collection('tests');
  const catsCol = db.collection('test_categories');

  // Get existing tests
  const existingTests = await testsCol.find({}).toArray();
  const existingNames = new Set(existingTests.map(t => t.name.toLowerCase().trim()));
  console.log(`Existing MongoDB tests: ${existingTests.length}`);

  // Get/create categories
  const cats = await catsCol.find({}).toArray();
  const catMap = {};
  cats.forEach(c => catMap[c.name.toUpperCase().trim()] = c._id);

  // Create missing categories
  const allDepts = [...new Set(mssqlTests.map(t => t.department))];
  for (const dept of allDepts) {
    if (!catMap[dept]) {
      const insertResult = await catsCol.insertOne({ name: dept });
      catMap[dept] = insertResult.insertedId;
      console.log(`  + Category: ${dept}`);
    }
  }

  let added = 0, skipped = 0, noParams = 0;

  for (const mssqlTest of mssqlTests) {
    if (existingNames.has(mssqlTest.name.toLowerCase())) {
      skipped++;
      continue;
    }

    const paramData = TEST_PARAMS[mssqlTest.name];
    let parameters = [];

    if (paramData) {
      parameters = paramData.p.map((p, i) => ({
        id: i + 1,
        param_name: p.n,
        unit: p.u,
        ref_range_male: p.m,
        ref_range_female: p.f,
        group_name: mssqlTest.name,
        sort_order: i + 1,
        calc_formula: p.cf || '',
        calc_decimals: p.cd ?? null,
      }));
    } else {
      // Default single parameter for tests without known params
      parameters = [{
        id: 1,
        param_name: mssqlTest.name,
        unit: '-',
        ref_range_male: '-',
        ref_range_female: '-',
        group_name: mssqlTest.name,
        sort_order: 1,
        calc_formula: '',
        calc_decimals: null,
      }];
      noParams++;
    }

    const testDoc = {
      name: mssqlTest.name,
      category_id: catMap[mssqlTest.department] || null,
      specimen: paramData?.s || 'Serum',
      test_code: mssqlTest.test_code,
      parameters,
    };

    await testsCol.insertOne(testDoc);
    added++;
    console.log(`  + ${mssqlTest.name} [${mssqlTest.department}] (${parameters.length} params)`);
  }

  console.log(`\n========================================`);
  console.log(`Added: ${added} | Skipped (existing): ${skipped} | No params (default): ${noParams}`);
  console.log(`========================================`);
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });
