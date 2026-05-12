import { create } from 'zustand';

export const useUIStore = create((set) => ({
  // Sidebar state
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Modal states
  modals: {},
  openModal: (modalName) =>
    set((state) => ({
      modals: { ...state.modals, [modalName]: true },
    })),
  closeModal: (modalName) =>
    set((state) => ({
      modals: { ...state.modals, [modalName]: false },
    })),
  isModalOpen: (modalName) => (state) => state.modals[modalName] || false,

  // Toast notifications
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          id: Date.now(),
          type: 'info',
          duration: 3000,
          ...toast,
        },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  // Loading states
  loadingStates: {},
  setLoading: (key, isLoading) =>
    set((state) => ({
      loadingStates: { ...state.loadingStates, [key]: isLoading },
    })),
  isLoading: (key) => (state) => state.loadingStates[key] || false,

  // Dark mode
  darkMode: false,
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  setDarkMode: (enabled) => set({ darkMode: enabled }),
}));
