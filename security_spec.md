# Security Specification & Payload-First TDD — RuangKelas

## 1. Data Invariants
1. **PII Isolation**: User emails live exclusively in `/users/{userId}` and are readable only by `request.auth.uid == userId`. Classmates and teachers view non-PII profiles via `/publicProfiles/{userId}` (`allow get` only, no `list`) and `/classes/{classId}/members/{memberId}`.
2. **Master Gate Membership**: No user can read or write `/classes/{classId}` subcollections (`members`, `announcements`, `assignments`, `submissions`, `comments`) unless they have a valid membership document at `/classes/{classId}/members/{request.auth.uid}`.
3. **Self-Role Escalation Prevention**: A user joining via `/classCodes/{code}` can ONLY create a member/enrollment document with `role == 'student'`. Only the verified creator (`teacherId == request.auth.uid`) of `/classes/{classId}` can hold `role == 'teacher'`.
4. **Student Submission Privacy & Grade Lock**: Students can only read and list their own `/submissions/{studentId}` (`studentId == request.auth.uid`). Students can NEVER set `grade >= 0`, modify `teacherFeedback`, or set `status == 'graded'` or `'returned'`. Once `status == 'graded'`, students cannot overwrite their submission.
5. **Private Comment Thread Isolation**: Comments with `targetType == 'submission'` are strictly isolated to the `recipientId` (student), `authorId`, and `teacherId`.
6. **Temporal Integrity & Path Hardening**: All document IDs match `^[a-zA-Z0-9_\-]+$`, all strings enforce explicit `.size()` bounds, and all server timestamps enforce `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **P1 — Self-Assigned Teacher Role on Join (`/classes/{classId}/members/{uid}`)**:
   `{ "userId": "attacker", "classId": "cls1", "role": "teacher", "displayName": "Attacker", "photoURL": "", "joinedAt": "SERVER_TIME" }` -> MUST return `PERMISSION_DENIED`.
2. **P2 — Ghost Field Injection on Class Create (`/classes/{classId}`)**:
   `{ ...validClass, "isAdmin": true, "verified": true }` -> MUST return `PERMISSION_DENIED` (`hasOnly` check).
3. **P3 — Student Self-Grading on Submission Create (`/submissions/{uid}`)**:
   `{ ...validSubmission, "status": "graded", "grade": 100, "teacherFeedback": "Great" }` -> MUST return `PERMISSION_DENIED`.
4. **P4 — Student Grade Tampering on Update (`/submissions/{uid}`)**:
   `{ ...existingSubmission, "grade": 99 }` -> MUST return `PERMISSION_DENIED` (`affectedKeys().hasOnly(...)`).
5. **P5 — Modifying Locked Graded Submission (`/submissions/{uid}`)**:
   Student updates `answerText` when `existing().status == 'graded'` -> MUST return `PERMISSION_DENIED` (terminal state lock).
6. **P6 — Identity Spoofing on Announcement (`/announcements/{id}`)**:
   `{ ...validAnnouncement, "authorId": "teacher_uid", "authorRole": "teacher" }` submitted by student -> MUST return `PERMISSION_DENIED` (`authorId == request.auth.uid`).
7. **P7 — Student Creating Assignment (`/assignments/{id}`)**:
   Student in class creates document in `/classes/{classId}/assignments/{id}` -> MUST return `PERMISSION_DENIED` (`isClassTeacher(classId)`).
8. **P8 — Resource Poisoning / 1MB String in ID or Title (`/classes/{longId}`)**:
   Document ID with 500 characters or `title` with 5000 characters -> MUST return `PERMISSION_DENIED` (`isValidId` + `.size()`).
9. **P9 — Orphaned Class Without Membership (`/classes/{classId}`)**:
   Creating `/classes/{classId}` without batch-creating `/classes/{classId}/members/{uid}` -> MUST return `PERMISSION_DENIED` (`existsAfter` check).
10. **P10 — PII Scraping on `/users`**:
    Authenticated non-owner calls `getDoc(doc(db, 'users', 'victimUid'))` or `getDocs(collection(db, 'users'))` -> MUST return `PERMISSION_DENIED`.
11. **P11 — Class Code Enumeration (`list /classCodes`)**:
    Authenticated user calls `getDocs(collection(db, 'classCodes'))` -> MUST return `PERMISSION_DENIED` (`allow list: if false`).
12. **P12 — Reading Another Student's Private Submission Comment (`/comments`)**:
    Student B reads or lists `targetType == 'submission'` where `recipientId == 'studentA'` -> MUST return `PERMISSION_DENIED`.
