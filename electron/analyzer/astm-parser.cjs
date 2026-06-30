/**
 * ASTM E1394 Parser for Erba Chem 7
 *
 * Erba Chem 7 sends results as ASTM frames:
 *   H|\^&|||^|||||host^1|||||||...
 *   P|1|SAMPLE_ID|||PATIENT_NAME||...
 *   R|1|^^TEST_CODE^||VALUE|UNIT|REF_LOW-REF_HIGH|FLAG|...
 *   L|1|N
 *
 * Each frame may have:
 *   - Frame number (1 char) + content + <ETX> + checksum + <CR><LF>
 *   - Or plain text lines separated by <CR>/<LF>
 */

// Erba Chem 7 test code mapping to common parameter names
const TEST_CODE_MAP = {
  'GLU': 'Glucose',
  'GLUCOSE': 'Glucose',
  'BGL': 'Blood Glucose',
  'UREA': 'Urea',
  'BUN': 'Blood Urea Nitrogen',
  'CRE': 'Creatinine',
  'CREATININE': 'Creatinine',
  'TBIL': 'Total Bilirubin',
  'BILIRUBIN': 'Total Bilirubin',
  'DBIL': 'Direct Bilirubin',
  'IBIL': 'Indirect Bilirubin',
  'TP': 'Total Protein',
  'ALB': 'Albumin',
  'GLOB': 'Globulin',
  'A/G': 'A/G Ratio',
  'ALT': 'SGPT',
  'SGPT': 'SGPT',
  'AST': 'SGOT',
  'SGOT': 'SGOT',
  'ALP': 'ALP',
  'GGT': 'GGT',
  'CHO': 'Cholesterol',
  'CHOL': 'Cholesterol',
  'CHOLESTEROL': 'Cholesterol',
  'HDL': 'HDL Cholesterol',
  'LDL': 'LDL Cholesterol',
  'VLDL': 'VLDL Cholesterol',
  'TG': 'Triglycerides',
  'TRIG': 'Triglycerides',
  'TRIGLYCERIDES': 'Triglycerides',
  'UA': 'Uric Acid',
  'URIC': 'Uric Acid',
  'URIC ACID': 'Uric Acid',
  'CA': 'Calcium',
  'CALCIUM': 'Calcium',
  'PHOS': 'Phosphorus',
  'PHOSPHORUS': 'Phosphorus',
  'K': 'Potassium',
  'POTASSIUM': 'Potassium',
  'NA': 'Sodium',
  'SODIUM': 'Sodium',
  'CL': 'Chloride',
  'CHLORIDE': 'Chloride',
  'MG': 'Magnesium',
  'MAGNESIUM': 'Magnesium',
  'CK': 'Creatine Kinase',
  'CK-MB': 'CK-MB',
  'LDH': 'LDH',
  'AMY': 'Amylase',
  'AMYLASE': 'Amylase',
  'LIPASE': 'Lipase',
  'TSH': 'TSH',
  'T3': 'T3',
  'T4': 'T4',
  'FT3': 'Free T3',
  'FT4': 'Free T4',
  'HBA1C': 'HbA1c',
  'HBA1C%': 'HbA1c',
  'CRP': 'C-Reactive Protein',
  'PSA': 'PSA',
  'CEA': 'CEA',
  'AFP': 'AFP',
};

/**
 * Parse a single ASTM frame or line into a structured object
 * Accumulates frames and returns a complete result when L (terminator) frame is received
 */
class ASTMParser {
  constructor() {
    this.reset();
  }

  reset() {
    this.current = {
      sampleId: null,
      patientName: null,
      patientId: null,
      results: [],
      raw: [],
    };
  }

  /**
   * Process a raw line/frame from the serial port
   * Returns a complete result object when the full message is received (L frame), or null if still accumulating
   */
  processLine(line) {
    // Remove any control characters
    line = line.replace(/[\x00-\x1F]/g, (ch) => {
      // Keep pipe, backslash, caret, ampersand — they are ASTM delimiters
      return '';
    }).trim();

    if (!line) return null;

    this.current.raw.push(line);

    // Identify frame type by first character
    const frameType = line.charAt(0).toUpperCase();

    switch (frameType) {
      case 'H':
        return this.parseHeader(line);
      case 'P':
        return this.parsePatient(line);
      case 'O':
        return this.parseOrder(line);
      case 'R':
        return this.parseResult(line);
      case 'L':
        return this.parseTerminator(line);
      case 'Q':
        return this.parseQuery(line);
      default:
        // Unknown frame — could be partial data, log and skip
        console.log('[astm] Unknown frame type:', frameType, line.substring(0, 50));
        return null;
    }
  }

  parseHeader(line) {
    // H|\^&|||^|||||host^1|||||||...
    console.log('[astm] Header frame received');
    return null;
  }

  parsePatient(line) {
    // P|1|SAMPLE_ID|||PATIENT_NAME^||...
    // Fields are pipe-delimited
    const fields = line.split('|');
    // P|1|sample_id|...|name^...
    this.current.sampleId = fields[2] ? fields[2].trim() : null;
    
    // Patient name is in field 5 (index 5), format: LASTNAME^FIRSTNAME
    const nameField = fields[5] || '';
    if (nameField) {
      const nameParts = nameField.split('^').filter(p => p.trim());
      if (nameParts.length > 1) {
        this.current.patientName = nameParts.join(' ').trim();
      } else {
        this.current.patientName = nameField.trim();
      }
    }

    // Some Erba models put sample ID in field 3 (index 3)
    if (!this.current.sampleId && fields[3]) {
      this.current.sampleId = fields[3].trim();
    }

    console.log('[astm] Patient frame — sampleId:', this.current.sampleId, 'name:', this.current.patientName);
    return null;
  }

  parseOrder(line) {
    // O|1|SAMPLE_ID||^^TEST_CODE^...
    const fields = line.split('|');
    // Sample ID in field 3 (index 2)
    if (!this.current.sampleId && fields[2]) {
      this.current.sampleId = fields[2].trim();
    }
    console.log('[astm] Order frame — sampleId:', this.current.sampleId);
    return null;
  }

  parseResult(line) {
    // R|1|^^TEST_CODE^||VALUE|UNIT|REF_LOW-REF_HIGH|FLAG|...
    const fields = line.split('|');
    
    // Test code is in field 3 (index 2), format: ^^TEST_CODE^ or ^^TEST_CODE^SPECIMEN
    const testField = fields[2] || '';
    const testParts = testField.split('^').filter(p => p.trim());
    // Usually: ['', '', 'TEST_CODE', ''] or ['', '', 'TEST_CODE', 'SPECIMEN']
    let testCode = '';
    for (let i = 0; i < testParts.length; i++) {
      if (testParts[i] && i >= 2) {
        testCode = testParts[i];
        break;
      }
    }
    // Fallback: take the 3rd element
    if (!testCode && testParts.length >= 3) {
      testCode = testParts[2];
    }
    if (!testCode) {
      testCode = testField.replace(/\^/g, '').trim();
    }

    // Value is in field 4 (index 3)
    const value = fields[3] ? fields[3].trim() : '';
    
    // Unit is in field 5 (index 4)
    const unit = fields[4] ? fields[4].trim() : '';
    
    // Reference range is in field 6 (index 5), format: LOW-HIGH
    const refRange = fields[5] ? fields[5].trim() : '';
    let refLow = null, refHigh = null;
    if (refRange && refRange.includes('-')) {
      const parts = refRange.split('-');
      refLow = parts[0] ? parts[0].trim() : null;
      refHigh = parts[1] ? parts[1].trim() : null;
    }

    // Abnormal flag is in field 7 (index 6): N=normal, H=high, L=low, HH=very high, LL=very low
    const flag = fields[6] ? fields[6].trim() : '';

    // Map test code to friendly name
    const testCodeUpper = testCode.toUpperCase();
    const testName = TEST_CODE_MAP[testCodeUpper] || testCode;

    if (testCode && value) {
      const result = {
        testCode: testCodeUpper,
        testName: testName,
        value: value,
        unit: unit,
        refLow: refLow,
        refHigh: refHigh,
        flag: flag,
        isAbnormal: flag === 'H' || flag === 'L' || flag === 'HH' || flag === 'LL',
      };
      this.current.results.push(result);
      console.log('[astm] Result:', testName, '=', value, unit, flag ? `[${flag}]` : '');
    }

    return null;
  }

  parseTerminator(line) {
    // L|1|N — end of transmission
    console.log('[astm] Terminator frame — message complete');
    const result = {
      sampleId: this.current.sampleId,
      patientName: this.current.patientName,
      results: [...this.current.results],
      raw: [...this.current.raw],
      timestamp: new Date().toISOString(),
    };
    this.reset();
    return result;
  }

  parseQuery(line) {
    // Q|1|^SAMPLE_ID||||||O — analyzer is querying for test orders
    const fields = line.split('|');
    const querySampleId = fields[2] ? fields[2].replace(/\^/g, '').trim() : null;
    console.log('[astm] Query frame — analyzer requesting orders for sample:', querySampleId);
    return { type: 'query', sampleId: querySampleId };
  }
}

module.exports = { ASTMParser, TEST_CODE_MAP };
