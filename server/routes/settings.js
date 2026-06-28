const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'pathlab-pro-v2-secret-2024';

// Middleware: verify JWT token
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Middleware: require admin role
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Default report layout values
const DEFAULT_LAYOUT = {
  // Letterhead / Header
  letterheadHeight: 140,       // px - height of letterhead image area
  headerTopPadding: 0,         // px - extra space above the letterhead
  headerBottomPadding: 6,      // px - space below patient info, before results table
  titleFontSize: 14,           // px - "LABORATORY INVESTIGATION REPORT"
  patientInfoFontSize: 11,     // px - patient name, age, date etc.

  // Content / Body
  bodyFontSize: 12,            // px - base font size
  resultFontSize: 11,          // px - test result rows
  bodyPaddingLeft: 10,         // mm - left padding of body
  bodyPaddingRight: 10,        // mm - right padding of body
  contentTopMargin: 5,         // px - gap between header and first result row

  // Footer
  footerHeight: 130,           // px - total footer area height
  footerBottomOffset: 5,       // mm - distance from page bottom
  showSignature: true,
  signatureHeight: 13,         // px
  doctorName: '',              // empty = use report's doctor_name
  doctorDesignation: '',       // empty = use report's doctor_designation
  footerNote1: 'Result of tests may vary from Lab to Lab and also in some parameters from time to time for the same patient',
  footerNote2: 'The Report is not valid for medico legal purpose',
  showHindiFooter: true,
  hindiFooterText: '(होम कलेक्शन फ्री उपलब्ध है) यहा पर सभी प्रकार पैथोलोजिकल जाँच की सुविधा उपलब्ध है. मो. - 9835310931',
  hindiFooterBgColor: '#8B0000',

  // Column widths (must sum to 100)
  colTestWidth: 45,            // % - Test Description column
  colResultWidth: 25,          // % - Result/Unit column
  colRefWidth: 30,             // % - Ref Range column
};

// Default structure: separate settings for print and pdf modes
const DEFAULT_SETTINGS = { pdf: { ...DEFAULT_LAYOUT }, print: { ...DEFAULT_LAYOUT } };

// GET /api/settings/report-layout — public (needed for rendering reports, no sensitive data)
router.get('/report-layout', async (req, res) => {
  try {
    const db = getDB();
    const settings = await db.collection('settings').findOne({ key: 'report_layout' });
    if (!settings) return res.json(DEFAULT_SETTINGS);
    // Migration: if old flat structure, wrap it in both modes
    if (settings.value && !settings.value.pdf && !settings.value.print) {
      const migrated = { pdf: { ...DEFAULT_LAYOUT, ...settings.value }, print: { ...DEFAULT_LAYOUT, ...settings.value } };
      return res.json(migrated);
    }
    res.json({ pdf: { ...DEFAULT_LAYOUT, ...settings.value?.pdf }, print: { ...DEFAULT_LAYOUT, ...settings.value?.print } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/report-layout — admin only
router.put('/report-layout', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { pdf, print } = req.body;
    const layout = {
      pdf: { ...DEFAULT_LAYOUT, ...pdf },
      print: { ...DEFAULT_LAYOUT, ...print },
    };

    await db.collection('settings').updateOne(
      { key: 'report_layout' },
      { $set: { key: 'report_layout', value: layout, updated_at: new Date() } },
      { upsert: true }
    );

    res.json({ success: true, layout });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/report-layout/reset — admin only, resets to defaults
router.post('/report-layout/reset', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    await db.collection('settings').updateOne(
      { key: 'report_layout' },
      { $set: { key: 'report_layout', value: DEFAULT_SETTINGS, updated_at: new Date() } },
      { upsert: true }
    );
    res.json({ success: true, layout: DEFAULT_SETTINGS });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/referring-doctors — public (needed for QuickReport dropdown)
router.get('/referring-doctors', async (req, res) => {
  try {
    const db = getDB();
    const settings = await db.collection('settings').findOne({ key: 'referring_doctors' });
    const doctors = settings?.value || ['SELF'];
    res.json({ doctors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/referring-doctors — admin only
router.put('/referring-doctors', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { doctors } = req.body;
    if (!Array.isArray(doctors)) {
      return res.status(400).json({ error: 'doctors must be an array' });
    }
    // Ensure SELF is always present
    if (!doctors.includes('SELF')) {
      doctors.unshift('SELF');
    }
    await db.collection('settings').updateOne(
      { key: 'referring_doctors' },
      { $set: { key: 'referring_doctors', value: doctors, updated_at: new Date() } },
      { upsert: true }
    );
    res.json({ success: true, doctors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
