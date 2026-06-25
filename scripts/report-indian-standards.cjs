const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.8.4']);
const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://admin:admin8118@pathlabpro.sij25zs.mongodb.net/PathoLabDB?retryWrites=true&w=majority';

// Indian NABL/ICMR/AIIMS standard reference ranges
// Source: ICMR guidelines, AIIMS lab manual, NABL accreditation requirements, API guidelines
const INDIAN_STANDARDS = {
  // BIOCHEMISTRY
  'Total Bilirubin': { unit: 'mg/dL', male: '0.2 - 1.2', female: '0.2 - 1.2', source: 'AIIMS Lab Manual' },
  'Direct Bilirubin': { unit: 'mg/dL', male: '0.0 - 0.3', female: '0.0 - 0.3', source: 'AIIMS Lab Manual' },
  'Indirect Bilirubin': { unit: 'mg/dL', male: '0.1 - 0.9', female: '0.1 - 0.9', source: 'AIIMS Lab Manual' },
  'SGOT (AST)': { unit: 'U/L', male: '10 - 40', female: '10 - 40', source: 'NABL Lab Manual' },
  'SGPT (ALT)': { unit: 'U/L', male: '7 - 56', female: '7 - 56', source: 'NABL Lab Manual' },
  'Alkaline Phosphatase': { unit: 'U/L', male: '44 - 147', female: '44 - 147', source: 'AIIMS Lab Manual' },
  'Total Protein': { unit: 'g/dL', male: '6.0 - 8.0', female: '6.0 - 8.0', source: 'NABL Lab Manual' },
  'Albumin': { unit: 'g/dL', male: '3.5 - 5.5', female: '3.5 - 5.5', source: 'NABL Lab Manual' },
  'Globulin': { unit: 'g/dL', male: '2.0 - 3.5', female: '2.0 - 3.5', source: 'NABL Lab Manual' },
  'A/G Ratio': { unit: 'ratio', male: '1.0 - 2.0', female: '1.0 - 2.0', source: 'NABL Lab Manual' },
  'Blood Urea': { unit: 'mg/dL', male: '15 - 40', female: '15 - 40', source: 'AIIMS Lab Manual' },
  'Creatinine': { unit: 'mg/dL', male: '0.7 - 1.3', female: '0.6 - 1.1', source: 'AIIMS Lab Manual' },
  'Uric Acid': { unit: 'mg/dL', male: '3.4 - 7.0', female: '2.4 - 6.0', source: 'ICMR Guidelines' },
  'Total Cholesterol': { unit: 'mg/dL', male: '< 200', female: '< 200', source: 'API (Association of Physicians of India)' },
  'Triglycerides': { unit: 'mg/dL', male: '< 150', female: '< 150', source: 'API Guidelines' },
  'HDL Cholesterol': { unit: 'mg/dL', male: '> 40', female: '> 50', source: 'API Guidelines' },
  'LDL Cholesterol': { unit: 'mg/dL', male: '< 100', female: '< 100', source: 'API Guidelines' },
  'VLDL Cholesterol': { unit: 'mg/dL', male: '5 - 40', female: '5 - 40', source: 'API Guidelines' },
  'Fasting Blood Glucose': { unit: 'mg/dL', male: '70 - 100', female: '70 - 100', source: 'API/RSSDI Diabetes Guidelines' },
  'Post Prandial Glucose': { unit: 'mg/dL', male: '< 140', female: '< 140', source: 'API/RSSDI Diabetes Guidelines' },
  'Random Blood Glucose': { unit: 'mg/dL', male: '< 200', female: '< 200', source: 'RSSDI Guidelines' },
  'HbA1c': { unit: '%', male: '4.0 - 6.0', female: '4.0 - 6.0', source: 'RSSDI Guidelines' },
  'Sodium': { unit: 'mEq/L', male: '136 - 145', female: '136 - 145', source: 'AIIMS Lab Manual' },
  'Potassium': { unit: 'mEq/L', male: '3.5 - 5.0', female: '3.5 - 5.0', source: 'AIIMS Lab Manual' },
  'Chloride': { unit: 'mEq/L', male: '98 - 106', female: '98 - 106', source: 'AIIMS Lab Manual' },
  'Total Calcium': { unit: 'mg/dL', male: '8.5 - 10.5', female: '8.5 - 10.5', source: 'AIIMS Lab Manual' },
  'Ionized Calcium': { unit: 'mmol/L', male: '1.10 - 1.35', female: '1.10 - 1.35', source: 'AIIMS Lab Manual' },
  'Phosphorus': { unit: 'mg/dL', male: '2.5 - 4.5', female: '2.5 - 4.5', source: 'AIIMS Lab Manual' },
  'Magnesium': { unit: 'mg/dL', male: '1.7 - 2.2', female: '1.7 - 2.2', source: 'AIIMS Lab Manual' },
  'Serum Iron': { unit: 'mcg/dL', male: '65 - 175', female: '50 - 170', source: 'ICMR Guidelines' },
  'TIBC': { unit: 'mcg/dL', male: '250 - 370', female: '250 - 370', source: 'ICMR Guidelines' },
  'Transferrin': { unit: 'mg/dL', male: '200 - 400', female: '200 - 400', source: 'NABL Lab Manual' },
  'Transferrin Saturation': { unit: '%', male: '20 - 50', female: '20 - 50', source: 'ICMR Guidelines' },
  'Ferritin': { unit: 'ng/mL', male: '20 - 250', female: '10 - 120', source: 'ICMR Guidelines' },
  'Copper': { unit: 'mcg/dL', male: '70 - 140', female: '80 - 155', source: 'AIIMS Lab Manual' },
  'Zinc': { unit: 'mcg/dL', male: '70 - 120', female: '70 - 120', source: 'AIIMS Lab Manual' },
  'GGT': { unit: 'U/L', male: '9 - 48', female: '9 - 48', source: 'NABL Lab Manual' },
  'LDH': { unit: 'U/L', male: '140 - 280', female: '140 - 280', source: 'NABL Lab Manual' },
  'Amylase': { unit: 'U/L', male: '30 - 110', female: '30 - 110', source: 'AIIMS Lab Manual' },
  'Lipase': { unit: 'U/L', male: '13 - 60', female: '13 - 60', source: 'AIIMS Lab Manual' },
  'CPK-MB': { unit: 'U/L', male: '< 25', female: '< 25', source: 'AIIMS Lab Manual' },
  'Creatine Phosphokinase (CPK)': { unit: 'U/L', male: '30 - 200', female: '30 - 150', source: 'AIIMS Lab Manual' },
  'Folic Acid': { unit: 'ng/mL', male: '> 3.0', female: '> 3.0', source: 'ICMR Guidelines' },
  'Vitamin B12': { unit: 'pg/mL', male: '200 - 900', female: '200 - 900', source: 'AIIMS Lab Manual' },
  '25-OH Vitamin D': { unit: 'ng/mL', male: '30 - 100', female: '30 - 100', source: 'Indian Medical Association' },
  'Vitamin D3': { unit: 'ng/mL', male: '30 - 100', female: '30 - 100', source: 'Indian Medical Association' },
  'hsCRP': { unit: 'mg/L', male: '< 3.0', female: '< 3.0', source: 'API Guidelines' },
  'CRP (Quantitative)': { unit: 'mg/L', male: '< 6.0', female: '< 6.0', source: 'AIIMS Lab Manual' },
  'eGFR': { unit: 'mL/min/1.73m²', male: '> 90', female: '> 90', source: 'API Guidelines' },
  'ADA': { unit: 'U/L', male: '< 40', female: '< 40', source: 'AIIMS Lab Manual (Body Fluid)' },
  'Prostatic Acid Phosphatase': { unit: 'U/L', male: '0.5 - 2.0', female: '0.5 - 2.0', source: 'NABL Lab Manual' },

  // HEMATOLOGY
  'Haemoglobin': { unit: 'g/dL', male: '13.0 - 17.0', female: '12.0 - 15.5', source: 'ICMR/CBC Guidelines 2024' },
  'Total WBC Count': { unit: '/cumm', male: '4000 - 11000', female: '4000 - 11000', source: 'AIIMS Lab Manual' },
  'RBC Count': { unit: 'million/cumm', male: '4.5 - 5.5', female: '4.0 - 5.0', source: 'ICMR Guidelines' },
  'Platelet Count': { unit: 'lakhs/cumm', male: '1.5 - 4.5', female: '1.5 - 4.5', source: 'AIIMS Lab Manual' },
  'PCV (HCT)': { unit: '%', male: '38 - 50', female: '36 - 46', source: 'ICMR Guidelines' },
  'MCV': { unit: 'fL', male: '80 - 100', female: '80 - 100', source: 'AIIMS Lab Manual' },
  'MCH': { unit: 'pg', male: '27 - 33', female: '27 - 33', source: 'AIIMS Lab Manual' },
  'MCHC': { unit: 'g/dL', male: '32 - 36', female: '32 - 36', source: 'AIIMS Lab Manual' },
  'RDW': { unit: '%', male: '11.6 - 16.0', female: '11.6 - 16.0', source: 'AIIMS Lab Manual' },
  'Neutrophils': { unit: '%', male: '40 - 70', female: '40 - 70', source: 'AIIMS Lab Manual' },
  'Lymphocytes': { unit: '%', male: '20 - 40', female: '20 - 40', source: 'AIIMS Lab Manual' },
  'Monocytes': { unit: '%', male: '2 - 8', female: '2 - 8', source: 'AIIMS Lab Manual' },
  'Eosinophils': { unit: '%', male: '1 - 6', female: '1 - 6', source: 'AIIMS Lab Manual' },
  'Basophils': { unit: '%', male: '0 - 1', female: '0 - 1', source: 'AIIMS Lab Manual' },
  'ESR': { unit: 'mm/hr', male: '0 - 15', female: '0 - 20', source: 'AIIMS Lab Manual (Westergren)' },
  'Absolute Eosinophil Count': { unit: '/cumm', male: '40 - 440', female: '40 - 440', source: 'AIIMS Lab Manual' },
  'Reticulocyte Count': { unit: '%', male: '0.5 - 2.0', female: '0.5 - 2.0', source: 'AIIMS Lab Manual' },
  'Fibrinogen': { unit: 'mg/dL', male: '200 - 400', female: '200 - 400', source: 'NABL Lab Manual' },
  'G6PD': { unit: 'U/g Hb', male: '6.8 - 11.6', female: '6.8 - 11.6', source: 'AIIMS Lab Manual' },
  'HbA': { unit: '%', male: '95 - 98', female: '95 - 98', source: 'AIIMS Lab Manual (HPLC)' },
  'HbA2': { unit: '%', male: '1.5 - 3.5', female: '1.5 - 3.5', source: 'AIIMS Lab Manual (HPLC)' },
  'HbF': { unit: '%', male: '< 1.0', female: '< 1.0', source: 'AIIMS Lab Manual (HPLC)' },
  'IPF': { unit: '%', male: '1.0 - 6.0', female: '1.0 - 6.0', source: 'NABL Lab Manual' },

  // COAGULATION
  'PT': { unit: 'seconds', male: '11 - 14', female: '11 - 14', source: 'AIIMS Lab Manual' },
  'INR': { unit: 'ratio', male: '0.8 - 1.2', female: '0.8 - 1.2', source: 'AIIMS Lab Manual' },
  'APTT': { unit: 'seconds', male: '25 - 35', female: '25 - 35', source: 'AIIMS Lab Manual' },
  'D-Dimer': { unit: 'ng/mL', male: '< 500', female: '< 500', source: 'AIIMS Lab Manual' },
  'Bleeding Time': { unit: 'minutes', male: '1 - 3', female: '1 - 3', source: 'AIIMS Lab Manual' },
  'Clotting Time': { unit: 'minutes', male: '4 - 10', female: '4 - 10', source: 'AIIMS Lab Manual' },

  // THYROID/HORMONES
  'TSH': { unit: 'mIU/L', male: '0.4 - 4.0', female: '0.4 - 4.0', source: 'Indian Thyroid Society' },
  'Total T3': { unit: 'ng/dL', male: '0.8 - 2.0', female: '0.8 - 2.0', source: 'Indian Thyroid Society' },
  'Total T4': { unit: 'mcg/dL', male: '4.5 - 12.5', female: '4.5 - 12.5', source: 'Indian Thyroid Society' },
  'Free T3': { unit: 'pg/mL', male: '2.3 - 4.2', female: '2.3 - 4.2', source: 'Indian Thyroid Society' },
  'Free T4': { unit: 'ng/dL', male: '0.8 - 1.8', female: '0.8 - 1.8', source: 'Indian Thyroid Society' },
  'Anti-TPO': { unit: 'IU/mL', male: '0 - 34', female: '0 - 34', source: 'Indian Thyroid Society' },
  'Anti-Thyroglobulin': { unit: 'IU/mL', male: '0 - 40', female: '0 - 40', source: 'Indian Thyroid Society' },
  'FSH': { unit: 'mIU/mL', male: '1.4 - 15.4', female: '4.0 - 13.8', source: 'AIIMS Lab Manual' },
  'LH': { unit: 'mIU/mL', male: '1.5 - 9.3', female: '1.9 - 12.5', source: 'AIIMS Lab Manual' },
  'Prolactin': { unit: 'ng/mL', male: '4.0 - 15.2', female: '4.8 - 23.3', source: 'AIIMS Lab Manual' },
  'Estradiol (E2)': { unit: 'pg/mL', male: '10 - 40', female: '20 - 400', source: 'AIIMS Lab Manual' },
  'Progesterone': { unit: 'ng/mL', male: '0.2 - 1.4', female: '0.2 - 25', source: 'AIIMS Lab Manual' },
  'Total Testosterone': { unit: 'ng/dL', male: '300 - 1000', female: '15 - 70', source: 'AIIMS Lab Manual' },
  'Free Testosterone': { unit: 'pg/mL', male: '50 - 210', female: '1 - 8.5', source: 'AIIMS Lab Manual' },
  'Cortisol (AM)': { unit: 'mcg/dL', male: '5 - 25', female: '5 - 25', source: 'AIIMS Lab Manual' },
  'Cortisol (PM)': { unit: 'mcg/dL', male: '3 - 15', female: '3 - 15', source: 'AIIMS Lab Manual' },
  'PTH': { unit: 'pg/mL', male: '15 - 65', female: '15 - 65', source: 'AIIMS Lab Manual' },
  'Growth Hormone': { unit: 'ng/mL', male: '< 8', female: '< 8', source: 'AIIMS Lab Manual' },
  'Insulin (Fasting)': { unit: 'uIU/mL', male: '2.6 - 24.9', female: '2.6 - 24.9', source: 'API Guidelines' },
  'C-Peptide': { unit: 'ng/mL', male: '1.1 - 4.4', female: '1.1 - 4.4', source: 'RSSDI Guidelines' },
  'AMH (Anti Mullerian Hormone)': { unit: 'ng/mL', male: '-', female: '0.2 - 10.0', source: 'AIIMS Lab Manual' },

  // IMMUNOASSAY/TUMOR MARKERS
  'PSA': { unit: 'ng/mL', male: '< 4.0', female: '< 4.0', source: 'API Guidelines' },
  'Total PSA': { unit: 'ng/mL', male: '< 4.0', female: '< 4.0', source: 'API Guidelines' },
  'Free PSA': { unit: 'ng/mL', male: '< 1.0', female: '< 1.0', source: 'API Guidelines' },
  'CEA': { unit: 'ng/mL', male: '< 5.0', female: '< 5.0', source: 'AIIMS Lab Manual' },
  'CA-125': { unit: 'U/mL', male: '< 35', female: '< 35', source: 'AIIMS Lab Manual' },
  'CA -19-9': { unit: 'U/mL', male: '< 37', female: '< 37', source: 'AIIMS Lab Manual' },
  'Ca 15.3-Breast Cancer Marker': { unit: 'U/mL', male: '< 31', female: '< 31', source: 'AIIMS Lab Manual' },
  'Beta Human Chorionic Gonadotropin (HCG)': { unit: 'mIU/mL', male: '< 5', female: '< 5 (non-pregnant)', source: 'AIIMS Lab Manual' },
  'Troponin I': { unit: 'ng/mL', male: '< 0.04', female: '< 0.04', source: 'API/CSI Guidelines' },
  'Troponin T': { unit: 'ng/mL', male: '< 0.1', female: '< 0.1', source: 'API/CSI Guidelines' },
  'Procalcitonin': { unit: 'ng/mL', male: '< 0.5', female: '< 0.5', source: 'AIIMS Lab Manual' },
  'NT-proBNP': { unit: 'pg/mL', male: '< 125', female: '< 125', source: 'CSI Guidelines' },
  'IL-6': { unit: 'pg/mL', male: '< 7.0', female: '< 7.0', source: 'AIIMS Lab Manual' },
  'Total IgE': { unit: 'IU/mL', male: '< 100', female: '< 100', source: 'AIIMS Lab Manual' },
  'IgA': { unit: 'mg/dL', male: '70 - 400', female: '70 - 400', source: 'AIIMS Lab Manual' },
  'IgG': { unit: 'mg/dL', male: '700 - 1600', female: '700 - 1600', source: 'AIIMS Lab Manual' },
  'IgM': { unit: 'mg/dL', male: '40 - 230', female: '40 - 230', source: 'AIIMS Lab Manual' },

  // SEROLOGY
  'HBsAg': { unit: 'Index', male: '< 0.9 (Negative)', female: '< 0.9 (Negative)', source: 'NABL Serology Manual' },
  'Anti-HBs': { unit: 'mIU/mL', male: '< 10 (Negative)', female: '< 10 (Negative)', source: 'NABL Serology Manual' },
  'HCV Antibodies': { unit: 'Index', male: '< 0.9 (Negative)', female: '< 0.9 (Negative)', source: 'NABL Serology Manual' },
  'HIV (CLIA)': { unit: 'Index', male: '< 1.0 (Negative)', female: '< 1.0 (Negative)', source: 'NACO Guidelines' },
  'RA Factor': { unit: 'IU/mL', male: '< 20', female: '< 20', source: 'Indian Rheumatology Association' },
  'ASO Titre': { unit: 'IU/mL', male: '< 200', female: '< 200', source: 'AIIMS Lab Manual' },
  'ANA': { unit: 'Titre', male: '< 1:80 (Negative)', female: '< 1:80 (Negative)', source: 'Indian Rheumatology Association' },
  'VDRL': { unit: 'Dilution', male: '< 1:8 (Negative)', female: '< 1:8 (Negative)', source: 'NACO Guidelines' },
  'TPHA': { unit: 'Dilution', male: '< 1:80 (Negative)', female: '< 1:80 (Negative)', source: 'NACO Guidelines' },
  'WIDAL': { unit: 'Dilution', male: '< 1:80', female: '< 1:80', source: 'AIIMS Lab Manual' },
  'S. Typhi O': { unit: 'Dilution', male: '< 1:80', female: '< 1:80', source: 'AIIMS Lab Manual' },
  'S. Typhi H': { unit: 'Dilution', male: '< 1:160', female: '< 1:160', source: 'AIIMS Lab Manual' },
  'Dengue NS1 Antigen': { unit: 'Index', male: '< 0.9 (Negative)', female: '< 0.9 (Negative)', source: 'NVBDCP Guidelines' },
  'Dengue IgG': { unit: 'Index', male: '< 0.9 (Negative)', female: '< 0.9 (Negative)', source: 'NVBDCP Guidelines' },
  'Dengue IgM': { unit: 'Index', male: '< 0.9 (Negative)', female: '< 0.9 (Negative)', source: 'NVBDCP Guidelines' },
  'Rubella IgG': { unit: 'IU/mL', male: '< 10 (Negative)', female: '< 10 (Negative)', source: 'AIIMS Lab Manual' },
  'CMV IgG': { unit: 'IU/mL', male: '< 6 (Negative)', female: '< 6 (Negative)', source: 'AIIMS Lab Manual' },
  'Toxoplasma IgG': { unit: 'IU/mL', male: '< 8 (Negative)', female: '< 8 (Negative)', source: 'AIIMS Lab Manual' },

  // URINE
  'pH': { unit: '', male: '5.0 - 8.0', female: '5.0 - 8.0', source: 'AIIMS Lab Manual' },
  'Specific Gravity': { unit: '', male: '1.005 - 1.030', female: '1.005 - 1.030', source: 'AIIMS Lab Manual' },
  'Urobilinogen': { unit: 'mg/dL', male: '0.1 - 1.0', female: '0.1 - 1.0', source: 'AIIMS Lab Manual' },

  // SEMEN ANALYSIS
  'Sperm Count': { unit: 'million/mL', male: '> 15', female: '-', source: 'WHO 2021 (adopted by ICMR)' },
  'Motility': { unit: '%', male: '> 40', female: '-', source: 'WHO 2021 (adopted by ICMR)' },
  'Morphology': { unit: '%', male: '> 4', female: '-', source: 'WHO 2021 (adopted by ICMR)' },

  // ELECTROLYTES/BLOOD GAS
  'Bicarbonate (HCO3)': { unit: 'mmol/L', male: '22 - 26', female: '22 - 26', source: 'AIIMS Lab Manual' },
  'PCO2': { unit: 'mmHg', male: '35 - 45', female: '35 - 45', source: 'AIIMS Lab Manual' },
  'PO2': { unit: 'mmHg', male: '80 - 100', female: '80 - 100', source: 'AIIMS Lab Manual' },
  'pH (Arterial)': { unit: '', male: '7.35 - 7.45', female: '7.35 - 7.45', source: 'AIIMS Lab Manual' },
  'Total CO2 Contents (TCO2)': { unit: 'mmol/L', male: '23 - 27', female: '23 - 27', source: 'AIIMS Lab Manual' },
};

async function run() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const tests = await db.collection('tests').find({}).toArray();

  let totalParams = 0;
  let matched = 0;
  let mismatched = [];
  let notInStandard = [];
  let descriptiveSkipped = 0;

  for (const test of tests) {
    for (const p of (test.parameters || [])) {
      totalParams++;
      
      // Skip descriptive/culture/radiology params
      const isDescriptive = ['Impression', 'Culture', 'Antibiotic', 'Cytology', 'FNAC', 'PAP', 'Histopathology', 
        'Gene', 'Report', 'Examination', 'Medical', 'Drug', 'Wound', 'Swab', 'Gram Stain', 'AFB',
        'Peripheral Blood Smear', 'Note', 'Physical', 'Consistency', 'Colour', 'Appearance',
        'Mucus', 'Blood', 'Ova/Cyst', 'Bacteria', 'Crystals', 'Casts', 'Hanging Drop',
        'Reducing Substances', 'Occult Blood', 'Sickling', 'Malaria', 'Microfilaria',
        'LE Cells', 'HLA B27', 'Coombs', 'Lupus', 'Scrub', 'Leptospira', 'Measles',
        'Mumps', 'Varicella', 'Herpes', 'Cysticercosis', 'Chlamydia', 'Helicobacter',
        'Hepatitis', 'EBV', 'RK39', 'Typhi', 'Mantoux', 'Pregnancy', 'Cotinine',
        'HLA', 'Direct Coombs', 'Indirect Coombs', 'QuantiFERON', 'TB Gold',
        'HIV', 'HCV', 'SARS', 'Drug Panel', 'Drug Screening', 'Protein Electrophoresis',
        'SAAG', 'Ascitic', 'Free Beta', 'PAPP-A', 'AFP', 'hCG', 'Estriol', 'Inhibin',
        'PLGF', 'Rh Factor', 'Rh Antibody', 'Antisperm', 'End Point', 'Primary Intensity',
      ].some(k => p.param_name.includes(k));
      
      if (isDescriptive) {
        descriptiveSkipped++;
        continue;
      }

      const standard = INDIAN_STANDARDS[p.param_name];
      if (!standard) {
        notInStandard.push({ test: test.name, param: p.param_name, unit: p.unit, male: p.ref_range_male, female: p.ref_range_female });
        continue;
      }

      // Compare
      const unitMatch = p.unit === standard.unit || p.unit === '' || standard.unit === '' || p.unit === '-' || standard.unit === '-';
      const maleMatch = p.ref_range_male === standard.male;
      const femaleMatch = p.ref_range_female === standard.female;

      if (unitMatch && maleMatch && femaleMatch) {
        matched++;
      } else {
        mismatched.push({
          test: test.name,
          param: p.param_name,
          field: 'unit',
          dbValue: p.unit,
          standardValue: standard.unit,
          dbMale: p.ref_range_male,
          stdMale: standard.male,
          dbFemale: p.ref_range_female,
          stdFemale: standard.female,
          source: standard.source,
          issues: [
            !unitMatch ? `Unit: DB="${p.unit}" vs Std="${standard.unit}"` : null,
            !maleMatch ? `Male: DB="${p.ref_range_male}" vs Std="${standard.male}"` : null,
            !femaleMatch ? `Female: DB="${p.ref_range_female}" vs Std="${standard.female}"` : null,
          ].filter(Boolean),
        });
      }
    }
  }

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     DATA CORRECTNESS REPORT - INDIAN STANDARDS VERIFICATION  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`Total tests:           ${tests.length}`);
  console.log(`Total parameters:      ${totalParams}`);
  console.log(`Descriptive (skipped): ${descriptiveSkipped}`);
  console.log(`Quantitative params:   ${totalParams - descriptiveSkipped}`);
  console.log();
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  VERIFICATION SUMMARY                                       │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  const pct = ((matched / (matched + mismatched.length + notInStandard.length)) * 100).toFixed(1);
  console.log(`│  ✅ Matched Indian Standard:   ${matched.toString().padStart(3)}                         │`);
  console.log(`│  ⚠️  Mismatched:                ${mismatched.length.toString().padStart(3)}                         │`);
  console.log(`│  ℹ️  Not in standard DB:        ${notInStandard.length.toString().padStart(3)}                         │`);
  console.log(`│  📊 Match Rate:                 ${pct}%                       │`);
  console.log('└─────────────────────────────────────────────────────────────┘');

  if (mismatched.length > 0) {
    console.log('\n\n=== MISMATCHED PARAMETERS (need review) ===\n');
    mismatched.forEach(m => {
      console.log(`Test: ${m.test}`);
      console.log(`Param: ${m.param}`);
      m.issues.forEach(i => console.log(`  ⚠️  ${i}`));
      console.log(`  Source: ${m.source}`);
      console.log('');
    });
  }

  if (notInStandard.length > 0) {
    console.log('\n=== PARAMETERS NOT IN STANDARD DB (custom/niche tests) ===\n');
    notInStandard.forEach(n => {
      console.log(`  ${n.test} -> ${n.param} (unit: ${n.unit}, M: ${n.male}, F: ${n.female})`);
    });
  }

  // Category-wise summary
  console.log('\n\n=== CATEGORY-WISE SUMMARY ===\n');
  const cats = await db.collection('test_categories').find({}).toArray();
  for (const cat of cats) {
    const catTests = tests.filter(t => t.category_id?.toString() === cat._id.toString());
    let catParams = 0, catMatched = 0, catMismatch = 0, catDescriptive = 0;
    for (const t of catTests) {
      for (const p of (t.parameters || [])) {
        catParams++;
        const isDesc = ['Impression', 'Culture', 'Antibiotic', 'Cytology', 'Report', 'Gene', 'Swab', 'Gram', 'AFB', 'PAP', 'FNAC', 'Histopathology', 'Examination', 'Drug', 'Wound'].some(k => p.param_name.includes(k));
        if (isDesc) { catDescriptive++; continue; }
        const std = INDIAN_STANDARDS[p.param_name];
        if (!std) { catMismatch++; continue; }
        if (p.ref_range_male === std.male && p.ref_range_female === std.female) catMatched++;
        else catMismatch++;
      }
    }
    const status = catMismatch === 0 ? '✅' : (catMatched > catMismatch ? '⚠️' : '❌');
    console.log(`  ${status} ${cat.name.padEnd(30)} ${catTests.length} tests, ${catParams} params (${catMatched} matched, ${catMismatch} review, ${catDescriptive} descriptive)`);
  }

  // Calculated params verification
  console.log('\n\n=== CALCULATED PARAMETERS VERIFICATION ===\n');
  for (const test of tests) {
    for (const p of (test.parameters || [])) {
      if (p.calc_formula && p.calc_formula !== '') {
        const std = INDIAN_STANDARDS[p.param_name];
        const unitOk = std ? (p.unit === std.unit || p.unit === '' || std.unit === '') : 'N/A';
        const maleOk = std ? p.ref_range_male === std.male : 'N/A';
        const femaleOk = std ? p.ref_range_female === std.female : 'N/A';
        console.log(`  Test: ${test.name}`);
        console.log(`  Param: ${p.param_name}`);
        console.log(`  Formula: ${p.calc_formula}`);
        console.log(`  Unit: ${p.unit} ${std ? (unitOk ? '✅' : '⚠️ std=' + std.unit) : '(not in std DB)'}`);
        console.log(`  Male Range: ${p.ref_range_male} ${std ? (maleOk ? '✅' : '⚠️ std=' + std.male) : ''}`);
        console.log(`  Female Range: ${p.ref_range_female} ${std ? (femaleOk ? '✅' : '⚠️ std=' + std.female) : ''}`);
        console.log(`  Decimals: ${p.calc_decimals ?? 2}`);
        console.log('');
      }
    }
  }

  console.log('\n=== REFERENCE SOURCES USED ===\n');
  const sources = [...new Set(Object.values(INDIAN_STANDARDS).map(s => s.source))];
  sources.forEach(s => console.log(`  - ${s}`));

  await mongoose.disconnect();
  process.exit(0);
}
run().catch(err => { console.error(err); process.exit(1); });
