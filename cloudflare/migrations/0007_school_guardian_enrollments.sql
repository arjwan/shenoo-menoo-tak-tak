-- Cloudflare D1: guardian-submitted enrollment applications and approved students.
-- Additive only: no old account, student, or consent records are modified.
CREATE TABLE IF NOT EXISTS school_student_enrollments (
 id TEXT PRIMARY KEY,
 guardian_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 student_name TEXT NOT NULL CHECK(length(student_name) BETWEEN 2 AND 120),
 student_username TEXT NOT NULL COLLATE NOCASE CHECK(length(student_username) BETWEEN 3 AND 30),
 relationship TEXT NOT NULL CHECK(relationship IN ('أب','أم','ولي أمر','أخرى')),
 stage TEXT NOT NULL CHECK(stage IN ('ابتدائي','متوسط','إعدادي')),
 grade TEXT NOT NULL,
 section TEXT NOT NULL DEFAULT 'أ',
 subjects_json TEXT NOT NULL DEFAULT '[]',
 consents_json TEXT NOT NULL,
 consent_recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 review_note TEXT NOT NULL DEFAULT '',
 reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
 reviewed_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS school_student_one_pending_username
 ON school_student_enrollments(student_username) WHERE status='pending';
CREATE INDEX IF NOT EXISTS school_student_enrollments_guardian
 ON school_student_enrollments(guardian_user_id,status,created_at);
CREATE TABLE IF NOT EXISTS school_students (
 id TEXT PRIMARY KEY,
 enrollment_id TEXT UNIQUE REFERENCES school_student_enrollments(id) ON DELETE SET NULL,
 guardian_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 student_user_id TEXT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
 student_name TEXT NOT NULL,
 student_username TEXT NOT NULL COLLATE NOCASE,
 stage TEXT NOT NULL,
 grade TEXT NOT NULL,
 section TEXT NOT NULL DEFAULT 'أ',
 status TEXT NOT NULL DEFAULT 'pending_account' CHECK(status IN ('pending_account','active','suspended')),
 approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS school_students_guardian ON school_students(guardian_user_id,status);
