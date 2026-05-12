import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export default function AdminRoute({ children }) {
  const { user } = useAuthStore();

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
