import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { CalendarDays, CheckSquare, Clock, FileText } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  Assignment,
  Classroom,
  formatDueDateId,
  isDueSoonOrOverdue,
  MemberRole,
  Submission,
} from '../types/classroom';

interface CrossClassItem {
  assignment: Assignment;
  classroom: Classroom;
  role: MemberRole;
  mySubmission?: Submission | null;
  pendingGradingCount?: number;
  submittedCount?: number;
}

export function TodoView({
  user,
  classes,
  rolesByClassId,
  onOpenAssignment,
}: {
  user: User;
  classes: Classroom[];
  rolesByClassId: Record<string, MemberRole>;
  onOpenAssignment: (classId: string, assignmentId: string) => void;
}) {
  const [assignmentsByClass, setAssignmentsByClass] = useState<Record<string, Assignment[]>>({});
  const [mySubsByAssignment, setMySubsByAssignment] = useState<Record<string, Submission | null>>({});
  const [teacherSubsByAssignment, setTeacherSubsByAssignment] = useState<Record<string, Submission[]>>({});
  const [mode, setMode] = useState<'student' | 'teacher'>(() => {
    const teachesAny = classes.some((c) => rolesByClassId[c.id] === 'teacher');
    const studiesAny = classes.some((c) => rolesByClassId[c.id] !== 'teacher');
    if (teachesAny && !studiesAny) return 'teacher';
    return 'student';
  });
  const [studentTab, setStudentTab] = useState<'assigned' | 'overdue' | 'done'>('assigned');

  const activeClasses = classes.filter((c) => !c.archived);

  // Subscribe to assignments across active classes
  useEffect(() => {
    if (activeClasses.length === 0) {
      setAssignmentsByClass({});
      return;
    }

    const unsubs = activeClasses.map((cls) => {
      const path = `classes/${cls.id}/assignments`;
      return onSnapshot(
        collection(db, 'classes', cls.id, 'assignments'),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as Assignment);
          setAssignmentsByClass((prev) => ({ ...prev, [cls.id]: list }));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, path)
      );
    });

    return () => unsubs.forEach((u) => u());
  }, [activeClasses.map((c) => c.id).join(',')]);

  // Subscribe to submissions for student or teacher items
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    activeClasses.forEach((cls) => {
      const role = rolesByClassId[cls.id] || 'student';
      const asgs = (assignmentsByClass[cls.id] || []).filter((a) => a.type !== 'material');
      asgs.forEach((asg) => {
        if (role === 'student') {
          const subPath = `classes/${cls.id}/assignments/${asg.id}/submissions/${user.uid}`;
          unsubs.push(
            onSnapshot(
              doc(db, 'classes', cls.id, 'assignments', asg.id, 'submissions', user.uid),
              (snap) => {
                setMySubsByAssignment((prev) => ({
                  ...prev,
                  [asg.id]: snap.exists() ? (snap.data() as Submission) : null,
                }));
              },
              (err) => handleFirestoreError(err, OperationType.GET, subPath)
            )
          );
        } else {
          const listPath = `classes/${cls.id}/assignments/${asg.id}/submissions`;
          const q = query(
            collection(db, 'classes', cls.id, 'assignments', asg.id, 'submissions'),
            where('teacherId', '==', user.uid)
          );
          unsubs.push(
            onSnapshot(
              q,
              (snap) => {
                setTeacherSubsByAssignment((prev) => ({
                  ...prev,
                  [asg.id]: snap.docs.map((d) => d.data() as Submission),
                }));
              },
              (err) => handleFirestoreError(err, OperationType.LIST, listPath)
            )
          );
        }
      });
    });

    return () => unsubs.forEach((u) => u());
  }, [activeClasses.map((c) => c.id).join(','), assignmentsByClass, rolesByClassId, user.uid]);

  const items: CrossClassItem[] = [];
  activeClasses.forEach((cls) => {
    const role = rolesByClassId[cls.id] || 'student';
    const asgs = (assignmentsByClass[cls.id] || []).filter((a) => a.type !== 'material');
    asgs.forEach((asg) => {
      if (role === 'student') {
        items.push({
          assignment: asg,
          classroom: cls,
          role,
          mySubmission: mySubsByAssignment[asg.id] || null,
        });
      } else {
        const subs = teacherSubsByAssignment[asg.id] || [];
        items.push({
          assignment: asg,
          classroom: cls,
          role,
          submittedCount: subs.filter((s) => s.status === 'submitted' || s.status === 'graded').length,
          pendingGradingCount: subs.filter((s) => s.status === 'submitted').length,
        });
      }
    });
  });

  const hasTeacherClasses = activeClasses.some((c) => rolesByClassId[c.id] === 'teacher');
  const hasStudentClasses = activeClasses.some((c) => rolesByClassId[c.id] !== 'teacher');

  const studentItems = items.filter((i) => i.role === 'student');
  const teacherItems = items.filter((i) => i.role === 'teacher');

  const filteredStudentItems = studentItems.filter((item) => {
    const sub = item.mySubmission;
    const isDone = sub?.status === 'submitted' || sub?.status === 'graded';
    const dueState = isDueSoonOrOverdue(item.assignment.dueDate);
    if (studentTab === 'done') return isDone;
    if (studentTab === 'overdue') return !isDone && dueState === 'overdue';
    return !isDone && dueState !== 'overdue';
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {hasTeacherClasses && hasStudentClasses && (
          <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setMode('student')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === 'student'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tugas Saya (Siswa)
            </button>
            <button
              type="button"
              onClick={() => setMode('teacher')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === 'teacher'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Perlu Diperiksa (Pengajar)
            </button>
          </div>
        )}

        {mode === 'student' && (
          <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
            {[
              { id: 'assigned' as const, label: 'Ditugaskan' },
              { id: 'overdue' as const, label: 'Terlewat' },
              { id: 'done' as const, label: 'Selesai' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setStudentTab(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  studentTab === t.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === 'student' ? (
        filteredStudentItems.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <CheckSquare className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <h3 className="font-display text-base font-semibold text-slate-900 mb-1">
              Tidak ada tugas di kategori ini
            </h3>
            <p className="text-sm text-slate-500">
              Semua tugas dari kelas yang Anda ikuti akan muncul otomatis di sini.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {filteredStudentItems.map(({ assignment, classroom, mySubmission }) => (
              <button
                key={`${classroom.id}-${assignment.id}`}
                type="button"
                onClick={() => onOpenAssignment(classroom.id, assignment.id)}
                className="w-full p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <FileText className="w-4 h-4 text-blue-700 mt-1 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {assignment.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      {[
                        classroom.title,
                        assignment.dueDate
                          ? `Tenggat ${formatDueDateId(assignment.dueDate)}`
                          : 'Tanpa tenggat',
                      ].join(' · ')}
                    </p>
                  </div>
                </div>

                <span className="font-mono tabular-nums text-xs font-semibold text-slate-700 shrink-0">
                  {mySubmission?.status === 'graded'
                    ? `${mySubmission.grade} / ${assignment.maxPoints}`
                    : mySubmission?.status === 'submitted'
                      ? 'Diserahkan'
                      : mySubmission?.status === 'returned'
                        ? 'Revisi'
                        : 'Belum kumpul'}
                </span>
              </button>
            ))}
          </div>
        )
      ) : teacherItems.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <CheckSquare className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <h3 className="font-display text-base font-semibold text-slate-900 mb-1">
            Belum ada tugas yang diterbitkan
          </h3>
          <p className="text-sm text-slate-500">
            Buat tugas di salah satu kelas Anda untuk memantau pengumpulan siswa di sini.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {teacherItems.map(({ assignment, classroom, submittedCount, pendingGradingCount }) => (
            <button
              key={`${classroom.id}-${assignment.id}`}
              type="button"
              onClick={() => onOpenAssignment(classroom.id, assignment.id)}
              className="w-full p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{assignment.title}</p>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {classroom.title}
                  {assignment.dueDate ? ` · Tenggat ${formatDueDateId(assignment.dueDate)}` : ''}
                </p>
              </div>
              <div className="text-xs font-mono tabular-nums shrink-0 text-right">
                <span className="font-semibold text-blue-700">
                  {pendingGradingCount || 0} menunggu nilai
                </span>
                <span className="text-slate-400"> · </span>
                <span className="text-slate-600">{submittedCount || 0} terkumpul</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CalendarView({
  classes,
  onOpenAssignment,
}: {
  classes: Classroom[];
  onOpenAssignment: (classId: string, assignmentId: string) => void;
}) {
  const [assignmentsByClass, setAssignmentsByClass] = useState<Record<string, Assignment[]>>({});
  const activeClasses = classes.filter((c) => !c.archived);

  useEffect(() => {
    if (activeClasses.length === 0) {
      setAssignmentsByClass({});
      return;
    }

    const unsubs = activeClasses.map((cls) => {
      const path = `classes/${cls.id}/assignments`;
      return onSnapshot(
        collection(db, 'classes', cls.id, 'assignments'),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as Assignment);
          setAssignmentsByClass((prev) => ({ ...prev, [cls.id]: list }));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, path)
      );
    });

    return () => unsubs.forEach((u) => u());
  }, [activeClasses.map((c) => c.id).join(',')]);

  const scheduled = activeClasses
    .flatMap((cls) =>
      (assignmentsByClass[cls.id] || [])
        .filter((a) => Boolean(a.dueDate))
        .map((a) => ({ classroom: cls, assignment: a }))
    )
    .sort((a, b) => new Date(a.assignment.dueDate).getTime() - new Date(b.assignment.dueDate).getTime());

  if (scheduled.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-xl">
        <CalendarDays className="w-8 h-8 text-slate-400 mx-auto mb-3" />
        <h3 className="font-display text-base font-semibold text-slate-900 mb-1">
          Belum ada jadwal tenggat tugas
        </h3>
        <p className="text-sm text-slate-500">
          Tugas yang memiliki tanggal tenggat akan tersusun secara kronologis di kalender ini.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
      {scheduled.map(({ classroom, assignment }) => {
        const dueState = isDueSoonOrOverdue(assignment.dueDate);
        return (
          <button
            key={`${classroom.id}-${assignment.id}`}
            type="button"
            onClick={() => onOpenAssignment(classroom.id, assignment.id)}
            className="w-full p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-start gap-3 min-w-0">
              <Clock
                className={`w-4 h-4 mt-1 shrink-0 ${
                  dueState === 'overdue'
                    ? 'text-red-600'
                    : dueState === 'soon'
                      ? 'text-amber-600'
                      : 'text-blue-700'
                }`}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{assignment.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {classroom.title}
                  {assignment.topic ? ` · ${assignment.topic}` : ''}
                </p>
              </div>
            </div>

            <span
              className={`font-mono tabular-nums text-xs font-medium shrink-0 ${
                dueState === 'overdue'
                  ? 'text-red-700'
                  : dueState === 'soon'
                    ? 'text-amber-700'
                    : 'text-slate-600'
              }`}
            >
              {formatDueDateId(assignment.dueDate)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
