(function () {
  'use strict';
  var API = (window.SocialAPI ? window.SocialAPI.baseUrl : 'https://shino-mino-tak-tak.duckdns.org');
  var token = (window.SocialAPI ? window.SocialAPI.token() : (localStorage.getItem('token') || sessionStorage.getItem('token') || ''));

  function esc(t) { return String(t || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }

  window.kahwaDominoUI = {
    mount: function (container, ctx) {
      if (!container) return;
      container.innerHTML = '<div class="kahwa-board" style="text-align:center;padding:10px;"><div class="kahwa-status">جارٍ تحميل الدومنة…</div></div>';
      this.render(container, ctx);
    },
    render: function (container, ctx) {
      var state = (ctx && ctx.state) || {};
      var hand = (state.private && state.private.hand) || [];
      var chain = (state.public && state.public.chain) || [];
      var myTurn = !!(state.private && state.private.turn);
      var status = (state.public && state.public.status) || 'waiting';

      var html = '<div class="kahwa-board" style="max-width:520px;margin:0 auto;background:linear-gradient(135deg,#061514,#0b1a15);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:14px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;color:#fff;font-size:13px;"><span>الدومنة</span><span style="color:#19D9A0;font-weight:700;">' + (status === 'finished' ? (state.public.winner ? '🏆 فاز اللاعب' : 'انتهت اللعبة') : (myTurn ? 'دورك' : 'انتظر الدور')) + '</span></div>';

      // Chain visual
      html += '<div style="display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;margin:10px 0;padding:12px;background:#132824;border-radius:12px;min-height:60px;" id="domino-chain">';
      if (chain && chain.length) {
        chain.forEach(function (t, idx) {
          var isDouble = t.a === t.b;
          html += '<div style="width:52px;height:78px;background:#fdf6e3;border:2px solid #111;border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.3);position:relative;flex-shrink:0;" title="' + t.a + '|' + t.b + '">' +
            '<div style="position:absolute;inset:2px;border:2px solid #111;border-radius:6px;"></div>' +
            (isDouble ? '<div style="font-size:22px;font-weight:900;color:#111;">' + t.a + '</div>' : '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;font-size:14px;font-weight:700;color:#111;"><span>' + t.a + '</span><span style="font-size:10px;color:#888;">|</span><span>' + t.b + '</span></div>') +
            '</div>';
        });
      } else {
        html += '<span style="color:#91A39D;font-size:14px;">بانتظار بداية السلسلة</span>';
      }
      html += '</div>';

      // Drop zones (show only during drag; handled by JS events)
      html += '<div id="drop-zones" style="display:none;justify-content:center;gap:12px;margin:4px 0;">' +
        '<div data-drop="left" style="width:80px;height:40px;border:2px dashed #19D9A0;border-radius:8px;background:rgba(25,217,160,.1);display:grid;place-items:center;color:#19D9A0;font-weight:700;">يسار</div>' +
        '<div data-drop="right" style="width:80px;height:40px;border:2px dashed #19D9A0;border-radius:8px;background:rgba(25,217,160,.1);display:grid;place-items:center;color:#19D9A0;font-weight:700;">يمين</div></div>';

      // Hand
      html += '<div style="margin-top:10px;padding:8px;background:#0d1814;border-radius:12px;"><h4 style="margin:0 0 8px;color:#91A39D;font-size:12px;">يدك</h4><div class="kahwa-hand" id="domino-hand" style="justify-content:center;">';
      if (hand && hand.length) {
        hand.forEach(function (t) {
          html += '<div class="kahwa-tile" draggable="true" data-tile-id="' + (t.id || t.a + '-' + t.b) + '" data-a="' + t.a + '" data-b="' + t.b + '" role="button" aria-label="حجر ' + t.a + '|' + t.b + '">' +
            '<div style="width:100%;height:100%;border-radius:inherit;background:#fdf6e3;border:2px solid #222;box-shadow:0 2px 6px rgba(0,0,0,.2);display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
            (t.a === t.b ? '<div style="font-size:22px;font-weight:900;color:#111;">' + t.a + '</div>' : '<div style="font-size:16px;font-weight:700;color:#111;text-align:center;line-height:1.2;"><span>' + t.a + '</span><div style="font-size:10px;color:#777;">|</div><span>' + t.b + '</span></div>') +
            '</div></div>';
        });
      } else {
        html += '<span style="color:#91A39D;font-size:13px;">لا يوجد أحجار</span>';
      }
      html += '</div></div>';

      // Controls
      html += '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;justify-content:center;">' +
        '<button type="button" id="btn-draw" class="kahwa-btn primary" style="display:none;">سحب من المخزن</button>' +
        '<button type="button" id="btn-pass" class="kahwa-btn accent" style="display:none;">مرور</button>' +
        '<button type="button" id="btn-leave" class="kahwa-btn" style="background:#FF4D4F;color:#fff;">مغادرة</button>' +
        '</div>';

      // Opponent
      html += '<div style="margin-top:8px;padding:10px;background:#0d1814;border-radius:10px;color:#fff;font-size:13px;"><strong>الخصم</strong>: <span style="color:#91A39D;">' + (state.public ? (state.public.players ? state.public.players.length + ' لاعب' : '') : '') + ' — ' + (state.public && state.public.turn ? 'دور: ' + state.public.turn : '') + '</span> — <span style="color:#19D9A0;">أحجار: ' + '—' + '</span></div>';

      html += '<div style="margin-top:6px;text-align:center;color:var(--kahwa-muted);font-size:11px;">اسحب الحجر إلى يسار أو يمين السلسلة</div>';

      html += '</div>';

      container.innerHTML = html;
    },

    bindActions: function (container, ctx) {
      var self = this;
      // Draw button visibility handled by legal actions update
      function updateUI() {
        // Show/disable draw/pass based on server response; here just visual
        document.getElementById('btn-draw').style.display = 'inline-block';
        document.getElementById('btn-pass').style.display = 'inline-block';
      }

      // Drag events
      var dragTile = null;
      var dropdownSide = null;
      container.querySelectorAll('.kahwa-tile').forEach(function (el) {
        el.addEventListener('pointerdown', function (e) {
          dragTile = { id: el.dataset.tileId, a: parseInt(el.dataset.a), b: parseInt(el.dataset.b) };
          el.classList.add('dragging');
          dropdownSide = 'right'; // default; can be changed by drop target
        });
        el.addEventListener('pointerup', function () {
          if (dragTile) {
            dragTile = null;
            el.classList.remove('dragging');
          }
        });
      });
      document.getElementById('drop-zones')?.addEventListener('click', function (e) {
        if (!dragTile) return;
        var side = e.target.closest('[data-drop]')?.dataset.drop;
        if (side) dropdownSide = side;
      });
      // Simplified: user clicks drop zones after drag; in real full version use drop event
      document.querySelectorAll('.kahwa-tile').forEach(function (el) {
        el.addEventListener('click', function () {
          if (!dragTile) return;
          // For simplicity: treat click on tile as selection, not drop
        });
      });

      document.getElementById('btn-draw')?.addEventListener('click', async function () {
        this.disabled = true; this.classList.add('loading');
        try {
          var r = await SocialAPI.request('/api/game-rooms/' + ctx.roomId + '/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'draw' }) });
          if (r.ok) { ctx.onAction && ctx.onAction({ success: true, state: r.room || r }); self.showSuccess('تم السحب'); }
          else { self.showError(r.message || 'فشل السحب'); }
        } catch (e) { self.showError(e.message || 'خطأ'); }
        finally { this.disabled = false; this.classList.remove('loading'); }
      });
      document.getElementById('btn-pass')?.addEventListener('click', async function () {
        this.disabled = true; this.classList.add('loading');
        try {
          var r = await SocialAPI.request('/api/game-rooms/' + ctx.roomId + '/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'pass' }) });
          if (r.ok) { ctx.onAction && ctx.onAction({ success: true, state: r.room || r }); self.showSuccess('تم المرور'); }
          else { self.showError(r.message || 'ليست حركة قانونية'); }
        } catch (e) { self.showError(e.message || 'خطأ'); }
        finally { this.disabled = false; this.classList.remove('loading'); }
      });
    },

    setLoading: function (v) { /* handled by button states */ },
    setLegalActions: function (actions) {
      // Show/hide draw/pass based on action types available
      var drawAllowed = actions && actions.some(function (a) { return a.type === 'draw'; });
      var passAllowed = actions && actions.some(function (a) { return a.type === 'pass'; });
      var d = document.getElementById('btn-draw');
      var p = document.getElementById('btn-pass');
      if (d) d.style.display = drawAllowed ? 'inline-block' : 'none';
      if (p) p.style.display = passAllowed ? 'inline-block' : 'none';
    },
    showSuccess: function (msg) {
      var el = document.getElementById('domino-status');
      if (el) { el.textContent = msg; el.style.color = '#19D9A0'; setTimeout(function () { el.textContent = ''; }, 2000); }
    },
    showError: function (msg) {
      var el = document.getElementById('domino-status');
      if (el) { el.textContent = msg; el.style.color = '#FF4D4F'; setTimeout(function () { el.textContent = ''; }, 2500); }
    },
    destroy: function () { /* cleanup not needed for simple DOM */ }
  };

  // Expose globally
  window.kahwaDominoUI = kahwaDominoUI;
})();
