'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TRIAL_DAYS, activateSchoolAccess, schoolAccessView, defaultSchoolRole } = require('../src/services/school-access');

test('first school activation starts one 30-day trial', async () => {
  const now = new Date('2026-09-22T12:00:00.000Z');
  const user = { role: 'user', schoolAccess: {}, saved: 0, markModified() {}, async save() { this.saved += 1; } };
  await activateSchoolAccess(user, now);
  const view = schoolAccessView(user, now);
  assert.equal(TRIAL_DAYS, 30);
  assert.equal(view.role, 'guardian');
  assert.equal(view.status, 'trial');
  assert.equal(view.remainingDays, 30);
  assert.equal(user.saved, 1);
});

test('returning to school does not grant a second trial', async () => {
  const started = new Date('2026-09-01T00:00:00.000Z');
  const end = new Date('2026-10-01T00:00:00.000Z');
  const user = { role: 'user', schoolAccess: { role: 'student', status: 'trial', activatedAt: started, trialStartedAt: started, trialEndsAt: end }, saved: 0, markModified() {}, async save() { this.saved += 1; } };
  await activateSchoolAccess(user, new Date('2026-09-22T00:00:00.000Z'));
  assert.equal(new Date(user.schoolAccess.trialStartedAt).toISOString(), started.toISOString());
  assert.equal(new Date(user.schoolAccess.trialEndsAt).toISOString(), end.toISOString());
  assert.equal(user.saved, 0);
});

test('expired trial remains attached to the account data', async () => {
  const user = { role: 'user', schoolAccess: { role: 'guardian', status: 'trial', activatedAt: new Date('2026-08-01'), trialStartedAt: new Date('2026-08-01'), trialEndsAt: new Date('2026-08-31') }, saved: 0, markModified() {}, async save() { this.saved += 1; } };
  await activateSchoolAccess(user, new Date('2026-09-22'));
  assert.equal(user.schoolAccess.status, 'expired');
  assert.equal(user.saved, 1);
  assert.equal(defaultSchoolRole({ role: 'admin' }), 'administration');
});
