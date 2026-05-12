import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CheckSquare, Clock, CheckCircle, XCircle, Calendar, User, MessageSquare, BadgeCheck, Search, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { QUERY_KEYS } from '@/lib/constants';
import Modal from '@/components/common/Modal';
import Pagination from '@/components/common/Pagination';

const PAGE_SIZE = 12;

export default function TasksPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [actionModal, setActionModal] = useState({ isOpen: false, task: null });
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: result = { data: [], count: 0, totalPages: 1 }, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.TASKS, { search, statusFilter, kategoriFilter, page }],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('*, users:user_id(username), employees:employee_id(id, name)', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (search) query = query.or(`judul_task.ilike.%${search}%,deskripsi.ilike.%${search}%,nama_customer.ilike.%${search}%`);
      if (statusFilter) query = query.eq('status', statusFilter);
      if (kategoriFilter) query = query.eq('kategori', kategoriFilter);

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

  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, name, divisions:divisi_id(name)')
        .order('name');
      if (data) {
        if (user?.role !== 'admin' && user?.divisi_name && user.divisi_name.toLowerCase() !== 'umum') {
          setEmployees(data.filter(emp => emp.divisions?.name?.toLowerCase() === user.divisi_name.toLowerCase()));
        } else {
          setEmployees(data);
        }
      }
    };
    if (user) fetchEmployees();
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, comment, employee_id }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ status, comment, employee_id, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries([QUERY_KEYS.TASKS]);
      queryClient.invalidateQueries([QUERY_KEYS.STATS]);
      queryClient.invalidateQueries([QUERY_KEYS.REMINDERS]);
      setActionModal({ isOpen: false, task: null });
    },
  });

  const openActionModal = (task) => setActionModal({ isOpen: true, task });

  const handleUpdateStatus = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    updateMutation.mutate({
      id: actionModal.task.id,
      status: formData.get('status'),
      comment: formData.get('comment'),
      employee_id: formData.get('employee_id') || null,
    });
  };

  const getWaNumber = (deskripsi) => {
    if (!deskripsi) return '';
    const match = deskripsi.match(/No Telp:\s*([0-9+\-\s]+)/i);
    if (match?.[1]) {
      let n = match[1].replace(/[^0-9]/g, '');
      if (n.startsWith('0')) n = '62' + n.substring(1);
      return n;
    }
    return '';
  };

  const handleWhatsAppAndComplete = () => {
    const waNum = getWaNumber(actionModal.task?.deskripsi);
    if (waNum) {
      const message = document.getElementById('wa-message')?.value || 'Halo Kak, pesanan/permintaannya sudah kami selesaikan ya. Terima kasih!';
      window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(message)}`, '_blank');
    }
    const form = document.getElementById('action-form');
    form.querySelector('[name="status"]').value = 'Selesai';
    form.requestSubmit();
  };

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
    if (kategori === 'Offline') return 'border-l-purple-500';
    if (kategori === 'Lelang') return 'border-l-orange-500';
    return 'border-l-blue-500';
  };

  const handleSearchChange = (val) => { setSearch(val); setPage(1); };
  const handleStatusChange = (val) => { setStatusFilter(val); setPage(1); };
  const handleKategoriChange = (val) => { setKategoriFilter(val); setPage(1); };

  return (
    <div className="min-h-screen">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-center gap-3 mb-6">
          <CheckSquare className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Task Mission</h1>
        </div>

        {/* Filter & Search */}
        <div className="bg-white p-4 rounded-xl shadow mb-6">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-600">
            <Filter className="w-4 h-4" /> Filter & Pencarian
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Cari judul, deskripsi, customer..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select value={statusFilter} onChange={(e) => handleStatusChange(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="">Semua Status</option>
              <option value="Pending">Pending</option>
              <option value="Selesai">Selesai</option>
              <option value="Cancel">Cancel</option>
            </select>
            <select value={kategoriFilter} onChange={(e) => handleKategoriChange(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="">Semua Kategori</option>
              <option value="Offline">Offline</option>
              <option value="User">User</option>
              <option value="Lelang">Lelang</option>
            </select>
          </div>
          {(search || statusFilter || kategoriFilter) && (
            <button onClick={() => { handleSearchChange(''); handleStatusChange(''); handleKategoriChange(''); }} className="mt-3 text-sm text-red-500 hover:text-red-700 underline">
              Reset Filter
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">{result.count} task ditemukan</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Memuat tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow">
            <CheckSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">Belum ada task mission.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.04 }}
                  className={`bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 border-l-4 ${getRoleColor(task.kategori)} overflow-hidden`}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-900 mb-2">{task.judul_task}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <User className="w-4 h-4" /><span>{task.users?.username || 'Unknown'}</span>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border ${getStatusColor(task.status)}`}>
                        {getStatusIcon(task.status)}{task.status}
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">{task.deskripsi}</p>
                    </div>
                    {task.comment && (
                      <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-3 mb-4">
                        <p className="text-xs font-semibold text-blue-900 mb-1">Keterangan:</p>
                        <p className="text-sm text-blue-800">{task.comment}</p>
                      </div>
                    )}
                    {task.status === 'Selesai' && task.employees && (
                      <div className="flex items-center gap-2 text-sm font-semibold text-green-600 mb-4">
                        <BadgeCheck className="w-4 h-4" /><span>Dikerjakan: {task.employees.name}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Calendar className="w-4 h-4" /><span>{new Date(task.created_at).toLocaleDateString('id-ID')}</span>
                      </div>
                      <button
                        onClick={() => openActionModal(task)}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm flex items-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />Action
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <Pagination page={page} totalPages={result.totalPages} onPageChange={setPage} />
          </>
        )}
      </motion.div>

      <Modal isOpen={actionModal.isOpen} onClose={() => setActionModal({ isOpen: false, task: null })} title="Update Status Task" size="md">
        <form id="action-form" onSubmit={handleUpdateStatus} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
            <select name="status" defaultValue={actionModal.task?.status || 'Pending'} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50" required>
              <option value="Selesai">Selesai</option>
              <option value="Cancel">Cancel</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Dikerjakan Oleh</label>
            <select name="employee_id" defaultValue={actionModal.task?.employee_id || ''} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50">
              <option value="">-- Pilih Karyawan --</option>
              {employees.map(emp => (<option key={emp.id} value={emp.id}>{emp.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Keterangan / Comment</label>
            <textarea name="comment" defaultValue={actionModal.task?.comment || ''} rows="3" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50" required />
          </div>
          {getWaNumber(actionModal.task?.deskripsi) && (
            <div className="border-t border-gray-200 pt-4">
              <label className="block text-sm font-semibold text-green-600 mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Isi Pesan WhatsApp
              </label>
              <textarea id="wa-message" defaultValue="Halo Kak, pesanan/permintaannya sudah kami selesaikan ya. Terima kasih!" rows="3" className="w-full px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-green-50" />
            </div>
          )}
          <div className="flex gap-3 justify-end pt-4">
            <button type="button" onClick={() => setActionModal({ isOpen: false, task: null })} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">
              Batal
            </button>
            {getWaNumber(actionModal.task?.deskripsi) && (
              <button type="button" onClick={handleWhatsAppAndComplete} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Selesaikan & Kirim WA
              </button>
            )}
            <button type="submit" disabled={updateMutation.isLoading} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium disabled:opacity-50">
              {updateMutation.isLoading ? 'Menyimpan...' : 'Update Status'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
