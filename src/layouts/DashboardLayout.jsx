import { Outlet, useNavigate } from 'react-router-dom';
import { useState, useCallback, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { useAuthStore } from '@/stores/authStore';
import { useIdleTimer } from '@/hooks/useIdleTimer';
import { LogOut, ShieldAlert, Timer } from 'lucide-react';

const IDLE_TIMEOUT_MS  = 10 * 60 * 1000;  // 10 menit
const WARNING_BEFORE_MS = 60 * 1000;       // Peringatan 1 menit sebelum logout

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const { signOut, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const handleIdle = useCallback(async () => {
    setShowIdleWarning(false);
    await signOut();
    navigate('/login', { state: { reason: 'idle' } });
  }, [signOut, navigate]);

  const handleWarning = useCallback(() => {
    setShowIdleWarning(true);
    setCountdown(60);
  }, []);

  // Timer utama: 9 menit → tampilkan warning
  useIdleTimer(handleWarning, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS, isAuthenticated && !showIdleWarning);

  // Countdown 60 detik saat warning muncul
  useEffect(() => {
    if (!showIdleWarning) return;

    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          handleIdle();
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showIdleWarning, handleIdle]);

  const handleStayLoggedIn = () => {
    setShowIdleWarning(false);
    setCountdown(60);
  };

  // Persentase untuk ring SVG
  const pct = countdown / 60;
  const r = 34;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* ── Idle Warning Modal ── */}
      {showIdleWarning && (
        <>
          {/* Backdrop — pointer-events-auto agar klik di luar tidak tembus ke content */}
          <div
            className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Modal — di atas backdrop */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="idle-title"
            className="fixed inset-0 z-[201] flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm text-center overflow-hidden">
              {/* Header strip */}
              <div className="bg-amber-50 border-b border-amber-100 px-6 pt-6 pb-5 flex flex-col items-center gap-3">
                {/* Countdown ring */}
                <div className="relative w-20 h-20">
                  <svg
                    className="absolute inset-0 w-20 h-20 -rotate-90"
                    viewBox="0 0 80 80"
                  >
                    <circle
                      cx="40" cy="40" r={r}
                      fill="none"
                      stroke="#fde68a"
                      strokeWidth="6"
                    />
                    <circle
                      cx="40" cy="40" r={r}
                      fill="none"
                      stroke="#d97706"
                      strokeWidth="6"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference * (1 - pct)}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 1s linear' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-amber-600">{countdown}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <h3 id="idle-title" className="text-base font-bold text-slate-800">
                    Sesi Hampir Berakhir
                  </h3>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5">
                <p className="text-sm text-slate-500 mb-1">
                  Anda tidak aktif cukup lama.
                </p>
                <p className="text-sm text-slate-600">
                  Sesi otomatis berakhir dalam{' '}
                  <span className="font-bold text-amber-600">{countdown} detik</span>.
                </p>

                <div className="flex gap-3 mt-5">
                  <button
                    onClick={handleIdle}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    Keluar
                  </button>
                  <button
                    onClick={handleStayLoggedIn}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                  >
                    <Timer className="w-4 h-4" />
                    Tetap Login
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
