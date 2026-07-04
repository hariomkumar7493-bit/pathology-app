/**
 * Analyzer Connection Manager
 *
 * Manages serial port and TCP connections to lab analyzers.
 * Uses 'serialport' for RS232 connections and 'net' for TCP.
 *
 * Each connection:
 * - Connects to analyzer on COM port or TCP address
 * - Feeds raw data to protocol parser (ASTM or HL7)
 * - Emits 'result' events with parsed data
 * - Handles reconnection and error recovery
 */

const { EventEmitter } = require('events');
const net = require('net');

class AnalyzerConnection extends EventEmitter {
  constructor(config) {
    super();
    this.id = config.id;
    this.analyzerId = config.analyzerId;
    this.brand = config.brand;
    this.model = config.model;
    this.protocol = config.protocol; // 'astm' | 'hl7'
    this.transport = config.transport; // 'serial' | 'tcp'
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error'
    this.lastResult = null;
    this.lastError = null;
    this.connection = null;
    this.parser = null;
    this.reconnectTimer = null;
    this.reconnectDelay = 5000;
    this.autoReconnect = true;

    // Serial settings
    this.serialPort = config.serialPort || 'COM1';
    this.serialSettings = config.serialSettings || { baudRate: 9600, dataBits: 8, parity: 'none', stopBits: 1 };

    // TCP settings
    this.tcpHost = config.tcpHost || '127.0.0.1';
    this.tcpPort = config.tcpPort || 5000;
  }

  async connect() {
    if (this.status === 'connected' || this.status === 'connecting') return;

    this.status = 'connecting';
    this.emit('status', this.status);

    try {
      if (this.transport === 'serial') {
        await this.connectSerial();
      } else if (this.transport === 'tcp') {
        this.connectTCP();
      }
    } catch (err) {
      this.status = 'error';
      this.lastError = err.message;
      this.emit('error', err);
      this.scheduleReconnect();
    }
  }

  async connectSerial() {
    let SerialPort;
    try {
      SerialPort = require('serialport').SerialPort;
    } catch (e) {
      throw new Error('serialport package not installed. Run: npm install serialport');
    }

    return new Promise((resolve, reject) => {
      this.connection = new SerialPort({
        path: this.serialPort,
        ...this.serialSettings,
        autoOpen: false,
      });

      this.connection.open((err) => {
        if (err) {
          reject(new Error(`Cannot open ${this.serialPort}: ${err.message}`));
          return;
        }
        this.status = 'connected';
        this.lastError = null;
        this.emit('status', this.status);
        this.emit('connected', { port: this.serialPort, settings: this.serialSettings });

        this.connection.on('data', (data) => this.handleData(data));
        this.connection.on('error', (err) => this.handleError(err));
        this.connection.on('close', () => this.handleDisconnect());
        resolve();
      });
    });
  }

  connectTCP() {
    this.connection = net.createConnection({
      host: this.tcpHost,
      port: this.tcpPort,
    });

    this.connection.setTimeout(0); // No timeout for continuous listening

    this.connection.on('connect', () => {
      this.status = 'connected';
      this.lastError = null;
      this.emit('status', this.status);
      this.emit('connected', { host: this.tcpHost, port: this.tcpPort });
    });

    this.connection.on('data', (data) => this.handleData(data));
    this.connection.on('error', (err) => this.handleError(err));
    this.connection.on('close', () => this.handleDisconnect());
    this.connection.on('timeout', () => this.handleError(new Error('TCP timeout')));
  }

  handleData(data) {
    if (!this.parser) {
      this.emit('raw', data);
      return;
    }

    // Send ACK for ASTM ENQ
    if (this.protocol === 'astm' && data.length > 0 && data[0] === 0x05) {
      // ENQ received — send ACK
      if (this.connection && this.connection.write) {
        if (this.transport === 'serial') {
          this.connection.write(Buffer.from([0x06]));
        }
      }
    }

    const results = this.parser.feed(data);

    for (const result of results) {
      this.lastResult = result;
      this.emit('result', result);

      // Send ACK/NAK back for HL7
      if (this.protocol === 'hl7' && this.connection && this.connection.write) {
        const ack = require('./hl7-parser.cjs').HL7Parser.buildACK(Date.now().toString());
        this.connection.write(ack);
      }

      // Send EOT acknowledgment for ASTM
      if (this.protocol === 'astm' && this.connection && this.connection.write) {
        if (this.transport === 'serial') {
          this.connection.write(Buffer.from([0x06])); // ACK
        }
      }
    }

    // Also emit raw for debugging
    this.emit('raw', data);
  }

  handleError(err) {
    this.status = 'error';
    this.lastError = err.message;
    this.emit('error', err);
    this.emit('status', this.status);
    this.scheduleReconnect();
  }

  handleDisconnect() {
    if (this.status === 'connected') {
      this.status = 'disconnected';
      this.emit('status', this.status);
      this.emit('disconnected');
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (!this.autoReconnect) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.status !== 'connected' && this.status !== 'connecting') {
        this.connect().catch(() => {});
      }
    }, this.reconnectDelay);
  }

  disconnect() {
    this.autoReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connection) {
      if (this.transport === 'serial') {
        this.connection.close(() => {});
      } else {
        this.connection.destroy();
      }
      this.connection = null;
    }
    this.status = 'disconnected';
    this.emit('status', this.status);
  }

  getStatus() {
    return {
      id: this.id,
      analyzerId: this.analyzerId,
      brand: this.brand,
      model: this.model,
      status: this.status,
      transport: this.transport,
      serialPort: this.serialPort,
      tcpHost: this.tcpHost,
      tcpPort: this.tcpPort,
      protocol: this.protocol,
      lastResult: this.lastResult ? this.lastResult.timestamp : null,
      lastError: this.lastError,
    };
  }
}

module.exports = { AnalyzerConnection };
