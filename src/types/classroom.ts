import { Timestamp } from 'firebase/firestore';

export type BannerKey = 'sains' | 'literatur' | 'informatika' | 'geometri';
export type RolePreference = 'teacher' | 'student' | 'both';
export type MemberRole = 'teacher' | 'student';
export type AssignmentType = 'assignment' | 'quiz' | 'material';
export type AssignmentStatus = 'published' | 'closed';
export type SubmissionStatus = 'draft' | 'submitted' | 'returned' | 'graded';
export type CommentTargetType = 'announcement' | 'assignment' | 'submission';

export const BLUEPRINT_LIMITS = {
  idMaxLength: 128,
  idPattern: /^[a-zA-Z0-9_-]+$/,
  codeMinLength: 6,
  codeMaxLength: 8,
  codePattern: /^[A-Z0-9]+$/,
  displayNameMaxLength: 80,
  emailMaxLength: 160,
  photoUrlMaxLength: 500,
  titleMaxLength: 100,
  assignmentTitleMaxLength: 120,
  sectionMaxLength: 60,
  subjectMaxLength: 60,
  topicMaxLength: 60,
  roomMaxLength: 40,
  descriptionMaxLength: 500,
  announcementContentMaxLength: 2000,
  instructionsMaxLength: 4000,
  answerTextMaxLength: 4000,
  teacherFeedbackMaxLength: 1000,
  commentBodyMaxLength: 1000,
  urlMaxLength: 500,
  labelMaxLength: 100,
  attachmentTitleMaxLength: 120,
  dueDateMaxLength: 40,
  maxPointsLimit: 1000,
} as const;

export const BANNER_THEMES: Record<
  BannerKey,
  {
    key: BannerKey;
    label: string;
    imageUrl: string;
    fallbackGradient: string;
    accentColor: string;
  }
> = {
  sains: {
    key: 'sains',
    label: 'Sains & Laboratorium',
    imageUrl: '/src/assets/images/banner_sains_lab_1794984284276.jpg',
    fallbackGradient: 'from-emerald-900 via-teal-800 to-slate-900',
    accentColor: '#0F766E',
  },
  literatur: {
    key: 'literatur',
    label: 'Literatur & Humaniora',
    imageUrl: '/src/assets/images/banner_literatur_arsip_1794984284772.jpg',
    fallbackGradient: 'from-amber-900 via-stone-800 to-slate-900',
    accentColor: '#B45309',
  },
  informatika: {
    key: 'informatika',
    label: 'Informatika & Rekayasa',
    imageUrl: '/src/assets/images/banner_informatika_studio_1794984285207.jpg',
    fallbackGradient: 'from-blue-950 via-slate-800 to-slate-900',
    accentColor: '#1D4ED8',
  },
  geometri: {
    key: 'geometri',
    label: 'Matematika & Desain',
    imageUrl: '/src/assets/images/banner_seni_geometri_1794984283332.jpg',
    fallbackGradient: 'from-slate-800 via-zinc-800 to-neutral-900',
    accentColor: '#334155',
  },
};

export interface UserPrivate {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  rolePreference: RolePreference;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PublicProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  rolePreference: RolePreference;
  updatedAt: Timestamp;
}

export interface Enrollment {
  classId: string;
  userId: string;
  role: MemberRole;
  joinedAt: Timestamp;
}

export interface ClassCodeLookup {
  code: string;
  classId: string;
  title: string;
  section: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  bannerKey: BannerKey;
  createdAt: Timestamp;
}

export interface Classroom {
  id: string;
  title: string;
  section: string;
  subject: string;
  room: string;
  description: string;
  code: string;
  bannerKey: BannerKey;
  teacherId: string;
  teacherName: string;
  teacherPhotoURL: string;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ClassMember {
  userId: string;
  classId: string;
  role: MemberRole;
  displayName: string;
  photoURL: string;
  joinedAt: Timestamp;
}

export interface Announcement {
  id: string;
  classId: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string;
  authorRole: MemberRole;
  content: string;
  attachmentLink: string;
  attachmentLabel: string;
  pinned: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Assignment {
  id: string;
  classId: string;
  teacherId: string;
  type: AssignmentType;
  topic: string;
  title: string;
  instructions: string;
  maxPoints: number;
  dueDate: string;
  resourceLink: string;
  resourceLabel: string;
  status: AssignmentStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Submission {
  studentId: string;
  studentName: string;
  studentPhotoURL: string;
  classId: string;
  assignmentId: string;
  teacherId: string;
  answerText: string;
  attachmentUrl: string;
  attachmentTitle: string;
  status: SubmissionStatus;
  grade: number;
  teacherFeedback: string;
  submittedAt: string;
  updatedAt: Timestamp;
}

export interface CommentItem {
  id: string;
  classId: string;
  targetType: CommentTargetType;
  targetId: string;
  recipientId: string;
  isPrivate: boolean;
  teacherId: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string;
  authorRole: MemberRole;
  body: string;
  createdAt: Timestamp;
}

export function clampText(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function sanitizeUrl(url: string, maxLength = BLUEPRINT_LIMITS.urlMaxLength): string {
  const trimmed = url.trim().slice(0, maxLength);
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`.slice(0, maxLength);
}

export function formatTimestampId(ts?: Timestamp | null): string {
  if (!ts) return 'Baru saja';
  try {
    const date = ts.toDate();
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return 'Baru saja';
  }
}

export function formatDueDateId(isoString: string): string {
  if (!isoString) return 'Tanpa tenggat';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function isDueSoonOrOverdue(isoString: string): 'none' | 'overdue' | 'soon' | 'upcoming' {
  if (!isoString) return 'none';
  const due = new Date(isoString).getTime();
  if (Number.isNaN(due)) return 'none';
  const now = Date.now();
  if (due < now) return 'overdue';
  if (due - now <= 48 * 60 * 60 * 1000) return 'soon';
  return 'upcoming';
}
