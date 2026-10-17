/* ============================================================
   GLAD AI · 管理端逻辑
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const VIEWS = {
    dash:    { title: '数据看板',   sub: '生成量、收入、账号池健康度一览' },
    pool:    { title: '额度账号池', sub: '把多个即梦账号的额度聚合到本站统一调度' },
    models:  { title: '模型管理',   sub: '启用/停用模型，设置分辨率与每个档位的积分价格' },
    presets: { title: '比例与时长', sub: '画面比例、视频时长、分辨率与上传限制' },
    api:     { title: 'API 接入',   sub: '配置上游聚合服务地址、调度策略与接口路径' },
    users:   { title: '用户管理',   sub: '用户资料、积分、状态与权限' },
    orders:  { title: '订单管理',   sub: '充值订单、支付渠道与补单' },
    pricing: { title: '积分与计费', sub: '积分发放规则、充值通道与套餐' },
    assets:  { title: '作品库',     sub: '全站用户的生成记录' },
    audit:   { title: '内容审核',   sub: '关键词拦截与提示词长度限制' },
    site:    { title: '站点设置',   sub: '品牌信息与全站公告' },
    system:  { title: '系统与日志', sub: '数据备份、危险操作与运行日志' },
  };

  const S = {
    view: 'dash',
    range: 14,
    modelTab: 'image',
    userFilter: 'all',
    userSearch: '',
    orderStatus: 'all',
    orderSearch: '',
    assetFilter: 'all',
    assetSearch: '',
    logLevel: 'ALL',
  };

  const cfg = () => GLAD.config();
  const me  = () => GLAD.currentUser();

  /* ---------- 小工具 ---------- */
  function swSet(el, on) { if (el) el.classList.toggle('is-on', !!on); }
  function swGet(el) { return el && el.classList.contains('is-on'); }
  function csv(rows, name) {
    const txt = '\ufeff' + rows.map((r) => r.map((c) => {
      const s = String(c == null ? '' : c);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\r\n');
    const blob = new Blob([txt], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    UI.ok('已导出 ' + name);
  }
  function download(obj, name, type) {
    const blob = new Blob([typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)],
      { type: type || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ============================================================
     启动
     ============================================================ */
  function boot() {
    GLAD.seed();
    const u = me();
    if (!u || u.role !== 'admin') {
      const deny = $('#deny');
      deny.classList.add('is-open');
      if (!u) {
        $('#deny-title').textContent = '请先登录管理员账号';
        $('#deny-text').innerHTML = '用 <b>admin / admin888</b> 登录后即可进入后台。';
      } else {
        $('#deny-title').textContent = '当前账号不是管理员';
        $('#deny-text').innerHTML = '账号「' + UI.esc(u.username) + '」是普通用户，无法访问后台。' +
          '点下面的按钮切换到管理员账号即可。';
      }
      // 一键切到管理员（演示环境专用）
      const quick = $('#deny-quick');
      if (quick) quick.addEventListener('click', async () => {
        quick.classList.add('is-disabled');
        quick.textContent = '正在登录…';
        GLAD.logout();
        const r = await GLAD.login({ account: 'admin', password: 'admin888' });
        if (!r.ok) {
          quick.classList.remove('is-disabled');
          quick.textContent = '用管理员账号登录（admin / admin888）';
          UI.err(r.msg);
          return;
        }
        location.replace('admin.html');
      });
      return;
    }
    $('#app').hidden = false;
    $('#brand-sub').textContent = cfg().site.tagline;
    $('#side-avatar').textContent = (u.username || 'A').slice(0, 1).toUpperCase();
    $('#side-name').textContent = u.username;
    $('#side-mail').textContent = u.email || '—';

    bindAll();
    setView('dash');
    chrome();
  }

  function chrome() {
    const c = cfg();
    const p = GLAD.poolCredits();
    $('#pool-text').textContent = '额度池 ' + UI.num(p.total);
    $('#pool-pill').className = 'pill ' + (p.total > 500 ? 'ok' : p.total > 0 ? 'warn' : 'danger');
    $('#nav-pool').textContent = p.accounts;
    $('#nav-users').textContent = GLAD.listUsers().length;
    $('#nav-orders').textContent = GLAD.listOrders({ status: 'pending' }).length;
    const mode = c.api.mode;
    $('#nav-api-mode').textContent = mode === 'real' ? '真实' : 'Mock';
    $('#api-pill').className = 'pill ' + (mode === 'real' ? 'ok' : 'info');
    $('#api-pill-text').textContent = mode === 'real' ? '真实接口 ' + c.api.baseUrl : '演示模式 · 本地模拟';
  }

  function setView(v) {
    if (!VIEWS[v]) v = 'dash';
    S.view = v;
    $$('[data-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== v));
    $$('[data-view]').forEach((b) => b.classList.toggle('is-active', b.dataset.view === v));
    $('#page-title').textContent = VIEWS[v].title;
    $('#page-sub').textContent = VIEWS[v].sub;
    $('#sidebar').classList.remove('is-open');
    window.scrollTo({ top: 0 });
    render();
  }

  function render() {
    chrome();
    switch (S.view) {
      case 'dash':    return renderDash();
      case 'pool':    return renderPool();
      case 'models':  return renderModels();
      case 'presets': return renderPresets();
      case 'api':     return renderApi();
      case 'users':   return renderUsers();
      case 'orders':  return renderOrders();
      case 'pricing': return renderPricing();
      case 'assets':  return renderAdAssets();
      case 'audit':   return renderAudit();
      case 'site':    return renderSite();
      case 'system':  return renderSystem();
    }
  }

  /* ============================================================
     1. 数据看板
     ============================================================ */
  function renderDash() {
    const st = GLAD.adminStats(S.range);
    $('#dash-updated').textContent = '更新于 ' + new Date().toLocaleTimeString('zh-CN');

    const kpis = [
      { k: '累计生成', v: UI.num(st.jobs), d: '图片 ' + st.images + ' · 视频 ' + st.videos },
      { k: '成功 / 失败', v: st.doneJobs + ' / ' + st.failedJobs, d: '进行中 ' + st.runningJobs + ' 个' },
      { k: '消耗积分', v: UI.num(st.consumed), d: '用户余额合计 ' + UI.num(st.userCredits) },
      { k: '累计收入', v: '¥' + UI.num(st.revenue), d: '已支付 ' + st.paidOrders + ' 单 · 待支付 ' + st.pendingOrders },
      { k: '用户总数', v: UI.num(st.users), d: '正常 ' + st.activeUsers + ' · 近 ' + S.range + ' 天新增 ' + st.newUsers },
      { k: '账号池额度', v: UI.num(st.pool.total), d: st.pool.accounts + ' 个账号 · 可用 ' + st.pool.usable },
    ];
    $('#kpi-grid').innerHTML = kpis.map((x) =>
      '<div class="stat"><div class="k">' + UI.esc(x.k) + '</div>' +
      '<div class="v">' + UI.esc(String(x.v)) + '</div>' +
      '<div class="d">' + UI.esc(x.d) + '</div></div>').join('');

    // 趋势：图片/视频堆叠
    const max = Math.max(1, ...st.trend.map((t) => t.calls));
    $('#chart-calls').innerHTML = st.trend.map((t) => {
      const hi = Math.round((t.image / max) * 150);
      const hv = Math.round((t.video / max) * 150);
      return '<div class="chart-col" title="' + t.day + '：图片 ' + t.image + ' · 视频 ' + t.video + '">' +
        '<span class="seg vid" style="height:' + hv + 'px"></span>' +
        '<span class="seg img" style="height:' + hi + 'px"></span>' +
        '<span class="t-xs" style="text-align:center;font-size:9px;margin-top:2px">' + (t.calls || '') + '</span>' +
      '</div>';
    }).join('');
    $('#chart-axis').innerHTML = st.trend.map((t) => '<span>' + t.day + '</span>').join('');

    // 收入趋势
    const maxR = Math.max(1, ...st.trend.map((t) => t.revenue));
    $('#chart-money').innerHTML = st.trend.map((t) => {
      const h = Math.round((t.revenue / maxR) * 150);
      return '<div class="chart-col" title="' + t.day + '：¥' + t.revenue + ' · 新增用户 ' + t.signups + '">' +
        '<span class="seg" style="height:' + Math.max(2, h) + 'px;background:linear-gradient(180deg,#2ED573,#1B9C57)"></span>' +
        '<span class="t-xs" style="text-align:center;font-size:9px;margin-top:2px">' + (t.revenue || '') + '</span>' +
      '</div>';
    }).join('');
    $('#chart-axis2').innerHTML = st.trend.map((t) => '<span>' + t.day + '</span>').join('');

    // 模型排行
    $('#dash-model-rows').innerHTML = st.byModel.length
      ? st.byModel.slice(0, 10).map((m) =>
          '<tr><td class="t-strong">' + UI.esc(m.model) + '</td>' +
          '<td><span class="pill ' + (m.type === 'video' ? 'info' : 'brand') + '">' +
            (m.type === 'video' ? '视频' : '图片') + '</span></td>' +
          '<td class="text-r num">' + UI.num(m.calls) + '</td>' +
          '<td class="text-r num">' + UI.num(m.credits) + '</td></tr>').join('')
      : '<tr><td colspan="4" class="t-xs text-c" style="padding:22px">还没有生成记录</td></tr>';

    // 账号池健康
    const pool = GLAD.poolList();
    const p = st.pool;
    $('#dash-pool').innerHTML =
      '<div class="row" style="gap:12px"><div style="flex:1">' +
        '<div class="t-xs">聚合额度</div><div class="t-h1 mono-num">' + UI.num(p.total) + '</div>' +
      '</div><div style="flex:1">' +
        '<div class="t-xs">可用账号</div><div class="t-h1 mono-num">' + p.usable + ' / ' + p.accounts + '</div>' +
      '</div></div>' +
      '<div class="bar"><i style="width:' + (p.accounts ? Math.round((p.usable / p.accounts) * 100) : 0) + '%"></i></div>' +
      '<div class="col" style="gap:7px">' + pool.slice(0, 5).map((t) => {
        const state = !t.enabled ? ['', '已停用'] : (!t.live ? ['danger', '失效'] : (t.points > 0 ? ['ok', '正常'] : ['warn', '耗尽']));
        return '<div class="row" style="gap:9px">' +
          '<span class="pill ' + state[0] + '"><span class="dot"></span>' + state[1] + '</span>' +
          '<span class="t-sm truncate" style="flex:1">' + UI.esc(t.name) + '</span>' +
          '<span class="t-sm mono-num">' + UI.num(t.points) + '</span></div>';
      }).join('') + '</div>';

    // 最近日志
    $('#dash-logs').innerHTML = GLAD.listLogs('ALL').slice(0, 8).map(logRow).join('') ||
      '<div class="t-xs text-c" style="padding:22px">暂无日志</div>';
  }

  function logRow(l) {
    return '<div class="log-row">' +
      '<span class="lv ' + l.level + '">' + l.level + '</span>' +
      '<span class="t-xs t-mono">' + GLAD.fmtDate(l.at) + '</span>' +
      '<span class="t-sm" style="color:var(--text-2)">' + UI.esc(l.msg) + '</span>' +
    '</div>';
  }

  /* ============================================================
     2. 额度账号池
     ============================================================ */
  function renderPool() {
    const list = GLAD.poolList();
    const p = GLAD.poolCredits();
    $('#pool-total').textContent = UI.num(p.total);
    $('#pool-accounts').textContent = p.accounts;
    $('#pool-usable').textContent = p.usable;
    $('#pool-dead').textContent = p.dead;
    $('#pool-off').textContent = p.disabled;

    const maxPts = Math.max(1, ...list.map((t) => t.points || 0));
    $('#pool-list').innerHTML = list.length ? list.map((t) => {
      const dead = !t.live;
      const off = !t.enabled;
      const state = off ? ['', '已停用'] : (dead ? ['danger', 'Token 失效'] : ((t.points || 0) > 0 ? ['ok', '正常'] : ['warn', '额度耗尽']));
      return '<div class="token-row ' + (dead ? 'is-dead ' : '') + (off ? 'is-off' : '') + '" data-id="' + t.id + '">' +
        '<div style="min-width:0">' +
          '<div class="t-h3 truncate">' + UI.esc(t.name) + '</div>' +
          '<div class="t-xs truncate">' + UI.esc(t.note || '—') + (t.checkedAt ? ' · 探测于 ' + UI.ago(t.checkedAt) : '') + '</div>' +
        '</div>' +
        '<div style="min-width:0">' +
          '<div class="t-mono truncate" style="color:var(--text-3)">' + UI.esc(mask(t.session)) + '</div>' +
          '<div class="token-bar"><i style="width:' + Math.round(((t.points || 0) / maxPts) * 100) + '%"></i></div>' +
        '</div>' +
        '<div><span class="pill ' + state[0] + '"><span class="dot"></span>' + state[1] + '</span></div>' +
        '<div class="text-r"><div class="t-h3 mono-num">' + UI.num(t.points || 0) + '</div><div class="t-xs">积分</div></div>' +
        '<div class="row" style="gap:6px;justify-content:flex-end;flex-wrap:wrap">' +
          '<button class="btn btn-sm" data-act="probe">探测</button>' +
          '<button class="btn btn-sm" data-act="toggle">' + (t.enabled ? '停用' : '启用') + '</button>' +
          '<button class="btn btn-sm" data-act="edit">编辑</button>' +
          '<button class="btn btn-sm btn-danger" data-act="del">删</button>' +
        '</div>' +
      '</div>';
    }).join('') : '<div class="empty">' +
        '<span class="ico-lg"><svg viewBox="0 0 24 24"><rect x="3" y="3.5" width="18" height="7" rx="2"/><rect x="3" y="13.5" width="18" height="7" rx="2"/></svg></span>' +
        '<div class="t-h3">账号池是空的</div>' +
        '<div class="t-sm">添加至少一个即梦账号的 sessionid，客户端才能生成</div>' +
        '<button class="btn btn-primary mt-1" id="btn-pool-empty-add">添加第一个账号</button></div>';

    $$('#pool-list .token-row').forEach((row) => {
      const id = row.dataset.id;
      $$('[data-act]', row).forEach((b) => b.addEventListener('click', async () => {
        const act = b.dataset.act;
        if (act === 'probe') {
          b.classList.add('is-disabled');
          const r = await GLAD.poolCheck(id);
          b.classList.remove('is-disabled');
          if (!r.ok) return UI.err(r.msg);
          UI[r.dead ? 'err' : 'ok'](r.dead ? '该 token 已失效' : '额度 ' + UI.num(r.item.points) + ' 积分');
          renderPool(); chrome();
        }
        if (act === 'toggle') {
          const t = GLAD.poolList().find((x) => x.id === id);
          GLAD.poolUpdate(id, { enabled: !t.enabled });
          UI.info(t.enabled ? '已停用' : '已启用');
          renderPool(); chrome();
        }
        if (act === 'edit') {
          const t = GLAD.poolList().find((x) => x.id === id);
          const m = UI.modal({
            title: '编辑账号',
            body:
              '<div class="col" style="gap:14px">' +
                '<div class="field"><label class="field-label">备注名称</label><input class="input" id="tk-name" value="' + UI.esc(t.name) + '"></div>' +
                '<div class="field"><label class="field-label">备注</label><input class="input" id="tk-note" value="' + UI.esc(t.note || '') + '"></div>' +
                '<div class="field"><label class="field-label">sessionid</label><input class="input t-mono" id="tk-sid" value="' + UI.esc(t.session) + '"></div>' +
                '<div class="field"><label class="field-label">当前剩余积分（可手动修正）</label><input class="input" id="tk-pts" type="number" value="' + (t.points || 0) + '"></div>' +
              '</div>',
            foot: '<button class="btn" data-close>取消</button><span class="spacer"></span>' +
              '<button class="btn btn-primary" data-save>保存</button>',
            onMount(e) {
              e.root.querySelector('[data-save]').addEventListener('click', () => {
                GLAD.poolUpdate(id, {
                  name: e.root.querySelector('#tk-name').value.trim(),
                  note: e.root.querySelector('#tk-note').value.trim(),
                  session: e.root.querySelector('#tk-sid').value.trim(),
                  points: Number(e.root.querySelector('#tk-pts').value) || 0,
                });
                e.close(); renderPool(); chrome(); UI.ok('已保存');
              });
            },
          });
          void m;
        }
        if (act === 'del') {
          const yes = await UI.confirm({ title: '从池中移除该账号？', text: '移除后不再参与调度。', okText: '移除', danger: true });
          if (!yes) return;
          GLAD.poolRemove(id);
          renderPool(); chrome(); UI.ok('已移除');
        }
      }));
    });
    const ea = $('#btn-pool-empty-add');
    if (ea) ea.addEventListener('click', openAddToken);
  }

  function mask(sid) {
    if (!sid) return '—';
    if (sid.length <= 14) return sid.slice(0, 4) + '••••';
    return sid.slice(0, 8) + '••••••' + sid.slice(-6);
  }

  function openAddToken() {
    const m = UI.modal({
      title: '添加即梦账号',
      eyebrow: '额度账号池',
      body:
        '<div class="col" style="gap:14px">' +
          '<div class="field"><label class="field-label">备注名称</label>' +
            '<input class="input" id="nt-name" placeholder="例如：主账号 A"></div>' +
          '<div class="field"><label class="field-label">sessionid <span class="req">*</span></label>' +
            '<input class="input t-mono" id="nt-sid" placeholder="从即梦网页 Cookie 里复制的 sessionid"></div>' +
          '<div class="field"><label class="field-label">备注（可选）</label>' +
            '<input class="input" id="nt-note" placeholder="例如：日常主力"></div>' +
          '<div class="card" style="background:rgba(124,92,255,.06);border-color:rgba(124,92,255,.24)">' +
            '<div class="card-body t-xs" style="padding:11px 13px;line-height:1.75">' +
              '<b style="color:#C3B4FF">演示模式</b>下不会真的校验，随便填一段 8 位以上的字符即可。' +
              '接入真实服务后，这里会调用 <span class="t-mono">POST /token/check</span> 校验并拉取真实额度。' +
            '</div></div>' +
        '</div>',
      foot: '<button class="btn" data-close>取消</button><span class="spacer"></span>' +
        '<button class="btn btn-primary" data-add>添加并探测</button>',
      onMount(e) {
        e.root.querySelector('[data-add]').addEventListener('click', async () => {
          const r = GLAD.poolAdd({
            name: e.root.querySelector('#nt-name').value.trim(),
            session: e.root.querySelector('#nt-sid').value.trim(),
            note: e.root.querySelector('#nt-note').value.trim(),
          });
          if (!r.ok) return UI.err(r.msg);
          e.close();
          await GLAD.poolCheck(r.item.id);
          renderPool(); chrome();
          UI.ok('已添加：' + r.item.name);
        });
      },
    });
    void m;
  }

  function openBulkToken() {
    const m = UI.modal({
      size: 'wide',
      title: '批量导入账号',
      eyebrow: '一行一个账号',
      body:
        '<div class="field">' +
          '<label class="field-label">账号列表</label>' +
          '<textarea class="textarea t-mono" id="bulk-txt" rows="9" style="font-size:12px" ' +
            'placeholder="主账号A a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4&#10;主账号B f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3&#10;9a8b7c6d5e4f9a8b7c6d5e4f9a8b7c6d"></textarea>' +
          '<div class="field-hint">每行一个。格式：<span class="t-mono">名称 sessionid</span>，也可以只写 sessionid。</div>' +
        '</div>',
      foot: '<button class="btn" data-close>取消</button><span class="spacer"></span>' +
        '<button class="btn btn-primary" data-ok>导入</button>',
      onMount(e) {
        e.root.querySelector('[data-ok]').addEventListener('click', () => {
          const r = GLAD.poolAddBulk(e.root.querySelector('#bulk-txt').value);
          e.close(); renderPool(); chrome();
          UI.ok('成功 ' + r.added + ' 个，重复 ' + r.dup + ' 个，无效 ' + r.bad + ' 个');
        });
      },
    });
    void m;
  }

  /* ============================================================
     3. 模型管理
     ============================================================ */
  function renderModels() {
    const c = cfg();
    const isVideo = S.modelTab === 'video';
    const list = isVideo ? c.videoModels : c.imageModels;
    const RES = isVideo ? ['480p', '720p', '1080p', '4k'] : ['1k', '2k', '4k'];
    $('#model-tip').textContent = list.length + ' 个模型 · ' +
      list.filter((m) => m.enabled !== false).length + ' 个已启用';
    $$('#model-tab button').forEach((b) => b.classList.toggle('is-active', b.dataset.t === S.modelTab));

    $('#model-list').innerHTML = list.map((m, idx) => {
      const on = m.enabled !== false;
      return '<div class="card model-card" data-idx="' + idx + '">' +
        '<div class="card-head">' +
          '<div class="switch ' + (on ? 'is-on' : '') + '" data-sw="enabled"></div>' +
          '<div style="min-width:0;flex:1">' +
            '<div class="t-h3 truncate">' + UI.esc(m.name) + ' ' +
              (on ? '' : '<span class="pill danger" style="margin-left:6px">已停用</span>') + '</div>' +
            '<div class="t-xs t-mono truncate">' + UI.esc(m.id) + '</div>' +
          '</div>' +
          '<button class="btn btn-sm" data-act="expand">展开设置</button>' +
        '</div>' +
        '<div class="card-body col" style="gap:14px">' +
          '<div class="grid g-2">' +
            '<div class="field"><label class="field-label">显示名称</label>' +
              '<input class="input" data-f="name" value="' + UI.esc(m.name) + '"></div>' +
            '<div class="field"><label class="field-label">角标（可留空）</label>' +
              '<input class="input" data-f="badge" value="' + UI.esc(m.badge || '') + '" placeholder="如：最新 / 推荐 / VIP"></div>' +
          '</div>' +
          '<div class="field"><label class="field-label">一句话描述</label>' +
            '<input class="input" data-f="desc" value="' + UI.esc(m.desc || '') + '"></div>' +

          '<div class="field"><label class="field-label">支持的分辨率</label>' +
            '<div class="opt-row">' + RES.map((r) =>
              '<button class="opt ' + (m.resolutions.includes(r) ? 'is-active' : '') + '" data-res="' + r + '">' +
              r.toUpperCase() + '</button>').join('') + '</div>' +
            '<div class="field-hint">取消勾选即表示该模型不支持这个档位，客户端会自动隐藏。</div>' +
          '</div>' +

          '<div class="field"><label class="field-label">默认分辨率</label>' +
            '<select class="select" data-f="defaultResolution" style="max-width:220px">' +
            RES.filter((r) => m.resolutions.includes(r)).map((r) =>
              '<option value="' + r + '"' + (r === m.defaultResolution ? ' selected' : '') + '>' + r.toUpperCase() + '</option>').join('') +
            '</select></div>' +

          '<div class="field"><label class="field-label">积分价格（用户每次生成扣多少）</label>' +
            '<div class="cost-grid">' +
              m.resolutions.map((r) => {
                if (isVideo) {
                  const ds = (m.durations && m.durations.length) ? m.durations : c.video.durations;
                  return '<div class="cost-row" style="grid-template-columns:74px ' +
                    ds.map(() => '1fr').join(' ') + '">' +
                    '<span class="lbl">' + r.toUpperCase() + '</span>' +
                    ds.map((d) => '<input class="input" data-cost-res="' + r + '" data-cost-dur="' + d + '" ' +
                      'type="number" min="0" value="' + (((m.cost[r] || {})[d]) || 0) + '" title="' + d + ' 秒">').join('') +
                    '</div>';
                }
                return '<div class="cost-row"><span class="lbl">' + r.toUpperCase() + '</span>' +
                  '<input class="input" data-cost-res="' + r + '" type="number" min="0" value="' + (m.cost[r] || 0) + '">' +
                  '<span class="t-xs" style="color:var(--text-4)">上游 benefit ' +
                    (((m.upstream || {})[r]) != null ? m.upstream[r] : '—') + '</span></div>';
              }).join('') +
            '</div>' +
            (isVideo ? '<div class="field-hint">每列对应一个时长档位（' +
              ((m.durations && m.durations.length) ? m.durations : c.video.durations).join(' / ') + ' 秒）。</div>' : '') +
          '</div>' +

          (isVideo ? '<div class="field"><label class="field-label">支持的时长</label>' +
            '<div class="opt-row">' + [5, 10].map((d) =>
              '<button class="opt ' + (((m.durations || []).includes(d)) ? 'is-active' : '') + '" data-dur="' + d + '">' +
              d + ' 秒</button>').join('') + '</div>' +
            '<div class="field-hint">上游只有 s2.0 与 2.0 Pro 两个模型固定 5 秒，其它都支持 5 / 10 秒。</div></div>' : '') +

          '<div class="row"><button class="btn btn-primary btn-sm" data-act="save">保存该模型</button>' +
            '<button class="btn btn-sm" data-act="copy">复制模型 ID</button>' +
            '<span class="spacer"></span>' +
            '<button class="btn btn-sm btn-danger" data-act="reset">恢复默认</button></div>' +
        '</div>' +
      '</div>';
    }).join('');

    $$('#model-list .model-card').forEach((card) => {
      const idx = Number(card.dataset.idx);
      const get = () => (S.modelTab === 'video' ? cfg().videoModels : cfg().imageModels)[idx];
      const src = () => get();

      // 展开/收起
      const body = card.querySelector('.card-body');
      body.style.display = 'none';
      card.querySelector('[data-act="expand"]').addEventListener('click', (e) => {
        const open = body.style.display !== 'none';
        body.style.display = open ? 'none' : '';
        e.target.textContent = open ? '展开设置' : '收起';
      });

      // 启用开关
      card.querySelector('[data-sw="enabled"]').addEventListener('click', (e) => {
        const c2 = cfg();
        const arr = S.modelTab === 'video' ? c2.videoModels : c2.imageModels;
        arr[idx].enabled = !(arr[idx].enabled !== false);
        GLAD.saveConfig(c2);
        e.currentTarget.classList.toggle('is-on', arr[idx].enabled);
        UI.info(arr[idx].name + (arr[idx].enabled ? ' 已启用' : ' 已停用'));
        renderModels(); chrome();
      });

      // 分辨率多选
      $$('[data-res]', card).forEach((b) => b.addEventListener('click', () => {
        const c2 = cfg();
        const arr = S.modelTab === 'video' ? c2.videoModels : c2.imageModels;
        const r = b.dataset.res;
        const m = arr[idx];
        if (m.resolutions.includes(r)) {
          if (m.resolutions.length === 1) { UI.warn('至少保留一个分辨率'); return; }
          m.resolutions = m.resolutions.filter((x) => x !== r);
        } else {
          m.resolutions.push(r);
          const ORDER = ['480p', '720p', '1080p', '1k', '2k', '4k'];
          m.resolutions.sort((a, b2) => ORDER.indexOf(a) - ORDER.indexOf(b2));
        }
        if (!m.resolutions.includes(m.defaultResolution)) m.defaultResolution = m.resolutions[0];
        if (m.cost) Object.keys(m.cost).forEach((k) => { if (!m.resolutions.includes(k)) delete m.cost[k]; });
        GLAD.saveConfig(c2);
        renderModels();
      }));

      // 时长多选（视频）
      $$('[data-dur]', card).forEach((b) => b.addEventListener('click', () => {
        const c2 = cfg();
        const m = c2.videoModels[idx];
        const d = Number(b.dataset.dur);
        m.durations = m.durations || [5, 10];
        if (m.durations.includes(d)) {
          if (m.durations.length === 1) { UI.warn('至少保留一个时长档位'); return; }
          m.durations = m.durations.filter((x) => x !== d);
        } else {
          m.durations.push(d);
          m.durations.sort((a, b2) => a - b2);
        }
        // 补齐/清理价格
        m.resolutions.forEach((r) => {
          m.cost[r] = m.cost[r] || {};
          m.durations.forEach((dd) => { if (m.cost[r][dd] == null) m.cost[r][dd] = 30; });
          Object.keys(m.cost[r]).forEach((k) => { if (!m.durations.includes(Number(k))) delete m.cost[r][k]; });
        });
        GLAD.saveConfig(c2);
        renderModels();
      }));

      // 保存
      card.querySelector('[data-act="save"]').addEventListener('click', () => {
        const c2 = cfg();
        const arr = S.modelTab === 'video' ? c2.videoModels : c2.imageModels;
        const m = arr[idx];
        m.name = card.querySelector('[data-f="name"]').value.trim() || m.name;
        m.badge = card.querySelector('[data-f="badge"]').value.trim();
        m.desc = card.querySelector('[data-f="desc"]').value.trim();
        const dsel = card.querySelector('[data-f="defaultResolution"]');
        if (dsel) m.defaultResolution = dsel.value;
        // 价格
        m.cost = m.cost || {};
        $$('[data-cost-res]', card).forEach((inp) => {
          const r = inp.dataset.costRes;
          const val = Math.max(0, Number(inp.value) || 0);
          if (inp.dataset.costDur != null) {
            m.cost[r] = m.cost[r] || {};
            m.cost[r][Number(inp.dataset.costDur)] = val;
          } else {
            m.cost[r] = val;
          }
        });
        GLAD.saveConfig(c2);
        UI.ok('已保存：' + m.name);
        renderModels(); chrome();
      });

      card.querySelector('[data-act="copy"]').addEventListener('click', () => {
        const id = src().id;
        navigator.clipboard && navigator.clipboard.writeText(id);
        UI.ok('已复制 ' + id);
      });

      card.querySelector('[data-act="reset"]').addEventListener('click', async () => {
        const yes = await UI.confirm({
          title: '恢复该模型默认设置？', okText: '恢复', danger: true,
          text: '名称、描述、分辨率与价格都会回到出厂值。',
        });
        if (!yes) return;
        const fresh = GLAD.resetConfig();
        const freshList = S.modelTab === 'video' ? fresh.videoModels : fresh.imageModels;
        const old = S.modelTab === 'video' ? cfg().videoModels : cfg().imageModels;
        // 只替换这一个模型
        const c2 = cfg();
        const cur = S.modelTab === 'video' ? c2.videoModels : c2.imageModels;
        cur[idx] = freshList.find((x) => x.id === old[idx].id) || cur[idx];
        GLAD.saveConfig(c2);
        UI.ok('已恢复默认');
        renderModels();
      });
    });
  }

  /* ============================================================
     4. 比例与时长
     ============================================================ */
  const ALL_IMAGE_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'];
  const ALL_VIDEO_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
  const ALL_DURATIONS = [5, 10];

  function renderPresets() {
    const c = cfg();

    const chipRow = (host, all, cur) => {
      $(host).innerHTML = all.map((r) =>
        '<button class="opt ' + (cur.includes(r) ? 'is-active' : '') + '" data-r="' + r + '">' + r + '</button>').join('');
      $$(host + ' .opt').forEach((b) => b.addEventListener('click', () => {
        const c2 = cfg();
        const list = host === '#preset-image-ratios' ? c2.image : c2.video;
        const r = b.dataset.r;
        if (list.ratios.includes(r)) {
          if (list.ratios.length === 1) { UI.warn('至少保留一个比例'); return; }
          list.ratios = list.ratios.filter((x) => x !== r);
        } else {
          list.ratios.push(r);
          list.ratios.sort((a, b2) => all.indexOf(a) - all.indexOf(b2));
        }
        if (!list.ratios.includes(list.defaultRatio)) list.defaultRatio = list.ratios[0];
        GLAD.saveConfig(c2);
        renderPresets();
      }));
    };

    chipRow('#preset-image-ratios', ALL_IMAGE_RATIOS, c.image.ratios);
    chipRow('#preset-video-ratios', ALL_VIDEO_RATIOS, c.video.ratios);

    $('#preset-image-default').innerHTML = c.image.ratios.map((r) =>
      '<option value="' + r + '"' + (r === c.image.defaultRatio ? ' selected' : '') + '>' + r + '</option>').join('');
    $('#preset-video-default').innerHTML = c.video.ratios.map((r) =>
      '<option value="' + r + '"' + (r === c.video.defaultRatio ? ' selected' : '') + '>' + r + '</option>').join('');

    $('#preset-durations').innerHTML = ALL_DURATIONS.map((d) =>
      '<button class="opt ' + (c.video.durations.includes(d) ? 'is-active' : '') + '" data-d="' + d + '">' + d + ' 秒</button>').join('');
    $$('#preset-durations .opt').forEach((b) => b.addEventListener('click', () => {
      const c2 = cfg();
      const d = Number(b.dataset.d);
      if (c2.video.durations.includes(d)) {
        if (c2.video.durations.length === 1) { UI.warn('至少保留一个时长'); return; }
        c2.video.durations = c2.video.durations.filter((x) => x !== d);
      } else {
        c2.video.durations.push(d);
        c2.video.durations.sort((a, b2) => a - b2);
      }
      if (!c2.video.durations.includes(c2.video.defaultDuration)) c2.video.defaultDuration = c2.video.durations[0];
      GLAD.saveConfig(c2);
      renderPresets();
    }));
    $('#preset-duration-default').innerHTML = c.video.durations.map((d) =>
      '<option value="' + d + '"' + (Number(d) === Number(c.video.defaultDuration) ? ' selected' : '') + '>' + d + ' 秒</option>').join('');

    $('#preset-maxref').value = c.video.maxRefImages;
    $('#preset-strength').value = c.image.sampleStrength;
  }

  /* ============================================================
     5. API 接入
     ============================================================ */
  function renderApi() {
    const c = cfg();
    const real = c.api.mode === 'real';
    $('#api-mode-title').textContent = real ? '真实接口' : '演示模式';
    $('#api-mode-desc').textContent = real
      ? '会真的请求 ' + c.api.baseUrl + ' 生成内容'
      : '所有生成都在本地模拟，不会请求任何外部服务；接好服务后一键切到真实接口';
    $$('#api-mode-switch button').forEach((b) => b.classList.toggle('is-active', b.dataset.m === c.api.mode));

    $('#api-base').value = c.api.baseUrl;
    $('#api-auth').value = c.api.authHeader;
    $('#api-timeout').value = c.api.timeout;
    $('#api-retry').value = c.api.retry;
    $('#api-ep-img').value = c.api.imageEndpoint;
    $('#api-ep-vid').value = c.api.videoEndpoint;
    $('#api-ep-models').value = c.api.modelsEndpoint;
    $('#api-ep-points').value = c.api.pointsEndpoint;
    swSet($('#sw-usepool'), c.api.usePool);
    swSet($('#sw-downgrade'), c.api.fallbackDowngrade);
    drawApiPreview();
  }

  function drawApiPreview() {
    const c = cfg();
    const tk = GLAD.poolList().filter((t) => t.enabled && t.live);
    const auth = c.api.usePool ? tk.map((t) => t.session) : (tk[0] ? [tk[0].session] : []);
    const body = {
      model: (c.imageModels[0] || {}).id,
      prompt: '示例：夜晚的东京街头，霓虹灯在雨后的路面上晕开，电影感，浅景深',
      negative_prompt: '',
      ratio: c.image.defaultRatio,
      resolution: (c.imageModels[0] || {}).defaultResolution,
      sample_strength: c.image.sampleStrength,
      response_format: 'url',
    };
    const vbody = {
      model: (c.videoModels[0] || {}).id,
      prompt: '示例：镜头缓慢推进，穿过雾气弥漫的松林，晨光从树缝洒下',
      ratio: c.video.defaultRatio,
      resolution: (c.videoModels[0] || {}).defaultResolution,
      duration: c.video.defaultDuration,
      response_format: 'url',
    };
    $('#api-preview').textContent =
      '# 图片生成\n' +
      'POST ' + c.api.baseUrl + c.api.imageEndpoint + '\n' +
      'Authorization: ' + c.api.authHeader + (auth.length ? auth.map((s) => mask(s)).join(',') : '（账号池为空）') + '\n' +
      'Content-Type: application/json\n\n' +
      JSON.stringify(body, null, 2) + '\n\n' +
      '# 视频生成\n' +
      'POST ' + c.api.baseUrl + c.api.videoEndpoint + '\n\n' +
      JSON.stringify(vbody, null, 2) + '\n\n' +
      '# 额度查询\n' +
      'POST ' + c.api.baseUrl + c.api.pointsEndpoint + '\n' +
      'Authorization: ' + c.api.authHeader + (auth.length ? auth.map((s) => mask(s)).join(',') : '（账号池为空）') + '\n\n' +
      '# 返回： [{ "token": "...", "points": { "giftCredit": 0, "purchaseCredit": 0, "vipCredit": 0, "totalCredit": 0 } }]';
  }

  function apiLog(text) {
    $('#api-test-out').classList.remove('hidden');
    $('#api-test-text').textContent = text;
  }

  async function testApi() {
    const c = cfg();
    const pill = $('#api-test-pill');
    pill.className = 'pill warn';
    pill.textContent = '测试中…';
    const url = c.api.baseUrl.replace(/\/+$/, '') + '/ping';
    apiLog('→ GET ' + url + '\n\n（这是浏览器直连，若服务未启动或跨域会被拦；\n  真实部署时由你自己的后端转发，不会有跨域问题。）');
    const t0 = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(timer);
      const txt = await res.text();
      const ms = Date.now() - t0;
      pill.className = 'pill ' + (res.ok ? 'ok' : 'danger');
      pill.textContent = res.ok ? '已连接 ' + ms + 'ms' : 'HTTP ' + res.status;
      apiLog('→ GET ' + url + '\n← HTTP ' + res.status + ' (' + ms + 'ms)\n\n' + txt.slice(0, 600));
      UI[res.ok ? 'ok' : 'warn'](res.ok ? '连接成功（' + ms + 'ms）' : '返回 HTTP ' + res.status);
    } catch (e) {
      const ms = Date.now() - t0;
      pill.className = 'pill danger';
      pill.textContent = '连接失败';
      apiLog('→ GET ' + url + '\n✕ ' + e.name + ': ' + e.message + ' (' + ms + 'ms)\n\n' +
        '常见原因：\n' +
        '1. 本机聚合服务没启动（双击 jimeng-portable 的「启动服务.bat」）\n' +
        '2. 端口不是 8001，改 config\\portable.env 里的 PORT\n' +
        '3. 浏览器跨域限制 —— 正式部署时由后端转发即可');
      UI.err('连接失败：' + e.message);
    }
  }

  async function fetchModels() {
    const c = cfg();
    const url = c.api.baseUrl.replace(/\/+$/, '') + c.api.modelsEndpoint;
    apiLog('→ GET ' + url);
    try {
      const tk = GLAD.poolList().filter((t) => t.enabled && t.live);
      const headers = {};
      if (tk.length) headers.Authorization = c.api.authHeader + tk.map((t) => t.session).join(',');
      const res = await fetch(url, { headers, cache: 'no-store' });
      const data = await res.json();
      const arr = (data && data.data) || [];
      apiLog('→ GET ' + url + '\n← HTTP ' + res.status + '\n\n共 ' + arr.length + ' 个模型\n\n' +
        arr.slice(0, 40).map((m) =>
          '· ' + m.id + '  [' + (m.owned_by || '') + ']  ' +
          (m.supported_resolutions ? m.supported_resolutions.join('/') : '')).join('\n'));
      UI.ok('拉到 ' + arr.length + ' 个模型');
    } catch (e) {
      apiLog('→ GET ' + url + '\n✕ ' + e.message);
      UI.err('拉取失败：' + e.message);
    }
  }

  async function fetchPoints() {
    const c = cfg();
    const url = c.api.baseUrl.replace(/\/+$/, '') + c.api.pointsEndpoint;
    const tk = GLAD.poolList().filter((t) => t.enabled);
    if (!tk.length) { UI.warn('账号池是空的'); return; }
    apiLog('→ POST ' + url + '\nAuthorization: ' + c.api.authHeader + tk.map((t) => mask(t.session)).join(','));
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: c.api.authHeader + tk.map((t) => t.session).join(',') },
      });
      const data = await res.json();
      apiLog('→ POST ' + url + '\n← HTTP ' + res.status + '\n\n' + JSON.stringify(data, null, 2).slice(0, 1200));
      UI.ok('已查询 ' + (Array.isArray(data) ? data.length : 0) + ' 个账号');
    } catch (e) {
      apiLog('→ POST ' + url + '\n✕ ' + e.message);
      UI.err('查询失败：' + e.message);
    }
  }

  /* ============================================================
     6. 用户管理
     ============================================================ */
  function renderUsers() {
    let us = GLAD.listUsers(S.userSearch);
    if (S.userFilter === 'active') us = us.filter((u) => u.status === 'active' && u.role !== 'admin');
    if (S.userFilter === 'banned') us = us.filter((u) => u.status === 'banned');
    if (S.userFilter === 'admin') us = us.filter((u) => u.role === 'admin');

    $('#user-count').textContent = '共 ' + us.length + ' 个用户 · 积分合计 ' +
      UI.num(us.reduce((a, b) => a + (b.credits || 0), 0));
    $$('#user-filter button').forEach((b) => b.classList.toggle('is-active', b.dataset.f === S.userFilter));

    $('#user-rows').innerHTML = us.length ? us.map((u) => {
      const jobs = GLAD.allJobs().filter((j) => j.userId === u.id).length;
      return '<tr data-id="' + u.id + '">' +
        '<td><div class="row" style="gap:9px">' +
          '<span class="avatar sm">' + UI.esc((u.username || 'U').slice(0, 1).toUpperCase()) + '</span>' +
          '<div style="min-width:0"><div class="t-strong truncate">' + UI.esc(u.username) + '</div>' +
          '<div class="t-xs t-mono">' + UI.esc(u.id) + '</div></div></div></td>' +
        '<td><div class="t-xs">' + UI.esc(u.email || '—') + '</div>' +
          '<div class="t-xs">' + UI.esc(u.phone || '') + '</div></td>' +
        '<td>' + (u.role === 'admin' ? '<span class="pill brand">管理员</span>' : '<span class="pill">用户</span>') + '</td>' +
        '<td class="text-r"><span class="t-strong num">' + UI.num(u.credits) + '</span></td>' +
        '<td class="text-r num">' + jobs + '</td>' +
        '<td>' + (u.status === 'banned'
          ? '<span class="pill danger"><span class="dot"></span>已封禁</span>'
          : '<span class="pill ok"><span class="dot"></span>正常</span>') + '</td>' +
        '<td class="t-xs">' + (u.lastLogin ? UI.ago(u.lastLogin) : '从未') + '</td>' +
        '<td><div class="cell-actions">' +
          '<button class="btn btn-sm" data-act="credit">改积分</button>' +
          '<button class="btn btn-sm" data-act="edit">编辑</button>' +
          '<button class="btn btn-sm" data-act="more">⋯</button>' +
        '</div></td>' +
      '</tr>';
    }).join('') : '<tr><td colspan="8" class="t-xs text-c" style="padding:26px">没有匹配的用户</td></tr>';

    $$('#user-rows tr[data-id]').forEach((tr) => {
      const id = tr.dataset.id;
      const u = () => GLAD.listUsers().find((x) => x.id === id);
      $$('[data-act]', tr).forEach((b) => b.addEventListener('click', async () => {
        const act = b.dataset.act;
        const user = u();
        if (!user) return;

        if (act === 'credit') {
          const m = UI.modal({
            title: '调整积分 · ' + user.username,
            body:
              '<div class="col" style="gap:14px">' +
                '<div class="row" style="gap:12px">' +
                  '<div class="stat" style="flex:1"><div class="k">当前积分</div><div class="v">' + UI.num(user.credits) + '</div></div>' +
                '</div>' +
                '<div class="field"><label class="field-label">调整数量（正数增加，负数扣减）</label>' +
                  '<input class="input" id="adj-num" type="number" placeholder="例如 500 或 -100"></div>' +
                '<div class="row row-wrap" style="gap:6px">' +
                  [100, 500, 1000, -100].map((n) =>
                    '<button class="btn btn-sm" data-quick="' + n + '">' + (n > 0 ? '+' : '') + n + '</button>').join('') +
                '</div>' +
                '<div class="field"><label class="field-label">原因（会记入日志）</label>' +
                  '<input class="input" id="adj-why" placeholder="例如：活动补偿 / 客服补单"></div>' +
              '</div>',
            foot: '<button class="btn" data-close>取消</button><span class="spacer"></span>' +
              '<button class="btn btn-primary" data-ok>确认调整</button>',
            onMount(e) {
              const inp = e.root.querySelector('#adj-num');
              $$('[data-quick]', e.root).forEach((q) => q.addEventListener('click', () => {
                inp.value = (Number(inp.value) || 0) + Number(q.dataset.quick);
              }));
              e.root.querySelector('[data-ok]').addEventListener('click', () => {
                const n = Number(inp.value);
                if (!n) return UI.warn('请输入调整数量');
                const why = e.root.querySelector('#adj-why').value.trim() || '管理员手动调整';
                GLAD.addCredits(id, n, why);
                e.close(); renderUsers(); chrome();
                UI.ok((n > 0 ? '已增加 ' : '已扣减 ') + Math.abs(n) + ' 积分');
              });
            },
          });
          void m;
        }

        if (act === 'edit') {
          const m = UI.modal({
            title: '编辑用户',
            body:
              '<div class="col" style="gap:14px">' +
                '<div class="field"><label class="field-label">用户名</label>' +
                  '<input class="input" id="eu-name" value="' + UI.esc(user.username) + '"></div>' +
                '<div class="field"><label class="field-label">邮箱</label>' +
                  '<input class="input" id="eu-mail" value="' + UI.esc(user.email || '') + '"></div>' +
                '<div class="field"><label class="field-label">手机号</label>' +
                  '<input class="input" id="eu-phone" value="' + UI.esc(user.phone || '') + '"></div>' +
                '<div class="field"><label class="field-label">重置密码（留空则不改）</label>' +
                  '<input class="input" id="eu-pw" placeholder="至少 6 位，含字母和数字"></div>' +
                '<div class="field"><label class="field-label">角色</label>' +
                  '<select class="select" id="eu-role">' +
                    '<option value="user"' + (user.role === 'user' ? ' selected' : '') + '>普通用户</option>' +
                    '<option value="admin"' + (user.role === 'admin' ? ' selected' : '') + '>管理员</option>' +
                  '</select></div>' +
                '<div class="field"><label class="field-label">备注</label>' +
                  '<input class="input" id="eu-note" value="' + UI.esc(user.note || '') + '"></div>' +
              '</div>',
            foot: '<button class="btn" data-close>取消</button><span class="spacer"></span>' +
              '<button class="btn btn-primary" data-ok>保存</button>',
            onMount(e) {
              e.root.querySelector('[data-ok]').addEventListener('click', () => {
                const patch = {
                  status: user.status,
                  role: e.root.querySelector('#eu-role').value,
                  note: e.root.querySelector('#eu-note').value.trim(),
                };
                const nm = e.root.querySelector('#eu-name').value.trim();
                const ml = e.root.querySelector('#eu-mail').value.trim();
                const ph = e.root.querySelector('#eu-phone').value.trim();
                const pw = e.root.querySelector('#eu-pw').value.trim();
                // 用户名/邮箱/手机号直接改（演示版不做唯一性拦截）
                const us2 = GLAD.listUsers();
                const target = us2.find((x) => x.id === id);
                const raw = GLAD.read(GLAD.K.users, []);
                const r2 = raw.find((x) => x.id === id);
                if (r2) {
                  r2.username = nm || r2.username;
                  r2.email = ml;
                  r2.phone = ph;
                  if (pw) r2.pass = GLAD.hash(pw);
                  GLAD.write(GLAD.K.users, raw);
                }
                void us2; void target;
                GLAD.adminUpdateUser(id, patch);
                e.close(); renderUsers(); chrome();
                UI.ok('已保存');
              });
            },
          });
          void m;
        }

        if (act === 'more') {
          const m = UI.modal({
            title: '更多操作 · ' + user.username,
            size: 'narrow',
            body:
              '<div class="col" style="gap:8px">' +
                '<button class="nav-item" data-m="ban">' + UI.icon(user.status === 'banned' ? 'check' : 'alert') +
                  (user.status === 'banned' ? '解除封禁' : '封禁账号') + '</button>' +
                '<button class="nav-item" data-m="resetpw">' + UI.icon('key') + '重置密码为 123456</button>' +
                '<button class="nav-item" data-m="wipe">' + UI.icon('trash') + '清空该用户作品</button>' +
                '<button class="nav-item" style="color:#FFAAAA" data-m="del">' + UI.icon('trash') + '删除该用户</button>' +
              '</div>',
            foot: false,
            onMount(e) {
              $$('[data-m]', e.root).forEach((btn) => btn.addEventListener('click', async () => {
                const mm = btn.dataset.m;
                if (mm === 'ban') {
                  GLAD.adminUpdateUser(id, { status: user.status === 'banned' ? 'active' : 'banned' });
                  e.close(); renderUsers(); UI.ok(user.status === 'banned' ? '已解除封禁' : '已封禁');
                }
                if (mm === 'resetpw') {
                  const yes = await UI.confirm({ title: '重置为 123456？', text: '用户需尽快自行修改。', okText: '重置' });
                  if (!yes) return;
                  GLAD.adminUpdateUser(id, { password: '123456' });
                  e.close(); UI.ok('密码已重置为 123456');
                }
                if (mm === 'wipe') {
                  const yes = await UI.confirm({ title: '清空该用户全部作品？', danger: true, okText: '清空' });
                  if (!yes) return;
                  GLAD.write(GLAD.K.jobs, GLAD.read(GLAD.K.jobs, []).filter((j) => j.userId !== id));
                  e.close(); renderUsers(); UI.ok('已清空');
                }
                if (mm === 'del') {
                  const yes = await UI.confirm({ title: '彻底删除该用户？', danger: true, okText: '删除',
                    text: '用户、作品记录都会被删除，操作不可恢复。' });
                  if (!yes) return;
                  const r = GLAD.adminDeleteUser(id);
                  e.close();
                  if (!r.ok) return UI.err(r.msg);
                  renderUsers(); chrome(); UI.ok('已删除');
                }
              }));
            },
          });
          void m;
        }
      }));
    });
  }

  /* ============================================================
     7. 订单管理
     ============================================================ */
  function renderOrders() {
    const all = GLAD.listOrders({ status: S.orderStatus === 'all' ? null : S.orderStatus, keyword: S.orderSearch });
    const allRaw = GLAD.listOrders();
    const paid = allRaw.filter((o) => o.status === 'paid');
    $('#order-kpi').innerHTML = [
      { k: '订单总数', v: UI.num(allRaw.length) },
      { k: '已支付', v: UI.num(paid.length) },
      { k: '待支付', v: UI.num(allRaw.filter((o) => o.status === 'pending').length) },
      { k: '累计金额', v: '¥' + UI.num(paid.reduce((a, b) => a + b.price, 0)) },
      { k: '发放积分', v: UI.num(paid.reduce((a, b) => a + b.credits, 0)) },
      { k: '微信 / 支付宝', v: paid.filter((o) => o.method === 'wechat').length + ' / ' + paid.filter((o) => o.method === 'alipay').length },
    ].map((x) => '<div class="stat" style="padding:12px"><div class="k">' + x.k + '</div>' +
      '<div class="v" style="font-size:21px">' + x.v + '</div></div>').join('');
    $$('#order-status button').forEach((b) => b.classList.toggle('is-active', b.dataset.f === S.orderStatus));

    const label = { pending: ['warn', '待支付'], paid: ['ok', '已支付'], closed: ['', '已关闭'] };
    $('#order-rows').innerHTML = all.length ? all.map((o) => {
      const st = label[o.status] || ['', o.status];
      const m = (cfg().recharge.methods.find((x) => x.id === o.method) || {}).name || o.method;
      const plan = cfg().recharge.plans.find((p) => p.id === o.planId);
      return '<tr data-id="' + o.id + '">' +
        '<td><span class="t-mono">' + UI.esc(o.id) + '</span></td>' +
        '<td class="t-strong">' + UI.esc(o.username) + '</td>' +
        '<td>' + (plan ? UI.esc(plan.label) : '自定义') + '</td>' +
        '<td class="text-r t-strong num">¥' + o.price + '</td>' +
        '<td class="text-r num">' + UI.num(o.credits) + '</td>' +
        '<td><span class="pill ' + (o.method === 'wechat' ? 'ok' : 'info') + '">' + UI.esc(m) + '</span></td>' +
        '<td><span class="pill ' + st[0] + '">' + st[1] + '</span></td>' +
        '<td class="t-xs">' + GLAD.fmtDate(o.createdAt) + '</td>' +
        '<td><div class="cell-actions">' +
          (o.status === 'pending' ? '<button class="btn btn-sm btn-primary" data-act="pay">补单</button>' : '') +
          (o.status === 'pending' ? '<button class="btn btn-sm" data-act="close">关闭</button>' : '') +
          (o.status === 'paid' ? '<span class="t-xs" style="color:var(--text-4)">' + (o.paidAt ? UI.ago(o.paidAt) : '') + '</span>' : '') +
        '</div></td>' +
      '</tr>';
    }).join('') : '<tr><td colspan="9" class="t-xs text-c" style="padding:26px">没有匹配的订单</td></tr>';

    $$('#order-rows tr[data-id]').forEach((tr) => {
      const id = tr.dataset.id;
      $$('[data-act]', tr).forEach((b) => b.addEventListener('click', async () => {
        if (b.dataset.act === 'pay') {
          const yes = await UI.confirm({ title: '手动标记为已支付？', okText: '标记并发放积分',
            text: '会立即给用户加上对应积分，并记入日志。仅用于客服补单。' });
          if (!yes) return;
          const r = GLAD.adminMarkOrderPaid(id);
          if (!r.ok) return UI.err(r.msg);
          renderOrders(); chrome(); UI.ok('已补单并发放积分');
        }
        if (b.dataset.act === 'close') {
          const yes = await UI.confirm({ title: '关闭该订单？', okText: '关闭', danger: true });
          if (!yes) return;
          GLAD.adminCloseOrder(id);
          renderOrders(); chrome(); UI.ok('已关闭');
        }
      }));
    });
  }

  /* ============================================================
     8. 积分与计费
     ============================================================ */
  function renderPricing() {
    const c = cfg();
    $('#cr-register').value = c.credit.registerGift;
    $('#cr-daily').value = c.credit.dailyGift;
    $('#cr-signin').value = c.credit.signInGift;
    swSet($('#sw-negative'), c.credit.allowNegative);

    swSet($('#sw-recharge'), c.recharge.enabled);
    swSet($('#sw-wechat'), (c.recharge.methods.find((m) => m.id === 'wechat') || {}).enabled);
    swSet($('#sw-alipay'), (c.recharge.methods.find((m) => m.id === 'alipay') || {}).enabled);
    $('#rc-min').value = c.recharge.customMin;
    $('#rc-max').value = c.recharge.customMax;
    $('#rc-expire').value = c.recharge.qrExpireSec;

    $('#plan-rows').innerHTML = c.recharge.plans.map((p, i) =>
      '<tr data-i="' + i + '">' +
        '<td><input class="input" data-p="label" value="' + UI.esc(p.label) + '" style="height:30px;font-size:12.5px"></td>' +
        '<td><input class="input text-r" data-p="price" type="number" min="1" value="' + p.price + '" style="height:30px;font-size:12.5px;width:88px;margin-left:auto"></td>' +
        '<td><input class="input text-r" data-p="credits" type="number" min="0" value="' + p.credits + '" style="height:30px;font-size:12.5px;width:96px;margin-left:auto"></td>' +
        '<td><input class="input text-r" data-p="bonus" type="number" min="0" value="' + (p.bonus || 0) + '" style="height:30px;font-size:12.5px;width:88px;margin-left:auto"></td>' +
        '<td class="text-r t-strong num">' + UI.num(p.credits + (p.bonus || 0)) + '</td>' +
        '<td><div class="cell-actions">' +
          '<button class="btn btn-sm btn-primary" data-act="save">保存</button>' +
          '<button class="btn btn-sm btn-danger" data-act="del">删</button>' +
        '</div></td>' +
      '</tr>').join('');

    $$('#plan-rows tr').forEach((tr) => {
      const i = Number(tr.dataset.i);
      $$('[data-p]', tr).forEach((inp) => inp.addEventListener('input', () => {
        const cells = $$('[data-p]', tr);
        const credits = Number(cells.find((x) => x.dataset.p === 'credits').value) || 0;
        const bonus = Number(cells.find((x) => x.dataset.p === 'bonus').value) || 0;
        tr.children[4].textContent = UI.num(credits + bonus);
      }));
      tr.querySelector('[data-act="save"]').addEventListener('click', () => {
        const c2 = cfg();
        const p = c2.recharge.plans[i];
        const cells = $$('[data-p]', tr);
        cells.forEach((inp) => {
          const k = inp.dataset.p;
          p[k] = k === 'label' ? inp.value.trim() : Math.max(0, Number(inp.value) || 0);
        });
        if (!p.price) { UI.warn('价格必须大于 0'); return; }
        GLAD.saveConfig(c2);
        renderPricing(); UI.ok('已保存套餐：' + p.label);
      });
      tr.querySelector('[data-act="del"]').addEventListener('click', async () => {
        const yes = await UI.confirm({ title: '删除该套餐？', okText: '删除', danger: true });
        if (!yes) return;
        const c2 = cfg();
        c2.recharge.plans.splice(i, 1);
        GLAD.saveConfig(c2);
        renderPricing(); UI.ok('已删除');
      });
    });
  }

  /* ============================================================
     9. 作品库
     ============================================================ */
  function renderAdAssets() {
    const q = {};
    if (S.assetFilter === 'image' || S.assetFilter === 'video') q.type = S.assetFilter;
    if (S.assetFilter === 'failed') q.status = 'failed';
    if (S.assetSearch) q.keyword = S.assetSearch;
    const js = GLAD.allJobs(q);
    $('#ad-asset-count').textContent = '共 ' + js.length + ' 条';
    $$('#ad-asset-filter button').forEach((b) => b.classList.toggle('is-active', b.dataset.f === S.assetFilter));

    const host = $('#ad-asset-grid');
    if (!js.length) {
      host.innerHTML = '<div class="empty"><span class="ico-lg"><svg viewBox="0 0 24 24">' +
        '<rect x="3" y="3" width="18" height="18" rx="3"/></svg></span>' +
        '<div class="t-h3">没有匹配的作品</div></div>';
      return;
    }
    host.innerHTML = '<div class="table-wrap"><table class="tbl">' +
      '<thead><tr><th>预览</th><th>提示词</th><th>用户</th><th>模型</th><th>规格</th>' +
      '<th class="text-r">积分</th><th>状态</th><th>时间</th><th class="text-r">操作</th></tr></thead><tbody>' +
      js.slice(0, 200).map((j) => {
        const u = GLAD.listUsers().find((x) => x.id === j.userId);
        const url = j.urls && j.urls[0];
        const st = j.status === 'done' ? '<span class="pill ok">完成</span>'
          : j.status === 'running' ? '<span class="pill warn">生成中</span>'
          : '<span class="pill danger">失败</span>';
        return '<tr data-id="' + j.id + '">' +
          '<td>' + (url
            ? '<div style="width:56px;height:40px;border-radius:7px;overflow:hidden;border:1px solid var(--line)">' +
              (j.type === 'video' ? '<video src="' + url + '" muted style="width:100%;height:100%;object-fit:cover"></video>'
                : '<img src="' + url + '" style="width:100%;height:100%;object-fit:cover">') + '</div>'
            : '<div style="width:56px;height:40px;border-radius:7px;background:var(--surface-2)"></div>') + '</td>' +
          '<td><div class="t-sm clamp-2" style="max-width:300px">' + UI.esc(j.prompt) + '</div></td>' +
          '<td class="t-sm">' + UI.esc(u ? u.username : '已删除') + '</td>' +
          '<td class="t-xs">' + UI.esc(j.modelName) + '</td>' +
          '<td class="t-xs">' + UI.esc(j.ratio) + ' · ' + UI.esc(String(j.resolution).toUpperCase()) +
            (j.duration ? ' · ' + j.duration + 's' : '') + '</td>' +
          '<td class="text-r num">' + UI.num(j.cost) + '</td>' +
          '<td>' + st + '</td>' +
          '<td class="t-xs">' + UI.ago(j.createdAt) + '</td>' +
          '<td><div class="cell-actions">' +
            (url ? '<button class="btn btn-sm" data-act="open">查看</button>' : '') +
            '<button class="btn btn-sm btn-danger" data-act="del">删</button>' +
          '</div></td>' +
        '</tr>';
      }).join('') + '</tbody></table></div>';

    $$('#ad-asset-grid tr[data-id]').forEach((tr) => {
      const j = GLAD.allJobs().find((x) => x.id === tr.dataset.id);
      $$('[data-act]', tr).forEach((b) => b.addEventListener('click', async () => {
        if (b.dataset.act === 'open' && j && j.urls[0]) {
          const m = UI.modal({
            size: 'wide', title: j.modelName, eyebrow: '作品详情',
            body: '<div style="border-radius:var(--r-md);overflow:hidden;background:#000;margin-bottom:14px">' +
              (j.type === 'video'
                ? '<video src="' + j.urls[0] + '" controls autoplay loop style="width:100%;max-height:52vh;object-fit:contain"></video>'
                : '<img src="' + j.urls[0] + '" style="width:100%;max-height:52vh;object-fit:contain">') + '</div>' +
              '<div class="t-sm mb-2">' + UI.esc(j.prompt) + '</div>' +
              '<div class="row row-wrap" style="gap:7px">' +
                '<span class="pill brand">' + UI.esc(j.modelName) + '</span>' +
                '<span class="pill">' + UI.esc(j.ratio) + '</span>' +
                '<span class="pill">' + UI.esc(String(j.resolution).toUpperCase()) + '</span>' +
                (j.duration ? '<span class="pill">' + j.duration + ' 秒</span>' : '') +
                '<span class="pill">' + UI.num(j.cost) + ' 积分</span>' +
                '<span class="pill">' + GLAD.fmtDate(j.createdAt) + '</span>' +
              '</div>',
            foot: '<button class="btn" data-close>关闭</button>',
          });
          void m;
        }
        if (b.dataset.act === 'del') {
          const yes = await UI.confirm({ title: '删除这条作品记录？', danger: true, okText: '删除' });
          if (!yes) return;
          GLAD.adminDeleteJob(tr.dataset.id);
          renderAdAssets(); UI.ok('已删除');
        }
      }));
    });
  }

  /* ============================================================
     10. 内容审核
     ============================================================ */
  function renderAudit() {
    const c = cfg();
    swSet($('#sw-audit'), c.audit.enabled);
    $('#au-words').value = (c.audit.blockedWords || []).join('\n');
    $('#au-maxlen').value = c.audit.maxPromptLen;
  }

  /* ============================================================
     11. 站点设置
     ============================================================ */
  function renderSite() {
    const c = cfg();
    $('#st-name').value = c.site.name;
    $('#st-tagline').value = c.site.tagline;
    $('#st-slogan').value = c.site.slogan;
    $('#st-subtitle').value = c.site.subtitle;
    $('#st-footer').value = c.site.footer;
    $('#st-icp').value = c.site.icp || '';
    $('#st-notice').value = c.site.notice;
    swSet($('#sw-notice'), c.site.showNotice);
  }

  /* ============================================================
     12. 系统与日志
     ============================================================ */
  function renderSystem() {
    const logs = GLAD.listLogs(S.logLevel);
    $$('#log-level button').forEach((b) => b.classList.toggle('is-active', b.dataset.l === S.logLevel));
    $('#log-rows').innerHTML = logs.length ? logs.map(logRow).join('')
      : '<div class="t-xs text-c" style="padding:26px">暂无日志</div>';
  }

  /* ============================================================
     绑定
     ============================================================ */
  function bindAll() {
    $$('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $$('[data-jump]').forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault(); setView(b.dataset.jump);
    }));
    $('#nav-toggle').addEventListener('click', () => $('#sidebar').classList.toggle('is-open'));
    $('#btn-reload').addEventListener('click', () => { render(); UI.info('已刷新'); });

    $('#side-user').addEventListener('click', async () => {
      const m = UI.modal({
        size: 'narrow', head: false, foot: false,
        body: '<div class="col" style="gap:6px">' +
          '<div class="row" style="padding:10px 12px;gap:11px">' +
            '<span class="avatar">' + UI.esc((me().username || 'A').slice(0, 1).toUpperCase()) + '</span>' +
            '<div><div class="t-h3">' + UI.esc(me().username) + '</div>' +
            '<div class="t-xs">' + UI.esc(me().email || '') + '</div></div></div>' +
          '<div class="divider" style="margin:4px 0"></div>' +
          '<a class="nav-item" href="index.html">' + UI.icon('image') + '返回创作台</a>' +
          '<button class="nav-item" data-m="pw">' + UI.icon('key') + '修改我的密码</button>' +
          '<button class="nav-item" style="color:#FFAAAA" data-m="out">' + UI.icon('logout') + '退出登录</button>' +
        '</div>',
      });
      $$('[data-m]', m.body).forEach((b) => b.addEventListener('click', async () => {
        const act = b.dataset.m;
        if (act === 'out') {
          const yes = await UI.confirm({ title: '退出登录？', okText: '退出', danger: true });
          if (yes) { GLAD.logout(); location.replace('auth.html'); }
        }
        if (act === 'pw') {
          m.close();
          const m2 = UI.modal({
            title: '修改我的密码',
            body: '<div class="col" style="gap:14px">' +
              '<div class="field"><label class="field-label">原密码</label><input class="input" id="mp-old" type="password"></div>' +
              '<div class="field"><label class="field-label">新密码</label><input class="input" id="mp-new" type="password" placeholder="至少 6 位，含字母和数字"></div>' +
              '<div class="field"><label class="field-label">确认新密码</label><input class="input" id="mp-new2" type="password"></div>' +
              '</div>',
            foot: '<button class="btn" data-close>取消</button><span class="spacer"></span>' +
              '<button class="btn btn-primary" data-ok>修改</button>',
            onMount(e) {
              e.root.querySelector('[data-ok]').addEventListener('click', async () => {
                const r = await GLAD.changePassword({
                  oldPassword: e.root.querySelector('#mp-old').value,
                  password: e.root.querySelector('#mp-new').value,
                  password2: e.root.querySelector('#mp-new2').value,
                });
                if (!r.ok) return UI.err(r.msg);
                e.close(); UI.ok('密码已修改');
              });
            },
          });
          void m2;
        }
      }));
    });

    // 看板
    $$('#range-switch button').forEach((b) => b.addEventListener('click', () => {
      S.range = Number(b.dataset.d);
      $$('#range-switch button').forEach((x) => x.classList.toggle('is-active', x === b));
      renderDash();
    }));
    $('#btn-pool-probe').addEventListener('click', async () => {
      const b = $('#btn-pool-probe');
      b.classList.add('is-disabled');
      await GLAD.poolCheckAll();
      b.classList.remove('is-disabled');
      renderDash(); chrome(); UI.ok('全部账号探测完成');
    });

    // 账号池
    $('#btn-pool-add').addEventListener('click', openAddToken);
    $('#btn-pool-bulk').addEventListener('click', openBulkToken);
    $('#btn-pool-all').addEventListener('click', async () => {
      const b = $('#btn-pool-all');
      b.classList.add('is-disabled');
      await GLAD.poolCheckAll();
      b.classList.remove('is-disabled');
      renderPool(); chrome(); UI.ok('全部账号探测完成');
    });

    // 模型
    $$('#model-tab button').forEach((b) => b.addEventListener('click', () => {
      S.modelTab = b.dataset.t;
      renderModels();
    }));
    $('#btn-model-reset').addEventListener('click', async () => {
      const yes = await UI.confirm({
        title: '恢复全部模型默认设置？', danger: true, okText: '全部恢复',
        text: '所有模型的名称、描述、分辨率与价格都会回到出厂值。比例与时长配置不受影响。',
      });
      if (!yes) return;
      const c = cfg();
      const fresh = GLAD.resetConfig();
      c.imageModels = fresh.imageModels;
      c.videoModels = fresh.videoModels;
      GLAD.saveConfig(c);
      renderModels(); UI.ok('已恢复默认');
    });

    // 比例与时长
    $('#btn-preset-save').addEventListener('click', () => {
      const c = cfg();
      c.image.defaultRatio = $('#preset-image-default').value;
      c.video.defaultRatio = $('#preset-video-default').value;
      c.video.defaultDuration = Number($('#preset-duration-default').value);
      c.video.maxRefImages = Math.max(0, Math.min(2, Number($('#preset-maxref').value) || 0));
      c.image.sampleStrength = Math.max(0, Math.min(1, Number($('#preset-strength').value) || 0.5));
      GLAD.saveConfig(c);
      renderPresets(); UI.ok('配置已保存');
    });

    // API
    $$('#api-mode-switch button').forEach((b) => b.addEventListener('click', async () => {
      if (b.dataset.m === 'real') {
        const yes = await UI.confirm({
          title: '切换到真实接口？', okText: '切换',
          html: '切换后，客户端的生成会真的请求 <b>' + UI.esc(cfg().api.baseUrl) + '</b>。' +
            '<br><br>请确认：<br>1. 本机聚合服务已启动<br>2. 账号池里至少有一个可用 sessionid<br><br>' +
            '<span style="color:#FFD08A">积分仍由本页前端扣减，仅用于演示。</span>',
        });
        if (!yes) return;
      }
      const c = cfg();
      c.api.mode = b.dataset.m;
      GLAD.saveConfig(c);
      GLAD.pushSystemLog('WARN', '生成通道切换为：' + (c.api.mode === 'real' ? '真实接口' : '演示模式'));
      renderApi(); chrome();
      UI.ok('已切换到' + (c.api.mode === 'real' ? '真实接口' : '演示模式'));
    }));

    const saveApi = () => {
      const c = cfg();
      c.api.baseUrl = $('#api-base').value.trim().replace(/\/+$/, '');
      c.api.authHeader = $('#api-auth').value;
      c.api.timeout = Number($('#api-timeout').value) || 600;
      c.api.retry = Number($('#api-retry').value) || 0;
      c.api.imageEndpoint = $('#api-ep-img').value.trim();
      c.api.videoEndpoint = $('#api-ep-vid').value.trim();
      c.api.modelsEndpoint = $('#api-ep-models').value.trim();
      c.api.pointsEndpoint = $('#api-ep-points').value.trim();
      c.api.usePool = swGet($('#sw-usepool'));
      c.api.fallbackDowngrade = swGet($('#sw-downgrade'));
      GLAD.saveConfig(c);
      drawApiPreview(); chrome();
      return c;
    };
    ['#api-base', '#api-auth', '#api-timeout', '#api-retry',
     '#api-ep-img', '#api-ep-vid', '#api-ep-models', '#api-ep-points'].forEach((s) => {
      $(s).addEventListener('change', () => { saveApi(); UI.ok('已保存'); });
    });
    $('#sw-usepool').addEventListener('click', (e) => {
      e.currentTarget.classList.toggle('is-on'); saveApi();
    });
    $('#sw-downgrade').addEventListener('click', (e) => {
      e.currentTarget.classList.toggle('is-on'); saveApi();
    });
    $('#btn-api-test').addEventListener('click', () => { saveApi(); testApi(); });
    $('#btn-api-models').addEventListener('click', () => { saveApi(); fetchModels(); });
    $('#btn-api-points').addEventListener('click', () => { saveApi(); fetchPoints(); });

    // 用户
    $('#user-search').addEventListener('input', (e) => { S.userSearch = e.target.value.trim(); renderUsers(); });
    $$('#user-filter button').forEach((b) => b.addEventListener('click', () => {
      S.userFilter = b.dataset.f; renderUsers();
    }));
    $('#btn-user-new').addEventListener('click', () => {
      const m = UI.modal({
        title: '新建用户',
        body: '<div class="col" style="gap:14px">' +
          '<div class="field"><label class="field-label">用户名</label><input class="input" id="nu-name"></div>' +
          '<div class="field"><label class="field-label">邮箱</label><input class="input" id="nu-mail" type="email"></div>' +
          '<div class="field"><label class="field-label">初始密码</label><input class="input" id="nu-pw" value="123456"></div>' +
          '<div class="field"><label class="field-label">初始积分</label><input class="input" id="nu-cr" type="number" value="0"></div>' +
          '<div class="field"><label class="field-label">角色</label><select class="select" id="nu-role">' +
            '<option value="user">普通用户</option><option value="admin">管理员</option></select></div>' +
          '</div>',
        foot: '<button class="btn" data-close>取消</button><span class="spacer"></span>' +
          '<button class="btn btn-primary" data-ok>创建</button>',
        onMount(e) {
          e.root.querySelector('[data-ok]').addEventListener('click', () => {
            const r = GLAD.adminCreateUser({
              username: e.root.querySelector('#nu-name').value.trim(),
              email: e.root.querySelector('#nu-mail').value.trim(),
              password: e.root.querySelector('#nu-pw').value,
              credits: e.root.querySelector('#nu-cr').value,
              role: e.root.querySelector('#nu-role').value,
            });
            if (!r.ok) return UI.err(r.msg);
            e.close(); renderUsers(); chrome(); UI.ok('已创建：' + r.user.username);
          });
        },
      });
      void m;
    });
    $('#btn-user-export').addEventListener('click', () => {
      const us = GLAD.listUsers();
      csv([['用户ID', '用户名', '邮箱', '手机号', '角色', '积分', '状态', '注册时间', '最近登录']]
        .concat(us.map((u) => [u.id, u.username, u.email, u.phone, u.role, u.credits, u.status,
          GLAD.fmtDate(u.createdAt), u.lastLogin ? GLAD.fmtDate(u.lastLogin) : ''])),
        'glad-users-' + GLAD.fmtDay(Date.now()) + '.csv');
    });

    // 订单
    $('#order-search').addEventListener('input', (e) => { S.orderSearch = e.target.value.trim(); renderOrders(); });
    $$('#order-status button').forEach((b) => b.addEventListener('click', () => {
      S.orderStatus = b.dataset.f; renderOrders();
    }));
    $('#btn-order-export').addEventListener('click', () => {
      const os = GLAD.listOrders();
      csv([['订单号', '用户', '金额', '积分', '渠道', '状态', '创建时间', '支付时间']]
        .concat(os.map((o) => [o.id, o.username, o.price, o.credits, o.method, o.status,
          GLAD.fmtDate(o.createdAt), o.paidAt ? GLAD.fmtDate(o.paidAt) : ''])),
        'glad-orders-' + GLAD.fmtDay(Date.now()) + '.csv');
    });

    // 积分与计费
    $('#btn-credit-save').addEventListener('click', () => {
      const c = cfg();
      c.credit.registerGift = Math.max(0, Number($('#cr-register').value) || 0);
      c.credit.dailyGift = Math.max(0, Number($('#cr-daily').value) || 0);
      c.credit.signInGift = Math.max(0, Number($('#cr-signin').value) || 0);
      c.credit.allowNegative = swGet($('#sw-negative'));
      GLAD.saveConfig(c);
      UI.ok('积分规则已保存');
    });
    $('#sw-negative').addEventListener('click', (e) => e.currentTarget.classList.toggle('is-on'));
    $('#sw-recharge').addEventListener('click', (e) => e.currentTarget.classList.toggle('is-on'));
    $('#sw-wechat').addEventListener('click', (e) => e.currentTarget.classList.toggle('is-on'));
    $('#sw-alipay').addEventListener('click', (e) => e.currentTarget.classList.toggle('is-on'));
    $('#sw-audit').addEventListener('click', (e) => e.currentTarget.classList.toggle('is-on'));
    $('#sw-notice').addEventListener('click', (e) => e.currentTarget.classList.toggle('is-on'));
    $('#btn-recharge-save').addEventListener('click', () => {
      const c = cfg();
      c.recharge.enabled = swGet($('#sw-recharge'));
      c.recharge.methods.forEach((m) => {
        if (m.id === 'wechat') m.enabled = swGet($('#sw-wechat'));
        if (m.id === 'alipay') m.enabled = swGet($('#sw-alipay'));
      });
      c.recharge.customMin = Math.max(1, Number($('#rc-min').value) || 1);
      c.recharge.customMax = Math.max(c.recharge.customMin, Number($('#rc-max').value) || 5000);
      c.recharge.qrExpireSec = Math.max(30, Number($('#rc-expire').value) || 180);
      GLAD.saveConfig(c);
      renderPricing(); UI.ok('充值设置已保存');
    });
    $('#btn-plan-add').addEventListener('click', () => {
      const c = cfg();
      c.recharge.plans.push({ id: 'p' + Date.now().toString(36), label: '新套餐', price: 10, credits: 100, bonus: 0 });
      GLAD.saveConfig(c);
      renderPricing(); UI.ok('已新增套餐，记得改价格后保存');
    });

    // 作品库
    $$('#ad-asset-filter button').forEach((b) => b.addEventListener('click', () => {
      S.assetFilter = b.dataset.f; renderAdAssets();
    }));
    $('#ad-asset-search').addEventListener('input', (e) => {
      S.assetSearch = e.target.value.trim(); renderAdAssets();
    });

    // 审核
    $('#btn-audit-save').addEventListener('click', () => {
      const c = cfg();
      c.audit.enabled = swGet($('#sw-audit'));
      c.audit.blockedWords = $('#au-words').value.split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean);
      c.audit.maxPromptLen = Math.max(100, Number($('#au-maxlen').value) || 2000);
      GLAD.saveConfig(c);
      UI.ok('审核设置已保存');
    });

    // 站点
    $('#btn-site-save').addEventListener('click', () => {
      const c = cfg();
      c.site.name = $('#st-name').value.trim() || c.site.name;
      c.site.tagline = $('#st-tagline').value.trim();
      c.site.slogan = $('#st-slogan').value.trim();
      c.site.subtitle = $('#st-subtitle').value.trim();
      c.site.footer = $('#st-footer').value.trim();
      c.site.icp = $('#st-icp').value.trim();
      c.site.notice = $('#st-notice').value.trim();
      c.site.showNotice = swGet($('#sw-notice'));
      GLAD.saveConfig(c);
      chrome();
      UI.ok('站点设置已保存，客户端刷新后生效');
    });

    // 系统
    $('#btn-export-all').addEventListener('click', () => {
      download(GLAD.exportAll(), 'glad-backup-' + GLAD.fmtDay(Date.now()) + '.json');
      UI.ok('已导出备份');
    });
    $('#btn-import-all').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const fr = new FileReader();
      fr.onload = async () => {
        let data;
        try { data = JSON.parse(fr.result); } catch (err) { return UI.err('文件不是有效 JSON'); }
        const yes = await UI.confirm({
          title: '导入备份？', okText: '覆盖导入', danger: true,
          html: '当前所有数据（用户、作品、订单、账号池、配置）将被备份内容<b>覆盖</b>。<br>建议先导出一份当前的再继续。',
        });
        if (!yes) return;
        const r = GLAD.importAll(data);
        if (!r.ok) return UI.err(r.msg);
        UI.ok('导入成功，正在重载…');
        setTimeout(() => location.reload(), 700);
      };
      fr.readAsText(f);
      e.target.value = '';
    });
    $$('[data-wipe]').forEach((b) => b.addEventListener('click', async () => {
      const what = b.dataset.wipe;
      const names = { jobs: '所有作品记录', orders: '所有订单', logs: '所有日志', all: '除管理员外的全部数据' };
      const yes = await UI.confirm({
        title: '确认清空' + names[what] + '？', danger: true, okText: '确认清空',
        html: '此操作<b>不可恢复</b>。' + (what === 'all' ? '<br>清空后你会被登出，需要重新用 admin 登录。' : ''),
      });
      if (!yes) return;
      GLAD.wipe(what);
      if (what === 'all') { location.replace('auth.html'); return; }
      render(); UI.ok('已清空');
    }));
    $$('#log-level button').forEach((b) => b.addEventListener('click', () => {
      S.logLevel = b.dataset.l; renderSystem();
    }));
    $('#btn-log-clear').addEventListener('click', async () => {
      const yes = await UI.confirm({ title: '清空全部日志？', okText: '清空', danger: true });
      if (!yes) return;
      GLAD.clearLogs(); renderSystem(); UI.ok('日志已清空');
    });
    $('#btn-log-export').addEventListener('click', () => {
      const logs = GLAD.listLogs(S.logLevel);
      download(logs.map((l) => '[' + GLAD.fmtDate(l.at) + '] ' + l.level + ' ' + l.msg).join('\n'),
        'glad-logs-' + GLAD.fmtDay(Date.now()) + '.txt', 'text/plain');
      UI.ok('已导出日志');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
