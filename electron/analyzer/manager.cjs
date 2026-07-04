/**
 * Analyzer Manager Service
 *
 * Manages all analyzer connections in the Electron app.
 * - Lists available COM ports
 * - Connects/disconnects analyzers
 * - Receives parsed results and forwards to renderer via callback
 * - Maintains connection state across the app lifecycle
 */

const { AnalyzerConnection } = require('./connection.cjs');
const { ASTMParser } = require('./astm-parser.cjs');
const { HL7Parser } = require('./hl7-parser.cjs');
const registry = require('./registry.cjs');

class AnalyzerManager {
  constructor() {
    this.connections = new Map(); // id -> AnalyzerConnection
    this.onResultCallback = null;
    this.onStatusCallback = null;
  }

  /**
   * Set callback for when results are received from any analyzer.
   */
  setResultCallback(cb) {
    this.onResultCallback = cb;
  }

  setStatusCallback(cb) {
    this.onStatusCallback = cb;
  }

  /**
   * List all available serial ports on the system.
   */
  async listPorts() {
    try {
      const { SerialPort } = require('serialport');
      const ports = await SerialPort.list();
      return ports.map(p => ({
        path: p.path,
        manufacturer: p.manufacturer || '',
        vendorId: p.vendorId || '',
        productId: p.productId || '',
        pnpId: p.pnpId || '',
      }));
    } catch (e) {
      return [];
    }
  }

  /**
   * Get all registered analyzers from the registry.
   */
  getAnalyzers() {
    return registry.ANALYZERS;
  }

  getAnalyzersByCategory() {
    return registry.getByCategory();
  }

  getAnalyzersByBrand() {
    return registry.getByBrand();
  }

  getAnalyzerById(id) {
    return registry.getById(id);
  }

  getBrands() {
    return registry.getBrands();
  }

  getCategories() {
    return registry.getCategories();
  }

  /**
   * Connect to an analyzer.
   * @param {Object} config - Connection configuration
   * @param {string} config.analyzerId - Analyzer registry ID
   * @param {string} config.transport - 'serial' | 'tcp'
   * @param {string} [config.serialPort] - COM port (for serial)
   * @param {string} [config.tcpHost] - TCP host (for tcp)
   * @param {number} [config.tcpPort] - TCP port (for tcp)
   * @param {Object} [config.serialSettings] - Override serial settings
   */
  connect(config) {
    const analyzer = registry.getById(config.analyzerId);
    if (!analyzer) {
      throw new Error(`Unknown analyzer: ${config.analyzerId}`);
    }

    const connId = `${config.analyzerId}-${Date.now()}`;

    const connConfig = {
      id: connId,
      analyzerId: config.analyzerId,
      brand: analyzer.brand,
      model: analyzer.model,
      protocol: analyzer.protocol,
      transport: config.transport || analyzer.transport,
      serialPort: config.serialPort || 'COM1',
      serialSettings: config.serialSettings || analyzer.serialSettings,
      tcpHost: config.tcpHost || '127.0.0.1',
      tcpPort: config.tcpPort || analyzer.tcpPort || 5000,
    };

    const conn = new AnalyzerConnection(connConfig);

    // Set up parser based on protocol
    if (analyzer.protocol === 'astm') {
      conn.parser = new ASTMParser();
    } else if (analyzer.protocol === 'hl7') {
      conn.parser = new HL7Parser();
    } else if (analyzer.protocol === 'file') {
      // File-based analyzers don't use connections
      throw new Error('File-based analyzers use importFile() instead of connect()');
    } else {
      conn.parser = new ASTMParser(); // Default to ASTM
    }

    // Forward events
    conn.on('result', (result) => {
      const enriched = {
        ...result,
        connectionId: connId,
        analyzerId: config.analyzerId,
        brand: analyzer.brand,
        model: analyzer.model,
        category: analyzer.category,
      };
      if (this.onResultCallback) this.onResultCallback(enriched);
    });

    conn.on('status', (status) => {
      if (this.onStatusCallback) {
        this.onStatusCallback(conn.getStatus());
      }
    });

    conn.on('error', (err) => {
      console.error(`[AnalyzerManager] Connection ${connId} error:`, err.message);
    });

    this.connections.set(connId, conn);
    conn.connect();

    return connId;
  }

  /**
   * Disconnect from an analyzer.
   */
  disconnect(connId) {
    const conn = this.connections.get(connId);
    if (!conn) return false;
    conn.disconnect();
    this.connections.delete(connId);
    return true;
  }

  /**
   * Disconnect all analyzers.
   */
  disconnectAll() {
    for (const [id, conn] of this.connections) {
      conn.disconnect();
    }
    this.connections.clear();
  }

  /**
   * Get status of all connections.
   */
  getAllStatus() {
    const statuses = [];
    for (const conn of this.connections.values()) {
      statuses.push(conn.getStatus());
    }
    return statuses;
  }

  /**
   * Get a specific connection's status.
   */
  getStatus(connId) {
    const conn = this.connections.get(connId);
    return conn ? conn.getStatus() : null;
  }

  /**
   * Import results from a file (for file-based analyzers like ELISA readers).
   */
  async importFile(filePath) {
    const fs = require('fs');
    const path = require('path');

    const ext = path.extname(filePath).toLowerCase();
    let content;

    if (ext === '.csv' || ext === '.txt') {
      content = fs.readFileSync(filePath, 'utf8');
      return this.parseCSVResults(content);
    } else if (ext === '.xml') {
      content = fs.readFileSync(filePath, 'utf8');
      return this.parseXMLResults(content);
    } else {
      // Try CSV first
      content = fs.readFileSync(filePath, 'utf8');
      try {
        return this.parseCSVResults(content);
      } catch (e) {
        return this.parseXMLResults(content);
      }
    }
  }

  /**
   * Parse CSV-format results (common from ELISA readers and semi-auto analyzers).
   * Expected format: TestName,Value,Unit,RefRange or PatientID,TestName,Value,Unit
   */
  parseCSVResults(content) {
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    const results = [];
    let patientId = '';
    let patientName = '';

    for (let i = 0; i < lines.length; i++) {
      const cols = lines[i].split(/[,;\t]/).map(c => c.trim());

      // Try to detect header
      if (i === 0 && /test|patient|sample/i.test(cols[0]) && /result|value/i.test(cols[1] || '')) {
        continue; // Skip header
      }

      // Detect patient info line
      if (/patient|name|id/i.test(cols[0]) && cols.length >= 2) {
        if (/id/i.test(cols[0])) patientId = cols[1];
        if (/name/i.test(cols[0])) patientName = cols[1];
        continue;
      }

      // Parse result line: TestName, Value, Unit, RefRange
      if (cols.length >= 2) {
        results.push({
          type: 'result',
          testCode: cols[0] || '',
          testName: cols[0] || '',
          value: cols[1] || '',
          unit: cols[2] || '',
          refRange: cols[3] || '',
          abnormalFlag: cols[4] || '',
        });
      }
    }

    return {
      timestamp: new Date().toISOString(),
      patient: patientId || patientName ? { patientId, patientName } : null,
      results,
      raw: content,
    };
  }

  /**
   * Parse XML-format results (some analyzers export XML).
   */
  parseXMLResults(content) {
    const results = [];

    // Simple XML extraction (avoid external dependencies)
    const testMatches = content.matchAll(/<(?:Test|Result|Parameter)[^>]*>([\s\S]*?)<\/(?:Test|Result|Parameter)>/gi);
    for (const match of testMatches) {
      const block = match[1];
      const name = block.match(/<(?:Name|TestName|ParameterName)>(.*?)</i)?.[1] || '';
      const value = block.match(/<(?:Value|Result|ResultValue)>(.*?)</i)?.[1] || '';
      const unit = block.match(/<(?:Unit|Units)>(.*?)</i)?.[1] || '';
      const refRange = block.match(/<(?:RefRange|ReferenceRange|NormalRange)>(.*?)</i)?.[1] || '';

      if (name && value) {
        results.push({
          type: 'result',
          testCode: name,
          testName: name,
          value,
          unit,
          refRange,
          abnormalFlag: '',
        });
      }
    }

    // Extract patient info
    const patientId = content.match(/<(?:PatientID|PatientId|ID)>(.*?)</i)?.[1] || '';
    const patientName = content.match(/<(?:PatientName|Name)>(.*?)</i)?.[1] || '';

    return {
      timestamp: new Date().toISOString(),
      patient: patientId || patientName ? { patientId, patientName } : null,
      results,
      raw: content,
    };
  }
}

// Singleton
const manager = new AnalyzerManager();

module.exports = { AnalyzerManager, analyzerManager: manager };
