'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const manifestPath = process.argv[2] || path.resolve('server/src/data/iraqi-curriculum-files.json');
const outputDir = process.argv[3] || path.resolve('uploads/school-curriculum');
const concurrency = Math.max(1, Math.min(12, Number(process.env.CURRICULUM_DOWNLOAD_CONCURRENCY) || 6));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
fs.mkdirSync(outputDir, { recursive: true });

const sha256 = file => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  fs.createReadStream(file).on('error', reject).on('data', chunk => hash.update(chunk)).on('end', () => resolve(hash.digest('hex')));
});

function download(url, destination, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 8) return reject(new Error('Too many redirects'));
    const request = https.get(url, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        return resolve(download(new URL(response.headers.location, url), destination, redirects + 1));
      }
      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`HTTP ${response.statusCode}`));
      }
      const stream = fs.createWriteStream(destination);
      response.pipe(stream);
      stream.on('finish', () => stream.close(resolve));
      stream.on('error', reject);
    });
    request.setTimeout(300000, () => request.destroy(new Error('Download timeout')));
    request.on('error', reject);
  });
}

async function fetchOne(item) {
  const destination = path.join(outputDir, item.fileName);
  if (fs.existsSync(destination) && fs.statSync(destination).size === item.bytes && await sha256(destination) === item.sha256) {
    return `cached ${item.fileName}`;
  }
  const partial = `${destination}.part`;
  try {
    await download(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(item.driveId)}&export=download&confirm=t`, partial);
    const stat = fs.statSync(partial);
    const digest = await sha256(partial);
    if (stat.size !== item.bytes || digest !== item.sha256) throw new Error(`integrity mismatch for ${item.fileName}`);
    fs.renameSync(partial, destination);
    return `saved ${item.fileName}`;
  } catch (error) {
    fs.rmSync(partial, { force: true });
    throw error;
  }
}

async function main() {
  let cursor = 0;
  let completed = 0;
  async function worker() {
    while (cursor < manifest.files.length) {
      const item = manifest.files[cursor++];
      console.log(await fetchOne(item));
      completed++;
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  console.log(`Verified ${completed}/${manifest.fileCount} curriculum PDFs in ${outputDir}`);
}

main().catch(error => { console.error(error); process.exit(1); });
