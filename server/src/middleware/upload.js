const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadDir = path.resolve(__dirname, '../../../uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const allowed = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain', 'audio/webm', 'audio/mpeg', 'audio/ogg'
]);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'application/pdf': '.pdf', 'text/plain': '.txt', 'audio/webm': '.webm', 'audio/mpeg': '.mp3', 'audio/ogg': '.ogg' };
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${extensions[file.mimetype]}`);
  }
});
module.exports = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => allowed.has(file.mimetype)
    ? cb(null, true)
    : cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname))
});
