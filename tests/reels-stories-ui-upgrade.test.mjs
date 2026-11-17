import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const read = (p) => readFile(new URL('../' + p, import.meta.url), 'utf8');

function extractInlineScript(html) {
  const matches = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  return matches.map((m) => m[1]).join('\n');
}

test('Reels & Stories CSS enforce responsive 9:16 framing across phone, iPad, and desktop web', async () => {
  const reelsCss = await read('reels-v2.css');
  const storiesCss = await read('stories-reels-polish.css');

  assert.match(reelsCss, /aspect-ratio:\s*9\/16!important/);
  assert.match(reelsCss, /@media\(max-width:1024px\)\s+and\s+\(min-width:651px\)/);
  assert.match(reelsCss, /@media\(max-width:650px\)/);
  assert.match(reelsCss, /env\(safe-area-inset-bottom\)/);

  assert.match(storiesCss, /aspect-ratio:\s*9\/16!important/);
  assert.match(storiesCss, /@media\(max-width:1024px\)\s+and\s+\(min-width:651px\)/);
  assert.match(storiesCss, /@media\(max-width:650px\)/);
  assert.match(storiesCss, /\.story-media-stage>\.fallback\{/);
});

test('Action buttons are compactly overlaid on the video and support touch-to-hide CSS', async () => {
  const reelsCss = await read('reels-v2.css');
  const storiesCss = await read('stories-reels-polish.css');

  assert.match(reelsCss, /\.reel-card\s+\.actions\{[\s\S]*position:\s*absolute!important/);
  assert.match(reelsCss, /width:\s*40px!important/);
  assert.match(reelsCss, /\.reel-pill-btn\{[\s\S]*width:\s*32px!important/);
  assert.match(reelsCss, /\.reel-card\[data-ui-hidden="true"\]\s+\.actions/);
  assert.match(reelsCss, /\.reel-card\[data-play-state="playing"\]\s+\.reel-center-play\{\s*pointer-events:\s*none;/);
  assert.match(reelsCss, /\.reel-progress\{[\s\S]*direction:\s*ltr;/);

  assert.match(storiesCss, /\.story-mini-btn\{[\s\S]*width:\s*30px!important/);
  assert.match(storiesCss, /\.story-card\[data-ui-hidden="true"\]\s+\.story-owner/);
  assert.match(storiesCss, /\.story-card\[data-play-state="playing"\]\s+\.story-play-btn\{\s*pointer-events:\s*none\s*\}/);
});

test('Reels and Stories JS/HTML eliminate blocking browser dialogs and preserve existing APIs', async () => {
  const reelsHtml = await read('reels.html');
  const reelsJs = await read('reels-v2.js');
  const storiesHtml = await read('stories.html');

  assert.doesNotMatch(reelsJs, /\bwindow\.(alert|confirm|prompt)\b/);
  assert.doesNotMatch(storiesHtml, /\b(window\.)?(alert|confirm|prompt)\s*\(/);

  // Existing auth, upload, and backend APIs preserved
  assert.match(reelsHtml, /auth-guard\.js/);
  assert.match(reelsHtml, /cloudflare-upload\.js/);
  assert.match(reelsHtml, /licensed-audio-library\.js/);
  assert.match(reelsJs, /\/api\/reels/);
  assert.match(reelsJs, /\/api\/posts/);
  assert.match(reelsJs, /uploadMediaToCloudflare/);
  assert.match(reelsJs, /captureVideoPoster/);

  assert.match(storiesHtml, /auth-guard\.js/);
  assert.match(storiesHtml, /cloudflare-upload\.js/);
  assert.match(storiesHtml, /licensed-audio-library\.js/);
  assert.match(storiesHtml, /\/api\/stories/);
  assert.match(storiesHtml, /\/api\/users\/me/);
  assert.match(storiesHtml, /capturePoster/);
});

test('ShnoLicensedAudio catalog & picker UI filter, preview, select, and clear generated audio tracks', async () => {
  const libCode = await read('licensed-audio-library.js');
  const dom = new JSDOM('<!doctype html><html dir="rtl"><body><div id="picker"></div></body></html>', {
    url: 'https://example.test/reels.html',
    runScripts: 'dangerously'
  });
  dom.window.eval(libCode);

  const lib = dom.window.ShnoLicensedAudio;
  assert.ok(lib, 'ShnoLicensedAudio should mount on window');
  const musicTracks = lib.list('music');
  const sfxTracks = lib.list('sfx');
  assert.ok(musicTracks.length >= 6, 'At least 6 generated audio music tracks');
  assert.ok(sfxTracks.length >= 6, 'At least 6 generated audio sound effects');
  for (const t of lib.TRACKS) {
    assert.match(t.license, /صوت مولّد برمجياً/);
  }

  let lastChange = null;
  const pickerEl = dom.window.document.getElementById('picker');
  const controller = lib.createPickerUI(pickerEl, {
    onChange: (sel) => { lastChange = sel; }
  });

  assert.equal(pickerEl.querySelectorAll('.shno-audio-row').length, lib.TRACKS.length);

  // Filter by SFX tab
  pickerEl.querySelector('[data-cat="sfx"]').click();
  assert.equal(pickerEl.querySelectorAll('.shno-audio-row').length, sfxTracks.length);

  // Pick an SFX
  const firstSfxBtn = pickerEl.querySelector('[data-pick^="sfx-"]');
  firstSfxBtn.click();
  assert.equal(lastChange.sfxId, firstSfxBtn.dataset.pick);
  assert.equal(pickerEl.querySelector('.shno-audio-selected').hidden, false);

  // Filter by Music tab and pick music
  pickerEl.querySelector('[data-cat="music"]').click();
  assert.equal(pickerEl.querySelectorAll('.shno-audio-row').length, musicTracks.length);
  const firstMusicBtn = pickerEl.querySelector('[data-pick]');
  firstMusicBtn.click();
  assert.equal(lastChange.musicId, firstMusicBtn.dataset.pick);

  // Search filter
  const search = pickerEl.querySelector('.shno-audio-search');
  search.value = 'بغداد';
  search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.ok(pickerEl.querySelectorAll('.shno-audio-row').length >= 1);
  assert.ok(pickerEl.querySelectorAll('.shno-audio-row').length < musicTracks.length);

  // Clear selection
  controller.clear();
  assert.equal(controller.getSelection().musicId, '');
  assert.equal(controller.getSelection().sfxId, '');
});

test('Reels UI loads feed, renders preview poster layer, studio overlays, and toggles UI on video touch', async () => {
  const reelsHtml = await read('reels.html');
  const libCode = await read('licensed-audio-library.js');
  const reelsJs = await read('reels-v2.js');

  const dom = new JSDOM(reelsHtml.replace(/<script\b[^>]*\bsrc=[^>]*><\/script>/gi, ''), {
    url: 'https://example.test/reels.html?create=1',
    runScripts: 'dangerously'
  });
  const win = dom.window;
  win.shnoSessionReady = Promise.resolve(true);
  win.uploadMediaToCloudflare = async () => 'up-1';
  win.HTMLMediaElement.prototype.play = async function () {
    this.dispatchEvent(new win.Event('play'));
  };
  win.HTMLMediaElement.prototype.pause = function () {
    this.dispatchEvent(new win.Event('pause'));
  };
  win.fetch = async (url) => {
    if (String(url).endsWith('/api/reels')) {
      return {
        ok: true,
        json: async () => ({
          reels: [{
            id: 'reel-101',
            text: 'تجربة الريل المطور',
            author: { id: 'u1', fullName: 'علي العراقي', username: 'ali' },
            likes: 7,
            commentsCount: 2,
            liked: false,
            saved: false,
            canDelete: true,
            media: [{ type: 'video', mimeType: 'video/mp4', url: '/uploads/demo.mp4' }]
          }]
        })
      };
    }
    return { ok: true, json: async () => ({}) };
  };

  win.eval(libCode);
  win.eval(reelsJs);
  await new Promise((r) => setTimeout(r, 30));

  // ?create=1 auto-opens studio
  assert.equal(win.document.getElementById('upload').classList.contains('open'), true);

  // Inline overlay composer works without prompt()
  const overlayInput = win.document.getElementById('reelOverlayText');
  overlayInput.value = 'مساء الخير يا بغداد';
  win.document.getElementById('addReelOverlayText').click();
  assert.equal(win.document.querySelectorAll('#reelEditorOverlays .studio-overlay-item').length, 1);

  // Reel card renders video preview poster layer & compact overlaid actions
  const card = win.document.querySelector('.reel-card');
  assert.ok(card, 'Reel card rendered');
  assert.ok(card.querySelector('.reel-poster-layer .reel-center-play'));
  assert.ok(card.querySelector('.reel-top-controls [data-reel-play-toggle]'));
  assert.ok(card.querySelector('.reel-top-controls [data-reel-fit]'));
  assert.ok(card.querySelector('.reel-top-controls [data-reel-toggle-ui]'));
  assert.ok(card.querySelector('.reel-progress'));
  assert.equal(card.dataset.uiHidden, 'false');

  // Clicking stage starts paused video, then second touch toggles buttons visibility
  const stage = card.querySelector('.reel-stage');
  Object.defineProperty(card.querySelector('video'), 'paused', { get: () => false, configurable: true });
  stage.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.equal(card.dataset.uiHidden, 'true');
  stage.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.equal(card.dataset.uiHidden, 'false');

  // Inline delete bar toggles cleanly instead of confirm()
  card.querySelector('.action.delete').click();
  assert.equal(card.querySelector('.reel-confirm-bar').hidden, false);
  card.querySelector('[data-cancel-delete]').click();
  assert.equal(card.querySelector('.reel-confirm-bar').hidden, true);
});

test('Stories deck & editor add inline overlays, render poster preview, toggle UI on touch, and guard swipe clicks', async () => {
  const storiesHtml = await read('stories.html');
  const libCode = await read('licensed-audio-library.js');
  const deckCode = await read('stories-deck.js');
  const inlineJs = extractInlineScript(storiesHtml);

  const dom = new JSDOM(storiesHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''), {
    url: 'https://example.test/stories.html',
    runScripts: 'dangerously'
  });
  const win = dom.window;
  win.shnoSessionReady = Promise.resolve(true);
  win.uploadMediaToCloudflare = async () => 'up-story-1';
  win.HTMLMediaElement.prototype.play = async function () {
    this.dispatchEvent(new win.Event('play'));
  };
  win.HTMLMediaElement.prototype.pause = function () {
    this.dispatchEvent(new win.Event('pause'));
  };
  win.fetch = async (url) => {
    if (String(url).endsWith('/api/stories')) {
      return {
        ok: true,
        json: async () => ({
          stories: [
            {
              id: 'st-1',
              text: 'قصة فيديو أولى',
              createdAt: new Date().toISOString(),
              author: { id: 'u1', fullName: 'سارة' },
              overlays: [{ kind: 'text', value: 'بغداد', x: 50, y: 50, size: 30 }],
              media: [{ type: 'video', url: '/uploads/s1.mp4' }]
            },
            {
              id: 'st-2',
              text: 'قصة نصية ثانية',
              createdAt: new Date().toISOString(),
              author: { id: 'u2', fullName: 'نور' },
              overlays: [],
              media: []
            }
          ]
        })
      };
    }
    if (String(url).endsWith('/api/users/me')) {
      return { ok: true, json: async () => ({ user: { id: 'u1', fullName: 'سارة' } }) };
    }
    return { ok: true, json: async () => ({}) };
  };

  win.eval(libCode);
  win.eval(deckCode);
  win.eval(inlineJs);
  await new Promise((r) => setTimeout(r, 35));

  // Editor inline text & filter chips work
  const textInput = win.document.getElementById('inlineOverlayInput');
  textInput.value = 'أهلاً بالجميع';
  win.document.getElementById('addText').click();
  assert.equal(win.document.querySelectorAll('#editor .overlay').length, 1);

  const cards = [...win.document.querySelectorAll('#storyGrid .story-card')];
  assert.equal(cards.length, 2);
  assert.equal(cards[0].classList.contains('is-active'), true);
  assert.equal(cards[0].dataset.uiHidden, 'false');
  assert.ok(cards[0].querySelector('.story-play-overlay .story-play-btn'));
  assert.ok(cards[0].querySelector('[data-story-toggle-ui]'));

  // Tap story stage toggles controls visibility
  cards[0].querySelector('.story-media-stage').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.equal(cards[0].dataset.uiHidden, 'true');
  cards[0].querySelector('.story-media-stage').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.equal(cards[0].dataset.uiHidden, 'false');

  // Swipe left switches to story 2 and ignores immediate trailing click
  const grid = win.document.getElementById('storyGrid');
  grid.dispatchEvent(new win.MouseEvent('pointerdown', { bubbles: true, clientX: 240, clientY: 200 }));
  grid.dispatchEvent(new win.MouseEvent('pointerup', { bubbles: true, clientX: 120, clientY: 205 }));
  assert.equal(cards[1].classList.contains('is-active'), true);
  cards[0].querySelector('.story-media-stage').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.equal(cards[1].classList.contains('is-active'), true, 'Trailing swipe click must not snap back to story 1');
});

test('Cloudflare Pages build ships licensed-audio-library.js alongside Reels and Stories', async () => {
  const libDist = await read('dist/licensed-audio-library.js');
  assert.match(libDist, /ShnoLicensedAudio/);
});
