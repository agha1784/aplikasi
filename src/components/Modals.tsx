import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { X } from 'lucide-react';
import {
  createAssignment,
  createClassroom,
  joinClassByCode,
  lookupClassCode,
  updateAssignment,
  updateClassroom,
} from '../services/classroomService';
import {
  Assignment,
  AssignmentType,
  BANNER_THEMES,
  BannerKey,
  ClassCodeLookup,
  Classroom,
} from '../types/classroom';
import { ClassBanner } from './BannerImage';

export function CreateClassModal({
  open,
  user,
  editingClass,
  onClose,
  onSaved,
}: {
  open: boolean;
  user: User;
  editingClass?: Classroom | null;
  onClose: () => void;
  onSaved: (classId?: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [section, setSection] = useState('');
  const [subject, setSubject] = useState('');
  const [room, setRoom] = useState('');
  const [description, setDescription] = useState('');
  const [bannerKey, setBannerKey] = useState<BannerKey>('informatika');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(editingClass?.title || '');
      setSection(editingClass?.section || '');
      setSubject(editingClass?.subject || '');
      setRoom(editingClass?.room || '');
      setDescription(editingClass?.description || '');
      setBannerKey(editingClass?.bannerKey || 'informatika');
      setError(null);
    }
  }, [open, editingClass]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Nama kelas wajib diisi.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (editingClass) {
        await updateClassroom(editingClass, {
          title,
          section,
          subject,
          room,
          description,
          bannerKey,
        });
        onSaved(editingClass.id);
      } else {
        const newId = await createClassroom(user, {
          title,
          section,
          subject,
          room,
          description,
          bannerKey,
        });
        onSaved(newId);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan kelas.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-modal-title"
        className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="class-modal-title" className="font-display text-lg font-semibold text-slate-900">
            {editingClass ? 'Sunting Pengaturan Kelas' : 'Buat Kelas Baru'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nama Kelas <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Algoritma & Struktur Data"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Bagian / Angkatan
              </label>
              <input
                type="text"
                maxLength={60}
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="Contoh: Kelas XI IPA 2"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Mata Pelajaran / Bidang
              </label>
              <input
                type="text"
                maxLength={60}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Contoh: Informatika"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Ruang / Jadwal
            </label>
            <input
              type="text"
              maxLength={40}
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Contoh: Lab Komputer 1 · Senin 08.00"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Deskripsi Singkat
            </label>
            <textarea
              rows={2}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ringkasan silabus atau aturan kelas..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Tema Sampul Kelas
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.values(BANNER_THEMES).map((theme) => {
                const active = bannerKey === theme.key;
                return (
                  <button
                    key={theme.key}
                    type="button"
                    onClick={() => setBannerKey(theme.key)}
                    className={`relative h-20 rounded-lg overflow-hidden border text-left transition-all ${
                      active
                        ? 'border-blue-700 ring-2 ring-blue-700/25'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <ClassBanner bannerKey={theme.key} alt={theme.label} />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-transparent" />
                    <span className="absolute bottom-2 left-2.5 right-2.5 text-xs font-medium text-white truncate">
                      {theme.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {submitting ? 'Menyimpan...' : editingClass ? 'Simpan Perubahan' : 'Buat Kelas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function JoinClassModal({
  open,
  user,
  onClose,
  onJoined,
}: {
  open: boolean;
  user: User;
  onClose: () => void;
  onJoined: (classId: string) => void;
}) {
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<ClassCodeLookup | null>(null);
  const [checking, setChecking] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCode('');
      setPreview(null);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleCodeChange(val: string) {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setCode(clean);
    setError(null);
    if (clean.length >= 6) {
      setChecking(true);
      try {
        const res = await lookupClassCode(clean);
        setPreview(res);
      } catch {
        setPreview(null);
      } finally {
        setChecking(false);
      }
    } else {
      setPreview(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setJoining(true);
    setError(null);
    try {
      const classId = await joinClassByCode(user, code);
      onJoined(classId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal bergabung ke kelas.');
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-modal-title"
        className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="join-modal-title" className="font-display text-lg font-semibold text-slate-900">
            Gabung ke Kelas
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Masukkan kode kelas 6 karakter yang dibagikan oleh pengajar Anda untuk bergabung sebagai
            siswa.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Kode Kelas
            </label>
            <input
              type="text"
              required
              minLength={6}
              maxLength={8}
              value={code}
              onChange={(e) => void handleCodeChange(e.target.value)}
              placeholder="Contoh: KLS84M"
              className="w-full px-4 py-3 font-mono text-lg tracking-widest uppercase border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
            />
          </div>

          {checking && (
            <p className="text-xs text-slate-500">Memeriksa kode kelas...</p>
          )}

          {preview && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs text-emerald-700 font-medium mb-1">Kelas ditemukan</p>
              <p className="font-display text-base font-semibold text-slate-900">{preview.title}</p>
              <p className="text-xs text-slate-600 mt-0.5">
                {[preview.subject, preview.section, `Pengajar: ${preview.teacherName}`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={joining || code.length < 6}
              className="px-5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {joining ? 'Bergabung...' : 'Gabung Kelas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AssignmentModal({
  open,
  classId,
  teacherId,
  editingAssignment,
  existingTopics,
  onClose,
  onSaved,
}: {
  open: boolean;
  classId: string;
  teacherId: string;
  editingAssignment?: Assignment | null;
  existingTopics: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<AssignmentType>('assignment');
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [instructions, setInstructions] = useState('');
  const [maxPoints, setMaxPoints] = useState<number>(100);
  const [dueDate, setDueDate] = useState('');
  const [resourceLink, setResourceLink] = useState('');
  const [resourceLabel, setResourceLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setType(editingAssignment?.type || 'assignment');
      setTitle(editingAssignment?.title || '');
      setTopic(editingAssignment?.topic || '');
      setInstructions(editingAssignment?.instructions || '');
      setMaxPoints(editingAssignment?.maxPoints ?? 100);
      setDueDate(editingAssignment?.dueDate || '');
      setResourceLink(editingAssignment?.resourceLink || '');
      setResourceLabel(editingAssignment?.resourceLabel || '');
      setError(null);
    }
  }, [open, editingAssignment]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Judul wajib diisi.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        type,
        title,
        topic,
        instructions,
        maxPoints: type === 'material' ? 0 : maxPoints,
        dueDate: type === 'material' ? '' : dueDate,
        resourceLink,
        resourceLabel,
      };
      if (editingAssignment) {
        await updateAssignment(classId, editingAssignment, payload);
      } else {
        await createAssignment(classId, teacherId, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan tugas.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-modal-title"
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="assignment-modal-title" className="font-display text-lg font-semibold text-slate-900">
            {editingAssignment ? 'Sunting Tugas / Materi' : 'Buat Tugas atau Materi Baru'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Jenis Konten</label>
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {[
                { id: 'assignment' as AssignmentType, label: 'Tugas' },
                { id: 'quiz' as AssignmentType, label: 'Kuis / Evaluasi' },
                { id: 'material' as AssignmentType, label: 'Materi Bacaan' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setType(opt.id)}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    type === opt.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Judul <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Laporan Praktikum Struktur Pohon Biner"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Topik / Modul
              </label>
              <input
                type="text"
                list="topic-suggestions"
                maxLength={60}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Contoh: Pertemuan 3 — Graf & Tree"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
              />
              <datalist id="topic-suggestions">
                {existingTopics.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            {type !== 'material' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Poin Maksimal
                </label>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={maxPoints}
                  onChange={(e) => setMaxPoints(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 font-mono tabular-nums text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
                />
              </div>
            )}
          </div>

          {type !== 'material' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Tenggat Waktu (Opsional)
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 font-mono tabular-nums text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Instruksi / Penjelasan
            </label>
            <textarea
              rows={4}
              maxLength={4000}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Tuliskan langkah pengerjaan, format pengumpulan, dan kriteria penilaian..."
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Tautan Lampiran / Modul (Opsional)
              </label>
              <input
                type="text"
                maxLength={500}
                value={resourceLink}
                onChange={(e) => setResourceLink(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Label Tautan (Opsional)
              </label>
              <input
                type="text"
                maxLength={100}
                value={resourceLabel}
                onChange={(e) => setResourceLabel(e.target.value)}
                placeholder="Contoh: Slide Materi PDF"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {submitting ? 'Menyimpan...' : editingAssignment ? 'Simpan Perubahan' : 'Terbitkan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
