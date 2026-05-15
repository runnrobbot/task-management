import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Phone, Building, User, Clock, Edit2, Trash2, Save, X, Package,
  Search, ImagePlus, Tag, Filter, Image as ImageIcon,
  CheckCircle, Loader2, AlertCircle, PhoneCall, CalendarClock, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useScope } from '@/lib/useScope';
import { QUERY_KEYS } from '@/lib/constants';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Pagination from '@/components/common/Pagination';
import Modal from '@/components/common/Modal';

const PAGE_SIZE = 12;
const BUCKET = 'catatan-images';

// Status follow-up WA
const STATUS_WA_STYLE = {
  'Belum Dihubungi': { badge: 'bg-slate-100 text-slate-700',    dot: 'bg-gray-400',    icon: <AlertCircle className="w-3 h-3" /> },
  'Sudah Dihubungi': { badge: 'bg-primary-100 text-primary-700',    dot: 'bg-primary-400',    icon: <PhoneCall className="w-3 h-3" /> },
  'Proses':          { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400',  icon: <Loader2 className="w-3 h-3" /> },
  'Selesai':         { badge: 'bg-green-100 text-green-700',   dot: 'bg-green-500',   icon: <CheckCircle className="w-3 h-3" /> },
};

// Format nomor ke format WA internasional
function formatWaNumber(noTelp) {
  if (!noTelp) return '';
  let num = noTelp.replace(/[^0-9]/g, '');
  if (num.startsWith('0')) num = '62' + num.substring(1);
  return num;
}

// Searchable combobox for Kode Barang
function KodeBarangCombobox({ value, onChange, daftarBarang, required }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        // restore display text if something was selected
        const sel = daftarBarang.find((b) => b.kode_barang === value);
        setQuery(sel ? `${sel.kode_barang} — ${sel.nama_barang}` : '');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [value, daftarBarang]);

  // Sync display when value changes externally
  useEffect(() => {
    if (!open) {
      const sel = daftarBarang.find((b) => b.kode_barang === value);
      setQuery(sel ? `${sel.kode_barang} — ${sel.nama_barang}` : '');
    }
  }, [value, daftarBarang, open]);

  const filtered = query.trim() && open
    ? daftarBarang.filter((b) =>
        b.kode_barang.toLowerCase().includes(query.toLowerCase()) ||
        b.nama_barang.toLowerCase().includes(query.toLowerCase())
      )
    : daftarBarang;

  const handleSelect = (b) => {
    onChange(b.kode_barang);
    setQuery(`${b.kode_barang} — ${b.nama_barang}`);
    setOpen(false);
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setOpen(true);
    if (!e.target.value) onChange('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-2">
        <span className="flex items-center gap-1">
          <Package className="w-4 h-4 text-slate-500" /> Kode Barang
          {required && <span className="text-red-500">*</span>}
        </span>
      </label>

      {daftarBarang.length === 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            Belum ada daftar barang.{' '}
            <a href="/daftar-barang" className="underline font-medium text-primary-600">Tambah di Daftar Barang</a>{' '}
            atau isi manual di bawah.
          </p>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            placeholder="Isi kode barang manual..."
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-slate-50 font-mono uppercase"
          />
        </div>
      ) : (
        <div ref={containerRef} className="relative">
          {/* Input field — search + display in one */}
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onFocus={() => setOpen(true)}
              placeholder="Cari kode atau nama barang..."
              autoComplete="off"
              className="w-full px-4 py-2 pr-8 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-slate-50 text-sm"
            />
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Dropdown list */}
          {open && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
              {filtered.length > 0 && (
                <div className="px-3 py-1.5 text-xs text-slate-400 border-b border-slate-100 bg-slate-50">
                  {filtered.length} produk ditemukan{query.trim() ? '' : ' — ketik untuk filter'}
                </div>
              )}
              <div className="max-h-52 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-400 text-center">Tidak ada hasil.</p>
                ) : (
                  filtered.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); handleSelect(b); }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center gap-3
                        ${b.kode_barang === value ? 'bg-primary-50 text-primary-700' : 'text-slate-700'}`}
                    >
                      <span className="font-mono font-medium shrink-0">{b.kode_barang}</span>
                      <span className="text-slate-500 truncate">{b.nama_barang}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Hidden input for form required validation */}
          <input
            type="text"
            required={required}
            value={value}
            onChange={() => {}}
            className="sr-only"
            tabIndex={-1}
          />
        </div>
      )}
    </div>
  );
}

export default function CatatanPage() {
  const { user } = useAuthStore();
  const { isAdmin, userId, applyUserFilter } = useScope();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  // Filter & pagination state
  const [search, setSearch] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('');
  const [page, setPage] = useState(1);

  // Form state
  const [formData, setFormData] = useState({
    id: '', nama_customer: '', no_telp: '', cabang: '', info_percakapan: '', kategori_id: '', deadline: '', kode_barang: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [existingImageUrl, setExistingImageUrl] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, id: null, imageUrl: null });
  const [imageModalUrl, setImageModalUrl] = useState(null);

  // Combobox state untuk nama_customer
  const [customerInput, setCustomerInput]   = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerInputRef = useRef(null);

  // Fetch kategori
  const { data: kategoris = [] } = useQuery({
    queryKey: ['catatan_kategori'],
    queryFn: async () => {
      const { data, error } = await supabase.from('catatan_kategori').select('*').order('nama', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch daftar barang (untuk field kode barang di kategori Barang Kosong)
  // Fetch semua produk dengan pagination untuk bypass limit 1000 rows Supabase
  const { data: daftarBarang = [] } = useQuery({
    queryKey: ['daftar_barang_all'],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from('daftar_barang')
          .select('id, kode_barang, nama_barang')
          .order('kode_barang', { ascending: true })
          .range(from, to);
        if (error) throw error;
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData = allData.concat(data);
          hasMore = data.length === PAGE_SIZE;
          page++;
        }
      }
      return allData;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // cache 5 menit
  });

  // Detect apakah kategori yang dipilih adalah "Barang Kosong"
  const selectedKategoriObj = kategoris.find(k => String(k.id) === String(formData.kategori_id));
  const isBarangKosongKategori = selectedKategoriObj?.nama?.toLowerCase().includes('barang kosong');

  // Fetch customers milik user ini (untuk dropdown nama_customer)
  const { data: myCustomers = [] } = useQuery({
    queryKey: [QUERY_KEYS.CUSTOMERS, 'mine', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, nama, no_hp')
        .eq('user_id', user.id)
        .order('nama', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Filter customer berdasarkan input ketikan
  const filteredCustomers = myCustomers.filter((c) =>
    c.nama.toLowerCase().includes(customerInput.toLowerCase())
  );

  // Saat pilih dari dropdown
  const handleSelectCustomer = (c) => {
    setFormData((prev) => ({
      ...prev,
      nama_customer: c.nama,
      no_telp: prev.no_telp || c.no_hp || '',
    }));
    setCustomerInput(c.nama);
    setShowCustomerDropdown(false);
  };

  // Fetch catatan
  const { data: result = { data: [], count: 0, totalPages: 1 }, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.CATATAN, { search, kategoriFilter, page, isAdmin, userId }],
    queryFn: async () => {
      let query = supabase
        .from('data_catatan')
        .select('*, users:user_id(username), catatan_kategori:kategori_id(id, nama)', { count: 'exact' })
        .order('waktu', { ascending: false });

      query = applyUserFilter(query);

      if (search) query = query.or(`nama_customer.ilike.%${search}%,no_telp.ilike.%${search}%,info_percakapan.ilike.%${search}%`);
      if (kategoriFilter) query = query.eq('kategori_id', kategoriFilter);

      const from = (page - 1) * PAGE_SIZE;
      query = query.range(from, from + PAGE_SIZE - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0, totalPages: Math.ceil((count || 0) / PAGE_SIZE) };
    },
    enabled: !!user,
    keepPreviousData: true,
  });

  // Upload image helper
  const uploadImage = async (file) => {
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(fileName, file);
    if (error) throw new Error('Gagal upload gambar: ' + error.message);
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const deleteImage = async (url) => {
    if (!url) return;
    try {
      const parts = url.split(`/${BUCKET}/`);
      if (parts[1]) await supabase.storage.from(BUCKET).remove([parts[1]]);
    } catch (_) {}
  };

  // Save catatan mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      let gambarUrl = existingImageUrl || null;
      if (imageFile) {
        if (existingImageUrl) await deleteImage(existingImageUrl);
        gambarUrl = await uploadImage(imageFile);
      }

      const payload = {
        nama_customer: data.nama_customer,
        no_telp: data.no_telp,
        cabang: data.cabang || null,
        role_data: getAutomatedRoleData(),
        info_percakapan: data.info_percakapan,
        kategori_id: data.kategori_id || null,
        gambar_url: gambarUrl,
        user_id: user.id,
        deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
        kode_barang: data.kode_barang || null,
      };

      if (data.id) {
        const { error } = await supabase.from('data_catatan').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from('data_catatan').insert([payload]).select().single();
        if (error) throw error;

        // Auto-create task jika kategori BUKAN "Barang Masuk"
        if (data.kategori_id) {
          const selectedKat = kategoris.find(k => String(k.id) === String(data.kategori_id));
          const isBarangMasuk = selectedKat?.nama?.toLowerCase() === 'barang masuk';
          if (!isBarangMasuk) {
            await supabase.from('tasks').insert([{
              judul_task: `[Catatan] ${data.nama_customer}`,
              deskripsi: `Nama: ${data.nama_customer}\nNo Telp: ${data.no_telp}${data.cabang ? '\nCabang: ' + data.cabang : ''}\n\n${data.info_percakapan}`,
              status: 'Pending',
              kategori: getAutomatedRoleData() === 'Offline' ? 'Offline' : getAutomatedRoleData() === 'Lelang' ? 'Lelang' : 'User',
              nama_customer: data.nama_customer,
              no_telp: data.no_telp,
              cabang: data.cabang || null,
              user_id: user.id,
            }]);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries([QUERY_KEYS.CATATAN]);
      queryClient.invalidateQueries([QUERY_KEYS.TASKS]);
      queryClient.invalidateQueries([QUERY_KEYS.STATS]);
      resetForm();
    },
  });

  // Delete catatan mutation — invalidate semua query terkait agar data hilang di semua page
  const deleteMutation = useMutation({
    mutationFn: async ({ id, imageUrl }) => {
      await deleteImage(imageUrl);
      const { error } = await supabase.from('data_catatan').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries([QUERY_KEYS.CATATAN]);
      queryClient.invalidateQueries(['catatan_barang_kosong']);
      queryClient.invalidateQueries(['catatan_barang_dashboard']);
      queryClient.invalidateQueries(['catatan_overdue']);
      queryClient.invalidateQueries([QUERY_KEYS.STATS]);
      queryClient.invalidateQueries([QUERY_KEYS.TASKS]);
    },
  });

  const getAutomatedRoleData = () => {
    const div = (user?.divisi_name || '').toLowerCase();
    if (div === 'offline') return 'Offline';
    if (div === 'tiktok') return 'Lelang';
    return 'User';
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Ukuran gambar maksimal 5MB.'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null); setImagePreview(null); setExistingImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e) => { e.preventDefault(); saveMutation.mutate(formData); };

  const handleEdit = (catatan) => {
    const deadlineVal = catatan.deadline
      ? new Date(catatan.deadline).toISOString().slice(0, 16)
      : '';
    setFormData({ id: catatan.id, nama_customer: catatan.nama_customer, no_telp: catatan.no_telp, cabang: catatan.cabang || '', info_percakapan: catatan.info_percakapan, kategori_id: catatan.kategori_id || '', deadline: deadlineVal, kode_barang: catatan.kode_barang || '' });
    setCustomerInput(catatan.nama_customer);
    setExistingImageUrl(catatan.gambar_url || null);
    setImagePreview(catatan.gambar_url || null);
    setImageFile(null);
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setFormData({ id: '', nama_customer: '', no_telp: '', cabang: '', info_percakapan: '', kategori_id: '', deadline: '', kode_barang: '' });
    setCustomerInput('');
    setImageFile(null); setImagePreview(null); setExistingImageUrl(null); setIsEditing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSearchChange = (val) => { setSearch(val); setPage(1); };
  const handleKategoriFilter = (val) => { setKategoriFilter(val); setPage(1); };

  const getKategoriColor = (nama) => {
    if (!nama) return 'border-l-gray-400';
    const colors = ['blue', 'teal', 'purple', 'orange', 'pink', 'indigo', 'green'];
    const map = { blue: 'border-l-primary-500', teal: 'border-l-primary-400', purple: 'border-l-primary-600', orange: 'border-l-primary-500', pink: 'border-l-primary-400', indigo: 'border-l-primary-600', green: 'border-l-primary-500' };
    return map[colors[nama.charCodeAt(0) % colors.length]];
  };

  const getKategoriBadge = (nama) => {
    if (!nama) return 'bg-slate-100 text-slate-600';
    const colors = ['blue', 'teal', 'purple', 'orange', 'pink', 'indigo', 'green'];
    const map = { blue: 'bg-primary-100 text-primary-700', teal: 'bg-primary-100 text-primary-700', purple: 'bg-primary-100 text-primary-700', orange: 'bg-slate-100 text-slate-700', pink: 'bg-primary-100 text-primary-700', indigo: 'bg-primary-100 text-primary-700', green: 'bg-primary-100 text-primary-700' };
    return map[colors[nama.charCodeAt(0) % colors.length]];
  };

  const hasActiveFilter = search || kategoriFilter;

  return (
    <div className="min-h-screen">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-8 h-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-slate-900">Data Catatan</h1>
        </div>

        {/* ── Form Input ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-8 max-w-2xl"
        >
          <div className="flex items-center gap-2 mb-6">
            <FileText className="w-5 h-5 text-primary-600" />
            <h2 className="text-xl font-bold text-slate-900">{isEditing ? 'Edit Catatan' : 'Input Catatan Baru'}</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nama Customer <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    ref={customerInputRef}
                    type="text"
                    value={customerInput}
                    onChange={(e) => {
                      setCustomerInput(e.target.value);
                      setFormData({ ...formData, nama_customer: e.target.value });
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                    placeholder="Nama customer..."
                    className="w-full px-4 py-2 pr-8 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-slate-50"
                    required
                  />
                  {myCustomers.length > 0 && (
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  )}
                </div>
                {/* Dropdown */}
                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={() => handleSelectCustomer(c)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-primary-50 transition-colors text-sm"
                      >
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-800">{c.nama}</span>
                        {c.no_hp && <span className="text-slate-400 text-xs ml-auto">{c.no_hp}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {myCustomers.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    Belum ada customer tersimpan.{' '}
                    <a href="/customers" className="text-primary-500 underline">Tambah di halaman Customer</a>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">No. Telp <span className="text-red-500">*</span></label>
                <input type="text" value={formData.no_telp} onChange={(e) => setFormData({ ...formData, no_telp: e.target.value })} placeholder="0812..." className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-slate-50" required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Cabang (Opsional)</label>
                <input type="text" value={formData.cabang} onChange={(e) => setFormData({ ...formData, cabang: e.target.value })} placeholder="Nama cabang..." className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-slate-50" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <span className="flex items-center gap-1"><Tag className="w-4 h-4" /> Kategori <span className="text-red-500">*</span></span>
                </label>
                <select value={formData.kategori_id} onChange={(e) => setFormData({ ...formData, kategori_id: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-slate-50" required>
                  <option value="">-- Pilih Kategori --</option>
                  {kategoris.map((k) => (<option key={k.id} value={k.id}>{k.nama}</option>))}
                </select>
              </div>
            </div>

            {/* Kode Barang — muncul hanya jika kategori Barang Kosong */}
            {isBarangKosongKategori && (
              <KodeBarangCombobox
                value={formData.kode_barang}
                onChange={(val) => setFormData({ ...formData, kode_barang: val })}
                daftarBarang={daftarBarang}
                required={isBarangKosongKategori}
              />
            )}

            {/* Deadline */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                <span className="flex items-center gap-1"><CalendarClock className="w-4 h-4" /> Deadline / Jadwal (Opsional)</span>
              </label>
              <input
                type="datetime-local"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-slate-50"
              />
              {formData.deadline && (
                <p className="text-xs text-slate-400 mt-1">
                  Deadline: {new Date(formData.deadline).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Info Percakapan <span className="text-red-500">*</span></label>
              <textarea value={formData.info_percakapan} onChange={(e) => setFormData({ ...formData, info_percakapan: e.target.value })} placeholder="Detail percakapan..." rows="4" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-slate-50" required />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                <span className="flex items-center gap-1"><ImagePlus className="w-4 h-4" /> Gambar (Opsional, maks 5MB)</span>
              </label>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Preview" className="h-36 w-auto rounded-lg border border-slate-200 object-cover cursor-pointer" onClick={() => setImageModalUrl(imagePreview)} />
                  <button type="button" onClick={removeImage} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"><X className="w-3 h-3" /></button>
                </div>
              ) : (
                <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
                  <ImagePlus className="w-5 h-5 text-slate-400" />
                  <span className="text-sm text-slate-500">Klik untuk upload gambar...</span>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
              )}
            </div>

            {saveMutation.isError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {saveMutation.error?.message || 'Terjadi kesalahan saat menyimpan.'}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4">
              {isEditing && (
                <button type="button" onClick={resetForm} className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium flex items-center gap-2">
                  <X className="w-4 h-4" /> Batal Edit
                </button>
              )}
              <button type="submit" disabled={saveMutation.isLoading} className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium flex items-center gap-2 disabled:opacity-50">
                <Save className="w-4 h-4" />
                {saveMutation.isLoading ? 'Menyimpan...' : 'Simpan Catatan'}
              </button>
            </div>
          </form>
        </motion.div>

        {/* ── Filter & Search ── */}
        <div className="bg-white p-4 rounded-xl shadow mb-6">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-600">
            <Filter className="w-4 h-4" /> Filter & Pencarian
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="text" placeholder="Cari nama, telp, info..." value={search} onChange={(e) => handleSearchChange(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
            <select value={kategoriFilter} onChange={(e) => handleKategoriFilter(e.target.value)} className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent">
              <option value="">Semua Kategori</option>
              {kategoris.map((k) => (<option key={k.id} value={k.id}>{k.nama}</option>))}
            </select>
          </div>
          {hasActiveFilter && (
            <button onClick={() => { handleSearchChange(''); handleKategoriFilter(''); }} className="mt-3 text-sm text-red-500 hover:text-red-700 underline">
              Reset Filter
            </button>
          )}
        </div>

        {/* ── Count ── */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-slate-900">
            Riwayat Catatan
            <span className="ml-2 text-sm font-normal text-slate-400">({result.count} data)</span>
          </h3>
        </div>

        {/* ── Card List ── */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Memuat catatan...</p>
          </div>
        ) : result.data.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">Belum ada data catatan.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {result.data.map((catatan, index) => {
                const kategoriNama = catatan.catatan_kategori?.nama;
                const statusWa = catatan.status_wa || 'Belum Dihubungi';
                const stStyle = STATUS_WA_STYLE[statusWa] || STATUS_WA_STYLE['Belum Dihubungi'];

                return (
                  <motion.div
                    key={catatan.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.04 }}
                    className={`bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 border-l-4 ${getKategoriColor(kategoriNama)} overflow-hidden`}
                  >
                    {/* Gambar */}
                    {catatan.gambar_url && (
                      <div className="h-40 overflow-hidden cursor-pointer" onClick={() => setImageModalUrl(catatan.gambar_url)}>
                        <img src={catatan.gambar_url} alt="Gambar catatan" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                      </div>
                    )}

                    <div className="p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-slate-900 mb-1">{catatan.nama_customer}</h3>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Phone className="w-3 h-3" /><span>{catatan.no_telp}</span>
                            </div>
                            {catatan.cabang && (
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Building className="w-3 h-3" /><span>{catatan.cabang}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 ml-2">
                          {kategoriNama && (
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${getKategoriBadge(kategoriNama)}`}>{kategoriNama}</span>
                          )}
                          {catatan.gambar_url && (
                            <span className="flex items-center gap-1 text-xs text-slate-400"><ImageIcon className="w-3 h-3" /> Foto</span>
                          )}
                        </div>
                      </div>

                      {/* Info percakapan */}
                      <div className="bg-slate-50 rounded-lg p-3 mb-3">
                        <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-3">{catatan.info_percakapan}</p>
                      </div>

                      {/* Pembuat */}
                      <div className="flex items-center gap-2 text-sm text-primary-600 mb-3">
                        <User className="w-3 h-3" />
                        <span className="font-medium">{catatan.users?.username || 'Unknown'}</span>
                      </div>

                      {/* Status WA badge */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${stStyle.badge}`}>
                          {stStyle.icon} {statusWa}
                        </span>
                      </div>

                      {/* Deadline badge */}
                      {catatan.deadline && (() => {
                        const dl = new Date(catatan.deadline);
                        const isOverdue = dl < new Date() && catatan.status_wa !== 'Selesai';
                        return (
                          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium mb-2 ${
                            isOverdue ? 'bg-red-50 text-red-700' : 'bg-primary-50 text-primary-700'
                          }`}>
                            <CalendarClock className="w-3 h-3" />
                            <span>{isOverdue ? '⚠ Overdue · ' : 'Deadline: '}{dl.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </div>
                        );
                      })()}

                      {/* Footer: waktu + aksi */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-200 gap-2 flex-wrap">
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(catatan.waktu).toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Edit & Delete only */}
                          {(user?.role === 'admin' || catatan.user_id === user?.id) && (
                            <>
                              <button onClick={() => handleEdit(catatan)} className="p-1.5 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setDeleteDialog({ isOpen: true, id: catatan.id, imageUrl: catatan.gambar_url })} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <Pagination page={page} totalPages={result.totalPages} onPageChange={setPage} />
          </>
        )}
      </motion.div>

      {/* ── Image Lightbox ── */}
      {imageModalUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setImageModalUrl(null)}>
          <div className="relative max-w-4xl max-h-full">
            <img src={imageModalUrl} alt="Preview" className="max-h-[85vh] max-w-full rounded-xl object-contain" />
            <button onClick={() => setImageModalUrl(null)} className="absolute -top-3 -right-3 bg-white text-slate-700 rounded-full p-2 shadow-lg hover:bg-red-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm Delete ── */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null, imageUrl: null })}
        onConfirm={() => {
          deleteMutation.mutate({ id: deleteDialog.id, imageUrl: deleteDialog.imageUrl });
          setDeleteDialog({ isOpen: false, id: null, imageUrl: null });
        }}
        title="Hapus Catatan"
        message="Yakin ingin menghapus data catatan ini? Gambar yang terlampir juga akan ikut dihapus."
        confirmText="Hapus"
        type="danger"
      />
    </div>
  );
}
