(() => {
  'use strict';

  const API = window.location.origin;
  const feed = document.getElementById('feed');
  const form = document.getElementById('upload');
  const clip = document.getElementById('clip');
  const preview = document.getElementById('preview');
  const note = document.getElementById('note');
  const sheet = document.getElementById('commentsSheet');
  const commentsList = document.getElementById('commentsList');
  const commentForm = document.getElementById('commentForm');
  const toastEl = document.getElementById('reelToast');

  const studio = document.getElementById('reelStudio');
  const stageEl = document.getElementById('reelEditorStage');
  const overlaysEl = document.getElementById('reelEditorOverlays');
  const audioPreviewEl = document.getElementById('reelAudioPreview');
  const audioTitleEl = document.getElementById('reelAudioTitle');
  const playToggleBtn = document.getElementById('editorPlayToggle');
  const fitToggleBtn = document.getElementById('editorFitToggle');
  const timeInfoEl = document.getElementById('editorTimeInfo');
  const trimStartInput = document.getElementById('trimStart');
  const trimEndInput = document.getElementById('trimEnd');
  const coverTimeInput = document.getElementById('coverTime');
  const trimStartLabel = document.getElementById('trimStartLabel');
  const trimEndLabel = document.getElementById('trimEndLabel');
  const coverTimeLabel = document.getElementById('coverTimeLabel');
  const origVolInput = document.getElementById('origVolume');
  const musicVolInput = document.getElementById('musicVolume');
  const origVolLabel = document.getElementById('origVolLabel');
  const musicVolLabel = document.getElementById('musicVolLabel');
  const clipNameEl = document.getElementById('clipName');

  const FILTERS = [
    { id: 'none', name: 'أصلي', css: 'none' },
    { id: 'warm', name: 'دافئ', css: 'sepia(0.28) saturate(1.3) brightness(1.04)' },
    { id: 'cool', name: 'بارد', css: 'hue-rotate(14deg) saturate(1.12) contrast(1.06)' },
    { id: 'cinema', name: 'سينما', css: 'contrast(1.22) saturate(0.9) brightness(0.95)' },
    { id: 'noir', name: 'أبيض وأسود', css: 'grayscale(1) contrast(1.18)' },
    { id: 'vivid', name: 'مشرق', css: 'saturate(1.48) contrast(1.08) brightness(1.05)' }
  ];
  const STICKERS = ['🔥', '❤️', '😂', '✨', '🇮🇶', '🎵', '👏', '🎉', '😎', '🌟', '💯', '☕'];

  let commentReel = '';
  let globalMuted = false;
  let toastTimer = null;
  let selectedFilter = 'none';
  let selectedFit = 'contain';
  let selectedColor = '#ffffff';
  let editorOverlays = [];
  let selectedOverlayIndex = -1;
  let audioSelection = { musicId: '', sfxId: '' };
  let audioPicker = null;
  let currentFileIsAudio = false;

  const esc = (v) => String(v || '').replace(/[&<>"']/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
  const abs = (u) => (!u ? '' : /^https?:/i.test(u) ? u : API + u);

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600);
  }

  function formatSec(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  async function api(p, o = {}) {
    if (window.shnoSessionReady && !(await window.shnoSessionReady)) throw Error('سجّل دخولك أولاً');
    o.credentials = 'same-origin';
    o.headers = Object.assign({ Accept: 'application/json' }, o.headers || {});
    const r = await fetch(API + p, o);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(d.message || 'تعذر تنفيذ الطلب');
    return d;
  }

  function captureVideoPoster(video, ambientEl, targetTime) {
    if (!video || video.dataset.posterCaptured === '1') return;
    const seekAt = Number.isFinite(targetTime)
      ? targetTime
      : (Number.isFinite(video.duration) && video.duration > 0 ? Math.min(0.18, video.duration / 3) : 0.08);

    const drawThumb = () => {
      try {
        if (!video.videoWidth || !video.videoHeight) return;
        const c = document.createElement('canvas');
        const scale = Math.min(1, 540 / video.videoWidth);
        c.width = Math.max(1, Math.round(video.videoWidth * scale));
        c.height = Math.max(1, Math.round(video.videoHeight * scale));
        const ctx = c.getContext('2d');
        ctx.drawImage(video, 0, 0, c.width, c.height);
        const dataUrl = c.toDataURL('image/jpeg', 0.8);
        video.poster = dataUrl;
        video.dataset.posterCaptured = '1';
        if (ambientEl) ambientEl.style.backgroundImage = `url("${dataUrl}")`;
      } catch (_) {}
    };

    if (video.readyState >= 2 && video.currentTime >= 0.04) {
      drawThumb();
      return;
    }

    const onSeeked = () => drawThumb();
    video.addEventListener('seeked', onSeeked, { once: true });
    const onLoaded = () => {
      try {
        if (video.paused && Number.isFinite(video.duration) && video.duration > 0.05) {
          video.currentTime = Math.min(seekAt, Math.max(0.05, video.duration - 0.05));
        } else {
          drawThumb();
        }
      } catch (_) {
        drawThumb();
      }
    };
    if (video.readyState >= 1) onLoaded();
    else video.addEventListener('loadeddata', onLoaded, { once: true });
  }

  /* =====================================================
     REELS STUDIO EDITOR
     ===================================================== */
  function openStudio(open) {
    form.classList.toggle('open', open);
    if (!open && window.ShnoLicensedAudio) window.ShnoLicensedAudio.stopPreview();
  }

  document.getElementById('create').onclick = () => openStudio(!form.classList.contains('open'));
  const closeEditorBtn = document.getElementById('closeEditor');
  if (closeEditorBtn) closeEditorBtn.onclick = () => openStudio(false);

  if (new URLSearchParams(location.search).get('create') === '1') {
    openStudio(true);
  }

  function renderFilterChips() {
    const box = document.getElementById('reelFilters');
    if (!box) return;
    box.innerHTML = FILTERS.map((f) =>
      `<button type="button" class="filter-chip ${selectedFilter === f.id ? 'is-active' : ''}" data-filter-id="${f.id}">${f.name}</button>`
    ).join('');
    box.onclick = (e) => {
      const btn = e.target.closest('[data-filter-id]');
      if (!btn) return;
      selectedFilter = btn.dataset.filterId;
      const f = FILTERS.find((x) => x.id === selectedFilter);
      preview.style.filter = f ? f.css : 'none';
      renderFilterChips();
    };
  }

  function renderStickerButtons() {
    const box = document.getElementById('reelStickers');
    if (!box) return;
    box.innerHTML = STICKERS.map((s) => `<button type="button" data-sticker="${s}">${s}</button>`).join('');
    box.onclick = (e) => {
      const btn = e.target.closest('[data-sticker]');
      if (!btn) return;
      editorOverlays.push({
        kind: 'emoji',
        value: btn.dataset.sticker,
        x: 50,
        y: 45,
        size: Number(document.getElementById('reelOverlaySize')?.value || 32),
        color: '#ffffff'
      });
      selectedOverlayIndex = editorOverlays.length - 1;
      renderEditorOverlays();
    };
  }

  function renderEditorOverlays() {
    if (!overlaysEl) return;
    overlaysEl.innerHTML = '';
    editorOverlays.forEach((o, idx) => {
      const el = document.createElement('span');
      el.className = 'studio-overlay-item' + (idx === selectedOverlayIndex ? ' is-selected' : '');
      el.textContent = o.value;
      el.style.left = o.x + '%';
      el.style.top = o.y + '%';
      el.style.fontSize = o.size + 'px';
      el.style.color = o.color || '#ffffff';

      let dragging = false;
      el.onpointerdown = (ev) => {
        ev.stopPropagation();
        dragging = true;
        selectedOverlayIndex = idx;
        el.setPointerCapture?.(ev.pointerId);
      };
      el.onpointermove = (ev) => {
        if (!dragging) return;
        const rect = stageEl.getBoundingClientRect();
        o.x = Math.max(8, Math.min(92, ((ev.clientX - rect.left) / rect.width) * 100));
        o.y = Math.max(8, Math.min(92, ((ev.clientY - rect.top) / rect.height) * 100));
        el.style.left = o.x + '%';
        el.style.top = o.y + '%';
      };
      el.onpointerup = () => { dragging = false; };
      el.ondblclick = (ev) => {
        ev.stopPropagation();
        editorOverlays.splice(idx, 1);
        selectedOverlayIndex = -1;
        renderEditorOverlays();
      };
      overlaysEl.appendChild(el);
    });
  }

  document.querySelectorAll('[data-studio-tab]').forEach((tab) => {
    tab.onclick = () => {
      const name = tab.dataset.studioTab;
      document.querySelectorAll('[data-studio-tab]').forEach((t) => t.classList.toggle('is-active', t === tab));
      document.querySelectorAll('[data-studio-panel]').forEach((p) => { p.hidden = p.dataset.studioPanel !== name; });
    };
  });

  const addOverlayBtn = document.getElementById('addReelOverlayText');
  if (addOverlayBtn) {
    addOverlayBtn.onclick = () => {
      const input = document.getElementById('reelOverlayText');
      const val = (input?.value || '').trim();
      if (!val) return;
      editorOverlays.push({
        kind: 'text',
        value: val,
        x: 50,
        y: 50,
        size: Number(document.getElementById('reelOverlaySize')?.value || 28),
        color: selectedColor
      });
      selectedOverlayIndex = editorOverlays.length - 1;
      input.value = '';
      renderEditorOverlays();
    };
  }

  const swatchesEl = document.getElementById('reelColorSwatches');
  if (swatchesEl) {
    swatchesEl.onclick = (e) => {
      const b = e.target.closest('[data-color]');
      if (!b) return;
      selectedColor = b.dataset.color;
      swatchesEl.querySelectorAll('[data-color]').forEach((x) => x.classList.toggle('is-active', x === b));
      if (selectedOverlayIndex >= 0 && editorOverlays[selectedOverlayIndex]) {
        editorOverlays[selectedOverlayIndex].color = selectedColor;
        renderEditorOverlays();
      }
    };
  }

  const overlaySizeEl = document.getElementById('reelOverlaySize');
  if (overlaySizeEl) {
    overlaySizeEl.oninput = () => {
      if (selectedOverlayIndex >= 0 && editorOverlays[selectedOverlayIndex]) {
        editorOverlays[selectedOverlayIndex].size = Number(overlaySizeEl.value);
        renderEditorOverlays();
      }
    };
  }

  const clearOverlaysBtn = document.getElementById('clearReelOverlays');
  if (clearOverlaysBtn) {
    clearOverlaysBtn.onclick = () => {
      editorOverlays = [];
      selectedOverlayIndex = -1;
      renderEditorOverlays();
    };
  }

  if (fitToggleBtn) {
    fitToggleBtn.onclick = () => {
      selectedFit = selectedFit === 'contain' ? 'cover' : 'contain';
      stageEl.dataset.fit = selectedFit;
      fitToggleBtn.textContent = selectedFit === 'cover' ? '⛶ ملء' : '⛶ احتواء';
    };
  }

  if (playToggleBtn) {
    playToggleBtn.onclick = () => {
      if (currentFileIsAudio) return;
      if (preview.paused) {
        const start = Number(trimStartInput.value || 0);
        if (preview.currentTime < start || preview.currentTime >= Number(trimEndInput.value || preview.duration)) {
          preview.currentTime = start;
        }
        preview.muted = false;
        preview.volume = (Number(origVolInput.value || 100)) / 100;
        preview.play().catch(() => {});
        playToggleBtn.textContent = '⏸';
      } else {
        preview.pause();
        playToggleBtn.textContent = '▶';
      }
    };
  }

  if (origVolInput) origVolInput.oninput = () => {
    origVolLabel.textContent = origVolInput.value + '%';
    preview.volume = Number(origVolInput.value) / 100;
  };
  if (musicVolInput) musicVolInput.oninput = () => {
    musicVolLabel.textContent = musicVolInput.value + '%';
  };

  if (trimStartInput) {
    trimStartInput.oninput = () => {
      const s = Number(trimStartInput.value);
      const e = Number(trimEndInput.value);
      if (s >= e) trimStartInput.value = Math.max(0, e - 0.5).toFixed(1);
      trimStartLabel.textContent = Number(trimStartInput.value).toFixed(1);
      if (!currentFileIsAudio && Number.isFinite(preview.duration)) preview.currentTime = Number(trimStartInput.value);
    };
  }
  if (trimEndInput) {
    trimEndInput.oninput = () => {
      const s = Number(trimStartInput.value);
      const e = Number(trimEndInput.value);
      if (e <= s) trimEndInput.value = Math.min(preview.duration || 60, s + 0.5).toFixed(1);
      trimEndLabel.textContent = Number(trimEndInput.value).toFixed(1);
    };
  }
  if (coverTimeInput) {
    coverTimeInput.oninput = () => {
      const t = Number(coverTimeInput.value);
      coverTimeLabel.textContent = t.toFixed(1);
      if (!currentFileIsAudio && Number.isFinite(preview.duration)) {
        preview.pause();
        playToggleBtn.textContent = '▶';
        preview.currentTime = Math.min(preview.duration, t);
      }
    };
  }

  preview.ontimeupdate = () => {
    const dur = preview.duration || 0;
    timeInfoEl.textContent = `${formatSec(preview.currentTime)} / ${formatSec(dur)}`;
    const end = Number(trimEndInput.value || dur);
    if (!preview.paused && end > 0 && preview.currentTime >= end) {
      preview.currentTime = Number(trimStartInput.value || 0);
    }
  };

  if (window.ShnoLicensedAudio && document.getElementById('reelAudioLibrary')) {
    audioPicker = window.ShnoLicensedAudio.createPickerUI(document.getElementById('reelAudioLibrary'), {
      onChange: (sel) => { audioSelection = sel; }
    });
  }
  renderFilterChips();
  renderStickerButtons();

  clip.onchange = () => {
    const f = clip.files[0];
    if (!f) {
      preview.hidden = true;
      if (studio) studio.hidden = true;
      return;
    }
    if (clipNameEl) clipNameEl.textContent = `${f.name} (${(f.size / (1024 * 1024)).toFixed(1)} MB)`;
    currentFileIsAudio = f.type.startsWith('audio/') || /\.mp3$/i.test(f.name);
    if (studio) studio.hidden = false;

    if (currentFileIsAudio) {
      preview.hidden = true;
      audioPreviewEl.hidden = false;
      audioTitleEl.textContent = f.name;
      playToggleBtn.hidden = true;
      document.getElementById('reelTrimBox').hidden = true;
    } else {
      audioPreviewEl.hidden = true;
      playToggleBtn.hidden = false;
      document.getElementById('reelTrimBox').hidden = false;
      preview.dataset.posterCaptured = '';
      preview.removeAttribute('poster');
      preview.src = URL.createObjectURL(f);
      preview.hidden = false;
      preview.onloadedmetadata = () => {
        const dur = Math.max(1, Number(preview.duration || 10));
        trimStartInput.max = dur.toFixed(1);
        trimEndInput.max = dur.toFixed(1);
        coverTimeInput.max = dur.toFixed(1);
        trimStartInput.value = '0';
        trimEndInput.value = dur.toFixed(1);
        coverTimeInput.value = Math.min(0.2, dur / 3).toFixed(1);
        trimStartLabel.textContent = '0.0';
        trimEndLabel.textContent = dur.toFixed(1);
        coverTimeLabel.textContent = coverTimeInput.value;
        timeInfoEl.textContent = `0:00 / ${formatSec(dur)}`;
        captureVideoPoster(preview, null, Number(coverTimeInput.value));
      };
      preview.onerror = () => {
        note.textContent = 'ستظهر المعاينة بعد النشر إذا كانت الصيغة مدعومة من المتصفح.';
      };
    }
  };

  /* =====================================================
     REELS FEED & CUSTOM OVERLAY PLAYER
     ===================================================== */
  function reelMedia(m) {
    const src = esc(abs(m.url));
    const poster = m.posterUrl || m.thumbnailUrl ? ` poster="${esc(abs(m.posterUrl || m.thumbnailUrl))}"` : '';
    const audio = m.type === 'audio' || String(m.mimeType || '').startsWith('audio/');
    if (audio) {
      return `
        <div class="audio-reel">
          <div class="audio-art">🎵</div>
          <strong>ريلز صوتي</strong>
          <audio controls preload="metadata" src="${src}"></audio>
          <a href="${src}" download>⬇ تحميل الصوت</a>
        </div>
      `;
    }
    return `
      <div class="reel-stage">
        <div class="reel-ambient"></div>
        <video loop playsinline preload="metadata"${poster} src="${src}#t=0.05"></video>
        <div class="reel-poster-layer">
          <button class="reel-center-play" type="button" aria-label="تشغيل الفيديو">▶</button>
          <span class="reel-preview-tag">معاينة الفيديو</span>
        </div>
        <div class="reel-scrim-bottom"></div>
      </div>
    `;
  }

  function card(r) {
    const u = r.author || {};
    const m = r.media && r.media[0];
    if (!m) return '';
    const isAudio = m.type === 'audio' || String(m.mimeType || '').startsWith('audio/');
    return `
      <article class="reel-card" data-id="${esc(r.id)}" data-play-state="paused" data-ui-hidden="false" data-fit="contain">
        ${reelMedia(m)}
        ${!isAudio ? `
          <div class="reel-hidden-hint">المس الشاشة لإظهار الأزرار</div>
          <div class="reel-top-controls">
            <div class="reel-top-group">
              <button class="reel-pill-btn" type="button" data-reel-play-toggle title="تشغيل أو إيقاف" aria-label="تشغيل أو إيقاف">▶</button>
              <button class="reel-pill-btn" type="button" data-reel-mute aria-label="كتم أو تشغيل الصوت">${globalMuted ? '🔇' : '🔊'}</button>
              <button class="reel-pill-btn" type="button" data-reel-fit title="تبديل أبعاد الفيديو" aria-label="تبديل أبعاد الفيديو">⛶</button>
              <button class="reel-pill-btn" type="button" data-reel-toggle-ui title="إخفاء أو إظهار الأزرار" aria-label="إخفاء أو إظهار الأزرار">👁</button>
            </div>
            <span class="reel-time-pill" data-reel-time>0:00</span>
          </div>
          <div class="reel-progress" data-reel-progress aria-label="شريط التقدم">
            <div class="reel-progress-track"><div class="reel-progress-fill"></div></div>
          </div>
        ` : ''}
        ${r.canDelete ? `
          <div class="reel-confirm-bar" hidden>
            <span>هل تريد حذف هذا الريل نهائياً؟</span>
            <div class="reel-confirm-btns">
              <button type="button" class="reel-confirm-yes" data-confirm-delete>حذف</button>
              <button type="button" class="reel-confirm-no" data-cancel-delete>إلغاء</button>
            </div>
          </div>
        ` : ''}
        <div class="reel-meta">
          <div class="owner">
            <span class="avatar">${esc((u.fullName || '?').slice(0, 1))}</span>
            <strong>${esc(u.fullName || u.username || 'مستخدم')}</strong>
          </div>
          <div class="caption-line">${esc(r.text || '')}</div>
        </div>
        <div class="actions">
          <button class="action like ${r.liked ? 'active' : ''}" type="button" aria-label="إعجاب">
            ${r.liked ? '♥' : '♡'}<small>${Number(r.likes || 0)}</small>
          </button>
          <button class="action comment" type="button" aria-label="التعليقات">
            💬<small>${Number(r.commentsCount || 0)}</small>
          </button>
          <button class="action share" type="button" aria-label="مشاركة">
            ↗<small>مشاركة</small>
          </button>
          <button class="action save ${r.saved ? 'active' : ''}" type="button" aria-label="حفظ">
            🔖<small>${r.saved ? 'محفوظ' : 'حفظ'}</small>
          </button>
          ${r.canDelete ? '<button class="action delete" type="button" title="حذف الريل" aria-label="حذف">🗑<small>حذف</small></button>' : ''}
        </div>
      </article>
    `;
  }

  function togglePlayCard(cardEl) {
    const v = cardEl.querySelector('.reel-stage > video');
    if (!v) return;
    if (v.paused) {
      v.muted = globalMuted;
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }

  let feedObserver;
  function wireFeedCards() {
    if (feedObserver) feedObserver.disconnect();
    if (typeof IntersectionObserver !== 'undefined') {
      feedObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => { if (!entry.isIntersecting) entry.target.pause(); });
      }, { threshold: 0.1 });
    }
    const vs = [...feed.querySelectorAll('.reel-stage > video')];
    vs.forEach((v) => {
      const cardEl = v.closest('.reel-card');
      const ambient = cardEl?.querySelector('.reel-ambient');
      const timeEl = cardEl?.querySelector('[data-reel-time]');
      const fillEl = cardEl?.querySelector('.reel-progress-fill');
      const playBtn = cardEl?.querySelector('.reel-center-play');
      const topPlayBtn = cardEl?.querySelector('[data-reel-play-toggle]');

      captureVideoPoster(v, ambient);
      if (feedObserver) feedObserver.observe(v);

      v.addEventListener('play', () => {
        vs.forEach((other) => { if (other !== v && !other.paused) other.pause(); });
        if (cardEl) cardEl.dataset.playState = 'playing';
        if (playBtn) playBtn.textContent = '⏸';
        if (topPlayBtn) topPlayBtn.textContent = '⏸';
      });
      v.addEventListener('pause', () => {
        if (cardEl) cardEl.dataset.playState = 'paused';
        if (playBtn) playBtn.textContent = '▶';
        if (topPlayBtn) topPlayBtn.textContent = '▶';
      });
      v.addEventListener('timeupdate', () => {
        const dur = v.duration || 0;
        if (timeEl) timeEl.textContent = `${formatSec(v.currentTime)} / ${formatSec(dur)}`;
        if (fillEl && dur > 0) fillEl.style.width = ((v.currentTime / dur) * 100).toFixed(2) + '%';
      });
      v.addEventListener('error', () => {
        cardEl?.remove();
        if (!feed.querySelector('.reel-card')) {
          feed.innerHTML = '<div class="empty">لا توجد ريلز متاحة حالياً.</div>';
        }
      }, { once: true });
    });
  }

  async function load() {
    try {
      const d = await api('/api/reels');
      const a = d.reels || [];
      feed.innerHTML = a.length ? a.map(card).join('') : '<div class="empty">لا توجد ريلز بعد. كن أول من ينشر مقطعاً.</div>';
      wireFeedCards();
      const params = new URLSearchParams(location.search);
      const wanted = params.get('id') || location.hash.slice(1);
      const target = wanted && feed.querySelector('[data-id="' + CSS.escape(wanted) + '"]');
      if (target) {
        target.scrollIntoView({ block: 'center' });
        target.querySelector('video')?.play().catch(() => {});
        if (params.get('comments') === '1') openComments(wanted);
      }
    } catch (e) {
      feed.innerHTML = '<div class="empty bad">' + esc(e.message) + '</div>';
    }
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const rawFile = clip.files[0];
    if (!rawFile) return;
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    note.className = 'note muted';
    try {
      if (rawFile.size > 100 * 1024 * 1024) throw Error('الحد الأقصى للفيديو أو الصوت 100 ميغابايت');
      if (!['video/mp4', 'video/webm', 'audio/mpeg', 'audio/mp3'].includes(rawFile.type)) {
        throw Error('الصيغ المدعومة MP4 أو WebM أو MP3 فقط');
      }
      if (typeof window.uploadMediaToCloudflare !== 'function') throw Error('خدمة الرفع غير محمّلة، حدّث الصفحة');

      let fileToUpload = rawFile;
      const dur = Number(preview.duration || 0);
      const trimmed = !currentFileIsAudio && dur > 0 && (
        Number(trimStartInput.value) > 0.2 ||
        Math.abs(Number(trimEndInput.value) - dur) > 0.3
      );
      if (currentFileIsAudio && (audioSelection.musicId || audioSelection.sfxId)) throw Error('دمج الموسيقى متاح للفيديو؛ ألغِ اختيار الموسيقى لنشر الصوت الأصلي');
      const needsRender = !currentFileIsAudio && (
        Number(origVolInput.value) !== 100 ||
        selectedFilter !== 'none' ||
        editorOverlays.length > 0 ||
        trimmed ||
        Boolean(audioSelection.musicId) ||
        Boolean(audioSelection.sfxId) ||
        selectedFit === 'cover'
      );

      if (needsRender) {
        if (!window.ShnoLicensedAudio || typeof MediaRecorder === 'undefined') {
          throw Error('هذا المتصفح لا يدعم دمج التعديلات والموسيقى. لم يتم نشر الفيديو دون تعديلاتك. جرّب متصفحاً حديثاً.');
        }
        const segmentDuration = trimmed ? Number(trimEndInput.value) - Number(trimStartInput.value) : dur;
        if (!Number.isFinite(segmentDuration) || segmentDuration <= 0 || segmentDuration > 45) {
          throw Error('معالجة الفيديو داخل هذا المتصفح تدعم حتى 45 ثانية. قصّر المقطع قبل النشر أو أزل التعديلات التي تتطلب الدمج.');
        }
        note.textContent = 'جارٍ تجهيز المونتاج ودمج الصوت والفلاتر...';
        const fCss = (FILTERS.find((x) => x.id === selectedFilter) || FILTERS[0]).css;
        const rendered = await window.ShnoLicensedAudio.mixAndRenderVideo({
          videoEl: preview,
          filterCss: fCss,
          overlays: editorOverlays,
          trimStart: Number(trimStartInput.value || 0),
          trimEnd: Number(trimEndInput.value || dur),
          durationSec: Math.max(1, Number(trimEndInput.value || dur) - Number(trimStartInput.value || 0)),
          fitMode: selectedFit,
          originalVolume: Number(origVolInput.value) / 100,
          musicId: audioSelection.musicId,
          musicVolume: Number(musicVolInput.value) / 100,
          sfxId: audioSelection.sfxId,
          sfxVolume: Number(musicVolInput.value) / 100,
          onProgress: (p) => { note.textContent = 'معالجة الريل: ' + p + '%'; }
        });
        if (!rendered || rendered.size === 0) throw Error('فشل دمج التعديلات مع الريل. لم يتم نشر الفيديو الأصلي دون التعديلات.');
        if (rendered.size > 100 * 1024 * 1024) throw Error('حجم الفيديو الناتج يتجاوز 100 ميغابايت');
        fileToUpload = rendered;
      }

      note.textContent = 'بدء رفع الريل إلى Cloudflare R2...';
      const uploadId = await window.uploadMediaToCloudflare(fileToUpload, 'posts', (p) => {
        note.textContent = 'رفع الريل إلى Cloudflare R2: ' + p + '%';
      });
      note.textContent = 'تم رفع الملف. جارٍ حفظ الريل في D1...';
      await api('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          text: document.getElementById('caption').value.trim(),
          visibility: document.getElementById('reelVisibility').value
        })
      });
      note.className = 'note ok';
      note.textContent = 'تم نشر الريل بنجاح.';
      form.reset();
      preview.hidden = true;
      if (studio) studio.hidden = true;
      editorOverlays = [];
      selectedFilter = 'none';
      if (audioPicker) audioPicker.clear();
      audioSelection = { musicId: '', sfxId: '' };
      if (clipNameEl) clipNameEl.textContent = 'الحد الأقصى 100 ميغابايت';
      openStudio(false);
      await load();
    } catch (err) {
      note.className = 'note bad';
      note.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  };

  async function openComments(id) {
    commentReel = id;
    sheet.hidden = false;
    commentsList.innerHTML = '<p class="muted">جارٍ التحميل...</p>';
    try {
      const d = await api('/api/posts/' + id + '/comments');
      commentsList.innerHTML = d.comments.length
        ? d.comments.map((c) => '<article class="reel-comment"><strong>' + esc(c.author?.fullName || c.author?.username || 'مستخدم') + '</strong><p>' + esc(c.text) + '</p></article>').join('')
        : '<p class="muted">لا توجد تعليقات بعد.</p>';
    } catch (e) {
      commentsList.innerHTML = '<p class="bad">' + esc(e.message) + '</p>';
    }
  }

  feed.onclick = async (e) => {
    const c = e.target.closest('.reel-card');
    if (!c) return;

    const progressEl = e.target.closest('[data-reel-progress]');
    if (progressEl) {
      const v = c.querySelector('.reel-stage > video');
      if (v && Number.isFinite(v.duration) && v.duration > 0) {
        const rect = progressEl.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        v.currentTime = ratio * v.duration;
      }
      return;
    }

    if (e.target.closest('.reel-center-play,[data-reel-play-toggle]')) {
      togglePlayCard(c);
      return;
    }

    if (e.target.closest('[data-reel-mute]')) {
      globalMuted = !globalMuted;
      feed.querySelectorAll('.reel-stage > video').forEach((v) => { v.muted = globalMuted; });
      feed.querySelectorAll('[data-reel-mute]').forEach((b) => { b.textContent = globalMuted ? '🔇' : '🔊'; });
      return;
    }

    if (e.target.closest('[data-reel-fit]')) {
      c.dataset.fit = c.dataset.fit === 'cover' ? 'contain' : 'cover';
      return;
    }

    if (e.target.closest('[data-reel-toggle-ui]')) {
      c.dataset.uiHidden = c.dataset.uiHidden === 'true' ? 'false' : 'true';
      return;
    }

    if (e.target.closest('[data-cancel-delete]')) {
      const bar = c.querySelector('.reel-confirm-bar');
      if (bar) bar.hidden = true;
      return;
    }

    if (e.target.closest('[data-confirm-delete]')) {
      try {
        await api('/api/posts/' + c.dataset.id, { method: 'DELETE' });
        c.remove();
        if (!feed.querySelector('.reel-card')) feed.innerHTML = '<div class="empty">لا توجد ريلز بعد.</div>';
        showToast('تم حذف الريل');
      } catch (err) {
        showToast(err.message);
      }
      return;
    }

    const like = e.target.closest('.like');
    const save = e.target.closest('.save');
    const del = e.target.closest('.delete');
    try {
      if (del) {
        const bar = c.querySelector('.reel-confirm-bar');
        if (bar) bar.hidden = !bar.hidden;
        return;
      }
      if (like) {
        const d = await api('/api/posts/' + c.dataset.id + '/like', { method: like.classList.contains('active') ? 'DELETE' : 'POST' });
        like.classList.toggle('active', d.liked);
        like.firstChild.nodeValue = d.liked ? '♥' : '♡';
        like.querySelector('small').textContent = d.likesCount;
        return;
      }
      if (save) {
        const d = await api('/api/reels/' + c.dataset.id + '/save', { method: 'POST' });
        save.classList.toggle('active', d.saved);
        save.querySelector('small').textContent = d.saved ? 'محفوظ' : 'حفظ';
        return;
      }
      if (e.target.closest('.comment')) {
        await openComments(c.dataset.id);
        return;
      }
      if (e.target.closest('.share')) {
        const url = location.origin + location.pathname + '#' + c.dataset.id;
        if (navigator.share) await navigator.share({ title: 'ريلز تك تك', url });
        else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          showToast('تم نسخ رابط الريل');
        }
        return;
      }
      if (e.target.closest('.reel-stage') && !e.target.closest('button,a,input')) {
        const v = c.querySelector('.reel-stage > video');
        if (v && v.paused && c.dataset.uiHidden !== 'true') {
          togglePlayCard(c);
        } else {
          c.dataset.uiHidden = c.dataset.uiHidden === 'true' ? 'false' : 'true';
        }
      }
    } catch (err) {
      if (err && err.name !== 'AbortError') showToast(err.message);
    }
  };

  document.querySelectorAll('[data-close-comments]').forEach((b) => { b.onclick = () => { sheet.hidden = true; }; });
  commentForm.onsubmit = async (e) => {
    e.preventDefault();
    const input = document.getElementById('commentText');
    const value = input.value.trim();
    if (!value) return;
    try {
      await api('/api/posts/' + commentReel + '/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value })
      });
      input.value = '';
      await openComments(commentReel);
      const cnt = feed.querySelector('[data-id="' + CSS.escape(commentReel) + '"] .comment small');
      if (cnt) cnt.textContent = Number(cnt.textContent || 0) + 1;
    } catch (err) {
      showToast(err.message);
    }
  };

  load();
})();
