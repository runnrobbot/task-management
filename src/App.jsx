import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

// Layouts
import AuthLayout from '@/layouts/AuthLayout';
import DashboardLayout from '@/layouts/DashboardLayout';

// Pages
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import CatatanPage from '@/pages/CatatanPage';
import TasksPage from '@/pages/TasksPage';
import UsersPage from '@/pages/UsersPage';
import DivisionsPage from '@/pages/DivisionsPage';
import NotificationsPage from '@/pages/NotificationsPage';
import ReportsPage from '@/pages/ReportsPage';
import BarangKosongPage from '@/pages/BarangKosongPage';
import CatatanKategoriPage from '@/pages/CatatanKategoriPage';
import CustomerPage from '@/pages/CustomerPage';
import DaftarBarangPage from '@/pages/DaftarBarangPage';
import ProfilePage from '@/pages/ProfilePage';
import AuditLogsPage from '@/pages/AuditLogsPage';

// Components
import LoadingScreen from '@/components/common/LoadingScreen';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AdminRoute from '@/components/auth/AdminRoute';

function App() {
  const { initialize, isLoading } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Protected routes */}
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/catatan" element={<CatatanPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/barang-kosong" element={<BarangKosongPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/customers" element={<CustomerPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Admin only routes */}
          <Route
            path="/users"
            element={
              <AdminRoute>
                <UsersPage />
              </AdminRoute>
            }
          />
          <Route
            path="/divisions"
            element={
              <AdminRoute>
                <DivisionsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/catatan-kategori"
            element={
              <AdminRoute>
                <CatatanKategoriPage />
              </AdminRoute>
            }
          />
          <Route
            path="/daftar-barang"
            element={
              <AdminRoute>
                <DaftarBarangPage />
              </AdminRoute>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <AdminRoute>
                <AuditLogsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <AdminRoute>
                <ReportsPage />
              </AdminRoute>
            }
          />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
