/* Sumer avatar: opt-in display adapter, never creates a fake video session. */
(() => {
  'use strict';
  const visual = document.getElementById('teacherVisual');
  if (!visual) return;
  const image = document.getElementById('teacherAvatarImg');
  const video = document.createElement('video');
  video.className = 'sumer-avatar-video';
  video.id = 'sumerAvatarVideo';
  video.autoplay = true;
  video.playsInline = true;
  video.setAttribute('aria-label', 'بث المعلم الافتراضي المباشر');
  video.hidden = true;
  visual.appendChild(video);

  const status = document.createElement('div');
  status.className = 'sumer-avatar-status';
  status.id = 'sumerAvatarStatus';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;
  visual.insertAdjacentElement('afterend', status);

  function showFallback(message) {
    video.pause();
    video.srcObject = null;
    video.hidden = true;
    if (image) image.hidden = false;
    status.textContent = message || '';
    status.hidden = !message;
  }
  async function attachTrustedStream(stream) {
    if (!(stream instanceof MediaStream) || !stream.getVideoTracks().some(t => t.readyState === 'live')) {
      throw new TypeError('A live MediaStream video track is required');
    }
    video.srcObject = stream;
    video.hidden = false;
    if (image) image.hidden = true;
    status.hidden = true;
    try { await video.play(); }
    catch (error) {
      showFallback('تعذر تشغيل بث المعلم؛ الصورة الأصلية متاحة.');
      throw error;
    }
  }
  video.addEventListener('error', () => showFallback('تعذر عرض بث المعلم الافتراضي.'));
  window.SumerAvatarDisplay = Object.freeze({
    attachTrustedStream,
    showFallback,
    stop() { showFallback(''); }
  });
  window.addEventListener('pagehide', () => showFallback(''));
})();
