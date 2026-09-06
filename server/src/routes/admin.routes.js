const express = require('express');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('admin', 'developer'));

router.get('/approvals', async (req, res) => {
  try {
    const users = await User.find({
      status: 'pending'
    })
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    res.json({
      ok: true,
      users
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: 'تعذر تحميل طلبات التسجيل'
    });
  }
});

router.patch('/approvals/:id/approve', async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      status: 'pending'
    });

    if (!user) {
      return res.status(404).json({
        ok: false,
        message: 'طلب التسجيل غير موجود أو تمت مراجعته مسبقًا'
      });
    }

    user.status = 'active';
    user.rejectionReason = '';
    user.reviewedBy = req.user._id;
    user.reviewedAt = new Date();

    await user.save();

    res.json({
      ok: true,
      message: 'تم قبول التسجيل وتفعيل الحساب'
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: 'تعذر قبول التسجيل'
    });
  }
});

router.patch('/approvals/:id/reject', async (req, res) => {
  try {
    const reason = String(req.body.reason || '').trim();

    if (!reason) {
      return res.status(400).json({
        ok: false,
        message: 'سبب الرفض مطلوب'
      });
    }

    const user = await User.findOne({
      _id: req.params.id,
      status: 'pending'
    });

    if (!user) {
      return res.status(404).json({
        ok: false,
        message: 'طلب التسجيل غير موجود أو تمت مراجعته مسبقًا'
      });
    }

    user.status = 'rejected';
    user.rejectionReason = reason;
    user.reviewedBy = req.user._id;
    user.reviewedAt = new Date();

    await user.save();

    res.json({
      ok: true,
      message: 'تم رفض التسجيل'
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: 'تعذر رفض التسجيل'
    });
  }
});

module.exports = router;
