'use strict';

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const linked = require('../services/iraqi-curriculum-linked');

// The curriculum index contains public stage, grade and subject names.
// Keep file listings and indexed book text behind the account gate.
router.get('/curriculum/catalog', (req, res) => {
  const filters = ['stage', 'grade', 'subject'];
  const items = linked.catalogItems.filter((item) => filters.every((key) => !req.query[key] || item[key] === req.query[key]));
  res.json({ ok: true, version: linked.catalog.version, items, total: items.length });
});

router.use(requireAuth);

router.get('/curriculum/files', (_req, res) => {
  res.json({ ...linked.manifest, files: linked.files, indexedTextCount: linked.files.filter((file) => file.textAvailable).length });
});

router.get('/curriculum/indexed-text/:driveId', (req, res) => {
  const result = linked.indexedText(req.params.driveId);
  if (!result) return res.status(404).json({ ok: false, message: 'نص الكتاب غير متوفر في الفهرس' });
  res.json({ ok: true, title: result.file.title, grade: result.file.grade, subject: result.file.subject,
    sourceUrl: result.file.sourceUrl, content: result.text });
});

module.exports = router;
