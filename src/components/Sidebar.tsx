import { User } from 'firebase/auth';
import {
  Archive,
  CalendarDays,
  CheckSquare,
  GraduationCap,
  Home,
  LogOut,
  X,
} from 'lucide-react';
import { BANNER_THEMES, Classroom, RolePreference } from '../types/classroom';
import { UserAvatar } from './BannerImage';

export type ActiveNavView = 'home' | 'todo' | 'calendar' | 'archive' | 'class';

interface SidebarProps {
  user: User;
  rolePreference: RolePreference;
  onChangeRolePreference: (role: RolePreference) => Promise<void>;
  activeView: ActiveNavView;
  activeClassId: string | null;
  teachingClasses: Classroom[];
  enrolledClasses: Classroom[];
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectView: (view: ActiveNavView, classId?: string) => void;
  onSignOut: () => Promise<void>;
}

export function Sidebar({
  user,
  rolePreference,
  onChangeRolePreference,
  activeView,
  activeClassId,
  teachingClasses,
  enrolledClasses,
  mobileOpen,
  onCloseMobile,
  onSelectView,
  onSignOut,
}: SidebarProps) {
  const navItems: { id: ActiveNavView; label: string; icon: typeof Home }[] = [
    { id: 'home', label: 'Beranda Kelas', icon: Home },
    { id: 'todo', label: 'Daftar Tugas', icon: CheckSquare },
    { id: 'calendar', label: 'Kalender Tenggat', icon: CalendarDays },
    { id: 'archive', label: 'Kelas Diarsipkan', icon: Archive },
  ];

  const content = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-[264px]">
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 shrink-0">
        <button
          type="button"
          onClick={() => {
            onSelectView('home');
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-blue-700 rounded-md"
        >
          <GraduationCap className="w-5 h-5 text-blue-700 shrink-0" />
          <span className="font-display text-lg font-bold tracking-tight text-slate-900">
            RuangKelas
          </span>
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Tutup menu navigasi"
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <nav aria-label="Navigasi utama" className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectView(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors text-left ${
                  active
                    ? 'bg-blue-50 text-blue-800'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-700' : 'text-slate-500'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {teachingClasses.length > 0 && (
          <div>
            <p className="px-3 mb-2 text-xs font-medium text-slate-500">
              Mengajar ({teachingClasses.length})
            </p>
            <div className="space-y-0.5">
              {teachingClasses.map((cls) => {
                const active = activeView === 'class' && activeClassId === cls.id;
                const accent = BANNER_THEMES[cls.bannerKey]?.accentColor || '#1D4ED8';
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => {
                      onSelectView('class', cls.id);
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      active
                        ? 'bg-slate-100 text-slate-900 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="w-6 h-6 rounded-md text-[11px] font-semibold text-white flex items-center justify-center shrink-0"
                      style={{ backgroundColor: accent }}
                    >
                      {cls.title.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{cls.title}</p>
                      {cls.section && (
                        <p className="text-[11px] text-slate-500 truncate">{cls.section}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {enrolledClasses.length > 0 && (
          <div>
            <p className="px-3 mb-2 text-xs font-medium text-slate-500">
              Terdaftar ({enrolledClasses.length})
            </p>
            <div className="space-y-0.5">
              {enrolledClasses.map((cls) => {
                const active = activeView === 'class' && activeClassId === cls.id;
                const accent = BANNER_THEMES[cls.bannerKey]?.accentColor || '#0F766E';
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => {
                      onSelectView('class', cls.id);
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      active
                        ? 'bg-slate-100 text-slate-900 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="w-6 h-6 rounded-md text-[11px] font-semibold text-white flex items-center justify-center shrink-0"
                      style={{ backgroundColor: accent }}
                    >
                      {cls.title.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{cls.title}</p>
                      {cls.section && (
                        <p className="text-[11px] text-slate-500 truncate">{cls.section}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-200 space-y-3 shrink-0 bg-slate-50/70">
        <div>
          <label htmlFor="role-pref-select" className="block text-[11px] font-medium text-slate-500 mb-1">
            Tampilan Peran
          </label>
          <select
            id="role-pref-select"
            value={rolePreference}
            onChange={(e) => void onChangeRolePreference(e.target.value as RolePreference)}
            className="w-full px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-700"
          >
            <option value="both">Pengajar &amp; Siswa</option>
            <option value="teacher">Fokus Pengajar</option>
            <option value="student">Fokus Siswa</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserAvatar
              name={user.displayName || user.email || 'Pengguna'}
              photoURL={user.photoURL || ''}
              size="sm"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {user.displayName || 'Pengguna'}
              </p>
              <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void onSignOut()}
            title="Keluar akun"
            aria-label="Keluar akun"
            className="p-2 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0">{content}</aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
}
