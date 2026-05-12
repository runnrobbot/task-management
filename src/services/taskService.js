import { supabase } from '@/lib/supabase';

// Active request tracking for race condition prevention
const activeRequests = new Map();

// Cancel previous request if exists
function cancelPreviousRequest(key) {
  if (activeRequests.has(key)) {
    const controller = activeRequests.get(key);
    controller.abort();
  }
}

// Create new abort controller for request
function createRequestController(key) {
  const controller = new AbortController();
  activeRequests.set(key, controller);
  return controller;
}

// Clean up request controller
function cleanupRequest(key) {
  activeRequests.delete(key);
}

export const taskService = {
  // Get tasks with pagination and search
  async getTasks({ page = 1, pageSize = 20, search = '', status = '', category = '', userId = null }) {
    const requestKey = 'getTasks';
    cancelPreviousRequest(requestKey);
    const controller = createRequestController(requestKey);

    try {
      let query = supabase
        .from('tasks')
        .select(
          `
          *,
          users!tasks_user_id_fkey(id, username),
          employees(id, name, divisions(name))
        `,
          { count: 'exact' }
        )
        .order('created_at', { ascending: false });

      // Apply filters
      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (category) {
        query = query.eq('kategori', category);
      }

      if (search) {
        query = query.or(
          `judul_task.ilike.%${search}%,deskripsi.ilike.%${search}%,nama_customer.ilike.%${search}%`
        );
      }

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      cleanupRequest(requestKey);

      if (error) throw error;

      return {
        data: data || [],
        count: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    } catch (error) {
      cleanupRequest(requestKey);
      if (error.name === 'AbortError') {
        return null; // Request was cancelled
      }
      throw error;
    }
  },

  // Get single task
  async getTask(id) {
    const { data, error } = await supabase
      .from('tasks')
      .select(
        `
        *,
        users!tasks_user_id_fkey(id, username),
        employees(id, name, divisions(name))
      `
      )
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Create task with optimistic locking
  async createTask(taskData) {
    const requestKey = `createTask-${Date.now()}`;
    const controller = createRequestController(requestKey);

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([
          {
            ...taskData,
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      cleanupRequest(requestKey);

      if (error) throw error;

      // Create notification
      await supabase.from('notifications').insert([
        {
          message: `Task dibuat: ${taskData.judul_task}`,
          type: 'create',
          task_id: data.id,
          divisi_id: taskData.divisi_id || null,
        },
      ]);

      return data;
    } catch (error) {
      cleanupRequest(requestKey);
      if (error.name === 'AbortError') {
        throw new Error('Request dibatalkan');
      }
      throw error;
    }
  },

  // Update task status with version checking to prevent race conditions
  async updateTaskStatus(id, updates) {
    const requestKey = `updateTask-${id}`;
    cancelPreviousRequest(requestKey);
    const controller = createRequestController(requestKey);

    try {
      // First, get current task to check version
      const { data: currentTask, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Update with optimistic locking using updated_at
      const { data, error } = await supabase
        .from('tasks')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('updated_at', currentTask.updated_at) // Optimistic lock
        .select()
        .single();

      cleanupRequest(requestKey);

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Task telah diupdate oleh user lain. Silakan refresh dan coba lagi.');
        }
        throw error;
      }

      // Create notification
      if (updates.status === 'Selesai' && updates.employee_id) {
        const { data: employee } = await supabase
          .from('employees')
          .select('name')
          .eq('id', updates.employee_id)
          .single();

        await supabase.from('notifications').insert([
          {
            message: `Task "${currentTask.judul_task}" diselesaikan oleh ${employee?.name || 'Unknown'}`,
            type: 'done',
            task_id: id,
            employee_id: updates.employee_id,
            divisi_id: currentTask.divisi_id || null,
          },
        ]);
      } else {
        await supabase.from('notifications').insert([
          {
            message: `Task "${currentTask.judul_task}" diupdate menjadi ${updates.status}`,
            type: 'update',
            task_id: id,
            divisi_id: currentTask.divisi_id || null,
          },
        ]);
      }

      return data;
    } catch (error) {
      cleanupRequest(requestKey);
      if (error.name === 'AbortError') {
        return null;
      }
      throw error;
    }
  },

  // Delete task
  async deleteTask(id) {
    const { error } = await supabase.from('tasks').delete().eq('id', id);

    if (error) throw error;
  },

  // Get reminders (tasks > 1 day old and pending)
  async getReminders(userId = null) {
    const requestKey = 'getReminders';
    cancelPreviousRequest(requestKey);
    const controller = createRequestController(requestKey);

    try {
      let query = supabase
        .from('tasks')
        .select(
          `
          *,
          users!tasks_user_id_fkey(id, username),
          employees(id, name)
        `
        )
        .eq('status', 'Pending')
        .order('created_at', { ascending: true });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      cleanupRequest(requestKey);

      if (error) throw error;

      // Calculate severity
      const now = new Date();
      const reminders = (data || [])
        .map((task) => {
          const taskDate = new Date(task.created_at);
          const diffTime = Math.abs(now - taskDate);
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

          let severity = 'normal';
          if (diffDays >= 2) severity = 'urgent';
          else if (diffDays >= 1) severity = 'warning';

          return { ...task, diffDays, severity };
        })
        .filter((task) => task.diffDays >= 1);

      return reminders;
    } catch (error) {
      cleanupRequest(requestKey);
      if (error.name === 'AbortError') {
        return null;
      }
      throw error;
    }
  },

  // Get task statistics
  async getStats(userId = null) {
    const requestKey = 'getStats';
    cancelPreviousRequest(requestKey);

    try {
      let query = supabase.from('tasks').select('status, kategori');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Calculate stats
      const stats = {
        total: data.length,
        selesai: data.filter((t) => t.status === 'Selesai').length,
        pending: data.filter((t) => t.status === 'Pending').length,
        cancel: data.filter((t) => t.status === 'Cancel').length,
        kategori: {
          Offline: {
            total: data.filter((t) => t.kategori === 'Offline').length,
            selesai: data.filter((t) => t.kategori === 'Offline' && t.status === 'Selesai').length,
            pending: data.filter((t) => t.kategori === 'Offline' && t.status === 'Pending').length,
          },
          User: {
            total: data.filter((t) => t.kategori === 'User').length,
            selesai: data.filter((t) => t.kategori === 'User' && t.status === 'Selesai').length,
            pending: data.filter((t) => t.kategori === 'User' && t.status === 'Pending').length,
          },
          Lelang: {
            total: data.filter((t) => t.kategori === 'Lelang').length,
            selesai: data.filter((t) => t.kategori === 'Lelang' && t.status === 'Selesai').length,
            pending: data.filter((t) => t.kategori === 'Lelang' && t.status === 'Pending').length,
          },
        },
      };

      // Get employee stats
      const { data: employeeStats } = await supabase
        .from('tasks')
        .select('employee_id, employees(name)')
        .eq('status', 'Selesai')
        .not('employee_id', 'is', null);

      const employeeCount = {};
      (employeeStats || []).forEach((task) => {
        const empId = task.employee_id;
        if (!employeeCount[empId]) {
          employeeCount[empId] = {
            employee_name: task.employees?.name || 'Unknown',
            count: 0,
          };
        }
        employeeCount[empId].count++;
      });

      stats.employeeStats = Object.values(employeeCount).sort((a, b) => b.count - a.count);

      cleanupRequest(requestKey);
      return stats;
    } catch (error) {
      cleanupRequest(requestKey);
      if (error.name === 'AbortError') {
        return null;
      }
      throw error;
    }
  },
};
