import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Package, Plus, Edit2, Trash2, Search, Upload, X, CheckCircle, AlertCircle,
  FileSpreadsheet, Hash, Tag,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { logActivity, AUDIT_ACTIONS } from '@/services/auditLogService';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Pagination from '@/components/common/Pagination';

const PAGE_SIZE = 20;
const QUERY_KEY = 'daftar_barang';

const emptyForm = { id: '', kode_barang: '', nama_barang: '' };

export default function DaftarBarangPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formData, setFormData] = useState(emptyForm);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, id: null });
  const [importResult, setImportResult] = useState(null); // { success, error, count }
  const [importing, setImporting] = useState(false);

  // Fetch daftar barang
  const { data: result = { data: [], count: 0, totalPages: 1 }, isLoading } = useQuery({
    queryKey: [QUERY_KEY, { search, page }],
    queryFn: async () => {
      let query = supabase
        .from('daftar_barang')
        .select('*', { count: 'exact' })
        .order('nama_barang', { ascending: true });

      if (search) {
        query = query.or(
          `kode_barang.ilike.%${search}%,nama_barang.ilike.%${search}%`
        );
      }

      const from = (page - 1) * PAGE_SIZE;
      query = query.range(from, from + PAGE_SIZE - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0, totalPages: Math.ceil((count || 0) / PAGE_SIZE) };
    },
    enabled: !!user,
    keepPreviousData: true,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        kode_barang: data.kode_barang.trim().toUpperCase(),
        nama_barang: data.nama_barang.trim(),
      };
      if (data.id) {
        const { error } = await supabase.from('daftar_barang').update(payload).eq('id', data.id);
        if (error) throw error;
        await logActivity({ userId: user.id, username: user.username, action: AUDIT_ACTIONS.UPDATE_BARANG, entity: 'daftar_barang', entityId: data.id, detail: `Edit barang: ${payload.kode_barang} — ${payload.nama_barang}` });
      } else {
        const { error } = await supabase.from('daftar_barang').insert([payload]);
        if (error) throw error;
        await logActivity({ userId: user.id, username: user.username, action: AUDIT_ACTIONS.CREATE_BARANG, entity: 'daftar_barang', detail: `Tambah barang: ${payload.kode_barang} — ${payload.nama_barang}` });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['daftar_barang_all'] }); // for CatatanPage dropdown
      resetForm();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('daftar_barang').delete().eq('id', id);
      if (error) throw error;
      await logActivity({ userId: user.id, username: user.username, action: AUDIT_ACTIONS.DELETE_BARANG, entity: 'daftar_barang', entityId: id, detail: `Hapus barang ID: ${id}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['daftar_barang_all'] });
      setDeleteDialog({ isOpen: false, id: null });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleEdit = (item) => {
    setFormData({ id: item.id, kode_barang: item.kode_barang, nama_barang: item.nama_barang });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setIsEditing(false);
  };

  const handleSearchChange = (val) => { setSearch(val); setPage(1); };

  // Import from Excel
  const handleExcelImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (rows.length === 0) {
        setImportResult({ success: false, error: 'File Excel kosong atau tidak ada data.' });
        setImporting(false);
        return;
      }

      // Detect headers — look for "KODE BARANG" and "NAMA BARANG" (case insensitive)
      const sampleRow = rows[0];
      const headers = Object.keys(sampleRow);
      const kodeKey = headers.find(h => h.toUpperCase().replace(/\s+/g, ' ').trim() === 'KODE BARANG');
      const namaKey = headers.find(h => h.toUpperCase().replace(/\s+/g, ' ').trim() === 'NAMA BARANG');

      if (!kodeKey || !namaKey) {
        setImportResult({
          success: false,
          error: `Header tidak ditemukan. Pastikan kolom Excel memiliki header "KODE BARANG" dan "NAMA BARANG". Header yang ditemukan: ${headers.join(', ')}`,
        });
        setImporting(false);
        return;
      }

      // Build insert payload, skip empty rows
      const rawRows = rows
        .filter(r => String(r[kodeKey]).trim() && String(r[namaKey]).trim())
        .map(r => ({
          kode_barang: String(r[kodeKey]).trim().toUpperCase(),
          nama_barang: String(r[namaKey]).trim(),
        }));

      if (rawRows.length === 0) {
        setImportResult({ success: false, error: 'Tidak ada data valid yang bisa diimpor.' });
        setImporting(false);
        return;
      }

      // Deduplicate by kode_barang — keep last occurrence (later row wins)
      const deduped = new Map();
      for (const row of rawRows) {
        deduped.set(row.kode_barang, row);
      }
      const toInsert = Array.from(deduped.values());

      // Upsert (conflict on kode_barang → update nama_barang)
      const { error } = await supabase
        .from('daftar_barang')
        .upsert(toInsert, { onConflict: 'kode_barang', ignoreDuplicates: false });

      if (error) throw error;

      const dupCount = rawRows.length - toInsert.length;
      setImportResult({
        success: true,
        count: toInsert.length,
        dupInfo: dupCount > 0 ? ` (${dupCount} duplikat kode di Excel diabaikan)` : '',
      });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['daftar_barang_all'] });
    } catch (err) {
      setImportResult({ success: false, error: err.message || 'Terjadi kesalahan saat import.' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-center gap-3 mb-6">
          <Package className="w-8 h-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-slate-900">Daftar Barang</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Input */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-6">
              <div className="flex items-center gap-2 mb-5">
                {isEditing ? <Edit2 className="w-5 h-5 text-orange-500" /> : <Plus className="w-5 h-5 text-primary-600" />}
                <h2 className="text-lg font-bold text-slate-900">{isEditing ? 'Edit Barang' : 'Tambah Barang'}</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    <span className="flex items-center gap-1"><Hash className="w-4 h-4" /> Kode Barang <span className="text-red-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    value={formData.kode_barang}
                    onChange={(e) => setFormData({ ...formData, kode_barang: e.target.value })}
                    placeholder="Contoh: BRG-001"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-slate-50 font-mono uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    <span className="flex items-center gap-1"><Tag className="w-4 h-4" /> Nama Barang <span className="text-red-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    value={formData.nama_barang}
                    onChange={(e) => setFormData({ ...formData, nama_barang: e.target.value })}
                    placeholder="Nama barang..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-slate-50"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  {isEditing && (
                    <button type="button" onClick={resetForm} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium flex items-center justify-center gap-2">
                      <X className="w-4 h-4" /> Batal
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={saveMutation.isLoading}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isEditing ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {saveMutation.isLoading ? 'Menyimpan...' : isEditing ? 'Update' : 'Tambah'}
                  </button>
                </div>
              </form>

              {/* Import Excel */}
              <div className="mt-6 pt-5 border-t border-slate-200">
                <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-green-600" /> Import dari Excel
                </p>
                <p className="text-xs text-slate-500 mb-3">
                  Pastikan Excel punya header <span className="font-mono bg-slate-100 px-1 rounded">KODE BARANG</span> dan <span className="font-mono bg-slate-100 px-1 rounded">NAMA BARANG</span>.
                </p>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-green-400 text-green-700 rounded-lg hover:bg-green-50 transition-colors font-medium text-sm disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {importing ? 'Mengimpor...' : 'Pilih File Excel'}
                </button>

                {importResult && (
                  <div className={`mt-3 p-3 rounded-lg text-sm flex items-start gap-2 ${importResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    {importResult.success
                      ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                    <span>
                      {importResult.success
                        ? `Berhasil mengimpor ${importResult.count} barang.${importResult.dupInfo || ''}`
                        : importResult.error}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="p-4 border-b border-slate-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari kode atau nama barang..."
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">{result.count} barang ditemukan</p>
              </div>

              {isLoading ? (
                <div className="p-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                </div>
              ) : result.data.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>Belum ada barang. Tambah manual atau import dari Excel.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Kode Barang</th>
                        <th className="px-4 py-3 text-left">Nama Barang</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.data.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono font-semibold text-primary-700">{item.kode_barang}</td>
                          <td className="px-4 py-3 text-slate-800">{item.nama_barang}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => handleEdit(item)} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => setDeleteDialog({ isOpen: true, id: item.id })} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="px-4 py-3 border-t border-slate-100">
                <Pagination page={page} totalPages={result.totalPages} onPageChange={setPage} />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title="Hapus Barang"
        message="Yakin ingin menghapus barang ini? Data yang terkait di catatan tidak akan terhapus."
        confirmLabel="Hapus"
        confirmVariant="danger"
        onConfirm={() => deleteMutation.mutate(deleteDialog.id)}
        onCancel={() => setDeleteDialog({ isOpen: false, id: null })}
        isLoading={deleteMutation.isLoading}
      />
    </div>
  );
}
