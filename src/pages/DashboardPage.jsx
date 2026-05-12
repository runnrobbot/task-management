import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, CheckSquare, Clock, XCircle, TrendingUp,
  AlertTriangle, User, Calendar, MessageSquare, BadgeCheck,
  CheckCircle, FileText, Package
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { QUERY_KEYS } from '@/lib/constants';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import Modal from '@/components/common/Modal';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

// ── Mini task card ──────────────────────────────────────────────
function TaskCard({ task, onAction, showAction = true }) {
  const getStatusColor = (s) => {
    if (s === 'Selesai') return 'bg-green-100 text-green-700 border-green-200';
    if (s === 'Cancel') return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  };
  const getBorderColor = (s) => {
    if (s === 'Selesai') return 'border-l-green-500';
    if (s === 'Cancel') return 'border-l-red-500';
    return 'border-l-blue-500';
  };
  return (
    <div className={`bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow border-l-4 ${getBorderColor(task.status)} p-5`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-bold text-gray-900 mb-1 line-clamp-1">{task.judul_task}</h4>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <User className="w-3 h-3" /><span>{task.users?.username || 'Unknown'}</span>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-bold border ml-2 shrink-0 ${getStatusColor(task.status)}`}>
          {task.status}
        </span>
      </div>
      <div className="bg-gray-50 rounded-lg p-3 mb-3">
        <p className="text-xs text-gray-600 line-clamp-3 whitespace-pre-wrap">{task.deskripsi}</p>
      </div>
      {task.status === 'Selesai' && task.employees && (
        <div className="flex items-center gap-1 text-xs font-semibold text-green-600 mb-3">
          <BadgeCheck className="w-3 h-3" /><span>{task.employees.name}</span>
        </div>
      )}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Calendar className="w-3 h-3" />
          <span>{new Date(task.created_at).toLocaleDateString('id-ID')}</span>
        </div>
        {showAction && onAction && (
          <button
            onClick={() => onAction(task)}
            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs font-medium flex items-center gap-1"
          >
            <MessageSquare className="w-3 h-3" /> Action
          </button>
        )}
      </div>
    </div>
  );
}

// ── Bar Chart component ─────────────────────────────────────────
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
        datasets: [{
          label: 'Jumlah Task',
          data: [pending, selesai, cancel],
          backgroundColor: ['rgba(251,191,36,0.8)', 'rgba(34,197,94,0.8)', 'rgba(239,68,68,0.8)'],
          borderColor: ['rgb(251,191,36)', 'rgb(34,197,94)', 'rgb(239,68,68)'],
          borderWidth: 2,
          borderRadius: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Task per Status', font: { size: 14, weight: 'bold' }, color: '#374151' },
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.05)' } },
          x: { grid: { display: false } },
        },
      },
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [tasks]);

  return <canvas ref={canvasRef} />;
}

// ── Line Chart component ────────────────────────────────────────
function LineChartWidget({ tasks }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    // Last 14 days
    const days = 14;
    const labels = [];
    const countsByDay = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      labels.push(key);
      countsByDay[key] = { total: 0, selesai: 0 };
    }

    tasks.forEach(t => {
      const key = new Date(t.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      if (countsByDay[key] !== undefined) {
        countsByDay[key].total++;
        if (t.status === 'Selesai') countsByDay[key].selesai++;
      }
    });

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Task Masuk',
            data: labels.map(l => countsByDay[l].total),
            borderColor: 'rgb(59,130,246)',
            backgroundColor: 'rgba(59,130,246,0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: 'rgb(59,130,246)',
            pointRadius: 4,
          },
          {
            label: 'Task Selesai',
            data: labels.map(l => countsByDay[l].selesai),
            borderColor: 'rgb(34,197,94)',
            backgroundColor: 'rgba(34,197,94,0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: 'rgb(34,197,94)',
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Tren Task 14 Hari Terakhir', font: { size: 14, weight: 'bold' }, color: '#374151' },
          legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } },
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.05)' } },
          x: { grid: { display: false }, ticks: { maxRotation: 45 } },
        },
      },
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [tasks]);

  return <canvas ref={canvasRef} />;
}

// ── Main Dashboard ──────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [actionModal, setActionModal] = useState({ isOpen: false, task: null });
  const [employees, setEmployees] = useState([]);

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: [QUERY_KEYS.STATS],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_task_stats');
      if (error) throw error;
      return data[0] || { total: 0, pending: 0, selesai: 0, cancel: 0 };
    },
    enabled: !!user,
  });

  // Fetch reminders
  const { data: reminders = [] } = useQuery({
    queryKey: [QUERY_KEYS.REMINDERS],
    queryFn: async () => {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      const { data, error } = await supabase
        .from('tasks')
        .select('*, users:user_id(username)')
        .eq('status', 'Pending')
        .lt('created_at', oneDayAgo.toISOString())
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(t => {
        const diffDays = Math.floor((Date.now() - new Date(t.created_at).getTime()) / 86400000);
        return { ...t, diffDays, severity: diffDays > 2 ? 'urgent' : 'warning' };
      });
    },
    enabled: !!user,
  });

  // Fetch all tasks
  const { data: allTasks = [], isLoading } = useQuery({
    queryKey: [QUERY_KEYS.TASKS, 'dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, users:user_id(username), employees:employee_id(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch employee stats
  const { data: employeeStats = [] } = useQuery({
    queryKey: [QUERY_KEYS.EMPLOYEE_STATS],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('employee_id, employees:employee_id(name)')
        .eq('status', 'Selesai')
        .not('employee_id', 'is', null);
      if (error) throw error;
      const acc = {};
      data.forEach(t => {
        if (t.employee_id && t.employees) {
          if (!acc[t.employee_id]) acc[t.employee_id] = { employee_name: t.employees.name, count: 0 };
          acc[t.employee_id].count++;
        }
      });
      return Object.values(acc).sort((a, b) => b.count - a.count);
    },
    enabled: !!user && user.role === 'admin',
  });

  // Fetch catatan (all) for dashboard section
  const { data: catatanList = [] } = useQuery({
    queryKey: [QUERY_KEYS.CATATAN, 'dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_catatan')
        .select('*, users:user_id(username), catatan_kategori:kategori_id(id, nama)')
        .order('waktu', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch catatan barang masuk (for barang kosong section — by kategori nama "Barang Masuk")
  const { data: catatanBarang = [] } = useQuery({
    queryKey: ['catatan_barang_dashboard'],
    queryFn: async () => {
      // Get kategori id for "Barang Masuk"
      const { data: kat } = await supabase
        .from('catatan_kategori')
        .select('id')
        .ilike('nama', 'barang masuk')
        .single();
      if (!kat) return [];
      const { data, error } = await supabase
        .from('data_catatan')
        .select('*, users:user_id(username), catatan_kategori:kategori_id(nama)')
        .eq('kategori_id', kat.id)
        .order('waktu', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Update task mutation (for action modal)
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
      queryClient.invalidateQueries([QUERY_KEYS.CATATAN]);
      queryClient.invalidateQueries(['catatan_barang_dashboard']);
      setActionModal({ isOpen: false, task: null });
    },
  });

  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase.from('employees').select('id, name').order('name');
      if (data) setEmployees(data);
    };
    if (user) fetchEmployees();
  }, [user]);

  const pendingTasks = allTasks.filter(t => t.status === 'Pending');
  const completedTasks = allTasks.filter(t => t.status === 'Selesai' || t.status === 'Cancel');
  const hasUrgent = reminders.some(r => r.severity === 'urgent');

  const handleUpdateStatus = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    updateMutation.mutate({
      id: actionModal.task.id,
      status: fd.get('status'),
      comment: fd.get('comment'),
      employee_id: fd.get('employee_id') || null,
    });
  };

  const getKategoriBadge = (nama) => {
    if (!nama) return 'bg-gray-100 text-gray-600';
    const map = { 'barang masuk': 'bg-orange-100 text-orange-700', 'umum': 'bg-blue-100 text-blue-700' };
    return map[nama.toLowerCase()] || 'bg-teal-100 text-teal-700';
  };

  return (
    <div className="min-h-screen">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

        <div className="flex items-center gap-3 mb-6">
          <LayoutDashboard className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
        </div>

        {/* Urgent banner */}
        {hasUrgent && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg mb-6 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <span className="font-semibold text-red-800">
              PERINGATAN: Ada Task yang MELEWATI BATAS 2 HARI! Segera diselesaikan!
            </span>
          </motion.div>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Task', value: stats?.total ?? allTasks.length, color: 'blue', icon: CheckSquare },
            { label: 'Pending', value: stats?.pending ?? pendingTasks.length, color: 'yellow', icon: Clock },
            { label: 'Selesai', value: stats?.selesai ?? completedTasks.filter(t=>t.status==='Selesai').length, color: 'green', icon: CheckCircle },
            { label: 'Cancel', value: stats?.cancel ?? completedTasks.filter(t=>t.status==='Cancel').length, color: 'red', icon: XCircle },
          ].map(({ label, value, color, icon: Icon }) => (
            <motion.div key={label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-md p-5 flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-${color}-100`}>
                <Icon className={`w-6 h-6 text-${color}-600`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value ?? '–'}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        {allTasks.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-md p-6" style={{ height: 280 }}>
              <BarChartWidget tasks={allTasks} />
            </div>
            <div className="bg-white rounded-2xl shadow-md p-6" style={{ height: 280 }}>
              <LineChartWidget tasks={allTasks} />
            </div>
          </div>
        )}

        {/* Reminders */}
        {reminders.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" /> Need Attention (&gt; 1 Hari)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reminders.map((task, index) => (
                <motion.div key={task.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className={`bg-white rounded-2xl shadow-md p-5 overflow-hidden ${
                    task.severity === 'urgent' ? 'border-2 border-red-500' : 'border border-yellow-300'
                  }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-gray-900 line-clamp-1">{task.judul_task}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${task.severity === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {task.diffDays}h
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-3 line-clamp-2">{task.deskripsi}</p>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-400">{new Date(task.created_at).toLocaleDateString('id-ID')}</span>
                    <button onClick={() => navigate('/tasks')} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100">
                      Update Task
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* All Pending Tasks */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-blue-500" /> All Tasks (Pending)
            <span className="text-sm font-normal text-gray-400 ml-1">({pendingTasks.length})</span>
          </h3>
          {pendingTasks.length === 0 ? (
            <div className="bg-white rounded-2xl shadow p-8 text-center">
              <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Tidak ada task pending.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingTasks.map((task, index) => (
                <motion.div key={task.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
                  <TaskCard task={task} onAction={(t) => setActionModal({ isOpen: true, task: t })} />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Task Selesai / Cancel */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" /> Task Selesai / Cancel
            <span className="text-sm font-normal text-gray-400 ml-1">({completedTasks.length})</span>
          </h3>
          {completedTasks.length === 0 ? (
            <div className="bg-white rounded-2xl shadow p-8 text-center">
              <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Belum ada task selesai atau cancel.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {completedTasks.slice(0, 9).map((task, index) => (
                <motion.div key={task.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
                  <TaskCard task={task} showAction={false} />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Employee Ranking */}
        {user?.role === 'admin' && employeeStats.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" /> Ranking Karyawan
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {employeeStats.map((emp, index) => (
                <motion.div key={index} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-2xl shadow-md p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{emp.employee_name}</h4>
                      <p className="text-xs text-gray-500">Karyawan</p>
                    </div>
                  </div>
                  <div className="text-center py-3 bg-gray-50 rounded-lg">
                    <p className="text-3xl font-bold text-gray-900">{emp.count}</p>
                    <p className="text-sm text-gray-500">Task Selesai</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Catatan Terbaru (semua kategori) */}
        {catatanList.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" /> Catatan Terbaru
              </h3>
              <button onClick={() => navigate('/catatan')} className="text-sm text-blue-600 hover:underline">
                Lihat Semua →
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catatanList.map((c, index) => {
                const kategoriNama = c.catatan_kategori?.nama;
                return (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="bg-white rounded-xl shadow p-4 border-l-4 border-l-blue-400">
                    {c.gambar_url && (
                      <img src={c.gambar_url} alt="" className="w-full h-28 object-cover rounded-lg mb-3" />
                    )}
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-gray-900 text-sm line-clamp-1">{c.nama_customer}</p>
                      {kategoriNama && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ml-2 shrink-0 ${getKategoriBadge(kategoriNama)}`}>
                          {kategoriNama}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-2">{c.info_percakapan}</p>
                    <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
                      <span>{c.users?.username}</span>
                      <span>{new Date(c.waktu).toLocaleDateString('id-ID')}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Catatan Barang Masuk (tampil di dashboard) */}
        {catatanBarang.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-orange-500" /> Catatan Barang Masuk Terbaru
              </h3>
              <button onClick={() => navigate('/barang-kosong')} className="text-sm text-orange-600 hover:underline">
                Lihat Halaman Barang →
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catatanBarang.map((c, index) => (
                <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="bg-white rounded-xl shadow p-4 border-l-4 border-l-orange-400">
                  {c.gambar_url && (
                    <img src={c.gambar_url} alt="" className="w-full h-28 object-cover rounded-lg mb-3" />
                  )}
                  <p className="font-semibold text-gray-900 text-sm mb-1">{c.nama_customer}</p>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-2">{c.info_percakapan}</p>
                  <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
                    <span>{c.users?.username}</span>
                    <span>{new Date(c.waktu).toLocaleDateString('id-ID')}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

      </motion.div>

      {/* Action Modal */}
      <Modal isOpen={actionModal.isOpen} onClose={() => setActionModal({ isOpen: false, task: null })} title="Update Status Task" size="md">
        <form onSubmit={handleUpdateStatus} className="space-y-4">
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
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Keterangan</label>
            <textarea name="comment" defaultValue={actionModal.task?.comment || ''} rows="3" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50" required />
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <button type="button" onClick={() => setActionModal({ isOpen: false, task: null })} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">Batal</button>
            <button type="submit" disabled={updateMutation.isLoading} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium disabled:opacity-50">
              {updateMutation.isLoading ? 'Menyimpan...' : 'Update Status'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
