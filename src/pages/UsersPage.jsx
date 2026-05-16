import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, Plus, Edit2, Trash2, Save, X, Search, Shield, User, Eye, EyeOff, KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { adminCreateUser, resetUserPassword } from '@/lib/adminUserService';
import { useAuthStore } from '@/stores/authStore';
import { logActivity, AUDIT_ACTIONS } from '@/services/auditLogService';
import { QUERY_KEYS, USER_ROLE_OPTIONS } from '@/lib/constants';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';

export default function UsersPage() {
  const { user, session } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode]   = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, id: null });
  const [formData, setFormData] = useState({
    id: '', username: '', password: '', role: 'user', divisi_id: '',
  });
  const [resetForm, setResetForm] = useState({ userId: '', username: '', newPassword: '', show: false });
  const [resetResult, setResetResult] = useState(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: [QUERY_KEYS.USERS],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users').select('*, divisions(id, name)').order('username', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && user.role === 'admin',
  });

  const { data: divisions = [] } = useQuery({
    queryKey: [QUERY_KEYS.DIVISIONS],
    queryFn: async () => {
      const { data, error } = await supabase.from('divisions').select('*').order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && user.role === 'admin',
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      await adminCreateUser({ username: data.username, password: data.password, role: data.role, divisi_id: data.divisi_id }, supabase);
    },
    onSuccess: async () => {
      await logActivity({ userId: user.id, username: user.username, action: AUDIT_ACTIONS.CREATE_USER, entity: 'users', detail: `Buat user: ${formData.username}` });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.USERS] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase.from('users').update({ role: data.role, divisi_id: data.divisi_id || null }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.USERS] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const targetUser = users.find(u => u.id === id);
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      await logActivity({ userId: user.id, username: user.username, action: AUDIT_ACTIONS.DELETE_USER, entity: 'users', entityId: id, detail: `Hapus user: ${targetUser?.username}` });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.USERS] }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, username, newPassword }) => {
      const result = await resetUserPassword({ userId, username, newPassword });
      return result;
    },
    onSuccess: async (result) => {
      await logActivity({ userId: user.id, username: user.username, action: AUDIT_ACTIONS.RESET_PASSWORD, entity: 'users', entityId: resetForm.userId, detail: `Reset password user: ${resetForm.username}` });
      setResetResult(result.message);
    },
  });

  const openCreateModal = () => {
    setFormData({ id: '', username: '', password: '', role: 'user', divisi_id: '' });
    setIsEditMode(false); setIsResetMode(false); setShowPassword(false); setIsModalOpen(true);
  };
  const openEditModal = (u) => {
    setFormData({ id: u.id, username: u.username, password: '', role: u.role, divisi_id: u.divisi_id || '' });
    setIsEditMode(true); setIsResetMode(false); setShowPassword(false); setIsModalOpen(true);
  };
  const openResetModal = (u) => {
    setResetForm({ userId: u.id, username: u.username, newPassword: '', show: false });
    setResetResult(null);
    setIsResetMode(true); setIsEditMode(false); setIsModalOpen(true);
  };
  const closeModal = () => {
    setIsModalOpen(false);
    createMutation.reset(); updateMutation.reset(); resetPasswordMutation.reset();
    setResetResult(null);
    setFormData({ id: '', username: '', password: '', role: 'user', divisi_id: '' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isResetMode) {
      resetPasswordMutation.mutate({ userId: resetForm.userId, username: resetForm.username, newPassword: resetForm.newPassword });
      return;
    }
    if (isEditMode) { updateMutation.mutate({ id: formData.id, data: formData }); }
    else { createMutation.mutate(formData); }
  };

  const confirmDelete = () => {
    if (confirmDialog.id) { deleteMutation.mutate(confirmDialog.id); setConfirmDialog({ isOpen: false, id: null }); }
  };

  const filteredUsers = users.filter((u) => {
    const matchSearch = u.username.toLowerCase().includes(search.toLowerCase());
    const matchRole   = roleFilter ? u.role === roleFilter : true;
    return matchSearch && matchRole;
  });

  const getRoleStyle = (role) => role === 'admin' ? 'bg-primary-100 text-primary-800' : 'bg-primary-100 text-primary-800';

  if (user?.role !== 'admin') {
    return <div className="text-center py-12"><p className="text-slate-600">Anda tidak memiliki akses ke halaman ini.</p></div>;
  }

  const isMutating   = createMutation.isLoading || updateMutation.isLoading;
  const mutationError = createMutation.error?.message || updateMutation.error?.message;
  const modalTitle   = isResetMode ? 'Reset Password User' : isEditMode ? 'Edit User' : 'Tambah User Baru';

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-primary-600" />
            <h1 className="text-3xl font-bold text-slate-900">Manajemen User</h1>
          </div>
          <button onClick={openCreateModal} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
            <Plus className="w-5 h-5" /> Tambah User
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl shadow flex items-center gap-4">
            <div className="p-3 bg-primary-100 rounded-lg"><Users className="w-6 h-6 text-primary-600" /></div>
            <div><p className="text-sm text-slate-500">Total User</p><p className="text-2xl font-bold text-slate-900">{users.length}</p></div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow flex items-center gap-4">
            <div className="p-3 bg-primary-100 rounded-lg"><Shield className="w-6 h-6 text-primary-600" /></div>
            <div><p className="text-sm text-slate-500">Administrator</p><p className="text-2xl font-bold text-slate-900">{users.filter(u => u.role === 'admin').length}</p></div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow flex items-center gap-4">
            <div className="p-3 bg-primary-100 rounded-lg"><User className="w-6 h-6 text-primary-600" /></div>
            <div><p className="text-sm text-slate-500">User Biasa</p><p className="text-2xl font-bold text-slate-900">{users.filter(u => u.role === 'user').length}</p></div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="text" placeholder="Cari username..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent">
              <option value="">Semua Role</option>
              <option value="admin">Administrator</option>
              <option value="user">User Biasa</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
            <p className="mt-4 text-slate-600">Memuat user...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">Belum ada user ditemukan.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Username</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Role</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Divisi</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Dibuat</th>
                  <th className="text-right px-6 py-3 text-sm font-semibold text-slate-600">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u, index) => (
                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.03 }} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-primary-700 font-bold text-sm">{u.username.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{u.username}</p>
                          {u.id === user.id && <span className="text-xs text-primary-500">(Anda)</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleStyle(u.role)}`}>
                        {u.role === 'admin' ? 'Administrator' : 'User Biasa'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{u.divisions?.name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{new Date(u.created_at).toLocaleDateString('id-ID')}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEditModal(u)} title="Edit User"
                          className="p-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {u.id !== user.id && (
                          <>
                            <button onClick={() => openResetModal(u)} title="Reset Password"
                              className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors">
                              <KeyRound className="w-4 h-4" />
                            </button>
                            <button onClick={() => setConfirmDialog({ isOpen: true, id: u.id })} title="Hapus User"
                              className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={modalTitle} size="md">
        {isResetMode ? (
          /* ─── Reset Password Form ─── */
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
              Reset password untuk user: <strong>{resetForm.username}</strong>
            </div>

            {resetResult ? (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                ✓ {resetResult}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Password Baru <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={resetForm.show ? 'text' : 'password'}
                      value={resetForm.newPassword}
                      onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                      placeholder="Minimal 6 karakter..."
                      className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      required minLength={6}
                    />
                    <button type="button" onClick={() => setResetForm({ ...resetForm, show: !resetForm.show })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {resetForm.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {resetPasswordMutation.error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {resetPasswordMutation.error.message}
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-4 border-t">
                  <button type="button" onClick={closeModal}
                    className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium flex items-center gap-2">
                    <X className="w-4 h-4" /> Batal
                  </button>
                  <button type="submit" disabled={resetPasswordMutation.isLoading}
                    className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium flex items-center gap-2 disabled:opacity-50">
                    <KeyRound className="w-4 h-4" />
                    {resetPasswordMutation.isLoading ? 'Mereset...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            )}

            {resetResult && (
              <div className="flex justify-end pt-2 border-t">
                <button onClick={closeModal} className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium">
                  Tutup
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ─── Create / Edit Form ─── */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Username <span className="text-red-500">*</span></label>
              <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Username..." className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-500"
                required disabled={isEditMode} />
              {isEditMode && <p className="text-xs text-slate-400 mt-1">Username tidak dapat diubah.</p>}
            </div>

            {!isEditMode && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Password User Baru <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Minimal 6 karakter..."
                    className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required minLength={6} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Role <span className="text-red-500">*</span></label>
              <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" required>
                {USER_ROLE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Divisi (Opsional)</label>
              <select value={formData.divisi_id} onChange={(e) => setFormData({ ...formData, divisi_id: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                <option value="">-- Pilih Divisi --</option>
                {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            {mutationError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{mutationError}</div>
            )}

            <div className="flex gap-3 justify-end pt-4 border-t">
              <button type="button" onClick={closeModal}
                className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium flex items-center gap-2">
                <X className="w-4 h-4" /> Batal
              </button>
              <button type="submit" disabled={isMutating}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50">
                <Save className="w-4 h-4" />
                {isMutating ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title="Hapus User"
        message="Yakin ingin menghapus user ini? Semua data terkait user ini akan ikut terhapus."
        confirmText="Hapus"
        type="danger"
      />
    </div>
  );
}
