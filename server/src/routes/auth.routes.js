const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

function detectContactType(value) {
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const iraqiPhone = /^07\d{9}$/;

  if (email.test(value)) return 'email';
  if (iraqiPhone.test(value)) return 'phone';

  return null;
}

router.post('/signup', async (req, res) => {
  try {
    const {
      fullName,
      username,
      contact,
      birthDate,
      gender,
      password,
      confirmPassword,
      termsAccepted
    } = req.body;

    if (!fullName || !username || !contact || !password) {
      return res.status(400).json({
        ok: false,
        message: 'يرجى إكمال الحقول المطلوبة'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        ok: false,
        message: 'كلمتا المرور غير متطابقتين'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        ok: false,
        message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'
      });
    }

    if (termsAccepted !== true) {
      return res.status(400).json({
        ok: false,
        message: 'يجب الموافقة على الشروط'
      });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const normalizedContact = contact.trim().toLowerCase();
    const contactType = detectContactType(normalizedContact);

    if (!contactType) {
      return res.status(400).json({
        ok: false,
        message: 'أدخل بريدًا إلكترونيًا صحيحًا أو رقم هاتف عراقي صحيحًا'
      });
    }

    const existing = await User.findOne({
      $or: [
        { username: normalizedUsername },
        { contact: normalizedContact }
      ]
    });

    if (existing) {
      return res.status(409).json({
        ok: false,
        message: 'اسم المستخدم أو الهاتف أو البريد مستخدم مسبقًا'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      fullName: fullName.trim(),
      username: normalizedUsername,
      contact: normalizedContact,
      contactType,
      birthDate: birthDate || null,
      gender: gender || 'other',
      passwordHash,
      termsAccepted: true,
      role: 'user',
      status: 'pending'
    });

    return res.status(201).json({
      ok: true,
      status: 'pending',
      message: 'تم استلام طلب التسجيل وهو بانتظار مراجعة الإدارة',
      userId: user._id
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: 'حدث خطأ في الخادم'
    });
  }
});

router.post('/signin', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        ok: false,
        message: 'أدخل بيانات تسجيل الدخول'
      });
    }

    const normalized = identifier.trim().toLowerCase();

    const user = await User.findOne({
      $or: [
        { username: normalized },
        { contact: normalized }
      ]
    });

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: 'بيانات تسجيل الدخول غير صحيحة'
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      return res.status(401).json({
        ok: false,
        message: 'بيانات تسجيل الدخول غير صحيحة'
      });
    }

    if (user.status === 'pending') {
      return res.status(403).json({
        ok: false,
        status: 'pending',
        message: 'طلب التسجيل ما زال بانتظار موافقة الإدارة'
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        ok: false,
        status: 'rejected',
        message: user.rejectionReason
          ? `تم رفض التسجيل: ${user.rejectionReason}`
          : 'تم رفض طلب التسجيل'
      });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({
        ok: false,
        status: 'blocked',
        message: 'الحساب محظور'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        ok: false,
        message: 'الحساب غير فعال'
      });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      ok: true,
      message: 'تم تسجيل الدخول',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: 'حدث خطأ في الخادم'
    });
  }
});

module.exports = router;
