import { useState, useEffect } from 'react';
import { Search, Plus, Phone, Mail, Calendar, X, TestTubes, Check, Minus, Trash2, Edit3, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [tests, setTests] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [editPatient, setEditPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  // New patient form
  const [form, setForm] = useState({ name: '', age: '', gender: '', phone: '', email: '', address: '', referred_by: 'SELF', specimen: 'BLOOD' });
  const [editForm, setEditForm] = useState({ name: '', age: '', gender: '', phone: '', email: '', address: '', referred_by: '' });
  const [selectedTests, setSelectedTests] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState({}); // { testId: ['group1', ...] }
  const [expandedTests, setExpandedTests] = useState({}); // { testId: true/false }
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [pats, tsts] = await Promise.all([api.getPatients(), api.getTests()]);
      setPatients(pats);
      setTests(tsts);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  const filteredPatients = patients.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone?.includes(searchTerm)
  );

  // Get unique sub-groups for a test
  const getTestGroups = (test) => {
    const params = test.parameters || [];
    return [...new Set(params.map(p => p.group_name || test.name))];
  };

  const toggleTest = (testId) => {
    const test = tests.find(t => t._id === testId);
    const allGroups = test ? getTestGroups(test) : [];
    const isSelected = selectedTests.includes(testId);
    if (isSelected) {
      setSelectedTests(prev => prev.filter(id => id !== testId));
      setSelectedGroups(prev => { const n = { ...prev }; delete n[testId]; return n; });
    } else {
      setSelectedTests(prev => [...prev, testId]);
      setSelectedGroups(prev => ({ ...prev, [testId]: [...allGroups] }));
    }
  };

  const toggleSubGroup = (testId, groupName) => {
    const test = tests.find(t => t._id === testId);
    const currentGroups = selectedGroups[testId] || [];
    const isGroupSelected = currentGroups.includes(groupName);
    let newGroups = isGroupSelected ? currentGroups.filter(g => g !== groupName) : [...currentGroups, groupName];
    if (newGroups.length === 0) {
      setSelectedTests(prev => prev.filter(id => id !== testId));
      setSelectedGroups(prev => { const n = { ...prev }; delete n[testId]; return n; });
    } else {
      if (!selectedTests.includes(testId)) setSelectedTests(prev => [...prev, testId]);
      setSelectedGroups(prev => ({ ...prev, [testId]: newGroups }));
    }
  };

  const getTestCheckState = (testId) => {
    if (!selectedTests.includes(testId)) return 'none';
    const test = tests.find(t => t._id === testId);
    const allGroups = test ? getTestGroups(test) : [];
    const selGroups = selectedGroups[testId] || [];
    if (selGroups.length >= allGroups.length) return 'all';
    return 'partial';
  };

  const handleAddPatient = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const patient = await api.createPatient({
        ...form,
        age: parseInt(form.age) || 0,
      });

      // If tests are selected, create a report
      if (selectedTests.length > 0) {
        await api.createReport({
          patient_id: patient._id,
          test_ids: selectedTests,
          specimen: form.specimen,
        });
      }

      setForm({ name: '', age: '', gender: '', phone: '', email: '', address: '', referred_by: 'SELF', specimen: 'BLOOD' });
      setSelectedTests([]);
      setShowAddModal(false);
      loadData();
      addToast('Patient registered successfully', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
    setSaving(false);
  };

  const handleDeletePatient = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this patient? All associated reports will also be deleted.')) return;
    try {
      await api.deletePatient(id);
      loadData();
      if (selectedPatient?._id === id) setSelectedPatient(null);
      addToast('Patient deleted successfully', 'success');
    } catch (err) {
      addToast('Failed to delete: ' + err.message, 'error');
    }
  };

  const handleEditPatient = (patient, e) => {
    e.stopPropagation();
    setEditForm({
      name: patient.name || '',
      age: patient.age || '',
      gender: patient.gender || '',
      phone: patient.phone || '',
      email: patient.email || '',
      address: patient.address || '',
      referred_by: patient.referred_by || 'SELF',
    });
    setEditPatient(patient);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updatePatient(editPatient._id, { ...editForm, age: parseInt(editForm.age) || 0 });
      setEditPatient(null);
      loadData();
      addToast('Patient updated successfully', 'success');
    } catch (err) {
      addToast('Failed to update: ' + err.message, 'error');
    }
    setSaving(false);
  };

  // Group tests by category
  const testsByCategory = tests.reduce((acc, test) => {
    const cat = test.category_name || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(test);
    return acc;
  }, {});

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-500 text-sm mt-1">Manage patient records and create test orders</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 w-fit">
          <Plus className="w-4 h-4" />
          Add Patient
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Patients Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Age/Gender</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Referred By</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Registered</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPatients.map((patient) => (
                <tr key={patient._id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedPatient(patient)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-semibold text-primary-700">
                          {patient.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{patient.name}</p>
                        <p className="text-xs text-gray-500 sm:hidden">{patient.age} / {patient.gender}</p>
                        {patient.phone && <p className="text-xs text-gray-400 md:hidden">{patient.phone}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="space-y-1">
                      {patient.phone && <div className="flex items-center gap-1.5 text-xs text-gray-600"><Phone className="w-3 h-3" />{patient.phone}</div>}
                      {patient.email && <div className="flex items-center gap-1.5 text-xs text-gray-600"><Mail className="w-3 h-3" />{patient.email}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-sm text-gray-700">{patient.age} / {patient.gender}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-sm text-gray-600">{patient.referred_by || 'SELF'}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(patient.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleEditPatient(patient, e)}
                        className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Patient"
                      >
                        <Edit3 className="w-4 h-4 text-blue-500" />
                      </button>
                      <button
                        onClick={(e) => handleDeletePatient(patient._id, e)}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Patient"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredPatients.length === 0 && (
          <div className="text-center py-12"><p className="text-gray-500">No patients found.</p></div>
        )}
      </div>

      {/* Add Patient Modal with Test Selection */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Register New Patient</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAddPatient} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input type="text" className="input-field" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" className="input-field" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                  <input type="number" className="input-field" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select className="input-field" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referred By</label>
                  <input type="text" className="input-field" value={form.referred_by} onChange={e => setForm({ ...form, referred_by: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specimen</label>
                <input type="text" className="input-field" value={form.specimen} onChange={e => setForm({ ...form, specimen: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="input-field" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input type="text" className="input-field" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </div>

              {/* Test Selection - Hierarchical Tree */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                  <TestTubes className="w-4 h-4 text-primary-600" />
                  Select Tests to Perform ({selectedTests.length} selected)
                </h3>
                <div className="space-y-1 max-h-60 overflow-y-auto pr-2">
                  {Object.entries(testsByCategory).map(([category, catTests]) => (
                    <div key={category} className="mb-1">
                      <p className="text-xs font-bold text-gray-700 uppercase py-1">{category}</p>
                      {catTests.map(test => {
                        const groups = getTestGroups(test);
                        const hasSubGroups = groups.length > 1;
                        const checkState = getTestCheckState(test._id);
                        const isExpanded = expandedTests[test._id];
                        return (
                        <div key={test._id} className="ml-1">
                          <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-all ${
                            checkState !== 'none' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'
                          }`}>
                            {hasSubGroups ? (
                              <button type="button" className="p-0.5 hover:bg-gray-200 rounded flex-shrink-0"
                                onClick={(e) => { e.stopPropagation(); setExpandedTests(prev => ({ ...prev, [test._id]: !prev[test._id] })); }}>
                                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              </button>
                            ) : <span className="w-4" />}
                            <button type="button" className="flex items-center gap-2 flex-1 text-left" onClick={() => toggleTest(test._id)}>
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                                checkState === 'all' ? 'bg-primary-600 border-primary-600' :
                                checkState === 'partial' ? 'bg-primary-400 border-primary-400' : 'border-gray-300'
                              }`}>
                                {checkState === 'all' && <Check className="w-2.5 h-2.5 text-white" />}
                                {checkState === 'partial' && <Minus className="w-2.5 h-2.5 text-white" />}
                              </div>
                              <span className="truncate font-medium">{test.name}</span>
                            </button>
                          </div>
                          {hasSubGroups && isExpanded && (
                            <div className="ml-6 border-l border-gray-200 pl-2 my-0.5">
                              {groups.map(groupName => {
                                const isGroupSelected = (selectedGroups[test._id] || []).includes(groupName);
                                return (
                                  <button key={groupName} type="button" onClick={() => toggleSubGroup(test._id, groupName)}
                                    className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-left mb-0.5 transition-all ${
                                      isGroupSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
                                    }`}>
                                    <div className={`w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0 ${
                                      isGroupSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                                    }`}>
                                      {isGroupSelected && <Check className="w-2 h-2 text-white" />}
                                    </div>
                                    <span className="truncate">{groupName}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
                  {saving ? 'Saving...' : selectedTests.length > 0 ? 'Register & Create Report' : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patient Detail Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 m-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Patient Details</h2>
              <button onClick={() => setSelectedPatient(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-xl font-bold text-primary-700">
                  {selectedPatient.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900">{selectedPatient.name}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Age / Gender</span>
                <span className="text-sm font-medium text-gray-900">{selectedPatient.age} / {selectedPatient.gender}</span>
              </div>
              {selectedPatient.phone && <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Phone</span>
                <span className="text-sm font-medium text-gray-900">{selectedPatient.phone}</span>
              </div>}
              {selectedPatient.email && <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Email</span>
                <span className="text-sm font-medium text-gray-900">{selectedPatient.email}</span>
              </div>}
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Referred By</span>
                <span className="text-sm font-medium text-gray-900">{selectedPatient.referred_by || 'SELF'}</span>
              </div>
              {selectedPatient.address && <div className="flex justify-between py-2">
                <span className="text-sm text-gray-500">Address</span>
                <span className="text-sm font-medium text-gray-900 text-right max-w-[200px]">{selectedPatient.address}</span>
              </div>}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { handleEditPatient(selectedPatient, { stopPropagation: () => {} }); setSelectedPatient(null); }} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                <Edit3 className="w-4 h-4" /> Edit
              </button>
              <button onClick={() => setSelectedPatient(null)} className="btn-primary flex-1">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Patient Modal */}
      {editPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Edit Patient</h2>
              <button onClick={() => setEditPatient(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input type="text" className="input-field" required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                  <input type="number" className="input-field" value={editForm.age} onChange={e => setEditForm({ ...editForm, age: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select className="input-field" value={editForm.gender} onChange={e => setEditForm({ ...editForm, gender: e.target.value })}>
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" className="input-field" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="input-field" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input type="text" className="input-field" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Referred By</label>
                <input type="text" className="input-field" value={editForm.referred_by} onChange={e => setEditForm({ ...editForm, referred_by: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditPatient(null)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
