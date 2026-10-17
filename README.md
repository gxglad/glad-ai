# Glad · AI 影像创作平台

一个聚合多账号额度的 AI 图片 / 视频生成平台，含**客户端**与**管理端**两个入口。
纯静态站点（HTML + CSS + 原生 JS），零依赖、零构建、零外链。

- **客户端**：`index.html` — 生成工作台、我的作品、积分与充值、充值记录、个人中心
- **管理端**：`admin.html` — 数据看板、额度账号池、模型管理、比例与时长、API 接入、用户管理、订单管理、积分与计费、作品库、内容审核、站点设置、系统日志
- **登录页**：`auth.html` — 登录 / 注册 / 忘记密码

## 演示账号

| 角色 | 账号 | 密码 | 说明 |
|---|---|---|---|
| 管理员 | `admin` | `admin888` | 进管理端 |
| 普通用户 | `demo` | `demo123` | 积分默认 0，体验充值流程 |

## 快速开始（本地预览）

```powershell
# 在项目目录下起一个静态服务器
node _build/serve.mjs 8099
# 然后打开 http://127.0.0.1:8099/
```

> `_build/` 是开发目录（本地预览服务器、截图自检脚本），不会被发布到公网。

## 目录结构

```
index.html          客户端：生成工作台 / 作品 / 积分 / 订单 / 个人中心
admin.html          管理端：12 个模块
auth.html           登录 / 注册 / 忘记密码
styles.css          全站设计系统（暗色玻璃拟态 + 响应式）
js/store.js         ⭐ 数据层（假后端）——换真后端只改这一个文件
js/ui.js            共享 UI 工具（图标 / Toast / 弹层 / 假二维码）
js/app.js           客户端逻辑
js/admin.js         管理端逻辑
_build/             开发工具（不发布）
```

## 架构说明

`js/store.js` 是一个用 `localStorage` 模拟的**假后端**，暴露统一的 `window.GLAD` API。
页面代码只调用 `GLAD.*`，不直接碰存储，因此接真后端时只需把该文件里的每个方法
从「读写 localStorage」改成 `fetch('/api/...')`，页面代码一行都不用动。

文件末尾附有完整的后端接口清单（注册 / 登录 / 找回密码 / 生成 / 订单 / 支付回调 / 管理端）。

### 对接即梦聚合服务

管理端「API 接入」页已把上游服务的接入参数全部做成可配置项，默认对接本机
`jimeng-portable`（`http://localhost:8001`）：

```
POST /v1/images/generations   { model, prompt, ratio, resolution,
                                negative_prompt, sample_strength, filePath }
POST /v1/videos/generations   { model, prompt, ratio, resolution, duration, file_paths }
GET  /v1/models
POST /token/points            → 查询每个账号的剩余额度
Header: Authorization: Bearer <sessionid,sessionid,...>
```

模型目录（图片 9 个 / 视频 9 个）、比例枚举（图片 8 种 / 视频 6 种）、时长（5 / 10 秒）
均按上游真实取值预置，并可在管理端修改。

## 当前是「演示壳」

| 能真用 | 是假的 |
|---|---|
| 注册 / 登录 / 忘记密码 | 数据存在浏览器 localStorage，清缓存即丢失 |
| 每个用户数据互相独立 | 没有服务器，所有人共享同一份浏览器存储 |
| 积分默认 0、余额不足拦截、充值到账 | 支付二维码是本地绘制的假码，不可真实扫码 |
| 选模型 / 比例 / 分辨率 / 时长 / 参考图 | 生成结果是本地绘制的渐变占位图，非真实 AI 出图 |
| 管理端全部配置项可改并即时生效 | 积分与订单由前端裁决，前端数字不可信 |

## 更新线上

```powershell
node "C:\Users\gx\OneDrive\Desktop\接单\记忆\publish.mjs" `
  --folder "C:\Users\gx\OneDrive\Desktop\Glad AI" `
  --repo "glad-ai" `
  --source-branch main
```

## 版本

v1.0 · 演示版
