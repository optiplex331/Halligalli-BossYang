# DigitalOcean Production

Halligalli Production 运行在 DigitalOcean App Platform 上，是一个由 GHCR 镜像驱动的 Node.js 24 单服务应用。GitHub Actions 会从 Git 跟踪的 Production Manifest `deploy/production/app.yaml` reconcile DigitalOcean。

## Production App

| 字段 | 值 |
|---|---|
| App Platform app | `halligalli` |
| Service | `web` |
| Region | `ams` |
| Release branch | `master` |
| Runtime | 从 Node.js 24 单服务 Dockerfile 构建的 GHCR image |
| HTTP port | `3001` |
| Production Manifest | `deploy/production/app.yaml` |

## Required GitHub Configuration

运行 release flow 前需要创建这些 GitHub 设置：

| 位置 | 类型 | 名称 | 用途 |
|---|---|---|---|
| Repository | Secret | `HALLIGALLI_RELEASE_BOT_TOKEN` | 让 Release Please 和 promotion workflows 可以打开会触发后续 checks 的 PR。 |
| Environment `do-production` | Secret | `DO_API_TOKEN` | 在 GitHub Actions 中认证 `doctl`。 |
| Environment `do-production` | Variable | `DO_APP_ID` | 标识 DO Production app。 |
| Environment `do-production` | Variable | `DO_PRODUCTION_URL` | live base URL，用于 `/health` smoke tests。 |

不要提交 token 值或本地 `.env` 文件。

## Production Manifest

Production Manifest 使用 GHCR image digest：

```yaml
image:
  registry_type: GHCR
  registry: optiplex331
  repository: halligalli-bossyang
  digest: sha256:...
```

不要在生产使用 `latest`。release workflow 可以推送一个便于人阅读的 version tag，但 DigitalOcean 应该运行 Git 中记录的 digest。

GitHub Actions 中对 Production Manifest 的 release identity 读写应通过 provider-neutral 的 `.github/utils/*.mjs` helper 完成。helper 内部可以理解当前 DigitalOcean manifest 结构，但 workflow 不应散落 DigitalOcean-specific YAML 解析逻辑；这样未来迁移生产 provider 时，主要替换 helper 内部和少量 CLI 编排。

## Release Identity

Production Manifest 会把 release identity 注入应用：

```text
APP_VERSION=X.Y.Z
COMMIT_SHA=<full commit sha>
```

服务器在 `/health` 暴露这份 identity：

```json
{
  "status": "ok",
  "rooms": 0,
  "version": "1.2.0",
  "commit": "abc1234..."
}
```

`/health` smoke test 和 drift check 的 JSON 校验应复用 `.github/utils/*.mjs` 中的无依赖 Node 脚本。简单的 `curl` 调用和重试循环可以保留在 Bash 中。

## Promotion Flow

1. 合并 Release Please PR，创建 `vX.Y.Z` tag。
2. 该 tag 触发 GHCR image 的构建、扫描和推送。
3. build workflow 解析已推送镜像的 digest。
4. build workflow 打开 Production Promotion PR，更新 `deploy/production/app.yaml`。
5. Production Promotion PR 运行稳定的 required checks，但这些 checks 会路由到 manifest validation，而不是重新构建已经发布的镜像。
6. 合并 Production Promotion PR。
7. `Reconcile DO Production` 应用 manifest，并对 `/health` 做 smoke test。

## Deployment Trace

排查一次生产发布时，用这些信息串起当前部署：

- GitHub Release 对应的 Release Tag。
- `deploy/production/app.yaml` 中的 image digest。
- `/health` 返回的 app version 和 commit。
- `Reconcile DO Production` workflow log 中的 DO deployment ID。

排查失败部署时可以使用：

```bash
doctl apps logs <app-id> --deployment <deployment-id> --type run
```

## Manual Reconcile

使用 `Reconcile DO Production` workflow dispatch 可以重新应用当前 Git 跟踪的 manifest，而不改变 release version。
