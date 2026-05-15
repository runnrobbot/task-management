import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Tag, Plus, Trash2, Save, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';

const QUERY_KEY = 'catatan_kategori';

export default function CatatanKategoriPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [namaKategori, setNamaKategori] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, id: null, nama: '' });

  const { data: kategoris = [], isLoading } = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('catatan_kategori')
        .select('*')
        .order('nama', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && user.role === 'admin',
  });

  const createMutation = useMutation({
    mutationFn: async (nama) => {
      const { error } = await supabase.from('catatan_kategori').insert([{ nama }]);
      if (error) {
        if (error.code === '23505') throw new Error('Kategori dengan nama ini sudah ada.');
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries([QUERY_KEY]);
      setNamaKategori('');
      setIsModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('catatan_kategori').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries([QUERY_KEY]),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (namaKategori.trim()) createMutation.mutate(namaKategori.trim());
  };

  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Anda tidak memiliki akses ke halaman ini.</p>
      </div>
    );
  }

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Tag className="w-8 h-8 text-primary-600" />
            <h1 className="text-3xl font-bold text-slate-900">Kategori Catatan</h1>
          </div>
          <button
            onClick={() => { setNamaKategori(''); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Tambah Kategori
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
          Kategori yang dihapus akan membuat catatan yang menggunakannya kehilangan kategorinya. Hapus hanya jika tidak digunakan.
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Memuat kategori...</p>
          </div>
        ) : kategoris.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow">
            <Tag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">Belum ada kategori.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {kategoris.map((k, index) => (
              <motion.div
                key={k.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="bg-white rounded-xl shadow-md p-5 flex items-center justify-between group hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 rounded-lg">
                    <Tag className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{k.nama}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(k.created_at).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmDialog({ isOpen: true, id: k.id, nama: k.nama })}
                  className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Tambah Kategori Baru" size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Nama Kategori <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={namaKategori}
              onChange={(e) => setNamaKategori(e.target.value)}
              placeholder="Contoh: Barang Masuk, Komplain, ..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
              autoFocus
            />
          </div>
          {createMutation.isError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {createMutation.error?.message}
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2 border-t">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium flex items-center gap-2">
              <X className="w-4 h-4" /> Batal
            </button>
            <button type="submit" disabled={createMutation.isLoading} className="px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium flex items-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" />
              {createMutation.isLoading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, id: null, nama: '' })}
        onConfirm={() => { deleteMutation.mutate(confirmDialog.id); setConfirmDialog({ isOpen: false, id: null, nama: '' }); }}
        title="Hapus Kategori"
        message={`Yakin ingin menghapus kategori "${confirmDialog.nama}"?`}
        confirmText="Hapus"
        type="danger"
      />
    </div>
  );
}
