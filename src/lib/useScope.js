import { useAuthStore } from '@/stores/authStore';

/**
 * Helper scope per-user.
 *
 * Aturan visibility:
 *   - admin / superadmin        → lihat semua data (no filter)
 *   - Divisi dengan is_shared   → lihat semua data milik sesama anggota divisi
 *   - Divisi tanpa is_shared    → hanya milik sendiri
 *
 * Tidak ada hardcode nama divisi. Superadmin cukup toggle is_shared
 * di halaman Manajemen Divisi.
 */
export function useScope(userIdField = 'user_id') {
  const { user } = useAuthStore();

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const userId      = user?.id ?? null;
  const divisionId  = user?.divisions?.id ?? null;
  const divisionName = user?.divisions?.name ?? null;

  /**
   * Apakah divisi user ini aktif sharing.
   * Baca dari user.divisions.is_shared yang sudah di-join di authStore.
   */
  const isDivisionShared = !isAdmin && (user?.divisions?.is_shared === true);

  /**
   * Fallback filter: hanya milik sendiri.
   * Untuk divisi shared, gunakan applySharedFilter di bawah.
   */
  const applyUserFilter = (query, field = userIdField) => {
    if (!user) return query;
    if (isAdmin) return query;
    return query.eq(field, userId);
  };

  /**
   * Filter untuk divisi dengan sharing aktif.
   * Tampilkan semua data dari sesama anggota divisi (berdasarkan siblingIds).
   *
   * @param {object}   query      - Supabase query builder
   * @param {string[]} siblingIds - Array user_id sesama anggota divisi
   * @param {string}   field      - Nama kolom user_id di tabel target
   */
  const applySharedFilter = (query, siblingIds = [], field = userIdField) => {
    if (!user) return query;
    if (isAdmin) return query;
    if (!isDivisionShared || siblingIds.length === 0) {
      return query.eq(field, userId);
    }
    return query.in(field, siblingIds);
  };

  return {
    user,
    isAdmin,
    isDivisionShared,
    userId,
    divisionId,
    divisionName,
    applyUserFilter,
    applySharedFilter,
  };
}