(function () {
  'use strict';

  const TRACKS = [
    {
      id: 'baghdad-lofi',
      title: 'نسيم دجلة',
      subtitle: 'Lo-Fi هادئ للقصص واليوميات',
      category: 'music',
      categoryLabel: 'موسيقى هادئة',
      license: 'Apache-2.0 — صوت مولّد برمجياً',
      source: 'licensed-audio-library.js — Web Audio synthesis',
      duration: 16,
      bpm: 82,
      mood: 'chill',
      notes: [261.63, 311.13, 392.0, 466.16, 392.0, 311.13, 293.66, 349.23],
      bass: [130.81, 130.81, 116.54, 116.54, 103.83, 103.83, 98.0, 98.0],
      wave: 'triangle'
    },
    {
      id: 'sumer-oud',
      title: 'وتر سومري',
      subtitle: 'نغمة شرقية دافئة مستوحاة من التراث',
      category: 'music',
      categoryLabel: 'شرقي معاصر',
      license: 'Apache-2.0 — صوت مولّد برمجياً',
      source: 'licensed-audio-library.js — Web Audio synthesis',
      duration: 16,
      bpm: 92,
      mood: 'oud',
      notes: [293.66, 311.13, 369.99, 392.0, 440.0, 392.0, 369.99, 311.13],
      bass: [146.83, 146.83, 130.81, 130.81, 116.54, 116.54, 146.83, 146.83],
      wave: 'sawtooth'
    },
    {
      id: 'neon-beat',
      title: 'نبض بغداد',
      subtitle: 'إيقاع إلكتروني سريع للريلز',
      category: 'music',
      categoryLabel: 'حماسي',
      license: 'Apache-2.0 — صوت مولّد برمجياً',
      source: 'licensed-audio-library.js — Web Audio synthesis',
      duration: 16,
      bpm: 118,
      mood: 'beat',
      notes: [329.63, 392.0, 493.88, 523.25, 493.88, 392.0, 440.0, 587.33],
      bass: [82.41, 82.41, 98.0, 98.0, 110.0, 110.0, 98.0, 82.41],
      wave: 'square'
    },
    {
      id: 'sunset-chill',
      title: 'غروب البصرة',
      subtitle: 'أوتار ناعمة لأجواء المساء',
      category: 'music',
      categoryLabel: 'استرخاء',
      license: 'Apache-2.0 — صوت مولّد برمجياً',
      source: 'licensed-audio-library.js — Web Audio synthesis',
      duration: 18,
      bpm: 76,
      mood: 'pad',
      notes: [220.0, 261.63, 329.63, 392.0, 349.23, 329.63, 293.66, 261.63],
      bass: [110.0, 110.0, 87.31, 87.31, 98.0, 98.0, 110.0, 110.0],
      wave: 'sine'
    },
    {
      id: 'celebrate-iraq',
      title: 'فرحة ولمّة',
      subtitle: 'إيقاع مبهج للمناسبات واللحظات الحلوة',
      category: 'music',
      categoryLabel: 'احتفالي',
      license: 'Apache-2.0 — صوت مولّد برمجياً',
      source: 'licensed-audio-library.js — Web Audio synthesis',
      duration: 16,
      bpm: 112,
      mood: 'upbeat',
      notes: [392.0, 440.0, 493.88, 587.33, 659.25, 587.33, 493.88, 440.0],
      bass: [196.0, 196.0, 146.83, 146.83, 164.81, 164.81, 146.83, 196.0],
      wave: 'triangle'
    },
    {
      id: 'cinematic-epic',
      title: 'لحظة سينمائية',
      subtitle: 'خلفية ملهمة للمحتوى والقصص المؤثرة',
      category: 'music',
      categoryLabel: 'سينمائي',
      license: 'Apache-2.0 — صوت مولّد برمجياً',
      source: 'licensed-audio-library.js — Web Audio synthesis',
      duration: 18,
      bpm: 88,
      mood: 'cinematic',
      notes: [261.63, 329.63, 392.0, 523.25, 493.88, 392.0, 440.0, 523.25],
      bass: [65.41, 65.41, 87.31, 87.31, 98.0, 98.0, 65.41, 65.41],
      wave: 'sawtooth'
    },
    {
      id: 'sfx-whoosh',
      title: 'انتقال سريع (Whoosh)',
      subtitle: 'مؤثر انتقالي ناعم لبداية أو تغيير المشهد',
      category: 'sfx',
      categoryLabel: 'مؤثر صوتي',
      license: 'Apache-2.0 — صوت مولّد برمجياً',
      source: 'licensed-audio-library.js — Web Audio synthesis',
      duration: 0.9,
      bpm: 0,
      mood: 'whoosh'
    },
    {
      id: 'sfx-pop',
      title: 'فقاعة لطيفة (Pop)',
      subtitle: 'نقرة مشرقة مع ظهور النصوص والملصقات',
      category: 'sfx',
      categoryLabel: 'مؤثر صوتي',
      license: 'Apache-2.0 — صوت مولّد برمجياً',
      source: 'licensed-audio-library.js — Web Audio synthesis',
      duration: 0.45,
      bpm: 0,
      mood: 'pop'
    },
    {
      id: 'sfx-sparkle',
      title: 'لمعان سحري (Sparkle)',
      subtitle: 'رنين متلألئ للحظات المميزة',
      category: 'sfx',
      categoryLabel: 'مؤثر صوتي',
      license: 'Apache-2.0 — صوت مولّد برمجياً',
      source: 'licensed-audio-library.js — Web Audio synthesis',
      duration: 1.2,
      bpm: 0,
      mood: 'sparkle'
    },
    {
      id: 'sfx-applause',
      title: 'تصفيق وتشجيع',
      subtitle: 'مؤثر تفاعلي للإنجازات والمفاجآت',
      category: 'sfx',
      categoryLabel: 'مؤثر صوتي',
      license: 'Apache-2.0 — صوت مولّد برمجياً',
      source: 'licensed-audio-library.js — Web Audio synthesis',
      duration: 1.6,
      bpm: 0,
      mood: 'applause'
    },
    {
      id: 'sfx-drum',
      title: 'ضربة إيقاع (Beat Drop)',
      subtitle: 'ضربة بيس قوية لبداية المقطع',
      category: 'sfx',
      categoryLabel: 'مؤثر صوتي',
      license: 'Apache-2.0 — صوت مولّد برمجياً',
      source: 'licensed-audio-library.js — Web Audio synthesis',
      duration: 0.85,
      bpm: 0,
      mood: 'drum'
    },
    {
      id: 'sfx-bell',
      title: 'رنّة ناعمة (Chime)',
      subtitle: 'نغمة تنبيه راقية لبداية القصة',
      category: 'sfx',
      categoryLabel: 'مؤثر صوتي',
      license: 'Apache-2.0 — صوت مولّد برمجياً',
      source: 'licensed-audio-library.js — Web Audio synthesis',
      duration: 1.0,
      bpm: 0,
      mood: 'bell'
    }
  ];

  let liveCtx = null;
  let activePreview = null;

  function getAudioCtx() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!liveCtx || liveCtx.state === 'closed') liveCtx = new Ctx();
    if (liveCtx.state === 'suspended') liveCtx.resume().catch(() => {});
    return liveCtx;
  }

  function createNoiseBuffer(ctx, seconds) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function scheduleSfx(ctx, destination, track, startTime, volume) {
    const master = ctx.createGain();
    master.gain.setValueAtTime(Math.max(0.01, Math.min(1, volume)), startTime);
    master.connect(destination);

    if (track.mood === 'whoosh') {
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(ctx, 0.9);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(2.5, startTime);
      filter.frequency.setValueAtTime(180, startTime);
      filter.frequency.exponentialRampToValueAtTime(2200, startTime + 0.38);
      filter.frequency.exponentialRampToValueAtTime(280, startTime + 0.85);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.75, startTime + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.88);
      noise.connect(filter).connect(gain).connect(master);
      noise.start(startTime);
      noise.stop(startTime + 0.9);
    } else if (track.mood === 'pop') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, startTime);
      osc.frequency.exponentialRampToValueAtTime(980, startTime + 0.08);
      osc.frequency.exponentialRampToValueAtTime(420, startTime + 0.22);
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.75, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);
      osc.connect(gain).connect(master);
      osc.start(startTime);
      osc.stop(startTime + 0.32);
    } else if (track.mood === 'sparkle') {
      const freqs = [880, 1174.66, 1318.51, 1760, 2093];
      freqs.forEach((f, idx) => {
        const t = startTime + idx * 0.11;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.32, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.connect(g).connect(master);
        osc.start(t);
        osc.stop(t + 0.48);
      });
    } else if (track.mood === 'applause') {
      const noiseBuf = createNoiseBuffer(ctx, 1.55);
      for (let i = 0; i < 14; i++) {
        const t = startTime + i * 0.095 + (i % 3) * 0.02;
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1100 + (i % 4) * 350, t);
        filter.Q.setValueAtTime(1.4, t);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.38, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        src.connect(filter).connect(g).connect(master);
        src.start(t, 0, 0.18);
      }
    } else if (track.mood === 'drum') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(170, startTime);
      osc.frequency.exponentialRampToValueAtTime(42, startTime + 0.45);
      g.gain.setValueAtTime(0.9, startTime);
      g.gain.exponentialRampToValueAtTime(0.001, startTime + 0.72);
      osc.connect(g).connect(master);
      osc.start(startTime);
      osc.stop(startTime + 0.75);
    } else {
      [523.25, 659.25, 783.99].forEach((f, idx) => {
        const t = startTime + idx * 0.06;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.32, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
        osc.connect(g).connect(master);
        osc.start(t);
        osc.stop(t + 0.8);
      });
    }
    return master;
  }

  function scheduleMusic(ctx, destination, track, durationSec, startTime, volume) {
    const master = ctx.createGain();
    master.gain.setValueAtTime(Math.max(0.01, Math.min(1, volume)), startTime);
    master.connect(destination);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(track.mood === 'beat' ? 3200 : 1850, startTime);
    filter.connect(master);

    const stepSec = 60 / (track.bpm || 90) / 2;
    const totalSteps = Math.max(1, Math.ceil(durationSec / stepSec));
    const notes = track.notes || [261.63, 329.63, 392.0, 523.25];
    const bass = track.bass || [130.81, 130.81, 98.0, 98.0];
    const noiseBuf = createNoiseBuffer(ctx, 0.12);

    for (let step = 0; step < totalSteps; step++) {
      const t = startTime + step * stepSec;
      if (t >= startTime + durationSec) break;

      if (step % 2 === 0 || track.mood === 'beat' || track.mood === 'oud') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = track.wave || 'triangle';
        const freq = notes[step % notes.length];
        osc.frequency.setValueAtTime(freq, t);
        if (track.mood === 'oud') {
          osc.frequency.linearRampToValueAtTime(freq * 1.006, t + stepSec * 0.4);
        }
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(track.mood === 'pad' ? 0.14 : 0.22, t + 0.025);
        g.gain.exponentialRampToValueAtTime(0.001, t + stepSec * 1.55);
        osc.connect(g).connect(filter);
        osc.start(t);
        osc.stop(Math.min(startTime + durationSec, t + stepSec * 1.6));
      }

      if (step % 4 === 0) {
        const bOsc = ctx.createOscillator();
        const bGain = ctx.createGain();
        bOsc.type = 'sine';
        bOsc.frequency.setValueAtTime(bass[Math.floor(step / 4) % bass.length], t);
        bGain.gain.setValueAtTime(0.001, t);
        bGain.gain.linearRampToValueAtTime(0.28, t + 0.03);
        bGain.gain.exponentialRampToValueAtTime(0.001, t + stepSec * 3.6);
        bOsc.connect(bGain).connect(master);
        bOsc.start(t);
        bOsc.stop(Math.min(startTime + durationSec, t + stepSec * 3.8));
      }

      if (track.mood !== 'pad' && step % 2 === 1) {
        const hat = ctx.createBufferSource();
        hat.buffer = noiseBuf;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(5200, t);
        const hg = ctx.createGain();
        hg.gain.setValueAtTime(track.mood === 'beat' ? 0.11 : 0.05, t);
        hg.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        hat.connect(hp).connect(hg).connect(master);
        hat.start(t, 0, 0.07);
      }

      if ((track.mood === 'beat' || track.mood === 'upbeat') && step % 4 === 0) {
        const kick = ctx.createOscillator();
        const kg = ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(135, t);
        kick.frequency.exponentialRampToValueAtTime(45, t + 0.14);
        kg.gain.setValueAtTime(0.45, t);
        kg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        kick.connect(kg).connect(master);
        kick.start(t);
        kick.stop(t + 0.2);
      }
    }

    return master;
  }

  function stopPreview() {
    if (!activePreview) return;
    clearTimeout(activePreview.timer);
    try { activePreview.node.disconnect(); } catch (_) {}
    if (typeof activePreview.onStop === 'function') activePreview.onStop();
    activePreview = null;
  }

  function preview(id, onStop) {
    const track = get(id);
    if (!track) return false;
    if (activePreview && activePreview.id === id) {
      stopPreview();
      return false;
    }
    stopPreview();
    const ctx = getAudioCtx();
    if (!ctx) return false;
    const previewDur = track.category === 'sfx' ? track.duration : Math.min(8, track.duration);
    const node = track.category === 'sfx'
      ? scheduleSfx(ctx, ctx.destination, track, ctx.currentTime + 0.02, 0.85)
      : scheduleMusic(ctx, ctx.destination, track, previewDur, ctx.currentTime + 0.02, 0.72);
    const timer = setTimeout(() => {
      if (activePreview && activePreview.id === id) stopPreview();
    }, previewDur * 1000 + 120);
    activePreview = { id, node, timer, onStop };
    return true;
  }

  function isPlaying(id) {
    return Boolean(activePreview && activePreview.id === id);
  }

  function get(id) {
    return TRACKS.find((t) => t.id === id) || null;
  }

  function list(category) {
    if (!category || category === 'all') return TRACKS.slice();
    return TRACKS.filter((t) => t.category === category);
  }

  async function renderTrackBuffer(id, durationSec, volume = 0.8) {
    const track = get(id);
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!track || !Offline) return null;
    const dur = Math.max(0.5, Math.min(60, Number(durationSec) || track.duration || 6));
    const sampleRate = 44100;
    const offline = new Offline(2, Math.ceil(sampleRate * dur), sampleRate);
    if (track.category === 'sfx') {
      scheduleSfx(offline, offline.destination, track, 0.04, volume);
    } else {
      scheduleMusic(offline, offline.destination, track, dur, 0, volume);
    }
    return await offline.startRendering();
  }

  function pickRecorderMime() {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm',
      'video/mp4'
    ];
    for (const mime of candidates) {
      if (!MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(mime)) return mime;
    }
    return '';
  }

  function drawCoverOrContain(ctx, media, cw, ch, mode) {
    const mw = media.videoWidth || media.naturalWidth || cw;
    const mh = media.videoHeight || media.naturalHeight || ch;
    if (!mw || !mh) return;
    const scale = mode === 'cover'
      ? Math.max(cw / mw, ch / mh)
      : Math.min(cw / mw, ch / mh);
    const dw = mw * scale;
    const dh = mh * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;
    ctx.drawImage(media, dx, dy, dw, dh);
  }

  function drawOverlays(ctx, overlays, cw, ch) {
    if (!Array.isArray(overlays) || !overlays.length) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const o of overlays) {
      if (!o || !o.value) continue;
      const x = (Number(o.x ?? 50) / 100) * cw;
      const y = (Number(o.y ?? 50) / 100) * ch;
      const fontSize = Math.round((Number(o.size) || 34) * (cw / 380));
      ctx.font = `700 ${fontSize}px Tahoma, "Segoe UI", Arial, sans-serif`;
      if (o.bg && o.kind === 'text') {
        const metrics = ctx.measureText(o.value);
        const padX = fontSize * 0.5;
        const padY = fontSize * 0.35;
        ctx.fillStyle = 'rgba(10, 14, 22, 0.72)';
        const rx = x - metrics.width / 2 - padX;
        const ry = y - fontSize / 2 - padY;
        const rw = metrics.width + padX * 2;
        const rh = fontSize + padY * 2;
        ctx.beginPath();
        ctx.roundRect(rx, ry, rw, rh, 14);
        ctx.fill();
      }
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = o.color || '#ffffff';
      ctx.fillText(String(o.value), x, y);
    }
    ctx.restore();
  }

  async function renderImageStory(opts) {
    const cw = 720;
    const ch = 1280;
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    const bgColors = Array.isArray(opts.bgColors) ? opts.bgColors : ['#111b18', '#241535'];
    const grad = ctx.createLinearGradient(0, 0, cw, ch);
    grad.addColorStop(0, bgColors[0]);
    grad.addColorStop(1, bgColors[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    if (opts.imgEl) {
      ctx.save();
      if (opts.filterCss && opts.filterCss !== 'none') ctx.filter = opts.filterCss;
      if (opts.fitMode === 'contain') {
        ctx.save();
        ctx.filter = 'blur(22px) brightness(0.5)';
        drawCoverOrContain(ctx, opts.imgEl, cw, ch, 'cover');
        ctx.restore();
      }
      drawCoverOrContain(ctx, opts.imgEl, cw, ch, opts.fitMode || 'contain');
      ctx.restore();
    }

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
    if (!blob) throw Error('تعذر تجهيز صورة القصة');
    return new File([blob], 'story-' + Date.now() + '.webp', { type: 'image/webp' });
  }

  async function mixAndRenderVideo(opts) {
    const mime = pickRecorderMime();
    if (!mime) throw Error('صيغة تسجيل الفيديو غير مدعومة في هذا المتصفح');

    const cw = 720;
    const ch = 1280;
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');

    // Use a fresh element so each render has an independent Web Audio source.
    const videoEl = opts.videoEl ? document.createElement('video') : null;
    if (videoEl) {
      videoEl.playsInline = true;
      videoEl.preload = 'auto';
      await new Promise((resolve, reject) => {
        videoEl.onloadeddata = resolve;
        videoEl.onerror = () => reject(Error('تعذر قراءة الفيديو للمعالجة'));
        videoEl.src = opts.videoEl.currentSrc || opts.videoEl.src;
      });
    }
    const imgEl = opts.imgEl || null;
    const trimStart = Math.max(0, Number(opts.trimStart) || 0);
    const requestedDuration = Number(opts.durationSec) || (videoEl && Number.isFinite(videoEl.duration) ? (Number(opts.trimEnd) || videoEl.duration) - trimStart : 6);
    if (!Number.isFinite(requestedDuration) || requestedDuration <= 0 || requestedDuration > 45) {
      throw Error('لا يمكن دمج مقطع أطول من 45 ثانية باستخدام المعالج الحالي');
    }
    const totalDuration = requestedDuration;

    const stream = canvas.captureStream(30);
    let audioCtx = null;
    let sourceNodes = [];

    if (opts.musicId || opts.sfxId || videoEl) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) throw Error('هذا المتصفح لا يدعم معالجة الصوت');
      if (Ctx) {
        audioCtx = new Ctx();
        if (audioCtx.state === 'suspended') await audioCtx.resume().catch(() => {});
        const dest = audioCtx.createMediaStreamDestination();

        if (videoEl) {
          const vSrc = audioCtx.createMediaElementSource(videoEl);
          const vGain = audioCtx.createGain();
          vGain.gain.value = opts.originalVolume == null ? 1 : Number(opts.originalVolume);
          vSrc.connect(vGain).connect(dest);
          sourceNodes.push(vSrc);
        }

        if (opts.musicId) {
          const musicBuf = await renderTrackBuffer(opts.musicId, totalDuration, opts.musicVolume ?? 0.65);
          if (!musicBuf) throw Error('تعذر تجهيز الموسيقى المختارة');
          if (musicBuf) {
            const mSrc = audioCtx.createBufferSource();
            mSrc.buffer = musicBuf;
            mSrc.connect(dest);
            mSrc._renderOffset = 0;
            sourceNodes.push(mSrc);
          }
        }

        if (opts.sfxId) {
          const sfxTrack = get(opts.sfxId);
          if (sfxTrack) {
            const sfxBuf = await renderTrackBuffer(opts.sfxId, sfxTrack.duration, opts.sfxVolume ?? 0.85);
            if (!sfxBuf) throw Error('تعذر تجهيز المؤثر المختار');
            if (sfxBuf) {
              const sSrc = audioCtx.createBufferSource();
              sSrc.buffer = sfxBuf;
              sSrc.connect(dest);
              sSrc._renderOffset = Math.min(totalDuration - 0.2, Math.max(0.05, Number(opts.sfxAtSec) || 0.2));
              sourceNodes.push(sSrc);
            }
          }
        }

        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      }
    }

    const chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_200_000 });
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };

    const bgColors = Array.isArray(opts.bgColors) ? opts.bgColors : ['#0b1318', '#1f1636'];

    return await new Promise((resolve, reject) => {
      let raf = 0;
      let startMs;

      recorder.onerror = (err) => {
        cancelAnimationFrame(raf);
        if (audioCtx) audioCtx.close().catch(() => {});
        reject(err.error || Error('فشل تجهيز الفيديو'));
      };

      recorder.onstop = () => {
        cancelAnimationFrame(raf);
        sourceNodes.forEach((n) => { try { n.stop && n.stop(); } catch (_) {} });
        if (audioCtx) audioCtx.close().catch(() => {});
        const baseMime = mime.split(';')[0] || 'video/webm';
        const ext = baseMime.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunks, { type: baseMime });
        if (blob.size === 0) { reject(Error('تعذر تسجيل الفيديو الناتج')); return; }
        resolve(new File([blob], 'shno-edit-' + Date.now() + '.' + ext, { type: baseMime }));
      };

      const drawFrame = () => {
        const elapsed = (performance.now() - startMs) / 1000;
        if (typeof opts.onProgress === 'function') {
          opts.onProgress(Math.min(99, Math.round((elapsed / totalDuration) * 100)));
        }

        const grad = ctx.createLinearGradient(0, 0, cw, ch);
        grad.addColorStop(0, bgColors[0]);
        grad.addColorStop(1, bgColors[1]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cw, ch);

        const media = videoEl || imgEl;
        if (media) {
          ctx.save();
          if (opts.filterCss && opts.filterCss !== 'none') ctx.filter = opts.filterCss;
          if ((opts.fitMode || 'contain') === 'contain') {
            ctx.save();
            ctx.filter = 'blur(24px) brightness(0.45)';
            drawCoverOrContain(ctx, media, cw, ch, 'cover');
            ctx.restore();
          }
          drawCoverOrContain(ctx, media, cw, ch, opts.fitMode || 'contain');
          ctx.restore();
        } else if (opts.text) {
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '700 44px Tahoma, "Segoe UI", Arial, sans-serif';
          const words = String(opts.text).split(/\s+/);
          let line = '';
          const lines = [];
          for (const w of words) {
            const test = line ? line + ' ' + w : w;
            if (ctx.measureText(test).width > cw - 110) {
              lines.push(line);
              line = w;
            } else line = test;
          }
          if (line) lines.push(line);
          const lineH = 62;
          const topY = ch / 2 - ((lines.length - 1) * lineH) / 2;
          lines.forEach((ln, idx) => ctx.fillText(ln, cw / 2, topY + idx * lineH));
          ctx.restore();
        }

        if (opts.bakeOverlays !== false) {
          drawOverlays(ctx, opts.overlays, cw, ch);
        }

        if (elapsed >= totalDuration) {
          if (videoEl) videoEl.pause();
          if (recorder.state === 'recording') recorder.stop();
          return;
        }
        raf = requestAnimationFrame(drawFrame);
      };

      const begin = () => {
        startMs = performance.now();
        recorder.start(200);
        sourceNodes.forEach((n) => { if (n._renderOffset != null) n.start(audioCtx.currentTime + n._renderOffset); });
        if (videoEl) {
          videoEl.muted = false;
          videoEl.volume = 1;
          videoEl.play().catch(() => { recorder.stop(); reject(Error('تعذر تشغيل الفيديو أثناء المعالجة')); });
        }
        raf = requestAnimationFrame(drawFrame);
      };

      if (videoEl && Math.abs((videoEl.currentTime || 0) - trimStart) > 0.15) {
        videoEl.addEventListener('seeked', begin, { once: true });
        videoEl.currentTime = trimStart;
      } else {
        begin();
      }
    });
  }

  function createPickerUI(container, options = {}) {
    if (!container) return null;
    let activeCategory = 'all';
    let query = '';
    let selectedMusic = options.initialMusic || '';
    let selectedSfx = options.initialSfx || '';

    container.innerHTML = `
      <div class="shno-audio-lib">
        <div class="shno-audio-head">
          <div>
            <strong>🎵 مكتبة الموسيقى والمؤثرات المرخّصة</strong>
            <small>موسيقى ومؤثرات مولّدة محلياً من مكتبة المشروع</small>
          </div>
          <span class="shno-cc0-badge">صوت مولّد</span>
        </div>
        <div class="shno-audio-filters">
          <div class="shno-audio-tabs" role="tablist">
            <button type="button" class="is-active" data-cat="all">الكل</button>
            <button type="button" data-cat="music">🎵 موسيقى</button>
            <button type="button" data-cat="sfx">🔊 مؤثرات صوتية</button>
          </div>
          <input type="search" class="shno-audio-search" placeholder="ابحث عن نغمة أو مؤثر..." aria-label="بحث في مكتبة الصوت">
        </div>
        <div class="shno-audio-list"></div>
        <div class="shno-audio-selected" hidden></div>
      </div>
    `;

    const listEl = container.querySelector('.shno-audio-list');
    const selectedEl = container.querySelector('.shno-audio-selected');
    const searchEl = container.querySelector('.shno-audio-search');

    function syncSelectedSummary() {
      const m = get(selectedMusic);
      const s = get(selectedSfx);
      if (!m && !s) {
        selectedEl.hidden = true;
        selectedEl.innerHTML = '';
        return;
      }
      selectedEl.hidden = false;
      const chips = [];
      if (m) chips.push(`<span class="shno-audio-chip">🎵 ${m.title} <button type="button" data-clear="music" aria-label="إزالة الموسيقى">×</button></span>`);
      if (s) chips.push(`<span class="shno-audio-chip">🔊 ${s.title} <button type="button" data-clear="sfx" aria-label="إزالة المؤثر">×</button></span>`);
      selectedEl.innerHTML = chips.join('');
    }

    function renderList() {
      const items = list(activeCategory).filter((item) => {
        if (!query) return true;
        return (item.title + ' ' + item.subtitle + ' ' + item.categoryLabel).toLowerCase().includes(query.toLowerCase());
      });
      if (!items.length) {
        listEl.innerHTML = '<div class="shno-audio-empty">لا توجد نتائج مطابقة.</div>';
        return;
      }
      listEl.innerHTML = items.map((item) => {
        const chosen = (item.category === 'music' && selectedMusic === item.id) || (item.category === 'sfx' && selectedSfx === item.id);
        const playing = isPlaying(item.id);
        return `
          <div class="shno-audio-row ${chosen ? 'is-chosen' : ''}" data-track-id="${item.id}">
            <button type="button" class="shno-audio-play ${playing ? 'is-playing' : ''}" data-preview="${item.id}" aria-label="معاينة ${item.title}">${playing ? '⏹' : '▶'}</button>
            <div class="shno-audio-meta">
              <strong>${item.title} <span class="shno-audio-tag">${item.categoryLabel}</span></strong>
              <small>${item.subtitle} · ${item.duration}ث · ${item.license}</small>
            </div>
            <button type="button" class="shno-audio-pick" data-pick="${item.id}">${chosen ? '✓ محدد' : 'اختيار'}</button>
          </div>
        `;
      }).join('');
      syncSelectedSummary();
    }

    container.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-cat]');
      if (tab) {
        activeCategory = tab.dataset.cat;
        container.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('is-active', b === tab));
        renderList();
        return;
      }
      const prev = e.target.closest('[data-preview]');
      if (prev) {
        preview(prev.dataset.preview, renderList);
        renderList();
        return;
      }
      const pick = e.target.closest('[data-pick]');
      if (pick) {
        const track = get(pick.dataset.pick);
        if (!track) return;
        if (track.category === 'music') {
          selectedMusic = selectedMusic === track.id ? '' : track.id;
        } else {
          selectedSfx = selectedSfx === track.id ? '' : track.id;
        }
        renderList();
        if (typeof options.onChange === 'function') {
          options.onChange({ musicId: selectedMusic, sfxId: selectedSfx, music: get(selectedMusic), sfx: get(selectedSfx) });
        }
        return;
      }
      const clr = e.target.closest('[data-clear]');
      if (clr) {
        if (clr.dataset.clear === 'music') selectedMusic = '';
        if (clr.dataset.clear === 'sfx') selectedSfx = '';
        renderList();
        if (typeof options.onChange === 'function') {
          options.onChange({ musicId: selectedMusic, sfxId: selectedSfx, music: get(selectedMusic), sfx: get(selectedSfx) });
        }
      }
    });

    searchEl.addEventListener('input', () => {
      query = searchEl.value.trim();
      renderList();
    });

    renderList();

    return {
      getSelection: () => ({ musicId: selectedMusic, sfxId: selectedSfx, music: get(selectedMusic), sfx: get(selectedSfx) }),
      clear: () => {
        selectedMusic = '';
        selectedSfx = '';
        stopPreview();
        renderList();
      }
    };
  }

  window.ShnoLicensedAudio = {
    TRACKS,
    list,
    get,
    preview,
    stopPreview,
    isPlaying,
    renderTrackBuffer,
    renderImageStory,
    mixAndRenderVideo,
    createPickerUI
  };
})();
