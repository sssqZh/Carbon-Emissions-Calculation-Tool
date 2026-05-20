# 碳排放计算平台

本项目是一个碳排放计算网站骨架，技术栈为 React、TypeScript、Vite、SQLite，本地开发使用 SQLite 文件，Cloudflare 部署使用 Pages Functions + D1。

## 当前范围

- React + TypeScript 前端页面
- Vite 本地开发服务器
- SQLite 本地数据库结构和种子数据
- Node 本地 API，用于本地读取 SQLite 数据
- Cloudflare Pages Functions API，用于线上读取 D1 数据
- 三个预置计算器入口：
  - 个人碳足迹估算
  - 当地电网平均碳排放因子计算
  - 火锅碳排放估算

具体计算公式暂未接入，当前计算器提交会保存为草稿记录。

## 本地运行

安装依赖：

```bash
npm install
```

初始化本地 SQLite 数据库：

```bash
npm run db:init
```

启动前端和本地 API：

```bash
npm run dev
```

默认地址：

- 前端：http://127.0.0.1:5173
- API：http://127.0.0.1:4174

## Cloudflare Pages 部署

Cloudflare Pages 项目不要使用 `npx wrangler deploy`。这个命令用于 Workers，日志里出现 `Missing entry-point to Worker script or to assets directory` 就是因为它在找 Worker 入口。

在 Cloudflare Pages 控制台中使用：

- Build command: `npm run build`
- Build output directory: `dist`
- Deploy command: 留空，或改成 `npx wrangler pages deploy dist`

如果使用 D1，需要先创建数据库并把真实的 `database_id` 写入 `wrangler.toml`：

```bash
npm run db:create
```

然后执行远程迁移：

```bash
npm run db:migrate:remote
```

## 常用命令

```bash
npm run db:init
npm run db:reset
npm run dev
npm run build
npm run deploy
npm run db:create
npm run db:migrate:local
npm run db:migrate:remote
```

## 目录结构

```text
db/
  schema.sql       本地 SQLite 表结构
  seed.sql         本地 SQLite 初始数据
docs/
  requirements.md  第一版需求文档
functions/
  api/[[catchall]].ts  Cloudflare Pages Functions API
migrations/
  0001_initial.sql D1 初始化迁移
scripts/
  init-db.mjs      本地数据库初始化脚本
  dev.mjs          同时启动本地 API 和 Vite
server/
  index.mjs        本地 API 服务
src/
  App.tsx          前端主界面
  api.ts           API 调用封装
  types.ts         前端类型定义
  styles.css       页面样式
```
