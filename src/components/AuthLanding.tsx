import { useState } from 'react';
import { ArrowRight, BookOpenCheck, CheckCircle2, FolderKanban, MessagesSquare, ShieldCheck } from 'lucide-react';
import { BANNER_THEMES, RolePreference } from '../types/classroom';

interface AuthLandingProps {
  onSignIn: (preferredRole: RolePreference) => Promise<void>;
  signingIn: boolean;
  authError: string | null;
}

export function AuthLanding({ onSignIn, signingIn, authError }: AuthLandingProps) {
  const [selectedRole, setSelectedRole] = useState<RolePreference>('both');
  const [heroImgError, setHeroImgError] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            RuangKelas
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#fitur"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Fitur Utama
            </a>
            <a
              href="#alur-pengajar"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Untuk Pengajar
            </a>
            <a
              href="#alur-siswa"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Untuk Siswa
            </a>
            <a
              href="#keamanan"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Privasi Data
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              disabled={signingIn}
              onClick={() => void onSignIn(selectedRole)}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              {signingIn ? 'Memproses...' : 'Masuk dengan Google'}
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Section */}
        <section className="max-w-[1440px] mx-auto px-6 lg:px-10 pt-10 pb-14 lg:pt-14 lg:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center py-2">
              <p className="text-sm font-medium text-blue-700 mb-3">
                Platform Pembelajaran &amp; Tugas Daring
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12] [text-wrap:balance] mb-5">
                Kelola kelas, tugas, dan diskusi siswa dalam satu ruang terpadu.
              </h1>
              <p className="text-base text-slate-600 leading-relaxed max-w-xl mb-8">
                RuangKelas membantu pengajar mendistribusikan materi, memantau pengumpulan
                tugas secara langsung, memberi nilai beserta umpan balik privat, dan menjaga
                interaksi kelas tetap tertata.
              </p>

              {/* Interactive Role Focus Selector */}
              <div className="mb-6">
                <p className="text-xs font-medium text-slate-500 mb-2">
                  Fokus peran awal Anda (dapat diubah kapan saja):
                </p>
                <div className="inline-flex items-center gap-1 p-1 bg-slate-200/75 rounded-lg">
                  {[
                    { id: 'both' as RolePreference, label: 'Pengajar & Siswa' },
                    { id: 'teacher' as RolePreference, label: 'Pengajar' },
                    { id: 'student' as RolePreference, label: 'Siswa' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedRole(option.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        selectedRole === option.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {authError && (
                <div
                  role="alert"
                  className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800"
                >
                  {authError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  disabled={signingIn}
                  onClick={() => void onSignIn(selectedRole)}
                  className="inline-flex items-center gap-2.5 px-6 py-3 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  <span>{signingIn ? 'Menghubungkan Akun...' : 'Mulai dengan Akun Google'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <span className="text-xs text-slate-500">
                  Masuk instan · Sinkronisasi real-time · Gratis untuk pengajar &amp; siswa
                </span>
              </div>
            </div>

            <div className="lg:col-span-6 flex">
              <div className="relative w-full min-h-[320px] lg:min-h-[420px] rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
                {!heroImgError ? (
                  <img
                    src={BANNER_THEMES.informatika.imageUrl}
                    alt="Suasana meja kerja studio perkuliahan dan rekayasa digital RuangKelas"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgError(true)}
                    className="w-full h-full lg:h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-950 via-slate-800 to-slate-900" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 text-white">
                  <p className="text-xs font-mono text-blue-200 mb-1.5">
                    Kode Kelas · KLS84M · Semester Ganjil
                  </p>
                  <h2 className="font-display text-xl sm:text-2xl font-semibold text-white mb-2">
                    Forum Diskusi, Penugasan, dan Buku Nilai Terintegrasi
                  </h2>
                  <p className="text-sm text-slate-200 max-w-lg leading-relaxed">
                    Bagikan kode 6 karakter kepada siswa untuk bergabung seketika, unggah materi
                    per topik, dan nilai pengumpulan dengan komentar privat satu-lawan-satu.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4-column summary strip */}
          <div
            id="fitur"
            className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200"
          >
            <div className="p-6">
              <MessagesSquare className="w-5 h-5 text-blue-700 mb-3" />
              <h3 className="font-display text-base font-semibold text-slate-900 mb-1.5">
                Forum Kelas Langsung
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Pengumuman penting dapat disematkan di atas, lengkap dengan diskusi komentar
                antara pengajar dan siswa.
              </p>
            </div>
            <div className="p-6">
              <FolderKanban className="w-5 h-5 text-blue-700 mb-3" />
              <h3 className="font-display text-base font-semibold text-slate-900 mb-1.5">
                Tugas &amp; Materi per Topik
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Kelompokkan tugas, kuis, dan bahan bacaan berdasarkan modul, tenggat waktu, dan
                bobot poin maksimal.
              </p>
            </div>
            <div className="p-6">
              <BookOpenCheck className="w-5 h-5 text-blue-700 mb-3" />
              <h3 className="font-display text-base font-semibold text-slate-900 mb-1.5">
                Penilaian &amp; Revisi
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Periksa jawaban siswa, berikan skor numerik, kembalikan untuk revisi, dan tulis
                catatan evaluasi privat.
              </p>
            </div>
            <div className="p-6">
              <ShieldCheck className="w-5 h-5 text-blue-700 mb-3" />
              <h3 className="font-display text-base font-semibold text-slate-900 mb-1.5">
                Isolasi Data Ketat
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Setiap jawaban tugas, nilai, dan komentar pribadi hanya dapat diakses oleh siswa
                terkait dan pengajar kelas.
              </p>
            </div>
          </div>
        </section>

        {/* Teacher & Student Workflows */}
        <section className="max-w-[1440px] mx-auto px-6 lg:px-10 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div id="alur-pengajar" className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
              <p className="text-xs font-medium text-slate-500 mb-1">Alur Kerja Pengajar</p>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-4">
                Kendali penuh dari materi hingga rekap nilai
              </h2>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span>Buat kelas baru dan dapatkan kode undangan unik 6 karakter otomatis.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span>Terbitkan tugas dengan tenggat waktu, poin maksimal, dan tautan referensi.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span>Pantau status kumpul siswa secara real-time dan isi buku nilai kelas.</span>
                </li>
              </ul>
            </div>

            <div id="alur-siswa" className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
              <p className="text-xs font-medium text-slate-500 mb-1">Alur Kerja Siswa</p>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-4">
                Fokus pada tenggat dan umpan balik pengajar
              </h2>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
                  <span>Gabung ke kelas cukup dengan memasukkan kode kelas dari pengajar.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
                  <span>Lihat daftar tugas lintas kelas agar tidak ada tenggat yang terlewat.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
                  <span>Kumpulkan jawaban teks atau tautan dokumen, lalu diskusikan nilai secara privat.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer id="keamanan" className="border-t border-slate-200 bg-white">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>RuangKelas · Sistem Pembelajaran &amp; Penugasan Daring</span>
          <span>Akses kelas berbasis keanggotaan terverifikasi &amp; pemisahan data nilai siswa</span>
        </div>
      </footer>
    </div>
  );
}
