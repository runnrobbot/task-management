import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export default function AuthLayout() {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-purple-50 flex items-center justify-center p-4">
      <Outlet />
    </div>
  );
}
