# 碳排放计算平台

碳排放计算网站，技术栈 React + TypeScript + Vite + SQLite（本地）/ Cloudflare D1（线上）。

## 本地运行

```bash
npm install
npm run db:init
npm run dev
```

- 前端：http://127.0.0.1:5173
- API：http://127.0.0.1:4174

## Cloudflare Pages 部署

```bash
npm run db:create          # 创建 D1 数据库，获取 database_id 填入 wrangler.toml
npm run db:migrate:remote  # 执行远程数据库迁移
npm run deploy             # 构建并部署
```

## 目录结构

```
db/                 本地 SQLite 表结构和种子数据
docs/               需求文档
functions/api/      Cloudflare Pages Functions（线上 API）
migrations/         D1 数据库迁移
scripts/            本地数据库初始化和开发启动脚本
server/             本地 Node API 服务
src/                前端 React 应用
```
