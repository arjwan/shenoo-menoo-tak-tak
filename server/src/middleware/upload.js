const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadDir = path.resolve(__dirname, '../../../uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const allowed = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/x-m4v', 'video/webm', 'video/quicktime', 'video/ogg',
  'video/3gpp', 'video/3gpp2', 'video/x-matroska', 'video/x-msvideo',
  'application/pdf', 'text/plain', 'audio/webm', 'audio/mpeg', 'audio/ogg', 'audio/mp4'
]);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'video/mp4': '.mp4', 'video/x-m4v': '.m4v', 'video/webm': '.webm', 'video/quicktime': '.mov', 'video/ogg': '.ogv', 'video/3gpp': '.3gp', 'video/3gpp2': '.3g2', 'video/x-matroska': '.mkv', 'video/x-msvideo': '.avi', 'application/pdf': '.pdf', 'text/plain': '.txt', 'audio/webm': '.webm', 'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/mp4': '.m4a' };
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${extensions[file.mimetype]}`);
  }
});
const uploader = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => allowed.has(file.mimetype)
    ? cb(null, true)
    : cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname))
});

function matchesSignature(buffer, mimeType) {
  const ascii = buffer.toString('ascii');
  if (mimeType === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/gif') return ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a');
  if (mimeType === 'image/webp') return ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP';
  if (mimeType === 'video/mp4' || mimeType === 'audio/mp4') return ascii.slice(4, 8) === 'ftyp';
  if (mimeType === 'video/webm' || mimeType === 'audio/webm') return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (mimeType === 'audio/ogg') return ascii.startsWith('OggS');
  if (mimeType === 'audio/mpeg') return ascii.startsWith('ID3') || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  if (mimeType === 'application/pdf') return ascii.startsWith('%PDF-');
  if (mimeType === 'text/plain') return !buffer.includes(0);
  return false;
}

async function validateStoredFile(file) {
  if (!file || !allowed.has(file.mimetype) || file.size > 10 * 1024 * 1024) return false;
  const handle = await fs.promises.open(file.path, 'r');
  try {
    const buffer = Buffer.alloc(Math.min(32, file.size));
    await handle.read(buffer, 0, buffer.length, 0);
    return matchesSignature(buffer, file.mimetype);
  } finally {
    await handle.close();
  }
}

uploader.allowedMimeTypes = allowed;
uploader.validateStoredFile = validateStoredFile;
module.exports = uploader;
