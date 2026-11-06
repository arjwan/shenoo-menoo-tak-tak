-- Sumer School teacher-application workflow on D1. Additive; unrelated school data is preserved.
CREATE TABLE IF NOT EXISTS school_teacher_applications (
 id TEXT PRIMARY KEY,
 applicant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 full_name TEXT NOT NULL,
 phone TEXT NOT NULL DEFAULT '',
 email TEXT NOT NULL DEFAULT '',
 subjects_json TEXT NOT NULL DEFAULT '[]',
 stages_json TEXT NOT NULL DEFAULT '[]',
 grades_json TEXT NOT NULL DEFAULT '[]',
 sections_json TEXT NOT NULL DEFAULT '[]',
 qualifications TEXT NOT NULL DEFAULT '',
 experience TEXT NOT NULL DEFAULT '',
 experience_years INTEGER NOT NULL DEFAULT 0,
 bio TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 review_note TEXT NOT NULL DEFAULT '',
 reviewed_by TEXT REFERENCES users(id),
 reviewed_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS school_teacher_one_pending
 ON school_teacher_applications(applicant_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS school_teacher_applications_status_created
 ON school_teacher_applications(status, created_at);
CREATE TABLE IF NOT EXISTS school_teachers (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
 full_name TEXT NOT NULL,
 subjects_json TEXT NOT NULL DEFAULT '[]',
 stages_json TEXT NOT NULL DEFAULT '[]',
 grades_json TEXT NOT NULL DEFAULT '[]',
 sections_json TEXT NOT NULL DEFAULT '[]',
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
 registered_by TEXT REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
