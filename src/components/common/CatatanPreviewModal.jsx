/**
 * CatatanPreviewModal
 * Modal preview detail catatan — reusable di Dashboard, TasksPage, BarangKosongPage
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, User, Phone, Building, Clock, Tag, Package,
  Calendar, Image as ImageIcon, MessageSquare, ZoomIn,
} from 'lucide-react';

const STATUS_WA_STYLE = {
  'Belum Dihubungi': { badge: 'bg-slate-100 text-slate-700',    dot: 'bg-slate-400' },
  'Sudah Dihubungi': { badge: 'bg-primary-100 text-primary-700', dot: 'bg-primary-400' },
  'Proses':          { badge: 'bg-yellow-100 text-yellow-700',  dot: 'bg-yellow-400' },
  'Selesai':         { badge: 'bg-green-100 text-green-700',    dot: 'bg-green-500' },
};

function Field({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <div>
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-sm text-slate-800 font-medium">{value}</p>
      </div>
    </div>
  );
}

export default function CatatanPreviewModal({ catatan, onClose }) {
  const [zoomImg, setZoomImg] = useState(false);

  if (!catatan) return null;

  const statusStyle = STATUS_WA_STYLE[catatan.status_wa || 'Belum Dihubungi'] || STATUS_WA_STYLE['Belum Dihubungi'];
  const formatDate = (iso) => iso
    ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50"
      />

      {/* Panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary-500" />
              Detail Catatan
            </h3>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-slate-100 text-slate-500 hover:bg-red-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">

            {/* Foto */}
            {catatan.gambar_url && (
              <div
                className="relative group w-full h-48 rounded-xl overflow-hidden cursor-zoom-in border border-slate-200"
                onClick={() => setZoomImg(true)}
              >
                <img
                  src={catatan.gambar_url}
                  alt="Foto catatan"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                </div>
              </div>
            )}

            {/* Tidak ada foto */}
            {!catatan.gambar_url && (
              <div className="w-full h-24 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1.5 text-slate-300">
                <ImageIcon className="w-7 h-7" />
                <span className="text-xs font-medium">Tidak ada foto</span>
              </div>
            )}

            {/* Info utama */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <Field icon={User}     label="Nama Customer"  value={catatan.nama_customer} />
              <Field icon={Phone}    label="No. Telepon"    value={catatan.no_telp} />
              <Field icon={Building} label="Cabang"         value={catatan.cabang} />
              <Field icon={Tag}      label="Kategori"       value={catatan.catatan_kategori?.nama} />
              <Field icon={Package}  label="Kode Barang"    value={catatan.kode_barang} />
              <Field icon={User}     label="Dicatat oleh"   value={catatan.users?.username} />
              <Field icon={Clock}    label="Waktu"          value={formatDate(catatan.waktu)} />
              {catatan.deadline && (
                <Field icon={Calendar} label="Deadline" value={formatDate(catatan.deadline)} />
              )}
            </div>

            {/* Status WA */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Status Follow-Up</span>
              <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusStyle.badge}`}>
                <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`}></span>
                {catatan.status_wa || 'Belum Dihubungi'}
              </span>
            </div>

            {/* Info percakapan */}
            {catatan.info_percakapan && (
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Info Percakapan</p>
                <div className="bg-primary-50 border border-primary-100 rounded-xl p-4">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{catatan.info_percakapan}</p>
                </div>
              </div>
            )}

            {/* Comment / catatan action terakhir */}
            {(catatan.catatan_action || catatan.comment) && (
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Catatan Aksi Terakhir</p>
                <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {catatan.catatan_action || catatan.comment}
                  </p>
                </div>
              </div>
            )}

            {/* Comment image */}
            {catatan.comment_image_url && (
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Foto Aksi</p>
                <img
                  src={catatan.comment_image_url}
                  alt="Foto aksi"
                  className="w-full max-h-48 object-cover rounded-xl border border-slate-200 cursor-zoom-in"
                  onClick={() => window.open(catatan.comment_image_url, '_blank')}
                />
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Zoom image fullscreen */}
      {zoomImg && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomImg(false)}
        >
          <img
            src={catatan.gambar_url}
            alt="Zoom"
            className="max-h-[90vh] max-w-full rounded-xl object-contain"
          />
          <button
            onClick={() => setZoomImg(false)}
            className="absolute top-4 right-4 bg-white text-slate-700 rounded-full p-2 shadow-lg hover:bg-red-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
