import { supabase } from '@/lib/supabase';

// Active request tracking
const activeRequests = new Map();

function cancelPreviousRequest(key) {
  if (activeRequests.has(key)) {
    activeRequests.get(key).abort();
  }
}

function createRequestController(key) {
  const controller = new AbortController();
  activeRequests.set(key, controller);
  return controller;
}

function cleanupRequest(key) {
  activeRequests.delete(key);
}

export const barangKosongService = {
  // Get barang kosong with pagination and search
  async getBarangKosong({ page = 1, pageSize = 20, search = '', status = '', kategori = '' }) {
    const requestKey = 'getBarangKosong';
    cancelPreviousRequest(requestKey);
    createRequestController(requestKey);

    try {
      let query = supabase
        .from('barang_kosong')
        .select(
          `
          *,
          users!barang_kosong_penginput_id_fkey(id, username)
        `,
          { count: 'exact' }
        )
        .order('tanggal_input', { ascending: false });

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      if (kategori) {
        query = query.eq('kategori', kategori);
      }

      if (search) {
        query = query.or(`nama_barang.ilike.%${search}%,lokasi.ilike.%${search}%,catatan.ilike.%${search}%`);
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
      if (error.name === 'AbortError') return null;
      throw error;
    }
  },

  // Create barang kosong
  async createBarangKosong(data) {
    const requestKey = `createBarangKosong-${Date.now()}`;
    createRequestController(requestKey);

    try {
      const { data: result, error } = await supabase
        .from('barang_kosong')
        .insert([
          {
            ...data,
            tanggal_input: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      cleanupRequest(requestKey);

      if (error) throw error;

      // Create notification
      await supabase.from('notifications').insert([
        {
          message: `Barang kosong ditambahkan: ${data.nama_barang}`,
          type: 'create',
        },
      ]);

      return result;
    } catch (error) {
      cleanupRequest(requestKey);
      if (error.name === 'AbortError') {
        throw new Error('Request dibatalkan');
      }
      throw error;
    }
  },

  // Update barang kosong with optimistic locking
  async updateBarangKosong(id, updates) {
    const requestKey = `updateBarangKosong-${id}`;
    cancelPreviousRequest(requestKey);
    createRequestController(requestKey);

    try {
      // Get current data for optimistic locking
      const { data: current, error: fetchError } = await supabase
        .from('barang_kosong')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Update with version check
      const { data, error } = await supabase
        .from('barang_kosong')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('updated_at', current.updated_at)
        .select()
        .single();

      cleanupRequest(requestKey);

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Data telah diupdate oleh user lain. Silakan refresh dan coba lagi.');
        }
        throw error;
      }

      // Create notification
      await supabase.from('notifications').insert([
        {
          message: `Barang "${current.nama_barang}" diupdate`,
          type: 'update',
        },
      ]);

      return data;
    } catch (error) {
      cleanupRequest(requestKey);
      if (error.name === 'AbortError') return null;
      throw error;
    }
  },

  // Delete barang kosong
  async deleteBarangKosong(id) {
    const { error } = await supabase.from('barang_kosong').delete().eq('id', id);

    if (error) throw error;

    await supabase.from('notifications').insert([
      {
        message: `Barang kosong dihapus`,
        type: 'delete',
      },
    ]);
  },
};
