import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  Announcement,
  Assignment,
  AssignmentStatus,
  AssignmentType,
  BannerKey,
  BLUEPRINT_LIMITS,
  clampText,
  ClassCodeLookup,
  Classroom,
  CommentTargetType,
  MemberRole,
  RolePreference,
  sanitizeUrl,
  Submission,
  SubmissionStatus,
} from '../types/classroom';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function generateClassCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function syncUserProfile(
  user: User,
  rolePreference?: RolePreference
): Promise<RolePreference> {
  const userRef = doc(db, 'users', user.uid);
  const publicRef = doc(db, 'publicProfiles', user.uid);
  const displayName = clampText(
    user.displayName || user.email?.split('@')[0] || 'Pengguna',
    BLUEPRINT_LIMITS.displayNameMaxLength
  );
  const email = clampText(user.email || '', BLUEPRINT_LIMITS.emailMaxLength);
  const photoURL = clampText(user.photoURL || '', BLUEPRINT_LIMITS.photoUrlMaxLength);

  let resolvedRole: RolePreference = rolePreference || 'both';

  try {
    const existingSnap = await getDoc(userRef);
    const batch = writeBatch(db);

    if (!existingSnap.exists()) {
      batch.set(userRef, {
        uid: user.uid,
        email,
        displayName,
        photoURL,
        rolePreference: resolvedRole,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = existingSnap.data();
      resolvedRole = rolePreference || (existingData.rolePreference as RolePreference) || 'both';
      batch.update(userRef, {
        displayName,
        photoURL,
        rolePreference: resolvedRole,
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(publicRef, {
      uid: user.uid,
      displayName,
      photoURL,
      rolePreference: resolvedRole,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return resolvedRole;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

export async function updateRolePreference(user: User, rolePreference: RolePreference): Promise<void> {
  try {
    const batch = writeBatch(db);
    const displayName = clampText(
      user.displayName || user.email?.split('@')[0] || 'Pengguna',
      BLUEPRINT_LIMITS.displayNameMaxLength
    );
    const photoURL = clampText(user.photoURL || '', BLUEPRINT_LIMITS.photoUrlMaxLength);

    batch.update(doc(db, 'users', user.uid), {
      displayName,
      photoURL,
      rolePreference,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'publicProfiles', user.uid), {
      displayName,
      photoURL,
      rolePreference,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
  }
}

export interface CreateClassInput {
  title: string;
  section: string;
  subject: string;
  room: string;
  description: string;
  bannerKey: BannerKey;
}

export async function createClassroom(user: User, input: CreateClassInput): Promise<string> {
  const classId = generateId();
  let code = generateClassCode();

  // Ensure code is unique
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const codeSnap = await getDoc(doc(db, 'classCodes', code));
      if (!codeSnap.exists()) break;
      code = generateClassCode();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `classCodes/${code}`);
  }

  const teacherName = clampText(
    user.displayName || user.email?.split('@')[0] || 'Pengajar',
    BLUEPRINT_LIMITS.displayNameMaxLength
  );
  const teacherPhotoURL = clampText(user.photoURL || '', BLUEPRINT_LIMITS.photoUrlMaxLength);
  const title = clampText(input.title, BLUEPRINT_LIMITS.titleMaxLength);
  const section = clampText(input.section, BLUEPRINT_LIMITS.sectionMaxLength);
  const subject = clampText(input.subject, BLUEPRINT_LIMITS.subjectMaxLength);
  const room = clampText(input.room, BLUEPRINT_LIMITS.roomMaxLength);
  const description = clampText(input.description, BLUEPRINT_LIMITS.descriptionMaxLength);

  if (!title) {
    throw new Error('Nama kelas wajib diisi.');
  }

  const batch = writeBatch(db);
  batch.set(doc(db, 'classes', classId), {
    id: classId,
    title,
    section,
    subject,
    room,
    description,
    code,
    bannerKey: input.bannerKey,
    teacherId: user.uid,
    teacherName,
    teacherPhotoURL,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'classCodes', code), {
    code,
    classId,
    title,
    section,
    subject,
    teacherId: user.uid,
    teacherName,
    bannerKey: input.bannerKey,
    createdAt: serverTimestamp(),
  });

  batch.set(doc(db, 'classes', classId, 'members', user.uid), {
    userId: user.uid,
    classId,
    role: 'teacher',
    displayName: teacherName,
    photoURL: teacherPhotoURL,
    joinedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'users', user.uid, 'enrollments', classId), {
    classId,
    userId: user.uid,
    role: 'teacher',
    joinedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return classId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `classes/${classId}`);
  }
}

export async function updateClassroom(
  classroom: Classroom,
  updates: Partial<CreateClassInput> & { archived?: boolean }
): Promise<void> {
  const title = clampText(updates.title ?? classroom.title, BLUEPRINT_LIMITS.titleMaxLength);
  const section = clampText(updates.section ?? classroom.section, BLUEPRINT_LIMITS.sectionMaxLength);
  const subject = clampText(updates.subject ?? classroom.subject, BLUEPRINT_LIMITS.subjectMaxLength);
  const room = clampText(updates.room ?? classroom.room, BLUEPRINT_LIMITS.roomMaxLength);
  const description = clampText(
    updates.description ?? classroom.description,
    BLUEPRINT_LIMITS.descriptionMaxLength
  );
  const bannerKey = updates.bannerKey ?? classroom.bannerKey;
  const archived = updates.archived ?? classroom.archived;

  const batch = writeBatch(db);
  batch.update(doc(db, 'classes', classroom.id), {
    title,
    section,
    subject,
    room,
    description,
    bannerKey,
    archived,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'classCodes', classroom.code), {
    title,
    section,
    subject,
    bannerKey,
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `classes/${classroom.id}`);
  }
}

export async function lookupClassCode(rawCode: string): Promise<ClassCodeLookup | null> {
  const normalized = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (
    normalized.length < BLUEPRINT_LIMITS.codeMinLength ||
    normalized.length > BLUEPRINT_LIMITS.codeMaxLength
  ) {
    return null;
  }
  try {
    const snap = await getDoc(doc(db, 'classCodes', normalized));
    if (!snap.exists()) return null;
    return snap.data() as ClassCodeLookup;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `classCodes/${normalized}`);
  }
}

export async function joinClassByCode(user: User, rawCode: string): Promise<string> {
  const normalized = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (
    normalized.length < BLUEPRINT_LIMITS.codeMinLength ||
    normalized.length > BLUEPRINT_LIMITS.codeMaxLength
  ) {
    throw new Error('Kode kelas harus terdiri dari 6 hingga 8 karakter huruf/angka.');
  }

  let lookup: ClassCodeLookup | null = null;
  try {
    const snap = await getDoc(doc(db, 'classCodes', normalized));
    if (!snap.exists()) {
      throw new Error('Kode kelas tidak ditemukan. Periksa kembali kode dari pengajar Anda.');
    }
    lookup = snap.data() as ClassCodeLookup;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Kode kelas tidak ditemukan')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.GET, `classCodes/${normalized}`);
  }

  const classId = lookup.classId;
  const existingEnrollment = await getDoc(doc(db, 'users', user.uid, 'enrollments', classId));
  if (existingEnrollment.exists()) {
    return classId;
  }

  const displayName = clampText(
    user.displayName || user.email?.split('@')[0] || 'Siswa',
    BLUEPRINT_LIMITS.displayNameMaxLength
  );
  const photoURL = clampText(user.photoURL || '', BLUEPRINT_LIMITS.photoUrlMaxLength);

  const batch = writeBatch(db);
  batch.set(doc(db, 'classes', classId, 'members', user.uid), {
    userId: user.uid,
    classId,
    role: 'student',
    displayName,
    photoURL,
    joinedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'users', user.uid, 'enrollments', classId), {
    classId,
    userId: user.uid,
    role: 'student',
    joinedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return classId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `classes/${classId}/members/${user.uid}`);
  }
}

export async function removeMemberFromClass(classId: string, memberUserId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'classes', classId, 'members', memberUserId));
  batch.delete(doc(db, 'users', memberUserId, 'enrollments', classId));
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `classes/${classId}/members/${memberUserId}`);
  }
}

export async function createAnnouncement(
  classId: string,
  user: User,
  authorRole: MemberRole,
  content: string,
  attachmentLink = '',
  attachmentLabel = ''
): Promise<string> {
  const announcementId = generateId();
  const cleanContent = clampText(content, BLUEPRINT_LIMITS.announcementContentMaxLength);
  if (!cleanContent) {
    throw new Error('Isi pengumuman tidak boleh kosong.');
  }

  const cleanLink = sanitizeUrl(attachmentLink);
  const cleanLabel = clampText(attachmentLabel, BLUEPRINT_LIMITS.labelMaxLength);
  const authorName = clampText(
    user.displayName || user.email?.split('@')[0] || 'Anggota',
    BLUEPRINT_LIMITS.displayNameMaxLength
  );
  const authorPhotoURL = clampText(user.photoURL || '', BLUEPRINT_LIMITS.photoUrlMaxLength);

  try {
    await setDoc(doc(db, 'classes', classId, 'announcements', announcementId), {
      id: announcementId,
      classId,
      authorId: user.uid,
      authorName,
      authorPhotoURL,
      authorRole,
      content: cleanContent,
      attachmentLink: cleanLink,
      attachmentLabel: cleanLabel,
      pinned: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return announcementId;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `classes/${classId}/announcements/${announcementId}`
    );
  }
}

export async function toggleAnnouncementPin(
  classId: string,
  announcement: Announcement
): Promise<void> {
  try {
    await updateDoc(doc(db, 'classes', classId, 'announcements', announcement.id), {
      pinned: !announcement.pinned,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `classes/${classId}/announcements/${announcement.id}`
    );
  }
}

export async function deleteAnnouncement(classId: string, announcementId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'classes', classId, 'announcements', announcementId));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `classes/${classId}/announcements/${announcementId}`
    );
  }
}

export interface SaveAssignmentInput {
  type: AssignmentType;
  topic: string;
  title: string;
  instructions: string;
  maxPoints: number;
  dueDate: string;
  resourceLink: string;
  resourceLabel: string;
  status?: AssignmentStatus;
}

export async function createAssignment(
  classId: string,
  teacherId: string,
  input: SaveAssignmentInput
): Promise<string> {
  const assignmentId = generateId();
  const title = clampText(input.title, BLUEPRINT_LIMITS.assignmentTitleMaxLength);
  if (!title) throw new Error('Judul tugas wajib diisi.');

  const maxPoints =
    input.type === 'material'
      ? 0
      : Math.max(0, Math.min(BLUEPRINT_LIMITS.maxPointsLimit, Number(input.maxPoints) || 0));

  try {
    await setDoc(doc(db, 'classes', classId, 'assignments', assignmentId), {
      id: assignmentId,
      classId,
      teacherId,
      type: input.type,
      topic: clampText(input.topic, BLUEPRINT_LIMITS.topicMaxLength),
      title,
      instructions: clampText(input.instructions, BLUEPRINT_LIMITS.instructionsMaxLength),
      maxPoints,
      dueDate: clampText(input.dueDate, BLUEPRINT_LIMITS.dueDateMaxLength),
      resourceLink: sanitizeUrl(input.resourceLink),
      resourceLabel: clampText(input.resourceLabel, BLUEPRINT_LIMITS.labelMaxLength),
      status: input.status || 'published',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return assignmentId;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `classes/${classId}/assignments/${assignmentId}`
    );
  }
}

export async function updateAssignment(
  classId: string,
  assignment: Assignment,
  input: SaveAssignmentInput
): Promise<void> {
  const title = clampText(input.title, BLUEPRINT_LIMITS.assignmentTitleMaxLength);
  if (!title) throw new Error('Judul tugas wajib diisi.');
  const maxPoints =
    input.type === 'material'
      ? 0
      : Math.max(0, Math.min(BLUEPRINT_LIMITS.maxPointsLimit, Number(input.maxPoints) || 0));

  try {
    await updateDoc(doc(db, 'classes', classId, 'assignments', assignment.id), {
      type: input.type,
      topic: clampText(input.topic, BLUEPRINT_LIMITS.topicMaxLength),
      title,
      instructions: clampText(input.instructions, BLUEPRINT_LIMITS.instructionsMaxLength),
      maxPoints,
      dueDate: clampText(input.dueDate, BLUEPRINT_LIMITS.dueDateMaxLength),
      resourceLink: sanitizeUrl(input.resourceLink),
      resourceLabel: clampText(input.resourceLabel, BLUEPRINT_LIMITS.labelMaxLength),
      status: input.status || assignment.status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `classes/${classId}/assignments/${assignment.id}`
    );
  }
}

export async function deleteAssignment(classId: string, assignmentId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'classes', classId, 'assignments', assignmentId));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `classes/${classId}/assignments/${assignmentId}`
    );
  }
}

export async function saveStudentSubmission(params: {
  classId: string;
  assignmentId: string;
  teacherId: string;
  user: User;
  existingSubmission: Submission | null;
  answerText: string;
  attachmentUrl: string;
  attachmentTitle: string;
  status: 'draft' | 'submitted';
}): Promise<void> {
  const {
    classId,
    assignmentId,
    teacherId,
    user,
    existingSubmission,
    answerText,
    attachmentUrl,
    attachmentTitle,
    status,
  } = params;
  const subRef = doc(db, 'classes', classId, 'assignments', assignmentId, 'submissions', user.uid);
  const studentName = clampText(
    user.displayName || user.email?.split('@')[0] || 'Siswa',
    BLUEPRINT_LIMITS.displayNameMaxLength
  );
  const studentPhotoURL = clampText(user.photoURL || '', BLUEPRINT_LIMITS.photoUrlMaxLength);
  const cleanAnswer = clampText(answerText, BLUEPRINT_LIMITS.answerTextMaxLength);
  const cleanUrl = sanitizeUrl(attachmentUrl);
  const cleanTitle = clampText(attachmentTitle, BLUEPRINT_LIMITS.attachmentTitleMaxLength);
  const submittedAt =
    status === 'submitted'
      ? new Date().toISOString().slice(0, BLUEPRINT_LIMITS.dueDateMaxLength)
      : existingSubmission?.submittedAt || '';

  try {
    if (!existingSubmission) {
      await setDoc(subRef, {
        studentId: user.uid,
        studentName,
        studentPhotoURL,
        classId,
        assignmentId,
        teacherId,
        answerText: cleanAnswer,
        attachmentUrl: cleanUrl,
        attachmentTitle: cleanTitle,
        status,
        grade: -1,
        teacherFeedback: '',
        submittedAt,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(subRef, {
        studentName,
        studentPhotoURL,
        answerText: cleanAnswer,
        attachmentUrl: cleanUrl,
        attachmentTitle: cleanTitle,
        status,
        submittedAt,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `classes/${classId}/assignments/${assignmentId}/submissions/${user.uid}`
    );
  }
}

export async function gradeStudentSubmission(params: {
  classId: string;
  assignmentId: string;
  teacherId: string;
  studentId: string;
  studentName: string;
  studentPhotoURL: string;
  existingSubmission: Submission | null;
  status: Extract<SubmissionStatus, 'graded' | 'returned'>;
  grade: number;
  teacherFeedback: string;
}): Promise<void> {
  const {
    classId,
    assignmentId,
    teacherId,
    studentId,
    studentName,
    studentPhotoURL,
    existingSubmission,
    status,
    grade,
    teacherFeedback,
  } = params;
  const subRef = doc(db, 'classes', classId, 'assignments', assignmentId, 'submissions', studentId);
  const clampedGrade =
    status === 'returned' && grade < 0
      ? -1
      : Math.max(-1, Math.min(BLUEPRINT_LIMITS.maxPointsLimit, grade));
  const cleanFeedback = clampText(teacherFeedback, BLUEPRINT_LIMITS.teacherFeedbackMaxLength);

  try {
    if (!existingSubmission) {
      await setDoc(subRef, {
        studentId,
        studentName: clampText(studentName, BLUEPRINT_LIMITS.displayNameMaxLength),
        studentPhotoURL: clampText(studentPhotoURL, BLUEPRINT_LIMITS.photoUrlMaxLength),
        classId,
        assignmentId,
        teacherId,
        answerText: '',
        attachmentUrl: '',
        attachmentTitle: '',
        status,
        grade: clampedGrade,
        teacherFeedback: cleanFeedback,
        submittedAt: '',
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(subRef, {
        status,
        grade: clampedGrade,
        teacherFeedback: cleanFeedback,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `classes/${classId}/assignments/${assignmentId}/submissions/${studentId}`
    );
  }
}

export async function addComment(params: {
  classId: string;
  targetType: CommentTargetType;
  targetId: string;
  recipientId: string;
  teacherId: string;
  user: User;
  authorRole: MemberRole;
  body: string;
}): Promise<string> {
  const commentId = generateId();
  const cleanBody = clampText(params.body, BLUEPRINT_LIMITS.commentBodyMaxLength);
  if (!cleanBody) throw new Error('Komentar tidak boleh kosong.');

  const authorName = clampText(
    params.user.displayName || params.user.email?.split('@')[0] || 'Anggota',
    BLUEPRINT_LIMITS.displayNameMaxLength
  );
  const authorPhotoURL = clampText(params.user.photoURL || '', BLUEPRINT_LIMITS.photoUrlMaxLength);
  const isPrivate = params.targetType === 'submission';

  try {
    await setDoc(doc(db, 'classes', params.classId, 'comments', commentId), {
      id: commentId,
      classId: params.classId,
      targetType: params.targetType,
      targetId: params.targetId,
      recipientId: isPrivate ? params.recipientId : '',
      isPrivate,
      teacherId: params.teacherId,
      authorId: params.user.uid,
      authorName,
      authorPhotoURL,
      authorRole: params.authorRole,
      body: cleanBody,
      createdAt: serverTimestamp(),
    });
    return commentId;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `classes/${params.classId}/comments/${commentId}`
    );
  }
}

export async function deleteComment(classId: string, commentId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'classes', classId, 'comments', commentId));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `classes/${classId}/comments/${commentId}`
    );
  }
}

export function getClassCollectionRef(classId: string, sub: 'members' | 'announcements' | 'assignments' | 'comments') {
  return collection(db, 'classes', classId, sub);
}
