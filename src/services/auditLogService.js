/**
 * auditLogService.js
 * 
 * Helper untuk mencatat aktivitas user ke tabel audit_logs.
 * Dipanggil di berbagai tempat: login, logout, CRUD, dll.
 */

import { supabase } from '@/lib/supabase';

/**
 * Catat aktivitas ke audit_logs.
 * Tidak throw error agar tidak mengganggu flow utama.
 * 
 * @param {object} params
 * @param {string} params.userId    - auth user ID
 * @param {string} params.username  - nama user
 * @param {string} params.action    - aksi (LOGIN, LOGOUT, CREATE_TASK, dll)
 * @param {string} [params.entity]  - nama tabel/entitas terkait
 * @param {string} [params.entityId]- ID record terkait
 * @param {string} [params.detail]  - deskripsi tambahan
 */
export async function logActivity({ userId, username, action, entity, entityId, detail }) {
  try {
    await supabase.from('audit_logs').insert([{
      user_id:   userId,
      username,
      action,
      entity:    entity    || null,
      entity_id: entityId  ? String(entityId) : null,
      detail:    detail    || null,
    }]);
  } catch (err) {
    // Gagal log tidak boleh crash app
    console.warn('[AuditLog] Gagal mencatat log:', err.message);
  }
}

// ─── Konstanta aksi yang sudah standar ───────────────────────
export const AUDIT_ACTIONS = {
  LOGIN:            'LOGIN',
  LOGOUT:           'LOGOUT',
  CREATE_TASK:      'CREATE_TASK',
  UPDATE_TASK:      'UPDATE_TASK',
  DELETE_TASK:      'DELETE_TASK',
  CREATE_CATATAN:   'CREATE_CATATAN',
  UPDATE_CATATAN:   'UPDATE_CATATAN',
  DELETE_CATATAN:   'DELETE_CATATAN',
  CREATE_USER:      'CREATE_USER',
  DELETE_USER:      'DELETE_USER',
  RESET_PASSWORD:   'RESET_PASSWORD',
  CREATE_CUSTOMER:  'CREATE_CUSTOMER',
  UPDATE_CUSTOMER:  'UPDATE_CUSTOMER',
  DELETE_CUSTOMER:  'DELETE_CUSTOMER',
  CREATE_BARANG:    'CREATE_BARANG',
  UPDATE_BARANG:    'UPDATE_BARANG',
  DELETE_BARANG:    'DELETE_BARANG',
};

// ─── Label ramah untuk ditampilkan di UI ─────────────────────
export const ACTION_LABELS = {
  LOGIN:            'Login',
  LOGOUT:           'Logout',
  CREATE_TASK:      'Buat Task',
  UPDATE_TASK:      'Edit Task',
  DELETE_TASK:      'Hapus Task',
  CREATE_CATATAN:   'Buat Catatan',
  UPDATE_CATATAN:   'Edit Catatan',
  DELETE_CATATAN:   'Hapus Catatan',
  CREATE_USER:      'Buat User',
  DELETE_USER:      'Hapus User',
  RESET_PASSWORD:   'Reset Password',
  CREATE_CUSTOMER:  'Buat Customer',
  UPDATE_CUSTOMER:  'Edit Customer',
  DELETE_CUSTOMER:  'Hapus Customer',
  CREATE_BARANG:    'Buat Barang',
  UPDATE_BARANG:    'Edit Barang',
  DELETE_BARANG:    'Hapus Barang',
};

export const ACTION_COLORS = {
  LOGIN:          'bg-green-100 text-green-700',
  LOGOUT:         'bg-slate-100 text-slate-700',
  CREATE_TASK:    'bg-primary-100 text-primary-700',
  UPDATE_TASK:    'bg-yellow-100 text-yellow-700',
  DELETE_TASK:    'bg-red-100 text-red-700',
  CREATE_CATATAN: 'bg-primary-100 text-primary-700',
  UPDATE_CATATAN: 'bg-yellow-100 text-yellow-700',
  DELETE_CATATAN: 'bg-red-100 text-red-700',
  CREATE_USER:    'bg-primary-100 text-primary-700',
  DELETE_USER:    'bg-red-100 text-red-700',
  RESET_PASSWORD: 'bg-orange-100 text-orange-700',
  CREATE_CUSTOMER:'bg-primary-100 text-primary-700',
  UPDATE_CUSTOMER:'bg-yellow-100 text-yellow-700',
  DELETE_CUSTOMER:'bg-red-100 text-red-700',
  CREATE_BARANG:  'bg-primary-100 text-primary-700',
  UPDATE_BARANG:  'bg-yellow-100 text-yellow-700',
  DELETE_BARANG:  'bg-red-100 text-red-700',
};
