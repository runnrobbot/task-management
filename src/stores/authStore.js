import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import { logActivity, AUDIT_ACTIONS } from '@/services/auditLogService';
import { registerSession, startSessionWatcher, stopSessionWatcher, clearSession } from '@/services/sessionService';

const fetchProfile = async (userId) => {
  const { data } = await supabase
    .from('users')
    .select('*, divisions(id, name)')
    .eq('id', userId)
    .maybeSingle();
  return data || null;
};

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: true,
      sessionKickedOut: false,

      initialize: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();

          if (session) {
            const profile = await fetchProfile(session.user.id);
            set({ session, user: profile, isAuthenticated: !!profile, isLoading: false });

            const localToken = sessionStorage.getItem('active_session_token');
            if (localToken && profile) {
              startSessionWatcher(profile.id, () => get().forceLogout('session_kicked'));
            }
          } else {
            set({ isLoading: false });
          }

          if (!get()._authListenerRegistered) {
            set({ _authListenerRegistered: true });
            supabase.auth.onAuthStateChange(async (event, newSession) => {
              if (event === 'SIGNED_OUT') {
                set({ user: null, session: null, isAuthenticated: false, isLoading: false });
                return;
              }
              if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && newSession) {
                const currentUser = get().user;
                if (currentUser && currentUser.id === newSession.user.id) {
                  set({ session: newSession });
                  return;
                }
                const profile = await fetchProfile(newSession.user.id);
                if (profile) {
                  set({ session: newSession, user: profile, isAuthenticated: true, isLoading: false });
                }
              }
            });
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          set({ isLoading: false });
        }
      },

      signIn: async (username, password) => {
        try {
          const email = `${username}@glory.com`;
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw new Error('Username atau password salah');

          const profile = await fetchProfile(data.user.id);
          if (!profile) throw new Error('User profile tidak ditemukan.');

          set({ session: data.session, user: profile, isAuthenticated: true, sessionKickedOut: false });

          await registerSession(profile.id);
          startSessionWatcher(profile.id, () => get().forceLogout('session_kicked'));

          await logActivity({
            userId: profile.id,
            username: profile.username,
            action: AUDIT_ACTIONS.LOGIN,
            detail: 'Login berhasil',
          });

          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },

      signOut: async () => {
        try {
          const { user } = get();
          if (user) {
            await logActivity({
              userId: user.id,
              username: user.username,
              action: AUDIT_ACTIONS.LOGOUT,
              detail: 'Logout manual',
            });
            await clearSession(user.id);
          }
          stopSessionWatcher();
          await supabase.auth.signOut();
          set({ user: null, session: null, isAuthenticated: false, sessionKickedOut: false });
        } catch (error) {
          console.error('Sign out error:', error);
        }
      },

      forceLogout: async (reason = 'session_kicked') => {
        stopSessionWatcher();
        sessionStorage.removeItem('active_session_token');
        await supabase.auth.signOut();
        set({
          user: null, session: null, isAuthenticated: false,
          sessionKickedOut: reason === 'session_kicked',
        });
      },

      clearKickedOutFlag: () => set({ sessionKickedOut: false }),
      updateUser: (updates) => set({ user: { ...get().user, ...updates } }),
      isAdmin: () => get().user?.role === 'admin',
      getUserDivision: () => get().user?.divisions?.name || 'Umum',
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
