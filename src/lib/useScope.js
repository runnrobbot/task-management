import { useAuthStore } from '@/stores/authStore';

/**
 * Helper scope per-user.
 *
 * Walaupun RLS Supabase sudah memfilter di sisi DB, kita tetap apply filter
 * di client supaya:
 *   1. Query lebih efisien (Supabase tidak perlu evaluasi RLS row-per-row
 *      ketika user_id sudah eksplisit).
 *   2. Pagination count akurat — kalau pakai RLS saja, `count: 'exact'`
 *      kadang return total semua row sebelum RLS filter pada PostgREST
 *      versi tertentu. Filter eksplisit menghindari hal itu.
 *   3. Logic admin-only filter (lihat user X) tetap bersih di satu tempat.
 *
 * Contoh pakai:
 *   const { isAdmin, userId, applyUserFilter } = useScope();
 *   let q = supabase.from('tasks').select('*');
 *   q = applyUserFilter(q);          // user → eq('user_id', userId), admin → no-op
 */
export function useScope(userIdField = 'user_id') {
  const { user } = useAuthStore();
  const isAdmin =
    user?.role === 'admin' || user?.role === 'superadmin';
  const userId = user?.id ?? null;

  /** Apply WHERE user_id = current user, kalau bukan admin */
  const applyUserFilter = (query, field = userIdField) => {
    if (!user) return query;
    if (isAdmin) return query;
    return query.eq(field, userId);
  };

  return { user, isAdmin, userId, applyUserFilter };
}
