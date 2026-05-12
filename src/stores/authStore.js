import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: true,

      // Initialize auth state from Supabase
      initialize: async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session) {
            // Fetch user profile from database
            const { data: profile } = await supabase
              .from('users')
              .select('*, divisions(id, name)')
              .eq('id', session.user.id)
              .single();

            set({
              session,
              user: profile,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            set({ isLoading: false });
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          set({ isLoading: false });
        }
      },

      // Sign in
      signIn: async (username, password) => {
        try {
          // Always use username@app.local format for auth
          const email = `${username}@glory8.com`;

          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            console.error('Auth error:', error);
            throw new Error('Username atau password salah');
          }

          // Get user profile from database
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*, divisions(id, name)')
            .eq('id', data.user.id)
            .single();

          if (userError || !userData) {
            console.error('User profile error:', userError);
            throw new Error('User profile tidak ditemukan. Pastikan user sudah diinsert ke table users.');
          }

          set({
            session: data.session,
            user: userData,
            isAuthenticated: true,
          });

          return { success: true };
        } catch (error) {
          console.error('Sign in error:', error);
          return { success: false, error: error.message };
        }
      },

      // Sign out
      signOut: async () => {
        try {
          await supabase.auth.signOut();
          set({
            user: null,
            session: null,
            isAuthenticated: false,
          });
        } catch (error) {
          console.error('Sign out error:', error);
        }
      },

      // Update user profile
      updateUser: (updates) => {
        const currentUser = get().user;
        set({ user: { ...currentUser, ...updates } });
      },

      // Check if user is admin
      isAdmin: () => {
        const user = get().user;
        return user?.role === 'admin';
      },

      // Get user division
      getUserDivision: () => {
        const user = get().user;
        return user?.divisions?.name || 'Umum';
      },
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
