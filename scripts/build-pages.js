'use strict';

// Build a static-only Cloudflare Pages artifact. Never modifies source files.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
const maxAssetBytes = 25 * 1024 * 1024;
const excluded = new Set([
  '.git', '.github', '.wrangler', 'node_modules', 'dist', 'server',
  'tests', 'scripts', 'android', 'android-app', 'docs', 'handoff',
  'logs', 'work', 'legacy-prototype', 'original-assets', 'canva-originals'
]);
const excludedFiles = new Set([
  '.env', '.env.local', '.env.production', '.cpanel.yml',
  'docker-compose.yml', 'render.yaml'
]);
const manifestPath = path.join(root, 'app-pages.manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const requiredPages = [
  ...Object.values(manifest.shenooMenoo).flat(),
  ...Object.values(manifest.sumerSchool).flat()
].filter(Array.isArray).flat();

function copyTree(from, to, rel = '') {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const name = entry.name;
    const relative = rel ? rel + '/' + name : name;
    if (excluded.has(name) || excludedFiles.has(name) || name.startsWith('.env')) continue;
    const src = path.join(from, name);
    const dst = path.join(to, name);
    if (entry.isDirectory()) {
      copyTree(src, dst, relative);
      continue;
    }
    if (!entry.isFile()) continue;
    const stat = fs.statSync(src);
    if (stat.size > maxAssetBytes) {
      console.log('SKIP oversized static asset:', relative, stat.size);
      continue;
    }
    fs.copyFileSync(src, dst);
  }
}

fs.rmSync(out, { recursive: true, force: true });
copyTree(root, out);
const missing = requiredPages.filter(file => !fs.existsSync(path.join(out, file)));
if (missing.length) {
  console.error('Pages build incomplete; manifest entries missing:', missing.join(', '));
  process.exitCode = 1;
} else {
  console.log('Static Pages artifact created. Manifest pages verified:', requiredPages.length);
  console.log('Backend, tests, deployment configs, archives, secrets, and assets over 25 MiB excluded.');
}
