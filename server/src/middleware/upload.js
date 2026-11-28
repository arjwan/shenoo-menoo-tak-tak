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
  const boxAt4 = ascii.slice(4, 8);
  if (mimeType === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/gif') return ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a');
  if (mimeType === 'image/webp') return ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP';
  if (mimeType === 'image/heic' || mimeType === 'image/heif') return boxAt4 === 'ftyp' && ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(ascii.slice(8, 12));
  if (mimeType === 'video/mp4' || mimeType === 'audio/mp4' || mimeType === 'audio/x-m4a' || mimeType === 'video/x-m4v' || mimeType === 'video/3gpp' || mimeType === 'video/3gpp2' || mimeType === 'video/x-f4v') return boxAt4 === 'ftyp';
  if (mimeType === 'video/quicktime') return ['ftyp', 'wide', 'mdat', 'free', 'skip'].includes(boxAt4);
  if (mimeType === 'video/webm' || mimeType === 'audio/webm' || mimeType === 'video/x-matroska') return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (mimeType === 'video/ogg' || mimeType === 'audio/ogg' || mimeType === 'audio/opus') return ascii.startsWith('OggS');
  if (mimeType === 'video/x-msvideo') return ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'AVI ';
  if (mimeType === 'video/mpeg') return buffer[0] === 0 && buffer[1] === 0 && buffer[2] === 1 && (buffer[3] === 0xba || buffer[3] === 0xb3);
  if (mimeType === 'video/mp2t') return buffer[0] === 0x47;
  if (mimeType === 'video/x-flv') return ascii.startsWith('FLV');
  if (mimeType === 'video/x-ms-wmv' || mimeType === 'video/x-ms-asf') return buffer.subarray(0, 16).equals(Buffer.from([0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6, 0xd9, 0x00, 0xaa, 0x00, 0x62, 0xce, 0x6c]));
  if (mimeType === 'audio/mpeg' || mimeType === 'audio/mp3') return ascii.startsWith('ID3') || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  if (mimeType === 'audio/aac') return ascii.startsWith('ID3') || (buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0);
  if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') return ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WAVE';
  if (mimeType === 'audio/flac' || mimeType === 'audio/x-flac') return ascii.startsWith('fLaC');
  if (mimeType === 'audio/amr') return ascii.startsWith('#!AMR');
  if (mimeType === 'application/pdf') return ascii.startsWith('%PDF-');
  if (mimeType === 'application/msword') return buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  if (mimeType === 'text/plain') return !buffer.includes(0);
  return false;
}

// Server-chosen stored extension -> MIME, for files whose client-supplied
// MIME is generic (e.g. application/octet-stream with an allowed extension).
// The extension is picked server-side (mediaExt), never from user input.
const extToMime = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif',
  '.mp4': 'video/mp4', '.m4v': 'video/x-m4v', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.ogv': 'video/ogg', '.3gp': 'video/3gpp', '.3g2': 'video/3gpp2', '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo', '.mpeg': 'video/mpeg', '.mpg': 'video/mpeg', '.ts': 'video/mp2t',
  '.flv': 'video/x-flv', '.wmv': 'video/x-ms-wmv', '.asf': 'video/x-ms-asf', '.f4v': 'video/x-f4v',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav',
  '.flac': 'audio/flac', '.opus': 'audio/opus', '.oga': 'audio/ogg', '.ogg': 'audio/ogg',
  '.amr': 'audio/amr', '.pdf': 'application/pdf', '.txt': 'text/plain',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

async function validateStoredFile(file) {
  if (!file || !file.path) return false;
  // No size cap here: each route's multer limits enforce its own maximum
  // (posts/reels/stories allow up to 1 GB, school 50 MB, islamic 100 MB).
  let handle;
  try {
    handle = await fs.promises.open(file.path, 'r');
    const buffer = Buffer.alloc(Math.min(32, file.size || 32));
    await handle.read(buffer, 0, buffer.length, 0);
    if (matchesSignature(buffer, file.mimetype)) return true;
    const fromExt = extToMime[path.extname(file.filename || '').toLowerCase()];
    if (fromExt && fromExt !== file.mimetype) return matchesSignature(buffer, fromExt);
    return false;
  } catch {
    return false;
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

uploader.allowedMimeTypes = allowed;
uploader.validateStoredFile = validateStoredFile;
module.exports = uploader;
