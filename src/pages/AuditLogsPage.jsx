import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ShieldCheck, Search, Filter, RefreshCw, User, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { ACTION_LABELS, ACTION_COLORS } from '@/services/auditLogService';
import Pagination from '@/components/common/Pagination';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

export default function AuditLogsPage() {
  const { user } = useAuthStore();
  const [search, setSearch]         = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage]             = useState(1);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['audit_logs', page, search, actionFilter],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (search) query = query.ilike('username', `%${search}%`);
      if (actionFilter) query = query.eq('action', actionFilter);

      const { data, error, count } = await query;
      if (error) throw error;
      return { logs: data || [], total: count || 0 };
    },
    enabled: !!user && user.role === 'admin',
    keepPreviousData: true,
  });

  const logs       = data?.logs  || [];
  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE);

  const actionOptions = Object.keys(ACTION_LABELS);

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Audit Logs</h1>
              <p className="text-sm text-slate-500 mt-0.5">Rekam jejak semua aktivitas pengguna</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl shadow flex items-center gap-4">
            <div className="p-3 bg-primary-100 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Log</p>
              <p className="text-2xl font-bold text-slate-900">{data?.total ?? '—'}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <User className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Login Hari Ini</p>
              <p className="text-2xl font-bold text-slate-900">
                {logs.filter(l => l.action === 'LOGIN' &&
                  new Date(l.created_at).toDateString() === new Date().toDateString()
                ).length}
              </p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Log Halaman Ini</p>
              <p className="text-2xl font-bold text-slate-900">{logs.length}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari username..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Semua Aksi</option>
                {actionOptions.map((a) => (
                  <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
            <p className="mt-4 text-slate-600">Memuat log...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow">
            <ShieldCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">Belum ada log aktivitas.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Waktu</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Entitas</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map((log, index) => (
                      <motion.tr
                        key={log.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.02 }}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-6 py-3 text-sm text-slate-500 whitespace-nowrap">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                              <span className="text-primary-700 font-bold text-xs">
                                {log.username?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-slate-900">{log.username}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-700'}`}>
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm text-slate-500">
                          {log.entity
                            ? <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{log.entity}{log.entity_id ? ` #${log.entity_id}` : ''}</span>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                        <td className="px-6 py-3 text-sm text-slate-600 max-w-xs truncate">
                          {log.detail || <span className="text-slate-300">—</span>}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="mt-4">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
