/**
 * Auto-calculation utility for derived lab parameters.
 * Evaluates calc_formula strings like "Total Bilirubin - Direct Bilirubin"
 * by substituting param_name references with their numeric result values.
 */

/**
 * Parse a formula string and compute the result using provided parameter values.
 * @param {string} formula - e.g. "Total Bilirubin - Direct Bilirubin" or "Bicarbonate (HCO3) + 0.03 * PCO2"
 * @param {Array} params - array of { param_name, result_value } objects
 * @param {number} decimals - number of decimal places to round to
 * @returns {string|null} computed value as string, or null if cannot compute
 */
export function evaluateFormula(formula, params, decimals = 2) {
  if (!formula) return null;

  // Build a map of param_name -> numeric value
  const valueMap = {};
  for (const p of params) {
    const val = parseFloat(p.result_value);
    if (!isNaN(val)) {
      valueMap[p.param_name] = val;
    }
  }

  // Sort param names by length (longest first) to avoid partial substitution
  // e.g. "Total Bilirubin" before "Bilirubin"
  const paramNames = Object.keys(valueMap).sort((a, b) => b.length - a.length);

  // Replace param names with their numeric values
  let expr = formula;
  let allFound = true;

  for (const name of paramNames) {
    // Escape special regex chars in the name
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    if (regex.test(expr)) {
      expr = expr.replace(regex, String(valueMap[name]));
    }
  }

  // Check if any param names remain (not found in valueMap)
  // If there are alphabetic characters left that aren't part of numbers, fail
  const remainingWords = expr.match(/[a-zA-Z][a-zA-Z\s\(\)]*/g);
  if (remainingWords && remainingWords.length > 0) {
    // Try to see if they're just function names or units we can ignore
    // If any remaining word looks like a param name, we can't compute
    allFound = false;
  }

  if (!allFound) return null;

  // Clean up the expression - replace × with *, ÷ with /
  expr = expr.replace(/×/g, '*').replace(/÷/g, '/');

  // Validate expression only contains safe characters
  if (!/^[\d\s+\-*/().]+$/.test(expr)) return null;

  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr})`)();
    if (typeof result === 'number' && isFinite(result)) {
      return result.toFixed(decimals);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Given a list of parameters and their results, auto-calculate any parameters
 * that have a calc_formula and return the updated results.
 * @param {Array} params - array of param objects with calc_formula, param_name, etc.
 * @param {Object} results - { [uid]: { result_value, is_abnormal } }
 * @param {string} gender - 'Male' or 'Female' for abnormal checking
 * @param {Function} checkAbnormal - function(value, refRange) => bool
 * @returns {Object} updated results with calculated values
 */
export function autoCalculate(params, results, gender, checkAbnormal) {
  const updated = { ...results };

  // Build a list of { param_name, result_value } from current results
  const paramMap = params.map(p => ({
    param_name: p.param_name,
    result_value: updated[p.uid]?.result_value || '',
    uid: p.uid,
    calc_formula: p.calc_formula,
    calc_decimals: p.calc_decimals,
    ref_range_male: p.ref_range_male,
    ref_range_female: p.ref_range_female,
  }));

  for (const p of paramMap) {
    if (!p.calc_formula) continue;

    const computed = evaluateFormula(p.calc_formula, paramMap, p.calc_decimals ?? 2);
    if (computed !== null) {
      const refRange = gender === 'Female' ? p.ref_range_female : p.ref_range_male;
      const abnormal = checkAbnormal ? checkAbnormal(computed, refRange) : false;
      updated[p.uid] = { result_value: computed, is_abnormal: abnormal, is_calculated: true };
    }
  }

  return updated;
}
