'use strict';

const SchoolTeacher = require('../models/SchoolTeacher');
const SchoolStudent = require('../models/SchoolStudent');
const SchoolGuardian = require('../models/SchoolGuardian');

/**
 * Determine the user's role and school-specific context.
 * Role precedence: developer > manager > teacher > guardian / student > user
 */
async function resolveSchoolContext(user) {
  if (!user) return { role: 'guest', teacher: null, guardian: null, studentProfiles: [] };

  if (user.role === 'developer') {
    return { role: 'developer', isDeveloper: true, isManager: true, teacher: null, guardian: null };
  }

  if (user.role === 'admin') {
    return { role: 'manager', isDeveloper: false, isManager: true, teacher: null, guardian: null };
  }

  const teacher = await SchoolTeacher.findOne({ user: user._id, status: 'active' }).lean();
  if (teacher) {
    return { role: 'teacher', isDeveloper: false, isManager: false, isTeacher: true, teacher };
  }

  const guardianStudents = await SchoolStudent.find({ guardian: user._id, status: { $ne: 'archived' } }).lean();
  const guardianProfile = await SchoolGuardian.findOne({ user: user._id, status: 'active' }).lean();
  if (guardianStudents.length > 0 || guardianProfile) {
    return {
      role: 'guardian',
      isDeveloper: false,
      isManager: false,
      isGuardian: true,
      guardian: guardianProfile,
      students: guardianStudents
    };
  }

  const studentProfile = await SchoolStudent.findOne({ studentUser: user._id, status: { $ne: 'archived' } }).lean();
  if (studentProfile) {
    return {
      role: 'student',
      isDeveloper: false,
      isManager: false,
      isStudent: true,
      studentProfile
    };
  }

  return { role: 'user', isDeveloper: false, isManager: false };
}

/**
 * Middleware: Attaches req.schoolContext = { role, isDeveloper, isManager, isTeacher, ... }
 */
async function attachSchoolContext(req, res, next) {
  try {
    if (!req.user) {
      req.schoolContext = { role: 'guest' };
      return next();
    }
    req.schoolContext = await resolveSchoolContext(req.user);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware: Require at least manager (or developer)
 */
function requireSchoolManager(req, res, next) {
  if (!req.schoolContext || (!req.schoolContext.isManager && !req.schoolContext.isDeveloper)) {
    return res.status(403).json({
      ok: false,
      message: 'هذا الإجراء مخصص لمدير المدرسة أو المطور فقط'
    });
  }
  next();
}

/**
 * Middleware: Require at least teacher, manager, or developer
 */
function requireSchoolStaff(req, res, next) {
  if (
    !req.schoolContext ||
    (!req.schoolContext.isTeacher && !req.schoolContext.isManager && !req.schoolContext.isDeveloper)
  ) {
    return res.status(403).json({
      ok: false,
      message: 'هذا الإجراء مخصص لطاقم المدرسة (معلم، مدير، مطور)'
    });
  }
  next();
}

module.exports = {
  resolveSchoolContext,
  attachSchoolContext,
  requireSchoolManager,
  requireSchoolStaff
};
