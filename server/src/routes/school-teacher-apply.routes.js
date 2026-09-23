'use strict';

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const managementService = require('../services/school-management');

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const application = await managementService.submitTeacherApplication(req.user, req.body);
    res.status(201).json({
      ok: true,
      message: 'تم استلام طلب التقديم كمعلم بنجاح وهو قيد مراجعة الإدارة المدرسية',
      application
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
    next(err);
  }
});

module.exports = router;
