const { getDb, parseJson, stringifyJson } = require('../db.cjs');

/**
 * Match incoming analyzer results to a local report
 * Priority:
 *   1. Match by sample_id (exact match)
 *   2. Match by patient name (fuzzy)
 *   3. No match — return unassigned
 *
 * @param {object} parsedResult - { sampleId, patientName, results: [...], timestamp }
 * @returns {object} { matched: boolean, report: null|reportObj, matchType: 'sample_id'|'patient_name'|'none', results: [...] }
 */
function matchResultToReport(parsedResult) {
  const db = getDb();
  const { sampleId, patientName, results } = parsedResult;

  // Strategy 1: Match by sample_id
  if (sampleId) {
    const report = db.prepare('SELECT * FROM reports WHERE sample_id = ? AND sync_status != ?').get(sampleId, 'deleted');
    if (report) {
      console.log('[matcher] Matched by sample_id:', sampleId, '→ report:', report._id);
      return { matched: true, report, matchType: 'sample_id', results };
    }
  }

  // Strategy 2: Match by patient name (fuzzy — contains match)
  if (patientName) {
    const cleanName = patientName.trim().toLowerCase();
    if (cleanName.length > 0) {
      // Try exact match first
      let report = db.prepare(`
        SELECT r.* FROM reports r 
        JOIN patients p ON r.patient_id = p._id 
        WHERE LOWER(p.name) = ? AND r.sync_status != ?
        ORDER BY r.created_at DESC LIMIT 1
      `).get(cleanName, 'deleted');

      // Try contains match
      if (!report) {
        report = db.prepare(`
          SELECT r.* FROM reports r 
          JOIN patients p ON r.patient_id = p._id 
          WHERE LOWER(p.name) LIKE ? AND r.sync_status != ?
          ORDER BY r.created_at DESC LIMIT 1
        `).get(`%${cleanName}%`, 'deleted');
      }

      // Also check patient_name field directly on report
      if (!report) {
        report = db.prepare(`
          SELECT * FROM reports 
          WHERE LOWER(patient_name) = ? AND sync_status != ?
          ORDER BY created_at DESC LIMIT 1
        `).get(cleanName, 'deleted');
      }

      if (!report) {
        report = db.prepare(`
          SELECT * FROM reports 
          WHERE LOWER(patient_name) LIKE ? AND sync_status != ?
          ORDER BY created_at DESC LIMIT 1
        `).get(`%${cleanName}%`, 'deleted');
      }

      if (report) {
        console.log('[matcher] Matched by patient_name:', patientName, '→ report:', report._id);
        return { matched: true, report, matchType: 'patient_name', results };
      }
    }
  }

  // Strategy 3: No match
  console.log('[matcher] No match found for sampleId:', sampleId, 'patientName:', patientName);
  return { matched: false, report: null, matchType: 'none', results };
}

/**
 * Apply analyzer results to a report
 * Updates the report's results JSON with the analyzer values
 * Marks the report as pending for sync
 *
 * @param {string} reportId - report _id
 * @param {array} results - [{ testCode, testName, value, unit, refLow, refHigh, flag, isAbnormal }]
 * @returns {object} { success: boolean, updatedCount: number, skippedCount: number, report: reportObj }
 */
function applyResultsToReport(reportId, results) {
  const db = getDb();
  const report = db.prepare('SELECT * FROM reports WHERE _id = ?').get(reportId);
  if (!report) {
    return { success: false, error: 'Report not found' };
  }

  const existingResults = parseJson(report.results) || [];
  const existingTests = parseJson(report.tests) || [];

  let updatedCount = 0;
  let skippedCount = 0;

  for (const result of results) {
    // Try to match result to an existing test in the report
    // Match by test name (case-insensitive) or test code
    let matchedIdx = -1;

    // First check existing results array
    for (let i = 0; i < existingResults.length; i++) {
      const r = existingResults[i];
      if (r.test_name && r.test_name.toLowerCase() === result.testName.toLowerCase()) {
        matchedIdx = i;
        break;
      }
      if (r.test_code && r.test_code.toLowerCase() === result.testCode.toLowerCase()) {
        matchedIdx = i;
        break;
      }
      if (r.name && r.name.toLowerCase() === result.testName.toLowerCase()) {
        matchedIdx = i;
        break;
      }
    }

    if (matchedIdx >= 0) {
      // Update existing result
      existingResults[matchedIdx] = {
        ...existingResults[matchedIdx],
        test_name: result.testName,
        test_code: result.testCode,
        value: result.value,
        unit: result.unit,
        ref_low: result.refLow,
        ref_high: result.refHigh,
        flag: result.flag,
        is_abnormal: result.isAbnormal,
        analyzer_updated: true,
        updated_at: new Date().toISOString(),
      };
      updatedCount++;
    } else {
      // Add as new result entry
      existingResults.push({
        test_name: result.testName,
        test_code: result.testCode,
        value: result.value,
        unit: result.unit,
        ref_low: result.refLow,
        ref_high: result.refHigh,
        flag: result.flag,
        is_abnormal: result.isAbnormal,
        analyzer_updated: true,
        updated_at: new Date().toISOString(),
      });
      updatedCount++;
    }
  }

  // Update report in DB
  db.prepare(`
    UPDATE reports 
    SET results = ?, sync_status = 'pending', updated_at = ?
    WHERE _id = ?
  `).run(stringifyJson(existingResults), new Date().toISOString(), reportId);

  const updatedReport = db.prepare('SELECT * FROM reports WHERE _id = ?').get(reportId);
  console.log('[matcher] Applied', updatedCount, 'results to report', reportId, '(' + skippedCount + ' skipped)');

  return { success: true, updatedCount, skippedCount, report: updatedReport };
}

/**
 * Get list of pending reports that could receive results
 * (reports with status Pending or In Progress)
 */
function getPendingReportsForMatching() {
  const db = getDb();
  const reports = db.prepare(`
    SELECT _id, patient_id, patient_name, sample_id, investigation, status, created_at
    FROM reports 
    WHERE sync_status != 'deleted'
    ORDER BY created_at DESC
    LIMIT 50
  `).all();
  return reports;
}

module.exports = {
  matchResultToReport,
  applyResultsToReport,
  getPendingReportsForMatching,
};
