import { supabase } from '@/lib/supabase';

// Active request tracking for race condition prevention
const activeRequests = new Map();

function cancelPreviousRequest(key) {
  if (activeRequests.has(key)) activeRequests.get(key).abort();
}
function createRequestController(key) {
  const controller = new AbortController();
  activeRequests.set(key, controller);
  return controller;
}
function cleanupRequest(key) {
  activeRequests.delete(key);
}

export const taskService = {
  async getTasks({ page = 1, pageSize = 20, search = '', status = '', category = '', userId = null }) {
    const requestKey = 'getTasks';
    cancelPreviousRequest(requestKey);
    createRequestController(requestKey);
    try {
      let query = supabase
        .from('tasks')
        .select('*, users:user_id(id, username)', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (userId) query = query.eq('user_id', userId);
      if (status) query = query.eq('status', status);
      if (category) query = query.eq('kategori', category);
      if (search) query = query.or(`judul_task.ilike.%${search}%,deskripsi.ilike.%${search}%,nama_customer.ilike.%${search}%`);

      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error, count } = await query;
      cleanupRequest(requestKey);
      if (error) throw error;
      return { data: data || [], count: count || 0, page, pageSize, totalPages: Math.ceil((count || 0) / pageSize) };
    } catch (error) {
      cleanupRequest(requestKey);
      if (error.name === 'AbortError') return null;
      throw error;
    }
  },

  async getTask(id) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, users:user_id(id, username)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async createTask(taskData) {
    const requestKey = `createTask-${Date.now()}`;
    createRequestController(requestKey);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ ...taskData, created_at: new Date().toISOString() }])
        .select()
        .single();
      cleanupRequest(requestKey);
      if (error) throw error;
      await supabase.from('notifications').insert([{
        message: `Task dibuat: ${taskData.judul_task}`,
        type: 'create',
        task_id: data.id,
        divisi_id: taskData.divisi_id || null,
      }]);
      return data;
    } catch (error) {
      cleanupRequest(requestKey);
      if (error.name === 'AbortError') throw new Error('Request dibatalkan');
      throw error;
    }
  },

  async updateTaskStatus(id, updates) {
    const requestKey = `updateTask-${id}`;
    cancelPreviousRequest(requestKey);
    createRequestController(requestKey);
    try {
      const { data: currentTask, error: fetchError } = await supabase.from('tasks').select('*').eq('id', id).single();
      if (fetchError) throw fetchError;

      // Hapus employee_id dari updates karena tabel employees sudah tidak ada
      const { employee_id, ...safeUpdates } = updates;

      const { data, error } = await supabase
        .from('tasks')
        .update({ ...safeUpdates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('updated_at', currentTask.updated_at)
        .select()
        .single();

      cleanupRequest(requestKey);
      if (error) {
        if (error.code === 'PGRST116') throw new Error('Task telah diupdate oleh user lain. Silakan refresh dan coba lagi.');
        throw error;
      }

      await supabase.from('notifications').insert([{
        message: `Task "${currentTask.judul_task}" diupdate menjadi ${updates.status}`,
        type: 'update',
        task_id: id,
        divisi_id: currentTask.divisi_id || null,
      }]);

      return data;
    } catch (error) {
      cleanupRequest(requestKey);
      if (error.name === 'AbortError') return null;
      throw error;
    }
  },

  async deleteTask(id) {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
  },

  async getReminders(userId = null) {
    const requestKey = 'getReminders';
    cancelPreviousRequest(requestKey);
    createRequestController(requestKey);
    try {
      let query = supabase
        .from('tasks')
        .select('*, users:user_id(id, username)')
        .eq('status', 'Pending')
        .order('created_at', { ascending: true });

      if (userId) query = query.eq('user_id', userId);

      const { data, error } = await query;
      cleanupRequest(requestKey);
      if (error) throw error;

      const now = new Date();
      return (data || [])
        .map((task) => {
          const diffTime = Math.abs(now - new Date(task.created_at));
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          let severity = 'normal';
          if (diffDays >= 2) severity = 'urgent';
          else if (diffDays >= 1) severity = 'warning';
          return { ...task, diffDays, severity };
        })
        .filter((task) => task.diffDays >= 1);
    } catch (error) {
      cleanupRequest(requestKey);
      if (error.name === 'AbortError') return null;
      throw error;
    }
  },

  async getStats(userId = null) {
    const requestKey = 'getStats';
    cancelPreviousRequest(requestKey);
    try {
      let query = supabase.from('tasks').select('status, kategori');
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (error) throw error;

      const stats = {
        total: data.length,
        selesai: data.filter((t) => t.status === 'Selesai').length,
        pending: data.filter((t) => t.status === 'Pending').length,
        cancel: data.filter((t) => t.status === 'Cancel').length,
        kategori: {
          Offline: { total: data.filter((t) => t.kategori === 'Offline').length, selesai: data.filter((t) => t.kategori === 'Offline' && t.status === 'Selesai').length, pending: data.filter((t) => t.kategori === 'Offline' && t.status === 'Pending').length },
          User:    { total: data.filter((t) => t.kategori === 'User').length,    selesai: data.filter((t) => t.kategori === 'User'    && t.status === 'Selesai').length, pending: data.filter((t) => t.kategori === 'User'    && t.status === 'Pending').length },
          Lelang:  { total: data.filter((t) => t.kategori === 'Lelang').length,  selesai: data.filter((t) => t.kategori === 'Lelang'  && t.status === 'Selesai').length, pending: data.filter((t) => t.kategori === 'Lelang'  && t.status === 'Pending').length },
        },
        employeeStats: [],
      };

      cleanupRequest(requestKey);
      return stats;
    } catch (error) {
      cleanupRequest(requestKey);
      if (error.name === 'AbortError') return null;
      throw error;
    }
  },
};
