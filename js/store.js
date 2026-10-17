/* ============================================================
   GLAD AI · 数据层（Mock 后端）
   ------------------------------------------------------------
   ⭐ 这个文件是「假后端」：用 localStorage 模拟服务器。
      换真后端时，只需要把下面 GLAD.api 里的每个方法
      改成 fetch('/api/...')，页面代码一行都不用动。

   真实后端对接目标（即梦聚合 API，本机 jimeng-portable）：
     POST http://localhost:8001/v1/images/generations
     POST http://localhost:8001/v1/videos/generations
     GET  http://localhost:8001/v1/models
     POST http://localhost:8001/token/points
     Header: Authorization: Bearer <sessionid,sessionid,...>
   ============================================================ */

const GLAD = (function () {
  'use strict';

  const K = {
    users:   'glad.users',
    session: 'glad.session',
    config:  'glad.config',
    jobs:    'glad.jobs',
    orders:  'glad.orders',
    tokens:  'glad.tokens',
    logs:    'glad.logs',
    resets:  'glad.resets',
    seeded:  'glad.seeded.v1',
  };

  /* ---------- 存储助手 ---------- */
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('[GLAD] 读取失败', key, e);
      return fallback;
    }
  }
  function write(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      console.warn('[GLAD] 写入失败（可能超出配额）', key, e);
      return false;
    }
  }
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) +
           Math.random().toString(36).slice(2, 8);
  }

  /* 演示用密码摘要。⚠️ 真后端必须换成 bcrypt/argon2 服务端校验。 */
  function hash(pw) {
    let h1 = 0x811c9dc5, h2 = 0x1000193;
    const s = 'glad::' + pw;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = (h1 ^ c) >>> 0; h1 = (h1 * 16777619) >>> 0;
      h2 = (h2 + c * (i + 7)) >>> 0; h2 = (h2 ^ (h2 << 5)) >>> 0;
    }
    return (h1.toString(16) + h2.toString(16)).padStart(16, '0');
  }

  const now = () => Date.now();
  function fmtDate(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
           ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function fmtDay(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ============================================================
     一、默认配置（管理端可以全部改掉）
     ============================================================ */
  const IMAGE_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'];
  const VIDEO_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];

  function defaultImageModels() {
    return [
      { id: 'jimeng-image-5.0-lite', name: '即梦 5.0 Lite', badge: '最新',
        desc: 'Seedream 5.0 Lite · 出图最快、光影最稳',
        enabled: true, resolutions: ['2k', '4k'], defaultResolution: '2k',
        cost: { '2k': 6, '4k': 14 }, upstream: { '2k': 3, '4k': 1 } },

      { id: 'jimeng-image-4.7', name: '即梦 4.7', badge: '',
        desc: 'Seedream 4.7 · 细节丰富、擅长写实',
        enabled: true, resolutions: ['2k', '4k'], defaultResolution: '2k',
        cost: { '2k': 8, '4k': 16 }, upstream: { '2k': 4, '4k': 1 } },

      { id: 'jimeng-image-4.6', name: '即梦 4.6', badge: '',
        desc: 'Seedream 4.6 · 色彩通透、风格化强',
        enabled: true, resolutions: ['2k', '4k'], defaultResolution: '2k',
        cost: { '2k': 8, '4k': 16 }, upstream: { '2k': 4, '4k': 1 } },

      { id: 'jimeng-image-4.5', name: '即梦 4.5', badge: '',
        desc: 'Seedream 4.5 · 人像质感优秀',
        enabled: true, resolutions: ['2k', '4k'], defaultResolution: '2k',
        cost: { '2k': 8, '4k': 16 }, upstream: { '2k': 4, '4k': 1 } },

      { id: 'jimeng-image-4.1', name: '即梦 4.1', badge: '',
        desc: 'Seedream 4.1 · 构图稳定、适合商业图',
        enabled: true, resolutions: ['2k', '4k'], defaultResolution: '2k',
        cost: { '2k': 7, '4k': 15 }, upstream: { '2k': 4, '4k': 1 } },

      { id: 'jimeng-image-4.0', name: '即梦 4.0', badge: '',
        desc: 'Seedream 4.0 · 性价比之选',
        enabled: true, resolutions: ['2k', '4k'], defaultResolution: '2k',
        cost: { '2k': 6, '4k': 13 }, upstream: { '2k': 4, '4k': 1 } },

      { id: 'jimeng-image-3.1', name: '即梦 3.1', badge: '便宜',
        desc: 'Seedream 3.1 · 国风插画友好',
        enabled: true, resolutions: ['1k'], defaultResolution: '1k',
        cost: { '1k': 3 }, upstream: { '1k': 1 } },

      { id: 'jimeng-image-3.0', name: '即梦 3.0', badge: '',
        desc: 'Seedream 3.0 · 经典轻量模型',
        enabled: true, resolutions: ['1k'], defaultResolution: '1k',
        cost: { '1k': 3 }, upstream: { '1k': 1 } },

      { id: 'jimeng-image-2.0-pro', name: '即梦 2.0 Pro', badge: '',
        desc: 'Seedream 2.0 Pro · 1K 高清',
        enabled: true, resolutions: ['1k'], defaultResolution: '1k',
        cost: { '1k': 4 }, upstream: { '1k': 1 } },
    ];
  }

  function defaultVideoModels() {
    return [
      { id: 'jimeng-video-seedance-2.0-mini', name: 'Seedance 2.0 Mini', badge: '推荐',
        desc: '出片快、动作自然，日常首选',
        enabled: true, resolutions: ['720p'], defaultResolution: '720p',
        durations: [5, 10],
        cost: { '720p': { 5: 24, 10: 46 } } },

      { id: 'jimeng-video-seedance-2.0-fast', name: 'Seedance 2.0 Fast', badge: 'VIP',
        desc: 'VIP 加速通道，指令跟随更准',
        enabled: true, resolutions: ['720p'], defaultResolution: '720p',
        durations: [5, 10],
        cost: { '720p': { 5: 30, 10: 58 } } },

      { id: 'jimeng-video-seedance-2.0-pro', name: 'Seedance 2.0 Pro', badge: '画质最好',
        desc: '最高 4K 输出，电影级质感',
        enabled: true, resolutions: ['720p', '1080p', '4k'], defaultResolution: '720p',
        durations: [5, 10],
        cost: { '720p': { 5: 40, 10: 78 }, '1080p': { 5: 60, 10: 118 }, '4k': { 5: 160, 10: 310 } } },

      { id: 'jimeng-video-seedance-1.5-pro', name: 'Seedance 1.5 Pro', badge: '',
        desc: '上一代旗舰，运镜稳',
        enabled: true, resolutions: ['720p'], defaultResolution: '720p',
        durations: [5, 10],
        cost: { '720p': { 5: 26, 10: 50 } } },

      { id: 'jimeng-video-3.0-pro', name: '即梦视频 3.0 Pro', badge: '',
        desc: '1080p 原生输出，画面干净',
        enabled: true, resolutions: ['1080p'], defaultResolution: '1080p',
        durations: [5, 10],
        cost: { '1080p': { 5: 45, 10: 88 } } },

      { id: 'jimeng-video-3.0', name: '即梦视频 3.0', badge: '',
        desc: '均衡款，风格化动画出色',
        enabled: true, resolutions: ['720p'], defaultResolution: '720p',
        durations: [5, 10],
        cost: { '720p': { 5: 22, 10: 42 } } },

      { id: 'jimeng-video-3.0-fast', name: '即梦视频 3.0 Fast', badge: '',
        desc: '快速出片，支持 1080p',
        enabled: true, resolutions: ['720p', '1080p'], defaultResolution: '720p',
        durations: [5, 10],
        cost: { '720p': { 5: 20, 10: 38 }, '1080p': { 5: 34, 10: 66 } } },

      { id: 'jimeng-video-s2.0', name: '即梦视频 S2.0', badge: '仅 5 秒',
        desc: '轻量款，固定 5 秒时长',
        enabled: true, resolutions: ['720p'], defaultResolution: '720p',
        durations: [5],
        cost: { '720p': { 5: 16 } } },

      { id: 'jimeng-video-2.0-pro', name: '即梦视频 2.0 Pro', badge: '仅 5 秒',
        desc: '老款稳定模型，固定 5 秒',
        enabled: true, resolutions: ['720p'], defaultResolution: '720p',
        durations: [5],
        cost: { '720p': { 5: 18 } } },
    ];
  }

  function defaultPlans() {
    return [
      { id: 'p6',   price: 6,   credits: 60,   bonus: 0,    label: '体验包' },
      { id: 'p30',  price: 30,  credits: 300,  bonus: 20,   label: '常用包' },
      { id: 'p68',  price: 68,  credits: 680,  bonus: 80,   label: '进阶包' },
      { id: 'p128', price: 128, credits: 1280, bonus: 220,  label: '专业包' },
      { id: 'p328', price: 328, credits: 3280, bonus: 720,  label: '工作室包' },
      { id: 'p648', price: 648, credits: 6480, bonus: 1720, label: '旗舰包' },
    ];
  }

  function defaultTokens() {
    // 管理端「账号池」：把多个即梦账号的额度聚合到本站
    const t = (name, sid, pts, note) => ({
      id: uid('tk'), name, session: sid, note: note || '',
      points: pts, live: true, enabled: true, addedAt: now(),
    });
    return [
      t('主账号 A', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', 4128, '日常主力'),
      t('主账号 B', 'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3', 2860, '备用'),
      t('小号 C',   '9a8b7c6d5e4f9a8b7c6d5e4f9a8b7c6d', 66,   '每日赠送额度'),
      t('小号 D',   '11223344556677889900112233445566', 0,    '已耗尽'),
    ];
  }

  function defaultConfig() {
    return {
      site: {
        name: 'Glad',
        tagline: 'AI 影像创作平台',
        slogan: '一句话，生成电影级画面',
        subtitle: '接入多账号额度池，图片与视频一次到位。',
        notice: '🎉 新用户注册即送体验额度活动筹备中，当前积分为 0 属正常现象。',
        showNotice: true,
        footer: 'Glad AI · 演示站点',
        icp: '',
      },
      api: {
        // 真实聚合服务地址（本机 jimeng-portable 默认 8001）
        baseUrl: 'http://localhost:8001',
        mode: 'mock',                 // mock | real
        timeout: 600,
        retry: 2,
        usePool: true,                // 从账号池随机取号（对应服务端 _.sample）
        fallbackDowngrade: true,      // 积分不足自动降级（4k→2k→1k / 10s→5s）
        imageEndpoint: '/v1/images/generations',
        videoEndpoint: '/v1/videos/generations',
        modelsEndpoint: '/v1/models',
        pointsEndpoint: '/token/points',
        authHeader: 'Bearer ',
      },
      image: {
        ratios: IMAGE_RATIOS,
        defaultRatio: '1:1',
        // 仅作鼠标悬停提示用；按钮上显示的是规范比例数字本身
        ratioLabels: {
          '1:1': '正方形', '4:3': '标准横', '3:4': '标准竖', '16:9': '宽屏',
          '9:16': '竖屏', '3:2': '相机横', '2:3': '相机竖', '21:9': '电影宽银幕',
        },
        sampleStrength: 0.5,
        maxCount: 1,                  // 上游每请求固定 1 张
        negativePrompt: true,
      },
      video: {
        ratios: VIDEO_RATIOS,
        defaultRatio: '16:9',
        ratioLabels: {
          '16:9': '横屏', '9:16': '竖屏', '1:1': '正方形',
          '4:3': '标准横', '3:4': '标准竖', '21:9': '电影宽银幕',
        },
        defaultDuration: 10,
        durations: [5, 10],
        maxRefImages: 2,              // [0] 首帧  [1] 尾帧
      },
      credit: {
        registerGift: 0,              // ⭐ 默认 0（按需求）
        dailyGift: 0,
        signInGift: 0,
        allowNegative: false,
      },
      recharge: {
        currency: '¥',
        enabled: true,
        methods: [
          { id: 'wechat', name: '微信支付', enabled: true },
          { id: 'alipay', name: '支付宝',   enabled: true },
        ],
        plans: defaultPlans(),
        customMin: 1,
        customMax: 5000,
        qrExpireSec: 180,
      },
      imageModels: defaultImageModels(),
      videoModels: defaultVideoModels(),
      audit: {
        enabled: true,
        blockedWords: ['政治敏感词示例', '违禁示例词'],
        maxPromptLen: 2000,
      },
      updatedAt: now(),
    };
  }

  /* ============================================================
     二、初始化
     ============================================================ */
  function config() {
    let c = read(K.config, null);
    if (!c) { c = defaultConfig(); write(K.config, c); }
    return c;
  }
  function saveConfig(c) {
    c.updatedAt = now();
    write(K.config, c);
    return c;
  }
  function resetConfig() {
    const c = defaultConfig();
    write(K.config, c);
    return c;
  }

  function users() { return read(K.users, []); }
  function saveUsers(u) { return write(K.users, u); }
  function jobs() { return read(K.jobs, []); }
  function saveJobs(j) { return write(K.jobs, j); }
  function orders() { return read(K.orders, []); }
  function saveOrders(o) { return write(K.orders, o); }
  function tokens() {
    let t = read(K.tokens, null);
    if (!t) { t = defaultTokens(); write(K.tokens, t); }
    return t;
  }
  function saveTokens(t) { return write(K.tokens, t); }
  function logs() { return read(K.logs, []); }
  function pushLog(level, msg, extra) {
    const l = logs();
    l.unshift({ id: uid('log'), level, msg, at: now(), ...(extra || {}) });
    write(K.logs, l.slice(0, 600));
  }

  /**
   * 首次打开时铺演示数据。
   * admin / demo 两个账号，README 与说明.txt 里都会写明。
   */
  function seed(force) {
    if (!force && read(K.seeded, false)) return;

    const cfg = config();
    const t = now();
    const day = 86400000;

    const admin = {
      id: uid('u'), username: 'admin', email: 'admin@glad.ai', phone: '13800000000',
      pass: hash('admin888'), role: 'admin', credits: 99999, status: 'active',
      note: '平台管理员', createdAt: t - day * 30, lastLogin: t,
    };
    const demo = {
      id: uid('u'), username: 'demo', email: 'demo@glad.ai', phone: '13900000001',
      pass: hash('demo123'), role: 'user', credits: 0, status: 'active',
      note: '演示用户（积分默认 0）', createdAt: t - day * 6, lastLogin: t - day,
    };

    const extra = [
      { username: '张三', email: 'zhangsan@qq.com',     phone: '13712345678', credits: 320,  role: 'user', status: 'active',   days: 12 },
      { username: '李四', email: 'lisi@163.com',        phone: '13887654321', credits: 1240, role: 'user', status: 'active',   days: 9 },
      { username: '王五', email: 'wangwu@gmail.com',    phone: '15901234567', credits: 0,    role: 'user', status: 'banned',   days: 7 },
      { username: '小涵', email: 'xiaohan@glad.ai',     phone: '18600001111', credits: 640,  role: 'user', status: 'active',   days: 4 },
      { username: '陈设计', email: 'chen@studio.cn',    phone: '13500002222', credits: 3280, role: 'user', status: 'active',   days: 2 },
      { username: '刘剪辑', email: 'liu@video.cn',      phone: '13300003333', credits: 60,   role: 'user', status: 'active',   days: 1 },
    ].map((x, i) => ({
      id: uid('u'), username: x.username, email: x.email, phone: x.phone,
      pass: hash('123456'), role: x.role, credits: x.credits, status: x.status,
      note: '', createdAt: t - day * x.days, lastLogin: t - 3600000 * (i + 1),
    }));

    saveUsers([admin, demo, ...extra]);

    // 演示订单
    const pays = ['wechat', 'alipay'];
    const os = [];
    for (let i = 0; i < 14; i++) {
      const u = [admin, demo, ...extra][i % (extra.length + 2)];
      const plan = cfg.recharge.plans[i % cfg.recharge.plans.length];
      const paid = i % 5 !== 0;
      os.push({
        id: 'GD' + String(t - day * (14 - i)).slice(-9) + String(100 + i),
        userId: u.id, username: u.username,
        planId: plan.id, price: plan.price,
        credits: plan.credits + plan.bonus,
        method: pays[i % 2],
        status: paid ? 'paid' : 'pending',
        createdAt: t - day * (14 - i) + 3600000 * (i % 9),
        paidAt: paid ? t - day * (14 - i) + 3600000 * (i % 9) + 95000 : null,
      });
    }
    saveOrders(os);

    // 演示订单对应的积分已经加过（演示账号除外，保持 0）
    // 演示作品
    const js = [];
    const prompts = [
      { p: '夜色中的赛博朋克城市街道，霓虹倒影在积水里，电影质感，超广角', t: 'video' },
      { p: '雪山之巅的孤独旅人，逆光剪影，清晨薄雾，胶片颗粒', t: 'image' },
      { p: '一片漂浮在云海上的鲸鱼，超现实主义，柔和的粉紫色天空', t: 'image' },
      { p: '老式咖啡馆内景，午后阳光穿过百叶窗，暖色调，浅景深', t: 'image' },
      { p: '机械蜂鸟悬停在一朵金属花前，微距，精密机械结构', t: 'video' },
      { p: '宇航员站在红色沙漠上看双日落，史诗感，广袤', t: 'video' },
      { p: '水墨风格的龙在云中翻腾，留白构图，东方美学', t: 'image' },
      { p: '雨天的东京小巷，自动贩卖机的光，写实摄影', t: 'image' },
    ];
    prompts.forEach((x, i) => {
      const isVideo = x.t === 'video';
      const model = isVideo
        ? cfg.videoModels[i % cfg.videoModels.length]
        : cfg.imageModels[i % cfg.imageModels.length];
      js.push({
        id: uid('job'),
        userId: demo.id,
        type: x.t,
        model: model.id,
        modelName: model.name,
        prompt: x.p,
        negativePrompt: '',
        ratio: isVideo ? '16:9' : '1:1',
        resolution: isVideo ? '720p' : '2k',
        duration: isVideo ? 10 : null,
        count: 1,
        status: 'done',
        progress: 100,
        cost: isVideo ? 46 : 6,
        urls: [demoPoster(x.p, x.t, i)],
        createdAt: t - 3600000 * (i * 3 + 2),
        finishedAt: t - 3600000 * (i * 3 + 2) + 46000,
        demo: true,
      });
    });
    saveJobs(js);

    write(K.logs, [
      { id: uid('log'), level: 'INFO',  msg: '账号池已加载 4 个即梦账号', at: t - 60000 },
      { id: uid('log'), level: 'INFO',  msg: '聚合额度：' + tokens().reduce((a, b) => a + b.points, 0) + ' 积分', at: t - 58000 },
      { id: uid('log'), level: 'WARN',  msg: '账号「小号 D」额度为 0，已自动跳过', at: t - 40000 },
      { id: uid('log'), level: 'INFO',  msg: '模型目录同步完成：图片 9 / 视频 9', at: t - 20000 },
      { id: uid('log'), level: 'ERROR', msg: '账号「小号 C」查询额度失败：token 已失效（演示数据）', at: t - 9000 },
    ]);

    write(K.seeded, true);
  }

  /* 生成一张「看起来像生成结果」的占位图（不用任何外链/依赖） */
  function demoPoster(prompt, type, seed) {
    const W = 720, H = type === 'video' ? 405 : 720;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const s = (seed || 0) * 977 + 13;
    const rnd = (n) => Math.abs(Math.sin(s * 12.9898 + n * 78.233) * 43758.5453) % 1;
    const hue = Math.floor(rnd(1) * 360);
    const grd = g.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, `hsl(${hue}, 62%, 16%)`);
    grd.addColorStop(.5, `hsl(${(hue + 40) % 360}, 58%, 26%)`);
    grd.addColorStop(1, `hsl(${(hue + 90) % 360}, 60%, 12%)`);
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    // 光斑
    for (let i = 0; i < 5; i++) {
      const x = rnd(i + 2) * W, y = rnd(i + 9) * H, r = 60 + rnd(i + 20) * 190;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `hsla(${(hue + i * 33) % 360}, 90%, 68%, .34)`);
      rg.addColorStop(1, 'transparent');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    // 山脊/结构线
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      const base = H * (.5 + i * .12);
      g.moveTo(0, base);
      for (let x = 0; x <= W; x += 24) {
        g.lineTo(x, base + Math.sin((x / W) * 6 + i * 1.7 + s) * (16 + i * 7));
      }
      g.stroke();
    }
    // 颗粒
    const img = g.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - .5) * 17;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    // 角标
    g.fillStyle = 'rgba(0,0,0,.42)';
    g.fillRect(0, H - 46, W, 46);
    g.fillStyle = 'rgba(255,255,255,.9)';
    g.font = '600 15px system-ui, sans-serif';
    const txt = (prompt || '').slice(0, 30);
    g.fillText(txt, 14, H - 18);
    return c.toDataURL('image/jpeg', 0.72);
  }

  /* ============================================================
     三、鉴权
     ============================================================ */
  function currentUser() {
    const sid = read(K.session, null);
    if (!sid) return null;
    const u = users().find((x) => x.id === sid);
    if (!u || u.status === 'banned') return null;
    return u;
  }
  function publicUser(u) {
    if (!u) return null;
    const { pass, ...rest } = u;
    return rest;
  }

  function validatePassword(pw) {
    if (!pw || pw.length < 6) return '密码长度至少 6 位';
    if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return '密码需同时包含字母和数字';
    return null;
  }
  function validateUsername(name) {
    if (!name) return '请输入用户名';
    if (name.length < 2 || name.length > 20) return '用户名需 2–20 个字符';
    if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]+$/.test(name)) return '用户名只能包含中文、字母、数字、下划线';
    return null;
  }
  function validateEmail(mail) {
    if (!mail) return '请输入邮箱';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) return '邮箱格式不正确';
    return null;
  }
  function validatePhone(p) {
    if (!p) return null; // 选填
    if (!/^1[3-9]\d{9}$/.test(p)) return '手机号格式不正确';
    return null;
  }

  async function register({ username, email, phone, password, password2 }) {
    await wait(560);
    username = (username || '').trim();
    email = (email || '').trim().toLowerCase();
    phone = (phone || '').trim();

    let err = validateUsername(username) || validateEmail(email) ||
              validatePhone(phone) || validatePassword(password);
    if (err) return { ok: false, msg: err };
    if (password !== password2) return { ok: false, msg: '两次输入的密码不一致' };

    const us = users();
    if (us.some((u) => u.username.toLowerCase() === username.toLowerCase()))
      return { ok: false, msg: '该用户名已被注册' };
    if (us.some((u) => u.email === email))
      return { ok: false, msg: '该邮箱已被注册' };

    const cfg = config();
    const u = {
      id: uid('u'), username, email, phone,
      pass: hash(password), role: 'user',
      credits: cfg.credit.registerGift || 0,
      status: 'active', note: '',
      createdAt: now(), lastLogin: now(),
    };
    us.push(u);
    saveUsers(us);
    write(K.session, u.id);
    pushLog('INFO', `新用户注册：${username}`, { user: username });
    return { ok: true, user: publicUser(u) };
  }

  async function login({ account, password, remember }) {
    await wait(500);
    account = (account || '').trim();
    if (!account || !password) return { ok: false, msg: '请填写账号和密码' };

    const us = users();
    const u = us.find((x) =>
      x.username.toLowerCase() === account.toLowerCase() ||
      (x.email && x.email.toLowerCase() === account.toLowerCase()) ||
      (x.phone && x.phone === account));
    if (!u) return { ok: false, msg: '账号或密码错误' };
    if (u.pass !== hash(password)) return { ok: false, msg: '账号或密码错误' };
    if (u.status === 'banned') return { ok: false, msg: '该账号已被封禁，请联系管理员' };

    u.lastLogin = now();
    saveUsers(us);
    write(K.session, u.id);
    pushLog('INFO', `用户登录：${u.username}`, { user: u.username });
    return { ok: true, user: publicUser(u), remember: !!remember };
  }

  function logout() {
    const u = currentUser();
    if (u) pushLog('INFO', `用户登出：${u.username}`);
    localStorage.removeItem(K.session);
    return { ok: true };
  }

  /* 忘记密码：演示版直接把验证码显示在界面上 */
  async function sendResetCode(account) {
    await wait(620);
    account = (account || '').trim();
    if (!account) return { ok: false, msg: '请输入邮箱或手机号' };
    const u = users().find((x) =>
      (x.email && x.email.toLowerCase() === account.toLowerCase()) || x.phone === account);
    if (!u) return { ok: false, msg: '该账号不存在' };

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const rs = read(K.resets, []);
    rs.unshift({ account, code, at: now(), used: false });
    write(K.resets, rs.slice(0, 40));
    pushLog('INFO', `发送找回验证码：${account}`);
    return {
      ok: true,
      code,                       // ⚠️ 演示用：真后端绝不能把验证码返回给前端
      demo: true,
      target: u.email || u.phone,
    };
  }

  async function resetPassword({ account, code, password, password2 }) {
    await wait(560);
    account = (account || '').trim();
    const err = validatePassword(password);
    if (err) return { ok: false, msg: err };
    if (password !== password2) return { ok: false, msg: '两次输入的密码不一致' };

    const rs = read(K.resets, []);
    const rec = rs.find((r) => r.account === account && r.code === code && !r.used);
    if (!rec) return { ok: false, msg: '验证码不正确' };
    if (now() - rec.at > 10 * 60 * 1000) return { ok: false, msg: '验证码已过期，请重新获取' };

    const us = users();
    const u = us.find((x) =>
      (x.email && x.email.toLowerCase() === account.toLowerCase()) || x.phone === account);
    if (!u) return { ok: false, msg: '该账号不存在' };

    u.pass = hash(password);
    saveUsers(us);
    rec.used = true;
    write(K.resets, rs);
    pushLog('INFO', `密码已重置：${u.username}`, { user: u.username });
    return { ok: true };
  }

  async function changePassword({ oldPassword, password, password2 }) {
    await wait(500);
    const u = currentUser();
    if (!u) return { ok: false, msg: '请先登录' };
    const us = users();
    const me = us.find((x) => x.id === u.id);
    if (me.pass !== hash(oldPassword)) return { ok: false, msg: '原密码不正确' };
    const err = validatePassword(password);
    if (err) return { ok: false, msg: err };
    if (password !== password2) return { ok: false, msg: '两次输入的密码不一致' };
    me.pass = hash(password);
    saveUsers(us);
    pushLog('INFO', `修改密码：${me.username}`, { user: me.username });
    return { ok: true };
  }

  async function updateProfile({ username, email, phone }) {
    await wait(420);
    const u = currentUser();
    if (!u) return { ok: false, msg: '请先登录' };
    username = (username || '').trim();
    email = (email || '').trim().toLowerCase();
    phone = (phone || '').trim();
    let err = validateUsername(username) || validateEmail(email) || validatePhone(phone);
    if (err) return { ok: false, msg: err };
    const us = users();
    if (us.some((x) => x.id !== u.id && x.username.toLowerCase() === username.toLowerCase()))
      return { ok: false, msg: '该用户名已被占用' };
    if (us.some((x) => x.id !== u.id && x.email === email))
      return { ok: false, msg: '该邮箱已被占用' };
    const me = us.find((x) => x.id === u.id);
    me.username = username; me.email = email; me.phone = phone;
    saveUsers(us);
    return { ok: true, user: publicUser(me) };
  }

  /* ============================================================
     四、积分 · 价格 · 额度池
     ============================================================ */
  function priceOf(type, modelId, resolution, duration) {
    const cfg = config();
    const list = type === 'video' ? cfg.videoModels : cfg.imageModels;
    const m = list.find((x) => x.id === modelId);
    if (!m) return 0;
    if (type === 'video') {
      const r = m.cost[resolution];
      if (!r) return 0;
      return r[duration] != null ? r[duration] : (r[Object.keys(r)[0]] || 0);
    }
    return m.cost[resolution] || 0;
  }

  /** 账号池聚合额度：本站可用的「上游总积分」 */
  function poolCredits() {
    const t = tokens();
    const live = t.filter((x) => x.enabled && x.live);
    return {
      total: live.reduce((a, b) => a + (b.points || 0), 0),
      accounts: t.length,
      usable: live.filter((x) => (x.points || 0) > 0).length,
      dead: t.filter((x) => !x.live).length,
      disabled: t.filter((x) => !x.enabled).length,
    };
  }

  /** 发放/扣减积分（会产生流水） */
  function addCredits(userId, amount, reason, meta) {
    const us = users();
    const u = us.find((x) => x.id === userId);
    if (!u) return { ok: false, msg: '用户不存在' };
    const before = u.credits || 0;
    u.credits = before + amount;
    if (u.credits < 0 && !config().credit.allowNegative) u.credits = 0;
    saveUsers(us);
    pushLog('INFO', `${amount >= 0 ? '增加' : '扣减'}积分 ${Math.abs(amount)}：${u.username}（${reason}）`,
      { user: u.username, amount });
    return { ok: true, before, after: u.credits };
  }

  /* ============================================================
     五、生成任务（假生成，但流程与真接口一致）
     ============================================================ */
  const running = new Map();   // jobId -> timer

  async function createJob(input) {
    const u = currentUser();
    if (!u) return { ok: false, msg: '请先登录' };
    const cfg = config();

    const type = input.type === 'video' ? 'video' : 'image';
    const prompt = (input.prompt || '').trim();
    if (!prompt) return { ok: false, msg: '请输入提示词' };
    if (prompt.length > cfg.audit.maxPromptLen)
      return { ok: false, msg: `提示词过长（上限 ${cfg.audit.maxPromptLen} 字）` };

    if (cfg.audit.enabled) {
      const hit = (cfg.audit.blockedWords || []).find((w) => w && prompt.includes(w));
      if (hit) return { ok: false, msg: `提示词包含受限内容：「${hit}」`, code: -2006 };
    }

    const list = type === 'video' ? cfg.videoModels : cfg.imageModels;
    const model = list.find((m) => m.id === input.model) ||
                  list.find((m) => m.enabled) || list[0];
    if (!model) return { ok: false, msg: '没有可用的模型，请联系管理员' };
    if (!model.enabled) return { ok: false, msg: `模型「${model.name}」已停用` };

    const resolution = model.resolutions.includes(input.resolution)
      ? input.resolution : model.defaultResolution;
    const ratioPool = type === 'video' ? cfg.video.ratios : cfg.image.ratios;
    const ratio = ratioPool.includes(input.ratio)
      ? input.ratio : (type === 'video' ? cfg.video.defaultRatio : cfg.image.defaultRatio);

    let duration = null;
    if (type === 'video') {
      const ds = model.durations && model.durations.length ? model.durations : cfg.video.durations;
      duration = ds.includes(Number(input.duration)) ? Number(input.duration) : ds[ds.length - 1];
    }

    const cost = priceOf(type, model.id, resolution, duration);
    const me = users().find((x) => x.id === u.id);
    if (!cfg.credit.allowNegative && (me.credits || 0) < cost) {
      return {
        ok: false,
        msg: `积分不足：本次需 ${cost}，当前 ${me.credits || 0}`,
        code: -2009,
        need: cost,
        have: me.credits || 0,
      };
    }

    // 上游账号池是否还有额度（演示）
    const pool = poolCredits();
    if (cfg.api.mode === 'mock' && pool.total <= 0) {
      return { ok: false, msg: '上游额度池已耗尽，请管理员补充账号', code: -2009 };
    }

    // 扣费
    if (cost > 0) addCredits(me.id, -cost, `${type === 'video' ? '视频' : '图片'}生成 · ${model.name}`);

    const job = {
      id: uid('job'),
      userId: me.id,
      type, model: model.id, modelName: model.name,
      prompt,
      negativePrompt: (input.negativePrompt || '').trim(),
      ratio, resolution, duration,
      count: 1,
      refImages: (input.refImages || []).slice(0, type === 'video' ? 2 : 1),
      sampleStrength: input.sampleStrength != null ? input.sampleStrength : cfg.image.sampleStrength,
      status: 'running',
      progress: 0,
      stage: '排队中',
      cost,
      urls: [],
      createdAt: now(),
      finishedAt: null,
      demo: cfg.api.mode === 'mock',
    };

    const js = jobs();
    js.unshift(job);
    saveJobs(js);
    pushLog('INFO', `提交任务 ${job.id.slice(-6)} · ${type} · ${model.name} · ${cost} 积分`,
      { user: me.username });

    if (cfg.api.mode === 'real') {
      runReal(job).catch((e) => failJob(job.id, e.message));
    } else {
      runMock(job);
    }
    return { ok: true, job, charged: cost, credits: me.credits };
  }

  function patchJob(id, patch) {
    const js = jobs();
    const i = js.findIndex((x) => x.id === id);
    if (i < 0) return null;
    js[i] = { ...js[i], ...patch };
    saveJobs(js);
    return js[i];
  }

  function failJob(id, msg) {
    if (running.has(id)) { clearTimeout(running.get(id)); running.delete(id); }
    const j = patchJob(id, { status: 'failed', progress: 100, stage: '失败', error: msg });
    if (j) pushLog('ERROR', `任务失败 ${id.slice(-6)}：${msg}`);
    return j;
  }

  /* 假生成：进度条走完 → 出图/出片 */
  function runMock(job) {
    const total = job.type === 'video' ? 9000 : 4200;
    const stages = job.type === 'video'
      ? [[0, '排队中'], [12, '解析提示词'], [26, '生成关键帧'], [52, '渲染视频帧'],
         [78, '编码合成'], [93, '上传结果'], [100, '完成']]
      : [[0, '排队中'], [20, '解析提示词'], [45, '扩散采样'], [75, '细节增强'],
         [92, '上传结果'], [100, '完成']];
    const t0 = now();

    const tick = () => {
      const el = now() - t0;
      const pct = Math.min(100, Math.round((el / total) * 100));
      let stage = stages[0][1];
      for (const [p, s] of stages) if (pct >= p) stage = s;
      if (pct >= 100) {
        const seed = Math.abs(hash(job.id + job.prompt).split('').reduce((a, c) => a + c.charCodeAt(0), 0));
        const urls = [demoPoster(job.prompt, job.type, seed)];
        patchJob(job.id, {
          status: 'done', progress: 100, stage: '完成',
          urls, finishedAt: now(),
        });
        running.delete(job.id);
        pushLog('INFO', `任务完成 ${job.id.slice(-6)} · ${job.modelName}`);
        emit('job:done', { id: job.id });
        return;
      }
      patchJob(job.id, { progress: pct, stage });
      emit('job:progress', { id: job.id, progress: pct, stage });
      running.set(job.id, setTimeout(tick, 320));
    };
    running.set(job.id, setTimeout(tick, 320));
  }

  /* 真接口：走聚合服务的 /v1/images|videos/generations */
  async function runReal(job) {
    const cfg = config();
    const base = (cfg.api.baseUrl || '').replace(/\/+$/, '');
    if (!base) throw new Error('未配置 API 地址');
    const ts = tokens().filter((x) => x.enabled && x.live);
    if (!ts.length) throw new Error('账号池没有可用账号');
    const use = cfg.api.usePool ? ts : [ts[0]];
    const auth = use.map((x) => x.session).join(',');

    const url = base + (job.type === 'video' ? cfg.api.videoEndpoint : cfg.api.imageEndpoint);
    const body = job.type === 'video'
      ? { model: job.model, prompt: job.prompt, ratio: job.ratio,
          resolution: job.resolution, duration: job.duration, response_format: 'url' }
      : { model: job.model, prompt: job.prompt, negative_prompt: job.negativePrompt,
          ratio: job.ratio, resolution: job.resolution,
          sample_strength: job.sampleStrength, response_format: 'url' };

    patchJob(job.id, { progress: 8, stage: '请求上游' });
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: cfg.api.authHeader + auth },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (data && data.code && data.code < 0) {
      throw new Error(data.message || ('上游错误 ' + data.code));
    }
    const urls = (data.data || []).map((d) => d.url || d.b64_json).filter(Boolean);
    if (!urls.length) throw new Error('上游没有返回结果');
    patchJob(job.id, { status: 'done', progress: 100, stage: '完成', urls, finishedAt: now() });
    emit('job:done', { id: job.id });
  }

  function myJobs(limit) {
    const u = currentUser();
    if (!u) return [];
    const all = jobs().filter((j) => j.userId === u.id);
    return limit ? all.slice(0, limit) : all;
  }
  function jobById(id) {
    return jobs().find((j) => j.id === id) || null;
  }
  function deleteJob(id) {
    const u = currentUser();
    const j = jobById(id);
    if (!j) return { ok: false, msg: '任务不存在' };
    if (!u || (j.userId !== u.id && u.role !== 'admin')) return { ok: false, msg: '无权删除' };
    if (running.has(id)) { clearTimeout(running.get(id)); running.delete(id); }
    saveJobs(jobs().filter((x) => x.id !== id));
    return { ok: true };
  }
  function clearMyJobs() {
    const u = currentUser();
    if (!u) return { ok: false, msg: '请先登录' };
    jobs().filter((j) => j.userId === u.id).forEach((j) => {
      if (running.has(j.id)) { clearTimeout(running.get(j.id)); running.delete(j.id); }
    });
    saveJobs(jobs().filter((j) => j.userId !== u.id));
    return { ok: true };
  }

  /* ============================================================
     六、充值 / 订单
     ============================================================ */
  async function createOrder({ planId, method, amount }) {
    await wait(420);
    const u = currentUser();
    if (!u) return { ok: false, msg: '请先登录' };
    const cfg = config();
    if (!cfg.recharge.enabled) return { ok: false, msg: '充值通道已关闭' };

    const m = (cfg.recharge.methods || []).find((x) => x.id === method && x.enabled);
    if (!m) return { ok: false, msg: '请选择支付方式' };

    let price, credits;
    if (planId) {
      const p = cfg.recharge.plans.find((x) => x.id === planId);
      if (!p) return { ok: false, msg: '套餐不存在' };
      price = p.price;
      credits = p.credits + (p.bonus || 0);
    } else {
      price = Number(amount);
      if (!isFinite(price) || price <= 0) return { ok: false, msg: '请输入正确的金额' };
      if (price < cfg.recharge.customMin || price > cfg.recharge.customMax)
        return { ok: false, msg: `自定义金额需在 ${cfg.recharge.customMin}–${cfg.recharge.customMax} 之间` };
      credits = Math.round(price * 10);   // 1 元 = 10 积分
    }

    const order = {
      id: 'GD' + String(now()).slice(-9) + String(Math.floor(Math.random() * 900) + 100),
      userId: u.id, username: u.username,
      planId: planId || 'custom', price, credits,
      method, status: 'pending',
      createdAt: now(), paidAt: null,
      expireAt: now() + (cfg.recharge.qrExpireSec || 180) * 1000,
    };
    const os = orders();
    os.unshift(order);
    saveOrders(os);
    pushLog('INFO', `创建订单 ${order.id} · ${m.name} · ¥${price} · ${credits} 积分`,
      { user: u.username });
    return { ok: true, order };
  }

  /** 演示：模拟扫码成功。真后端必须由支付回调触发。 */
  async function payOrderDemo(orderId) {
    await wait(700);
    const os = orders();
    const o = os.find((x) => x.id === orderId);
    if (!o) return { ok: false, msg: '订单不存在' };
    if (o.status === 'paid') return { ok: false, msg: '订单已支付' };
    o.status = 'paid';
    o.paidAt = now();
    saveOrders(os);
    const r = addCredits(o.userId, o.credits, `充值 ¥${o.price}（${o.id}）`);
    pushLog('INFO', `订单已支付 ${o.id} · +${o.credits} 积分`, { user: o.username });
    return { ok: true, order: o, credits: r.after };
  }

  function myOrders() {
    const u = currentUser();
    if (!u) return [];
    return orders().filter((o) => o.userId === u.id);
  }
  function orderById(id) { return orders().find((o) => o.id === id) || null; }

  /* ============================================================
     七、管理端
     ============================================================ */
  function requireAdmin() {
    const u = currentUser();
    if (!u) return { ok: false, msg: '请先登录' };
    if (u.role !== 'admin') return { ok: false, msg: '需要管理员权限' };
    return { ok: true, user: u };
  }

  function adminStats(rangeDays) {
    const days = rangeDays || 14;
    const us = users();
    const js = jobs();
    const os = orders();
    const since = now() - days * 86400000;

    const paid = os.filter((o) => o.status === 'paid');
    const revenue = paid.reduce((a, b) => a + b.price, 0);
    const consumed = js.filter((j) => j.status === 'done').reduce((a, b) => a + (b.cost || 0), 0);

    // 按天趋势
    const trend = [];
    for (let i = days - 1; i >= 0; i--) {
      const d0 = new Date(); d0.setHours(0, 0, 0, 0);
      const start = d0.getTime() - i * 86400000;
      const end = start + 86400000;
      const dayJobs = js.filter((j) => j.createdAt >= start && j.createdAt < end);
      const dayOrders = paid.filter((o) => o.paidAt >= start && o.paidAt < end);
      trend.push({
        day: fmtDay(start).slice(5),
        calls: dayJobs.length,
        image: dayJobs.filter((j) => j.type === 'image').length,
        video: dayJobs.filter((j) => j.type === 'video').length,
        revenue: dayOrders.reduce((a, b) => a + b.price, 0),
        signups: us.filter((u) => u.createdAt >= start && u.createdAt < end).length,
      });
    }

    // 模型用量
    const byModel = {};
    js.forEach((j) => {
      const k = j.modelName || j.model;
      byModel[k] = byModel[k] || { model: k, type: j.type, calls: 0, credits: 0 };
      byModel[k].calls++;
      byModel[k].credits += j.cost || 0;
    });

    return {
      users: us.length,
      activeUsers: us.filter((u) => u.status === 'active').length,
      newUsers: us.filter((u) => u.createdAt >= since).length,
      jobs: js.length,
      doneJobs: js.filter((j) => j.status === 'done').length,
      failedJobs: js.filter((j) => j.status === 'failed').length,
      runningJobs: js.filter((j) => j.status === 'running').length,
      images: js.filter((j) => j.type === 'image').length,
      videos: js.filter((j) => j.type === 'video').length,
      consumed,
      revenue,
      orders: os.length,
      paidOrders: paid.length,
      pendingOrders: os.filter((o) => o.status === 'pending').length,
      userCredits: us.reduce((a, b) => a + (b.credits || 0), 0),
      pool: poolCredits(),
      trend,
      byModel: Object.values(byModel).sort((a, b) => b.calls - a.calls),
    };
  }

  function listUsers(q) {
    let us = users();
    if (q) {
      const s = q.toLowerCase();
      us = us.filter((u) =>
        u.username.toLowerCase().includes(s) ||
        (u.email || '').toLowerCase().includes(s) ||
        (u.phone || '').includes(s));
    }
    return us.sort((a, b) => b.createdAt - a.createdAt);
  }
  function adminUpdateUser(id, patch) {
    const us = users();
    const u = us.find((x) => x.id === id);
    if (!u) return { ok: false, msg: '用户不存在' };
    if (patch.credits != null) {
      const delta = Number(patch.credits) - (u.credits || 0);
      u.credits = Number(patch.credits);
      if (delta) pushLog('WARN', `管理员调整 ${u.username} 积分 ${delta > 0 ? '+' : ''}${delta}`,
        { user: u.username });
    }
    if (patch.status) u.status = patch.status;
    if (patch.note != null) u.note = patch.note;
    if (patch.role) u.role = patch.role;
    if (patch.password) u.pass = hash(patch.password);
    saveUsers(us);
    return { ok: true, user: publicUser(u) };
  }
  function adminDeleteUser(id) {
    const me = currentUser();
    if (me && me.id === id) return { ok: false, msg: '不能删除当前登录账号' };
    const us = users();
    const u = us.find((x) => x.id === id);
    if (!u) return { ok: false, msg: '用户不存在' };
    saveUsers(us.filter((x) => x.id !== id));
    saveJobs(jobs().filter((j) => j.userId !== id));
    pushLog('WARN', `管理员删除用户：${u.username}`);
    return { ok: true };
  }
  function adminCreateUser({ username, email, password, credits, role }) {
    const err = validateUsername(username) || validateEmail(email) || validatePassword(password);
    if (err) return { ok: false, msg: err };
    const us = users();
    if (us.some((x) => x.username.toLowerCase() === username.toLowerCase()))
      return { ok: false, msg: '用户名已存在' };
    if (us.some((x) => x.email === email)) return { ok: false, msg: '邮箱已存在' };
    const u = {
      id: uid('u'), username, email, phone: '', pass: hash(password),
      role: role || 'user', credits: Number(credits) || 0,
      status: 'active', note: '管理员创建', createdAt: now(), lastLogin: null,
    };
    us.push(u);
    saveUsers(us);
    pushLog('INFO', `管理员创建用户：${username}`);
    return { ok: true, user: publicUser(u) };
  }

  function listOrders(q) {
    let os = orders();
    if (q && q.status) os = os.filter((o) => o.status === q.status);
    if (q && q.method) os = os.filter((o) => o.method === q.method);
    if (q && q.keyword) {
      const s = q.keyword.toLowerCase();
      os = os.filter((o) => o.id.toLowerCase().includes(s) ||
        (o.username || '').toLowerCase().includes(s));
    }
    return os.sort((a, b) => b.createdAt - a.createdAt);
  }
  function adminMarkOrderPaid(id) {
    const os = orders();
    const o = os.find((x) => x.id === id);
    if (!o) return { ok: false, msg: '订单不存在' };
    if (o.status === 'paid') return { ok: false, msg: '订单已是已支付' };
    o.status = 'paid';
    o.paidAt = now();
    saveOrders(os);
    addCredits(o.userId, o.credits, `后台补单 ${o.id}`);
    return { ok: true, order: o };
  }
  function adminCloseOrder(id) {
    const os = orders();
    const o = os.find((x) => x.id === id);
    if (!o) return { ok: false, msg: '订单不存在' };
    o.status = 'closed';
    saveOrders(os);
    return { ok: true };
  }

  /* 账号池管理 */
  function poolList() { return tokens(); }
  function poolAdd({ name, session, note }) {
    if (!session || session.length < 8) return { ok: false, msg: '请填写有效的 sessionid' };
    const t = tokens();
    if (t.some((x) => x.session === session)) return { ok: false, msg: '该 sessionid 已存在' };
    const item = {
      id: uid('tk'), name: name || ('账号 ' + (t.length + 1)),
      session: session.trim(), note: note || '',
      points: Math.floor(Math.random() * 900) + 60,
      live: true, enabled: true, addedAt: now(), checkedAt: now(),
    };
    t.push(item);
    saveTokens(t);
    pushLog('INFO', `账号池新增：${item.name}`);
    return { ok: true, item };
  }
  function poolRemove(id) {
    const t = tokens();
    const x = t.find((a) => a.id === id);
    saveTokens(t.filter((a) => a.id !== id));
    if (x) pushLog('WARN', `账号池移除：${x.name}`);
    return { ok: true };
  }
  function poolUpdate(id, patch) {
    const t = tokens();
    const x = t.find((a) => a.id === id);
    if (!x) return { ok: false, msg: '账号不存在' };
    Object.assign(x, patch);
    saveTokens(t);
    return { ok: true, item: x };
  }
  /** 模拟 /token/check + /token/points */
  async function poolCheck(id) {
    await wait(760);
    const t = tokens();
    const x = t.find((a) => a.id === id);
    if (!x) return { ok: false, msg: '账号不存在' };
    // 演示规则：以 0000 结尾的号判定为失效
    const dead = x.session.endsWith('0000') || /^0+$/.test(x.session.slice(0, 4));
    x.live = !dead;
    x.checkedAt = now();
    if (!dead) {
      x.points = Math.max(0, (x.points || 0) + Math.floor(Math.random() * 200) - 40);
    } else {
      x.points = 0;
    }
    saveTokens(t);
    pushLog(dead ? 'ERROR' : 'INFO',
      `额度探测 ${x.name}：${dead ? 'token 已失效' : x.points + ' 积分'}`);
    return { ok: true, item: x, dead };
  }
  async function poolCheckAll() {
    const t = tokens();
    for (const x of t) await poolCheck(x.id);
    return { ok: true, pool: poolCredits() };
  }
  function poolAddBulk(text) {
    const lines = String(text || '').split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean);
    let ok = 0, dup = 0, bad = 0;
    const t = tokens();
    lines.forEach((line) => {
      // 支持 "名称 sessionid" 或纯 sessionid
      const parts = line.split(/[\s,|]+/).filter(Boolean);
      let name = '', sid = '';
      if (parts.length >= 2 && parts[1].length >= 8) { name = parts[0]; sid = parts[1]; }
      else sid = parts[0];
      if (!sid || sid.length < 8) { bad++; return; }
      if (t.some((x) => x.session === sid)) { dup++; return; }
      t.push({
        id: uid('tk'), name: name || ('账号 ' + (t.length + 1)),
        session: sid, note: '批量导入',
        points: Math.floor(Math.random() * 900) + 60,
        live: true, enabled: true, addedAt: now(), checkedAt: now(),
      });
      ok++;
    });
    saveTokens(t);
    pushLog('INFO', `批量导入账号：成功 ${ok}，重复 ${dup}，无效 ${bad}`);
    return { ok: true, added: ok, dup, bad, total: t.length };
  }

  /* 系统日志 */
  function listLogs(level) {
    const l = logs();
    if (!level || level === 'ALL') return l;
    return l.filter((x) => x.level === level);
  }
  function clearLogs() { write(K.logs, []); return { ok: true }; }
  function pushSystemLog(level, msg) { pushLog(level, msg); return { ok: true }; }

  /* 全站作品（管理端媒体库） */
  function allJobs(q) {
    let js = jobs();
    if (q && q.type) js = js.filter((j) => j.type === q.type);
    if (q && q.status) js = js.filter((j) => j.status === q.status);
    if (q && q.keyword) {
      const s = q.keyword.toLowerCase();
      js = js.filter((j) => (j.prompt || '').toLowerCase().includes(s) ||
        (j.modelName || '').toLowerCase().includes(s));
    }
    return js.sort((a, b) => b.createdAt - a.createdAt);
  }
  function adminDeleteJob(id) {
    const j = jobById(id);
    if (!j) return { ok: false, msg: '记录不存在' };
    if (running.has(id)) { clearTimeout(running.get(id)); running.delete(id); }
    saveJobs(jobs().filter((x) => x.id !== id));
    return { ok: true };
  }

  /* 整站导出 / 导入 / 清空（备份用） */
  function exportAll() {
    return {
      exportedAt: new Date().toISOString(),
      version: 1,
      config: config(),
      users: users(),
      jobs: jobs(),
      orders: orders(),
      tokens: tokens(),
      logs: logs(),
    };
  }
  function importAll(data) {
    try {
      if (!data || typeof data !== 'object') return { ok: false, msg: '数据格式不正确' };
      if (data.config) write(K.config, data.config);
      if (data.users) write(K.users, data.users);
      if (data.jobs) write(K.jobs, data.jobs);
      if (data.orders) write(K.orders, data.orders);
      if (data.tokens) write(K.tokens, data.tokens);
      if (data.logs) write(K.logs, data.logs);
      return { ok: true };
    } catch (e) {
      return { ok: false, msg: '导入失败：' + e.message };
    }
  }
  function wipe(what) {
    if (what === 'all' || what === 'jobs') { saveJobs([]); }
    if (what === 'all' || what === 'orders') { saveOrders([]); }
    if (what === 'all' || what === 'logs') { write(K.logs, []); }
    if (what === 'all') {
      saveUsers(users().filter((u) => u.role === 'admin'));
      logout();
    }
    pushLog('WARN', `管理员清空数据：${what}`);
    return { ok: true };
  }

  /* ============================================================
     八、事件总线（页面订阅任务进度用）
     ============================================================ */
  const bus = new Map();
  function on(evt, fn) {
    if (!bus.has(evt)) bus.set(evt, new Set());
    bus.get(evt).add(fn);
    return () => bus.get(evt).delete(fn);
  }
  function emit(evt, payload) {
    (bus.get(evt) || []).forEach((fn) => {
      try { fn(payload); } catch (e) { console.warn(e); }
    });
  }

  /* ============================================================
     九、真实后端接口说明（换后端时照这个实现）
     ------------------------------------------------------------
     POST /api/register        {username,email,phone,password}
     POST /api/login           {account,password}  → Set-Cookie: session
     POST /api/logout
     POST /api/reset/send      {account}           → 服务端发邮件/短信
     POST /api/reset/confirm   {account,code,password}
     GET  /api/me              → {user:{...credits}}
     GET  /api/jobs            → 我的作品
     POST /api/generate        {type,model,prompt,ratio,resolution,duration,refImages}
     GET  /api/orders          → 我的订单
     POST /api/orders          {planId|amount, method} → {order, qr}
     POST /api/pay/callback    微信/支付宝异步回调（唯一可信的加积分入口）
     GET  /api/admin/stats ... 等管理端接口
     ⚠️ 积分与订单必须由服务端裁决，前端一律不可信。
     ============================================================ */

  /* ============================================================
     公开 API
     ============================================================ */
  return {
    // 基础
    uid, hash, fmtDate, fmtDay, wait, read, write, K,
    on, emit,
    config, saveConfig, resetConfig,
    seed, demoPoster,

    // 鉴权
    currentUser, publicUser,
    register, login, logout,
    sendResetCode, resetPassword, changePassword, updateProfile,
    validatePassword, validateUsername, validateEmail,

    // 积分 / 价格
    priceOf, poolCredits, addCredits,

    // 生成
    createJob, myJobs, jobById, deleteJob, clearMyJobs, failJob,

    // 充值 / 订单
    createOrder, payOrderDemo, myOrders, orderById,

    // 管理端
    requireAdmin, adminStats,
    listUsers, adminUpdateUser, adminDeleteUser, adminCreateUser,
    listOrders, adminMarkOrderPaid, adminCloseOrder,
    poolList, poolAdd, poolRemove, poolUpdate, poolCheck, poolCheckAll, poolAddBulk,
    listLogs, clearLogs, pushSystemLog,
    allJobs, adminDeleteJob,
    exportAll, importAll, wipe,
  };
})();

window.GLAD = GLAD;
