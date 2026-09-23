'use strict';

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const {
  attachSchoolContext,
  requireSchoolStaff
} = require('../middleware/school-auth');
const managementService = require('../services/school-management');

// All school assignment endpoints require authentication and context
router.use(requireAuth);
router.use(attachSchoolContext);

// --------------------------------------------------------------------------
// Level 2 Security Barrier: Prevent Role Tampering
// --------------------------------------------------------------------------
router.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && req.body.role !== undefined) {
    const isPlatformPrivileged = req.user && (req.user.role === 'developer' || req.user.role === 'admin');
    if (!isPlatformPrivileged) {
      return res.status(403).json({
        ok: false,
        message: 'تعديل أدوار الحسابات محصور بإدارة المنصة العليا (admin/developer) فقط لمنع تصعيد الصلاحيات'
      });
    }
    if (req.body.role === 'developer' && req.user.role !== 'developer') {
      return res.status(403).json({
        ok: false,
        message: 'لا يمكن منح رتبة المطور إلا من قبل مطور معتمد'
      });
    }
  }
  next();
});

// --------------------------------------------------------------------------
// 1. List Assignments (Role-scoped: Teacher sees own, Student sees assigned, Admin sees all)
// --------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const assignments = await managementService.listAssignments(req.user, req.schoolContext, req.query);
    res.json({ ok: true, assignments });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// 2. Create Assignment (Staff only: Teacher, Manager, Developer)
// --------------------------------------------------------------------------
router.post('/', requireSchoolStaff, async (req, res, next) => {
  try {
    const assignment = await managementService.createAssignment(req.user, req.schoolContext, req.body);
    res.status(201).json({
      ok: true,
      message: 'تم إنشاء الواجب المدرسي بنجاح',
      assignment
    });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// 3. Get Assignment Details
// --------------------------------------------------------------------------
router.get('/:id', async (req, res, next) => {
  try {
    const assignment = await managementService.getAssignment(req.user, req.schoolContext, req.params.id);
    res.json({ ok: true, assignment });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// 4. Update Assignment (Creator Teacher or School Manager)
// --------------------------------------------------------------------------
router.put('/:id', requireSchoolStaff, async (req, res, next) => {
  try {
    const assignment = await managementService.updateAssignment(req.user, req.schoolContext, req.params.id, req.body);
    res.json({
      ok: true,
      message: 'تم تحديث بيانات الواجب بنجاح',
      assignment
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireSchoolStaff, async (req, res, next) => {
  try {
    // If request contains score / submissionId / grade, redirect or handle grading
    if (req.body.score !== undefined || req.body.submissionId !== undefined) {
      const result = await managementService.gradeSubmission(req.user, req.schoolContext, req.params.id, req.body);
      return res.json({
        ok: true,
        message: 'تم تصحيح الواجب ورصد الدرجة بنجاح',
        ...result
      });
    }

    const assignment = await managementService.updateAssignment(req.user, req.schoolContext, req.params.id, req.body);
    res.json({
      ok: true,
      message: 'تم تحديث بيانات الواجب بنجاح',
      assignment
    });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// 5. Archive Assignment (Creator Teacher or School Manager)
// --------------------------------------------------------------------------
router.post('/:id/archive', requireSchoolStaff, async (req, res, next) => {
  try {
    const assignment = await managementService.archiveAssignment(req.user, req.schoolContext, req.params.id);
    res.json({
      ok: true,
      message: 'تم أرشفة الواجب بنجاح',
      assignment
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireSchoolStaff, async (req, res, next) => {
  try {
    const assignment = await managementService.archiveAssignment(req.user, req.schoolContext, req.params.id);
    res.json({
      ok: true,
      message: 'تم أرشفة الواجب بنجاح',
      assignment
    });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// 6. Submit Assignment (Student Only)
// --------------------------------------------------------------------------
router.post('/:id/submit', async (req, res, next) => {
  try {
    const submission = await managementService.submitAssignment(req.user, req.schoolContext, req.params.id, req.body);
    res.status(201).json({
      ok: true,
      message: submission.status === 'late' ? 'تم تسليم الواجب (متأخر)' : 'تم تسليم الواجب بنجاح',
      submission
    });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// 7. List Submissions for Assignment (Owner Teacher or Manager)
// --------------------------------------------------------------------------
router.get('/:id/submissions', async (req, res, next) => {
  try {
    const submissions = await managementService.listSubmissions(req.user, req.schoolContext, req.params.id);
    res.json({ ok: true, submissions });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// 8. Get Single Submission
// --------------------------------------------------------------------------
router.get('/:id/submissions/:submissionId', async (req, res, next) => {
  try {
    const submission = await managementService.getSubmission(
      req.user,
      req.schoolContext,
      req.params.id,
      req.params.submissionId
    );
    res.json({ ok: true, submission });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// 9. Grade Submission
// --------------------------------------------------------------------------
router.patch('/:id/grade', requireSchoolStaff, async (req, res, next) => {
  try {
    const result = await managementService.gradeSubmission(
      req.user,
      req.schoolContext,
      req.params.id,
      req.body
    );
    res.json({
      ok: true,
      message: 'تم تصحيح الواجب ورصد الدرجة بنجاح',
      ...result
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/submissions/:submissionId/grade', requireSchoolStaff, async (req, res, next) => {
  try {
    const result = await managementService.gradeSubmission(
      req.user,
      req.schoolContext,
      req.params.id,
      req.params.submissionId,
      req.body
    );
    res.json({
      ok: true,
      message: 'تم تصحيح الواجب ورصد الدرجة بنجاح',
      ...result
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
