import { useState } from 'react';
import { Archive, ArchiveRestore, BookOpen, Check, Copy, Plus, Search, UserPlus } from 'lucide-react';
import { updateClassroom } from '../services/classroomService';
import { Classroom, MemberRole } from '../types/classroom';
import { ClassBanner, UserAvatar } from './BannerImage';

interface DashboardGridProps {
  classes: Classroom[];
  rolesByClassId: Record<string, MemberRole>;
  isArchiveView: boolean;
  loading: boolean;
  onOpenClass: (classId: string) => void;
  onCreateClass: () => void;
  onJoinClass: () => void;
}

export function DashboardGrid({
  classes,
  rolesByClassId,
  isArchiveView,
  loading,
  onOpenClass,
  onCreateClass,
  onJoinClass,
}: DashboardGridProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'teacher' | 'student'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = classes.filter((cls) => {
    const role = rolesByClassId[cls.id] || 'student';
    if (roleFilter !== 'all' && role !== roleFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      cls.title.toLowerCase().includes(q) ||
      cls.subject.toLowerCase().includes(q) ||
      cls.section.toLowerCase().includes(q) ||
      cls.teacherName.toLowerCase().includes(q) ||
      cls.code.toLowerCase().includes(q)
    );
  });

  async function handleCopyCode(e: React.MouseEvent, cls: Classroom) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(cls.code);
      setCopiedId(cls.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard blocked in some browsers
    }
  }

  async function handleToggleArchive(e: React.MouseEvent, cls: Classroom) {
    e.stopPropagation();
    setBusyId(cls.id);
    try {
      await updateClassroom(cls, { archived: !cls.archived });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {[1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="bg-white border border-slate-200 rounded-xl overflow-hidden animate-pulse"
          >
            <div className="h-32 bg-slate-200" />
            <div className="p-5 space-y-3">
              <div className="h-4 bg-slate-200 rounded w-2/3" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar: Search + Segmented Role Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama kelas, mata pelajaran, pengajar, atau kode..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
          />
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          {[
            { id: 'all' as const, label: 'Semua Kelas' },
            { id: 'teacher' as const, label: 'Mengajar' },
            { id: 'student' as const, label: 'Terdaftar' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoleFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                roleFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-xl mx-auto mt-8">
          <BookOpen className="w-9 h-9 text-slate-400 mx-auto mb-3" />
          <h2 className="font-display text-lg font-semibold text-slate-900 mb-1.5">
            {isArchiveView
              ? 'Belum ada kelas yang diarsipkan'
              : classes.length === 0
                ? 'Anda belum tergabung di kelas mana pun'
                : 'Tidak ada kelas yang cocok dengan filter'}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            {isArchiveView
              ? 'Kelas yang selesai masa belajarnya dapat diarsipkan agar daftar beranda tetap rapi.'
              : classes.length === 0
                ? 'Mulai dengan membuat kelas baru sebagai pengajar, atau masukkan kode kelas 6 karakter untuk bergabung sebagai siswa.'
                : 'Coba ubah kata kunci pencarian atau pilih tab peran lainnya.'}
          </p>
          {!isArchiveView && classes.length === 0 && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onCreateClass}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Kelas Baru</span>
              </button>
              <button
                type="button"
                onClick={onJoinClass}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>Gabung dengan Kode</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((cls) => {
            const role = rolesByClassId[cls.id] || 'student';
            const isTeacher = role === 'teacher';
            const metadataParts = [
              isTeacher ? 'Pengajar' : 'Siswa',
              cls.subject,
              cls.room,
            ].filter(Boolean);

            return (
              <article
                key={cls.id}
                onClick={() => onOpenClass(cls.id)}
                className="group bg-white border border-slate-200 hover:border-slate-300 rounded-xl overflow-hidden cursor-pointer transition-colors flex flex-col"
              >
                <div className="relative h-32 bg-slate-900 overflow-hidden">
                  <ClassBanner bannerKey={cls.bannerKey} alt={cls.title} />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <h3 className="font-display text-lg font-semibold leading-snug truncate group-hover:underline underline-offset-2">
                      {cls.title}
                    </h3>
                    <p className="text-xs text-slate-200 truncate mt-0.5">
                      {cls.section || cls.subject || 'Kelas Daring'}
                    </p>
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500 truncate">
                      {metadataParts.join(' · ')}
                    </p>
                    {cls.description ? (
                      <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                        {cls.description}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-400">
                        Klik untuk membuka forum diskusi dan daftar tugas kelas.
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar
                        name={cls.teacherName}
                        photoURL={cls.teacherPhotoURL}
                        size="sm"
                      />
                      <span className="text-xs font-medium text-slate-700 truncate">
                        {cls.teacherName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => void handleCopyCode(e, cls)}
                        title={`Salin kode kelas ${cls.code}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono tabular-nums text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                      >
                        {copiedId === cls.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>{cls.code}</span>
                          </>
                        )}
                      </button>

                      {isTeacher && (
                        <button
                          type="button"
                          disabled={busyId === cls.id}
                          onClick={(e) => void handleToggleArchive(e, cls)}
                          title={cls.archived ? 'Pulihkan kelas' : 'Arsipkan kelas'}
                          aria-label={cls.archived ? 'Pulihkan kelas' : 'Arsipkan kelas'}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          {cls.archived ? (
                            <ArchiveRestore className="w-4 h-4" />
                          ) : (
                            <Archive className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
