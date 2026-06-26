const express = require('express');
const router = express.Router();
const { initClient, sendMessage, sendReportNotification, sendStaffNotification, getStatus, getQR } = require('../whatsappClient');

// Initialize client on first request
let initStarted = false;
function ensureInit() {
  if (!initStarted) {
    initStarted = true;
    initClient().catch(err => console.error('[WhatsApp] Init error:', err.message));
  }
}

// GET /api/whatsapp/status
router.get('/status', (req, res) => {
  ensureInit();
  const status = getStatus();
  res.json({ ready: status.ready, hasQR: status.hasQR });
});

// GET /api/whatsapp/qr
router.get('/qr', (req, res) => {
  ensureInit();
  const status = getStatus();
  if (status.qr) {
    res.json({ qr: status.qr });
  } else if (status.ready) {
    res.json({ ready: true, message: 'Already connected' });
  } else {
    res.status(202).json({ message: 'QR not yet generated. Try again in a few seconds.' });
  }
});

// POST /api/whatsapp/send
router.post('/send', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone and message are required' });
    }
    ensureInit();
    const result = await sendMessage(phone, message);
    res.json({ success: true, id: result.id._serialized });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/send-report
router.post('/send-report', async (req, res) => {
  try {
    const { phone, patientName, refNo, reportUrl } = req.body;
    if (!phone || !patientName || !refNo) {
      return res.status(400).json({ error: 'Phone, patientName, and refNo are required' });
    }
    ensureInit();
    const result = await sendReportNotification(phone, patientName, refNo, reportUrl);
    res.json({ success: true, id: result.id._serialized });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/send-staff
router.post('/send-staff', async (req, res) => {
  try {
    const { phone, patientName, refNo, testName } = req.body;
    if (!phone || !patientName) {
      return res.status(400).json({ error: 'Phone and patientName are required' });
    }
    ensureInit();
    const result = await sendStaffNotification(phone, patientName, refNo, testName);
    res.json({ success: true, id: result.id._serialized });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
