import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Lock,
  Send,
  Trash2,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  addComment,
  deleteComment,
  gradeStudentSubmission,
  saveStudentSubmission,
} from '../services/classroomService';
import {
  Assignment,
  ClassMember,
  Classroom,
  CommentItem,
  formatDueDateId,
  formatTimestampId,
  isDueSoonOrOverdue,
  MemberRole,
  Submission,
} from '../types/classroom';
import { UserAvatar } from './BannerImage';

interface AssignmentDetailViewProps {
  classroom: Classroom;
  assignment: Assignment;
  user: User;
  role: MemberRole;
  members: ClassMember[];
  onBack: () => void;
}

const SUBMISSION_STATUS_TEXT: Record<string, string> = {
  missing: 'Belum dikumpulkan',
  draft: 'Draf tersimpan',
  submitted: 'Diserahkan',
  returned: 'Dikembalikan untuk revisi',
  graded: 'Sudah dinilai',
};

export function AssignmentDetailView({
  classroom,
  assignment,
  user,
  role,
  members,
  onBack,
}: AssignmentDetailViewProps) {
  const isTeacher = role === 'teacher';
  const students = members.filter((m) => m.role === 'student');

  // Public comments on this assignment
  const [publicComments, setPublicComments] = useState<CommentItem[]>([]);
  const [publicCommentBody, setPublicCommentBody] = useState('');
  const [postingPublic, setPostingPublic] = useState(false);

  // Student single submission state
  const [mySubmission, setMySubmission] = useState<Submission | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentTitle, setAttachmentTitle] = useState('');
  const [savingWork, setSavingWork] = useState(false);
  const [workNotice, setWorkNotice] = useState<string | null>(null);

  // Teacher submissions map by studentId
  const [submissionsMap, setSubmissionsMap] = useState<Record<string, Submission>>({});
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<'all' | 'submitted' | 'graded' | 'missing'>('all');
  const [gradeValue, setGradeValue] = useState<string>('');
  const [feedbackValue, setFeedbackValue] = useState<string>('');
  const [savingGrade, setSavingGrade] = useState(false);
  const [gradeNotice, setGradeNotice] = useState<string | null>(null);

  // Private 1-on-1 submission comments
  const [privateComments, setPrivateComments] = useState<CommentItem[]>([]);
  const [privateCommentBody, setPrivateCommentBody] = useState('');
  const [postingPrivate, setPostingPrivate] = useState(false);

  // Subscribe to public comments for this assignment
  useEffect(() => {
    const path = `classes/${classroom.id}/comments`;
    const q = query(collection(db, 'classes', classroom.id, 'comments'), where('isPrivate', '==', false));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs
          .map((d) => d.data() as CommentItem)
          .filter((c) => c.targetType === 'assignment' && c.targetId === assignment.id)
          .sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
        setPublicComments(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
    return () => unsub();
  }, [classroom.id, assignment.id]);

  // Subscribe to submissions (single doc for student, teacher query for teacher)
  useEffect(() => {
    if (assignment.type === 'material') return;

    if (!isTeacher) {
      const subPath = `classes/${classroom.id}/assignments/${assignment.id}/submissions/${user.uid}`;
      const unsub = onSnapshot(
        doc(db, 'classes', classroom.id, 'assignments', assignment.id, 'submissions', user.uid),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as Submission;
            setMySubmission(data);
            setAnswerText(data.answerText || '');
            setAttachmentUrl(data.attachmentUrl || '');
            setAttachmentTitle(data.attachmentTitle || '');
          } else {
            setMySubmission(null);
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, subPath)
      );
      return () => unsub();
    }

    const listPath = `classes/${classroom.id}/assignments/${assignment.id}/submissions`;
    const q = query(
      collection(db, 'classes', classroom.id, 'assignments', assignment.id, 'submissions'),
      where('teacherId', '==', user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: Record<string, Submission> = {};
        snap.docs.forEach((d) => {
          const data = d.data() as Submission;
          next[data.studentId] = data;
        });
        setSubmissionsMap(next);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, listPath)
    );
    return () => unsub();
  }, [classroom.id, assignment.id, assignment.type, isTeacher, user.uid]);

  // Default selected student for teacher grading
  useEffect(() => {
    if (isTeacher && !selectedStudentId && students.length > 0) {
      setSelectedStudentId(students[0].userId);
    }
  }, [isTeacher, selectedStudentId, students]);

  // Sync grade & feedback inputs when teacher switches selected student
  useEffect(() => {
    if (!isTeacher || !selectedStudentId) return;
    const sub = submissionsMap[selectedStudentId];
    setGradeValue(sub && sub.grade >= 0 ? String(sub.grade) : '');
    setFeedbackValue(sub?.teacherFeedback || '');
    setGradeNotice(null);
  }, [isTeacher, selectedStudentId, submissionsMap]);

  // Subscribe to private submission comments
  useEffect(() => {
    if (assignment.type === 'material') return;
    const path = `classes/${classroom.id}/comments`;
    const q = isTeacher
      ? query(collection(db, 'classes', classroom.id, 'comments'), where('teacherId', '==', user.uid))
      : query(collection(db, 'classes', classroom.id, 'comments'), where('recipientId', '==', user.uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const targetStudent = isTeacher ? selectedStudentId : user.uid;
        const items = snap.docs
          .map((d) => d.data() as CommentItem)
          .filter(
            (c) =>
              c.targetType === 'submission' &&
              c.targetId === assignment.id &&
              (!targetStudent || c.recipientId === targetStudent)
          )
          .sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
        setPrivateComments(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
    return () => unsub();
  }, [classroom.id, assignment.id, assignment.type, isTeacher, selectedStudentId, user.uid]);

  async function handlePostPublicComment(e: React.FormEvent) {
    e.preventDefault();
    if (!publicCommentBody.trim()) return;
    setPostingPublic(true);
    try {
      await addComment({
        classId: classroom.id,
        targetType: 'assignment',
        targetId: assignment.id,
        recipientId: '',
        teacherId: classroom.teacherId,
        user,
        authorRole: role,
        body: publicCommentBody,
      });
      setPublicCommentBody('');
    } finally {
      setPostingPublic(false);
    }
  }

  async function handlePostPrivateComment(e: React.FormEvent) {
    e.preventDefault();
    const targetStudent = isTeacher ? selectedStudentId : user.uid;
    if (!privateCommentBody.trim() || !targetStudent) return;
    setPostingPrivate(true);
    try {
      await addComment({
        classId: classroom.id,
        targetType: 'submission',
        targetId: assignment.id,
        recipientId: targetStudent,
        teacherId: classroom.teacherId,
        user,
        authorRole: role,
        body: privateCommentBody,
      });
      setPrivateCommentBody('');
    } finally {
      setPostingPrivate(false);
    }
  }

  async function handleStudentSave(status: 'draft' | 'submitted') {
    if (status === 'submitted' && !answerText.trim() && !attachmentUrl.trim()) {
      setWorkNotice('Tulis jawaban atau lampirkan tautan sebelum menyerahkan tugas.');
      return;
    }
    setSavingWork(true);
    setWorkNotice(null);
    try {
      await saveStudentSubmission({
        classId: classroom.id,
        assignmentId: assignment.id,
        teacherId: classroom.teacherId,
        user,
        existingSubmission: mySubmission,
        answerText,
        attachmentUrl,
        attachmentTitle,
        status,
      });
      setWorkNotice(
        status === 'submitted'
          ? 'Tugas berhasil diserahkan kepada pengajar.'
          : 'Draf jawaban disimpan.'
      );
    } finally {
      setSavingWork(false);
    }
  }

  async function handleTeacherGrade(status: 'graded' | 'returned') {
    const student = students.find((s) => s.userId === selectedStudentId);
    if (!student) return;
    const numericGrade =
      gradeValue.trim() === ''
        ? -1
        : Math.max(0, Math.min(assignment.maxPoints, Number(gradeValue)));

    if (status === 'graded' && (gradeValue.trim() === '' || Number.isNaN(numericGrade))) {
      setGradeNotice('Masukkan angka nilai yang valid sebelum menyimpan nilai.');
      return;
    }

    setSavingGrade(true);
    setGradeNotice(null);
    try {
      await gradeStudentSubmission({
        classId: classroom.id,
        assignmentId: assignment.id,
        teacherId: classroom.teacherId,
        studentId: student.userId,
        studentName: student.displayName,
        studentPhotoURL: student.photoURL,
        existingSubmission: submissionsMap[student.userId] || null,
        status,
        grade: status === 'returned' && gradeValue.trim() === '' ? -1 : numericGrade,
        teacherFeedback: feedbackValue,
      });
      setGradeNotice(
        status === 'graded'
          ? `Nilai untuk ${student.displayName} berhasil disimpan.`
          : `Tugas dikembalikan kepada ${student.displayName} untuk revisi.`
      );
    } finally {
      setSavingGrade(false);
    }
  }

  const dueState = isDueSoonOrOverdue(assignment.dueDate);
  const typeLabel =
    assignment.type === 'material' ? 'Materi' : assignment.type === 'quiz' ? 'Kuis' : 'Tugas';

  const selectedStudent = students.find((s) => s.userId === selectedStudentId) || null;
  const selectedSubmission = selectedStudentId ? submissionsMap[selectedStudentId] || null : null;

  const filteredStudents = students.filter((s) => {
    const sub = submissionsMap[s.userId];
    if (gradeFilter === 'all') return true;
    if (gradeFilter === 'submitted') return sub?.status === 'submitted';
    if (gradeFilter === 'graded') return sub?.status === 'graded';
    if (gradeFilter === 'missing') return !sub || sub.status === 'draft' || sub.status === 'returned';
    return true;
  });

  const submittedCount = students.filter(
    (s) => submissionsMap[s.userId]?.status === 'submitted' || submissionsMap[s.userId]?.status === 'graded'
  ).length;
  const gradedCount = students.filter((s) => submissionsMap[s.userId]?.status === 'graded').length;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Kembali ke Daftar Tugas Kelas</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Instructions + Public Class Comments */}
        <div
          className={`${
            assignment.type === 'material' ? 'lg:col-span-12' : 'lg:col-span-7'
          } space-y-6`}
        >
          <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
            <div className="text-xs text-slate-500 mb-2">
              {[
                typeLabel,
                assignment.topic || 'Umum',
                assignment.type !== 'material' ? `${assignment.maxPoints} Poin` : null,
                assignment.dueDate ? `Tenggat: ${formatDueDateId(assignment.dueDate)}` : 'Tanpa tenggat',
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>

            <h2 className="font-display text-2xl font-bold text-slate-900 mb-3">
              {assignment.title}
            </h2>

            {assignment.dueDate && assignment.type !== 'material' && (
              <div
                className={`inline-flex items-center gap-1.5 text-xs font-medium mb-5 ${
                  dueState === 'overdue'
                    ? 'text-red-700'
                    : dueState === 'soon'
                      ? 'text-amber-700'
                      : 'text-slate-600'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {dueState === 'overdue'
                    ? 'Tenggat waktu telah lewat'
                    : dueState === 'soon'
                      ? 'Tenggat waktu kurang dari 48 jam'
                      : `Batas pengumpulan ${formatDueDateId(assignment.dueDate)}`}
                </span>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {assignment.instructions || 'Tidak ada instruksi tambahan.'}
            </div>

            {assignment.resourceLink && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <a
                  href={assignment.resourceLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium text-blue-700 transition-colors"
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span>{assignment.resourceLabel || 'Buka Lampiran Materi'}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              </div>
            )}
          </section>

          {/* Public Class Comments */}
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="font-display text-base font-semibold text-slate-900 mb-1">
              Komentar Kelas ({publicComments.length})
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Pertanyaan dan diskusi di sini dapat dilihat oleh seluruh anggota kelas.
            </p>

            {publicComments.length > 0 && (
              <div className="divide-y divide-slate-100 mb-4">
                {publicComments.map((comment) => (
                  <div key={comment.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <UserAvatar
                        name={comment.authorName}
                        photoURL={comment.authorPhotoURL}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">
                          <span className="font-semibold text-slate-900">{comment.authorName}</span>
                          {' · '}
                          <span>{comment.authorRole === 'teacher' ? 'Pengajar' : 'Siswa'}</span>
                          {' · '}
                          <span className="tabular-nums">{formatTimestampId(comment.createdAt)}</span>
                        </p>
                        <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">
                          {comment.body}
                        </p>
                      </div>
                    </div>
                    {(comment.authorId === user.uid || isTeacher) && (
                      <button
                        type="button"
                        onClick={() => void deleteComment(classroom.id, comment.id)}
                        aria-label="Hapus komentar"
                        className="p-1 text-slate-400 hover:text-red-600 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={(e) => void handlePostPublicComment(e)} className="flex gap-2">
              <input
                type="text"
                maxLength={1000}
                value={publicCommentBody}
                onChange={(e) => setPublicCommentBody(e.target.value)}
                placeholder="Tambahkan komentar kelas..."
                className="flex-1 px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
              />
              <button
                type="submit"
                disabled={postingPublic || !publicCommentBody.trim()}
                aria-label="Kirim komentar kelas"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kirim</span>
              </button>
            </form>
          </section>
        </div>

        {/* Right Column: Student Submission OR Teacher Grading */}
        {assignment.type !== 'material' && (
          <div className="lg:col-span-5 space-y-6">
            {!isTeacher ? (
              <>
                <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-base font-semibold text-slate-900">
                      Tugas Anda
                    </h3>
                    <span
                      className={`text-xs font-semibold ${
                        mySubmission?.status === 'graded'
                          ? 'text-emerald-700'
                          : mySubmission?.status === 'submitted'
                            ? 'text-blue-700'
                            : mySubmission?.status === 'returned'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                      }`}
                    >
                      {SUBMISSION_STATUS_TEXT[mySubmission?.status || 'missing']}
                    </span>
                  </div>

                  {mySubmission?.status === 'graded' && (
                    <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-lg">
                      <p className="text-xs font-medium text-emerald-800">Nilai Akhir</p>
                      <p className="font-mono tabular-nums text-2xl font-bold text-emerald-900 mt-0.5">
                        {mySubmission.grade} / {assignment.maxPoints}
                      </p>
                      {mySubmission.teacherFeedback && (
                        <p className="text-sm text-emerald-900 mt-2 pt-2 border-t border-emerald-200/80">
                          Catatan Pengajar: {mySubmission.teacherFeedback}
                        </p>
                      )}
                    </div>
                  )}

                  {mySubmission?.status === 'returned' && mySubmission.teacherFeedback && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
                      <span className="font-semibold">Catatan Revisi:</span>{' '}
                      {mySubmission.teacherFeedback}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Jawaban / Ringkasan Pengerjaan
                    </label>
                    <textarea
                      rows={5}
                      maxLength={4000}
                      disabled={mySubmission?.status === 'graded'}
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      placeholder="Tuliskan jawaban atau catatan pengiriman tugas Anda di sini..."
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg disabled:bg-slate-50 disabled:text-slate-600 focus:outline-none focus:border-blue-700"
                    />
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Tautan Dokumen / Karya (Opsional)
                      </label>
                      <input
                        type="text"
                        maxLength={500}
                        disabled={mySubmission?.status === 'graded'}
                        value={attachmentUrl}
                        onChange={(e) => setAttachmentUrl(e.target.value)}
                        placeholder="https://docs.google.com/..."
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg disabled:bg-slate-50 focus:outline-none focus:border-blue-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Judul Lampiran
                      </label>
                      <input
                        type="text"
                        maxLength={120}
                        disabled={mySubmission?.status === 'graded'}
                        value={attachmentTitle}
                        onChange={(e) => setAttachmentTitle(e.target.value)}
                        placeholder="Contoh: Laporan Kelompok 2.pdf"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg disabled:bg-slate-50 focus:outline-none focus:border-blue-700"
                      />
                    </div>
                  </div>

                  {workNotice && (
                    <p className="text-xs font-medium text-blue-700">{workNotice}</p>
                  )}

                  {mySubmission?.status !== 'graded' ? (
                    <div className="flex flex-wrap items-center gap-2.5 pt-2">
                      {mySubmission?.status === 'submitted' ? (
                        <button
                          type="button"
                          disabled={savingWork}
                          onClick={() => void handleStudentSave('draft')}
                          className="w-full px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-medium rounded-lg transition-colors"
                        >
                          {savingWork ? 'Memproses...' : 'Batalkan Pengiriman untuk Edit'}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={savingWork}
                            onClick={() => void handleStudentSave('submitted')}
                            className="flex-1 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
                          >
                            {savingWork ? 'Mengirim...' : 'Serahkan Tugas'}
                          </button>
                          <button
                            type="button"
                            disabled={savingWork}
                            onClick={() => void handleStudentSave('draft')}
                            className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                          >
                            Simpan Draf
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Tugas telah dinilai dan dikunci oleh pengajar.</span>
                    </p>
                  )}
                </section>

                {/* Private Student-Teacher Thread */}
                <section className="bg-white border border-slate-200 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    <h3 className="font-display text-sm font-semibold text-slate-900">
                      Komentar Pribadi dengan Pengajar
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    Hanya Anda dan pengajar kelas yang dapat melihat percakapan ini.
                  </p>

                  {privateComments.length > 0 && (
                    <div className="divide-y divide-slate-100 mb-4">
                      {privateComments.map((c) => (
                        <div key={c.id} className="py-2.5">
                          <p className="text-xs text-slate-500">
                            <span className="font-semibold text-slate-900">{c.authorName}</span>
                            {' · '}
                            <span className="tabular-nums">{formatTimestampId(c.createdAt)}</span>
                          </p>
                          <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{c.body}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={(e) => void handlePostPrivateComment(e)} className="flex gap-2">
                    <input
                      type="text"
                      maxLength={1000}
                      value={privateCommentBody}
                      onChange={(e) => setPrivateCommentBody(e.target.value)}
                      placeholder="Tulis pesan pribadi ke pengajar..."
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
                    />
                    <button
                      type="submit"
                      disabled={postingPrivate || !privateCommentBody.trim()}
                      aria-label="Kirim komentar pribadi"
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
                    >
                      Kirim
                    </button>
                  </form>
                </section>
              </>
            ) : (
              /* TEACHER GRADING WORKSPACE */
              <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                <div>
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    Pengumpulan &amp; Penilaian Siswa
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 tabular-nums">
                    {submittedCount} dari {students.length} siswa mengumpulkan · {gradedCount}{' '}
                    sudah dinilai
                  </p>
                </div>

                {/* Filter tabs */}
                <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
                  {[
                    { id: 'all' as const, label: 'Semua' },
                    { id: 'submitted' as const, label: 'Menunggu Nilai' },
                    { id: 'graded' as const, label: 'Sudah Dinilai' },
                    { id: 'missing' as const, label: 'Belum Kumpul' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setGradeFilter(tab.id)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        gradeFilter === tab.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {students.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4">
                    Belum ada siswa yang bergabung di kelas ini. Bagikan kode kelas{' '}
                    <span className="font-mono font-semibold text-slate-800">
                      {classroom.code}
                    </span>{' '}
                    kepada siswa Anda.
                  </p>
                ) : (
                  <>
                    <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {filteredStudents.length === 0 ? (
                        <p className="p-4 text-xs text-slate-500 text-center">
                          Tidak ada siswa dalam kategori ini.
                        </p>
                      ) : (
                        filteredStudents.map((s) => {
                          const sub = submissionsMap[s.userId];
                          const active = selectedStudentId === s.userId;
                          return (
                            <button
                              key={s.userId}
                              type="button"
                              onClick={() => setSelectedStudentId(s.userId)}
                              className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left transition-colors ${
                                active ? 'bg-blue-50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <UserAvatar
                                  name={s.displayName}
                                  photoURL={s.photoURL}
                                  size="sm"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-900 truncate">
                                    {s.displayName}
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    {SUBMISSION_STATUS_TEXT[sub?.status || 'missing']}
                                  </p>
                                </div>
                              </div>
                              <span className="font-mono tabular-nums text-xs font-semibold text-slate-800 shrink-0">
                                {sub && sub.grade >= 0
                                  ? `${sub.grade}/${assignment.maxPoints}`
                                  : `—/${assignment.maxPoints}`}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {selectedStudent && (
                      <div className="pt-4 border-t border-slate-200 space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <UserAvatar
                              name={selectedStudent.displayName}
                              photoURL={selectedStudent.photoURL}
                              size="sm"
                            />
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {selectedStudent.displayName}
                              </p>
                              <p className="text-xs text-slate-500">
                                {SUBMISSION_STATUS_TEXT[selectedSubmission?.status || 'missing']}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                          <p className="text-xs font-medium text-slate-500">Jawaban Siswa</p>
                          <p className="text-sm text-slate-800 whitespace-pre-wrap">
                            {selectedSubmission?.answerText || 'Siswa belum menuliskan jawaban.'}
                          </p>
                          {selectedSubmission?.attachmentUrl && (
                            <a
                              href={selectedSubmission.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline pt-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>
                                {selectedSubmission.attachmentTitle || selectedSubmission.attachmentUrl}
                              </span>
                            </a>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Nilai (maks {assignment.maxPoints})
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={assignment.maxPoints}
                              value={gradeValue}
                              onChange={(e) => setGradeValue(e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 font-mono tabular-nums text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Umpan Balik Evaluasi
                            </label>
                            <input
                              type="text"
                              maxLength={1000}
                              value={feedbackValue}
                              onChange={(e) => setFeedbackValue(e.target.value)}
                              placeholder="Komentar singkat untuk hasil kerja siswa..."
                              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
                            />
                          </div>
                        </div>

                        {gradeNotice && (
                          <p className="text-xs font-medium text-emerald-700">{gradeNotice}</p>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={savingGrade}
                            onClick={() => void handleTeacherGrade('graded')}
                            className="flex-1 px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            {savingGrade ? 'Menyimpan...' : 'Simpan Nilai'}
                          </button>
                          <button
                            type="button"
                            disabled={savingGrade}
                            onClick={() => void handleTeacherGrade('returned')}
                            className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors"
                          >
                            Kembalikan Revisi
                          </button>
                        </div>

                        {/* Private Thread with Selected Student */}
                        <div className="pt-4 border-t border-slate-100">
                          <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Komentar Pribadi ({privateComments.length})</span>
                          </p>
                          {privateComments.length > 0 && (
                            <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                              {privateComments.map((c) => (
                                <div key={c.id} className="text-xs bg-slate-50 p-2.5 rounded-lg">
                                  <span className="font-semibold text-slate-900">{c.authorName}</span>
                                  <span className="text-slate-400"> · {formatTimestampId(c.createdAt)}</span>
                                  <p className="text-slate-700 mt-1">{c.body}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          <form onSubmit={(e) => void handlePostPrivateComment(e)} className="flex gap-2">
                            <input
                              type="text"
                              maxLength={1000}
                              value={privateCommentBody}
                              onChange={(e) => setPrivateCommentBody(e.target.value)}
                              placeholder={`Kirim catatan ke ${selectedStudent.displayName}...`}
                              className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
                            />
                            <button
                              type="submit"
                              disabled={postingPrivate || !privateCommentBody.trim()}
                              className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg disabled:opacity-50"
                            >
                              Kirim
                            </button>
                          </form>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
