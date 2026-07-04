/**
 * Universal ASTM E1381/E1394 Protocol Parser
 *
 * Parses ASTM frames from lab analyzers to extract patient demographics
 * and test results. Works with any ASTM-compliant analyzer:
 * - Mindray, Erba, Sysmex, Horiba, Transasia, Rayto, Roche, Beckman, etc.
 *
 * ASTM Frame Structure:
 *   Frame: [STX] FN data [ETX] CR [checksum]
 *   Header: H|\\^&|||Analyzer|||||||P|1|YYYYMMDDHHMMSS
 *   Patient: P|1||PatientID||PatientName||Age|Sex||||
 *   Order: O|1|SampleID||^^^TestCode|R|||||||||||Specimen
 *   Result: R|1|^^^TestCode^||Value^Unit^RefRange|AbnormalFlag|||N
 *   Terminator: L|1|N [ETX]
 *
 * Low-level protocol (E1381):
 *   ENQ → ACK → frames → EOT
 */

const STX = 0x02; // Start of Text
const ETX = 0x03; // End of Text
const EOT = 0x04; // End of Transmission
const ENQ = 0x05; // Enquiry
const ACK = 0x06; // Acknowledge
const NAK = 0x15; // Negative Acknowledge
const ETB = 0x17; // End of Transmission Block
const CR = 0x0D; // Carriage Return
const LF = 0x0A; // Line Feed

class ASTMParser {
  constructor() {
    this.buffer = Buffer.alloc(0);
    this.frames = [];
    this.transmissions = [];
  }

  /**
   * Feed raw bytes from serial port or TCP socket.
   * Returns array of complete transmissions (each is array of parsed records).
   */
  feed(data) {
    if (Buffer.isBuffer(data)) {
      this.buffer = Buffer.concat([this.buffer, data]);
    } else if (typeof data === 'string') {
      this.buffer = Buffer.concat([this.buffer, Buffer.from(data, 'utf8')]);
    }

    const completed = [];
    while (this.buffer.length > 0) {
      const byte = this.buffer[0];

      if (byte === ENQ) {
        this.buffer = this.buffer.slice(1);
        this.frames = [];
        // Caller should send ACK back
      } else if (byte === STX) {
        // Find end of frame (ETX or ETB followed by CR + checksum)
        let endIdx = -1;
        let frameEndByte = ETX;
        for (let i = 1; i < this.buffer.length; i++) {
          if (this.buffer[i] === ETX || this.buffer[i] === ETB) {
            frameEndByte = this.buffer[i];
            // Check for CR + checksum after
            if (i + 2 < this.buffer.length && this.buffer[i + 1] === CR) {
              endIdx = i;
            }
            break;
          }
        }
        if (endIdx === -1) break; // Need more data

        // Extract frame data (between STX and ETX/ETB)
        const frameData = this.buffer.slice(1, endIdx).toString('ascii');
        this.frames.push(frameData);

        // Move buffer past this frame (STX + data + ETX/ETB + CR + 2 checksum chars + CR/LF)
        const skipBytes = endIdx + 1 + 2 + 1; // ETX pos + CR + 2 checksum + CR
        this.buffer = this.buffer.slice(Math.min(skipBytes, this.buffer.length));
      } else if (byte === EOT) {
        this.buffer = this.buffer.slice(1);
        // Process collected frames into a transmission
        if (this.frames.length > 0) {
          const transmission = this.parseFrames(this.frames);
          completed.push(transmission);
          this.frames = [];
        }
      } else if (byte === ACK || byte === NAK || byte === LF || byte === CR) {
        // Control characters to skip
        this.buffer = this.buffer.slice(1);
      } else {
        // Unknown byte, skip
        this.buffer = this.buffer.slice(1);
      }
    }

    return completed;
  }

  /**
   * Parse collected ASTM frames into structured data.
   */
  parseFrames(frames) {
    const records = [];
    for (const frame of frames) {
      // Each frame may contain multiple records separated by CR or LF
      const lines = frame.split(/[\r\n]+/);
      for (const line of lines) {
        if (!line.trim()) continue;
        const record = this.parseRecord(line.trim());
        if (record) records.push(record);
      }
    }
    return this.buildResult(records);
  }

  /**
   * Parse a single ASTM record line.
   * Format: RecordType|field|field|field...
   */
  parseRecord(line) {
    if (!line || line.length === 0) return null;
    const recordType = line[0];
    const fields = line.split('|');

    switch (recordType) {
      case 'H':
        return this.parseHeader(fields);
      case 'P':
        return this.parsePatient(fields);
      case 'O':
        return this.parseOrder(fields);
      case 'R':
        return this.parseResult(fields);
      case 'C':
        return this.parseComment(fields);
      case 'Q':
        return this.parseQuery(fields);
      case 'L':
        return { type: 'terminator', raw: line };
      default:
        return { type: 'unknown', recordType, raw: line, fields };
    }
  }

  parseHeader(fields) {
    // H|\^&|||SenderID|||||||ReceiverID||P|1|YYYYMMDDHHMMSS
    return {
      type: 'header',
      sender: fields[4] || '',
      receiver: fields[10] || '',
      processingId: fields[13] || '',
      version: fields[14] || '',
      timestamp: fields[15] || '',
      raw: fields.join('|'),
    };
  }

  parsePatient(fields) {
    // P|1||PatientID||PatientName||Age|Sex|||||
    const nameFields = (fields[5] || '').split('^');
    return {
      type: 'patient',
      sequence: fields[1] || '',
      patientId: fields[3] || '',
      patientName: this.formatName(fields[5] || ''),
      lastName: nameFields[0] || '',
      firstName: nameFields[1] || '',
      middleName: nameFields[2] || '',
      age: fields[7] || '',
      ageUnit: fields[8] || '',
      sex: fields[9] || '',
      dob: fields[12] || '',
      phone: fields[13] || '',
      raw: fields.join('|'),
    };
  }

  parseOrder(fields) {
    // O|1|SampleID||^^^TestCode|R|||||||||||Specimen
    const sampleId = fields[2] || '';
    const specimen = fields[15] || '';
    const testOrders = [];

    // fields[3] can contain multiple test codes separated by \
    const testField = fields[3] || '';
    if (testField) {
      const tests = testField.split('\\');
      for (const t of tests) {
        // Format: ^^^TestCode or ^^^TestCode^Dilution
        const parts = t.split('^');
        const testCode = parts[3] || parts[0] || '';
        if (testCode) testOrders.push(testCode);
      }
    }

    return {
      type: 'order',
      sequence: fields[1] || '',
      sampleId,
      testOrders,
      priority: fields[5] || '',
      specimen,
      timestamp: fields[6] || '',
      raw: fields.join('|'),
    };
  }

  parseResult(fields) {
    // R|1|^^^TestCode^||Value^Unit^RefRange|AbnormalFlag|||N
    const testField = fields[2] || '';
    const testParts = testField.split('^');
    const testCode = testParts[3] || testParts[0] || '';

    // Result value field: Value^Unit^RefRange or just Value
    const valueField = fields[3] || '';
    const valueParts = valueField.split('^');
    const value = valueParts[0] || '';
    const unit = valueParts[1] || '';
    const refRange = valueParts[2] || '';

    const abnormalFlag = fields[4] || '';
    const resultType = fields[8] || '';

    return {
      type: 'result',
      sequence: fields[1] || '',
      testCode,
      value,
      unit,
      refRange,
      abnormalFlag,
      resultType,
      raw: fields.join('|'),
    };
  }

  parseComment(fields) {
    // C|1||Comment text|||
    return {
      type: 'comment',
      sequence: fields[1] || '',
      comment: fields[3] || '',
      raw: fields.join('|'),
    };
  }

  parseQuery(fields) {
    // Q|1|^SampleID||ALL||||||O
    return {
      type: 'query',
      sequence: fields[1] || '',
      sampleId: (fields[2] || '').replace('^', ''),
      raw: fields.join('|'),
    };
  }

  formatName(nameField) {
    if (!nameField) return '';
    const parts = nameField.split('^');
    // Last^First^Middle
    if (parts.length >= 2) {
      return [parts[1], parts[0]].filter(Boolean).join(' ').trim();
    }
    return nameField;
  }

  /**
   * Build final result object from parsed records.
   */
  buildResult(records) {
    const result = {
      timestamp: new Date().toISOString(),
      analyzer: '',
      patient: null,
      orders: [],
      results: [],
      comments: [],
      raw: records.map(r => r.raw).join('\n'),
    };

    for (const rec of records) {
      switch (rec.type) {
        case 'header':
          result.analyzer = rec.sender;
          break;
        case 'patient':
          result.patient = rec;
          break;
        case 'order':
          result.orders.push(rec);
          break;
        case 'result':
          result.results.push(rec);
          break;
        case 'comment':
          result.comments.push(rec);
          break;
      }
    }

    return result;
  }

  /**
   * Get ACK byte for sending back to analyzer.
   */
  static get ACK() { return Buffer.from([ACK]); }
  static get NAK() { return Buffer.from([NAK]); }
  static get ENQ() { return Buffer.from([ENQ]); }
  static get EOT() { return Buffer.from([EOT]); }
}

module.exports = { ASTMParser, ASTMParser: ASTMParser };
