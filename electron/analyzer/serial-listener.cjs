const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const EventEmitter = require('events');

let activePorts = {};

/**
 * List all available serial ports on the system
 */
async function listPorts() {
  try {
    const ports = await SerialPort.list();
    return ports.map(p => ({
      path: p.path,
      manufacturer: p.manufacturer || 'Unknown',
      vendorId: p.vendorId || '',
      productId: p.productId || '',
    }));
  } catch (err) {
    console.error('[analyzer] Error listing ports:', err.message);
    return [];
  }
}

/**
 * Start listening on a COM port for ASTM data from Erba Chem 7
 * @param {string} portPath - e.g., 'COM3'
 * @param {number} baudRate - e.g., 9600
 * @param {function} onData - callback(rawString) when a complete ASTM message is received
 * @param {function} onError - callback(errMessage) on error
 * @param {function} onStatus - callback(status) on connection status change
 * @returns {boolean} success
 */
function startListening(portPath, baudRate, onData, onError, onStatus) {
  if (activePorts[portPath]) {
    closePort(portPath);
  }

  try {
    const port = new SerialPort({
      path: portPath,
      baudRate: baudRate || 9600,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      autoOpen: false,
    });

    // ASTM uses specific framing — we accumulate raw data and detect message boundaries
    let buffer = '';

    port.open((err) => {
      if (err) {
        console.error(`[analyzer] Error opening ${portPath}:`, err.message);
        if (onError) onError(err.message);
        if (onStatus) onStatus('error');
        return;
      }
      console.log(`[analyzer] Listening on ${portPath} at ${baudRate} baud`);
      if (onStatus) onStatus('connected');
    });

    // Raw data mode — accumulate and split by ASTM message boundaries
    port.on('data', (data) => {
      buffer += data.toString('ascii');

      // ASTM messages start with <STX> (0x02) and end with <ETX> (0x03) or <EOT> (0x04)
      // Many Erba analyzers send line-by-line with <CR> or <LF> delimiters
      // We look for complete frames

      // Split by ETX (0x03) which marks end of each ASTM frame
      while (true) {
        const stxIdx = buffer.indexOf('\x02');
        if (stxIdx === -1) {
          // No STX found — try splitting by newlines (some analyzers use plain text)
          const newlineIdx = buffer.indexOf('\n');
          if (newlineIdx === -1) break;
          const line = buffer.substring(0, newlineIdx).replace(/\r/g, '').trim();
          buffer = buffer.substring(newlineIdx + 1);
          if (line.length > 0 && onData) onData(line);
          continue;
        }

        const etxIdx = buffer.indexOf('\x03', stxIdx);
        if (etxIdx === -1) break; // Wait for more data

        // Extract frame from STX to ETX (inclusive)
        const frame = buffer.substring(stxIdx, etxIdx + 1);
        buffer = buffer.substring(etxIdx + 1);

        // Extract the actual content between STX and ETX
        const content = frame.substring(1, frame.length - 1);
        if (content.length > 0 && onData) onData(content);
      }
    });

    port.on('error', (err) => {
      console.error(`[analyzer] Port ${portPath} error:`, err.message);
      if (onError) onError(err.message);
      if (onStatus) onStatus('error');
    });

    port.on('close', () => {
      console.log(`[analyzer] Port ${portPath} closed`);
      if (onStatus) onStatus('disconnected');
    });

    activePorts[portPath] = port;
    return true;
  } catch (err) {
    console.error(`[analyzer] Failed to start ${portPath}:`, err.message);
    if (onError) onError(err.message);
    return false;
  }
}

/**
 * Close a specific port
 */
function closePort(portPath) {
  if (activePorts[portPath]) {
    try {
      activePorts[portPath].close();
    } catch (e) { /* ignore */ }
    delete activePorts[portPath];
    return true;
  }
  return false;
}

/**
 * Close all active ports
 */
function closeAllPorts() {
  for (const path of Object.keys(activePorts)) {
    closePort(path);
  }
}

/**
 * Check if a port is currently active
 */
function isListening(portPath) {
  return !!activePorts[portPath];
}

module.exports = {
  listPorts,
  startListening,
  closePort,
  closeAllPorts,
  isListening,
};
