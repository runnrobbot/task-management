import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Package, Search, X, Filter, FileText, Phone, Building,
  User, Clock, Image as ImageIcon, CheckCircle, Loader2, AlertCircle,
  MessageCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import Modal from '@/components/common/Modal';
import Pagination from '@/components/common/Pagination';

const PAGE_SIZE = 12;

const STATUS_OPTIONS = ['Kosong', 'Proses Pengadaan', 'Tersedia'];

const STATUS_COLOR = {
  'Tersedia':         { badge: 'bg-green-100 text-green-800',  border: 'border-l-green-400',  icon: <CheckCircle className="w-4 h-4 text-green-500" /> },
  'Proses Pengadaan': { badge: 'bg-yellow-100 text-yellow-800', border: 'border-l-yellow-400', icon: <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" /> },
  'Kosong':           { badge: 'bg-red-100 text-red-800',      border: 'border-l-red-400',    icon: <AlertCircle className="w-4 h-4 text-red-500" /> },
};

// Format nomor WA internasional
function formatWaNumber(noTelp) {
  if (!noTelp) return '';
  let num = noTelp.replace(/[^0-9]/g, '');
  if (num.startsWith('0')) num = '62' + num.substring(1);
  return num;
}

export default function BarangKosongPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]                 = useState(1);
  const [imageModalUrl, setImageModalUrl]   = useState(null);
  const [statusModal, setStatusModal]       = useState(null); // { catatan, newStatus }
  const [actionModal, setActionModal]       = useState(null); // { catatan } — for WA + status

  // WA message state
  const [waPesan, setWaPesan] = useState('');
  const [waNewStatus, setWaNewStatus] = useState('Proses Pengadaan');
  const [employees, setEmployees] = useState([]);

  // Fetch employees for action modal
  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase.from('employees').select('id, name').order('name');
      if (data) setEmployees(data);
    };
    if (user) fetchEmployees();
  }, [user]);

  // ── Query: Catatan Barang Masuk ───────────────────────────────
  const { data: result = { data: [], count: 0, totalPages: 1 }, isLoading } = useQuery({
    queryKey: ['catatan_barang_masuk', { search, statusFilter, page }],
    queryFn: async () => {
      // Cari id kategori "Barang Masuk"
      const { data: kat } = await supabase
        .from('catatan_kategori')
        .select('id')
        .ilike('nama', 'barang masuk')
        .single();
      if (!kat) return { data: [], count: 0, totalPages: 1 };

      let q = supabase
        .from('data_catatan')
        .select('*, users:user_id(username)', { count: 'exact' })
        .eq('kategori_id', kat.id)
        .order('waktu', { ascending: false });

      if (search)       q = q.or(`nama_customer.ilike.%${search}%,info_percakapan.ilike.%${search}%,no_telp.ilike.%${search}%`);
      if (statusFilter) q = q.eq('status_barang', statusFilter);

      const from = (page - 1) * PAGE_SIZE;
      q = q.range(from, from + PAGE_SIZE - 1);

      const { data, error, count } = await q;
      if (error) throw error;
      return { data: data || [], count: count || 0, totalPages: Math.ceil((count || 0) / PAGE_SIZE) };
    },
    enabled: !!user,
    keepPreviousData: true,
  });

  // ── Mutation: Update status_barang di data_catatan ────────────
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase
        .from('data_catatan')
        .update({ status_barang: status })
        .eq('id', id);
      if (error) throw error;

      // Insert notifikasi
      await supabase.from('notifications').insert([{
        message: `Status barang pada catatan diubah menjadi "${status}"`,
        type: 'barang_status',
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['catatan_barang_masuk']);
      queryClient.invalidateQueries(['catatan_barang_dashboard']);
      setStatusModal(null);
      setActionModal(null);
    },
  });

  const handleSearchChange = (val) => { setSearch(val); setPage(1); };
  const handleStatusChange = (val) => { setStatusFilter(val); setPage(1); };

  // Open WA action modal
  const openActionModal = (catatan) => {
    const status = catatan.status_barang || 'Kosong';
    setActionModal({ catatan });
    setWaNewStatus(status === 'Tersedia' ? 'Tersedia' : 'Proses Pengadaan');
    setWaPesan(`Halo Kak ${catatan.nama_customer}, terkait permintaan barang yang sebelumnya kosong, kami ingin menginformasikan update terbaru. Silahkan hubungi kami kembali untuk info lebih lanjut.`);
  };

  // Kirim WA + update status
  const handleKirimWa = () => {
    const waNum = formatWaNumber(actionModal.catatan.no_telp);
    if (!waNum) return;
    updateStatusMutation.mutate({ id: actionModal.catatan.id, status: waNewStatus });
    const url = `https://wa.me/${waNum}?text=${encodeURIComponent(waPesan)}`;
    window.open(url, '_blank');
  };

  // Update status saja
  const handleUpdateStatusSaja = () => {
    updateStatusMutation.mutate({ id: actionModal.catatan.id, status: waNewStatus });
  };

  const statsCount = (status) => result.data.filter(c => (c.status_barang || 'Kosong') === status).length;

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-primary-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Barang Kosong</h1>
              <p className="text-sm text-gray-500">Catatan dari pelanggan yang melaporkan barang kosong</p>
            </div>
          </div>
          <div className="flex gap-2 text-sm flex-wrap justify-end">
            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full font-medium">
              Kosong: {statsCount('Kosong')}
            </span>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full font-medium">
              Proses: {statsCount('Proses Pengadaan')}
            </span>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
              Tersedia: {statsCount('Tersedia')}
            </span>
          </div>
        </div>

        {/* ── Filter ── */}
        <div className="bg-white p-4 rounded-xl shadow mb-6">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-600">
            <Filter className="w-4 h-4" /> Filter &amp; Pencarian
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nama, info percakapan, no telp..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Semua Status</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {(search || statusFilter) && (
            <button onClick={() => { handleSearchChange(''); handleStatusChange(''); }} className="mt-3 text-sm text-red-500 hover:text-red-700 underline">
              Reset Filter
            </button>
          )}
        </div>

        <p className="text-sm text-gray-500 mb-4">{result.count} catatan ditemukan</p>

        {/* ── Card List ── */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Memuat data...</p>
          </div>
        ) : result.data.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Belum ada catatan barang kosong.</p>
            <p className="text-sm text-gray-400 mt-1">
              Tambahkan di halaman <span className="font-semibold">Catatan</span> dengan kategori <span className="font-semibold">"Barang Masuk"</span>
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {result.data.map((c, index) => {
                const status = c.status_barang || 'Kosong';
                const style  = STATUS_COLOR[status] || STATUS_COLOR['Kosong'];
                const waNum  = formatWaNumber(c.no_telp);
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className={`bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow border-l-4 ${style.border} overflow-hidden`}
                  >
                    {/* Gambar */}
                    {c.gambar_url && (
                      <div className="h-36 overflow-hidden cursor-pointer" onClick={() => setImageModalUrl(c.gambar_url)}>
                        <img src={c.gambar_url} alt="Gambar" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                      </div>
                    )}

                    <div className="p-5">
                      {/* Header card */}
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold text-gray-900 flex-1">{c.nama_customer}</h3>
                        <div className="flex items-center gap-1 ml-2">
                          {style.icon}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.badge}`}>
                            {status}
                          </span>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="space-y-1 mb-3 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span>{c.no_telp}</span>
                        </div>
                        {c.cabang && (
                          <div className="flex items-center gap-2">
                            <Building className="w-3 h-3 shrink-0" />
                            <span>{c.cabang}</span>
                          </div>
                        )}
                      </div>

                      {/* Info percakapan */}
                      <div className="bg-orange-50 rounded-lg p-3 mb-4">
                        <p className="text-sm text-gray-700 line-clamp-3 whitespace-pre-wrap">{c.info_percakapan}</p>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-3 pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>{c.users?.username}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(c.waktu).toLocaleDateString('id-ID')}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        {/* Kirim WA + update status */}
                        {waNum && (
                          <button
                            onClick={() => openActionModal(c)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> WA &amp; Status
                          </button>
                        )}
                        {/* Ubah status saja */}
                        <button
                          onClick={() => setStatusModal({ catatan: c, newStatus: status })}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors text-sm font-medium"
                        >
                          Ubah Status
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <Pagination page={page} totalPages={result.totalPages} onPageChange={setPage} />
          </>
        )}

      </motion.div>

      {/* ── Image Lightbox ── */}
      {imageModalUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setImageModalUrl(null)}>
          <div className="relative max-w-4xl max-h-full">
            <img src={imageModalUrl} alt="Preview" className="max-h-[85vh] max-w-full rounded-xl object-contain" />
            <button onClick={() => setImageModalUrl(null)} className="absolute -top-3 -right-3 bg-white text-gray-700 rounded-full p-2 shadow-lg hover:bg-red-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Modal Ubah Status Saja ── */}
      <Modal
        isOpen={!!statusModal}
        onClose={() => setStatusModal(null)}
        title="Ubah Status Barang"
        size="sm"
      >
        {statusModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Catatan dari <span className="font-semibold">{statusModal.catatan.nama_customer}</span>
            </p>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Status Barang</label>
              <div className="grid grid-cols-1 gap-2">
                {STATUS_OPTIONS.map((s) => {
                  const st = STATUS_COLOR[s];
                  const isSelected = (statusModal.newStatus || 'Kosong') === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setStatusModal({ ...statusModal, newStatus: s })}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      {st.icon}
                      <span>{s}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2 border-t">
              <button
                onClick={() => setStatusModal(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm"
              >
                Batal
              </button>
              <button
                onClick={() => updateStatusMutation.mutate({ id: statusModal.catatan.id, status: statusModal.newStatus })}
                disabled={updateStatusMutation.isLoading}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm disabled:opacity-50"
              >
                {updateStatusMutation.isLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal WA + Status (Action Modal) ── */}
      <Modal isOpen={!!actionModal} onClose={() => setActionModal(null)} title="Hubungi via WhatsApp & Update Status" size="md">
        {actionModal && (
          <div className="space-y-4">
            {/* Info customer */}
            <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Package className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{actionModal.catatan.nama_customer}</p>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {actionModal.catatan.no_telp}
                </p>
              </div>
            </div>

            {/* Status barang */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Update Status Barang</label>
              <div className="grid grid-cols-1 gap-2">
                {STATUS_OPTIONS.map((s) => {
                  const st = STATUS_COLOR[s];
                  const isSelected = waNewStatus === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setWaNewStatus(s)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        isSelected ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      {st.icon}
                      <span>{s}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pesan WA */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="flex items-center gap-1.5 text-green-700"><MessageCircle className="w-4 h-4" /> Pesan WhatsApp</span>
              </label>
              <textarea
                value={waPesan}
                onChange={(e) => setWaPesan(e.target.value)}
                rows="4"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent text-sm"
                placeholder="Tulis pesan..."
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-2 border-t">
              <button
                onClick={handleKirimWa}
                disabled={updateStatusMutation.isLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-semibold text-sm disabled:opacity-50"
              >
                <MessageCircle className="w-4 h-4" />
                Kirim WA &amp; Update Status
              </button>
              <button
                onClick={handleUpdateStatusSaja}
                disabled={updateStatusMutation.isLoading}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium text-sm disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                Status Saja
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
