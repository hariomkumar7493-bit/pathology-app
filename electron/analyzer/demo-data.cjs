/**
 * Demo Analyzer Data
 *
 * Generates realistic 5-part hematology (CBC) results for demos —
 * same shape the ASTM parser produces, so downstream code can't
 * tell it apart from a real analyzer.
 */

const DEMO_PATIENTS = [
  {
    patientId: '101',
    patientName: 'Suresh Verma',
    age: '52',
    sex: 'M',
    sampleId: '101',
    // Mostly normal CBC
    values: {
      'WBC': 7.4, 'RBC': 4.9, 'HGB': 14.6, 'HCT': 44.2, 'MCV': 90.2, 'MCH': 29.8, 'MCHC': 33.0,
      'PLT': 262,
      'NEU%': 58.4, 'LYM%': 32.1, 'MON%': 6.2, 'EOS%': 2.6, 'BAS%': 0.7,
      'NEU#': 4.32, 'LYM#': 2.38, 'MON#': 0.46, 'EOS#': 0.19, 'BAS#': 0.05,
      'RDW-SD': 41.5, 'RDW-CV': 12.6, 'PDW': 15.8, 'MPV': 9.6, 'PCT': 0.251, 'P-LCR': 22.4,
    },
  },
  {
    patientId: '102',
    patientName: 'Priya Sharma',
    age: '28',
    sex: 'F',
    sampleId: '102',
    // Microcytic anemia profile — flags look good on demo screens
    values: {
      'WBC': 6.1, 'RBC': 3.4, 'HGB': 8.2, 'HCT': 27.9, 'MCV': 68.4, 'MCH': 20.9, 'MCHC': 30.5,
      'PLT': 385,
      'NEU%': 61.2, 'LYM%': 29.8, 'MON%': 6.5, 'EOS%': 1.9, 'BAS%': 0.6,
      'NEU#': 3.73, 'LYM#': 1.82, 'MON#': 0.40, 'EOS#': 0.12, 'BAS#': 0.04,
      'RDW-SD': 52.8, 'RDW-CV': 17.9, 'PDW': 14.2, 'MPV': 9.1, 'PCT': 0.350, 'P-LCR': 20.1,
    },
  },
  {
    patientId: '103',
    patientName: 'Abdul Khan',
    age: '65',
    sex: 'M',
    sampleId: '103',
    // Infection — high WBC + neutrophilia
    values: {
      'WBC': 16.8, 'RBC': 4.6, 'HGB': 13.8, 'HCT': 41.7, 'MCV': 88.9, 'MCH': 30.0, 'MCHC': 33.7,
      'PLT': 298,
      'NEU%': 82.6, 'LYM%': 11.2, 'MON%': 4.8, 'EOS%': 1.0, 'BAS%': 0.4,
      'NEU#': 13.88, 'LYM#': 1.88, 'MON#': 0.81, 'EOS#': 0.17, 'BAS#': 0.07,
      'RDW-SD': 43.2, 'RDW-CV': 13.1, 'PDW': 16.4, 'MPV': 10.2, 'PCT': 0.304, 'P-LCR': 26.8,
    },
  },
];

// Reference ranges used for abnormal flagging in the demo stream
const REFS = {
  'WBC': ['4.0', '10.0', '10^9/L'],
  'RBC': ['4.0', '5.5', '10^12/L'],
  'HGB': ['12.0', '16.0', 'g/dL'],
  'HCT': ['37', '50', '%'],
  'MCV': ['80', '100', 'fL'],
  'MCH': ['27', '34', 'pg'],
  'MCHC': ['31', '36', 'g/dL'],
  'PLT': ['150', '450', '10^9/L'],
  'NEU%': ['40', '70', '%'],
  'LYM%': ['20', '40', '%'],
  'MON%': ['2', '10', '%'],
  'EOS%': ['1', '6', '%'],
  'BAS%': ['0', '2', '%'],
  'NEU#': ['2.0', '7.0', '10^9/L'],
  'LYM#': ['1.0', '3.0', '10^9/L'],
  'MON#': ['0.2', '1.0', '10^9/L'],
  'EOS#': ['0.02', '0.5', '10^9/L'],
  'BAS#': ['0.02', '0.1', '10^9/L'],
  'RDW-SD': ['35', '46', 'fL'],
  'RDW-CV': ['11.6', '14.8', '%'],
  'PDW': ['15', '17', 'fL'],
  'MPV': ['7', '11', 'fL'],
  'PCT': ['0.15', '0.4', '%'],
  'P-LCR': ['18', '45', '%'],
};

function flagFor(code, value) {
  const ref = REFS[code];
  if (!ref) return '';
  const lo = parseFloat(ref[0]);
  const hi = parseFloat(ref[1]);
  if (value < lo) return 'L';
  if (value > hi) return 'H';
  return 'N';
}

let idx = 0;

/**
 * Returns the next demo result — same structure ASTMParser.buildResult emits.
 */
function nextResult() {
  const p = DEMO_PATIENTS[idx % DEMO_PATIENTS.length];
  idx++;

  const results = Object.entries(p.values).map(([code, value], i) => ({
    type: 'result',
    sequence: String(i + 1),
    testCode: code,
    testName: code,
    value: String(value),
    unit: (REFS[code] || [])[2] || '',
    refRange: REFS[code] ? `${REFS[code][0]}-${REFS[code][1]}` : '',
    abnormalFlag: flagFor(code, value),
    resultType: '',
    raw: '',
  }));

  return {
    timestamp: new Date().toISOString(),
    analyzer: 'Demo Analyzer',
    patient: {
      type: 'patient',
      patientId: p.patientId,
      patientName: p.patientName,
      age: p.age,
      sex: p.sex,
    },
    orders: [{ type: 'order', sequence: '1', sampleId: p.sampleId, testOrders: ['CBC'], specimen: 'BLOOD' }],
    results,
    comments: [],
    raw: '(demo stream — no physical analyzer connected)',
  };
}

module.exports = { nextResult, DEMO_PATIENTS };
