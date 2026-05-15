/**
 * sessionService.js
 * 
 * Implementasi single-session:
 * - Saat login, generate token baru dan simpan ke tabel user_sessions.
 * - Setiap N detik, cek apakah token di DB masih sama dengan token lokal.
 * - Jika berbeda (artinya ada login baru di tempat lain), paksa logout.
 */

import { supabase } from '@/lib/supabase';

const SESSION_CHECK_INTERVAL = 15_000; // cek tiap 15 detik
let checkIntervalId = null;

/**
 * Generate token UUID sederhana.
 */
function generateToken() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Daftarkan sesi baru saat login.
 * Menimpa token lama jika ada (upsert by user_id).
 * Kembalikan token yang tersimpan.
 */
export async function registerSession(userId) {
  const token = generateToken();

  const { error } = await supabase
    .from('user_sessions')
    .upsert({ user_id: userId, session_token: token, created_at: new Date().toISOString() }, {
      onConflict: 'user_id',
    });

  if (error) {
    console.warn('[Session] Gagal register session:', error.message);
    return null;
  }

  // Simpan token di sessionStorage (hilang kalau tab ditutup)
  sessionStorage.setItem('active_session_token', token);
  return token;
}

/**
 * Mulai polling untuk cek validitas sesi.
 * @param {string} userId
 * @param {function} onInvalidSession - callback saat sesi tidak valid (harus logout)
 */
export function startSessionWatcher(userId, onInvalidSession) {
  stopSessionWatcher(); // Pastikan tidak ada watcher duplikat

  checkIntervalId = setInterval(async () => {
    try {
      const localToken = sessionStorage.getItem('active_session_token');
      if (!localToken) {
        // Token lokal hilang (tab baru tanpa sessionStorage?) — anggap valid
        return;
      }

      const { data, error } = await supabase
        .from('user_sessions')
        .select('session_token')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) return; // Jika error network, jangan paksa logout

      if (data.session_token !== localToken) {
        // Ada sesi lain yang login — token di DB sudah diganti
        stopSessionWatcher();
        onInvalidSession();
      }
    } catch (err) {
      console.warn('[Session] Gagal cek sesi:', err.message);
    }
  }, SESSION_CHECK_INTERVAL);
}

/**
 * Hentikan session watcher.
 */
export function stopSessionWatcher() {
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
  }
}

/**
 * Hapus sesi dari DB saat logout.
 */
export async function clearSession(userId) {
  sessionStorage.removeItem('active_session_token');
  if (userId) {
    await supabase.from('user_sessions').delete().eq('user_id', userId);
  }
}
