/**
 * Analyzer Parameter Mapper
 *
 * Maps raw analyzer test codes (e.g. "WBC", "NEU%", "HGB") to the app's
 * parameter names (e.g. "Total W.B.C. Count", "Neutrophils", "Haemoglobin").
 *
 * Strategy:
 *  1. Normalize both sides: lowercase, %→pct, #→abs, strip non-alphanumeric.
 *  2. Look up the analyzer code in PARAM_ALIASES to get candidate param names.
 *  3. Exact match each parameter's normalized name against the alias list.
 *  4. Fallback: substring match either direction (for unusual param names).
 */

// Canonical analyzer code (normalized) -> list of normalized app param names
const PARAM_ALIASES = {
  // --- Hematology: CBC core ---
  wbc: ['wbc', 'totalwbc', 'totalwbccount', 'wbccount', 'tlc', 'totalleucocytecount', 'totalleukocytecount', 'leucocytecount', 'leukocytecount', 'whitecellcount', 'whitebloodcellcount', 'totalwhitecellcount'],
  rbc: ['rbc', 'rbccount', 'rbcounterythrocytes', 'rbccounterythrocytes', 'erythrocytes', 'erythrocytecount', 'redcellcount', 'redbloodcellcount', 'totalrbccount', 'rbcerythrocytes'],
  hgb: ['hgb', 'hb', 'haemoglobin', 'hemoglobin', 'hbgdl', 'haemoglobingdl', 'hemoglobingdl', 'hbconcentration'],
  hct: ['hct', 'pcv', 'pcvhct', 'haematocrit', 'hematocrit', 'packedcellvolume', 'pcvpercent'],
  mcv: ['mcv', 'meancorpuscularvolume', 'meancellvolume'],
  mch: ['mch', 'meancorpuscularhaemoglobin', 'meancorpuscularhemoglobin', 'meancellhaemoglobin'],
  mchc: ['mchc', 'meancorpuscularhaemoglobinconcentration', 'meancorpuscularhemoglobinconcentration'],
  plt: ['plt', 'plateletcount', 'plateletscount', 'platelets', 'platelet', 'totalplateletcount', 'plateletcountlakhcumm', 'pltcount'],
  'rdw-cv': ['rdwcv', 'rdw', 'redcelldistributionwidthcv', 'rdwcvpct'],
  'rdw-sd': ['rdwsd', 'redcelldistributionwidthsd', 'rdwsdfl'],
  'rdwcv': ['rdwcv', 'rdw'],
  'rdwsd': ['rdwsd'],

  // --- Hematology: differential (% values) ---
  neupct: ['neu', 'neut', 'neutrophils', 'neutrophil', 'neutrophilspct', 'polymorphs', 'polymorphonuclearcells', 'segmentedneutrophils'],
  lympct: ['lym', 'lymphocytes', 'lymphocyte', 'lymphocytespct'],
  monpct: ['mon', 'monocytes', 'monocyte', 'monocytespct'],
  eospct: ['eos', 'eosinophils', 'eosinophil', 'eosinophilspct'],
  baspct: ['bas', 'basophils', 'basophil', 'basophilspct'],
  grapct: ['gra', 'granulocytes', 'granulocyte', 'granulocytespct', 'granulocytespercent'],
  midpct: ['mid', 'midcells', 'midcellspct', 'midcellspercent', 'mixedcells'],

  // --- Hematology: differential absolute counts ---
  neuabs: ['absoluteneutrophils', 'neutrophilabsolutecount', 'neutrophilsabs', 'neutabs', 'anc', 'neutrophilcountabsolute'],
  lymabs: ['absolutelymphocytes', 'lymphocyteabsolutecount', 'lymphocytesabs', 'lymphabs', 'alc'],
  monabs: ['absolutemonocytes', 'monocyteabsolutecount', 'monocytesabs'],
  eosabs: ['absoluteeosinophils', 'eosinophilabsolutecount', 'eosinophilsabs', 'aec', 'absoluteeosinophilcount'],
  basabs: ['absolutebasophils', 'basophilabsolutecount', 'basophilsabs'],
  graabs: ['absolutegranulocytes', 'granulocytesabs', 'granulocyteabsolutecount'],
  midabs: ['midcellsabs', 'absolutemidcells'],

  // --- Hematology: platelet indices ---
  mpv: ['mpv', 'meanplateletvolume'],
  pdw: ['pdw', 'plateletdistributionwidth', 'plateletdistributionwidthpdw'],
  pct: ['pct', 'plateletcrit', 'plateletcritpct'],
  'p-lcr': ['plcr', 'plateletlargecellratio', 'plateletlargecellratioplcr'],
  'p-lcc': ['plcc', 'plateletlargecellcount'],
  plcr: ['plcr', 'plateletlargecellratio'],
  plcc: ['plcc', 'plateletlargecellcount'],

  // --- Hematology extras ---
  esr: ['esr', 'esrwestergren', 'erythrocytesedimentationrate', 'esrmm1sthr', 'esrmmhr'],
  nrbcabs: ['nrbc', 'nucleatedrbc', 'nrbcabs', 'nrbcper100wbc'],
  igabs: ['ig', 'immaturegranulocytes', 'igabs'],

  // --- Biochemistry (for semi-auto/auto analyzers via ASTM) ---
  glu: ['glucose', 'bloodsugar', 'fastingbloodsugar', 'fbs', 'randombloodsugar', 'rbs', 'plasmaglucose', 'bloodglucose'],
  fbs: ['fastingbloodsugar', 'fbs', 'glucosefasting'],
  ppbs: ['postprandialbloodsugar', 'ppbs', 'glucosepp', 'postprandialglucose'],
  rbs: ['randombloodsugar', 'rbs', 'glucoserandom'],
  hba1c: ['hba1c', 'glycatedhaemoglobin', 'glycosylatedhaemoglobin', 'glycatedhemoglobin', 'hba1cpct'],
  bun: ['bun', 'bloodureanitrogen', 'ureanitrogen'],
  urea: ['urea', 'bloodurea', 'ureamydl'],
  crea: ['creatinine', 'serumcreatinine', 'screatinine', 'creatinines', 'crea'],
  ua: ['uricacid', 'serumuricacid', 'uricacidd'],
  tbil: ['totalbilirubin', 'bilirubintotal', 'tbilirubin', 'serumbilirubintotal'],
  dbil: ['directbilirubin', 'bilirubindirect', 'dbilirubin'],
  ibil: ['indirectbilirubin', 'bilirubinindirect'],
  sgot: ['sgot', 'ast', 'aspartateaminotransferase', 'sgotast'],
  sgpt: ['sgpt', 'alt', 'alanineaminotransferase', 'sgptalt'],
  alp: ['alp', 'alkalinephosphatase', 'serumalkalinephosphatase'],
  tprot: ['totalprotein', 'proteintotal', 'serumprotein'],
  alb: ['albumin', 'serumalbumin'],
  glob: ['globulin', 'serumglobulin'],
  chol: ['totalcholesterol', 'cholesterol', 'cholesteroltotal', 'serumcholesterol', 'tchol'],
  tg: ['triglycerides', 'triglyceride', 'tgl', 'serumtriglycerides'],
  hdl: ['hdlcholesterol', 'hdl', 'highdensitylipoprotein'],
  ldl: ['ldlcholesterol', 'ldl', 'lowdensitylipoprotein'],
  vldl: ['vldlcholesterol', 'vldl', 'verylowdensitylipoprotein'],
  na: ['sodium', 'serumsodium', 'na+', 'na'],
  k: ['potassium', 'serumpotassium', 'k+', 'k'],
  cl: ['chloride', 'serumchloride', 'cl-'],
  ca: ['calcium', 'serumcalcium', 'totalcalcium'],
  po4: ['phosphorus', 'serumphosphorus', 'inorganicphosphorus', 'phosphate'],
  amy: ['amylase', 'serumamylase'],
  lip: ['lipase', 'serumlipase'],
  ck: ['ck', 'cpk', 'creatinekinase', 'totalcpk'],
  ckmb: ['ckmb', 'creatinekinasemb', 'cpkmb'],
  t3: ['t3', 'triiodothyronine', 'totalt3'],
  t4: ['t4', 'thyroxine', 'totalt4'],
  tsh: ['tsh', 'thyroidstimulatinghormone', 'thyrotropin'],
  ft3: ['freet3', 'ft3', 'freetriiodothyronine'],
  ft4: ['freet4', 'ft4', 'freethyroxine'],
  psa: ['psa', 'prostatespecificantigen'],
  crp: ['crp', 'creactiveprotein'],
  rf: ['rf', 'rheumatoidfactor', 'rafactor'],
  aso: ['aso', 'antistreptolysino', 'asotitre'],
};

/**
 * Export the aliases map for direct lookup (used by auto-test-selection).
 */
export const PARAM_ALIASES_LOOKUP = PARAM_ALIASES;

/**
 * Normalize a code or param name for matching.
 * % → pct, # → abs, non-alphanumeric stripped, lowercased.
 */
export function normalizeCode(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .replace(/%/g, 'pct')
    .replace(/#/g, 'abs')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Check if an ASTM abnormal flag means "abnormal".
 * Flags: '', 'N', 'L', 'H', 'LL', 'HH', 'A', 'C' etc.
 */
export function isAbnormalFlag(flag) {
  if (!flag) return false;
  const f = flag.toString().trim().toUpperCase();
  return f !== 'N' && f !== '' && f !== 'NORMAL';
}

/**
 * Match analyzer results to app parameters.
 * @param {Array} analyzerResults - [{ testCode, value, unit, refRange, abnormalFlag }]
 * @param {Array} parameters - app params with { uid, param_name, ... }
 * @returns {{ mapped: Object<uid,{result_value,is_abnormal}>, unmatched: Array, matchedCount: number }}
 */
export function matchResultsToParams(analyzerResults, parameters) {
  const mapped = {};
  const unmatched = [];
  const usedUids = new Set();

  for (const res of analyzerResults || []) {
    const codeNorm = normalizeCode(res.testCode || res.testName);
    if (!codeNorm || res.value === undefined || res.value === '') {
      unmatched.push(res);
      continue;
    }

    // Candidate normalized param names for this analyzer code
    const aliases = PARAM_ALIASES[codeNorm] || [codeNorm];

    let param = parameters.find(
      p => !usedUids.has(p.uid) && aliases.includes(normalizeCode(p.param_name))
    );

    // Fallback: substring matching (either direction) for unlisted names
    if (!param) {
      param = parameters.find(p => {
        if (usedUids.has(p.uid)) return false;
        const pn = normalizeCode(p.param_name);
        if (!pn) return false;
        return aliases.some(a => a.length >= 3 && (pn.includes(a) || a.includes(pn)));
      });
    }

    if (param) {
      usedUids.add(param.uid);
      mapped[param.uid] = {
        result_value: res.value,
        is_abnormal: isAbnormalFlag(res.abnormalFlag),
      };
    } else {
      unmatched.push(res);
    }
  }

  return { mapped, unmatched, matchedCount: Object.keys(mapped).length };
}

/**
 * Extract the best available sample identifier from a parsed analyzer result.
 * Checks order records first (O|1|sampleId), then patient record.
 */
export function getAnalyzerSampleId(result) {
  return (
    result?.orders?.[0]?.sampleId ||
    result?.patient?.patientId ||
    ''
  ).toString().trim();
}
