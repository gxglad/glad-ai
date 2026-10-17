/* ============================================================
   GLAD AI · 客户端逻辑
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ---------- 视图元信息 ---------- */
  const VIEWS = {
    studio:  { title: '生成工作台', sub: '选择模型、比例与时长，一句话出片' },
    assets:  { title: '我的作品',   sub: '你生成过的全部图片与视频' },
    credits: { title: '积分与充值', sub: '查看剩余积分、购买积分包' },
    orders:  { title: '充值记录',   sub: '每一笔充值订单的明细与状态' },
    profile: { title: '个人中心',   sub: '资料、密码与数据管理' },
  };

  /* ---------- 分辨率像素对照（来自上游 API 实测值） ---------- */
  const SHORT_SIDE = { '1k': 936, '2k': 1440, '4k': 3040, '720p': 720, '1080p': 1080 };
  const EXACT_PX = {
    '1k|1:1': '1328×1328', '1k|16:9': '1664×936', '1k|21:9': '2016×846', '1k|9:16': '936×1664',
    '2k|1:1': '2048×2048', '2k|16:9': '2560×1440', '2k|21:9': '3024×1296', '2k|9:16': '1440×2560',
    '4k|1:1': '4096×4096', '4k|16:9': '5404×3040', '4k|21:9': '6197×2656', '4k|9:16': '3040×5404',
  };
  function pxLabel(res, ratio) {
    const e = EXACT_PX[res + '|' + ratio];
    if (e) return e;
    const base = SHORT_SIDE[res];
    if (!base) return '';
    const [a, b] = String(ratio).split(':').map(Number);
    const round8 = (n) => Math.round(n / 8) * 8;
    const w = round8(a >= b ? base * (a / b) : base);
    const h = round8(b >= a ? base * (b / a) : base);
    return w + '×' + h;
  }

  /* ---------- 灵感库 ---------- */
  const IDEAS = {
    image: [
      '夜晚的东京街头，霓虹灯在雨后的路面上晕开，电影感，浅景深',
      '雪山之巅的孤独旅人，逆光剪影，清晨薄雾，胶片颗粒',
      '漂浮在云海上的巨鲸，超现实主义，粉紫色黄昏天空',
      '老式咖啡馆内景，午后阳光穿过百叶窗，暖色调，胶片质感',
      '水墨风格的龙在云中翻腾，留白构图，东方美学',
      '机械蜂鸟悬停在一朵金属花前，微距，精密机械结构',
      '赛博朋克风格的中国古镇，灯笼与全息广告牌并存',
      '极简产品摄影：一瓶香水放在水面倒影上，冷调，硬光',
    ],
    video: [
      '镜头缓慢推进，穿过雾气弥漫的松林，晨光从树缝洒下',
      '宇航员站在红色沙漠上看双日落，史诗感，缓慢横移镜头',
      '一杯热咖啡被倒入，蒸汽升腾，微距慢动作，暖光',
      '雨天的东京小巷，自动贩卖机的光，镜头缓慢前推',
      '一只机械蝴蝶展开翅膀飞起，金属反光，浅景深',
      '雪山冰川在阳光下缓缓崩塌，广角，震撼，慢动作',
    ],
  };

  /* ---------- 全局状态 ---------- */
  const S = {
    type: 'image',
    view: 'studio',
    ratio: '1:1',
    resolution: '2k',
    duration: 10,
    count: 1,
    model: null,
    refImages: [],
    results: [],
    assetFilter: 'all',
    assetSearch: '',
    orderFilter: 'all',
    openJob: null,
    unsub: [],
  };

  const cfg = () => GLAD.config();
  const me  = () => GLAD.currentUser();

  /* ============================================================
     启动
     ============================================================ */
  function boot() {
    GLAD.seed();

    const c = cfg();
    document.title = c.site.name + ' · ' + c.site.tagline;
    $('#brand-name').textContent = c.site.name;
    $('#brand-sub').textContent = c.site.tagline;
    $('#foot-brand').textContent = c.site.footer || c.site.name;
    $('#year').textContent = new Date().getFullYear();
    $('#about-time').textContent = new Date().toLocaleString('zh-CN');

    const notice = c.site.notice;
    if (notice && c.site.showNotice && !sessionStorage.getItem('glad.notice.closed')) {
      const nb = $('#notice-bar');
      nb.classList.remove('hidden');
      $('#notice-text').textContent = notice;
    } else {
      $('#notice-bar').classList.add('hidden');
    }
    $('#notice-close').addEventListener('click', () => {
      sessionStorage.setItem('glad.notice.closed', '1');
      $('#notice-bar').classList.add('hidden');
    });

    if (!me()) {
      showGate();
    } else {
      enterApp();
    }
  }

  function showGate() {
    const gate = $('#gate');
    gate.classList.add('is-open');
    gate.addEventListener('click', (e) => {
      if (e.target === gate) return; // 必须登录
    });
    $('#gate-demo').addEventListener('click', async () => {
      const r = await GLAD.login({ account: 'demo', password: 'demo123' });
      if (r.ok) {
        gate.classList.remove('is-open');
        setTimeout(() => gate.remove(), 300);
        enterApp();
        UI.ok('已用演示账号登录');
      } else {
        UI.err(r.msg);
      }
    });
  }

  function enterApp() {
    const app = $('#app');
    if (!app.hidden) return;
    app.hidden = false;
    $('#gate').classList.remove('is-open');
    setView('studio');
    bindAll();
    refreshUser();
    UI.poll(refreshPoolPill, 30000);
  }

  /* ============================================================
     用户信息刷新
     ============================================================ */
  function refreshUser() {
    const u = me();
    if (!u) return;
    const initial = (u.username || 'U').slice(0, 1).toUpperCase();
    ['#side-avatar', '#pf-avatar'].forEach((s) => { const el = $(s); if (el) el.textContent = initial; });
    $('#side-name').textContent = u.username;
    $('#side-mail').textContent = u.email || u.phone || '—';
    $('#credit-val').textContent = UI.num(u.credits);
    $('#credits-big').textContent = UI.num(u.credits);
    $('#pf-name').textContent = u.username;
    $('#pf-mail').textContent = u.email || '—';
    $('#pf-credits').textContent = UI.num(u.credits);
    $('#pf-role').textContent = u.role === 'admin' ? '管理员' : '普通用户';
    $('#pf-since').textContent = '注册于 ' + GLAD.fmtDay(u.createdAt);
    $('#pf-in-name').value = u.username;
    $('#pf-in-mail').value = u.email || '';
    $('#pf-in-phone').value = u.phone || '';
    $('#nav-admin').classList.toggle('hidden', u.role !== 'admin');

    const js = GLAD.myJobs();
    $('#nav-assets-count').textContent = js.length;
    updateCost();
  }

  function refreshPoolPill() {
    const p = GLAD.poolCredits();
    $('#pool-text').textContent = '额度池 ' + UI.num(p.total);
    const pill = $('#pool-pill');
    pill.className = 'pill ' + (p.total > 500 ? 'ok' : p.total > 0 ? 'warn' : 'danger');
    pill.title = '聚合 ' + p.accounts + ' 个账号 · 可用 ' + p.usable + ' 个 · 失效 ' + p.dead + ' 个';
    const t = $('#engine-text');
    const mode = cfg().api.mode;
    t.textContent = mode === 'real' ? '真实接口 · 已连接' : '演示模式 · 本地模拟';
  }

  /* ============================================================
     视图切换
     ============================================================ */
  function setView(v) {
    if (!VIEWS[v]) v = 'studio';
    S.view = v;
    $$('[data-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== v));
    $$('[data-view]').forEach((b) => b.classList.toggle('is-active', b.dataset.view === v));
    $('#page-title').textContent = VIEWS[v].title;
    $('#page-sub').textContent = VIEWS[v].sub;
    $('#sidebar').classList.remove('is-open');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (v === 'assets') renderAssets();
    if (v === 'credits') renderCredits();
    if (v === 'orders') renderOrders();
    if (v === 'profile') renderProfile();
  }

  /* ============================================================
     参数面板
     ============================================================ */
  const modelsOf = (type) => (type === 'video' ? cfg().videoModels : cfg().imageModels)
    .filter((m) => m.enabled !== false);

  function currentModel() {
    const list = modelsOf(S.type);
    return list.find((m) => m.id === S.model) || list[0] || null;
  }

  function renderModelSelect() {
    const list = modelsOf(S.type);
    const sel = $('#model');
    sel.innerHTML = list.map((m) =>
      '<option value="' + UI.esc(m.id) + '">' + UI.esc(m.name) +
      (m.badge ? ' · ' + UI.esc(m.badge) : '') + '</option>').join('');

    if (!list.some((m) => m.id === S.model)) S.model = list[0] ? list[0].id : null;
    if (S.model) sel.value = S.model;
    $('#model-count').textContent = list.length + ' 个可用';
    applyModelDefaults();
  }

  function applyModelDefaults() {
    const m = currentModel();
    if (!m) return;
    $('#model-desc').textContent = m.desc || '';

    const pool = S.type === 'video' ? cfg().video.ratios : cfg().image.ratios;
    if (!pool.includes(S.ratio)) S.ratio = S.type === 'video' ? cfg().video.defaultRatio : cfg().image.defaultRatio;
    if (!m.resolutions.includes(S.resolution)) S.resolution = m.defaultResolution;

    const ds = (m.durations && m.durations.length) ? m.durations : cfg().video.durations;
    if (!ds.includes(S.duration)) S.duration = ds[ds.length - 1];

    renderRatioGrid();
    renderResGrid();
    renderDurGrid();
    updateCost();
  }

  function renderRatioGrid() {
    const c = cfg();
    const isVideo = S.type === 'video';
    const pool = isVideo ? c.video.ratios : c.image.ratios;
    const labels = isVideo ? c.video.ratioLabels : c.image.ratioLabels;
    // 按钮上显示规范比例数字（如 16:9），描述性叫法只放在悬停提示里
    $('#ratio-grid').innerHTML = pool.map((r) => {
      const hint = (labels && labels[r]) ? labels[r] : '';
      const px = pxLabel(isVideo ? S.resolution : S.resolution, r);
      return '<button class="ratio-btn ' + (r === S.ratio ? 'is-active' : '') + '" data-ratio="' + r + '" ' +
        'title="' + UI.esc(r + (hint ? ' · ' + hint : '') + (px ? ' · ' + px : '')) + '">' +
        UI.ratioBox(r) +
        '<span class="lbl">' + r + '</span>' +
      '</button>';
    }).join('');
    $$('#ratio-grid .ratio-btn').forEach((b) => b.addEventListener('click', () => {
      S.ratio = b.dataset.ratio;
      renderRatioGrid(); updateCost();
    }));
  }

  function renderResGrid() {
    const m = currentModel();
    if (!m) return;
    const resLabel = { '1k': '1K 标清', '2k': '2K 高清', '4k': '4K 超清', '720p': '720P', '1080p': '1080P' };
    $('#res-grid').innerHTML = m.resolutions.map((r) => {
      // 每个档位直接标出积分，避免用户猜价格（Higgsfield / Sora 的做法）
      const c = GLAD.priceOf(S.type, m.id, r, S.duration);
      return '<button class="opt ' + (r === S.resolution ? 'is-active' : '') + '" data-res="' + r + '" ' +
        'title="' + UI.esc(String(r).toUpperCase() + ' · ' + pxLabel(r, S.ratio) + ' · ' + c + ' 积分') + '">' +
        UI.esc(resLabel[r] || r.toUpperCase()) +
        '<span style="opacity:.62;font-size:11px;margin-left:5px">' + c + '分</span></button>';
    }).join('');
    $$('#res-grid .opt').forEach((b) => b.addEventListener('click', () => {
      S.resolution = b.dataset.res;
      renderResGrid(); updateCost();
    }));
  }

  function renderDurGrid() {
    const isVideo = S.type === 'video';
    $('#dur-field').classList.toggle('hidden', !isVideo);
    if (!isVideo) return;
    const m = currentModel();
    const ds = (m && m.durations && m.durations.length) ? m.durations : cfg().video.durations;
    // 时长档位下面直接写该档的积分（Kling 按秒计费 / Pika 每秒 8 分的做法）
    $('#dur-grid').innerHTML = ds.map((d) => {
      const c = GLAD.priceOf('video', m.id, S.resolution, Number(d));
      return '<button class="opt ' + (Number(d) === Number(S.duration) ? 'is-active' : '') + '" data-dur="' + d + '" ' +
        'title="' + d + ' 秒 · ' + c + ' 积分">' + d + ' 秒' +
        '<span style="opacity:.62;font-size:11px;margin-left:5px">' + c + '分</span></button>';
    }).join('');
    $$('#dur-grid .opt').forEach((b) => b.addEventListener('click', () => {
      S.duration = Number(b.dataset.dur);
      renderDurGrid(); updateCost();
    }));
    $('#dur-hint').textContent = ds.length > 1
      ? '上游仅支持 5 / 10 秒两档，超时会自动降级为 5 秒'
      : '该模型固定为 ' + ds[0] + ' 秒，上游不支持其它时长';
  }

  function updateCost() {
    const m = currentModel();
    if (!m) return;
    const maxLen = cfg().audit.maxPromptLen;
    const cost = GLAD.priceOf(S.type, m.id, S.resolution, S.duration);
    $('#cost-est').innerHTML = UI.num(cost) + '<span class="u">积分</span>';
    const u = me();
    const after = (u ? u.credits : 0) - cost;
    $('#cost-after').innerHTML = '<span style="color:' + (after < 0 ? '#FFAAAA' : 'inherit') + '">' +
      UI.num(after) + '<span class="u">积分</span></span>';
    $('#res-px').textContent = pxLabel(S.resolution, S.ratio);

    // 生成按钮上直接写积分（Higgsfield 唯一明确这样做的产品，能消除最大焦虑）
    const base = S.type === 'video' ? '开始生成视频' : '开始生成图片';
    const btnLabel = cost > 0 ? base + ' · ' + cost + ' 积分' : base;
    $('#gen-label').textContent = btnLabel;

    const btn = $('#btn-generate');
    const lack = u && u.credits < cost;
    btn.classList.toggle('is-disabled', !!lack);
    $('#gen-hint').innerHTML = lack
      ? '<span style="color:#FFAAAA">积分不足，还差 ' + UI.num(cost - u.credits) +
        ' 分 · <a href="#" id="hint-recharge" style="color:#C3B4FF;text-decoration:underline">去充值</a></span>'
      : (maxLen && $('#prompt').value.length > maxLen
          ? '<span style="color:#FFAAAA">提示词超出上限 ' + maxLen + ' 字</span>'
          : '生成即代表同意平台使用规范');
    const hr = $('#hint-recharge');
    if (hr) hr.addEventListener('click', (e) => { e.preventDefault(); openPayPicker(); });
  }

  /* ============================================================
     生成
     ============================================================ */
  function addResult(job) {
    S.results = S.results.filter((j) => j.id !== job.id);
    S.results.unshift(job);
    renderResults();
  }
  function patchResult(id, patch) {
    const i = S.results.findIndex((j) => j.id === id);
    if (i < 0) return;
    S.results[i] = { ...S.results[i], ...patch };
    renderResults();
  }

  function renderResults() {
    const host = $('#results');
    if (!S.results.length) {
      host.innerHTML =
        '<div class="empty">' +
          '<span class="ico-lg"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.8" cy="8.8" r="1.8"/><path d="m21 15-4.6-4.6L7 20"/></svg></span>' +
          '<div class="t-h3">还没有生成内容</div>' +
          '<div class="t-sm">在左侧输入提示词，调好右侧参数，点击「开始生成」</div>' +
        '</div>';
      return;
    }
    host.innerHTML = '<div class="result-grid stagger">' + S.results.map(resultCard).join('') + '</div>';
    bindResultActions();
  }

  function resultCard(j) {
    const running = j.status === 'running';
    const failed = j.status === 'failed';
    const url = j.urls && j.urls[0];
    let media;
    if (running) {
      media = '<div class="skeleton" style="position:absolute;inset:0"></div>' +
        '<div style="position:absolute;inset:0;display:grid;place-items:center;gap:10px;align-content:center">' +
          '<div class="progress-ring">' + ring(j.progress || 0, 74) + '</div>' +
          '<div class="t-xs" style="margin-top:8px">' + UI.esc(j.stage || '生成中') + '</div>' +
        '</div>';
    } else if (failed) {
      media = '<div style="position:absolute;inset:0;display:grid;place-items:center;padding:16px;text-align:center">' +
        '<div><div style="color:#FFAAAA;font-size:22px;margin-bottom:6px">✕</div>' +
        '<div class="t-xs" style="color:#FFAAAA">生成失败</div>' +
        '<div class="t-xs" style="margin-top:4px">' + UI.esc(j.error || '未知错误') + '</div></div></div>';
    } else if (url) {
      media = j.type === 'video'
        ? '<video src="' + url + '" muted loop playsinline preload="metadata"></video>' +
          '<div style="position:absolute;inset:0;display:grid;place-items:center;pointer-events:none">' +
          '<span style="width:44px;height:44px;border-radius:50%;background:rgba(0,0,0,.5);display:grid;place-items:center;backdrop-filter:blur(6px)">' +
          '<svg width="17" height="17" viewBox="0 0 24 24" fill="#fff"><path d="M7 4.5v15l13-7.5z"/></svg></span></div>'
        : '<img src="' + url + '" alt="" loading="lazy">';
    } else {
      media = '';
    }

    return '<div class="result-card ' + UI.ratioCss(j.ratio) + '" data-job="' + j.id + '">' + media +
      '<div class="result-top">' +
        (j.type === 'video'
          ? '<span class="pill info">' + (j.duration || 5) + 's · ' + UI.esc(j.resolution) + '</span>'
          : '<span class="pill brand">' + UI.esc(String(j.resolution).toUpperCase()) + '</span>') +
        '<span class="spacer"></span>' +
        (j.demo ? '<span class="pill" title="演示占位图">演示</span>' : '') +
      '</div>' +
      (running ? '' :
      '<div class="overlay">' +
        '<div class="prompt-txt">' + UI.esc(j.prompt) + '</div>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap">' +
          '<span class="pill" style="height:19px;font-size:10.5px">' + UI.esc(j.modelName) + '</span>' +
          '<span class="pill" style="height:19px;font-size:10.5px">' + UI.esc(j.ratio) + '</span>' +
          '<span class="pill" style="height:19px;font-size:10.5px">' + UI.num(j.cost) + ' 分</span>' +
        '</div>' +
        '<div class="result-actions">' +
          (url ? '<button class="btn btn-sm" data-act="preview">' +
            '<svg class="ico" viewBox="0 0 24 24"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12"/><circle cx="12" cy="12" r="2.8"/></svg>预览</button>' +
            '<button class="btn btn-sm" data-act="download"><svg class="ico" viewBox="0 0 24 24"><path d="M12 3v12M7 11l5 5 5-5M4 20h16"/></svg>下载</button>' +
            '<button class="btn btn-sm" data-act="reuse"><svg class="ico" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5"/></svg>再来一次</button>' : '') +
          '<span class="spacer"></span>' +
          '<button class="btn btn-sm btn-danger" data-act="del"><svg class="ico" viewBox="0 0 24 24"><path d="M4 7h16M10 4h4M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg></button>' +
        '</div>' +
      '</div>') +
    '</div>';
  }

  function ring(pct, size) {
    const r = (size - 8) / 2;
    const circ = 2 * Math.PI * r;
    const off = circ * (1 - Math.min(100, Math.max(0, pct)) / 100);
    return '<svg width="' + size + '" height="' + size + '">' +
      '<defs><linearGradient id="glad-grad" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#7C5CFF"/><stop offset="1" stop-color="#29E0FF"/></linearGradient></defs>' +
      '<circle class="track" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="3.5"/>' +
      '<circle class="fill" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="3.5" ' +
      'stroke-dasharray="' + circ + '" stroke-dashoffset="' + off + '"/></svg>' +
      '<span class="pct">' + pct + '%</span>';
  }

  function bindResultActions() {
    $$('#results .result-card').forEach((card) => {
      const id = card.dataset.job;
      card.addEventListener('mouseenter', () => {
        const v = card.querySelector('video');
        if (v) v.play().catch(() => {});
      });
      card.addEventListener('mouseleave', () => {
        const v = card.querySelector('video');
        if (v) { v.pause(); v.currentTime = 0; }
      });
      $$('[data-act]', card).forEach((b) => b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const act = b.dataset.act;
        const job = S.results.find((x) => x.id === id);
        if (!job) return;
        if (act === 'preview') return openPreview(job);
        if (act === 'download') return downloadJob(job);
        if (act === 'reuse') {
          $('#prompt').value = job.prompt || '';
          S.type = job.type;
          $$('#type-switch button').forEach((x) => x.classList.toggle('is-active', x.dataset.type === S.type));
          S.model = job.model;
          S.ratio = job.ratio;
          S.resolution = job.resolution;
          if (job.duration) S.duration = job.duration;
          renderModelSelect();
          onPromptInput();
          UI.info('已回填参数，可直接再次生成');
          return;
        }
        if (act === 'del') {
          const yes = await UI.confirm({ title: '删除这条作品？', text: '删除后不可恢复。', okText: '删除', danger: true });
          if (!yes) return;
          GLAD.deleteJob(id);
          S.results = S.results.filter((x) => x.id !== id);
          renderResults();
          refreshUser();
          UI.ok('已删除');
        }
      }));
    });
  }

  function openPreview(job) {
    const url = job.urls && job.urls[0];
    const m = UI.modal({
      size: 'wide',
      title: job.modelName,
      eyebrow: job.type === 'video' ? '视频预览' : '图片预览',
      body:
        '<div style="border-radius:var(--r-md);overflow:hidden;background:#000;margin-bottom:14px">' +
        (job.type === 'video'
          ? '<video src="' + url + '" controls autoplay loop style="width:100%;max-height:56vh;object-fit:contain"></video>'
          : '<img src="' + url + '" style="width:100%;max-height:56vh;object-fit:contain">') +
        '</div>' +
        '<div class="t-sm" style="line-height:1.7;margin-bottom:12px">' + UI.esc(job.prompt) + '</div>' +
        '<div class="row row-wrap" style="gap:7px">' +
          '<span class="pill brand">' + UI.esc(job.modelName) + '</span>' +
          '<span class="pill">' + UI.esc(job.ratio) + '</span>' +
          '<span class="pill">' + UI.esc(String(job.resolution).toUpperCase()) + '</span>' +
          (job.duration ? '<span class="pill">' + job.duration + ' 秒</span>' : '') +
          '<span class="pill">' + UI.num(job.cost) + ' 积分</span>' +
          '<span class="pill">' + GLAD.fmtDate(job.createdAt) + '</span>' +
        '</div>' +
        (job.refImages && job.refImages.length
          ? '<div class="mt-2"><div class="eyebrow mb-1">参考图</div><div class="thumbs">' +
            job.refImages.map((s) => '<div class="thumb"><img src="' + s + '"></div>').join('') +
            '</div></div>' : ''),
      foot:
        '<button class="btn" data-close>关闭</button><span class="spacer"></span>' +
        '<button class="btn btn-primary" data-dl><svg class="ico" viewBox="0 0 24 24"><path d="M12 3v12M7 11l5 5 5-5M4 20h16"/></svg>下载</button>',
      onMount(e) {
        e.root.querySelector('[data-dl]').addEventListener('click', () => downloadJob(job));
      },
    });
    void m;
  }

  function downloadJob(job) {
    const url = job.urls && job.urls[0];
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'glad-' + job.type + '-' + job.id + (job.type === 'video' ? '.jpg' : '.jpg');
    a.click();
    UI.ok('已开始下载');
  }

  async function doGenerate() {
    const btn = $('#btn-generate');
    if (btn.classList.contains('is-disabled')) {
      const u = me();
      const m = currentModel();
      const cost = GLAD.priceOf(S.type, m.id, S.resolution, S.duration);
      UI.err('积分不足：本次需 ' + cost + '，当前 ' + (u ? u.credits : 0));
      return openPayPicker();
    }
    const prompt = $('#prompt').value.trim();
    if (!prompt) { UI.warn('请先输入提示词'); $('#prompt').focus(); return; }

    const r = await GLAD.createJob({
      type: S.type,
      model: S.model,
      prompt,
      negativePrompt: $('#negative').value,
      ratio: S.ratio,
      resolution: S.resolution,
      duration: S.duration,
      refImages: S.refImages.slice(),
      sampleStrength: Number($('#strength').value),
    });

    if (!r.ok) {
      UI.err(r.msg);
      if (r.code === -2009) {
        refreshUser();
        setTimeout(openPayPicker, 380);
      }
      return;
    }
    S.results.unshift(r.job);
    renderResults();
    $('#prompt').value = '';
    onPromptInput();
    refreshUser();
    const t = r.job.type === 'video' ? '视频' : '图片';
    UI.info(t + '已提交，预计 ' + (r.job.type === 'video' ? '10–60 秒' : '4–8 秒') + '完成');
  }

  /* 订阅任务进度 */
  function subscribeJobs() {
    S.unsub.push(GLAD.on('job:progress', ({ id, progress, stage }) => patchResult(id, { progress, stage })));
    S.unsub.push(GLAD.on('job:done', ({ id }) => {
      const j = GLAD.jobById(id);
      if (j) { patchResult(id, j); refreshUser(); UI.ok('生成完成'); }
    }));
  }

  /* ============================================================
     参考图
     ============================================================ */
  function onRefFiles(files) {
    const max = S.type === 'video' ? cfg().video.maxRefImages : 1;
    Array.from(files).forEach((f) => {
      if (!f.type.startsWith('image/')) return;
      if (S.refImages.length >= max) { UI.warn('最多 ' + max + ' 张参考图'); return; }
      const fr = new FileReader();
      fr.onload = () => { S.refImages.push(fr.result); renderRefs(); };
      fr.readAsDataURL(f);
    });
  }
  function renderRefs() {
    const max = S.type === 'video' ? cfg().video.maxRefImages : 1;
    $('#ref-thumbs').innerHTML = S.refImages.map((s, i) =>
      '<div class="thumb"><img src="' + s + '"><button class="thumb-x" data-i="' + i + '">✕</button></div>').join('');
    $('#ref-count').textContent = S.refImages.length + ' / ' + max;
    $$('#ref-thumbs .thumb-x').forEach((b) => b.addEventListener('click', () => {
      S.refImages.splice(Number(b.dataset.i), 1);
      renderRefs();
    }));
    $('#ref-hint').textContent = S.type === 'video'
      ? '首帧 / 尾帧（第 1 张为首帧，第 2 张为尾帧）'
      : '参考图（图生图 · 传图后反向提示词会失效）';
  }

  /* ============================================================
     我的作品
     ============================================================ */
  function renderAssets() {
    let js = GLAD.myJobs();
    if (S.assetFilter !== 'all') js = js.filter((j) => j.type === S.assetFilter);
    if (S.assetSearch) {
      const s = S.assetSearch.toLowerCase();
      js = js.filter((j) => (j.prompt || '').toLowerCase().includes(s) ||
        (j.modelName || '').toLowerCase().includes(s));
    }
    const host = $('#assets-grid');
    if (!js.length) {
      host.innerHTML = '<div class="empty">' +
        '<span class="ico-lg"><svg viewBox="0 0 24 24"><path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></svg></span>' +
        '<div class="t-h3">这里还是空的</div>' +
        '<div class="t-sm">去「生成工作台」创作第一个作品吧</div>' +
        '<button class="btn btn-primary mt-1" id="btn-empty-go">去创作</button>' +
        '</div>';
      const g = $('#btn-empty-go');
      if (g) g.addEventListener('click', () => setView('studio'));
      return;
    }
    host.innerHTML = '<div class="result-grid stagger">' + js.map(resultCard).join('') + '</div>';
    // 绑定：作品页复用同一套动作
    S.results = js.slice();
    bindResultActions();
  }

  /* ============================================================
     积分与充值
     ============================================================ */
  function renderCredits() {
    const u = me();
    if (!u) return;
    const js = GLAD.myJobs();
    const done = js.filter((j) => j.status === 'done');
    const os = GLAD.myOrders();
    const paid = os.filter((o) => o.status === 'paid');
    const consumed = done.reduce((a, b) => a + (b.cost || 0), 0);
    const recharged = paid.reduce((a, b) => a + b.credits, 0);

    $('#st-consumed').textContent = UI.num(consumed);
    $('#st-recharged').textContent = UI.num(recharged);
    $('#st-jobs').textContent = UI.num(js.length);
    $('#st-jobs-d').textContent = '图片 ' + js.filter((j) => j.type === 'image').length +
      ' · 视频 ' + js.filter((j) => j.type === 'video').length;
    const spentYuan = paid.reduce((a, b) => a + b.price, 0);
    $('#st-vip').textContent = spentYuan >= 500 ? '黑金' : spentYuan >= 100 ? '黄金' : '普通';
    $('#st-vip-d').textContent = '累计充值 ¥' + spentYuan;

    // 套餐
    const plans = cfg().recharge.plans;
    $('#plan-grid').innerHTML = plans.map((p) => {
      const total = p.credits + (p.bonus || 0);
      const unit = (p.price / total * 10).toFixed(2);
      return '<button class="plan" data-plan="' + p.id + '">' +
        (p.bonus ? '<span class="bonus">+送 ' + p.bonus + '</span>' : '') +
        '<div class="t-xs">' + UI.esc(p.label) + '</div>' +
        '<div class="amt"><span class="cur">¥</span>' + p.price + '</div>' +
        '<div class="pts"><b>' + UI.num(total) + '</b> 积分</div>' +
        '<div class="t-xs mt-1" style="color:var(--text-4)">约 ' + unit + ' 元 / 100 分</div>' +
        '</button>';
    }).join('');
    $$('#plan-grid .plan').forEach((b) => b.addEventListener('click', () => openPayPicker(b.dataset.plan)));

    // 价格表
    const rows = [];
    const IMG_RES = { '1k': '1K 标清', '2k': '2K 高清', '4k': '4K 超清' };
    cfg().imageModels.filter((m) => m.enabled !== false).forEach((m) => {
      m.resolutions.forEach((r, i) => {
        rows.push('<tr>' + (i === 0 ? '<td rowspan="' + m.resolutions.length + '"><span class="pill brand">图片</span></td>' +
          '<td rowspan="' + m.resolutions.length + '"><span class="t-strong">' + UI.esc(m.name) + '</span></td>' : '') +
          '<td>' + UI.esc(IMG_RES[r] || String(r).toUpperCase()) + '</td>' +
          '<td class="text-r num">' + UI.num(m.cost[r]) + ' 分</td></tr>');
      });
    });
    cfg().videoModels.filter((m) => m.enabled !== false).forEach((m) => {
      const ds = (m.durations && m.durations.length) ? m.durations : cfg().video.durations;
      let first = true;
      m.resolutions.forEach((r) => {
        ds.forEach((d) => {
          rows.push('<tr>' + (first ? '<td rowspan="' + (m.resolutions.length * ds.length) + '"><span class="pill info">视频</span></td>' +
            '<td rowspan="' + (m.resolutions.length * ds.length) + '"><span class="t-strong">' + UI.esc(m.name) + '</span></td>' : '') +
            '<td>' + UI.esc(String(r).toUpperCase()) + ' · ' + d + ' 秒</td>' +
            '<td class="text-r num">' + UI.num((m.cost[r] || {})[d] || 0) + ' 分</td></tr>');
          first = false;
        });
      });
    });
    $('#price-table').innerHTML = rows.join('') ||
      '<tr><td colspan="4" class="t-xs text-c">暂无启用的模型</td></tr>';

    // 自定义金额联动
    const inp = $('#custom-amount');
    const sync = () => {
      const v = Number(inp.value) || 0;
      $('#custom-pts').textContent = '= ' + UI.num(Math.round(v * 10)) + ' 积分';
    };
    inp.oninput = sync;
    sync();
    $('#btn-custom-pay').onclick = () => {
      const v = Number(inp.value);
      if (!v) { UI.warn('请输入金额'); return; }
      openPayPicker(null, v);
    };
  }

  /* ---------- 支付弹层（假二维码） ---------- */
  async function openPayPicker(planId, customAmount) {
    const c = cfg();
    if (!c.recharge.enabled) { UI.warn('充值通道已关闭'); return; }

    const modal = $('#pay-modal');
    const body = $('#pay-body');
    let method = (c.recharge.methods.find((m) => m.enabled) || {}).id || 'wechat';
    let selectedPlan = planId || (c.recharge.plans[0] && c.recharge.plans[0].id);
    let amount = customAmount || 0;

    function unitPrice() {
      if (amount) return { price: amount, credits: Math.round(amount * 10), label: '自定义金额' };
      const p = c.recharge.plans.find((x) => x.id === selectedPlan) || c.recharge.plans[0];
      return { price: p.price, credits: p.credits + (p.bonus || 0), label: p.label, plan: p };
    }

    function draw() {
      const u = unitPrice();
      const isCustom = !!amount;

      body.innerHTML =
        '<div class="field mb-2">' +
          '<label class="field-label">选择套餐</label>' +
          '<div class="plan-grid" style="grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' +
            c.recharge.plans.map((p) => {
              const total = p.credits + (p.bonus || 0);
              const on = !isCustom && p.id === selectedPlan;
              return '<button class="plan ' + (on ? 'is-active' : '') + '" data-p="' + p.id + '" style="padding:11px;text-align:center">' +
                (p.bonus ? '<span class="bonus" style="font-size:9.5px">+' + p.bonus + '</span>' : '') +
                '<div class="amt" style="font-size:19px;margin:2px 0"><span class="cur" style="font-size:12px">¥</span>' + p.price + '</div>' +
                '<div class="pts" style="font-size:11px">' + UI.num(total) + ' 分</div>' +
                '</button>';
            }).join('') +
          '</div>' +
        '</div>' +

        '<div class="field mb-2">' +
          '<label class="field-label">自定义金额（元）</label>' +
          '<div class="input-wrap"><span class="pre" style="font-size:14px">¥</span>' +
          '<input class="input" id="pay-custom" type="number" min="' + c.recharge.customMin + '" max="' + c.recharge.customMax +
          '" placeholder="不填则用上方套餐" value="' + (isCustom ? amount : '') + '" style="padding-left:30px"></div>' +
        '</div>' +

        '<div class="field mb-2">' +
          '<label class="field-label">支付方式</label>' +
          '<div class="pay-tabs">' +
            c.recharge.methods.filter((m) => m.enabled).map((m) =>
              '<button class="pay-tab ' + (m.id === method ? 'is-active' : '') + '" data-m="' + m.id + '">' +
              '<span class="mark ' + (m.id === 'wechat' ? 'wx' : 'zfb') + '">' + (m.id === 'wechat' ? '微' : '支') + '</span>' +
              UI.esc(m.name) + '</button>').join('') +
          '</div>' +
        '</div>' +

        '<div class="qr-stage">' +
          '<div class="qr-frame" id="qr-frame">' +
            '<canvas id="qr-canvas"></canvas>' +
            '<span class="qr-logo">G</span>' +
            '<span class="qr-scan-line"></span>' +
          '</div>' +
          '<div class="pay-amount"><span class="cur">¥</span><span class="num">' + u.price + '</span></div>' +
          '<div class="t-sm text-c">到账 <b style="color:#C3B4FF">' + UI.num(u.credits) + '</b> 积分 · ' +
            UI.esc(u.label) + '</div>' +
          '<div class="pill warn"><span class="dot"></span>演示二维码 · 不可真实扫码</div>' +
          '<div class="t-xs text-c">订单号将生成后显示 · ' + UI.esc((c.recharge.methods.find((m) => m.id === method) || {}).name || '') + '</div>' +
        '</div>';

      // 渲染假二维码
      const canvas = $('#qr-canvas');
      const draw2 = UI.fakeQR('glad://pay?m=' + method + '&a=' + u.price + '&t=' + Date.now());
      canvas.replaceWith(draw2);
      draw2.id = 'qr-canvas';

      // 事件
      $$('#pay-body [data-p]').forEach((b) => b.addEventListener('click', () => {
        selectedPlan = b.dataset.p; amount = 0; draw();
      }));
      $$('#pay-body [data-m]').forEach((b) => b.addEventListener('click', () => {
        method = b.dataset.m; draw();
      }));
      const ci = $('#pay-custom');
      ci.addEventListener('input', () => {
        amount = Number(ci.value) || 0;
        draw();
      });
      $('#pay-title').textContent = (method === 'wechat' ? '微信' : '支付宝') + '支付 ¥' + u.price;
    }

    draw();
    modal.classList.add('is-open');

    $('#pay-sim').onclick = async () => {
      const u = unitPrice();
      const r = await GLAD.createOrder(amount ? { amount, method } : { planId: selectedPlan, method });
      if (!r.ok) { UI.err(r.msg); return; }
      const p = await GLAD.payOrderDemo(r.order.id);
      if (!p.ok) { UI.err(p.msg); return; }
      modal.classList.remove('is-open');
      UI.ok('支付成功，到账 ' + UI.num(u.credits) + ' 积分');
      refreshUser();
      if (S.view === 'credits') renderCredits();
      if (S.view === 'orders') renderOrders();
    };
  }

  /* ============================================================
     订单
     ============================================================ */
  function renderOrders() {
    let os = GLAD.myOrders();
    if (S.orderFilter !== 'all') os = os.filter((o) => o.status === S.orderFilter);
    $('#order-count').textContent = '共 ' + os.length + ' 笔';
    const host = $('#order-list');
    if (!os.length) {
      host.innerHTML = '<div class="empty">' +
        '<span class="ico-lg"><svg viewBox="0 0 24 24"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L21 7H6"/></svg></span>' +
        '<div class="t-h3">还没有充值记录</div><div class="t-sm">去「积分与充值」购买积分包</div>' +
        '<button class="btn btn-primary mt-1" id="btn-order-go">去充值</button></div>';
      const g = $('#btn-order-go');
      if (g) g.addEventListener('click', () => setView('credits'));
      return;
    }
    const label = { pending: ['warn', '待支付'], paid: ['ok', '已支付'], closed: ['', '已关闭'] };
    host.innerHTML = os.map((o) => {
      const [kind, text] = label[o.status] || ['', o.status];
      const m = (cfg().recharge.methods.find((x) => x.id === o.method) || {}).name || o.method;
      return '<div class="order-row">' +
        '<span class="order-ico ' + (o.method === 'wechat' ? 'wx' : 'zfb') + '">' + (o.method === 'wechat' ? '微' : '支') + '</span>' +
        '<div style="min-width:0;flex:1">' +
          '<div class="t-h3">' + UI.esc(m) + ' · ¥' + o.price + ' <span class="t-xs" style="font-weight:400">→ ' + UI.num(o.credits) + ' 积分</span></div>' +
          '<div class="t-xs t-mono truncate">' + UI.esc(o.id) + ' · ' + GLAD.fmtDate(o.createdAt) + '</div>' +
        '</div>' +
        '<span class="pill ' + kind + '">' + text + '</span>' +
        (o.status === 'pending'
          ? '<button class="btn btn-sm btn-primary" data-pay="' + o.id + '">继续支付</button>'
          : '') +
      '</div>';
    }).join('');
    $$('#order-list [data-pay]').forEach((b) => b.addEventListener('click', async () => {
      const o = GLAD.orderById(b.dataset.pay);
      if (!o) return;
      const r = await GLAD.payOrderDemo(o.id);
      if (r.ok) { UI.ok('支付成功，到账 ' + UI.num(o.credits) + ' 积分'); refreshUser(); renderOrders(); }
      else UI.err(r.msg);
    }));
  }

  /* ============================================================
     个人中心
     ============================================================ */
  function renderProfile() {
    const u = me();
    if (!u) return;
    const js = GLAD.myJobs();
    $('#md-jobs').textContent = UI.num(js.length);
    $('#md-credits').textContent = UI.num(js.filter((j) => j.status === 'done').reduce((a, b) => a + (b.cost || 0), 0));
    $('#md-orders').textContent = UI.num(GLAD.myOrders().length);
  }

  /* ============================================================
     绑定
     ============================================================ */
  function bindAll() {
    // 导航
    $$('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $('#nav-toggle').addEventListener('click', () => $('#sidebar').classList.toggle('is-open'));
    $('#credit-chip').addEventListener('click', () => openPayPicker());
    $('#btn-recharge').addEventListener('click', () => openPayPicker());
    $('#btn-goto-studio').addEventListener('click', () => setView('studio'));

    // 用户菜单
    $('#side-user').addEventListener('click', () => {
      const u = me();
      $('#user-menu-body').innerHTML =
        '<div class="row" style="padding:10px 12px;gap:11px">' +
          '<span class="avatar">' + UI.esc((u.username || 'U').slice(0, 1).toUpperCase()) + '</span>' +
          '<div style="min-width:0"><div class="t-h3 truncate">' + UI.esc(u.username) + '</div>' +
          '<div class="t-xs truncate">' + UI.esc(u.email || '') + '</div></div></div>' +
        '<div class="divider" style="margin:6px 0"></div>' +
        '<button class="nav-item" data-m="profile">' + UI.icon('user') + '个人中心</button>' +
        '<button class="nav-item" data-m="credits">' + UI.icon('wallet') + '积分与充值</button>' +
        '<button class="nav-item" data-m="orders">' + UI.icon('cart') + '充值记录</button>' +
        (u.role === 'admin' ? '<a class="nav-item" href="admin.html">' + UI.icon('shield') + '管理后台</a>' : '') +
        '<div class="divider" style="margin:6px 0"></div>' +
        '<button class="nav-item" data-m="logout" style="color:#FFAAAA">' + UI.icon('logout') + '退出登录</button>';
      const m = UI.modal({
        size: 'narrow',
        head: false, foot: false,
        body: '<div id="um-inner"></div>',
      });
      // 直接把内容塞进这个弹层
      m.body.innerHTML = $('#user-menu-body').innerHTML;
      $$('[data-m]', m.body).forEach((b) => b.addEventListener('click', async () => {
        const act = b.dataset.m;
        m.close();
        if (act === 'logout') {
          const yes = await UI.confirm({ title: '退出登录？', text: '退出后需要重新登录。', okText: '退出', danger: true });
          if (yes) { GLAD.logout(); location.reload(); }
        } else setView(act);
      }));
    });

    // 模式切换
    $$('#type-switch button').forEach((b) => b.addEventListener('click', () => {
      S.type = b.dataset.type;
      $$('#type-switch button').forEach((x) => x.classList.toggle('is-active', x === b));
      renderModelSelect();
      $('#placeholder-sync');
      $('#prompt').placeholder = S.type === 'video'
        ? '描述你想要的镜头…\n例如：镜头缓慢推进，穿过雾气弥漫的松林，晨光从树缝洒下'
        : '描述你想要的画面…\n例如：夜晚的东京街头，霓虹灯在雨后的路面上晕开，电影感，浅景深';
      renderIdeas();
      $('#ref-zone').classList.remove('hidden');
      renderRefs();
    }));

    // 提示词
    $('#prompt').addEventListener('input', onPromptInput);
    $('#btn-clear-prompt').addEventListener('click', () => {
      $('#prompt').value = ''; onPromptInput(); $('#prompt').focus();
    });
    $('#btn-idea').addEventListener('click', () => {
      const pool = IDEAS[S.type];
      $('#prompt').value = pool[Math.floor(Math.random() * pool.length)];
      onPromptInput();
      UI.info('已填入一条灵感');
    });

    // 模型
    $('#model').addEventListener('change', (e) => {
      S.model = e.target.value;
      applyModelDefaults();
    });

    // 参考图
    $('#btn-ref').addEventListener('click', () => {
      $('#ref-zone').classList.remove('hidden');
      if (!$('#ref-zone').offsetParent) return;
      $('#dropzone').scrollIntoView({ block: 'center' });
      $('#file-input').click();
    });
    $('#dropzone').addEventListener('click', () => $('#file-input').click());
    $('#file-input').addEventListener('change', (e) => { onRefFiles(e.target.files); e.target.value = ''; });
    ['dragover', 'dragenter'].forEach((ev) => $('#dropzone').addEventListener(ev, (e) => {
      e.preventDefault(); $('#dropzone').classList.add('is-over');
    }));
    ['dragleave', 'drop'].forEach((ev) => $('#dropzone').addEventListener(ev, (e) => {
      e.preventDefault(); $('#dropzone').classList.remove('is-over');
      if (ev === 'drop' && e.dataTransfer) onRefFiles(e.dataTransfer.files);
    }));

    // 精细度
    $('#strength').addEventListener('input', (e) => {
      $('#strength-val').textContent = Number(e.target.value).toFixed(2);
    });

    // 生成
    $('#btn-generate').addEventListener('click', doGenerate);
    $('#btn-clear-results').addEventListener('click', () => {
      S.results = [];
      renderResults();
      UI.info('已清空本次生成记录');
    });

    // 作品页
    $$('#asset-filter button').forEach((b) => b.addEventListener('click', () => {
      S.assetFilter = b.dataset.f;
      $$('#asset-filter button').forEach((x) => x.classList.toggle('is-active', x === b));
      renderAssets();
    }));
    $('#asset-search').addEventListener('input', (e) => {
      S.assetSearch = e.target.value.trim();
      renderAssets();
    });
    $('#btn-refresh-assets').addEventListener('click', () => { renderAssets(); UI.info('已刷新'); });
    $('#btn-clear-assets').addEventListener('click', async () => {
      const yes = await UI.confirm({
        title: '清空全部作品？', danger: true, okText: '全部清空',
        text: '这会删除你账号下的所有生成记录（积分不退还），操作不可恢复。',
      });
      if (!yes) return;
      GLAD.clearMyJobs();
      S.results = [];
      renderAssets();
      refreshUser();
      UI.ok('已清空');
    });

    // 订单筛选
    $$('#order-filter button').forEach((b) => b.addEventListener('click', () => {
      S.orderFilter = b.dataset.f;
      $$('#order-filter button').forEach((x) => x.classList.toggle('is-active', x === b));
      renderOrders();
    }));

    // 个人中心 tabs
    $$('#profile-tabs .tab').forEach((b) => b.addEventListener('click', () => {
      $$('#profile-tabs .tab').forEach((x) => x.classList.toggle('is-active', x === b));
      $$('[data-tp]').forEach((p) => p.classList.toggle('is-active', p.dataset.tp === b.dataset.t));
    }));
    $('#btn-save-profile').addEventListener('click', async () => {
      const r = await GLAD.updateProfile({
        username: $('#pf-in-name').value,
        email: $('#pf-in-mail').value,
        phone: $('#pf-in-phone').value,
      });
      if (r.ok) { refreshUser(); UI.ok('资料已保存'); } else UI.err(r.msg);
    });
    $('#btn-logout-1').addEventListener('click', async () => {
      const yes = await UI.confirm({ title: '退出登录？', okText: '退出', danger: true });
      if (yes) { GLAD.logout(); location.reload(); }
    });
    $('#pw-new').addEventListener('input', (e) => {
      const v = e.target.value;
      const score = (v.length >= 6 ? 1 : 0) + (/[a-zA-Z]/.test(v) && /[0-9]/.test(v) ? 1 : 0) + (v.length >= 10 ? 1 : 0);
      $$('#pw-meter i').forEach((i, idx) => {
        i.className = idx < score ? ('on-' + Math.max(1, score)) : '';
      });
    });
    $('#btn-save-pw').addEventListener('click', async () => {
      const r = await GLAD.changePassword({
        oldPassword: $('#pw-old').value,
        password: $('#pw-new').value,
        password2: $('#pw-new2').value,
      });
      if (r.ok) {
        UI.ok('密码已修改');
        $('#pw-old').value = $('#pw-new').value = $('#pw-new2').value = '';
        $$('#pw-meter i').forEach((i) => { i.className = ''; });
      } else UI.err(r.msg);
    });
    $('#btn-export-me').addEventListener('click', () => {
      const u = me();
      const data = {
        exportedAt: new Date().toISOString(),
        user: { username: u.username, email: u.email, credits: u.credits },
        jobs: GLAD.myJobs(),
        orders: GLAD.myOrders(),
      };
      downloadJSON(data, 'glad-my-data-' + GLAD.fmtDay(Date.now()) + '.json');
    });

    // 支付弹层关闭
    $('#pay-modal').addEventListener('click', (e) => {
      if (e.target === $('#pay-modal') || e.target.closest('[data-close]')) {
        $('#pay-modal').classList.remove('is-open');
      }
    });

    // 快捷键
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); doGenerate(); }
    });

    subscribeJobs();
    // ⭐ 首次进入必须完整渲染一遍参数面板，
    //    否则模型下拉、画面比例、分辨率都是空的（要切一次模式才出来）
    renderModelSelect();
    renderIdeas();
    renderRefs();
    refreshPoolPill();
    onPromptInput();
    renderResults();
  }

  function renderIdeas() {
    const pool = IDEAS[S.type].slice(0, 5);
    $('#idea-list').innerHTML = pool.map((p, i) =>
      '<button class="opt" data-idea="' + i + '" style="text-align:left;max-width:100%;white-space:normal;line-height:1.5">' +
      UI.esc(p.length > 18 ? p.slice(0, 18) + '…' : p) + '</button>').join('');
    $$('#idea-list .opt').forEach((b) => b.addEventListener('click', () => {
      $('#prompt').value = pool[Number(b.dataset.idea)];
      onPromptInput();
    }));
  }

  function onPromptInput() {
    const v = $('#prompt').value;
    const max = cfg().audit.maxPromptLen;
    const el = $('#prompt-len');
    el.textContent = v.length + ' / ' + max;
    el.style.color = v.length > max ? '#FFAAAA' : '';
    const box = $('#prompt');
    box.style.height = 'auto';
    box.style.height = Math.min(260, Math.max(104, box.scrollHeight)) + 'px';
    updateCost();
  }

  function downloadJSON(obj, name) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    UI.ok('已导出');
  }

  /* ---------- 起 ---------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();

  // 跨窗口同步（管理端改了配置，客户端刷新可见）
  window.addEventListener('storage', (e) => {
    if (e.key === 'glad.config' || e.key === 'glad.users') {
      refreshUser();
      renderModelSelect();
    }
  });
})();
