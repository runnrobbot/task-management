import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, CheckSquare, Clock, XCircle, TrendingUp,
  AlertTriangle, User, Calendar, BadgeCheck,
  CheckCircle, FileText, CalendarX, Phone, Building,
  Users, ChevronDown, MessageSquare, Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { QUERY_KEYS } from '@/lib/constants';
import { useNavigate } from 'react-router-dom';
import Modal from '@/components/common/Modal';
import CatatanPreviewModal from '@/components/common/CatatanPreviewModal';
import { TaskActionModal } from '@/pages/TasksPage';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

// "Sudah Dihubungi" dihapus
const STATUS_WA_OPTIONS = ['Belum Dihubungi', 'Proses', 'Selesai'];
const STATUS_WA_STYLE = {
  'Belum Dihubungi': { dot: 'bg-gray-400',   badge: 'bg-slate-100 text-slate-700' },
  'Sudah Dihubungi': { dot: 'bg-primary-400',   badge: 'bg-primary-100 text-primary-700' }, // legacy compat
  'Proses':          { dot: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-700' },
  'Selesai':         { dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700' },
};

// TaskCard dengan tombol Action
function TaskCard({ task, onAction }) {
  const getStatusColor = (s) => {
    if (s === 'Selesai') return 'bg-green-100 text-green-700 border-green-200';
    if (s === 'Cancel') return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  };
  const getBorderColor = (s) => {
    if (s === 'Selesai') return 'border-l-primary-500';
    if (s === 'Cancel') return 'border-l-red-500';
    return 'border-l-primary-500';
  };
  return (
    <div className={`bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow border-l-4 ${getBorderColor(task.status)} p-5`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-bold text-slate-900 mb-1 line-clamp-1">{task.judul_task}</h4>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <User className="w-3 h-3" /><span>{task.users?.username || 'Unknown'}</span>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-bold border ml-2 shrink-0 ${getStatusColor(task.status)}`}>{task.status}</span>
      </div>
      <div className="bg-slate-50 rounded-lg p-3 mb-3">
        <p className="text-xs text-slate-600 line-clamp-3 whitespace-pre-wrap">{task.deskripsi}</p>
      </div>
      {task.comment && (
        <div className="bg-primary-50 border-l-2 border-primary-400 rounded-lg p-2 mb-3">
          <p className="text-xs text-primary-800 line-clamp-2">{task.comment}</p>
        </div>
      )}
      {task.status === 'Selesai' && task.employees && (
        <div className="flex items-center gap-1 text-xs font-semibold text-green-600 mb-3">
          <BadgeCheck className="w-3 h-3" /><span>{task.employees.name}</span>
        </div>
      )}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Calendar className="w-3 h-3" />
          <span>{new Date(task.created_at).toLocaleDateString('id-ID')}</span>
        </div>
        {onAction && (
          <button onClick={() => onAction(task)}
            className="px-3 py-1.5 bg-primary-50 text-primary-600 rounded-lg text-xs font-medium hover:bg-primary-100 flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> Action
          </button>
        )}
      </div>
    </div>
  );
}

function BarChartWidget({ tasks }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    const pending = tasks.filter(t => t.status === 'Pending').length;
    const selesai = tasks.filter(t => t.status === 'Selesai').length;
    const cancel = tasks.filter(t => t.status === 'Cancel').length;
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: ['Pending', 'Selesai', 'Cancel'],
        datasets: [{ label: 'Jumlah Task', data: [pending, selesai, cancel], backgroundColor: ['rgba(251,191,36,0.8)', 'rgba(34,197,94,0.8)', 'rgba(239,68,68,0.8)'], borderColor: ['rgb(251,191,36)', 'rgb(34,197,94)', 'rgb(239,68,68)'], borderWidth: 2, borderRadius: 8 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: true, text: 'Task per Status', font: { size: 14, weight: 'bold' }, color: '#374151' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } } },
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [tasks]);
  return <canvas ref={canvasRef} />;
}

function LineChartWidget({ tasks }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    const days = 14; const labels = []; const countsByDay = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      labels.push(key); countsByDay[key] = { total: 0, selesai: 0 };
    }
    tasks.forEach(t => {
      const key = new Date(t.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      if (countsByDay[key] !== undefined) { countsByDay[key].total++; if (t.status === 'Selesai') countsByDay[key].selesai++; }
    });
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Task Masuk', data: labels.map(l => countsByDay[l].total), borderColor: 'rgb(61,107,82)', backgroundColor: 'rgba(61,107,82,0.1)', borderWidth: 2, fill: true, tension: 0.4, pointBackgroundColor: 'rgb(61,107,82)', pointRadius: 4 }, { label: 'Task Selesai', data: labels.map(l => countsByDay[l].selesai), borderColor: 'rgb(34,197,94)', backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 2, fill: true, tension: 0.4, pointBackgroundColor: 'rgb(34,197,94)', pointRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Tren Task 14 Hari Terakhir', font: { size: 14, weight: 'bold' }, color: '#374151' }, legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false }, ticks: { maxRotation: 45 } } } },
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [tasks]);
  return <canvas ref={canvasRef} />;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [selectedUserId, setSelectedUserId] = useState(null);

  // Overdue catatan modal
  const [overdueModal, setOverdueModal] = useState(null);
  const [overdueStatus, setOverdueStatus] = useState('Proses');
  const [overdueKeterangan, setOverdueKeterangan] = useState('');

  // Task action modal (shared TaskActionModal dari TasksPage)
  const [taskActionModal, setTaskActionModal] = useState({ isOpen: false, task: null });
  const [previewCatatan, setPreviewCatatan] = useState(null);

  const effectiveUserId = isAdmin ? selectedUserId : (user?.id ?? null);
  const showAll = isAdmin && selectedUserId === null;

  const applyFilter = (query, field = 'user_id') => {
    if (!user) return query;
    if (showAll) return query;
    return query.eq(field, effectiveUserId);
  };

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all_users_dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('id, username, role').order('username');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && isAdmin,
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: [QUERY_KEYS.TASKS, 'dashboard', effectiveUserId, showAll],
    queryFn: async () => {
      let q = supabase.from('tasks').select('*, users:user_id(username), employees:employee_id(name, id)').order('created_at', { ascending: false });
      q = applyFilter(q);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: reminders = [] } = useQuery({
    queryKey: [QUERY_KEYS.REMINDERS, effectiveUserId, showAll],
    queryFn: async () => {
      const oneDayAgo = new Date(); oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      let q = supabase.from('tasks').select('*, users:user_id(username), employees:employee_id(name, id)').eq('status', 'Pending').lt('created_at', oneDayAgo.toISOString()).order('created_at', { ascending: true });
      q = applyFilter(q);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(t => { const diffDays = Math.floor((Date.now() - new Date(t.created_at).getTime()) / 86400000); return { ...t, diffDays, severity: diffDays > 2 ? 'urgent' : 'warning' }; });
    },
    enabled: !!user,
  });

  const { data: employeeStats = [] } = useQuery({
    queryKey: [QUERY_KEYS.EMPLOYEE_STATS, effectiveUserId, showAll],
    queryFn: async () => {
      let q = supabase.from('tasks').select('employee_id, employees:employee_id(name)').eq('status', 'Selesai').not('employee_id', 'is', null);
      q = applyFilter(q);
      const { data, error } = await q;
      if (error) throw error;
      const acc = {};
      data.forEach(t => { if (t.employee_id && t.employees) { if (!acc[t.employee_id]) acc[t.employee_id] = { employee_name: t.employees.name, count: 0 }; acc[t.employee_id].count++; } });
      return Object.values(acc).sort((a, b) => b.count - a.count);
    },
    enabled: !!user && isAdmin,
  });

  const { data: catatanList = [] } = useQuery({
    queryKey: [QUERY_KEYS.CATATAN, 'dashboard', effectiveUserId, showAll],
    queryFn: async () => {
      let q = supabase.from('data_catatan').select('*, users:user_id(username), catatan_kategori:kategori_id(id, nama)').order('waktu', { ascending: false }).limit(6);
      q = applyFilter(q);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: overdueCatatan = [] } = useQuery({
    queryKey: ['catatan_overdue', effectiveUserId, showAll],
    queryFn: async () => {
      const now = new Date().toISOString();
      let q = supabase.from('data_catatan').select('*, users:user_id(username), catatan_kategori:kategori_id(id, nama)').not('deadline', 'is', null).lt('deadline', now).neq('status_wa', 'Selesai').order('deadline', { ascending: true }).limit(12);
      q = applyFilter(q);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const updateOverdueMutation = useMutation({
    mutationFn: async ({ id, status_wa, keterangan }) => {
      const { error } = await supabase.from('data_catatan').update({ status_wa, info_percakapan: keterangan || overdueModal?.info_percakapan }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['catatan_overdue']);
      queryClient.invalidateQueries([QUERY_KEYS.CATATAN]);
      setOverdueModal(null);
    },
  });

  const openOverdueModal = (catatan) => {
    setOverdueModal(catatan);
    const existing = catatan.status_wa || 'Belum Dihubungi';
    const normalized = existing === 'Sudah Dihubungi' ? 'Proses' : existing;
    setOverdueStatus(STATUS_WA_OPTIONS.includes(normalized) ? normalized : 'Belum Dihubungi');
    setOverdueKeterangan(catatan.info_percakapan || '');
  };

  const pendingTasks = allTasks.filter(t => t.status === 'Pending');
  const completedTasks = allTasks.filter(t => t.status === 'Selesai' || t.status === 'Cancel');
  const hasUrgent = reminders.some(r => r.severity === 'urgent');

  const getKategoriBadge = (nama) => {
    if (!nama) return 'bg-slate-100 text-slate-600';
    const map = { 'barang masuk': 'bg-orange-100 text-orange-700', 'barang kosong': 'bg-red-100 text-red-700', 'umum': 'bg-primary-100 text-primary-700' };
    return map[nama.toLowerCase()] || 'bg-primary-100 text-primary-700';
  };

  const dashboardTitle = isAdmin
    ? selectedUserId ? `Data: ${allUsers.find(u => u.id === selectedUserId)?.username || '...'}` : 'Semua Pengguna'
    : user?.username || 'Saya';

  return (
    <div className="min-h-screen">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-primary-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-sm text-slate-500 mt-0.5">{dashboardTitle}</p>
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
              <Users className="w-4 h-4 text-primary-500 shrink-0" />
              <div className="relative">
                <select value={selectedUserId || ''} onChange={(e) => setSelectedUserId(e.target.value || null)}
                  className="pl-1 pr-7 py-0.5 text-sm font-medium text-slate-700 focus:outline-none appearance-none bg-transparent cursor-pointer">
                  <option value="">Semua Pengguna</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.username}{u.role === 'admin' ? ' (Admin)' : ''}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        {hasUrgent && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg mb-6 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <span className="font-semibold text-red-800">PERINGATAN: Ada Task yang MELEWATI BATAS 2 HARI! Segera diselesaikan!</span>
          </motion.div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Total Task',
              value: allTasks.length,
              icon: CheckSquare,
              iconBg: 'bg-primary-100',
              iconColor: 'text-primary-600',
              valuColor: 'text-primary-700',
              border: 'border-l-primary-500',
            },
            {
              label: 'Pending',
              value: pendingTasks.length,
              icon: Clock,
              iconBg: 'bg-amber-100',
              iconColor: 'text-amber-600',
              valuColor: 'text-amber-700',
              border: 'border-l-amber-400',
            },
            {
              label: 'Selesai',
              value: completedTasks.filter(t => t.status === 'Selesai').length,
              icon: CheckCircle,
              iconBg: 'bg-emerald-100',
              iconColor: 'text-emerald-600',
              valuColor: 'text-emerald-700',
              border: 'border-l-emerald-500',
            },
            {
              label: 'Cancel',
              value: completedTasks.filter(t => t.status === 'Cancel').length,
              icon: XCircle,
              iconBg: 'bg-red-100',
              iconColor: 'text-red-500',
              valuColor: 'text-red-600',
              border: 'border-l-red-400',
            },
          ].map(({ label, value, icon: Icon, iconBg, iconColor, valuColor, border }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`bg-white rounded-2xl shadow-sm border border-slate-100 border-l-4 ${border} p-5 flex items-center gap-4 hover:shadow-md transition-shadow`}
            >
              <div className={`p-3 rounded-xl ${iconBg} shrink-0`}>
                <Icon className={`w-6 h-6 ${iconColor}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
                <p className={`text-2xl font-bold ${valuColor}`}>{value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {allTasks.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-md p-6" style={{ height: 280 }}><BarChartWidget tasks={allTasks} /></div>
            <div className="bg-white rounded-2xl shadow-md p-6" style={{ height: 280 }}><LineChartWidget tasks={allTasks} /></div>
          </div>
        )}

        {/* Need Attention (Reminders) — dengan tombol Action */}
        {reminders.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" /> Need Attention (&gt; 1 Hari)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reminders.map((task, index) => (
                <motion.div key={task.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
                  className={`bg-white rounded-2xl shadow-md p-5 overflow-hidden ${task.severity === 'urgent' ? 'border-2 border-red-500' : 'border border-yellow-300'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-slate-900 line-clamp-1 flex-1">{task.judul_task}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ml-2 shrink-0 ${task.severity === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{task.diffDays}h</span>
                  </div>
                  <p className="text-xs text-slate-600 mb-3 line-clamp-2">{task.deskripsi}</p>
                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <span className="text-xs text-slate-400">{new Date(task.created_at).toLocaleDateString('id-ID')}</span>
                    <button onClick={() => setTaskActionModal({ isOpen: true, task })}
                      className="px-3 py-1.5 bg-primary-50 text-primary-600 rounded-lg text-xs font-medium hover:bg-primary-100 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> Action
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Task Pending — dengan tombol Action */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-primary-500" /> Task Pending
            <span className="text-sm font-normal text-slate-400 ml-1">({pendingTasks.length})</span>
          </h3>
          {pendingTasks.length === 0 ? (
            <div className="bg-white rounded-2xl shadow p-8 text-center">
              <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Tidak ada task pending.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingTasks.map((task, index) => (
                <motion.div key={task.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
                  <TaskCard task={task} onAction={(t) => setTaskActionModal({ isOpen: true, task: t })} />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Task Selesai / Cancel */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" /> Task Selesai / Cancel
            <span className="text-sm font-normal text-slate-400 ml-1">({completedTasks.length})</span>
          </h3>
          {completedTasks.length === 0 ? (
            <div className="bg-white rounded-2xl shadow p-8 text-center">
              <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Belum ada task selesai atau cancel.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {completedTasks.slice(0, 9).map((task, index) => (
                <motion.div key={task.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
                  <TaskCard task={task} />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Employee Ranking (admin only) */}
        {isAdmin && employeeStats.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" /> Ranking Karyawan
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {employeeStats.map((emp, index) => (
                <motion.div key={index} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-2xl shadow-md p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-sm">{index + 1}</div>
                    <div><h4 className="font-bold text-slate-900">{emp.employee_name}</h4><p className="text-xs text-slate-500">Karyawan</p></div>
                  </div>
                  <div className="text-center py-3 bg-slate-50 rounded-lg">
                    <p className="text-3xl font-bold text-slate-900">{emp.count}</p>
                    <p className="text-sm text-slate-500">Task Selesai</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Overdue Catatan */}
        {overdueCatatan.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <CalendarX className="w-5 h-5 text-red-500" />
                <span className="text-red-600">Catatan Overdue</span>
                <span className="ml-1 px-2 py-0.5 bg-red-100 text-red-700 text-sm font-bold rounded-full">{overdueCatatan.length}</span>
              </h3>
              <button onClick={() => navigate('/catatan')} className="text-sm text-red-600 hover:underline">Lihat Semua →</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {overdueCatatan.map((c, index) => {
                const kategoriNama = c.catatan_kategori?.nama;
                const diffMs = Date.now() - new Date(c.deadline).getTime();
                const diffDays = Math.floor(diffMs / 86400000);
                const diffHours = Math.floor((diffMs % 86400000) / 3600000);
                const overdueLabel = diffDays > 0 ? `${diffDays} hari yang lalu` : `${diffHours} jam yang lalu`;
                const statusStyle = STATUS_WA_STYLE[c.status_wa || 'Belum Dihubungi'] || STATUS_WA_STYLE['Belum Dihubungi'];
                return (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
                    className="bg-white rounded-xl shadow border-2 border-red-300 p-4 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => openOverdueModal(c)}>
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-slate-900 text-sm line-clamp-1">{c.nama_customer}</p>
                      {kategoriNama && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium ml-2 shrink-0">{kategoriNama}</span>}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-2">{c.info_percakapan}</p>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-red-50 rounded-lg mb-2">
                      <CalendarX className="w-3 h-3 text-red-500 shrink-0" />
                      <span className="text-xs text-red-700 font-semibold">Lewat {overdueLabel}</span>
                      <span className="text-xs text-red-400 ml-auto">{new Date(c.deadline).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
                      <span>{c.users?.username}</span>
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}></span>
                          {c.status_wa || 'Belum Dihubungi'}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewCatatan(c); }}
                          className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-xs font-medium"
                        >
                          <Eye className="w-3 h-3" /> Preview
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Catatan Terbaru */}
        {catatanList.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-500" /> Catatan Terbaru
              </h3>
              <button onClick={() => navigate('/catatan')} className="text-sm text-primary-600 hover:underline">Lihat Semua →</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catatanList.map((c, index) => {
                const kategoriNama = c.catatan_kategori?.nama;
                return (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
                    className="bg-white rounded-xl shadow p-4 border-l-4 border-l-primary-400">
                    {c.gambar_url && <img src={c.gambar_url} alt="" className="w-full h-28 object-cover rounded-lg mb-3" />}
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-slate-900 text-sm line-clamp-1">{c.nama_customer}</p>
                      {kategoriNama && <span className={`px-2 py-0.5 rounded-full text-xs font-medium ml-2 shrink-0 ${getKategoriBadge(kategoriNama)}`}>{kategoriNama}</span>}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-2">{c.info_percakapan}</p>
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
                      <span>{c.users?.username}</span>
                      <div className="flex items-center gap-2">
                        <span>{new Date(c.waktu).toLocaleDateString('id-ID')}</span>
                        <button
                          onClick={() => setPreviewCatatan(c)}
                          className="flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors text-xs font-medium"
                        >
                          <Eye className="w-3 h-3" /> Preview
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

      </motion.div>

      {/* Overdue Catatan Modal */}
      <Modal isOpen={!!overdueModal} onClose={() => setOverdueModal(null)} title="Action Catatan Overdue" size="md">
        {overdueModal && (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-xl border border-red-200">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-bold text-slate-900 text-base">{overdueModal.nama_customer}</p>
                  {overdueModal.no_telp && <div className="flex items-center gap-1 text-sm text-slate-600 mt-0.5"><Phone className="w-3 h-3" /> {overdueModal.no_telp}</div>}
                  {overdueModal.cabang && <div className="flex items-center gap-1 text-sm text-slate-600 mt-0.5"><Building className="w-3 h-3" /> {overdueModal.cabang}</div>}
                </div>
                {overdueModal.catatan_kategori?.nama && (
                  <span className="px-2 py-0.5 bg-white border border-red-200 text-red-600 rounded-full text-xs font-medium ml-2 shrink-0">{overdueModal.catatan_kategori.nama}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1.5 bg-red-100 rounded-lg">
                <CalendarX className="w-3 h-3 text-red-600 shrink-0" />
                <span className="text-xs text-red-700 font-semibold">Deadline: {new Date(overdueModal.deadline).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Status Follow-Up</label>
              <div className="grid grid-cols-3 gap-2">
                {STATUS_WA_OPTIONS.map((s) => {
                  const st = STATUS_WA_STYLE[s];
                  const isSelected = overdueStatus === s;
                  return (
                    <button key={s} onClick={() => setOverdueStatus(s)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${isSelected ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 hover:border-slate-300 text-slate-700'}`}>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`}></span>{s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Keterangan / Update Info</label>
              <textarea value={overdueKeterangan} onChange={(e) => setOverdueKeterangan(e.target.value)} rows="3"
                placeholder="Tulis update atau keterangan terbaru..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-slate-50" />
            </div>

            <div className="flex gap-3 pt-2 border-t">
              <button onClick={() => setOverdueModal(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium text-sm">Batal</button>
              <button
                onClick={() => updateOverdueMutation.mutate({ id: overdueModal.id, status_wa: overdueStatus, keterangan: overdueKeterangan })}
                disabled={updateOverdueMutation.isLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold text-sm disabled:opacity-50">
                <CheckCircle className="w-4 h-4" />
                {updateOverdueMutation.isLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Task Action Modal (reuse dari TasksPage) */}
      <TaskActionModal
        isOpen={taskActionModal.isOpen}
        task={taskActionModal.task}
        onClose={() => setTaskActionModal({ isOpen: false, task: null })}
        onSuccess={() => {
          queryClient.invalidateQueries([QUERY_KEYS.TASKS, 'dashboard']);
          queryClient.invalidateQueries([QUERY_KEYS.REMINDERS]);
        }}
      />

      {/* Catatan Preview Modal */}
      {previewCatatan && (
        <CatatanPreviewModal catatan={previewCatatan} onClose={() => setPreviewCatatan(null)} />
      )}
    </div>
  );
}
