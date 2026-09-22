'use strict';

/* Fetch the Arabic book title for each curriculum file from its source page.
 * Resumable: skips titles already fetched (checkpointed in titles.json).
 */

const https = require('node:https');
const { MANIFEST, TITLES, loadJson, saveJson } = require('./util');

const manifest = loadJson(MANIFEST);
const titles = loadJson(TITLES, { version: 1, books: {} });

function fetch(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'));
    https.get(url, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume();
        return resolve(fetch(new URL(res.headers.location, url).toString(), redirects + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => { body += c; });
      res.on('end', () => resolve(body));
    }).on('error', reject).setTimeout(30000, function () { this.destroy(new Error('timeout')); });
  });
}

function stripTags(s) { return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

function extract(html) {
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html)
       || /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i.exec(html);
  const title = (t && stripTags(t[1])) || null;
  const heading = (h1 && stripTags(h1[1])) || null;
  const ogTitle = (og && stripTags(og[1])) || null;
  return { title: heading || ogTitle || title, pageTitle: title };
}

async function main() {
  const pending = manifest.files.filter(f => !titles.books[f.fileName]);
  console.log(`titles: ${Object.keys(titles.books).length} cached, ${pending.length} to fetch`);
  let cursor = 0, errors = 0;
  async function worker() {
    while (cursor < pending.length) {
      const f = pending[cursor++];
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const html = await fetch(f.sourcePage);
          const meta = extract(html);
          titles.books[f.fileName] = {
            title: meta.title, pageTitle: meta.pageTitle, sourcePage: f.sourcePage,
            fetchedAt: new Date().toISOString()
          };
          break;
        } catch (e) {
          if (attempt === 3) {
            errors++;
            titles.books[f.fileName] = { title: null, error: String(e).slice(0, 200), sourcePage: f.sourcePage };
          } else {
            await new Promise(r => setTimeout(r, 1000 * attempt));
          }
        }
      }
      if ((cursor % 20) === 0) { saveJson(TITLES, titles); console.log(`titles progress: ${cursor}/${pending.length}`); }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  saveJson(TITLES, titles);
  const missing = Object.values(titles.books).filter(b => !b.title).length;
  console.log(`titles done: ${Object.keys(titles.books).length} books, ${missing} without title, ${errors} fetch errors`);
}

main().catch(e => { console.error(e); process.exit(1); });
