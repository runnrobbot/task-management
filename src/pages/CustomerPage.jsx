import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserPlus, Phone, MapPin, StickyNote, Edit2, Trash2,
  Save, X, Search, User, Clock, ChevronDown, Star,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { QUERY_KEYS } from '@/lib/constants';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Pagination from '@/components/common/Pagination';

const PAGE_SIZE = 12;

const emptyForm = { id: '', nama: '', no_hp: '', alamat: '', catatan: '', is_prioritas: false };

export default function CustomerPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  // ── State ──────────────────────────────────────────
  const [search, setSearch]         = useState('');
  const [page, setPage]             = useState(1);
  const [formData, setFormData]     = useState(emptyForm);
  const [isEditing, setIsEditing]   = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, id: null });
  const [prioritasOnly, setPrioritasOnly] = useState(false);

  // Admin: filter by user
  const [adminUserFilter, setAdminUserFilter] = useState('');

  // ── Fetch semua users (admin only) ────────────────
  const { data: allUsers = [] } = useQuery({
    queryKey: ['all_users_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, role')
        .order('username', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && isAdmin,
  });

  // ── Fetch customers ───────────────────────────────
  const { data: result = { data: [], count: 0, totalPages: 1 }, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.CUSTOMERS, { search, page, prioritasOnly, adminUserFilter }],
    queryFn: async () => {
      let query = supabase
        .from('customers')
        .select('*, users:user_id(id, username, role)', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Kalau bukan admin → hanya tampilkan miliknya sendiri
      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      } else if (adminUserFilter) {
        // Admin filter by user tertentu
        query = query.eq('user_id', adminUserFilter);
      }

      if (search) {
        query = query.or(`nama.ilike.%${search}%,no_hp.ilike.%${search}%,alamat.ilike.%${search}%`);
      }
      if (prioritasOnly) {
        query = query.eq('is_prioritas', true);
      }

      const from = (page - 1) * PAGE_SIZE;
      query = query.range(from, from + PAGE_SIZE - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return {
        data: data || [],
        count: count || 0,
        totalPages: Math.ceil((count || 0) / PAGE_SIZE),
      };
    },
    enabled: !!user,
    keepPreviousData: true,
  });

  // ── Save mutation ──────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        nama:         data.nama.trim(),
        no_hp:        data.no_hp?.trim()   || null,
        alamat:       data.alamat?.trim()  || null,
        catatan:      data.catatan?.trim() || null,
        user_id:      user.id,
        is_prioritas: data.is_prioritas || false,
      };

      if (data.id) {
        const { error } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries([QUERY_KEYS.CUSTOMERS]);
      resetForm();
    },
  });

  // ── Delete mutation ────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries([QUERY_KEYS.CUSTOMERS]),
  });

  // ── Helpers ───────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleEdit = (c) => {
    setFormData({
      id:           c.id,
      nama:         c.nama,
      no_hp:        c.no_hp    || '',
      alamat:       c.alamat   || '',
      catatan:      c.catatan  || '',
      is_prioritas: c.is_prioritas || false,
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setIsEditing(false);
  };

  const handleSearchChange = (val) => { setSearch(val); setPage(1); };

  // ── Render ────────────────────────────────────────
  return (
    <div className="min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-8 h-8 text-emerald-600" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Customer Saya</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isAdmin
                ? 'Daftar pelanggan semua pengguna (mode Admin)'
                : 'Daftar pelanggan pribadi Anda – hanya Anda yang bisa melihatnya'}
            </p>
          </div>
        </div>

        {/* ── Form ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-8 max-w-2xl"
        >
          <div className="flex items-center gap-2 mb-6">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            <h2 className="text-xl font-bold text-slate-900">
              {isEditing ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nama */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nama Pelanggan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.nama}
                onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                placeholder="Nama lengkap pelanggan..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50"
                required
              />
            </div>

            {/* No HP & Alamat */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> No. HP
                    <span className="text-slate-400 font-normal text-xs ml-1">(opsional)</span>
                  </span>
                </label>
                <input
                  type="text"
                  value={formData.no_hp}
                  onChange={(e) => setFormData({ ...formData, no_hp: e.target.value })}
                  placeholder="0812..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> Alamat
                    <span className="text-slate-400 font-normal text-xs ml-1">(opsional)</span>
                  </span>
                </label>
                <input
                  type="text"
                  value={formData.alamat}
                  onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                  placeholder="Alamat pelanggan..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50"
                />
              </div>
            </div>

            {/* Catatan */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                <span className="flex items-center gap-1">
                  <StickyNote className="w-3.5 h-3.5" /> Catatan
                  <span className="text-slate-400 font-normal text-xs ml-1">(opsional)</span>
                </span>
              </label>
              <textarea
                value={formData.catatan}
                onChange={(e) => setFormData({ ...formData, catatan: e.target.value })}
                placeholder="Catatan tambahan tentang pelanggan ini..."
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50 resize-none"
              />
            </div>

            {/* Customer Prioritas toggle */}
            <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <label className="flex items-center gap-2 text-sm font-semibold text-yellow-800 cursor-pointer" htmlFor="is_prioritas_toggle">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-400" />
                Customer Prioritas
                <span className="text-xs font-normal text-yellow-600">(ditampilkan paling atas)</span>
              </label>
              <button
                id="is_prioritas_toggle"
                type="button"
                onClick={() => setFormData({ ...formData, is_prioritas: !formData.is_prioritas })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.is_prioritas ? 'bg-yellow-400' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${formData.is_prioritas ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Info: ditambahkan oleh siapa */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-sm text-emerald-700 flex items-center gap-2">
              <User className="w-4 h-4 shrink-0" />
              <span>
                Pelanggan ini akan tercatat sebagai milik akun{' '}
                <span className="font-bold">{user?.username}</span>
              </span>
            </div>

            {saveMutation.isError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {saveMutation.error?.message || 'Terjadi kesalahan saat menyimpan.'}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium flex items-center gap-2"
                >
                  <X className="w-4 h-4" /> Batal
                </button>
              )}
              <button
                type="submit"
                disabled={saveMutation.isLoading}
                className="px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saveMutation.isLoading
                  ? 'Menyimpan...'
                  : isEditing
                  ? 'Simpan Perubahan'
                  : 'Tambah Pelanggan'}
              </button>
            </div>
          </form>
        </motion.div>

        {/* ── Filter & Search ── */}
        <div className="bg-white p-4 rounded-xl shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama, no hp, alamat..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Admin: filter by user */}
            {isAdmin && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  value={adminUserFilter}
                  onChange={(e) => { setAdminUserFilter(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent appearance-none"
                >
                  <option value="">Semua Pengguna</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username} ({u.role})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Prioritas filter */}
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => { setPrioritasOnly(!prioritasOnly); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${prioritasOnly ? 'bg-yellow-400 border-yellow-400 text-white' : 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'}`}
            >
              <Star className={`w-3.5 h-3.5 ${prioritasOnly ? 'fill-white' : 'fill-yellow-300'}`} />
              Prioritas
            </button>
            {(search || adminUserFilter || prioritasOnly) && (
              <button
                onClick={() => { handleSearchChange(''); setAdminUserFilter(''); setPrioritasOnly(false); }}
                className="text-sm text-red-500 hover:text-red-700 underline"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* ── Count ── */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-slate-900">
            Daftar Pelanggan
            <span className="ml-2 text-sm font-normal text-slate-400">({result.count} data)</span>
          </h3>
        </div>

        {/* ── Card List ── */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto" />
            <p className="mt-4 text-slate-600">Memuat data pelanggan...</p>
          </div>
        ) : result.data.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">Belum ada pelanggan.</p>
            <p className="text-slate-400 text-sm mt-1">Tambahkan pelanggan pertama Anda di atas.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <AnimatePresence>
                {result.data.map((c, index) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: index * 0.04 }}
                    className={`bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 border-l-4 overflow-hidden ${c.is_prioritas ? 'border-l-yellow-400' : 'border-l-emerald-500'}`}
                  >
                    <div className="p-5">
                      {/* Nama + badge owner (admin) */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${c.is_prioritas ? 'bg-yellow-100' : 'bg-emerald-100'}`}>
                            {c.is_prioritas ? <Star className="w-5 h-5 text-yellow-500 fill-yellow-300" /> : <User className="w-5 h-5 text-emerald-600" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 leading-tight">
                              <h3 className="font-bold text-slate-900 text-base">{c.nama}</h3>
                              {c.is_prioritas && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-semibold">⭐ Prioritas</span>}
                            </div>
                            {isAdmin && c.users?.username && (
                              <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                                {c.users.username}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Detail */}
                      <div className="space-y-1.5 mb-4">
                        {c.no_hp ? (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{c.no_hp}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-slate-400 italic">
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            <span>No HP tidak diisi</span>
                          </div>
                        )}

                        {c.alamat ? (
                          <div className="flex items-start gap-2 text-sm text-slate-600">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{c.alamat}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-slate-400 italic">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span>Alamat tidak diisi</span>
                          </div>
                        )}

                        {c.catatan && (
                          <div className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg p-2.5 mt-2">
                            <StickyNote className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-3 whitespace-pre-wrap">{c.catatan}</span>
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(c.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Hanya owner atau admin yang bisa edit/hapus */}
                          {(isAdmin || c.user_id === user?.id) && (
                            <>
                              <button
                                onClick={() => handleEdit(c)}
                                className="p-1.5 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteDialog({ isOpen: true, id: c.id })}
                                className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                title="Hapus"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <Pagination page={page} totalPages={result.totalPages} onPageChange={setPage} />
          </>
        )}
      </motion.div>

      {/* ── Confirm Delete ── */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null })}
        onConfirm={() => {
          deleteMutation.mutate(deleteDialog.id);
          setDeleteDialog({ isOpen: false, id: null });
        }}
        title="Hapus Pelanggan"
        message="Yakin ingin menghapus data pelanggan ini? Tindakan ini tidak bisa dibatalkan."
        confirmText="Hapus"
        type="danger"
      />
    </div>
  );
}
