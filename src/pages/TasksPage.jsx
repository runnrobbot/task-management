import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  CheckSquare, Clock, CheckCircle, XCircle, Calendar, User, MessageSquare,
  BadgeCheck, Search, Filter, Phone, AlertCircle, Loader2, ImagePlus, X as XIcon, Eye, ChevronDown
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { logActivity, AUDIT_ACTIONS } from '@/services/auditLogService';
import { useScope } from '@/lib/useScope';
import { QUERY_KEYS } from '@/lib/constants';
import Modal from '@/components/common/Modal';
import Pagination from '@/components/common/Pagination';
import CatatanPreviewModal from '@/components/common/CatatanPreviewModal';

const PAGE_SIZE = 12;
const BUCKET = 'catatan-images';

// Status Task options (menggantikan Status Follow Up WA)
const STATUS_TASK_OPTIONS = ['Pending', 'Cancel', 'Selesai'];

const STATUS_TASK_STYLE = {
  'Pending': { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400', icon: <Clock className="w-3 h-3" /> },
  'Cancel':  { badge: 'bg-red-100 text-red-700',    dot: 'bg-red-400',    icon: <XCircle className="w-3 h-3" /> },
  'Selesai': { badge: 'bg-green-100 text-green-700', dot: 'bg-green-500',  icon: <CheckCircle className="w-3 h-3" /> },
};

// Komponen action modal yang dapat digunakan dari luar (Dashboard)
export function TaskActionModal({ isOpen, task, onClose, onSuccess }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const commentImageRef = useRef(null);

  const [statusTaskValue, setStatusTaskValue] = useState('Pending');
  const [relatedCatatan, setRelatedCatatan] = useState(null);
  const [loadingCatatan, setLoadingCatatan] = useState(false);
  const [commentImageFile, setCommentImageFile] = useState(null);
  const [commentImagePreview, setCommentImagePreview] = useState(null);
  useEffect(() => {
    if (isOpen && task) {
      setCommentImageFile(null);
      setCommentImagePreview(null);
      setStatusTaskValue(task?.status || 'Pending');
      fetchRelatedCatatan(task);
    }
  }, [isOpen, task]);

  const uploadCommentImage = async (file) => {
    if (!file) return null;
    const ext = file.name.split('.').pop();
    const fileName = `comment_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, { upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const fetchRelatedCatatan = async (t) => {
    // no longer syncs catatan status_wa
    setRelatedCatatan(null);
    setLoadingCatatan(false);
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, status_task, comment, imgFile }) => {
      let commentImageUrl = null;
      if (imgFile) commentImageUrl = await uploadCommentImage(imgFile);
      const payload = { status: status_task, comment, updated_at: new Date().toISOString() };
      if (commentImageUrl) payload.comment_image_url = commentImageUrl;
      const { error } = await supabase.from('tasks').update(payload).eq('id', id);
      if (error) throw error;
      await logActivity({ userId: user.id, username: user.username, action: AUDIT_ACTIONS.UPDATE_TASK, entity: 'tasks', entityId: id, detail: `Update status task #${id} → ${status_task}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STATS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.REMINDERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CATATAN] });
      handleClose();
      onSuccess?.();
    },
  });

  const handleClose = () => {
    setRelatedCatatan(null);
    setCommentImageFile(null);
    setCommentImagePreview(null);
    onClose();
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

  const getWaNumber = (t) => {
    if (t?.no_telp) { let n = t.no_telp.replace(/[^0-9]/g, ''); if (n.startsWith('0')) n = '62' + n.substring(1); return n; }
    const match = t?.deskripsi?.match(/No Telp:\s*([0-9+\-\s]+)/i);
    if (match?.[1]) { let n = match[1].replace(/[^0-9]/g, ''); if (n.startsWith('0')) n = '62' + n.substring(1); return n; }
    return '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    updateMutation.mutate({
      id: task.id,
      status_task: statusTaskValue,
      comment: formData.get('comment'),
      imgFile: commentImageFile,
    });
  };

  const handleWhatsAppAndComplete = () => {
    const waNum = getWaNumber(task);
    if (waNum) {
      const message = document.getElementById('wa-message-modal')?.value || 'Halo Kak, pesanan/permintaannya sudah kami selesaikan ya. Terima kasih!';
      window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(message)}`, '_blank');
    }
    setStatusTaskValue('Selesai');
    setTimeout(() => {
      const form = document.getElementById('action-form-modal');
      if (form) form.requestSubmit();
    }, 50);
  };

  if (!task) return null;
  const waNum = getWaNumber(task);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Update Status Task" size="md">
      <form id="action-form-modal" onSubmit={handleSubmit} className="space-y-4">


        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Dikerjakan Oleh</label>
          <div className="px-4 py-2 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-800 font-medium flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-primary-500" />
            {user?.username || 'Kamu'}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Keterangan / Comment</label>
          <textarea name="comment" defaultValue={task?.comment || ''} rows="3" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 bg-slate-50" required />
          <div className="mt-2">
            <input ref={commentImageRef} type="file" accept="image/*" onChange={handleCommentImageChange} className="hidden" />
            {commentImagePreview ? (
              <div className="relative inline-block">
                <img src={commentImagePreview} alt="Preview" className="h-24 rounded-lg object-cover border border-slate-300" />
                <button type="button" onClick={() => { setCommentImageFile(null); setCommentImagePreview(null); if (commentImageRef.current) commentImageRef.current.value = ''; }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600">
                  <XIcon className="w-3 h-3" />
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

        <div className="border-t border-slate-200 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-primary-500" />
            <label className="text-sm font-semibold text-slate-700">Status Task</label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {STATUS_TASK_OPTIONS.map((s) => {
              const st = STATUS_TASK_STYLE[s];
              const isSelected = statusTaskValue === s;
              return (
                <button key={s} type="button" onClick={() => setStatusTaskValue(s)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                    isSelected ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${st.dot}`}></span>{s}
                </button>
              );
            })}
          </div>
        </div>

        {waNum && (
          <div className="border-t border-slate-200 pt-4">
            <label className="block text-sm font-semibold text-green-600 mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Isi Pesan WhatsApp
            </label>
            <textarea id="wa-message-modal" defaultValue="Halo Kak, pesanan/permintaannya sudah kami selesaikan ya. Terima kasih!" rows="3" className="w-full px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-green-50" />
          </div>
        )}

        <div className="flex gap-3 justify-end pt-4">
          <button type="button" onClick={handleClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium">Batal</button>
          {waNum && (
            <button type="button" onClick={handleWhatsAppAndComplete} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Selesaikan & Kirim WA
            </button>
          )}
          <button type="submit" disabled={updateMutation.isLoading} className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium disabled:opacity-50">
            {updateMutation.isLoading ? 'Menyimpan...' : 'Update Status'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function TasksPage() {
  const { user } = useAuthStore();
  const { isAdmin, userId, applyUserFilter } = useScope();

  const [actionModal, setActionModal] = useState({ isOpen: false, task: null });
  const [previewCatatan, setPreviewCatatan] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: result = { data: [], count: 0, totalPages: 1 }, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.TASKS, { search, statusFilter, page, isAdmin, userId }],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('*, users:user_id(username)', { count: 'exact' })
        .order('created_at', { ascending: false });

      query = applyUserFilter(query);

      if (search) query = query.or(`judul_task.ilike.%${search}%,deskripsi.ilike.%${search}%,nama_customer.ilike.%${search}%`);
      if (statusFilter) query = query.eq('status', statusFilter);

      const from = (page - 1) * PAGE_SIZE;
      query = query.range(from, from + PAGE_SIZE - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0, totalPages: Math.ceil((count || 0) / PAGE_SIZE) };
    },
    enabled: !!user,
    keepPreviousData: true,
  });

  const tasks = result.data;

  const getStatusIcon = (status) => {
    if (status === 'Selesai') return <CheckCircle className="w-4 h-4" />;
    if (status === 'Cancel') return <XCircle className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  const getStatusColor = (status) => {
    if (status === 'Selesai') return 'bg-green-100 text-green-700 border-green-200';
    if (status === 'Cancel') return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  };

  const getRoleColor = (kategori) => {
    if (kategori === 'Offline') return 'border-l-primary-600';
    if (kategori === 'Lelang') return 'border-l-primary-500';
    return 'border-l-primary-500';
  };

  const handleSearchChange = (val) => { setSearch(val); setPage(1); };
  const handleStatusChange = (val) => { setStatusFilter(val); setPage(1); };

  return (
    <div className="min-h-screen">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-center gap-3 mb-6">
          <CheckSquare className="w-8 h-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-slate-900">Task Mission</h1>
        </div>

        <div className="bg-white p-4 rounded-xl shadow mb-6">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-600">
            <Filter className="w-4 h-4" /> Filter & Pencarian
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="text" placeholder="Cari judul, deskripsi, customer..." value={search} onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
            <div className="relative">
              <select value={statusFilter} onChange={(e) => handleStatusChange(e.target.value)} className="w-full pl-4 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white cursor-pointer text-slate-700 hover:border-primary-400 transition-colors">
                <option value="">Semua Status</option>
                <option value="Pending">Pending</option>
                <option value="Selesai">Selesai</option>
                <option value="Cancel">Cancel</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          {(search || statusFilter) && (
            <button onClick={() => { handleSearchChange(''); handleStatusChange(''); }} className="mt-3 text-sm text-red-500 hover:text-red-700 underline">
              Reset Filter
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">{result.count} task ditemukan</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Memuat tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow">
            <CheckSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">Belum ada task mission.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tasks.map((task, index) => (
                <motion.div key={task.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.04 }}
                  className={`bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 border-l-4 ${getRoleColor(task.kategori)} overflow-hidden`}>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-slate-900 mb-2">{task.judul_task}</h3>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <User className="w-4 h-4" /><span>{task.users?.username || 'Unknown'}</span>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border ${getStatusColor(task.status)}`}>
                        {getStatusIcon(task.status)}{task.status}
                      </span>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 mb-4">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-4">{task.deskripsi}</p>
                    </div>
                    {task.comment && (
                      <div className="bg-primary-50 border-l-4 border-primary-500 rounded-lg p-3 mb-4">
                        <p className="text-xs font-semibold text-primary-900 mb-1">Keterangan:</p>
                        <p className="text-sm text-primary-800">{task.comment}</p>
                        {task.comment_image_url && (
                          <img src={task.comment_image_url} alt="Foto keterangan" className="mt-2 rounded-lg max-h-32 object-cover cursor-pointer" onClick={() => window.open(task.comment_image_url, '_blank')} />
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Calendar className="w-4 h-4" /><span>{new Date(task.created_at).toLocaleDateString('id-ID')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPreviewCatatan({
                            nama_customer: task.nama_customer,
                            no_telp: task.no_telp,
                            cabang: task.cabang,
                            info_percakapan: task.deskripsi,
                            comment: task.comment,
                            comment_image_url: task.comment_image_url,
                            users: task.users,
                            waktu: task.created_at,
                            status_wa: task.status === 'Selesai' ? 'Selesai' : task.status === 'Cancel' ? 'Belum Dihubungi' : 'Proses',
                          })}
                          className="px-3 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors font-medium text-sm flex items-center gap-1.5"
                        >
                          <Eye className="w-4 h-4" /> Preview
                        </button>
                        <button onClick={() => setActionModal({ isOpen: true, task })}
                          className="px-4 py-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors font-medium text-sm flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />Action
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <Pagination page={page} totalPages={result.totalPages} onPageChange={setPage} />
          </>
        )}
      </motion.div>

      <TaskActionModal
        isOpen={actionModal.isOpen}
        task={actionModal.task}
        onClose={() => setActionModal({ isOpen: false, task: null })}
      />

      {previewCatatan && (
        <CatatanPreviewModal catatan={previewCatatan} onClose={() => setPreviewCatatan(null)} />
      )}
    </div>
  );
}
