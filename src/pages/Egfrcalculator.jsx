import { useState, useMemo } from 'react';
import { Calculator, RotateCcw, Info } from 'lucide-react';

// ---------- Unit helpers ----------
const CREAT_MGDL_TO_UMOL = 88.4;

// ---------- CKD-EPI 2021 (race-free) ----------
// Levey AS et al. NEJM 2021. eGFR = 142 * min(Scr/κ, 1)^α * max(Scr/κ, 1)^-1.200 * 0.9938^Age * 1.012 [female]
function ckdEpi2021(creatinineMgDl, age, isFemale) {
  const kappa = isFemale ? 0.7 : 0.9;
  const alpha = isFemale ? -0.241 : -0.302;
  const sexMult = isFemale ? 1.012 : 1;
  const scr = creatinineMgDl;
  const minTerm = Math.min(scr / kappa, 1);
  const maxTerm = Math.max(scr / kappa, 1);
  return 142 * Math.pow(minTerm, alpha) * Math.pow(maxTerm, -1.200) * Math.pow(0.9938, age) * sexMult;
}

// ---------- CKD-EPI 2009 (race coefficient) ----------
// eGFR = 141 * min(Scr/κ, 1)^α * max(Scr/κ, 1)^-1.209 * 0.993^Age * 1.018 [female] * 1.159 [Black]
function ckdEpi2009(creatinineMgDl, age, isFemale, isBlack) {
  const kappa = isFemale ? 0.7 : 0.9;
  const alpha = isFemale ? -0.329 : -0.411;
  const sexMult = isFemale ? 1.018 : 1;
  const raceMult = isBlack ? 1.159 : 1;
  const scr = creatinineMgDl;
  const minTerm = Math.min(scr / kappa, 1);
  const maxTerm = Math.max(scr / kappa, 1);
  return 141 * Math.pow(minTerm, alpha) * Math.pow(maxTerm, -1.209) * Math.pow(0.993, age) * sexMult * raceMult;
}

// ---------- MDRD (4-variable) ----------
// eGFR = 175 * Scr^-1.154 * Age^-0.203 * 0.742 [female] * 1.212 [Black]
function mdrd(creatinineMgDl, age, isFemale, isBlack) {
  const sexMult = isFemale ? 0.742 : 1;
  const raceMult = isBlack ? 1.212 : 1;
  return 175 * Math.pow(creatinineMgDl, -1.154) * Math.pow(age, -0.203) * sexMult * raceMult;
}

// ---------- Cockcroft-Gault (CrCl, mL/min) ----------
// CrCl = ((140 - Age) * WeightKg) / (72 * Scr) * 0.85 [female]
function cockcroftGault(creatinineMgDl, age, isFemale, weightKg) {
  if (!weightKg || weightKg <= 0) return null;
  const sexMult = isFemale ? 0.85 : 1;
  return ((140 - age) * weightKg) / (72 * creatinineMgDl) * sexMult;
}

// ---------- CKD staging (KDIGO) ----------
function ckdStage(egfr) {
  if (egfr == null || isNaN(egfr)) return null;
  if (egfr >= 90) return { stage: 'G1', label: 'Normal or high', color: 'green' };
  if (egfr >= 60) return { stage: 'G2', label: 'Mildly decreased', color: 'green' };
  if (egfr >= 45) return { stage: 'G3a', label: 'Mildly–moderately decreased', color: 'yellow' };
  if (egfr >= 30) return { stage: 'G3b', label: 'Moderately–severely decreased', color: 'yellow' };
  if (egfr >= 15) return { stage: 'G4', label: 'Severely decreased', color: 'red' };
  return { stage: 'G5', label: 'Kidney failure', color: 'red' };
}

const STAGE_TABLE = [
  { stage: 'G1', range: '≥ 90', label: 'Normal or high', color: 'green' },
  { stage: 'G2', range: '60–89', label: 'Mildly decreased', color: 'green' },
  { stage: 'G3a', range: '45–59', label: 'Mildly–moderately decreased', color: 'yellow' },
  { stage: 'G3b', range: '30–44', label: 'Moderately–severely decreased', color: 'yellow' },
  { stage: 'G4', range: '15–29', label: 'Severely decreased', color: 'red' },
  { stage: 'G5', range: '< 15', label: 'Kidney failure', color: 'red' },
];

const colorClasses = {
  green: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const initialForm = {
  creatinine: '',
  creatUnit: 'mg/dL',
  age: '',
  sex: 'male',
  race: 'no', // for CKD-EPI 2009 / MDRD
  weight: '',
  weightUnit: 'kg',
};

export default function Egfrcalculator() {
  const [form, setForm] = useState(initialForm);
  const [results, setResults] = useState(null);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const reset = () => {
    setForm(initialForm);
    setResults(null);
  };

  const canCalc = useMemo(() => {
    return (
      form.creatinine !== '' &&
      parseFloat(form.creatinine) > 0 &&
      form.age !== '' &&
      parseFloat(form.age) > 0
    );
  }, [form.creatinine, form.age]);

  const calculate = () => {
    const creatMgDl =
      form.creatUnit === 'µmol/L'
        ? parseFloat(form.creatinine) / CREAT_MGDL_TO_UMOL
        : parseFloat(form.creatinine);
    const age = parseFloat(form.age);
    const isFemale = form.sex === 'female';
    const isBlack = form.race === 'yes';
    const weightKg =
      form.weightUnit === 'lb' && form.weight !== ''
        ? parseFloat(form.weight) / 2.2046
        : form.weight !== ''
          ? parseFloat(form.weight)
          : null;

    if (!creatMgDl || !age) {
      setResults(null);
      return;
    }

    const egfr2021 = ckdEpi2021(creatMgDl, age, isFemale);
    const egfr2009 = ckdEpi2009(creatMgDl, age, isFemale, isBlack);
    const egfrMdrd = mdrd(creatMgDl, age, isFemale, isBlack);
    const crCl = cockcroftGault(creatMgDl, age, isFemale, weightKg);

    setResults({
      ckdEpi2021: egfr2021,
      ckdEpi2009: egfr2009,
      mdrd: egfrMdrd,
      cockcroftGault: crCl,
      creatMgDl,
      weightKg,
    });
  };

  const stage = results ? ckdStage(results.ckdEpi2021) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">eGFR Calculator</h1>
          <p className="text-gray-500 text-sm mt-1 dark:text-gray-50 dark:font-medium">
            Estimated Glomerular Filtration Rate — kidney function from serum creatinine
          </p>
        </div>
        <button onClick={reset} className="btn-secondary flex items-center gap-2">
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input form */}
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-50">Patient Parameters</h3>

          {/* Serum creatinine */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Serum Creatinine <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                value={form.creatinine}
                onChange={(e) => update('creatinine', e.target.value)}
                placeholder="e.g. 1.2"
                className="input-field flex-1"
              />
              <select
                value={form.creatUnit}
                onChange={(e) => update('creatUnit', e.target.value)}
                className="input-field w-28"
              >
                <option value="mg/dL">mg/dL</option>
                <option value="µmol/L">µmol/L</option>
              </select>
            </div>
          </div>

          {/* Age */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Age (years) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="1"
              min="1"
              max="120"
              value={form.age}
              onChange={(e) => update('age', e.target.value)}
              placeholder="e.g. 55"
              className="input-field"
            />
          </div>

          {/* Sex */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sex</label>
            <div className="flex gap-2">
              {['male', 'female'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => update('sex', s)}
                  className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium capitalize transition-colors ${
                    form.sex === s
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Race (for CKD-EPI 2009 & MDRD) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Black ethnicity / race
              <span className="text-gray-400 font-normal ml-1">(used by CKD-EPI 2009 & MDRD only)</span>
            </label>
            <div className="flex gap-2">
              {[
                { v: 'no', l: 'No' },
                { v: 'yes', l: 'Yes' },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => update('race', o.v)}
                  className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    form.race === o.v
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {/* Weight (for Cockcroft-Gault) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Weight <span className="text-gray-400 font-normal">(for Cockcroft-Gault)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                value={form.weight}
                onChange={(e) => update('weight', e.target.value)}
                placeholder="optional"
                className="input-field flex-1"
              />
              <select
                value={form.weightUnit}
                onChange={(e) => update('weightUnit', e.target.value)}
                className="input-field w-28"
              >
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </select>
            </div>
          </div>

          <button
            onClick={calculate}
            disabled={!canCalc}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Calculator className="w-4 h-4" />
            Calculate
          </button>
        </div>

        {/* Results */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-gray-50 mb-4">Results</h3>

            {!results && (
              <div className="text-center py-12 text-gray-400 text-sm">
                Enter creatinine and age, then click Calculate.
              </div>
            )}

            {results && (
              <div className="space-y-4">
                {/* Primary result — CKD-EPI 2021 */}
                <div className="rounded-lg border border-primary-200 bg-primary-50 p-4 dark:bg-primary-900/20 dark:border-primary-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-primary-700 dark:text-primary-300 uppercase tracking-wide">
                        CKD-EPI 2021 (race-free)
                      </p>
                      <p className="text-3xl font-bold text-primary-700 dark:text-primary-300 mt-1">
                        {results.ckdEpi2021.toFixed(1)}{' '}
                        <span className="text-base font-normal text-primary-600 dark:text-primary-400">mL/min/1.73m²</span>
                      </p>
                    </div>
                    {stage && (
                      <span className={`badge ${colorClasses[stage.color]}`}>
                        {stage.stage} · {stage.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Other formulas */}
                <div className="space-y-2">
                  <ResultRow
                    label="CKD-EPI 2009"
                    value={results.ckdEpi2009}
                    unit="mL/min/1.73m²"
                  />
                  <ResultRow
                    label="MDRD (4-variable)"
                    value={results.mdrd}
                    unit="mL/min/1.73m²"
                  />
                  <ResultRow
                    label="Cockcroft-Gault (CrCl)"
                    value={results.cockcroftGault}
                    unit="mL/min"
                    hint={results.cockcroftGault == null ? 'Weight required' : null}
                  />
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
                  Creatinine used: {results.creatMgDl.toFixed(3)} mg/dL
                  {results.weightKg ? ` · Weight: ${results.weightKg.toFixed(1)} kg` : ''}
                </p>
              </div>
            )}
          </div>

          {/* CKD stage table */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-gray-50 mb-3">CKD Stages (KDIGO)</h3>
            <div className="space-y-1.5">
              {STAGE_TABLE.map((s) => {
                const active = stage && stage.stage === s.stage;
                return (
                  <div
                    key={s.stage}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                      active ? 'ring-2 ring-primary-400 bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`badge ${colorClasses[s.color]}`}>{s.stage}</span>
                      <span className="text-gray-700 dark:text-gray-300">{s.label}</span>
                    </div>
                    <span className="text-gray-500 dark:text-gray-400 font-mono">{s.range} mL/min/1.73m²</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="card flex gap-3 items-start">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              CKD-EPI 2021 is the current race-free standard (NKF-ASN Task Force, 2021). CKD-EPI 2009 and MDRD
              are provided for reference only. Cockcroft-Gault estimates creatinine clearance (CrCl), used for
              drug dosing — it requires weight and is not indexed to body surface area. Results are for
              informational purposes and not a substitute for clinical judgement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultRow({ label, value, unit, hint }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-700/40">
      <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
      {hint ? (
        <span className="text-xs text-gray-400 italic">{hint}</span>
      ) : (
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {value.toFixed(1)} <span className="text-xs font-normal text-gray-500">{unit}</span>
        </span>
      )}
    </div>
  );
}
