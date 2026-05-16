import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Network, Plus, Edit2, Trash2, Save, X, Building2, Search, Share2 } from 'lucide-react';
import Pagination from '@/components/common/Pagination';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { QUERY_KEYS } from '@/lib/constants';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';

export default function DivisionsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, id: null });
  const [formData, setFormData] = useState({ id: '', name: '', is_shared: false });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Fetch divisions
  const { data: divisions = [], isLoading } = useQuery({
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

  const filteredDivisions = useMemo(() => {
    return divisions.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
  }, [divisions, search]);

  const paginatedDivisions = useMemo(() => {
    const from = (page - 1) * PAGE_SIZE;
    return filteredDivisions.slice(from, from + PAGE_SIZE);
  }, [filteredDivisions, page]);

  const totalPages = Math.ceil(filteredDivisions.length / PAGE_SIZE);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase.from('divisions').insert([{ name: data.name, is_shared: data.is_shared }]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DIVISIONS] }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase.from('divisions').update({ name: data.name, is_shared: data.is_shared }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DIVISIONS] }); closeModal(); },
  });

  // Toggle is_shared langsung dari card (tanpa buka modal)
  const toggleSharedMutation = useMutation({
    mutationFn: async ({ id, is_shared }) => {
      const { error } = await supabase.from('divisions').update({ is_shared }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DIVISIONS] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('divisions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DIVISIONS] }),
  });

  const openCreateModal = () => { setFormData({ id: '', name: '', is_shared: false }); setIsEditMode(false); setIsModalOpen(true); };
  const openEditModal = (division) => { setFormData({ id: division.id, name: division.name, is_shared: division.is_shared || false }); setIsEditMode(true); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setFormData({ id: '', name: '', is_shared: false }); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isEditMode) {
      updateMutation.mutate({ id: formData.id, data: { name: formData.name, is_shared: formData.is_shared } });
    } else {
      createMutation.mutate({ name: formData.name, is_shared: formData.is_shared });
    }
  };

  const confirmDelete = () => {
    if (confirmDialog.id) {
      deleteMutation.mutate(confirmDialog.id);
      setConfirmDialog({ isOpen: false, id: null });
    }
  };

  if (user?.role !== 'admin') {
    return <div className="text-center py-12"><p className="text-slate-600">Anda tidak memiliki akses ke halaman ini.</p></div>;
  }

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Network className="w-8 h-8 text-primary-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Manajemen Divisi</h1>
              <p className="text-sm text-slate-500 mt-0.5">Divisi dengan <span className="inline-flex items-center gap-1 text-emerald-600 font-medium"><Share2 className="w-3 h-3" /> Sharing Aktif</span> bisa melihat data sesama anggotanya</p>
            </div>
          </div>
          <button onClick={openCreateModal} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
            <Plus className="w-5 h-5" /> Tambah Divisi
          </button>
        </div>

        <div className="bg-white p-4 rounded-xl shadow mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari divisi..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Memuat divisi...</p>
          </div>
        ) : divisions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow">
            <Network className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">Belum ada divisi.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-4">{filteredDivisions.length} divisi ditemukan</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedDivisions.map((division, index) => (
                <motion.div
                  key={division.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 p-6 border-l-4 ${division.is_shared ? 'border-l-emerald-400' : 'border-l-slate-200'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`p-3 rounded-lg ${division.is_shared ? 'bg-emerald-100' : 'bg-primary-100'}`}>
                        <Building2 className={`w-6 h-6 ${division.is_shared ? 'text-emerald-600' : 'text-primary-600'}`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">{division.name}</h3>
                        <p className="text-sm text-slate-500">ID: {division.id}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditModal(division)} className="p-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setConfirmDialog({ isOpen: true, id: division.id })} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Toggle sharing */}
                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Share2 className={`w-4 h-4 ${division.is_shared ? 'text-emerald-500' : 'text-slate-400'}`} />
                      <span className={`text-sm font-medium ${division.is_shared ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {division.is_shared ? 'Sharing Aktif' : 'Sharing Nonaktif'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSharedMutation.mutate({ id: division.id, is_shared: !division.is_shared })}
                      disabled={toggleSharedMutation.isLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${division.is_shared ? 'bg-emerald-400' : 'bg-slate-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${division.is_shared ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </motion.div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={isEditMode ? 'Edit Divisi' : 'Tambah Divisi'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Nama Divisi <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contoh: IT, Marketing, Sales..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          {/* Toggle is_shared di modal */}
          <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <label className="flex items-center gap-2 text-sm font-semibold text-emerald-800 cursor-pointer" htmlFor="is_shared_toggle">
              <Share2 className="w-4 h-4 text-emerald-600" />
              Aktifkan Sharing Divisi
              <span className="text-xs font-normal text-emerald-600">(anggota bisa lihat data sesama divisi)</span>
            </label>
            <button
              id="is_shared_toggle"
              type="button"
              onClick={() => setFormData({ ...formData, is_shared: !formData.is_shared })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.is_shared ? 'bg-emerald-400' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${formData.is_shared ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button type="button" onClick={closeModal} className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium flex items-center gap-2">
              <X className="w-4 h-4" /> Batal
            </button>
            <button type="submit" disabled={createMutation.isLoading || updateMutation.isLoading} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" />
              {createMutation.isLoading || updateMutation.isLoading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title="Hapus Divisi"
        message="Yakin ingin menghapus divisi ini? Data yang dihapus tidak dapat dikembalikan."
        confirmText="Hapus"
        type="danger"
      />
    </div>
  );
}