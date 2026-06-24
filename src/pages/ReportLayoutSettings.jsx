import { useState, useEffect, useCallback } from 'react';
import { Save, RotateCcw, Eye, EyeOff, SlidersHorizontal, Type, Columns, ArrowDown, Image, FileText, Printer } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const DEFAULT_LAYOUT = {
  letterheadHeight: 140,
  headerTopPadding: 0,
  headerBottomPadding: 6,
  titleFontSize: 14,
  patientInfoFontSize: 11,
  bodyFontSize: 12,
  resultFontSize: 11,
  bodyPaddingLeft: 10,
  bodyPaddingRight: 10,
  contentTopMargin: 5,
  footerHeight: 130,
  footerBottomOffset: 5,
  showSignature: true,
  signatureHeight: 13,
  doctorName: '',
  doctorDesignation: '',
  footerNote1: 'Result of tests may vary from Lab to Lab and also in some parameters from time to time for the same patient',
  footerNote2: 'The Report is not valid for medico legal purpose',
  showHindiFooter: true,
  hindiFooterText: '(होम कलेक्शन फ्री उपलब्ध है) यहा पर सभी प्रकार पैथोलोजिकल जाँच की सुविधा उपलब्ध है. मो. - 9835310931',
  hindiFooterBgColor: '#8B0000',
  colTestWidth: 45,
  colResultWidth: 25,
  colRefWidth: 30,
};

// Slider input component
function SliderField({ label, value, onChange, min, max, step = 1, unit = 'px', desc }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-mono text-primary-600 bg-primary-50 px-2 py-0.5 rounded">{value}{unit}</span>
      </div>
      {desc && <p className="text-xs text-gray-400">{desc}</p>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
      />
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

// Sample report preview
function ReportPreview({ layout, mode = 'pdf' }) {
  const l = layout;
  const isPdf = mode === 'pdf';
  const scale = 0.48;
  return (
    <div className="bg-gray-100 rounded-xl p-4 flex items-start justify-center overflow-auto" style={{ minHeight: '600px' }}>
      <div
        style={{
          width: '210mm',
          minHeight: '297mm',
          background: '#fff',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          fontFamily: "'Times New Roman', serif",
          fontSize: `${l.bodyFontSize}px`,
          color: '#000',
          position: 'relative',
          padding: `0 ${l.bodyPaddingLeft}mm`,
          paddingRight: `${l.bodyPaddingRight}mm`,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}
      >
        {/* Letterhead - PDF shows actual image, Print mode no letterhead */}
        {isPdf ? (
          <div style={{
            height: `${l.letterheadHeight}px`,
            marginTop: `${l.headerTopPadding}px`,
            overflow: 'hidden',
            borderRadius: '0 0 4px 4px',
          }}>
            <img
              src="/letterhead.png"
              alt="Letterhead"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
              onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.style.background = 'linear-gradient(135deg, #dbeafe 0%, #ede9fe 100%)'; e.target.parentElement.style.border = '2px dashed #93c5fd'; }}
            />
          </div>
        ) : (
          <div style={{ height: '8px' }}></div>
        )}

        {/* Title */}
        <div style={{
          textAlign: 'center',
          fontSize: `${l.titleFontSize}px`,
          fontWeight: 'bold',
          padding: `8px 0 ${l.headerBottomPadding}px`,
          textDecoration: 'underline',
          letterSpacing: '1px',
        }}>
          LABORATORY INVESTIGATION REPORT
        </div>

        {/* Patient Info */}
        <div style={{ fontSize: `${l.patientInfoFontSize}px`, paddingBottom: `${l.headerBottomPadding}px` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ width: `${l.colTestWidth}%` }}><strong>Patient Name</strong> : Sample Patient</span>
            <span style={{ width: `${l.colResultWidth}%`, textAlign: 'center' }}><strong>Age/Sex</strong> : 35 Yrs/M</span>
            <span style={{ width: `${l.colRefWidth}%`, textAlign: 'left' }}><strong>Date of Collection</strong> : 24/06/2026</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ width: `${l.colTestWidth}%` }}><strong>Ref. by</strong> : Dr. Example</span>
            <span style={{ width: `${l.colResultWidth}%` }}></span>
            <span style={{ width: `${l.colRefWidth}%`, textAlign: 'left' }}><strong>Date of Reporting</strong> : 24/06/2026</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ width: `${l.colTestWidth}%` }}><strong>Specimen</strong> : BLOOD</span>
            <span style={{ width: `${l.colResultWidth}%` }}></span>
            <span style={{ width: `${l.colRefWidth}%`, textAlign: 'left' }}><strong>Ref No</strong> : 001</span>
          </div>
        </div>

        {/* Table header */}
        <div style={{
          display: 'flex',
          borderTop: '2px solid #000',
          borderBottom: '2px solid #000',
          fontWeight: 'bold',
          fontSize: `${l.resultFontSize}px`,
        }}>
          <div style={{ width: `${l.colTestWidth}%`, padding: '4px 6px' }}>Test Description</div>
          <div style={{ width: `${l.colResultWidth}%`, padding: '4px 6px', textAlign: 'center' }}>RESULT/UNIT</div>
          <div style={{ width: `${l.colRefWidth}%`, padding: '4px 6px', textAlign: 'center' }}>REF. RANGE</div>
        </div>

        {/* Sample rows */}
        <div style={{ marginTop: `${l.contentTopMargin}px` }}>
          <div style={{ textAlign: 'center', paddingTop: '10px', paddingBottom: '4px', fontWeight: 'bold', fontSize: `${l.resultFontSize + 1}px`, borderBottom: '1px solid #333' }}>
            HEMATOLOGY REPORT
          </div>
          <div style={{ paddingTop: '6px', paddingLeft: '6px', fontWeight: 'bold', fontSize: `${l.resultFontSize}px`, color: '#333' }}>
            COMPLETE BLOOD COUNT
          </div>
          {[
            { name: 'Haemoglobin', value: '14.2 gms/dl', ref: '13.0-16.0 M', abnormal: false },
            { name: 'Total W.B.C. Count', value: '12500 /cumm', ref: '4000 - 11000', abnormal: true },
            { name: 'R.B.C. Count', value: '5.1 million/cumm', ref: '4.5 - 6.5', abnormal: false },
            { name: 'Platelets Count', value: '2.8 lakhs/cumm', ref: '1.5 - 4.5', abnormal: false },
          ].map((row, i) => (
            <div key={i} style={{
              display: 'flex',
              borderBottom: '1px dotted #ccc',
              fontSize: `${l.resultFontSize}px`,
              fontWeight: row.abnormal ? 'bold' : 'normal',
              color: row.abnormal ? '#c00' : '#000',
              padding: '3px 6px 3px 12px',
            }}>
              <span style={{ width: `${l.colTestWidth}%` }}>{row.name}</span>
              <span style={{ width: `${l.colResultWidth}%`, textAlign: 'center' }}>{row.value}</span>
              <span style={{ width: `${l.colRefWidth}%`, textAlign: 'center', color: row.abnormal ? '#c00' : '#555' }}>{row.ref}</span>
            </div>
          ))}
          <div style={{ textAlign: 'center', padding: '16px 0 8px', fontSize: '10px', color: '#666' }}>------End of Report------</div>
        </div>

        {/* Footer preview - PDF shows full footer, Print shows nothing */}
        {isPdf && (
          <div style={{
            position: 'absolute',
            bottom: `${l.footerBottomOffset}mm`,
            left: `${l.bodyPaddingLeft}mm`,
            right: `${l.bodyPaddingRight}mm`,
            height: `${l.footerHeight}px`,
            border: '2px dashed #93c5fd',
            borderRadius: '4px',
            background: 'linear-gradient(135deg, #f0f9ff 0%, #faf5ff 100%)',
            padding: '4px',
          }}>
            <div style={{ textAlign: 'right', paddingRight: '20px', marginBottom: '4px' }}>
              {l.showSignature && (
                <div style={{ height: `${l.signatureHeight}px`, background: '#f3f4f6', border: '1px dashed #d1d5db', marginLeft: 'auto', width: '80px', marginBottom: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '8px', color: '#9ca3af', fontFamily: 'sans-serif' }}>Sign</span>
                </div>
              )}
              <p style={{ fontWeight: 'bold', fontSize: '13px', margin: 0, textDecoration: 'underline' }}>{l.doctorName || 'DR. C. ASHOK'}</p>
              <p style={{ fontSize: '11px', margin: 0 }}>{l.doctorDesignation || 'MBBS MD (PATH)'}</p>
              <p style={{ fontSize: '11px', margin: 0 }}>(PATHOLOGIST)</p>
            </div>
            <div style={{ borderTop: '1px solid #999', paddingTop: '3px', fontSize: '9px', color: '#666' }}>
              <p style={{ margin: '1px 0' }}>1. {l.footerNote1}</p>
              <p style={{ margin: '1px 0' }}>2. {l.footerNote2}</p>
            </div>
            {l.showHindiFooter && (
              <div style={{
                marginTop: '4px',
                background: l.hindiFooterBgColor,
                color: '#fff',
                padding: '4px 10px',
                fontSize: '9px',
                textAlign: 'center',
                borderRadius: '2px',
              }}>
                {l.hindiFooterText}
              </div>
            )}
            <p style={{ fontSize: '8px', color: '#60a5fa', fontFamily: 'sans-serif', textAlign: 'center', margin: '2px 0 0' }}>Footer Area ({l.footerHeight}px)</p>
          </div>
        )}

        {/* Print mode: show doctor signature section (no letterhead, no hindi footer) */}
        {!isPdf && (
          <div style={{ marginTop: '40px', textAlign: 'right', paddingRight: '20px' }}>
            {l.showSignature && (
              <div style={{ height: `${l.signatureHeight}px`, background: '#f3f4f6', border: '1px dashed #d1d5db', marginLeft: 'auto', width: '80px', marginBottom: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '8px', color: '#9ca3af', fontFamily: 'sans-serif' }}>Sign</span>
              </div>
            )}
            <p style={{ fontWeight: 'bold', fontSize: '13px', margin: 0, textDecoration: 'underline' }}>{l.doctorName || 'DR. C. ASHOK'}</p>
            <p style={{ fontSize: '11px', margin: 0 }}>{l.doctorDesignation || 'MBBS MD (PATH)'}</p>
            <p style={{ fontSize: '11px', margin: 0 }}>(PATHOLOGIST)</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportLayoutSettings() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [layouts, setLayouts] = useState({ pdf: { ...DEFAULT_LAYOUT }, print: { ...DEFAULT_LAYOUT } });
  const [activeMode, setActiveMode] = useState('pdf'); // 'pdf' or 'print'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [activeSection, setActiveSection] = useState('header');

  // Current mode's layout
  const layout = layouts[activeMode];

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 text-lg">Access denied. Admin only.</p>
      </div>
    );
  }

  useEffect(() => {
    loadLayout();
  }, []);

  const loadLayout = async () => {
    try {
      const data = await api.getReportLayout();
      setLayouts({
        pdf: { ...DEFAULT_LAYOUT, ...data?.pdf },
        print: { ...DEFAULT_LAYOUT, ...data?.print },
      });
    } catch (err) {
      addToast('Failed to load layout settings', 'error');
    }
    setLoading(false);
  };

  const updateField = useCallback((field, value) => {
    setLayouts(prev => ({
      ...prev,
      [activeMode]: { ...prev[activeMode], [field]: value },
    }));
  }, [activeMode]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateReportLayout(layouts);
      addToast('Report layout saved successfully', 'success');
    } catch (err) {
      addToast('Failed to save: ' + err.message, 'error');
    }
    setSaving(false);
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all layout settings to defaults?')) return;
    setSaving(true);
    try {
      const data = await api.resetReportLayout();
      setLayouts({
        pdf: { ...DEFAULT_LAYOUT, ...data.layout?.pdf },
        print: { ...DEFAULT_LAYOUT, ...data.layout?.print },
      });
      addToast('Layout reset to defaults', 'success');
    } catch (err) {
      addToast('Failed to reset: ' + err.message, 'error');
    }
    setSaving(false);
  };

  const sections = [
    { id: 'header', label: 'Header & Letterhead', icon: Image },
    { id: 'content', label: 'Content & Fonts', icon: Type },
    { id: 'columns', label: 'Column Widths', icon: Columns },
    { id: 'footer', label: 'Footer & Signature', icon: ArrowDown },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-primary-600" />
            Report Layout Settings
          </h1>
          <p className="text-gray-500 text-sm mt-1">Adjust report layout to match your letterhead and branding</p>
          {/* Mode toggle: Print / PDF */}
          <div className="flex gap-1 mt-3 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setActiveMode('pdf')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeMode === 'pdf' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              PDF Mode
            </button>
            <button
              onClick={() => setActiveMode('print')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeMode === 'print' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Printer className="w-4 h-4" />
              Print Mode
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <button onClick={handleReset} disabled={saving} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50">
            <RotateCcw className="w-4 h-4" />
            Reset Defaults
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Layout'}
          </button>
        </div>
      </div>

      <div className={`grid gap-4 ${showPreview ? 'grid-cols-2' : 'grid-cols-1 max-w-2xl'}`}>
        {/* Controls Panel */}
        <div className="space-y-3">
          {/* Section tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                  activeSection === s.id ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <s.icon className="w-3.5 h-3.5" />
                {s.label}
              </button>
            ))}
          </div>

          {/* Section content */}
          <div className="card space-y-5 p-5">
            {activeSection === 'header' && (
              <>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Header & Letterhead</h3>
                <SliderField label="Letterhead Image Height" value={layout.letterheadHeight} onChange={(v) => updateField('letterheadHeight', v)} min={60} max={250} unit="px" desc="Height of the letterhead image at top of page" />
                <SliderField label="Top Padding" value={layout.headerTopPadding} onChange={(v) => updateField('headerTopPadding', v)} min={0} max={50} unit="px" desc="Extra space above the letterhead" />
                <SliderField label="Header Bottom Padding" value={layout.headerBottomPadding} onChange={(v) => updateField('headerBottomPadding', v)} min={0} max={30} unit="px" desc="Space below patient info before results" />
                <SliderField label="Title Font Size" value={layout.titleFontSize} onChange={(v) => updateField('titleFontSize', v)} min={10} max={22} unit="px" desc="'LABORATORY INVESTIGATION REPORT' text" />
                <SliderField label="Patient Info Font Size" value={layout.patientInfoFontSize} onChange={(v) => updateField('patientInfoFontSize', v)} min={8} max={16} unit="px" desc="Name, age, date, ref by, etc." />
              </>
            )}

            {activeSection === 'content' && (
              <>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Content & Fonts</h3>
                <SliderField label="Body Font Size" value={layout.bodyFontSize} onChange={(v) => updateField('bodyFontSize', v)} min={9} max={18} unit="px" desc="Base font size for the document" />
                <SliderField label="Result Row Font Size" value={layout.resultFontSize} onChange={(v) => updateField('resultFontSize', v)} min={8} max={16} unit="px" desc="Font size for test result rows" />
                <SliderField label="Left Padding" value={layout.bodyPaddingLeft} onChange={(v) => updateField('bodyPaddingLeft', v)} min={0} max={25} unit="mm" desc="Page left margin" />
                <SliderField label="Right Padding" value={layout.bodyPaddingRight} onChange={(v) => updateField('bodyPaddingRight', v)} min={0} max={25} unit="mm" desc="Page right margin" />
                <SliderField label="Content Top Margin" value={layout.contentTopMargin} onChange={(v) => updateField('contentTopMargin', v)} min={0} max={30} unit="px" desc="Gap between header and first result" />
              </>
            )}

            {activeSection === 'columns' && (
              <>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Column Widths</h3>
                <p className="text-xs text-gray-400">Total must equal 100%. Currently: {layout.colTestWidth + layout.colResultWidth + layout.colRefWidth}%</p>
                <SliderField label="Test Description" value={layout.colTestWidth} onChange={(v) => updateField('colTestWidth', v)} min={20} max={60} unit="%" />
                <SliderField label="Result / Unit" value={layout.colResultWidth} onChange={(v) => updateField('colResultWidth', v)} min={15} max={45} unit="%" />
                <SliderField label="Ref. Range" value={layout.colRefWidth} onChange={(v) => updateField('colRefWidth', v)} min={15} max={45} unit="%" />
                {(layout.colTestWidth + layout.colResultWidth + layout.colRefWidth) !== 100 && (
                  <p className="text-xs text-red-500 font-medium">Column widths must add up to 100%</p>
                )}
              </>
            )}

            {activeSection === 'footer' && (
              <>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Footer & Signature</h3>
                <SliderField label="Footer Height" value={layout.footerHeight} onChange={(v) => updateField('footerHeight', v)} min={60} max={200} unit="px" desc="Total footer area height" />
                <SliderField label="Footer Bottom Offset" value={layout.footerBottomOffset} onChange={(v) => updateField('footerBottomOffset', v)} min={0} max={20} unit="mm" desc="Distance from page bottom" />

                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <label className="text-sm font-medium text-gray-700">Show Signature</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={layout.showSignature} onChange={(e) => updateField('showSignature', e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                {layout.showSignature && (
                  <SliderField label="Signature Height" value={layout.signatureHeight} onChange={(v) => updateField('signatureHeight', v)} min={8} max={40} unit="px" />
                )}

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Doctor Name</label>
                  <input type="text" className="input-field" placeholder="Leave empty for report default" value={layout.doctorName} onChange={(e) => updateField('doctorName', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Doctor Designation</label>
                  <input type="text" className="input-field" placeholder="Leave empty for report default" value={layout.doctorDesignation} onChange={(e) => updateField('doctorDesignation', e.target.value)} />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Footer Note 1</label>
                  <input type="text" className="input-field text-xs" value={layout.footerNote1} onChange={(e) => updateField('footerNote1', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Footer Note 2</label>
                  <input type="text" className="input-field text-xs" value={layout.footerNote2} onChange={(e) => updateField('footerNote2', e.target.value)} />
                </div>

                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <label className="text-sm font-medium text-gray-700">Show Hindi Footer Bar</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={layout.showHindiFooter} onChange={(e) => updateField('showHindiFooter', e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                {layout.showHindiFooter && (
                  <>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">Hindi Footer Text</label>
                      <input type="text" className="input-field text-xs" value={layout.hindiFooterText} onChange={(e) => updateField('hindiFooterText', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">Footer Bar Color</label>
                      <div className="flex items-center gap-3">
                        <input type="color" value={layout.hindiFooterBgColor} onChange={(e) => updateField('hindiFooterBgColor', e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-gray-200" />
                        <input type="text" className="input-field flex-1 font-mono text-sm" value={layout.hindiFooterBgColor} onChange={(e) => updateField('hindiFooterBgColor', e.target.value)} />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Live Preview */}
        {showPreview && (
          <div className="sticky top-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Live Preview</h3>
              <span className="text-xs text-gray-400">A4 at ~50% scale</span>
            </div>
            <ReportPreview layout={layout} mode={activeMode} />
          </div>
        )}
      </div>
    </div>
  );
}
