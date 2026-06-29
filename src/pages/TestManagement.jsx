import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit3, Trash2, Save, X, ChevronDown, ChevronRight, FlaskConical, FolderOpen, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export default function TestManagement() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [tests, setTests] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Category modal
  const [showCatModal, setShowCatModal] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [catName, setCatName] = useState('');

  // Test modal
  const [showTestModal, setShowTestModal] = useState(false);
  const [editTest, setEditTest] = useState(null);
  const [testForm, setTestForm] = useState({ name: '', category_id: '', specimen: 'BLOOD', parameters: [] });

  // Expanded categories
  const [expandedCats, setExpandedCats] = useState({});

  // Expanded test (to show parameters inline)
  const [expandedTest, setExpandedTest] = useState(null);

  // Sorting
  const [catSort, setCatSort] = useState({ field: 'name', dir: 'asc' });
  const [testSort, setTestSort] = useState({ field: 'name', dir: 'asc' });

  const handleCatSort = (field) => setCatSort(prev => ({ field, dir: prev.field === field ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'asc' }));
  const handleTestSort = (field) => setTestSort(prev => ({ field, dir: prev.field === field ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'asc' }));

  const SortBtn = ({ label, field, sort, onSort }) => {
    const active = sort.field === field;
    const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <button onClick={() => onSort(field)} className={`flex items-center gap-1 text-xs font-medium transition-colors ${ active ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600' }`}>
        {label}<Icon className="w-3 h-3" />
      </button>
    );
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 text-lg">Access denied. Admin only.</p>
      </div>
    );
  }

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [testsData, catsData] = await Promise.all([api.getTests(), api.getCategories()]);
      setTests(testsData);
      setCategories(catsData);
    } catch (err) {
      addToast('Failed to load data: ' + err.message, 'error');
    }
    setLoading(false);
  };

  // ---- Category handlers ----
  const openCatModal = (cat = null) => {
    setEditCat(cat);
    setCatName(cat ? cat.name : '');
    setShowCatModal(true);
  };

  const saveCat = async () => {
    if (!catName.trim()) { addToast('Category name required', 'warning'); return; }
    try {
      if (editCat) {
        await api.updateCategory(editCat._id, { name: catName });
        addToast('Category updated', 'success');
      } else {
        await api.createCategory({ name: catName });
        addToast('Category created', 'success');
      }
      setShowCatModal(false);
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const deleteCat = async (cat) => {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await api.deleteCategory(cat._id);
      addToast('Category deleted', 'success');
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // ---- Test handlers ----
  const openTestModal = (test = null) => {
    if (test) {
      setEditTest(test);
      setTestForm({
        name: test.name,
        category_id: test.category_id || '',
        specimen: test.specimen || 'BLOOD',
        parameters: (test.parameters || []).map(p => ({ ...p })),
      });
    } else {
      setEditTest(null);
      setTestForm({ name: '', category_id: '', specimen: 'BLOOD', parameters: [] });
    }
    setShowTestModal(true);
  };

  const saveTest = async () => {
    if (!testForm.name.trim()) { addToast('Test name required', 'warning'); return; }
    try {
      const payload = {
        name: testForm.name,
        category_id: testForm.category_id || null,
        specimen: testForm.specimen,
        parameters: testForm.parameters.map((p, idx) => ({
          ...p,
          id: p.id || idx + 1,
          sort_order: p.sort_order || idx + 1,
        })),
      };
      if (editTest) {
        await api.updateTest(editTest._id, payload);
        addToast('Test updated', 'success');
      } else {
        await api.createTest(payload);
        addToast('Test created', 'success');
      }
      setShowTestModal(false);
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const deleteTest = async (test) => {
    if (!confirm(`Delete test "${test.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteTest(test._id);
      addToast('Test deleted', 'success');
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // ---- Parameter helpers ----
  const addParam = () => {
    const nextId = testForm.parameters.length > 0 ? Math.max(...testForm.parameters.map(p => p.id || 0)) + 1 : 1;
    setTestForm(prev => ({
      ...prev,
      parameters: [...prev.parameters, {
        id: nextId,
        param_name: '',
        unit: '',
        ref_range_male: '',
        ref_range_female: '',
        group_name: prev.name || '',
        sort_order: prev.parameters.length + 1,
        calc_formula: '',
        calc_decimals: null,
      }],
    }));
  };

  const updateParam = (idx, field, value) => {
    setTestForm(prev => {
      const params = [...prev.parameters];
      params[idx] = { ...params[idx], [field]: value };
      return { ...prev, parameters: params };
    });
  };

  const removeParam = (idx) => {
    setTestForm(prev => ({
      ...prev,
      parameters: prev.parameters.filter((_, i) => i !== idx),
    }));
  };

  const toggleCat = (catId) => {
    setExpandedCats(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  // Group tests by category (memoized)
  const { groupedTests, filteredCategories, uncategorized } = useMemo(() => { // eslint-disable-next-line
    const catMap = {};
    categories.forEach(c => { catMap[c._id] = c.name; });

    const grouped = {};
    const uncategorizedTests = [];
    tests.forEach(t => {
      const catId = t.category_id;
      if (catId && catMap[catId]) {
        if (!grouped[catId]) grouped[catId] = [];
        grouped[catId].push(t);
      } else {
        uncategorizedTests.push(t);
      }
    });

    const filtered = categories.filter(c => {
      if (!search) return true;
      const s = search.toLowerCase();
      if (c.name.toLowerCase().includes(s)) return true;
      const catTests = grouped[c._id] || [];
      return catTests.some(t => t.name.toLowerCase().includes(s));
    });

    // Sort categories
    const sortedFiltered = [...filtered].sort((a, b) => {
      let aVal = catSort.field === 'count' ? (grouped[a._id]?.length || 0) : a.name.toLowerCase();
      let bVal = catSort.field === 'count' ? (grouped[b._id]?.length || 0) : b.name.toLowerCase();
      if (aVal < bVal) return catSort.dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return catSort.dir === 'asc' ? 1 : -1;
      return 0;
    });

    const filteredUncategorized = (search
      ? uncategorizedTests.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
      : uncategorizedTests
    ).sort((a, b) => {
      const aVal = testSort.field === 'params' ? (a.parameters?.length || 0) : a.name.toLowerCase();
      const bVal = testSort.field === 'params' ? (b.parameters?.length || 0) : b.name.toLowerCase();
      if (aVal < bVal) return testSort.dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return testSort.dir === 'asc' ? 1 : -1;
      return 0;
    });

    return { groupedTests: grouped, filteredCategories: sortedFiltered, uncategorized: filteredUncategorized };
  }, [tests, categories, search, catSort, testSort]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Test Management</h1>
          <p className="text-gray-500 text-sm mt-1 dark:text-gray-50 dark:font-medium">Manage test categories, tests, and parameters</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => openCatModal()} className="btn-secondary flex items-center gap-2 text-sm">
            <FolderOpen className="w-4 h-4" /> Add Category
          </button>
          <button onClick={() => openTestModal()} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add Test
          </button>
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
      <div className="relative max-w-md flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search tests or categories..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        />
      </div>
      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2">
        <span className="text-xs text-gray-400 font-medium">Categories:</span>
        <SortBtn label="Name" field="name" sort={catSort} onSort={handleCatSort} />
        <SortBtn label="Count" field="count" sort={catSort} onSort={handleCatSort} />
        <span className="text-gray-200">|</span>
        <span className="text-xs text-gray-400 font-medium">Tests:</span>
        <SortBtn label="Name" field="name" sort={testSort} onSort={handleTestSort} />
        <SortBtn label="Params" field="params" sort={testSort} onSort={handleTestSort} />
      </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-2xl font-bold text-primary-600">{categories.length}</p>
          <p className="text-xs text-gray-500">Categories</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-primary-600">{tests.length}</p>
          <p className="text-xs text-gray-500">Tests</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-primary-600">{tests.reduce((sum, t) => sum + (t.parameters?.length || 0), 0)}</p>
          <p className="text-xs text-gray-500">Total Parameters</p>
        </div>
      </div>

      {/* Categories & Tests */}
      <div className="space-y-3">
        {filteredCategories.map(cat => {
          const catTests = (groupedTests[cat._id] || []).filter(t =>
            !search || t.name.toLowerCase().includes(search.toLowerCase()) || cat.name.toLowerCase().includes(search.toLowerCase())
          ).sort((a, b) => {
            const aVal = testSort.field === 'params' ? (a.parameters?.length || 0) : a.name.toLowerCase();
            const bVal = testSort.field === 'params' ? (b.parameters?.length || 0) : b.name.toLowerCase();
            if (aVal < bVal) return testSort.dir === 'asc' ? -1 : 1;
            if (aVal > bVal) return testSort.dir === 'asc' ? 1 : -1;
            return 0;
          });
          const isExpanded = expandedCats[cat._id] !== false; // default expanded

          return (
            <div key={cat._id} className="card p-0 overflow-hidden">
              {/* Category Header */}
              <div
                className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleCat(cat._id)}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                  <FolderOpen className="w-4 h-4 text-primary-600" />
                  <span className="font-semibold text-gray-800 text-sm">{cat.name}</span>
                  <span className="text-xs text-gray-400 ml-1">({catTests.length} tests)</span>
                </div>
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openCatModal(cat)} className="p-1.5 hover:bg-gray-200 rounded text-gray-500" title="Edit category">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteCat(cat)} className="p-1.5 hover:bg-red-50 rounded text-red-500" title="Delete category">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Tests in category */}
              {isExpanded && (
                <div className="divide-y divide-gray-100">
                  {catTests.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-gray-400 italic">No tests in this category</p>
                  ) : (
                    catTests.map(test => (
                      <div key={test._id}>
                        <div className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                          <div
                            className="flex items-center gap-2 flex-1 cursor-pointer"
                            onClick={() => setExpandedTest(expandedTest === test._id ? null : test._id)}
                          >
                            {expandedTest === test._id ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                            <FlaskConical className="w-4 h-4 text-primary-500" />
                            <span className="text-sm text-gray-700">{test.name}</span>
                            <span className="text-xs text-gray-400">({test.parameters?.length || 0} params)</span>
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{test.specimen}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openTestModal(test)} className="p-1.5 hover:bg-gray-200 rounded text-gray-500" title="Edit test">
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => deleteTest(test)} className="p-1.5 hover:bg-red-50 rounded text-red-500" title="Delete test">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Inline parameter view */}
                        {expandedTest === test._id && test.parameters?.length > 0 && (
                          <div className="bg-gray-50 px-4 py-2 border-t border-gray-100">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500 border-b border-gray-200">
                                  <th className="text-left py-1 font-medium">#</th>
                                  <th className="text-left py-1 font-medium">Parameter</th>
                                  <th className="text-left py-1 font-medium">Unit</th>
                                  <th className="text-left py-1 font-medium">Ref (Male)</th>
                                  <th className="text-left py-1 font-medium">Ref (Female)</th>
                                  <th className="text-left py-1 font-medium">Group</th>
                                </tr>
                              </thead>
                              <tbody>
                                {test.parameters.map((p, idx) => (
                                  <tr key={idx} className="border-b border-gray-100">
                                    <td className="py-1 text-gray-400">{idx + 1}</td>
                                    <td className="py-1 text-gray-700">
                                      {p.param_name}
                                      {p.calc_formula && <span className="text-blue-500 text-[10px] ml-1" title={p.calc_formula}>calc</span>}
                                    </td>
                                    <td className="py-1 text-gray-500">{p.unit || '-'}</td>
                                    <td className="py-1 text-gray-500">{p.ref_range_male || '-'}</td>
                                    <td className="py-1 text-gray-500">{p.ref_range_female || '-'}</td>
                                    <td className="py-1 text-gray-500">{p.group_name || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Uncategorized tests */}
        {uncategorized.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 bg-yellow-50">
              <span className="font-semibold text-yellow-800 text-sm">Uncategorized ({uncategorized.length})</span>
            </div>
            <div className="divide-y divide-gray-100">
              {uncategorized.map(test => (
                <div key={test._id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm text-gray-700">{test.name}</span>
                    <span className="text-xs text-gray-400">({test.parameters?.length || 0} params)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openTestModal(test)} className="p-1.5 hover:bg-gray-200 rounded text-gray-500">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteTest(test)} className="p-1.5 hover:bg-red-50 rounded text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========== Category Modal ========== */}
      {showCatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 m-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editCat ? 'Edit Category' : 'Add Category'}</h2>
              <button onClick={() => setShowCatModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <input
              type="text"
              value={catName}
              onChange={e => setCatName(e.target.value)}
              placeholder="Category name (e.g. HEMATOLOGY)"
              className="input-field w-full mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCatModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveCat} className="btn-primary flex items-center gap-2">
                <Save className="w-4 h-4" /> {editCat ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== Test Modal ========== */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl p-6 m-4 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editTest ? 'Edit Test' : 'Add New Test'}</h2>
              <button onClick={() => setShowTestModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Test info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Test Name *</label>
                <input
                  type="text"
                  value={testForm.name}
                  onChange={e => setTestForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input-field w-full"
                  placeholder="e.g. Complete Blood Count (CBC)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={testForm.category_id}
                  onChange={e => setTestForm(prev => ({ ...prev, category_id: e.target.value }))}
                  className="input-field w-full"
                >
                  <option value="">-- Select Category --</option>
                  {categories.map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specimen</label>
                <input
                  type="text"
                  value={testForm.specimen}
                  onChange={e => setTestForm(prev => ({ ...prev, specimen: e.target.value }))}
                  className="input-field w-full"
                  placeholder="e.g. BLOOD, URINE"
                />
              </div>
            </div>

            {/* Parameters */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Parameters ({testForm.parameters.length})</h3>
                <button onClick={addParam} className="btn-secondary flex items-center gap-1 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Add Parameter
                </button>
              </div>

              {testForm.parameters.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-4 text-center">No parameters yet. Click "Add Parameter" to begin.</p>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-1 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">
                    <div className="col-span-3">Parameter Name</div>
                    <div className="col-span-1">Unit</div>
                    <div className="col-span-2">Ref (Male)</div>
                    <div className="col-span-2">Ref (Female)</div>
                    <div className="col-span-2">Group Name</div>
                    <div className="col-span-1">Order</div>
                    <div className="col-span-1"></div>
                  </div>
                  <div className="grid grid-cols-12 gap-1 bg-blue-50 px-3 py-1 text-[10px] text-blue-600 border-b border-blue-100">
                    <div className="col-span-12">Calc Formula (optional): Use other param names with + - * / e.g. "Total Bilirubin - Direct Bilirubin"</div>
                  </div>
                  {/* Rows */}
                  {testForm.parameters.map((param, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1 px-3 py-1.5 border-b border-gray-100 items-center">
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={param.param_name}
                          onChange={e => updateParam(idx, 'param_name', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-primary-500 outline-none"
                          placeholder="e.g. Haemoglobin"
                        />
                      </div>
                      <div className="col-span-1">
                        <input
                          type="text"
                          value={param.unit}
                          onChange={e => updateParam(idx, 'unit', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-primary-500 outline-none"
                          placeholder="g/dL"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={param.ref_range_male}
                          onChange={e => updateParam(idx, 'ref_range_male', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-primary-500 outline-none"
                          placeholder="13.0 - 17.0"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={param.ref_range_female}
                          onChange={e => updateParam(idx, 'ref_range_female', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-primary-500 outline-none"
                          placeholder="12.0 - 15.0"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={param.group_name}
                          onChange={e => updateParam(idx, 'group_name', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-primary-500 outline-none"
                          placeholder="Group"
                        />
                      </div>
                      <div className="col-span-1">
                        <input
                          type="number"
                          value={param.sort_order}
                          onChange={e => updateParam(idx, 'sort_order', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-primary-500 outline-none"
                          min="1"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button onClick={() => removeParam(idx)} className="p-1 hover:bg-red-50 rounded text-red-500" title="Remove parameter">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {/* Calc formula row (collapsible) */}
                      <div className="col-span-12 flex items-center gap-2 py-1 bg-blue-50/30 rounded px-2">
                        <span className="text-[10px] text-blue-600 font-medium whitespace-nowrap">Calc:</span>
                        <input
                          type="text"
                          value={param.calc_formula || ''}
                          onChange={e => updateParam(idx, 'calc_formula', e.target.value)}
                          className="flex-1 px-2 py-0.5 border border-blue-200 rounded text-[11px] focus:ring-1 focus:ring-blue-400 outline-none"
                          placeholder="e.g. Total Bilirubin - Direct Bilirubin (leave empty for manual entry)"
                        />
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">Decimals:</span>
                        <input
                          type="number"
                          value={param.calc_decimals ?? ''}
                          onChange={e => updateParam(idx, 'calc_decimals', e.target.value === '' ? null : parseInt(e.target.value))}
                          className="w-12 px-1 py-0.5 border border-blue-200 rounded text-[11px] text-center focus:ring-1 focus:ring-blue-400 outline-none"
                          placeholder="2"
                          min="0"
                          max="6"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t border-gray-200">
              <button onClick={() => setShowTestModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveTest} className="btn-primary flex items-center gap-2">
                <Save className="w-4 h-4" /> {editTest ? 'Update Test' : 'Create Test'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
