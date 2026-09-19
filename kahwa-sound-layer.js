// Kahwa runtime sound layer — separate from the preserved originals.
//
// Single sound source per event, so nothing ever double-plays:
//   domino : placement knock + draw blip (own AND remote moves)
//   tawla  : hit thud only (moves/dice stay with the original twin sounds)
//   chess  : move click / capture thud
//   cards  : draw / discard / meld blips
// Sounds fire once per authoritative state transition (diff-based). Repeated
// renders or socket echoes of the same state stay silent. Audio failures
// (autoplay policy, missing AudioContext) never break the game.
(function () {
  'use strict';

  // Pure transition detector. prevPub/nextPub are engine PUBLIC snapshots
  // (players and spectators observe the same object shape). Also exported
  // for Node contract tests.
  function soundEventsFor(gameType, prevPub, nextPub) {
    var out = [];
    if (!nextPub || typeof nextPub !== 'object') return out;
    if (!prevPub || typeof prevPub !== 'object') return out; // first paint: silent
    if (gameType === 'domino') {
      var pc = (prevPub.chain || []).length, nc = (nextPub.chain || []).length;
      var ps = Number(prevPub.stockCount || 0), ns = Number(nextPub.stockCount || 0);
      if (nc > pc) out.push('place');
      if (ns < ps) out.push('draw');
    } else if (gameType === 'tawla') {
      var pb = prevPub.bar || {}, nb = nextPub.bar || {};
      if (Number(nb.white || 0) > Number(pb.white || 0) ||
          Number(nb.black || 0) > Number(pb.black || 0)) out.push('hit');
    } else if (gameType === 'chess') {
      if (Number(nextPub.moveCount || 0) > Number(prevPub.moveCount || 0)) {
        var hist = nextPub.moveHistory || [];
        var last = hist[hist.length - 1];
        out.push(last && last.captured ? 'capture' : 'move');
      }
    } else if (gameType === 'cards') {
      var pm = (prevPub.melds || []).length, nm = (nextPub.melds || []).length;
      var pd = Number(prevPub.discardCount || 0), nd = Number(nextPub.discardCount || 0);
      var pk = Number(prevPub.stockCount || 0), nk = Number(nextPub.stockCount || 0);
      if (nm > pm) out.push('meld');
      else if (nd > pd) out.push('discard');
      else if (nk < pk) out.push('draw');
    }
    return out;
  }

  // --- WebAudio blips (no assets; every failure path is silent) ---
  var ac = null;
  function audio() {
    try {
      if (typeof window === 'undefined') return null;
      var A = window.AudioContext || window.webkitAudioContext;
      if (!A) return null;
      if (!ac) ac = new A();
      try {
        var p = ac.resume();
        if (p && p.catch) p.catch(function () {});
      } catch (_e) {}
      return ac.state === 'running' ? ac : null;
    } catch (_e) { return null; }
  }
  function unlock() { audio(); }
  function blip(freq, end, dur, vol, type) {
    try {
      var a = audio();
      if (!a) return;
      var t = a.currentTime, o = a.createOscillator(), g = a.createGain();
      o.type = type || 'triangle';
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, end), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(a.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (_e) {}
  }
  function play(ev) {
    if (ev === 'place') blip(155, 62, 0.12, 0.3);
    else if (ev === 'draw') blip(210, 95, 0.12, 0.18);
    else if (ev === 'hit' || ev === 'capture') { blip(140, 55, 0.16, 0.32); blip(90, 40, 0.2, 0.2); }
    else if (ev === 'move') blip(320, 140, 0.07, 0.22);
    else if (ev === 'discard') blip(420, 200, 0.07, 0.18);
    else if (ev === 'meld') { blip(520, 520, 0.07, 0.16, 'sine'); blip(780, 780, 0.09, 0.14, 'sine'); }
  }

  // --- Browser hook: wrap kahwaGameUI.mount and diff public snapshots ---
  function hook() {
    try {
      if (typeof window === 'undefined' || !window.kahwaGameUI || window.__kahwaSoundWrapped) return;
      window.__kahwaSoundWrapped = true;
      var orig = window.kahwaGameUI.mount;
      var lastKey = '', lastPub = null;
      window.kahwaGameUI.mount = function (container, context) {
        try {
          var type = (context && context.gameType) || '';
          var key = String((context && context.roomId) || '') + ':' + type;
          var s = (context && context.state) || {};
          var pub = s.public || s;
          if (key !== lastKey) { lastKey = key; lastPub = pub; }
          else {
            var evs = soundEventsFor(type, lastPub, pub);
            lastPub = pub;
            for (var i = 0; i < evs.length; i++) play(evs[i]);
          }
        } catch (_e) {}
        return orig.call(this, container, context);
      };
      try {
        if (window.addEventListener) {
          window.addEventListener('pointerdown', unlock, { passive: true });
          window.addEventListener('touchend', unlock, { passive: true });
          window.addEventListener('keydown', unlock);
        }
      } catch (_e) {}
    } catch (_e) {}
  }

  if (typeof window !== 'undefined') {
    hook();
    try {
      if (typeof document !== 'undefined' && document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hook);
      }
    } catch (_e) {}
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { soundEventsFor: soundEventsFor };
})();
