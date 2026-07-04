/**
 * Universal HL7 v2 Protocol Parser
 *
 * Parses HL7 v2 ORU^R01 (Observation Result) messages from lab analyzers.
 * Works with any HL7-compliant analyzer:
 * - Sysmex, Beckman Coulter, Siemens, Abbott, Mindray (high-end models), etc.
 *
 * HL7 Message Structure:
 *   MSH|^~\&|Analyzer|Lab|||20240101120000||ORU^R01|MsgID|P|2.3
 *   PID|||PatientID||PatientName||DOB|Sex|
 *   OBR|1||SampleID|^^^TestPanel|||||CollectionTime|||||||Specimen
 *   OBX|1|NM|TestCode^TestName||Value^Unit^RefRange|AbnormalFlag|||N
 *
 * Low-level protocol:
 *   MLLP framing: [VT] message [FS] CR  (0x0B ... 0x1C 0x0D)
 */

const VT = 0x0B;  // Vertical Tab - start of message
const FS = 0x1C;  // File Separator - end of message
const CR = 0x0D;  // Carriage Return

class HL7Parser {
  constructor() {
    this.buffer = Buffer.alloc(0);
  }

  /**
   * Feed raw bytes from TCP socket or serial port.
   * Returns array of complete parsed messages.
   */
  feed(data) {
    if (Buffer.isBuffer(data)) {
      this.buffer = Buffer.concat([this.buffer, data]);
    } else if (typeof data === 'string') {
      this.buffer = Buffer.concat([this.buffer, Buffer.from(data, 'utf8')]);
    }

    const messages = [];

    while (this.buffer.length > 0) {
      // Find start byte (VT)
      let startIdx = this.buffer.indexOf(VT);
      if (startIdx === -1) {
        // No start byte, clear buffer
        this.buffer = Buffer.alloc(0);
        break;
      }

      // Find end sequence (FS + CR)
      let endIdx = -1;
      for (let i = startIdx + 1; i < this.buffer.length - 1; i++) {
        if (this.buffer[i] === FS && this.buffer[i + 1] === CR) {
          endIdx = i;
          break;
        }
      }

      if (endIdx === -1) {
        // Incomplete message, keep buffer from startIdx
        if (startIdx > 0) {
          this.buffer = this.buffer.slice(startIdx);
        }
        break;
      }

      // Extract message between VT and FS+CR
      const msgStr = this.buffer.slice(startIdx + 1, endIdx).toString('utf8');
      const parsed = this.parseMessage(msgStr);
      if (parsed) messages.push(parsed);

      // Move buffer past this message
      this.buffer = this.buffer.slice(endIdx + 2);
    }

    return messages;
  }

  /**
   * Parse an HL7 message string into structured data.
   */
  parseMessage(message) {
    if (!message || !message.trim()) return null;

    const segments = message.split(/\r\n|\r|\n/).filter(s => s.trim());
    if (segments.length === 0) return null;

    const result = {
      timestamp: new Date().toISOString(),
      messageType: '',
      analyzer: '',
      patient: null,
      orders: [],
      results: [],
      raw: message,
    };

    // Field separators and encoding chars from MSH
    let fieldSep = '|';
    let compSep = '^';
    let repSep = '~';
    let escChar = '\\';
    let subCompSep = '&';

    for (const seg of segments) {
      if (!seg || seg.length < 3) continue;

      const segType = seg.substring(0, 3);
      const fields = seg.split(fieldSep);

      switch (segType) {
        case 'MSH':
          // MSH|^~\&|Sender|Facility|Receiver|Facility|DateTime||Type^Event|ID||Version
          fieldSep = seg[3] || '|';
          compSep = seg[4] || '^';
          repSep = seg[5] || '~';
          escChar = seg[6] || '\\';
          subCompSep = seg[7] || '&';

          result.analyzer = fields[3] || '';
          result.messageType = (fields[8] || '').split('^')[0] + '^' + (fields[8] || '').split('^')[1];
          result.timestamp = this.parseHL7Timestamp(fields[6] || '');
          break;

        case 'PID':
          result.patient = this.parsePID(fields, compSep);
          break;

        case 'OBR':
          result.orders.push(this.parseOBR(fields, compSep));
          break;

        case 'OBX':
          result.results.push(this.parseOBX(fields, compSep));
          break;

        case 'NTE':
          // Comment segment
          if (!result.comments) result.comments = [];
          result.comments.push(fields[3] || '');
          break;
      }
    }

    return result;
  }

  parsePID(fields, compSep) {
    // PID|||PatientID||Name||DOB|Sex||Address||Phone
    const nameField = fields[5] || '';
    const nameParts = nameField.split(compSep);

    return {
      type: 'patient',
      patientId: fields[3] || '',
      patientName: this.formatHL7Name(nameField, compSep),
      lastName: nameParts[0] || '',
      firstName: nameParts[1] || '',
      middleName: nameParts[2] || '',
      dob: this.parseHL7Date(fields[7] || ''),
      sex: fields[8] || '',
      address: fields[11] || '',
      phone: fields[13] || '',
      age: '',
    };
  }

  parseOBR(fields, compSep) {
    // OBR|1||SampleID|^^^TestPanel|||||CollectionTime|||||||Specimen
    const testField = fields[4] || '';
    const testParts = testField.split(compSep);

    return {
      type: 'order',
      sampleId: fields[3] || '',
      testCode: testParts[3] || testParts[0] || '',
      testName: testParts[1] || '',
      collectionTime: this.parseHL7Timestamp(fields[7] || ''),
      specimen: fields[15] || '',
    };
  }

  parseOBX(fields, compSep) {
    // OBX|1|NM|TestCode^TestName||Value^Unit^RefRange|AbnormalFlag|||N
    const testField = fields[3] || '';
    const testParts = testField.split(compSep);
    const testCode = testParts[0] || '';
    const testName = testParts[1] || '';

    const valueField = fields[5] || '';
    const unit = fields[6] || '';
    const refRange = fields[7] || '';
    const abnormalFlag = fields[8] || '';

    return {
      type: 'result',
      testCode,
      testName,
      value: valueField,
      unit,
      refRange,
      abnormalFlag,
      resultStatus: fields[11] || '',
    };
  }

  formatHL7Name(nameField, compSep) {
    if (!nameField) return '';
    const parts = nameField.split(compSep);
    // Last^First^Middle
    if (parts.length >= 2) {
      return [parts[1], parts[0]].filter(Boolean).join(' ').trim();
    }
    return nameField;
  }

  parseHL7Timestamp(ts) {
    if (!ts) return '';
    // YYYYMMDDHHMMSS or YYYYMMDDHHMM
    if (ts.length >= 8) {
      const y = ts.substring(0, 4);
      const m = ts.substring(4, 6);
      const d = ts.substring(6, 8);
      const h = ts.substring(8, 10) || '00';
      const min = ts.substring(10, 12) || '00';
      return `${y}-${m}-${d}T${h}:${min}:00`;
    }
    return ts;
  }

  parseHL7Date(dt) {
    if (!dt) return '';
    if (dt.length >= 8) {
      return `${dt.substring(0, 4)}-${dt.substring(4, 6)}-${dt.substring(6, 8)}`;
    }
    return dt;
  }

  /**
   * Build MLLP-framed acknowledgment message.
   */
  static buildACK(messageId) {
    const ack = `MSH|^~\\&|PathoLabPro|Lab||||${this.nowHL7()}||ACK^${messageId || 'ACK'}|1|P|2.3\rMSA|AA|${messageId || ''}\r`;
    return Buffer.concat([Buffer.from([VT]), Buffer.from(ack, 'utf8'), Buffer.from([FS, CR])]);
  }

  static buildNAK(messageId) {
    const nak = `MSH|^~\\&|PathoLabPro|Lab||||${this.nowHL7()}||ACK^${messageId || 'ACK'}|1|P|2.3\rMSA|AE|${messageId || ''}\r`;
    return Buffer.concat([Buffer.from([VT]), Buffer.from(nak, 'utf8'), Buffer.from([FS, CR])]);
  }

  static nowHL7() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }
}

module.exports = { HL7Parser };
