/**
 * Auto-calculation utility for derived lab parameters.
 * Evaluates calc_formula strings like "Total Bilirubin - Direct Bilirubin"
 * by substituting param_name references with their numeric result values.
 *
 * Supports special variables (curly-brace placeholders):
 *   {age}          - patient age (numeric)
 *   {gender_male}  - 1 if male, 0 if female (use as multiplier)
 *   {gender_female} - 1 if female, 0 if male (use as multiplier)
 *
 * Supports math functions: min(a,b), max(a,b), pow(a,b), sqrt(a), abs(a)
 *
 * Examples:
 *   "Total Bilirubin - Direct Bilirubin"
 *   "142 * min(Serum Creatinine / 0.9, 1) * pow(max(Serum Creatinine / 0.9, 1), -1.200) * pow(0.9938, {age}) * (1 + 0.012 * {gender_female})"
 */

// Allowed math functions in formulas
const MATH_FUNCS = { min: Math.min, max: Math.max, pow: Math.pow, sqrt: Math.sqrt, abs: Math.abs };

/**
 * Parse a formula string and compute the result using provided parameter values.
 * @param {string} formula - e.g. "Total Bilirubin - Direct Bilirubin" or "Bicarbonate (HCO3) + 0.03 * PCO2"
 * @param {Array} params - array of { param_name, result_value } objects
 * @param {number} decimals - number of decimal places to round to
 * @param {Object} context - optional { age, gender } for {age}/{gender_male}/{gender_female} placeholders
 * @returns {string|null} computed value as string, or null if cannot compute
 */
export function evaluateFormula(formula, params, decimals = 2, context = {}) {
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

  for (const name of paramNames) {
    // Escape special regex chars in the name
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    if (regex.test(expr)) {
      expr = expr.replace(regex, String(valueMap[name]));
    }
  }

  // Replace special context variables: {age}, {gender_male}, {gender_female}
  const age = parseFloat(context.age);
  const isFemale = (context.gender || '').toLowerCase() === 'female';
  expr = expr.replace(/\{age\}/g, isNaN(age) ? '0' : String(age));
  expr = expr.replace(/\{gender_male\}/g, isFemale ? '0' : '1');
  expr = expr.replace(/\{gender_female\}/g, isFemale ? '1' : '0');

  // Check if any param names remain (not found in valueMap)
  // Allow math function names: min, max, pow, sqrt, abs
  const remainingWords = expr.match(/[a-zA-Z][a-zA-Z\s\(\)]*/g);
  if (remainingWords) {
    const allowed = ['min', 'max', 'pow', 'sqrt', 'abs'];
    const unknown = remainingWords.filter(w => !allowed.some(a => w.trim().startsWith(a)));
    if (unknown.length > 0) {
      return null;
    }
  }

  // Clean up the expression - replace × with *, ÷ with /
  expr = expr.replace(/×/g, '*').replace(/÷/g, '/');

  // Validate expression only contains safe characters (now allows letters for math funcs)
  if (!/^[\d\s+\-*/().a-zA-Z,]+$/.test(expr)) return null;

  try {
    // eslint-disable-next-line no-new-func
    const result = Function('min', 'max', 'pow', 'sqrt', 'abs', `"use strict"; return (${expr})`)(
      MATH_FUNCS.min, MATH_FUNCS.max, MATH_FUNCS.pow, MATH_FUNCS.sqrt, MATH_FUNCS.abs
    );
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
 * @param {number} age - patient age for {age} placeholder in formulas
 * @returns {Object} updated results with calculated values
 */
export function autoCalculate(params, results, gender, checkAbnormal, age) {
  const updated = { ...results };
  const context = { age, gender };

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

    const computed = evaluateFormula(p.calc_formula, paramMap, p.calc_decimals ?? 2, context);
    if (computed !== null) {
      const refRange = gender === 'Female' ? p.ref_range_female : p.ref_range_male;
      const abnormal = checkAbnormal ? checkAbnormal(computed, refRange) : false;
      updated[p.uid] = { result_value: computed, is_abnormal: abnormal, is_calculated: true };
    }
  }

  return updated;
}
