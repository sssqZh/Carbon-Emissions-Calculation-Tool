# 碳排放计算平台

本项目是一个本地部署的碳排放计算网站骨架，技术栈为 SQLite、React、TypeScript 和 Vite。

## 当前范围

- React + TypeScript 前端页面
- Vite 本地开发服务器
- SQLite 数据库结构和种子数据
- Node 本地 API，用于读取 SQLite 数据
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

初始化数据库：

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

## 常用命令

```bash
npm run db:init
npm run db:reset
npm run dev
npm run build
```

## 目录结构

```text
db/
  schema.sql      SQLite 表结构
  seed.sql        初始计算器、字段和占位因子
docs/
  requirements.md 第一版需求文档
scripts/
  init-db.mjs     数据库初始化脚本
  dev.mjs         同时启动 API 和 Vite
server/
  index.mjs       本地 API 服务
src/
  App.tsx         前端主界面
  api.ts          API 调用封装
  types.ts        前端类型定义
  styles.css      页面样式
```
