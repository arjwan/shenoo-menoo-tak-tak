'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');

function valid(value) {
  return typeof value === 'string' && Buffer.byteLength(value) >= 32 && !/change-this|replace-with/i.test(value);
}
function ensureAuthEnvironment(directory = process.cwd(), environment = process.env) {
  const file = path.join(path.resolve(directory), '.env');
  const lock = path.join(path.resolve(directory), '.auth-environment.lock');
  if (environment.JWT_SECRET) {
    if (!valid(environment.JWT_SECRET)) throw Object.assign(new Error('Existing JWT configuration is invalid; explicit replacement is required'), { code: 'AUTH_SECRET_INVALID' });
    return { jwtSecret: 'already-configured', source: 'environment' };
  }
  let descriptor;
  try {
    descriptor = fs.openSync(lock, 'wx', 0o600);
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) throw new Error('Refusing a symbolic .env path');
    const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const configured = dotenv.parse(content).JWT_SECRET;
    if (configured) {
      if (!valid(configured)) throw Object.assign(new Error('Existing JWT configuration is invalid; explicit replacement is required'), { code: 'AUTH_SECRET_INVALID' });
      return { jwtSecret: 'already-configured', source: 'private-file' };
    }
    const secret = crypto.randomBytes(48).toString('hex');
    const flags = fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_CREAT | (fs.constants.O_NOFOLLOW || 0);
    const target = fs.openSync(file, flags, 0o600);
    try {
      fs.fchmodSync(target, 0o600);
      fs.writeSync(target, (content && !content.endsWith('\n') ? '\n' : '') + 'JWT_SECRET=' + secret + '\n');
      fs.fsyncSync(target);
    } finally { fs.closeSync(target); }
    return { jwtSecret: 'created', source: 'private-file' };
  } finally {
    if (descriptor !== undefined) { fs.closeSync(descriptor); fs.unlinkSync(lock); }
  }
}
if (require.main === module) {
  try { console.log(JSON.stringify(ensureAuthEnvironment())); }
  catch (error) { console.error('Authentication environment setup refused: ' + (error.code || 'AUTH_CONFIG_ERROR') + '. No existing key was replaced.'); process.exitCode = 1; }
}
module.exports = { ensureAuthEnvironment };
