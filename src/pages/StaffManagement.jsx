import { useState, useEffect } from 'react';
import { UserPlus, Trash2, Edit2, X, Phone, Lock, User, Shield, Save } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function StaffManagement() {
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', password: '', role: 'user' });
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      addToast('Failed to load staff list', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const resetForm = () => {
    setForm({ name: '', phone: '', password: '', role: 'user' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        const updateData = { name: form.name, phone: form.phone, role: form.role };
        if (form.password) updateData.password = form.password;
        await api.updateUser(editingId, updateData);
        addToast('Staff member updated', 'success');
      } else {
        await api.createUser(form);
        addToast('Staff member added', 'success');
      }
      resetForm();
      fetchUsers();
    } catch (err) {
      addToast(err.message || 'Failed to save staff member', 'error');
    }
    setSaving(false);
  };

  const handleEdit = (u) => {
    setForm({ name: u.name, phone: u.phone, password: '', role: u.role });
    setEditingId(u._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to remove this staff member?')) return;
    try {
      await api.deleteUser(id);
      addToast('Staff member removed', 'success');
      fetchUsers();
    } catch (err) {
      addToast(err.message || 'Failed to delete staff member', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Staff Management</h1>
          <p className="text-gray-500 text-sm mt-1 dark:text-gray-50 dark:font-medium">Add and manage staff accounts</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Add Staff
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">
              {editingId ? 'Edit Staff Member' : 'Add New Staff Member'}
            </h3>
            <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Enter full name"
                    className="input-field pl-10"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="Enter phone number"
                    className="input-field pl-10"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editingId ? 'New Password (leave blank to keep)' : 'Password'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder={editingId ? 'Leave blank to keep current' : 'Min 6 characters'}
                    className="input-field pl-10"
                    required={!editingId}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}
                    className="input-field pl-10"
                  >
                    <option value="user">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingId ? 'Update' : 'Add Staff'}
                  </>
                )}
              </button>
              <button type="button" onClick={resetForm} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : users.length === 0 ? (
        <div className="card text-center py-12">
          <User className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No staff members yet</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Phone</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Role</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{u.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'admin' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {u.role === 'admin' && <Shield className="w-3 h-3" />}
                        {u.role === 'admin' ? 'Admin' : 'Staff'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(u)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {u._id !== currentUser?._id && (
                          <button
                            onClick={() => handleDelete(u._id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
