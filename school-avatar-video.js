/* Sumer avatar display: real provider MediaStream only; no synthetic teacher or recording. */
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

  let activeStream = null;
  let detachTrackListeners = () => {};
  let generation = 0;
  function showFallback(message) {
    generation += 1;
    detachTrackListeners();
    detachTrackListeners = () => {};
    activeStream = null;
    video.pause();
    video.srcObject = null;
    video.hidden = true;
    if (image) image.hidden = false;
    status.textContent = message || '';
    status.hidden = !message;
  }
  async function attachTrustedStream(stream) {
    if (typeof MediaStream === 'undefined' || !(stream instanceof MediaStream)) {
      throw new TypeError('A real MediaStream is required');
    }
    const tracks = stream.getVideoTracks();
    if (!tracks.some(t => t.readyState === 'live')) {
      throw new TypeError('A live video track is required');
    }
    showFallback('');
    const currentGeneration = generation;
    activeStream = stream;
    const onEnded = () => {
      if (activeStream === stream && !stream.getVideoTracks().some(t => t.readyState === 'live')) {
        showFallback('انتهى بث المعلم الافتراضي.');
      }
    };
    tracks.forEach(t => t.addEventListener('ended', onEnded));
    detachTrackListeners = () => tracks.forEach(t => t.removeEventListener('ended', onEnded));
    video.srcObject = stream;
    // The remote provider owns track lifecycle. We only detach, never stop shared tracks.
    try {
      await video.play();
      if (currentGeneration !== generation || activeStream !== stream) return;
      video.hidden = false;
      if (image) image.hidden = true;
      status.hidden = true;
    } catch (error) {
      if (activeStream === stream) showFallback('تعذر تشغيل بث المعلم؛ الصورة الأصلية متاحة.');
      throw error;
    }
  }
  video.addEventListener('error', () => showFallback('تعذر عرض بث المعلم الافتراضي.'));
  window.SumerAvatarDisplay = Object.freeze({
    attachTrustedStream,
    showFallback,
    stop() { showFallback(''); },
    isActive() { return !!activeStream; }
  });
  window.addEventListener('pagehide', () => showFallback(''));
})();
