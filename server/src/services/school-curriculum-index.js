'use strict';

/**
 * Iraqi Curriculum Index & Retrieval Service
 * Provides full text retrieval, subject coverage, and seamless integration
 * between the 136 Iraqi curriculum PDFs, SchoolKnowledgeSource, and the Virtual Classroom.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const PAGES_PATH = path.join(ROOT, 'server/src/data/iraqi-curriculum-pages.json');
const REPORT_PATH = path.join(ROOT, 'server/src/data/iraqi-curriculum-index-report.json');
const CATALOG_PATH = path.join(ROOT, 'server/src/data/iraqi-curriculum-catalog.js');
const FILES_PATH = path.join(ROOT, 'server/src/data/iraqi-curriculum-files.json');

let cachedPagesData = null;

function loadPagesData() {
  if (cachedPagesData) return cachedPagesData;
  if (!fs.existsSync(PAGES_PATH)) {
    return { pages: [], totalPagesExtracted: 0 };
  }
  try {
    cachedPagesData = JSON.parse(fs.readFileSync(PAGES_PATH, 'utf8'));
    return cachedPagesData;
  } catch (err) {
    console.error('Failed to parse curriculum pages cache:', err.message);
    return { pages: [], totalPagesExtracted: 0 };
  }
}

function normalizeArabic(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(s) {
  return new Set(normalizeArabic(s).split(' ').filter(x => x.length > 2));
}

function snippet(text, query, maxLen = 400) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const qw = [...words(query)];
  let best = 0;
  for (const w of qw) {
    const i = normalizeArabic(clean).indexOf(w);
    if (i >= 0) {
      best = i;
      break;
    }
  }
  const start = Math.max(0, best - 60);
  const out = clean.slice(start, start + maxLen);
  return (start ? '… ' : '') + out + (start + maxLen < clean.length ? ' …' : '');
}

/**
 * Search the indexed curriculum pages across all subjects, grades, and stages.
 */
function searchCurriculum(params = {}) {
  const data = loadPagesData();
  const pages = data.pages || [];
  if (!pages.length) return [];

  const stage = params.stage ? String(params.stage).trim() : '';
  const grade = params.grade ? String(params.grade).trim() : '';
  const subject = params.subject ? String(params.subject).trim() : '';
  const lesson = params.lesson ? String(params.lesson).trim() : '';
  const query = params.query ? String(params.query).trim() : '';
  const limit = Math.max(1, Math.min(50, Number(params.limit) || 6));

  const normStage = normalizeArabic(stage);
  const normGrade = normalizeArabic(grade);
  const normSubject = normalizeArabic(subject);
  const normQuery = normalizeArabic(query || lesson);
  const qWords = words(normQuery);

  const matched = [];

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];

    // Filter by stage if specified
    if (normStage && normalizeArabic(p.stage) !== normStage) continue;

    // Filter by grade if specified
    if (normGrade) {
      const pGrade = normalizeArabic(p.grade);
      if (pGrade !== normGrade && !pGrade.includes(normGrade) && !normGrade.includes(pGrade)) {
        continue;
      }
    }

    // Filter by subject if specified
    if (normSubject) {
      const pSubject = normalizeArabic(p.subject);
      if (pSubject !== normSubject && !pSubject.includes(normSubject) && !normSubject.includes(pSubject)) {
        continue;
      }
    }

    // Score page relevance
    let score = 0;
    const contentNorm = normalizeArabic(p.content);
    const lessonNorm = normalizeArabic(p.lesson);
    const chapterNorm = normalizeArabic(p.chapter);

    if (normQuery) {
      if (contentNorm.includes(normQuery)) score += 30;
      if (lessonNorm.includes(normQuery)) score += 40;
      if (chapterNorm.includes(normQuery)) score += 20;

      for (const w of qWords) {
        if (contentNorm.includes(w)) score += 3;
        if (lessonNorm.includes(w)) score += 8;
        if (chapterNorm.includes(w)) score += 5;
      }
    } else {
      score = 1;
    }

    if (score > 0 || !normQuery) {
      matched.push({
        score,
        bookId: p.bookId,
        bookTitle: p.bookTitle,
        stage: p.stage,
        grade: p.grade,
        subject: p.subject,
        chapter: p.chapter,
        lesson: p.lesson,
        page: p.page,
        content: p.content,
        snippet: snippet(p.content, query || lesson),
        fileName: p.fileName
      });
    }
  }

  matched.sort((a, b) => b.score - a.score || a.page - b.page);
  return matched.slice(0, limit);
}

/**
 * Sync extracted curriculum pages into MongoDB SchoolKnowledgeSource idempotently.
 */
async function syncToKnowledgeSource(KnowledgeModel, options = {}) {
  if (!KnowledgeModel) throw new Error('SchoolKnowledgeSource model is required');
  const data = loadPagesData();
  const pages = data.pages || [];
  if (!pages.length) return { inserted: 0, total: 0 };

  const limit = options.limit ? Math.min(pages.length, Number(options.limit)) : pages.length;
  const targetPages = pages.slice(0, limit);

  const batchSize = Math.max(10, Math.min(1000, Number(options.batchSize) || 500));
  let modifiedCount = 0;
  let upsertedCount = 0;

  for (let i = 0; i < targetPages.length; i += batchSize) {
    const chunk = targetPages.slice(i, i + batchSize);
    const ops = chunk.map(p => ({
      updateOne: {
        filter: {
          stage: p.stage,
          grade: p.grade,
          subject: p.subject,
          page: String(p.page),
          'file.originalName': p.fileName
        },
        update: {
          $set: {
            title: `${p.bookTitle} — ص ${p.page}`,
            sourceType: 'official_textbook',
            stage: p.stage,
            grade: p.grade,
            subject: p.subject,
            chapter: p.chapter || '',
            lesson: p.lesson || ('صفحة ' + p.page),
            year: 2026,
            page: String(p.page),
            content: p.content,
            sourceUrl: `/uploads/school-curriculum/${p.fileName}`,
            verified: true,
            keywords: [
              p.stage,
              p.grade,
              p.subject,
              p.bookId,
              `bookId:${p.bookId}`,
              `page:${p.page}`
            ],
            file: {
              url: `/uploads/school-curriculum/${p.fileName}`,
              originalName: p.fileName,
              mimeType: 'application/pdf',
              size: p.bytes || 0
            }
          }
        },
        upsert: true
      }
    }));

    const res = await KnowledgeModel.bulkWrite(ops, { ordered: false });
    upsertedCount += res.upsertedCount || 0;
    modifiedCount += res.modifiedCount || 0;
  }

  return {
    total: targetPages.length,
    upserted: upsertedCount,
    modified: modifiedCount
  };
}

/**
 * Return index statistics and health report.
 */
function getCurriculumStats() {
  if (fs.existsSync(REPORT_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
    } catch (_) {}
  }

  const catalog = require(CATALOG_PATH);
  const filesManifest = require(FILES_PATH);
  const pagesData = loadPagesData();

  return {
    catalogTotal: catalog.items.length,
    manifestFiles: filesManifest.files.length,
    extractedPagesCount: pagesData.pages.length,
    pdfsProcessed: filesManifest.files.length,
    pdfsSuccessfulWithText: pagesData.successfulPdfs || 0,
    pdfsScannedWithoutText: pagesData.failedPdfs || 0
  };
}

module.exports = {
  loadPagesData,
  searchCurriculum,
  syncToKnowledgeSource,
  getCurriculumStats,
  normalizeArabic
};
