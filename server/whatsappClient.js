const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

let client = null;
let isReady = false;
let lastQR = null;
let initPromise = null;

function initClient() {
  if (initPromise) return initPromise;
  if (client) return Promise.resolve(client);

  initPromise = new Promise((resolve, reject) => {
    try {
      client = new Client({
        authStrategy: new LocalAuth({
          dataPath: path.join(__dirname, '.wwebjs_auth'),
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
          ],
        },
      });

      client.on('qr', (qr) => {
        lastQR = qr;
        qrcode.generate(qr, { small: true });
        console.log('[WhatsApp] QR code generated. Scan it in WhatsApp > Linked Devices.');
      });

      client.on('ready', () => {
        isReady = true;
        lastQR = null;
        console.log('[WhatsApp] Client is ready and connected.');
        resolve(client);
      });

      client.on('authenticated', () => {
        console.log('[WhatsApp] Authenticated successfully.');
      });

      client.on('auth_failure', (msg) => {
        console.error('[WhatsApp] Auth failure:', msg);
        reject(new Error('WhatsApp auth failure: ' + msg));
      });

      client.on('disconnected', (reason) => {
        console.log('[WhatsApp] Client disconnected:', reason);
        isReady = false;
        client = null;
        initPromise = null;
      });

      client.initialize();
    } catch (err) {
      reject(err);
    }
  });

  return initPromise;
}

async function sendMessage(phone, message) {
  if (!client || !isReady) {
    throw new Error('WhatsApp client not ready. Scan QR code first.');
  }

  let formatted = phone.replace(/\D/g, '');
  if (!formatted.includes('@')) {
    if (formatted.length === 10) formatted = '91' + formatted;
    formatted = formatted + '@c.us';
  }

  const response = await client.sendMessage(formatted, message);
  return response;
}

async function sendReportNotification(phone, patientName, refNo, reportUrl) {
  const message = `Hello ${patientName},\n\nYour test report ${refNo} is now ready.\nYou can view it here: ${reportUrl}\n\n- S & S Diagnostic Center`;
  return sendMessage(phone, message);
}

async function sendStaffNotification(phone, patientName, refNo, testName) {
  const message = `New Report Created\n\nPatient: ${patientName}\nRef No: ${refNo}\nTest: ${testName}\n\n- PathLab Pro`;
  return sendMessage(phone, message);
}

function getStatus() {
  return {
    ready: isReady,
    hasQR: !!lastQR,
    qr: lastQR,
  };
}

function getQR() {
  return lastQR;
}

module.exports = {
  initClient,
  sendMessage,
  sendReportNotification,
  sendStaffNotification,
  getStatus,
  getQR,
};
