# Cloudflare Pages 部署说明

## 当前报错原因

部署日志中的关键行是：

```text
Executing user deploy command: npx wrangler deploy
WARNING: It seems that you have run `wrangler deploy` on a Pages project
ERROR: Missing entry-point to Worker script or to assets directory
```

`wrangler deploy` 是 Workers 部署命令，它会寻找 Worker 入口文件或 Worker assets 配置。当前项目是 Cloudflare Pages 项目，前端产物在 `dist`，API 在 `functions/`，所以应该使用 Pages 的部署流程。

## 推荐配置

在 Cloudflare Pages 控制台中设置：

```text
Build command: npm run build
Build output directory: dist
Deploy command: 留空
```

如果控制台必须填写 deploy command，则填写：

```text
npx wrangler pages deploy dist
```

不要填写：

```text
npx wrangler deploy
```

## D1 数据库

第一次部署前创建 D1 数据库：

```bash
npm run db:create
```

把命令输出中的 `database_id` 替换到 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "carbon-db"
database_id = "真实的 database_id"
```

然后执行远程迁移：

```bash
npm run db:migrate:remote
```
