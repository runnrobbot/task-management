import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { 
  LayoutDashboard, 
  FileText, 
  CheckSquare, 
  Package, 
  Users, 
  UserCog, 
  Building2, 
  Bell, 
  FileBarChart,
  Tag,
  LogOut,
  ContactRound,
} from 'lucide-react';

export default function Sidebar({ isOpen }) {
  const { user, signOut, isAdmin } = useAuthStore();

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/catatan', icon: FileText, label: 'Catatan' },
    { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
    { to: '/barang-kosong', icon: Package, label: 'Barang Kosong' },
    { to: '/customers', icon: ContactRound, label: 'Customer' },
    { to: '/notifications', icon: Bell, label: 'Notifikasi' },
  ];

  const adminItems = [
    { to: '/users', icon: Users, label: 'Users' },
    { to: '/employees', icon: UserCog, label: 'Karyawan' },
    { to: '/divisions', icon: Building2, label: 'Divisi' },
    { to: '/catatan-kategori', icon: Tag, label: 'Kategori Catatan' },
    { to: '/reports', icon: FileBarChart, label: 'Laporan' },
  ];

  return (
    <aside className={`bg-white border-r border-gray-200 transition-all duration-300 flex flex-col h-screen sticky top-0 ${isOpen ? 'w-64' : 'w-20'}`}>
      {/* Logo */}
      <div className="p-6 shrink-0">
        <h1 className={`font-bold text-xl text-primary-600 ${!isOpen && 'text-center'}`}>
          {isOpen ? 'Task Management' : 'TM'}
        </h1>
      </div>

      {/* Nav - scrollable jika banyak item */}
      <nav className="px-3 space-y-1 flex-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-600'
                  : 'text-gray-700 hover:bg-gray-50'
              }`
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {isOpen && <span className="font-medium">{item.label}</span>}
          </NavLink>
        ))}

        {isAdmin() && (
          <>
            {isOpen && <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Admin</div>}
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`
                }
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {isOpen && <span className="font-medium">{item.label}</span>}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Logout - selalu di bawah, tidak pernah overlap */}
      <div className="shrink-0 p-3 border-t border-gray-200">
        {isOpen && user?.username && (
          <p className="px-3 pb-1 text-xs text-gray-400 truncate">{user.username}</p>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {isOpen && <span className="font-medium">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
