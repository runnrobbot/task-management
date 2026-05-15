import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Package, Search, X, Filter, FileText, Phone, Building,
  User, Clock, CheckCircle, Loader2, AlertCircle,
  MessageCircle, MessageSquare, BadgeCheck, ImagePlus, Eye, Image as ImageIcon
} from 'lucide-react';
import CatatanPreviewModal from '@/components/common/CatatanPreviewModal';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useScope } from '@/lib/useScope';
import Modal from '@/components/common/Modal';
import Pagination from '@/components/common/Pagination';

const PAGE_SIZE = 12;
const BUCKET = 'catatan-images';

const STATUS_OPTIONS = ['Kosong', 'Proses Pengadaan', 'Tersedia'];

const STATUS_COLOR = {
  'Tersedia':         { badge: 'bg-green-100 text-green-800',  border: 'border-l-green-400',  icon: <CheckCircle className="w-4 h-4 text-green-500" /> },
  'Proses Pengadaan': { badge: 'bg-yellow-100 text-yellow-800', border: 'border-l-yellow-400', icon: <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" /> },
  'Kosong':           { badge: 'bg-red-100 text-red-800',      border: 'border-l-red-400',    icon: <AlertCircle className="w-4 h-4 text-red-500" /> },
};

function formatWaNumber(noTelp) {
  if (!noTelp) return '';
  let num = noTelp.replace(/[^0-9]/g, '');
  if (num.startsWith('0')) num = '62' + num.substring(1);
  return num;
}

export default function BarangKosongPage() {
  const { user } = useAuthStore();
  const { isAdmin, userId, applyUserFilter } = useScope();
  const queryClient = useQueryClient();
  const commentImageRef = useRef(null);

  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]                 = useState(1);
  const [imageModalUrl, setImageModalUrl] = useState(null);
  const [actionModal, setActionModal]   = useState(null);
  const [previewCatatan, setPreviewCatatan] = useState(null);

  // Form state
  const [waNewStatus, setWaNewStatus]     = useState('Proses Pengadaan');
  const [waPesan, setWaPesan]             = useState('');
  const [comment, setComment]             = useState('');
  const [commentImageFile, setCommentImageFile] = useState(null);
  const [commentImagePreview, setCommentImagePreview] = useState(null);

  // Auto-resolved employee dari user login
  const [myEmployeeId, setMyEmployeeId]   = useState(null);
  const [myEmployeeName, setMyEmployeeName] = useState('');

  useEffect(() => {
    if (!user) return;
    const fetchMyEmployee = async () => {
      const { data } = await supabase.from('employees').select('id, name').order('name');
      if (data && data.length > 0) {
        const matched = data.find(e =>
          e.name.toLowerCase().includes(user.username?.toLowerCase() || '') ||
          user.username?.toLowerCase().includes(e.name.toLowerCase())
        );
        if (matched) { setMyEmployeeId(matched.id); setMyEmployeeName(matched.name); }
      }
    };
    fetchMyEmployee();
  }, [user]);

  const { data: result = { data: [], count: 0, totalPages: 1 }, isLoading } = useQuery({
    queryKey: ['catatan_barang_kosong', { search, statusFilter, page, isAdmin, userId }],
    queryFn: async () => {
      const { data: kat } = await supabase.from('catatan_kategori').select('id').ilike('nama', 'barang kosong').maybeSingle();
      if (!kat) return { data: [], count: 0, totalPages: 1 };

      let q = supabase.from('data_catatan').select('*, users:user_id(username)', { count: 'exact' })
        .eq('kategori_id', kat.id).order('waktu', { ascending: false });

      q = applyUserFilter(q);

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

  const uploadCommentImage = async (file) => {
    if (!file) return null;
    const ext = file.name.split('.').pop();
    const fileName = `bk_comment_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, { upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, catatan_comment, employee_id, commentImgFile }) => {
      let commentImageUrl = null;
      if (commentImgFile) commentImageUrl = await uploadCommentImage(commentImgFile);

      const updatePayload = { status_barang: status };
      if (catatan_comment !== undefined) updatePayload.catatan_action = catatan_comment;
      if (employee_id) updatePayload.employee_id = employee_id;
      if (commentImageUrl) updatePayload.comment_image_url = commentImageUrl;

      const { error } = await supabase.from('data_catatan').update(updatePayload).eq('id', id);
      if (error) throw error;

      await supabase.from('notifications').insert([{
        message: `Status barang pada catatan diubah menjadi "${status}"`,
        type: 'barang_status',
        user_id: userId,
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['catatan_barang_kosong']);
      queryClient.invalidateQueries(['catatan_barang_dashboard']);
      setActionModal(null);
      setCommentImageFile(null);
      setCommentImagePreview(null);
    },
  });

  const handleSearchChange = (val) => { setSearch(val); setPage(1); };
  const handleStatusChange = (val) => { setStatusFilter(val); setPage(1); };

  const openActionModal = (catatan) => {
    const status = catatan.status_barang || 'Kosong';
    setActionModal({ catatan });
    setWaNewStatus(status === 'Tersedia' ? 'Tersedia' : 'Proses Pengadaan');
    setWaPesan(`Halo Kak ${catatan.nama_customer}, terkait permintaan barang yang sebelumnya kosong, kami ingin menginformasikan update terbaru. Silahkan hubungi kami kembali untuk info lebih lanjut.`);
    setComment('');
    setCommentImageFile(null);
    setCommentImagePreview(null);
  };

  const handleCommentImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Ukuran gambar maksimal 5MB.'); return; }
    setCommentImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setCommentImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleKirimWa = () => {
    const waNum = formatWaNumber(actionModal.catatan.no_telp);
    if (waNum && waPesan) {
      window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(waPesan)}`, '_blank');
    }
    updateMutation.mutate({
      id: actionModal.catatan.id,
      status: waNewStatus,
      catatan_comment: comment,
      employee_id: myEmployeeId || undefined,
      commentImgFile: commentImageFile,
    });
  };

  const handleUpdateStatusSaja = () => {
    updateMutation.mutate({
      id: actionModal.catatan.id,
      status: waNewStatus,
      catatan_comment: comment,
      employee_id: myEmployeeId || undefined,
      commentImgFile: commentImageFile,
    });
  };

  const statsCount = (status) => result.data.filter(c => (c.status_barang || 'Kosong') === status).length;

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-primary-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Barang Kosong</h1>
              <p className="text-sm text-slate-500">Catatan dari pelanggan yang melaporkan barang kosong</p>
            </div>
          </div>
          <div className="flex gap-2 text-sm flex-wrap justify-end">
            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full font-medium">Kosong: {statsCount('Kosong')}</span>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full font-medium">Proses: {statsCount('Proses Pengadaan')}</span>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">Tersedia: {statsCount('Tersedia')}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow mb-6">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-600">
            <Filter className="w-4 h-4" /> Filter &amp; Pencarian
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="text" placeholder="Cari nama, info percakapan, no telp..." value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
            <select value={statusFilter} onChange={(e) => handleStatusChange(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent">
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

        <p className="text-sm text-slate-500 mb-4">{result.count} catatan ditemukan</p>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Memuat data...</p>
          </div>
        ) : result.data.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">Belum ada catatan barang kosong.</p>
            <p className="text-sm text-slate-400 mt-1">
              Tambahkan di halaman <span className="font-semibold">Catatan</span> dengan kategori <span className="font-semibold">"Barang Kosong"</span>
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {result.data.map((c, index) => {
                const status = c.status_barang || 'Kosong';
                const style  = STATUS_COLOR[status] || STATUS_COLOR['Kosong'];
                return (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
                    className={`bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow border-l-4 ${style.border} overflow-hidden`}>
                    {c.gambar_url && (
                      <div className="h-36 overflow-hidden cursor-pointer" onClick={() => setImageModalUrl(c.gambar_url)}>
                        <img src={c.gambar_url} alt="Gambar" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold text-slate-900 flex-1">{c.nama_customer}</h3>
                        <div className="flex items-center gap-1 ml-2">
                          {style.icon}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.badge}`}>{status}</span>
                        </div>
                      </div>
                      <div className="space-y-1 mb-3 text-sm text-slate-600">
                        <div className="flex items-center gap-2"><Phone className="w-3 h-3 shrink-0" /><span>{c.no_telp}</span></div>
                        {c.cabang && <div className="flex items-center gap-2"><Building className="w-3 h-3 shrink-0" /><span>{c.cabang}</span></div>}
                      </div>
                      <div className="bg-orange-50 rounded-lg p-3 mb-4">
                        <p className="text-sm text-slate-700 line-clamp-3 whitespace-pre-wrap">{c.info_percakapan}</p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-3 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1"><User className="w-3 h-3" /><span>{c.users?.username}</span></div>
                        <div className="flex items-center gap-2">
                          {/* Indikator foto */}
                          {c.gambar_url ? (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-primary-50 text-primary-500 rounded text-xs font-medium">
                              <ImageIcon className="w-3 h-3" /> Foto
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 text-slate-300 rounded text-xs">
                              <ImageIcon className="w-3 h-3" /> No foto
                            </span>
                          )}
                          <div className="flex items-center gap-1"><Clock className="w-3 h-3" /><span>{new Date(c.waktu).toLocaleDateString('id-ID')}</span></div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPreviewCatatan(c)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors text-sm font-medium"
                        >
                          <Eye className="w-3.5 h-3.5" /> Preview
                        </button>
                        <button onClick={() => openActionModal(c)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors text-sm font-medium">
                          <MessageSquare className="w-3.5 h-3.5" /> Action
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

      {imageModalUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setImageModalUrl(null)}>
          <div className="relative max-w-4xl max-h-full">
            <img src={imageModalUrl} alt="Preview" className="max-h-[85vh] max-w-full rounded-xl object-contain" />
            <button onClick={() => setImageModalUrl(null)} className="absolute -top-3 -right-3 bg-white text-slate-700 rounded-full p-2 shadow-lg hover:bg-red-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <Modal isOpen={!!actionModal} onClose={() => { setActionModal(null); setCommentImageFile(null); setCommentImagePreview(null); }} title="Action Barang Kosong" size="md">
        {actionModal && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl">
              <div className="p-2 bg-orange-100 rounded-lg"><Package className="w-5 h-5 text-orange-600" /></div>
              <div>
                <p className="font-semibold text-slate-900">{actionModal.catatan.nama_customer}</p>
                <p className="text-sm text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {actionModal.catatan.no_telp}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Update Status Barang</label>
              <div className="grid grid-cols-1 gap-2">
                {STATUS_OPTIONS.map((s) => {
                  const st = STATUS_COLOR[s];
                  const isSelected = waNewStatus === s;
                  return (
                    <button key={s} type="button" onClick={() => setWaNewStatus(s)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${isSelected ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 hover:border-slate-300 text-slate-700'}`}>
                      {st.icon}<span>{s}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dikerjakan Oleh — auto dari user login */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Dikerjakan Oleh</label>
              <div className="px-4 py-2 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-800 font-medium flex items-center gap-2">
                <BadgeCheck className="w-4 h-4 text-primary-500" />
                {myEmployeeName || user?.username || 'Kamu'}
              </div>
            </div>

            {/* Keterangan + Gambar */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Keterangan / Comment</label>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows="2"
                placeholder="Tulis keterangan..." className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 bg-slate-50 text-sm" />
              <div className="mt-2">
                <input ref={commentImageRef} type="file" accept="image/*" onChange={handleCommentImageChange} className="hidden" />
                {commentImagePreview ? (
                  <div className="relative inline-block">
                    <img src={commentImagePreview} alt="Preview" className="h-24 rounded-lg object-cover border border-slate-300" />
                    <button type="button" onClick={() => { setCommentImageFile(null); setCommentImagePreview(null); if (commentImageRef.current) commentImageRef.current.value = ''; }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => commentImageRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-primary-400 hover:text-primary-500 transition-colors">
                    <ImagePlus className="w-4 h-4" /> Tambah Foto
                  </button>
                )}
              </div>
            </div>

            {formatWaNumber(actionModal.catatan.no_telp) && (
              <div className="border-t border-slate-200 pt-4">
                <label className="block text-sm font-semibold text-green-700 mb-2 flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4" /> Pesan WhatsApp
                </label>
                <textarea value={waPesan} onChange={(e) => setWaPesan(e.target.value)} rows="3"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent text-sm"
                  placeholder="Tulis pesan WA..." />
              </div>
            )}

            <div className="flex gap-3 pt-2 border-t">
              <button onClick={() => { setActionModal(null); setCommentImageFile(null); setCommentImagePreview(null); }}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium text-sm">Batal</button>
              {formatWaNumber(actionModal.catatan.no_telp) && (
                <button onClick={handleKirimWa} disabled={updateMutation.isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-semibold text-sm disabled:opacity-50">
                  <MessageCircle className="w-4 h-4" /> Kirim WA &amp; Update
                </button>
              )}
              <button onClick={handleUpdateStatusSaja} disabled={updateMutation.isLoading}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold text-sm disabled:opacity-50">
                <CheckCircle className="w-4 h-4" />
                {updateMutation.isLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {previewCatatan && (
        <CatatanPreviewModal catatan={previewCatatan} onClose={() => setPreviewCatatan(null)} />
      )}
    </div>
  );
}
