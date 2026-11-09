'use strict';
const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { getLessonCurriculumContext } = require('../services/school-curriculum-context');
router.use(requireAuth);

function sendError(res, error) {
  const status = Number.isInteger(error.status) ? error.status : 503;
  const code = error.status ? error.message : 'CURRICULUM_SERVICE_UNAVAILABLE';
  return res.status(status).json({ success: false, code });
}
router.get('/context', async (req, res) => {
  try {
    const context = await getLessonCurriculumContext(req.query.sessionCode, req.user._id);
    return res.json({ success: true, data: context });
  } catch (error) { return sendError(res, error); }
});
router.post('/session', async (req, res) => {
  try {
    const gender = req.body?.avatarGender;
    if (gender !== undefined && !['male', 'female'].includes(gender)) {
      return res.status(400).json({ success: false, code: 'INVALID_AVATAR_GENDER' });
    }
    await getLessonCurriculumContext(req.body?.sessionCode, req.user._id);
    if (process.env.SCHOOL_AVATAR_ENABLED !== 'true' ||
        !process.env.SCHOOL_AVATAR_PROVIDER || !process.env.SCHOOL_AVATAR_API_KEY) {
      return res.status(503).json({ success: false, code: 'AVATAR_SERVICE_UNAVAILABLE' });
    }
    // No provider adapter is installed yet: never issue fake WebRTC tokens.
    return res.status(501).json({ success: false, code: 'AVATAR_PROVIDER_INTEGRATION_PENDING' });
  } catch (error) { return sendError(res, error); }
});
module.exports = router;
