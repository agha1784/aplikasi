import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import {
  BookOpen,
  Check,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  HelpCircle,
  Link2,
  LogOut,
  Pin,
  Plus,
  Send,
  Settings,
  Trash2,
  UserMinus,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  addComment,
  createAnnouncement,
  deleteAnnouncement,
  deleteAssignment,
  deleteComment,
  removeMemberFromClass,
  toggleAnnouncementPin,
} from '../services/classroomService';
import {
  Announcement,
  Assignment,
  AssignmentType,
  ClassMember,
  Classroom,
  CommentItem,
  formatDueDateId,
  formatTimestampId,
  MemberRole,
  Submission,
} from '../types/classroom';
import { AssignmentDetailView } from './AssignmentDetailView';
import { ClassBanner, UserAvatar } from './BannerImage';
import { AssignmentModal, CreateClassModal } from './Modals';

export type ClassTab = 'stream' | 'classwork' | 'people' | 'grades';

interface ClassWorkspaceProps {
  classroom: Classroom;
  user: User;
  role: MemberRole;
  initialAssignmentId?: string | null;
  onClearInitialAssignment?: () => void;
  onLeftClass: () => void;
}

export function ClassWorkspace({
  classroom,
  user,
  role,
  initialAssignmentId,
  onClearInitialAssignment,
  onLeftClass,
}: ClassWorkspaceProps) {
  const isTeacher = role === 'teacher';
  const [activeTab, setActiveTab] = useState<ClassTab>('stream');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(
    initialAssignmentId || null
  );

  // Live collections
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [announcementComments, setAnnouncementComments] = useState<CommentItem[]>([]);

  // Composer & UI states
  const [announcementText, setAnnouncementText] = useState('');
  const [attachmentLink, setAttachmentLink] = useState('');
  const [attachmentLabel, setAttachmentLabel] = useState('');
  const [showLinkInputs, setShowLinkInputs] = useState(false);
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [copiedCode, setCopiedCode] = useState(false);

  // Filters & Modals
  const [typeFilter, setTypeFilter] = useState<'all' | AssignmentType>('all');
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [classSettingsOpen, setClassSettingsOpen] = useState(false);

  // Inline confirmation states (avoid window.confirm in iframe)
  const [confirmDeleteAssignmentId, setConfirmDeleteAssignmentId] = useState<string | null>(null);
  const [confirmRemoveMemberId, setConfirmRemoveMemberId] = useState<string | null>(null);
  const [confirmLeaveClass, setConfirmLeaveClass] = useState(false);

  // Gradebook submissions cache per assignment
  const [gradebookSubs, setGradebookSubs] = useState<Record<string, Record<string, Submission>>>({});

  useEffect(() => {
    if (initialAssignmentId) {
      setActiveTab('classwork');
      setSelectedAssignmentId(initialAssignmentId);
      onClearInitialAssignment?.();
    }
  }, [initialAssignmentId, onClearInitialAssignment]);

  // Reset selected assignment when switching classes
  useEffect(() => {
    if (!initialAssignmentId) {
      setSelectedAssignmentId(null);
      setActiveTab('stream');
    }
  }, [classroom.id, initialAssignmentId]);

  // Subscribe to class members
  useEffect(() => {
    const path = `classes/${classroom.id}/members`;
    const unsub = onSnapshot(
      collection(db, 'classes', classroom.id, 'members'),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as ClassMember)
          .sort((a, b) => a.displayName.localeCompare(b.displayName));
        setMembers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
    return () => unsub();
  }, [classroom.id]);

  // Subscribe to announcements
  useEffect(() => {
    const path = `classes/${classroom.id}/announcements`;
    const q = query(
      collection(db, 'classes', classroom.id, 'announcements'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as Announcement)
          .sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
          });
        setAnnouncements(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
    return () => unsub();
  }, [classroom.id]);

  // Subscribe to assignments
  useEffect(() => {
    const path = `classes/${classroom.id}/assignments`;
    const q = query(
      collection(db, 'classes', classroom.id, 'assignments'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAssignments(snap.docs.map((d) => d.data() as Assignment));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
    return () => unsub();
  }, [classroom.id]);

  // Subscribe to public announcement comments
  useEffect(() => {
    const path = `classes/${classroom.id}/comments`;
    const q = query(collection(db, 'classes', classroom.id, 'comments'), where('isPrivate', '==', false));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as CommentItem)
          .filter((c) => c.targetType === 'announcement')
          .sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
        setAnnouncementComments(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
    return () => unsub();
  }, [classroom.id]);

  // Subscribe to submissions when viewing Grades tab
  useEffect(() => {
    if (activeTab !== 'grades') return;
    const gradable = assignments.filter((a) => a.type !== 'material');
    if (gradable.length === 0) return;

    const unsubs = gradable.map((asg) => {
      const subPath = `classes/${classroom.id}/assignments/${asg.id}/submissions`;
      const q = isTeacher
        ? query(
            collection(db, 'classes', classroom.id, 'assignments', asg.id, 'submissions'),
            where('teacherId', '==', user.uid)
          )
        : query(
            collection(db, 'classes', classroom.id, 'assignments', asg.id, 'submissions'),
            where('studentId', '==', user.uid)
          );
      return onSnapshot(
        q,
        (snap) => {
          const map: Record<string, Submission> = {};
          snap.docs.forEach((d) => {
            const s = d.data() as Submission;
            map[s.studentId] = s;
          });
          setGradebookSubs((prev) => ({ ...prev, [asg.id]: map }));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, subPath)
      );
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [activeTab, assignments, classroom.id, isTeacher, user.uid]);

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(classroom.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // ignore
    }
  }

  async function handleCreateAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!announcementText.trim()) return;
    setPostingAnnouncement(true);
    try {
      await createAnnouncement(
        classroom.id,
        user,
        role,
        announcementText,
        attachmentLink,
        attachmentLabel
      );
      setAnnouncementText('');
      setAttachmentLink('');
      setAttachmentLabel('');
      setShowLinkInputs(false);
    } finally {
      setPostingAnnouncement(false);
    }
  }

  async function handleAddAnnouncementComment(e: React.FormEvent, announcementId: string) {
    e.preventDefault();
    const body = commentDrafts[announcementId] || '';
    if (!body.trim()) return;
    setCommentDrafts((prev) => ({ ...prev, [announcementId]: '' }));
    await addComment({
      classId: classroom.id,
      targetType: 'announcement',
      targetId: announcementId,
      recipientId: '',
      teacherId: classroom.teacherId,
      user,
      authorRole: role,
      body,
    });
  }

  const selectedAssignment = selectedAssignmentId
    ? assignments.find((a) => a.id === selectedAssignmentId) || null
    : null;

  if (selectedAssignment) {
    return (
      <AssignmentDetailView
        classroom={classroom}
        assignment={selectedAssignment}
        user={user}
        role={role}
        members={members}
        onBack={() => setSelectedAssignmentId(null)}
      />
    );
  }

  const teachers = members.filter((m) => m.role === 'teacher');
  const students = members.filter((m) => m.role === 'student');
  const existingTopics = Array.from(
    new Set(assignments.map((a) => a.topic).filter(Boolean))
  );

  // Group assignments by topic
  const filteredAssignments = assignments.filter(
    (a) => typeFilter === 'all' || a.type === typeFilter
  );
  const groupedAssignments = filteredAssignments.reduce<Record<string, Assignment[]>>((acc, item) => {
    const key = item.topic || 'Materi & Tugas Umum';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const gradableAssignments = assignments.filter((a) => a.type !== 'material');

  return (
    <div className="space-y-6">
      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          {[
            { id: 'stream' as ClassTab, label: 'Forum' },
            { id: 'classwork' as ClassTab, label: 'Tugas Kelas' },
            { id: 'people' as ClassTab, label: 'Anggota' },
            { id: 'grades' as ClassTab, label: isTeacher ? 'Buku Nilai' : 'Nilai Saya' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {isTeacher && (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditingAssignment(null);
                  setAssignmentModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Tugas / Materi</span>
              </button>
              <button
                type="button"
                onClick={() => setClassSettingsOpen(true)}
                aria-label="Pengaturan kelas"
                className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* TAB 1: FORUM (STREAM) */}
      {activeTab === 'stream' && (
        <div className="space-y-6">
          {/* Class Header Banner */}
          <div className="relative h-48 sm:h-56 rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
            <ClassBanner bannerKey={classroom.bannerKey} alt={classroom.title} />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-white">
              <div>
                <p className="text-xs text-slate-200 mb-1">
                  {[classroom.subject, classroom.section, classroom.room].filter(Boolean).join(' · ') ||
                    'Kelas Daring'}
                </p>
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                  {classroom.title}
                </h1>
                {classroom.description && (
                  <p className="text-sm text-slate-200 mt-1.5 max-w-2xl line-clamp-2">
                    {classroom.description}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => void handleCopyCode()}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-white/15 hover:bg-white/25 backdrop-blur border border-white/25 rounded-lg text-xs font-mono tabular-nums text-white transition-colors self-start sm:self-end whitespace-nowrap shrink-0"
              >
                <span>Kode: {classroom.code}</span>
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left summary column */}
            <aside className="lg:col-span-4 space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h2 className="font-display text-sm font-semibold text-slate-900 mb-2">
                  Tugas Mendatang
                </h2>
                {gradableAssignments.filter((a) => a.dueDate).length === 0 ? (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Belum ada tugas dengan tenggat waktu terdekat.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {gradableAssignments
                      .filter((a) => a.dueDate)
                      .slice(0, 4)
                      .map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setSelectedAssignmentId(a.id)}
                          className="w-full py-2.5 text-left hover:text-blue-700 transition-colors"
                        >
                          <p className="text-xs font-medium text-slate-900 truncate">{a.title}</p>
                          <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                            {formatDueDateId(a.dueDate)}
                          </p>
                        </button>
                      ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('classwork')}
                  className="mt-3 text-xs font-medium text-blue-700 hover:underline"
                >
                  Lihat semua tugas kelas
                </button>
              </div>
            </aside>

            {/* Stream Composer + Feed */}
            <div className="lg:col-span-8 space-y-5">
              <form
                onSubmit={(e) => void handleCreateAnnouncement(e)}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <UserAvatar
                    name={user.displayName || 'Pengguna'}
                    photoURL={user.photoURL || ''}
                    size="md"
                  />
                  <textarea
                    rows={2}
                    maxLength={2000}
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder={
                      isTeacher
                        ? 'Umumkan jadwal, materi, atau informasi kelas kepada siswa...'
                        : 'Bagikan pertanyaan atau bahan diskusi ke forum kelas...'
                    }
                    className="flex-1 px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700 resize-y"
                  />
                </div>

                {showLinkInputs && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-12">
                    <input
                      type="text"
                      maxLength={500}
                      value={attachmentLink}
                      onChange={(e) => setAttachmentLink(e.target.value)}
                      placeholder="https://tautan-materi..."
                      className="px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
                    />
                    <input
                      type="text"
                      maxLength={100}
                      value={attachmentLabel}
                      onChange={(e) => setAttachmentLabel(e.target.value)}
                      placeholder="Label tautan (opsional)"
                      className="px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 pl-12">
                  <button
                    type="button"
                    onClick={() => setShowLinkInputs((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>{showLinkInputs ? 'Tutup Tautan' : 'Lampirkan Tautan'}</span>
                  </button>

                  <button
                    type="submit"
                    disabled={postingAnnouncement || !announcementText.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{postingAnnouncement ? 'Mengirim...' : 'Posting ke Forum'}</span>
                  </button>
                </div>
              </form>

              {announcements.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                  <p className="text-sm font-medium text-slate-900 mb-1">
                    Forum kelas masih kosong
                  </p>
                  <p className="text-xs text-slate-500">
                    Mulai percakapan dengan mengirim pengumuman atau sapaan pertama di atas.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {announcements.map((item) => {
                    const commentsForItem = announcementComments.filter(
                      (c) => c.targetId === item.id
                    );
                    return (
                      <article
                        key={item.id}
                        className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                      >
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <UserAvatar
                                name={item.authorName}
                                photoURL={item.authorPhotoURL}
                                size="md"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">
                                  {item.authorName}
                                </p>
                                <p className="text-xs text-slate-500">
                                  <span>{item.authorRole === 'teacher' ? 'Pengajar' : 'Siswa'}</span>
                                  {' · '}
                                  <span className="tabular-nums">
                                    {formatTimestampId(item.createdAt)}
                                  </span>
                                  {item.pinned && (
                                    <>
                                      {' · '}
                                      <span className="font-medium text-blue-700">Disematkan</span>
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {isTeacher && (
                                <button
                                  type="button"
                                  onClick={() => void toggleAnnouncementPin(classroom.id, item)}
                                  title={item.pinned ? 'Lepas sematan' : 'Sematkan di atas'}
                                  aria-label={item.pinned ? 'Lepas sematan' : 'Sematkan'}
                                  className={`p-1.5 rounded-md transition-colors ${
                                    item.pinned
                                      ? 'text-blue-700 bg-blue-50'
                                      : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  <Pin className="w-4 h-4" />
                                </button>
                              )}
                              {(item.authorId === user.uid || isTeacher) && (
                                <button
                                  type="button"
                                  onClick={() => void deleteAnnouncement(classroom.id, item.id)}
                                  aria-label="Hapus pengumuman"
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                            {item.content}
                          </p>

                          {item.attachmentLink && (
                            <div className="mt-3">
                              <a
                                href={item.attachmentLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-blue-700 hover:bg-slate-100 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>{item.attachmentLabel || item.attachmentLink}</span>
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Comments on announcement */}
                        <div className="bg-slate-50/70 border-t border-slate-100 px-5 py-3.5 space-y-3">
                          {commentsForItem.length > 0 && (
                            <div className="space-y-2.5">
                              {commentsForItem.map((c) => (
                                <div
                                  key={c.id}
                                  className="flex items-start justify-between gap-2 text-xs"
                                >
                                  <div className="flex items-start gap-2.5 min-w-0">
                                    <UserAvatar
                                      name={c.authorName}
                                      photoURL={c.authorPhotoURL}
                                      size="sm"
                                    />
                                    <div className="min-w-0">
                                      <p className="text-slate-500">
                                        <span className="font-semibold text-slate-900">
                                          {c.authorName}
                                        </span>
                                        {' · '}
                                        <span>{c.authorRole === 'teacher' ? 'Pengajar' : 'Siswa'}</span>
                                        {' · '}
                                        <span className="tabular-nums">
                                          {formatTimestampId(c.createdAt)}
                                        </span>
                                      </p>
                                      <p className="text-slate-700 text-sm mt-0.5">{c.body}</p>
                                    </div>
                                  </div>
                                  {(c.authorId === user.uid || isTeacher) && (
                                    <button
                                      type="button"
                                      onClick={() => void deleteComment(classroom.id, c.id)}
                                      aria-label="Hapus komentar"
                                      className="p-1 text-slate-400 hover:text-red-600"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          <form
                            onSubmit={(e) => void handleAddAnnouncementComment(e, item.id)}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="text"
                              maxLength={1000}
                              value={commentDrafts[item.id] || ''}
                              onChange={(e) =>
                                setCommentDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              placeholder="Tulis komentar kelas..."
                              className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
                            />
                            <button
                              type="submit"
                              disabled={!(commentDrafts[item.id] || '').trim()}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-medium rounded-lg"
                            >
                              Kirim
                            </button>
                          </form>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TUGAS KELAS (CLASSWORK) */}
      {activeTab === 'classwork' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
              {[
                { id: 'all' as const, label: 'Semua' },
                { id: 'assignment' as const, label: 'Tugas' },
                { id: 'quiz' as const, label: 'Kuis' },
                { id: 'material' as const, label: 'Materi' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTypeFilter(f.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    typeFilter === f.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {isTeacher && (
              <button
                type="button"
                onClick={() => {
                  setEditingAssignment(null);
                  setAssignmentModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors self-start whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Tugas / Materi</span>
              </button>
            )}
          </div>

          {filteredAssignments.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-lg mx-auto">
              <FileText className="w-8 h-8 text-slate-400 mx-auto mb-3" />
              <h3 className="font-display text-base font-semibold text-slate-900 mb-1">
                Belum ada tugas atau materi
              </h3>
              <p className="text-sm text-slate-600 mb-5">
                {isTeacher
                  ? 'Buat tugas, kuis, atau unggah tautan materi untuk dikerjakan oleh siswa.'
                  : 'Pengajar belum menerbitkan tugas atau materi pada kategori ini.'}
              </p>
              {isTeacher && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAssignment(null);
                    setAssignmentModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Tugas Pertama</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedAssignments).map(([topicName, items]) => (
                <section key={topicName} className="space-y-2.5">
                  <h2 className="font-display text-base font-semibold text-slate-900 pb-2 border-b border-slate-200">
                    {topicName}
                  </h2>

                  <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {items.map((asg) => {
                      const Icon =
                        asg.type === 'material'
                          ? BookOpen
                          : asg.type === 'quiz'
                            ? HelpCircle
                            : FileText;
                      const label =
                        asg.type === 'material'
                          ? 'Materi'
                          : asg.type === 'quiz'
                            ? 'Kuis'
                            : 'Tugas';

                      return (
                        <div
                          key={asg.id}
                          className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedAssignmentId(asg.id)}
                            className="flex items-start sm:items-center gap-3.5 text-left min-w-0 flex-1"
                          >
                            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                {asg.title}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                                {[
                                  label,
                                  asg.type !== 'material' ? `${asg.maxPoints} poin` : null,
                                  asg.dueDate
                                    ? `Tenggat ${formatDueDateId(asg.dueDate)}`
                                    : asg.type !== 'material'
                                      ? 'Tanpa tenggat'
                                      : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            </div>
                          </button>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => setSelectedAssignmentId(asg.id)}
                              className="px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded-md transition-colors whitespace-nowrap"
                            >
                              {isTeacher ? 'Periksa & Nilai' : 'Buka Detail'}
                            </button>

                            {isTeacher && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingAssignment(asg);
                                    setAssignmentModalOpen(true);
                                  }}
                                  aria-label="Sunting tugas"
                                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>

                                {confirmDeleteAssignmentId === asg.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void deleteAssignment(classroom.id, asg.id);
                                        setConfirmDeleteAssignmentId(null);
                                      }}
                                      className="px-2 py-1 text-xs font-medium bg-red-600 text-white rounded"
                                    >
                                      Hapus
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteAssignmentId(null)}
                                      className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
                                    >
                                      Batal
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteAssignmentId(asg.id)}
                                    aria-label="Hapus tugas"
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ANGGOTA (PEOPLE) */}
      {activeTab === 'people' && (
        <div className="max-w-3xl space-y-8">
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Pengajar ({teachers.length})
              </h2>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                Kode Undangan: {classroom.code}
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {teachers.map((t) => (
                <div key={t.userId} className="px-6 py-3.5 flex items-center gap-3">
                  <UserAvatar name={t.displayName} photoURL={t.photoURL} size="md" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{t.displayName}</p>
                    <p className="text-xs text-slate-500">Pengajar Utama</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Siswa Terdaftar ({students.length})
              </h2>
              {!isTeacher && (
                <div>
                  {confirmLeaveClass ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">Yakin keluar kelas?</span>
                      <button
                        type="button"
                        onClick={async () => {
                          await removeMemberFromClass(classroom.id, user.uid);
                          onLeftClass();
                        }}
                        className="px-2.5 py-1 bg-red-600 text-white text-xs font-medium rounded-md"
                      >
                        Ya, Keluar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmLeaveClass(false)}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-md"
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmLeaveClass(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:underline"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Keluar dari Kelas</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {students.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Belum ada siswa di kelas ini. Bagikan kode{' '}
                <span className="font-mono font-semibold text-slate-900">{classroom.code}</span>{' '}
                agar siswa dapat bergabung.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {students.map((s) => (
                  <div
                    key={s.userId}
                    className="px-6 py-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar name={s.displayName} photoURL={s.photoURL} size="md" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {s.displayName}
                          {s.userId === user.uid ? ' (Anda)' : ''}
                        </p>
                        <p className="text-xs text-slate-500 tabular-nums">
                          Bergabung {formatTimestampId(s.joinedAt)}
                        </p>
                      </div>
                    </div>

                    {isTeacher && (
                      <div className="shrink-0">
                        {confirmRemoveMemberId === s.userId ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                await removeMemberFromClass(classroom.id, s.userId);
                                setConfirmRemoveMemberId(null);
                              }}
                              className="px-2.5 py-1 bg-red-600 text-white text-xs font-medium rounded"
                            >
                              Keluarkan
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveMemberId(null)}
                              className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveMemberId(s.userId)}
                            title="Keluarkan siswa dari kelas"
                            aria-label={`Keluarkan ${s.displayName}`}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 4: NILAI (GRADES) */}
      {activeTab === 'grades' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {gradableAssignments.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Belum ada tugas atau kuis yang dinilai pada kelas ini.
            </div>
          ) : isTeacher ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                    <th className="py-3.5 px-5 min-w-[200px]">Nama Siswa</th>
                    {gradableAssignments.map((asg) => (
                      <th key={asg.id} className="py-3.5 px-4 min-w-[140px]">
                        <button
                          type="button"
                          onClick={() => setSelectedAssignmentId(asg.id)}
                          className="text-left hover:text-blue-700 hover:underline truncate max-w-[160px] block"
                        >
                          {asg.title}
                        </button>
                        <span className="font-mono tabular-nums text-[11px] font-normal text-slate-500">
                          Maks {asg.maxPoints}
                        </span>
                      </th>
                    ))}
                    <th className="py-3.5 px-5 text-right">Rata-rata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {students.length === 0 ? (
                    <tr>
                      <td
                        colSpan={gradableAssignments.length + 2}
                        className="py-8 px-5 text-center text-slate-500"
                      >
                        Belum ada siswa yang terdaftar di kelas ini.
                      </td>
                    </tr>
                  ) : (
                    students.map((s) => {
                      let earned = 0;
                      let possible = 0;
                      gradableAssignments.forEach((asg) => {
                        const sub = gradebookSubs[asg.id]?.[s.userId];
                        if (sub && sub.grade >= 0 && asg.maxPoints > 0) {
                          earned += sub.grade;
                          possible += asg.maxPoints;
                        }
                      });
                      const avg = possible > 0 ? Math.round((earned / possible) * 100) : null;

                      return (
                        <tr key={s.userId} className="hover:bg-slate-50/60">
                          <td className="py-3 px-5 font-medium text-slate-900">
                            <div className="flex items-center gap-2.5">
                              <UserAvatar
                                name={s.displayName}
                                photoURL={s.photoURL}
                                size="sm"
                              />
                              <span className="truncate">{s.displayName}</span>
                            </div>
                          </td>
                          {gradableAssignments.map((asg) => {
                            const sub = gradebookSubs[asg.id]?.[s.userId];
                            return (
                              <td
                                key={asg.id}
                                className="py-3 px-4 font-mono tabular-nums text-xs text-slate-700"
                              >
                                {sub && sub.grade >= 0
                                  ? `${sub.grade} / ${asg.maxPoints}`
                                  : sub?.status === 'submitted'
                                    ? 'Menunggu nilai'
                                    : '—'}
                              </td>
                            );
                          })}
                          <td className="py-3 px-5 text-right font-mono tabular-nums font-semibold text-slate-900">
                            {avg !== null ? `${avg}%` : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Student Personal Grade Ledger */
            <div className="divide-y divide-slate-100">
              <div className="px-6 py-4 bg-slate-50/70 flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Rekap Nilai Saya
                </h2>
                <span className="font-mono tabular-nums text-sm font-semibold text-blue-700">
                  {(() => {
                    let earned = 0;
                    let possible = 0;
                    gradableAssignments.forEach((asg) => {
                      const sub = gradebookSubs[asg.id]?.[user.uid];
                      if (sub && sub.grade >= 0 && asg.maxPoints > 0) {
                        earned += sub.grade;
                        possible += asg.maxPoints;
                      }
                    });
                    return possible > 0
                      ? `Rata-rata: ${Math.round((earned / possible) * 100)}%`
                      : 'Belum ada nilai';
                  })()}
                </span>
              </div>
              {gradableAssignments.map((asg) => {
                const sub = gradebookSubs[asg.id]?.[user.uid];
                return (
                  <button
                    key={asg.id}
                    type="button"
                    onClick={() => setSelectedAssignmentId(asg.id)}
                    className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{asg.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {sub?.status === 'graded'
                          ? 'Sudah dinilai'
                          : sub?.status === 'submitted'
                            ? 'Menunggu penilaian pengajar'
                            : sub?.status === 'returned'
                              ? 'Dikembalikan untuk revisi'
                              : 'Belum diserahkan'}
                        {asg.dueDate ? ` · Tenggat ${formatDueDateId(asg.dueDate)}` : ''}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums text-sm font-semibold text-slate-900 shrink-0">
                      {sub && sub.grade >= 0 ? `${sub.grade} / ${asg.maxPoints}` : `— / ${asg.maxPoints}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <AssignmentModal
        open={assignmentModalOpen}
        classId={classroom.id}
        teacherId={classroom.teacherId}
        editingAssignment={editingAssignment}
        existingTopics={existingTopics}
        onClose={() => {
          setAssignmentModalOpen(false);
          setEditingAssignment(null);
        }}
        onSaved={() => {}}
      />

      <CreateClassModal
        open={classSettingsOpen}
        user={user}
        editingClass={classroom}
        onClose={() => setClassSettingsOpen(false)}
        onSaved={() => {}}
      />
    </div>
  );
}
