import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, Plus, Edit2, Trash2, Save, X, Search, Shield, User, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { QUERY_KEYS, USER_ROLE_OPTIONS } from '@/lib/constants';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';

export default function UsersPage() {
  const { user, session } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, id: null });
  const [formData, setFormData] = useState({
    id: '',
    username: '',
    password: '',
    role: 'user',
    divisi_id: '',
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: [QUERY_KEYS.USERS],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*, divisions(id, name)')
        .order('username', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && user.role === 'admin',
  });

  const { data: divisions = [] } = useQuery({
    queryKey: [QUERY_KEYS.DIVISIONS],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('divisions')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && user.role === 'admin',
  });

  // Create user: signUp new user, insert profile, then re-login as admin
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const adminEmail = `${user.username}@app.local`;
      const adminPassword = data._adminPassword;

      if (!adminPassword) throw new Error('Password admin diperlukan untuk konfirmasi.');

      // 1. Sign up new user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: `${data.username}@app.local`,
        password: data.password,
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          throw new Error('Username sudah digunakan.');
        }
        throw new Error(signUpError.message);
      }

      const newUserId = signUpData?.user?.id;
      if (!newUserId) throw new Error('Gagal membuat akun user baru.');

      // 2. Insert profile
      const { error: profileError } = await supabase
        .from('users')
        .insert([{
          id: newUserId,
          username: data.username,
          role: data.role,
          divisi_id: data.divisi_id || null,
        }]);

      if (profileError) throw new Error(profileError.message);

      // 3. Re-login as admin to restore session
      const { error: reLoginError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      });

      if (reLoginError) {
        throw new Error('User berhasil dibuat, tapi gagal restore sesi admin. Silakan login ulang.');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries([QUERY_KEYS.USERS]);
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase
        .from('users')
        .update({ role: data.role, divisi_id: data.divisi_id || null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries([QUERY_KEYS.USERS]);
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries([QUERY_KEYS.USERS]),
  });

  const openCreateModal = () => {
    setFormData({ id: '', username: '', password: '', role: 'user', divisi_id: '', _adminPassword: '' });
    setIsEditMode(false);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEditModal = (u) => {
    setFormData({ id: u.id, username: u.username, password: '', role: u.role, divisi_id: u.divisi_id || '', _adminPassword: '' });
    setIsEditMode(true);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    createMutation.reset();
    updateMutation.reset();
    setFormData({ id: '', username: '', password: '', role: 'user', divisi_id: '', _adminPassword: '' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isEditMode) {
      updateMutation.mutate({ id: formData.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const confirmDelete = () => {
    if (confirmDialog.id) {
      deleteMutation.mutate(confirmDialog.id);
      setConfirmDialog({ isOpen: false, id: null });
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchSearch = u.username.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter ? u.role === roleFilter : true;
    return matchSearch && matchRole;
  });

  const getRoleStyle = (role) =>
    role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800';

  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Anda tidak memiliki akses ke halaman ini.</p>
      </div>
    );
  }

  const isMutating = createMutation.isLoading || updateMutation.isLoading;
  const mutationError = createMutation.error?.message || updateMutation.error?.message;

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">Manajemen User</h1>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Tambah User
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl shadow flex items-center gap-4">
            <div className="p-3 bg-indigo-100 rounded-lg"><Users className="w-6 h-6 text-indigo-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Total User</p>
              <p className="text-2xl font-bold text-gray-900">{users.length}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg"><Shield className="w-6 h-6 text-purple-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Administrator</p>
              <p className="text-2xl font-bold text-gray-900">{users.filter((u) => u.role === 'admin').length}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg"><User className="w-6 h-6 text-blue-600" /></div>
            <div>
              <p className="text-sm text-gray-500">User Biasa</p>
              <p className="text-2xl font-bold text-gray-900">{users.filter((u) => u.role === 'user').length}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Cari username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Semua Role</option>
              <option value="admin">Administrator</option>
              <option value="user">User Biasa</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Memuat user...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">Belum ada user ditemukan.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">Username</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">Role</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">Divisi</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">Dibuat</th>
                  <th className="text-right px-6 py-3 text-sm font-semibold text-gray-600">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((u, index) => (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span className="text-indigo-700 font-bold text-sm">
                            {u.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{u.username}</p>
                          {u.id === user.id && <span className="text-xs text-indigo-500">(Anda)</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleStyle(u.role)}`}>
                        {u.role === 'admin' ? 'Administrator' : 'User Biasa'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{u.divisions?.name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(u.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {u.id !== user.id && (
                          <button
                            onClick={() => setConfirmDialog({ isOpen: true, id: u.id })}
                            className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={isEditMode ? 'Edit User' : 'Tambah User Baru'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="Username..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
              required
              disabled={isEditMode}
            />
            {isEditMode && <p className="text-xs text-gray-400 mt-1">Username tidak dapat diubah.</p>}
          </div>

          {/* Password (only create) */}
          {!isEditMode && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password User Baru <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimal 6 karakter..."
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Role */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            >
              {USER_ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Divisi */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Divisi (Opsional)
            </label>
            <select
              value={formData.divisi_id}
              onChange={(e) => setFormData({ ...formData, divisi_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">-- Pilih Divisi --</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Admin password confirmation (only create) */}
          {!isEditMode && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">
                🔐 Konfirmasi Password Admin
              </p>
              <p className="text-xs text-amber-700 mb-3">
                Masukkan password Anda sendiri untuk mengkonfirmasi pembuatan user baru.
              </p>
              <input
                type="password"
                value={formData._adminPassword || ''}
                onChange={(e) => setFormData({ ...formData, _adminPassword: e.target.value })}
                placeholder="Password admin (Anda)..."
                className="w-full px-4 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
                required
              />
            </div>
          )}

          {/* Error */}
          {mutationError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {mutationError}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={closeModal}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center gap-2"
            >
              <X className="w-4 h-4" /> Batal
            </button>
            <button
              type="submit"
              disabled={isMutating}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isMutating ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
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
