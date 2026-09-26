'use strict';

const TRIAL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const SCHOOL_ROLES = new Set(['administration', 'teacher', 'student', 'guardian', 'guest']);

function defaultSchoolRole(user) {
  return ['admin', 'developer'].includes(user && user.role) ? 'administration' : 'guardian';
}

function ensureContainer(user) {
  if (!user.schoolAccess) user.schoolAccess = {};
  if (!SCHOOL_ROLES.has(user.schoolAccess.role)) user.schoolAccess.role = defaultSchoolRole(user);
  return user.schoolAccess;
}

function effectiveStatus(access, now) {
  if (access.status === 'subscribed' && access.subscriptionEndsAt && new Date(access.subscriptionEndsAt) <= now) return 'expired';
  if (access.status === 'trial' && access.trialEndsAt && new Date(access.trialEndsAt) <= now) return 'expired';
  return access.status || 'not_started';
}

async function activateSchoolAccess(user, now = new Date()) {
  const access = ensureContainer(user);
  let changed = false;

  if (!access.activatedAt) {
    if (['admin', 'developer'].includes(user && user.role)) access.role = 'administration';
    access.activatedAt = now;
    access.trialStartedAt = now;
    access.trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * DAY_MS);
    access.status = 'trial';
    changed = true;
  }

  const status = effectiveStatus(access, now);
  if (status !== access.status) {
    access.status = status;
    changed = true;
  }

  if (changed && typeof user.markModified === 'function') user.markModified('schoolAccess');
  if (changed && typeof user.save === 'function') await user.save();
  return access;
}

function schoolAccessView(user, now = new Date()) {
  const access = ensureContainer(user);
  const status = effectiveStatus(access, now);
  const endsAt = status === 'subscribed' ? access.subscriptionEndsAt : access.trialEndsAt;
  const remainingMs = endsAt ? Math.max(0, new Date(endsAt).getTime() - now.getTime()) : 0;
  return {
    role: access.role,
    status,
    activatedAt: access.activatedAt || null,
    trialStartedAt: access.trialStartedAt || null,
    trialEndsAt: access.trialEndsAt || null,
    subscriptionEndsAt: access.subscriptionEndsAt || null,
    remainingDays: status === 'trial' ? Math.ceil(remainingMs / DAY_MS) : null
  };
}

module.exports = { TRIAL_DAYS, activateSchoolAccess, schoolAccessView, defaultSchoolRole };
