import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart2, CheckCircle, XCircle, Clock, Package,
  Users, TrendingUp, Calendar, Download, Filter
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export default function ReportsPage() {
  const { user } = useAuthStore();
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [activeTab, setActiveTab] = useState('tasks');

  // Fetch tasks
  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['report_tasks', dateRange],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('*, users:user_id(username), employees:employee_id(name)')
        .order('created_at', { ascending: false });

      if (dateRange.from) query = query.gte('created_at', dateRange.from);
      if (dateRange.to) query = query.lte('created_at', dateRange.to + 'T23:59:59');

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch barang kosong
  const { data: barangList = [], isLoading: loadingBarang } = useQuery({
    queryKey: ['report_barang', dateRange],
    queryFn: async () => {
      let query = supabase
        .from('barang_kosong')
        .select('*')
        .order('created_at', { ascending: false });

      if (dateRange.from) query = query.gte('created_at', dateRange.from);
      if (dateRange.to) query = query.lte('created_at', dateRange.to + 'T23:59:59');

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch users count
  const { data: usersData = [] } = useQuery({
    queryKey: ['report_users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('id, username, role, divisions(name)');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && user.role === 'admin',
  });

  // Task stats
  const taskStats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'Pending').length,
    selesai: tasks.filter((t) => t.status === 'Selesai').length,
    cancel: tasks.filter((t) => t.status === 'Cancel').length,
  };

  // Barang stats
  const barangStats = {
    total: barangList.length,
    kosong: barangList.filter((b) => b.status === 'Kosong').length,
    proses: barangList.filter((b) => b.status === 'Proses Pengadaan').length,
    tersedia: barangList.filter((b) => b.status === 'Tersedia').length,
  };

  // Group tasks by kategori
  const taskByKategori = tasks.reduce((acc, t) => {
    acc[t.kategori] = (acc[t.kategori] || 0) + 1;
    return acc;
  }, {});

  // Group tasks by user
  const taskByUser = tasks.reduce((acc, t) => {
    const name = t.users?.username || 'Unknown';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  const exportCSV = () => {
    const rows =
      activeTab === 'tasks'
        ? [
            ['ID', 'Judul', 'Status', 'Kategori', 'Customer', 'No Telp', 'Cabang', 'User', 'Karyawan', 'Tanggal'],
            ...tasks.map((t) => [
              t.id,
              t.judul_task,
              t.status,
              t.kategori,
              t.nama_customer || '',
              t.no_telp || '',
              t.cabang || '',
              t.users?.username || '',
              t.employees?.name || '',
              new Date(t.created_at).toLocaleDateString('id-ID'),
            ]),
          ]
        : [
            ['ID', 'Nama Barang', 'Kategori', 'Lokasi', 'Jumlah Kosong', 'Status', 'Tanggal Input'],
            ...barangList.map((b) => [
              b.id,
              b.nama_barang,
              b.kategori,
              b.lokasi,
              b.jumlah_kosong,
              b.status,
              new Date(b.tanggal_input).toLocaleDateString('id-ID'),
            ]),
          ];

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = loadingTasks || loadingBarang;

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BarChart2 className="w-8 h-8 text-emerald-600" />
            <h1 className="text-3xl font-bold text-gray-900">Laporan</h1>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-5 h-5" />
            Export CSV
          </button>
        </div>

        {/* Date Filter */}
        <div className="bg-white p-4 rounded-xl shadow mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-600">Filter Tanggal</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Dari Tanggal</label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sampai Tanggal</label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>
          {(dateRange.from || dateRange.to) && (
            <button
              onClick={() => setDateRange({ from: '', to: '' })}
              className="mt-3 text-sm text-red-500 hover:text-red-700 underline"
            >
              Reset Filter
            </button>
          )}
        </div>

        {/* Summary Cards */}
        {user?.role === 'admin' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl shadow">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg"><TrendingUp className="w-5 h-5 text-blue-600" /></div>
                <span className="text-sm text-gray-500">Total Task</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{taskStats.total}</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="w-5 h-5 text-green-600" /></div>
                <span className="text-sm text-gray-500">Selesai</span>
              </div>
              <p className="text-3xl font-bold text-green-600">{taskStats.selesai}</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-yellow-100 rounded-lg"><Clock className="w-5 h-5 text-yellow-600" /></div>
                <span className="text-sm text-gray-500">Pending</span>
              </div>
              <p className="text-3xl font-bold text-yellow-600">{taskStats.pending}</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-100 rounded-lg"><XCircle className="w-5 h-5 text-red-600" /></div>
                <span className="text-sm text-gray-500">Cancel</span>
              </div>
              <p className="text-3xl font-bold text-red-600">{taskStats.cancel}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['tasks', 'barang', ...(user?.role === 'admin' ? ['users'] : [])].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition-colors ${
                activeTab === tab
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 shadow'
              }`}
            >
              {tab === 'tasks' ? 'Task' : tab === 'barang' ? 'Barang Kosong' : 'User'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Memuat laporan...</p>
          </div>
        ) : (
          <>
            {/* Tasks Tab */}
            {activeTab === 'tasks' && (
              <div className="space-y-6">
                {/* By Kategori */}
                {user?.role === 'admin' && (
                  <div className="bg-white rounded-2xl shadow p-6">
                    <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-emerald-600" />
                      Task per Kategori
                    </h2>
                    <div className="grid grid-cols-3 gap-4">
                      {Object.entries(taskByKategori).map(([k, v]) => (
                        <div key={k} className="bg-gray-50 rounded-xl p-4 text-center">
                          <p className="text-2xl font-bold text-gray-900">{v}</p>
                          <p className="text-sm text-gray-500 mt-1">{k}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* By User (admin only) */}
                {user?.role === 'admin' && Object.keys(taskByUser).length > 0 && (
                  <div className="bg-white rounded-2xl shadow p-6">
                    <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      Task per User
                    </h2>
                    <div className="space-y-3">
                      {Object.entries(taskByUser)
                        .sort((a, b) => b[1] - a[1])
                        .map(([name, count]) => (
                          <div key={name} className="flex items-center gap-3">
                            <div className="w-28 text-sm text-gray-700 font-medium truncate">{name}</div>
                            <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full transition-all"
                                style={{ width: `${(count / taskStats.total) * 100}%` }}
                              />
                            </div>
                            <div className="w-8 text-sm font-bold text-gray-700">{count}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Task Table */}
                <div className="bg-white rounded-2xl shadow overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="font-bold text-gray-800">Daftar Task ({tasks.length})</h2>
                  </div>
                  {tasks.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">Tidak ada data task.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-4 py-3 text-gray-600 font-semibold">Judul</th>
                            <th className="text-left px-4 py-3 text-gray-600 font-semibold">Status</th>
                            <th className="text-left px-4 py-3 text-gray-600 font-semibold">Kategori</th>
                            {user?.role === 'admin' && <th className="text-left px-4 py-3 text-gray-600 font-semibold">User</th>}
                            <th className="text-left px-4 py-3 text-gray-600 font-semibold">Tanggal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {tasks.map((t) => (
                            <tr key={t.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{t.judul_task}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  t.status === 'Selesai' ? 'bg-green-100 text-green-700' :
                                  t.status === 'Cancel' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {t.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-600">{t.kategori}</td>
                              {user?.role === 'admin' && <td className="px-4 py-3 text-gray-600">{t.users?.username || '-'}</td>}
                              <td className="px-4 py-3 text-gray-500">
                                {new Date(t.created_at).toLocaleDateString('id-ID')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Barang Tab */}
            {activeTab === 'barang' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl shadow text-center">
                    <p className="text-3xl font-bold text-gray-900">{barangStats.total}</p>
                    <p className="text-sm text-gray-500 mt-1">Total</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow text-center">
                    <p className="text-3xl font-bold text-red-600">{barangStats.kosong}</p>
                    <p className="text-sm text-gray-500 mt-1">Kosong</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow text-center">
                    <p className="text-3xl font-bold text-yellow-600">{barangStats.proses}</p>
                    <p className="text-sm text-gray-500 mt-1">Proses Pengadaan</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow text-center">
                    <p className="text-3xl font-bold text-green-600">{barangStats.tersedia}</p>
                    <p className="text-sm text-gray-500 mt-1">Tersedia</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2">
                      <Package className="w-5 h-5 text-emerald-600" />
                      Daftar Barang Kosong ({barangList.length})
                    </h2>
                  </div>
                  {barangList.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">Tidak ada data barang kosong.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-4 py-3 text-gray-600 font-semibold">Nama Barang</th>
                            <th className="text-left px-4 py-3 text-gray-600 font-semibold">Kategori</th>
                            <th className="text-left px-4 py-3 text-gray-600 font-semibold">Lokasi</th>
                            <th className="text-left px-4 py-3 text-gray-600 font-semibold">Jumlah</th>
                            <th className="text-left px-4 py-3 text-gray-600 font-semibold">Status</th>
                            <th className="text-left px-4 py-3 text-gray-600 font-semibold">Tanggal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {barangList.map((b) => (
                            <tr key={b.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{b.nama_barang}</td>
                              <td className="px-4 py-3 text-gray-600">{b.kategori}</td>
                              <td className="px-4 py-3 text-gray-600">{b.lokasi}</td>
                              <td className="px-4 py-3 text-gray-600">{b.jumlah_kosong}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  b.status === 'Tersedia' ? 'bg-green-100 text-green-700' :
                                  b.status === 'Proses Pengadaan' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {b.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-500">
                                {new Date(b.tanggal_input).toLocaleDateString('id-ID')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Users Tab (admin only) */}
            {activeTab === 'users' && user?.role === 'admin' && (
              <div className="bg-white rounded-2xl shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    Daftar User ({usersData.length})
                  </h2>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-600 font-semibold">Username</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-semibold">Role</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-semibold">Divisi</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-semibold">Task Dibuat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {usersData.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{u.username}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {u.role === 'admin' ? 'Administrator' : 'User Biasa'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{u.divisions?.name || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {taskByUser[u.username] || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
