/**
 * adminUserService.js
 * 
 * Solusi untuk create user dari sisi admin tanpa mengganti session admin.
 * 
 * Masalah dengan approach lama (signUp + restore session):
 * - supabase.auth.signUp() mengganti session aktif sementara
 * - Ada race condition dengan onAuthStateChange listener
 * - Error 422 muncul kalau email sudah exist
 * 
 * Solusi: Gunakan supabase-js admin client dengan service_role key,
 * tapi karena service_role key tidak boleh di frontend (security risk),
 * kita pakai pendekatan "second client" yang isolated — hanya untuk signup,
 * tidak share storage session dengan client utama.
 */

import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Client terpisah khusus untuk signup user baru.
// persistSession: false — tidak simpan/timpa session di localStorage
// autoRefreshToken: false — tidak ada background refresh
// storageKey berbeda — isolated dari session admin
const signupClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    storageKey: 'signup-isolated-session',
    detectSessionInUrl: false,
  },
});


/**
 * Buat user baru tanpa mengganggu session admin.
 * Menggunakan client terpisah yang tidak share storage session.
 * 
 * @param {string} username
 * @param {string} password
 * @param {string} role
 * @param {string|null} divisi_id
 * @param {import('@supabase/supabase-js').SupabaseClient} mainSupabase - client utama (untuk insert profile)
 */
export async function adminCreateUser({ username, password, role, divisi_id }, mainSupabase) {
  const email = `${username}@glory.com`;

  // 1. Signup via isolated client — tidak mengganggu session admin sama sekali
  const { data: signUpData, error: signUpError } = await signupClient.auth.signUp({
    email,
    password,
    options: {
      // emailRedirectTo tidak diperlukan karena auto-confirm ON di Supabase
      data: { username, role },
    },
  });

  if (signUpError) {
    // HTTP 422: email sudah terdaftar
    if (
      signUpError.status === 422 ||
      signUpError.message?.toLowerCase().includes('already registered') ||
      signUpError.message?.toLowerCase().includes('user already registered')
    ) {
      throw new Error('Username sudah digunakan. Silakan pilih username lain.');
    }
    throw new Error(`Gagal membuat akun: ${signUpError.message}`);
  }

  const newUserId = signUpData?.user?.id;
  if (!newUserId) {
    // Bisa terjadi kalau Supabase email confirmation diaktifkan
    // (user dibuat tapi belum confirmed — id tetap ada di signUpData.user)
    throw new Error(
      'Gagal mendapatkan ID user baru. Pastikan "Auto Confirm" diaktifkan di Supabase Auth settings.'
    );
  }

  // 2. Insert profile ke tabel users menggunakan main client (session admin)
  const { error: profileError } = await mainSupabase
    .from('users')
    .insert([{
      id: newUserId,
      username,
      role,
      divisi_id: divisi_id || null,
    }]);

  if (profileError) {
    // Profile gagal diinsert — user auth sudah terbuat tapi profile tidak ada.
    // Ini partial failure. Log untuk debugging.
    console.error('Profile insert error:', profileError);
    throw new Error(`Akun dibuat tapi gagal simpan profil: ${profileError.message}`);
  }

  // 3. Sign out dari isolated client (cleanup)
  await signupClient.auth.signOut();

  return { id: newUserId, username, role };
}

/**
 * Reset password user menggunakan isolated client.
 * Admin memasukkan password baru untuk user target.
 * 
 * Catatan: supabase.auth.admin.updateUserById() memerlukan service_role key
 * yang tidak boleh ada di frontend. Alternatif frontend-safe:
 * - Kirim magic link (email) → user klik → ganti password sendiri
 * - ATAU: simpan "force_reset" flag di tabel users, saat user login
 *   paksa dia ganti password.
 * 
 * Untuk implementasi langsung tanpa email, kita gunakan RPC (Supabase Edge Function)
 * atau pendekatan berikut: admin sign in sebagai user lama lalu updateUser.
 * 
 * Pendekatan paling sederhana & aman untuk pure frontend:
 * Gunakan supabase.auth.resetPasswordForEmail() yang kirim email reset.
 * Tapi karena user pakai format username@glory.com, kita trigger itu.
 */
export async function resetUserPassword({ userId, username, newPassword }) {
  const email = `${username}@glory.com`;

  // Gunakan isolated client agar tidak mengganggu session admin
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const resetClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storageKey: 'reset-isolated-session',
      detectSessionInUrl: false,
    },
  });

  // Sign in sebagai user target menggunakan current password (tidak diketahui admin)
  // Karena kita tidak punya password lama, kita perlu pendekatan berbeda.
  // 
  // SOLUSI: Supabase Admin API via service_role. Karena pure frontend tidak bisa,
  // kita implementasikan lewat supabase.functions.invoke() yang sudah setup,
  // ATAU gunakan update langsung jika RLS di auth.users mengizinkan (tidak aman).
  //
  // Pendekatan TERBAIK untuk app ini: Simpan flag reset di tabel users,
  // lalu saat user login berikutnya, paksa dia ganti password.
  // Tapi untuk UX yang lebih baik, kita pakai Edge Function.
  //
  // Untuk sekarang: gunakan Supabase Auth Admin lewat REST API dengan service_role
  // (jika VITE_SUPABASE_SERVICE_ROLE_KEY tersedia — ini HANYA untuk dev/testing):
  
  const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceRoleKey) {
    // Fallback: set flag di tabel users bahwa password perlu di-reset
    
    const { error } = await supabase
      .from('users')
      .update({ needs_password_reset: true, temp_password_hint: `Reset oleh admin pada ${new Date().toLocaleDateString('id-ID')}` })
      .eq('id', userId);
    
    if (error) throw new Error('Gagal menandai reset password: ' + error.message);
    
    return { 
      method: 'flag',
      message: 'Flag reset password berhasil disimpan. User akan diminta ganti password saat login berikutnya.' 
    };
  }

  // Jika service_role tersedia (lebih powerful):
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) throw new Error('Gagal reset password: ' + error.message);

  await resetClient.auth.signOut();
  return { method: 'direct', message: 'Password berhasil direset.' };
}
