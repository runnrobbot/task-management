import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  Package,
  Users,
  Building2,
  Bell,
  BarChart2,
  Tag,
  LogOut,
  BookUser,
  Boxes,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

export default function Sidebar({ isOpen }) {
  const { user, signOut, isAdmin } = useAuthStore();

  const navItems = [
    { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/catatan',      icon: FileText,         label: 'Catatan' },
    { to: '/tasks',        icon: CheckSquare,      label: 'Tasks' },
    { to: '/barang-kosong',icon: Package,          label: 'Barang Kosong' },
    { to: '/customers',    icon: BookUser,         label: 'Customer' },
    { to: '/notifications',icon: Bell,             label: 'Notifikasi' },
  ];

  const adminItems = [
    { to: '/users',           icon: Users,      label: 'Users' },
    { to: '/divisions',       icon: Building2,  label: 'Divisi' },
    { to: '/catatan-kategori',icon: Tag,        label: 'Kategori Catatan' },
    { to: '/daftar-barang',   icon: Boxes,      label: 'Daftar Barang' },
    { to: '/audit-logs',      icon: ShieldCheck,label: 'Audit Logs' },
    { to: '/reports',         icon: BarChart2,  label: 'Laporan' },
  ];

  return (
    <aside
      className={`bg-slate-900 transition-all duration-300 flex flex-col h-screen sticky top-0 shadow-xl ${
        isOpen ? 'w-64' : 'w-[72px]'
      }`}
    >
      {/* Logo */}
      <div className={`shrink-0 flex flex-col items-center gap-2 border-b border-slate-700/60 ${isOpen ? 'p-5' : 'p-4'}`}>
        <img
          src="/logo-utama.png"
          alt="Logo"
          className={`object-contain transition-all duration-300 ${isOpen ? 'w-20 h-20' : 'w-9 h-9'}`}
        />
        {isOpen && (
          <h1 className="font-bold text-base text-primary-300 text-center leading-tight">
            Task Management
          </h1>
        )}
      </div>

      {/* Nav */}
      <nav className="px-2.5 pt-3 space-y-0.5 flex-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                isActive
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                {isOpen && (
                  <span className="font-medium text-sm flex-1">{item.label}</span>
                )}
                {isOpen && isActive && (
                  <ChevronRight className="w-3.5 h-3.5 text-primary-200 shrink-0" />
                )}
              </>
            )}
          </NavLink>
        ))}

        {isAdmin() && (
          <>
            {isOpen ? (
              <div className="px-3 pt-4 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Admin
              </div>
            ) : (
              <div className="my-2 mx-2 border-t border-slate-700/60" />
            )}
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                    {isOpen && (
                      <span className="font-medium text-sm flex-1">{item.label}</span>
                    )}
                    {isOpen && isActive && (
                      <ChevronRight className="w-3.5 h-3.5 text-primary-200 shrink-0" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User + Logout */}
      <div className="shrink-0 p-2.5 border-t border-slate-700/60">
        {isOpen && user?.username && (
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1 rounded-lg bg-slate-800/60">
            <div className="w-7 h-7 rounded-full bg-primary-600/30 flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5 text-primary-400" />
            </div>
            <p className="text-xs text-slate-300 truncate font-medium">{user.username}</p>
          </div>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-slate-400 hover:bg-red-900/30 hover:text-red-400 transition-all duration-150"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {isOpen && <span className="font-medium text-sm">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
