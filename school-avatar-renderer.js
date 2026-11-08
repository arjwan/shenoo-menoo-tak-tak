/* Lightweight local Canvas 2D teacher. No Unity, camera, recording or external assets. */
(function () {
  'use strict';
  class SumerAvatarRenderer {
    constructor(canvas, options = {}) {
      this.canvas = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
      if (!this.canvas) throw new Error('Sumer avatar canvas missing');
      this.ctx = this.canvas.getContext('2d');
      if (!this.ctx) throw new Error('Canvas 2D unavailable');
      this.gender = options.gender === 'male' ? 'male' : 'female';
      this.speaking = false;
      this.level = 0;
      this.audioContext = null;
      this.analyser = null;
      this.samples = null;
      this.sourceElement = null;
      this.frame = 0;
      this.running = true;
      this.lastFrame = 0;
      this.blinkAt = performance.now() + 2600;
      this.blinkEnd = 0;
      this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.draw(0);
      this.loop = this.loop.bind(this);
      this.frame = requestAnimationFrame(this.loop);
    }
    async attachAudioElement(element) {
      if (!(element instanceof HTMLMediaElement)) return false;
      if (this.sourceElement === element && this.analyser) {
        if (this.audioContext?.state === 'suspended') this.audioContext.resume().catch(() => {});
        return true;
      }
      // A media element can be attached to only one MediaElementAudioSourceNode.
      // Never create a second node for an already-routed element.
      if (this.sourceElement && this.sourceElement !== element) this.detachAudio();
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return false;
      let context;
      try {
        context = new Context();
        const source = context.createMediaElementSource(element);
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.65;
        source.connect(analyser);
        analyser.connect(context.destination);
        this.audioContext = context;
        this.sourceElement = element;
        this.analyser = analyser;
        this.samples = new Uint8Array(analyser.fftSize);
        if (context.state === 'suspended') context.resume().catch(() => {});
        return true;
      } catch (_) {
        if (context) await context.close().catch(() => {});
        this.analyser = null;
        this.samples = null;
        return false;
      }
    }
    detachAudio() {
      this.analyser = null;
      this.samples = null;
      this.sourceElement = null;
      const old = this.audioContext;
      this.audioContext = null;
      if (old && old.state !== 'closed') old.close().catch(() => {});
    }
    setSpeakingState(value) {
      this.speaking = !!value;
      if (!value) this.level = 0;
    }
    setGender(gender) { this.gender = gender === 'male' ? 'male' : 'female'; }
    loop(now) {
      if (!this.running) return;
      if (now - this.lastFrame >= (this.reducedMotion ? 150 : 33)) {
        this.lastFrame = now;
        let target = 0;
        if (this.speaking && this.analyser && this.samples && this.audioContext?.state === 'running') {
          this.analyser.getByteTimeDomainData(this.samples);
          let sum = 0;
          for (const sample of this.samples) {
            const x = (sample - 128) / 128;
            sum += x * x;
          }
          target = Math.min(1, Math.max(0, (Math.sqrt(sum / this.samples.length) - 0.012) * 8));
        } else if (this.speaking) {
          // Device speechSynthesis cannot be captured by Web Audio: state-only animation.
          target = this.reducedMotion ? 0.18 : 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(now / 105));
        }
        this.level += (target - this.level) * 0.45;
        this.draw(now);
      }
      this.frame = requestAnimationFrame(this.loop);
    }
    draw(now) {
      const c = this.canvas, x = c.width / 2, y = c.height * 0.48;
      const ctx = this.ctx, r = Math.min(c.width, c.height) * 0.30;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#e9edf6';
      ctx.beginPath(); ctx.arc(x, y, r * 1.33, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = this.gender === 'female' ? '#47324f' : '#323d52';
      ctx.beginPath(); ctx.ellipse(x, y - r * 0.25, r * 1.07, r * 1.15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#eec5a8';
      ctx.beginPath(); ctx.ellipse(x, y, r * 0.84, r, 0, 0, Math.PI * 2); ctx.fill();
      if (this.gender === 'female') {
        ctx.fillStyle = '#47324f';
        ctx.beginPath(); ctx.ellipse(x, y - r * 0.80, r * 0.86, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      }
      if (!this.reducedMotion && now >= this.blinkAt && !this.blinkEnd) this.blinkEnd = now + 145;
      const blink = !!this.blinkEnd && now < this.blinkEnd;
      if (this.blinkEnd && now >= this.blinkEnd) {
        this.blinkEnd = 0;
        this.blinkAt = now + 2600 + Math.random() * 2100;
      }
      ctx.fillStyle = '#293247';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(x + side * r * 0.34, y - r * 0.13, r * 0.09, blink ? 1.3 : r * 0.105, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#a34c59';
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.43, r * 0.25, Math.max(2, r * (0.035 + this.level * 0.23)), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#34445f';
      ctx.beginPath(); ctx.moveTo(x-r*0.9, c.height); ctx.quadraticCurveTo(x, y+r*0.9, x+r*0.9, c.height); ctx.fill();
    }
    destroy() {
      this.running = false;
      cancelAnimationFrame(this.frame);
      this.detachAudio();
    }
  }
  window.SumerAvatarRenderer = SumerAvatarRenderer;
  const canvas = document.getElementById('sumerTeacherCanvas');
  if (!canvas) return;
  try {
    const avatar = new SumerAvatarRenderer(canvas);
    window.SumerTeacherAvatar = avatar;
    const image = document.getElementById('teacherAvatarImg');
    if (image) image.hidden = true;
    window.addEventListener('pagehide', () => avatar.destroy(), { once: true });
  } catch (_) {
    canvas.hidden = true;
  }
})();
