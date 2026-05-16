import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellOff, Check, CheckCheck, Trash2, RefreshCw, Package, ClipboardList, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useScope } from '@/lib/useScope';
import ConfirmDialog from '@/components/common/ConfirmDialog';

const TYPE_CONFIG = {
  barang_status: { icon: <Package className="w-4 h-4" />, color: 'text-orange-500', bg: 'bg-orange-50' },
  create:        { icon: <ClipboardList className="w-4 h-4" />, color: 'text-green-500', bg: 'bg-green-50' },
  update:        { icon: <RefreshCw className="w-4 h-4" />, color: 'text-primary-500', bg: 'bg-primary-50' },
  delete:        { icon: <Trash2 className="w-4 h-4" />, color: 'text-red-500', bg: 'bg-red-50' },
  task:          { icon: <ClipboardList className="w-4 h-4" />, color: 'text-primary-500', bg: 'bg-primary-50' },
  default:       { icon: <Info className="w-4 h-4" />, color: 'text-slate-500', bg: 'bg-slate-50' },
};

function getTypeConfig(type) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.default;
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)} detik yang lalu`;
  if (diff < 3600)  return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function NotificationsPage() {
  const { user } = useAuthStore();
  const { isAdmin, userId } = useScope();
  const queryClient = useQueryClient();
  const [filterRead, setFilterRead]           = useState('all'); // all | unread | read
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [deletingId, setDeletingId]           = useState(null); // per-item delete confirm

  // ── Query notifikasi ─────────────────────────────────────────
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['notifications', filterRead, isAdmin, userId],
    queryFn: async () => {
      let q = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // User biasa: hanya notif miliknya. Admin: semua.
      if (!isAdmin) q = q.eq('user_id', userId);

      if (filterRead === 'unread') q = q.eq('is_read', false);
      if (filterRead === 'read')   q = q.eq('is_read', true);

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 15000, // auto-refresh tiap 15 detik
  });

  // ── Realtime subscription ─────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // ── Mutations ─────────────────────────────────────────────────
  const markReadMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      let q = supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
      // User biasa: cuma mark-read milikinya sendiri
      if (!isAdmin) q = q.eq('user_id', userId);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const deleteNotifMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setDeletingId(null);
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      // If filter is 'read', delete only read ones; otherwise delete all visible.
      // RLS sudah membatasi DELETE ke milik user (kecuali admin),
      // tapi kita filter eksplisit juga untuk konsistensi UX.
      if (filterRead === 'read') {
        let q = supabase.from('notifications').delete().eq('is_read', true);
        if (!isAdmin) q = q.eq('user_id', userId);
        const { error } = await q;
        if (error) throw error;
      } else {
        const ids = notifications.map(n => n.id);
        if (ids.length) {
          const { error } = await supabase.from('notifications').delete().in('id', ids);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notifications'] }); setConfirmClearAll(false); },
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className="w-8 h-8 text-primary-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Notifikasi</h1>
              <p className="text-sm text-slate-500">
                {unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua sudah dibaca'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isLoading}
                className="flex items-center gap-2 px-3 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors text-sm font-medium disabled:opacity-50"
              >
                <CheckCheck className="w-4 h-4" />
                Tandai Semua Dibaca
              </button>
            )}
          </div>
        </div>

        {/* ── Filter tabs ── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {[
              { value: 'all',    label: 'Semua' },
              { value: 'unread', label: 'Belum Dibaca' },
              { value: 'read',   label: 'Sudah Dibaca' },
            ].map(tab => (
              <button
                key={tab.value}
                onClick={() => setFilterRead(tab.value)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filterRead === tab.value
                    ? 'bg-white text-primary-700 shadow'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {notifications.length > 0 && (
            <button
              onClick={() => setConfirmClearAll(true)}
              className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {filterRead === 'read' ? 'Hapus Yang Dibaca' : 'Hapus Semua'}
            </button>
          )}
        </div>

        {/* ── List ── */}
        {isLoading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-slate-500">Memuat notifikasi...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow">
            <BellOff className="w-14 h-14 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">
              {filterRead === 'unread' ? 'Tidak ada notifikasi yang belum dibaca' : 'Tidak ada notifikasi'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {notifications.map((notif, i) => {
                const cfg = getTypeConfig(notif.type);
                return (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: i * 0.03 }}
                    className={`flex items-start gap-4 p-4 rounded-xl shadow-sm border transition-all ${
                      notif.is_read
                        ? 'bg-white border-slate-100'
                        : 'bg-primary-50 border-primary-100'
                    }`}
                  >
                    {/* Icon type */}
                    <div className={`p-2 rounded-lg ${cfg.bg} ${cfg.color} shrink-0 mt-0.5`}>
                      {cfg.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${notif.is_read ? 'text-slate-700' : 'text-slate-900 font-medium'}`}>
                        {notif.message}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{timeAgo(notif.created_at)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!notif.is_read && (
                        <button
                          onClick={() => markReadMutation.mutate(notif.id)}
                          disabled={markReadMutation.isLoading}
                          title="Tandai sudah dibaca"
                          className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setDeletingId(notif.id)}
                        disabled={deleteNotifMutation.isLoading}
                        title="Hapus notifikasi"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

      </motion.div>

      {/* Per-item delete confirm */}
      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={() => deleteNotifMutation.mutate(deletingId)}
        title="Hapus Notifikasi"
        message="Yakin ingin menghapus notifikasi ini?"
        confirmText="Hapus"
        type="danger"
      />

      {/* Clear all confirm */}
      <ConfirmDialog
        isOpen={confirmClearAll}
        onClose={() => setConfirmClearAll(false)}
        onConfirm={() => clearAllMutation.mutate()}
        title={filterRead === 'read' ? 'Hapus Notifikasi yang Dibaca' : 'Hapus Semua Notifikasi'}
        message={filterRead === 'read'
          ? 'Yakin ingin menghapus semua notifikasi yang sudah dibaca?'
          : 'Yakin ingin menghapus SEMUA notifikasi yang tampil saat ini?'}
        confirmText="Hapus"
        type="danger"
      />
    </div>
  );
}
