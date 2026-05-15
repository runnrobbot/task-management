import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { User, Lock, Eye, EyeOff, CheckCircle, AlertCircle, Shield } from 'lucide-react';

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();

  // --- State ganti password ---
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordAlert, setPasswordAlert] = useState(null); // { type: 'success'|'error', message }

  const handlePasswordChange = (e) => {
    setPasswordForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setPasswordAlert(null);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordAlert(null);

    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    // Validasi frontend
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordAlert({ type: 'error', message: 'Semua field harus diisi.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordAlert({ type: 'error', message: 'Password baru minimal 6 karakter.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordAlert({ type: 'error', message: 'Konfirmasi password tidak cocok.' });
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordAlert({ type: 'error', message: 'Password baru tidak boleh sama dengan password lama.' });
      return;
    }

    setPasswordLoading(true);

    try {
      // 1. Verifikasi password lama dengan re-login
      const email = `${user.username}@glory.com`;
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (signInError) {
        setPasswordAlert({ type: 'error', message: 'Password saat ini salah.' });
        setPasswordLoading(false);
        return;
      }

      // 2. Update ke password baru
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setPasswordAlert({ type: 'error', message: `Gagal mengubah password: ${updateError.message}` });
        setPasswordLoading(false);
        return;
      }

      // Berhasil
      setPasswordAlert({ type: 'success', message: 'Password berhasil diubah!' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordAlert({ type: 'error', message: 'Terjadi kesalahan, coba lagi.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profil Saya</h1>
        <p className="text-sm text-slate-500 mt-1">Kelola informasi akun dan keamanan Anda</p>
      </div>

      {/* Info Akun */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
            <User className="w-4 h-4 text-primary-600" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">Informasi Akun</h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <User className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900">{user?.username}</p>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
                user?.role === 'admin'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-primary-100 text-primary-700'
              }`}
            >
              <Shield className="w-3 h-3" />
              {user?.role === 'admin' ? 'Administrator' : 'User'}
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Divisi</p>
            <p className="text-sm font-medium text-slate-900 mt-0.5">
              {user?.divisions?.name || 'Umum'}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Role</p>
            <p className="text-sm font-medium text-slate-900 mt-0.5 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* Ganti Password */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
            <Lock className="w-4 h-4 text-orange-600" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">Ganti Password</h2>
        </div>

        {/* Alert */}
        {passwordAlert && (
          <div
            className={`flex items-start gap-2.5 p-3.5 rounded-lg mb-5 text-sm ${
              passwordAlert.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {passwordAlert.type === 'success' ? (
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            )}
            {passwordAlert.message}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          {/* Password Saat Ini */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Password Saat Ini
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                name="currentPassword"
                value={passwordForm.currentPassword}
                onChange={handlePasswordChange}
                placeholder="Masukkan password saat ini"
                className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Password Baru */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Password Baru
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                name="newPassword"
                value={passwordForm.newPassword}
                onChange={handlePasswordChange}
                placeholder="Minimal 6 karakter"
                className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password strength indicator */}
            {passwordForm.newPassword && (
              <div className="mt-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        passwordForm.newPassword.length >= level * 4
                          ? level === 1
                            ? 'bg-red-400'
                            : level === 2
                            ? 'bg-yellow-400'
                            : 'bg-green-400'
                          : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {passwordForm.newPassword.length < 4
                    ? 'Terlalu pendek'
                    : passwordForm.newPassword.length < 8
                    ? 'Cukup'
                    : 'Kuat'}
                </p>
              </div>
            )}
          </div>

          {/* Konfirmasi Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Konfirmasi Password Baru
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                name="confirmPassword"
                value={passwordForm.confirmPassword}
                onChange={handlePasswordChange}
                placeholder="Ulangi password baru"
                className={`w-full px-3 py-2 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword
                    ? 'border-red-300 bg-red-50'
                    : 'border-slate-300'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">Password tidak cocok</p>
            )}
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              {passwordLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Menyimpan...
                </span>
              ) : (
                'Simpan Password Baru'
              )}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
