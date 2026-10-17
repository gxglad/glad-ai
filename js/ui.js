/* ============================================================
   GLAD AI · 共享 UI 工具
   ------------------------------------------------------------
   图标、Toast、弹层、假二维码、格式化 —— 三个页面共用
   ============================================================ */

const UI = (function () {
  'use strict';

  /* ---------- 1. 图标（内联 SVG，零外链） ---------- */
  const ICONS = {
    spark:    '<path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/><circle cx="12" cy="12" r="3.2"/>',
    image:    '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.8" cy="8.8" r="1.8"/><path d="m21 15-4.6-4.6L7 20"/>',
    video:    '<rect x="2.5" y="5" width="14" height="14" rx="3"/><path d="m16.5 10.5 5-3v9l-5-3z"/>',
    wand:     '<path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/>',
    home:     '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    grid:     '<rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/>',
    layers:   '<path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
    wallet:   '<path d="M20 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6"/><circle cx="17" cy="14" r="1.2"/>',
    user:     '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
    users:    '<circle cx="9" cy="8" r="3.6"/><path d="M2.5 21c0-3.6 3-5.8 6.5-5.8s6.5 2.2 6.5 5.8"/><path d="M17 4.5a3.6 3.6 0 0 1 0 7M19 21c0-2.4-.7-4.2-2-5.4"/>',
    cart:     '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L21 7H6"/>',
    chart:    '<path d="M3 3v18h18"/><path d="m7 15 3.5-4 3 2.5L20 7"/>',
    cog:      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.2V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 3 15a1.7 1.7 0 0 0-1.55-1H1.3a2 2 0 1 1 0-4h.15A1.7 1.7 0 0 0 3 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 7.4 4.6h.09A1.7 1.7 0 0 0 9 3.05V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z"/>',
    logout:   '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    plus:     '<path d="M12 5v14M5 12h14"/>',
    minus:    '<path d="M5 12h14"/>',
    check:    '<path d="m4 12.5 5 5L20 6.5"/>',
    x:        '<path d="M6 6 18 18M18 6 6 18"/>',
    download: '<path d="M12 3v12M7 11l5 5 5-5M4 20h16"/>',
    trash:    '<path d="M4 7h16M10 4h4M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/>',
    copy:     '<rect x="9" y="9" width="12" height="12" rx="2.4"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    refresh:  '<path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5"/>',
    upload:   '<path d="M12 19V7M7 11l5-5 5 5M4 20h16"/>',
    search:   '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    play:     '<path d="M7 4.5v15l13-7.5z"/>',
    pause:    '<path d="M8 5v14M16 5v14"/>',
    shield:   '<path d="M12 2.5 20 6v6c0 5-3.4 8.4-8 9.5C7.4 20.4 4 17 4 12V6z"/><path d="m9 12 2 2 4-4"/>',
    key:      '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8 2 2-1.5 1.5L21 9l-2 2-1.5-1.5L15 12"/>',
    server:   '<rect x="3" y="3.5" width="18" height="7" rx="2"/><rect x="3" y="13.5" width="18" height="7" rx="2"/><path d="M7 7h.01M7 17h.01"/>',
    clock:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
    bell:     '<path d="M18 8a6 6 0 1 0-12 0c0 7-2.5 8-2.5 8h17S18 15 18 8"/><path d="M10.3 20.5a2 2 0 0 0 3.4 0"/>',
    film:     '<rect x="2.5" y="4" width="19" height="16" rx="2.6"/><path d="M7 4v16M17 4v16M2.5 9h4.5M2.5 15h4.5M17 9h4.5M17 15h4.5"/>',
    palette:  '<circle cx="12" cy="12" r="9"/><circle cx="8.6" cy="9.4" r="1.1"/><circle cx="12" cy="7.6" r="1.1"/><circle cx="15.4" cy="9.4" r="1.1"/><path d="M12 21a3 3 0 0 1 0-6h1.4a2 2 0 0 0 0-4"/>',
    bolt:     '<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/>',
    gift:     '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M3 12h18M12 8v13"/><path d="M12 8S9.5 3 7.5 3a2.5 2.5 0 0 0 0 5zM12 8s2.5-5 4.5-5a2.5 2.5 0 0 1 0 5z"/>',
    trend:    '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    eye:      '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12"/><circle cx="12" cy="12" r="2.8"/>',
    eyeOff:   '<path d="M3 3l18 18M10.6 6.1A9.6 9.6 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.4 4.2M6.5 7.8A17 17 0 0 0 2 12s3.6 6.5 10 6.5c1 0 2-.2 2.8-.5"/><path d="M9.9 9.9a2.8 2.8 0 0 0 3.9 3.9"/>',
    menu:     '<path d="M4 7h16M4 12h16M4 17h16"/>',
    mail:     '<rect x="2.5" y="5" width="19" height="14" rx="2.6"/><path d="m3 7 9 6 9-6"/>',
    phone:    '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M11 18.4h2"/>',
    lock:     '<rect x="4" y="10.5" width="16" height="11" rx="2.6"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
    link:     '<path d="M9.5 14.5 14.5 9.5"/><path d="M11 6.5 13 4.5a4 4 0 0 1 5.7 5.7l-2 2M13 17.5l-2 2a4 4 0 0 1-5.7-5.7l2-2"/>',
    folder:   '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2l2 2.5h7.8A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
    info:     '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
    alert:    '<path d="M12 3 2 20h20z"/><path d="M12 9.5v4.5M12 17.5h.01"/>',
    arrowUp:  '<path d="M12 20V4M6 10l6-6 6 6"/>',
    arrowDown:'<path d="M12 4v16M6 14l6 6 6-6"/>',
    arrowR:   '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowL:   '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    shuffle:  '<path d="M16 3h5v5M21 3l-7.5 7.5M8 21H3v-5M3 21l7.5-7.5M16 21h5v-5M14 14l7 7M3 3l6 6"/>',
  };

  function icon(name, size, cls) {
    const d = ICONS[name] || ICONS.info;
    const s = size || 16;
    return '<svg class="ico ' + (cls || '') + '" width="' + s + '" height="' + s +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }

  /* ---------- 2. 工具 ---------- */
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const num = (n) => (Number(n) || 0).toLocaleString('zh-CN');

  function ago(ts) {
    if (!ts) return '—';
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60) return '刚刚';
    if (d < 3600) return Math.floor(d / 60) + ' 分钟前';
    if (d < 86400) return Math.floor(d / 3600) + ' 小时前';
    if (d < 2592000) return Math.floor(d / 86400) + ' 天前';
    return GLAD.fmtDay(ts);
  }
  function secs(s) {
    s = Math.max(0, Math.round(s));
    const m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  }
  function ratioCss(r) { return 'ratio-' + String(r).replace(':', '-'); }

  function ratioBox(r) {
    // 视觉比例小方块：宽高按比例映射到 22px 盒子内
    const [a, b] = String(r).split(':').map(Number);
    const max = 21;
    const w = Math.round((a >= b ? 21 : 21 * (a / b)));
    const h = Math.round((b >= a ? 21 : 21 * (b / a)));
    return '<span class="ratio-shape" style="width:' + w + 'px;height:' + h + 'px"></span>';
  }

  /* ---------- 3. Toast ---------- */
  let toastHost = null;
  function ensureToastHost() {
    if (toastHost && document.body.contains(toastHost)) return toastHost;
    toastHost = document.createElement('div');
    toastHost.className = 'toast-host';
    document.body.appendChild(toastHost);
    return toastHost;
  }
  const TOAST_ICON = { ok: 'check', err: 'x', warn: 'alert', info: 'info' };
  function toast(msg, kind, ms) {
    kind = kind || 'info';
    const host = ensureToastHost();
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = icon(TOAST_ICON[kind] || 'info', 17, 'tico') + '<span>' + esc(msg) + '</span>';
    host.appendChild(el);
    const close = () => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 280);
    };
    const t = setTimeout(close, ms || 2600);
    el.addEventListener('click', () => { clearTimeout(t); close(); });
    return close;
  }
  const ok = (m, ms) => toast(m, 'ok', ms);
  const err = (m, ms) => toast(m, 'err', ms || 3400);
  const warn = (m, ms) => toast(m, 'warn', ms || 3000);
  const info = (m, ms) => toast(m, 'info', ms);

  /* ---------- 4. 弹层 ---------- */
  const openModals = [];
  function modal(opts) {
    const id = GLAD.uid('modal');
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.id = id;
    mask.innerHTML =
      '<div class="modal ' + (opts.size || '') + '" role="dialog" aria-modal="true">' +
        (opts.head === false ? '' :
          '<div class="modal-head">' +
            (opts.eyebrow ? '<div style="min-width:0"><div class="eyebrow">' + esc(opts.eyebrow) + '</div>' : '') +
            '<div class="t-h2">' + esc(opts.title || '') + '</div>' +
            (opts.eyebrow ? '</div>' : '') +
            '<button class="x-btn" data-close aria-label="关闭">' + icon('x', 16) + '</button>' +
          '</div>') +
        '<div class="modal-body">' + (opts.body || '') + '</div>' +
        (opts.foot === false ? '' : '<div class="modal-foot">' + (opts.foot || '') + '</div>') +
      '</div>';
    document.body.appendChild(mask);

    const close = () => {
      mask.classList.remove('is-open');
      const i = openModals.indexOf(entry);
      if (i >= 0) openModals.splice(i, 1);
      setTimeout(() => mask.remove(), 260);
      if (opts.onClose) opts.onClose();
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => { if (e.key === 'Escape' && openModals[openModals.length - 1] === entry) close(); };

    mask.addEventListener('click', (e) => {
      if (e.target === mask || e.target.closest('[data-close]')) close();
    });
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => mask.classList.add('is-open'));

    const body = mask.querySelector('.modal-body');
    const entry = { id, el: mask, body, close, root: mask.querySelector('.modal') };
    openModals.push(entry);
    setTimeout(() => {
      const f = mask.querySelector('input,textarea,select,button:not([data-close])');
      if (f && opts.autofocus !== false) f.focus();
    }, 120);
    if (opts.onMount) opts.onMount(entry);
    return entry;
  }

  function confirm(opts) {
    return new Promise((resolve) => {
      let done = false;
      const m = modal({
        size: 'narrow',
        title: opts.title || '确认操作',
        body: '<div class="t-sm" style="line-height:1.7">' + (opts.html || esc(opts.text || '')) + '</div>',
        foot:
          '<button class="btn" data-close>' + esc(opts.cancelText || '取消') + '</button>' +
          '<span class="spacer"></span>' +
          '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-yes>' +
            esc(opts.okText || '确认') + '</button>',
        onMount(e) {
          e.root.querySelector('[data-yes]').addEventListener('click', () => {
            done = true; e.close(); resolve(true);
          });
        },
        onClose() { if (!done) resolve(false); },
      });
      void m;
    });
  }

  function prompt(opts) {
    return new Promise((resolve) => {
      let done = false;
      const m = modal({
        size: 'narrow',
        title: opts.title || '输入',
        body:
          '<div class="field"><label class="field-label">' + esc(opts.label || '') + '</label>' +
          '<input class="input" data-inp value="' + esc(opts.value || '') +
          '" placeholder="' + esc(opts.placeholder || '') + '"></div>' +
          (opts.hint ? '<div class="field-hint mt-1">' + esc(opts.hint) + '</div>' : ''),
        foot:
          '<button class="btn" data-close>取消</button><span class="spacer"></span>' +
          '<button class="btn btn-primary" data-ok>确定</button>',
        onMount(e) {
          const inp = e.root.querySelector('[data-inp]');
          const submit = () => { done = true; e.close(); resolve(inp.value.trim()); };
          e.root.querySelector('[data-ok]').addEventListener('click', submit);
          inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') submit(); });
        },
        onClose() { if (!done) resolve(null); },
      });
      void m;
    });
  }

  /* ---------- 5. 假二维码 ----------
     说明：这是「演示用二维码」，用确定性随机画出来的图案，
     看去像真二维码（含三个定位角），但扫不出内容。
     接真支付时把这里换成支付网关返回的 code_url 生成的真码即可。 */
  function fakeQR(text, size) {
    const N = 25;
    const px = size || 188;
    const cell = px / N;
    const c = document.createElement('canvas');
    c.width = px; c.height = px;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, px, px);
    g.fillStyle = '#000';

    // 由文本派生稳定随机序列
    let seed = 2166136261;
    for (let i = 0; i < text.length; i++) {
      seed ^= text.charCodeAt(i);
      seed = (seed * 16777619) >>> 0;
    }
    const rnd = () => {
      seed ^= seed << 13; seed >>>= 0;
      seed ^= seed >>> 17;
      seed ^= seed << 5;  seed >>>= 0;
      return seed / 4294967296;
    };

    const inFinder = (x, y) =>
      (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (inFinder(x, y)) continue;
        if (rnd() > 0.52) g.fillRect(x * cell, y * cell, Math.ceil(cell), Math.ceil(cell));
      }
    }
    // 三个定位角
    const finder = (ox, oy) => {
      g.fillStyle = '#000';
      g.fillRect(ox * cell, oy * cell, 7 * cell, 7 * cell);
      g.fillStyle = '#fff';
      g.fillRect((ox + 1) * cell, (oy + 1) * cell, 5 * cell, 5 * cell);
      g.fillStyle = '#000';
      g.fillRect((ox + 2) * cell, (oy + 2) * cell, 3 * cell, 3 * cell);
    };
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
    // 时序线
    g.fillStyle = '#000';
    for (let i = 8; i < N - 8; i++) {
      if (i % 2 === 0) {
        g.fillRect(i * cell, 6 * cell, Math.ceil(cell), Math.ceil(cell));
        g.fillRect(6 * cell, i * cell, Math.ceil(cell), Math.ceil(cell));
      }
    }
    return c;
  }

  /* ---------- 6. 表单校验提示 ---------- */
  function setErr(inputEl, msg) {
    if (!inputEl) return;
    const field = inputEl.closest('.field') || inputEl.parentElement;
    let tip = field.querySelector('.err-tip');
    if (msg) {
      inputEl.style.borderColor = 'rgba(255,92,92,.7)';
      if (!tip) {
        tip = document.createElement('div');
        tip.className = 'err-tip field-hint';
        tip.style.color = '#FFAAAA';
        field.appendChild(tip);
      }
      tip.textContent = msg;
    } else {
      inputEl.style.borderColor = '';
      if (tip) tip.remove();
    }
  }

  /* ---------- 7. 简易导航高亮 ---------- */
  function nav(el) {
    document.querySelectorAll('.nav-item[data-nav]').forEach((a) => {
      a.classList.toggle('is-active', a.dataset.nav === el);
    });
  }

  /* ---------- 8. 轮询器 ---------- */
  function poll(fn, ms) {
    let stopped = false, timer = null;
    const run = async () => {
      if (stopped) return;
      try { await fn(); } catch (e) { console.warn(e); }
      if (!stopped) timer = setTimeout(run, ms);
    };
    run();
    return () => { stopped = true; clearTimeout(timer); };
  }

  /* ---------- 9. 骨架 ---------- */
  function skeletonGrid(n, ratio) {
    let h = '';
    for (let i = 0; i < n; i++) {
      h += '<div class="result-card ' + (ratio ? ratioCss(ratio) : '') + ' skeleton"></div>';
    }
    return h;
  }

  return {
    ICONS, icon, esc, num, ago, secs, ratioCss, ratioBox,
    toast, ok, err, warn, info,
    modal, confirm, prompt, setErr,
    fakeQR, nav, poll, skeletonGrid,
  };
})();

window.UI = UI;
