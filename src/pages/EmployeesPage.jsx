import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { UserCircle, Plus, Edit2, Trash2, Save, X, CreditCard, Building2, Search } from 'lucide-react';
import Pagination from '@/components/common/Pagination';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { QUERY_KEYS } from '@/lib/constants';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';

export default function EmployeesPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, id: null });
  const [formData, setFormData] = useState({ id: '', name: '', division_id: '' });
  const [search, setSearch] = useState('');
  const [divFilter, setDivFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  // Fetch employees — MUST be declared BEFORE useMemo that uses `employees`
  const { data: employees = [], isLoading } = useQuery({
    queryKey: [QUERY_KEYS.EMPLOYEES],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*, divisions(id, name)')
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && user.role === 'admin',
  });

  // Fetch divisions for dropdown
  const { data: divisions = [] } = useQuery({
    queryKey: [QUERY_KEYS.DIVISIONS],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('divisions')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && user.role === 'admin',
  });

  const filteredEmployees = useMemo(() => {
    return employees.filter(e =>
      e.name.toLowerCase().includes(search.toLowerCase()) &&
      (divFilter ? String(e.division_id) === String(divFilter) : true)
    );
  }, [employees, search, divFilter]);

  const paginatedEmployees = useMemo(() => {
    const from = (page - 1) * PAGE_SIZE;
    return filteredEmployees.slice(from, from + PAGE_SIZE);
  }, [filteredEmployees, page]);

  const totalPages = Math.ceil(filteredEmployees.length / PAGE_SIZE);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase.from('employees').insert([{ name: data.name, division_id: data.division_id || null }]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries([QUERY_KEYS.EMPLOYEES]); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase.from('employees').update({ name: data.name, division_id: data.division_id || null }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries([QUERY_KEYS.EMPLOYEES]); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries([QUERY_KEYS.EMPLOYEES]),
  });

  const openCreateModal = () => { setFormData({ id: '', name: '', division_id: '' }); setIsEditMode(false); setIsModalOpen(true); };
  const openEditModal = (employee) => { setFormData({ id: employee.id, name: employee.name, division_id: employee.division_id || '' }); setIsEditMode(true); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setFormData({ id: '', name: '', division_id: '' }); };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { name: formData.name, division_id: formData.division_id || null };
    if (isEditMode) {
      updateMutation.mutate({ id: formData.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const confirmDelete = () => {
    if (confirmDialog.id) {
      deleteMutation.mutate(confirmDialog.id);
      setConfirmDialog({ isOpen: false, id: null });
    }
  };

  if (user?.role !== 'admin') {
    return <div className="text-center py-12"><p className="text-slate-600">Anda tidak memiliki akses ke halaman ini.</p></div>;
  }

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <UserCircle className="w-8 h-8 text-primary-600" />
            <h1 className="text-3xl font-bold text-slate-900">Manajemen Karyawan</h1>
          </div>
          <button onClick={openCreateModal} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
            <Plus className="w-5 h-5" /> Tambah Karyawan
          </button>
        </div>

        {/* Search & Filter */}
        <div className="bg-white p-4 rounded-xl shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari karyawan..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <select
              value={divFilter}
              onChange={(e) => { setDivFilter(e.target.value); setPage(1); }}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Semua Divisi</option>
              {divisions.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Memuat karyawan...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow">
            <UserCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">Belum ada karyawan.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-4">{filteredEmployees.length} karyawan ditemukan</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedEmployees.map((employee, index) => (
                <motion.div
                  key={employee.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-3 bg-primary-100 rounded-lg">
                        <CreditCard className="w-6 h-6 text-primary-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">{employee.name}</h3>
                        {employee.divisions && (
                          <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
                            <Building2 className="w-3 h-3" />
                            <span>{employee.divisions.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditModal(employee)} className="p-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setConfirmDialog({ isOpen: true, id: employee.id })} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 pt-3 border-t">ID: {employee.id}</div>
                </motion.div>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </motion.div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={isEditMode ? 'Edit Karyawan' : 'Tambah Karyawan'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Nama Karyawan <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nama lengkap karyawan..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Divisi (Opsional)</label>
            <select
              value={formData.division_id}
              onChange={(e) => setFormData({ ...formData, division_id: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">-- Pilih Divisi --</option>
              {divisions.map((division) => (
                <option key={division.id} value={division.id}>{division.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t">
            <button type="button" onClick={closeModal} className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium flex items-center gap-2">
              <X className="w-4 h-4" /> Batal
            </button>
            <button type="submit" disabled={createMutation.isLoading || updateMutation.isLoading} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" />
              {createMutation.isLoading || updateMutation.isLoading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title="Hapus Karyawan"
        message="Yakin ingin menghapus karyawan ini? Data yang dihapus tidak dapat dikembalikan."
        confirmText="Hapus"
        type="danger"
      />
    </div>
  );
}
