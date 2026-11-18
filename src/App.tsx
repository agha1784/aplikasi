import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { Menu, Plus, UserPlus } from 'lucide-react';
import { AuthLanding } from './components/AuthLanding';
import { ClassWorkspace } from './components/ClassWorkspace';
import { DashboardGrid } from './components/DashboardGrid';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CreateClassModal, JoinClassModal } from './components/Modals';
import { ActiveNavView, Sidebar } from './components/Sidebar';
import { CalendarView, TodoView } from './components/TodoAndCalendar';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './lib/firebase';
import { syncUserProfile, updateRolePreference } from './services/classroomService';
import { Classroom, Enrollment, MemberRole, RolePreference } from './types/classroom';

function ClassroomApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [rolePreference, setRolePreference] = useState<RolePreference>('both');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [classesById, setClassesById] = useState<Record<string, Classroom>>({});
  const [loadingClasses, setLoadingClasses] = useState(true);

  const [activeView, setActiveView] = useState<ActiveNavView>('home');
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [deepLinkAssignmentId, setDeepLinkAssignmentId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [createClassOpen, setCreateClassOpen] = useState(false);
  const [joinClassOpen, setJoinClassOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const resolvedRole = await syncUserProfile(firebaseUser);
          setRolePreference(resolvedRole);
        } catch (err) {
          console.error('Failed to sync profile:', err);
        }
      } else {
        setEnrollments([]);
        setClassesById({});
        setActiveView('home');
        setActiveClassId(null);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Subscribe to user's enrollments once authenticated
  useEffect(() => {
    if (!authReady || !user) return;
    setLoadingClasses(true);
    const path = `users/${user.uid}/enrollments`;
    const unsub = onSnapshot(
      collection(db, 'users', user.uid, 'enrollments'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Enrollment);
        setEnrollments(list);
        if (list.length === 0) {
          setClassesById({});
          setLoadingClasses(false);
        }
      },
      (err) => {
        setLoadingClasses(false);
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );
    return () => unsub();
  }, [authReady, user]);

  // Subscribe to each enrolled classroom doc
  useEffect(() => {
    if (!authReady || !user || enrollments.length === 0) return;

    const unsubs = enrollments.map((enr) => {
      const classPath = `classes/${enr.classId}`;
      return onSnapshot(
        doc(db, 'classes', enr.classId),
        (snap) => {
          setClassesById((prev) => {
            const next = { ...prev };
            if (snap.exists()) {
              next[enr.classId] = snap.data() as Classroom;
            } else {
              delete next[enr.classId];
            }
            return next;
          });
          setLoadingClasses(false);
        },
        (err) => {
          setLoadingClasses(false);
          handleFirestoreError(err, OperationType.GET, classPath);
        }
      );
    });

    return () => unsubs.forEach((u) => u());
  }, [authReady, user, enrollments.map((e) => e.classId).join(',')]);

  async function handleSignIn(preferredRole: RolePreference) {
    setSigningIn(true);
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const resolved = await syncUserProfile(cred.user, preferredRole);
      setRolePreference(resolved);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal masuk dengan Google.';
      if (!message.includes('popup-closed-by-user')) {
        setAuthError('Tidak dapat menyelesaikan proses masuk Google. Silakan coba lagi.');
      }
    } finally {
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    await signOut(auth);
  }

  async function handleChangeRolePreference(role: RolePreference) {
    if (!user) return;
    setRolePreference(role);
    await updateRolePreference(user, role);
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="font-display text-lg font-bold text-slate-900">RuangKelas</p>
          <p className="text-sm text-slate-500">Memuat ruang belajar Anda...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthLanding
        onSignIn={handleSignIn}
        signingIn={signingIn}
        authError={authError}
      />
    );
  }

  const rolesByClassId: Record<string, MemberRole> = {};
  enrollments.forEach((e) => {
    rolesByClassId[e.classId] = e.role;
  });

  const allClasses = enrollments
    .map((e) => classesById[e.classId])
    .filter((c): c is Classroom => Boolean(c))
    .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

  const activeClasses = allClasses.filter((c) => !c.archived);
  const archivedClasses = allClasses.filter((c) => c.archived);
  const teachingClasses = activeClasses.filter((c) => rolesByClassId[c.id] === 'teacher');
  const enrolledClasses = activeClasses.filter((c) => rolesByClassId[c.id] === 'student');

  const selectedClass = activeClassId ? classesById[activeClassId] || null : null;

  function openClass(classId: string, assignmentId?: string) {
    setActiveClassId(classId);
    setDeepLinkAssignmentId(assignmentId || null);
    setActiveView('class');
  }

  const viewTitle =
    activeView === 'class' && selectedClass
      ? selectedClass.title
      : activeView === 'todo'
        ? 'Daftar Tugas Lintas Kelas'
        : activeView === 'calendar'
          ? 'Kalender Tenggat Tugas'
          : activeView === 'archive'
            ? 'Kelas Diarsipkan'
            : 'Beranda Kelas';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar
        user={user}
        rolePreference={rolePreference}
        onChangeRolePreference={handleChangeRolePreference}
        activeView={activeView}
        activeClassId={activeClassId}
        teachingClasses={teachingClasses}
        enrolledClasses={enrolledClasses}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onSelectView={(view, classId) => {
          setActiveView(view);
          if (classId) {
            setActiveClassId(classId);
            setDeepLinkAssignmentId(null);
          } else if (view !== 'class') {
            setActiveClassId(null);
            setDeepLinkAssignmentId(null);
          }
        }}
        onSignOut={handleSignOut}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Workspace Header */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <button
                type="button"
                onClick={() => {
                  setActiveView('home');
                  setActiveClassId(null);
                }}
                className="text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 hidden sm:inline"
              >
                RuangKelas
              </button>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-display text-base sm:text-lg font-semibold text-slate-900 truncate">
                {viewTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setJoinClassOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>Gabung Kelas</span>
            </button>

            <button
              type="button"
              onClick={() => setCreateClassOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Kelas</span>
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-8 py-6 sm:py-8">
          {activeView === 'home' && (
            <DashboardGrid
              classes={activeClasses}
              rolesByClassId={rolesByClassId}
              isArchiveView={false}
              loading={loadingClasses}
              onOpenClass={(id) => openClass(id)}
              onCreateClass={() => setCreateClassOpen(true)}
              onJoinClass={() => setJoinClassOpen(true)}
            />
          )}

          {activeView === 'archive' && (
            <DashboardGrid
              classes={archivedClasses}
              rolesByClassId={rolesByClassId}
              isArchiveView={true}
              loading={loadingClasses}
              onOpenClass={(id) => openClass(id)}
              onCreateClass={() => setCreateClassOpen(true)}
              onJoinClass={() => setJoinClassOpen(true)}
            />
          )}

          {activeView === 'todo' && (
            <TodoView
              user={user}
              classes={allClasses}
              rolesByClassId={rolesByClassId}
              onOpenAssignment={(classId, assignmentId) => openClass(classId, assignmentId)}
            />
          )}

          {activeView === 'calendar' && (
            <CalendarView
              classes={allClasses}
              onOpenAssignment={(classId, assignmentId) => openClass(classId, assignmentId)}
            />
          )}

          {activeView === 'class' && selectedClass && (
            <ClassWorkspace
              classroom={selectedClass}
              user={user}
              role={rolesByClassId[selectedClass.id] || 'student'}
              initialAssignmentId={deepLinkAssignmentId}
              onClearInitialAssignment={() => setDeepLinkAssignmentId(null)}
              onLeftClass={() => {
                setActiveView('home');
                setActiveClassId(null);
              }}
            />
          )}
        </main>
      </div>

      <CreateClassModal
        open={createClassOpen}
        user={user}
        onClose={() => setCreateClassOpen(false)}
        onSaved={(newId) => {
          if (newId) openClass(newId);
        }}
      />

      <JoinClassModal
        open={joinClassOpen}
        user={user}
        onClose={() => setJoinClassOpen(false)}
        onJoined={(joinedId) => openClass(joinedId)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ClassroomApp />
    </ErrorBoundary>
  );
}
