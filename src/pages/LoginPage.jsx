import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Eye, EyeOff, CheckSquare } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, sessionKickedOut, clearKickedOutFlag } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionKickedOut) {
      setError('Sesi Anda berakhir karena akun ini login di perangkat lain.');
      clearKickedOutFlag();
    }
  }, [sessionKickedOut, clearKickedOutFlag]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await signIn(username, password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Login gagal');
    }
    setLoading(false);
  };

  return (
    <div className="login-wrapper">
      {/* Background decorative elements */}
      <div className="login-bg-blob login-bg-blob-1" />
      <div className="login-bg-blob login-bg-blob-2" />
      <div className="login-bg-blob login-bg-blob-3" />

      <div className="login-card">
        {/* Left panel — branding */}
        <div className="login-brand-panel">
          <div className="login-brand-inner">
            <div className="login-logo">
              <CheckSquare className="login-logo-icon" strokeWidth={1.5} />
            </div>
            <h1 className="login-app-name">Glory8 Task</h1>
            <p className="login-app-tagline">
              Sistem manajemen tugas Glory8
            </p>

            <div className="login-features">
              {[
                'Dashboard per akun',
                'Kontrol penuh admin',
                'Notifikasi real-time',
                'Laporan lengkap',
              ].map((f) => (
                <div key={f} className="login-feature-item">
                  <span className="login-feature-dot" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Decorative grid */}
          <div className="login-brand-grid" aria-hidden="true">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="login-brand-grid-dot" />
            ))}
          </div>
        </div>

        {/* Right panel — form */}
        <div className="login-form-panel">
          <div className="login-form-inner">
            <div className="login-form-header">
              <h2 className="login-form-title">Selamat datang</h2>
              <p className="login-form-subtitle">Masuk ke akun Anda untuk melanjutkan</p>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              {/* Username */}
              <div className="login-field">
                <label className="login-label">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="login-input"
                  placeholder="Masukkan username"
                  required
                  autoFocus
                  autoComplete="username"
                />
              </div>

              {/* Password */}
              <div className="login-field">
                <label className="login-label">Password</label>
                <div className="login-password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="login-input login-input-password"
                    placeholder="Masukkan password"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="login-eye-btn"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="login-error" role="alert">
                  <span className="login-error-dot" />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="login-submit-btn"
              >
                {loading ? (
                  <span className="login-btn-loading">
                    <span className="login-spinner" />
                    Memproses...
                  </span>
                ) : (
                  'Masuk'
                )}
              </button>
            </form>

            <p className="login-footer-note">
              Glory8 Task Management &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
