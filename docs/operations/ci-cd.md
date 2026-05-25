# CI/CD 与 GitOps

Halligalli 使用 GitHub Actions 作为交付控制面，并作为单服务 DigitalOcean Production 应用的 GitOps Reconciler。生产期望状态保存在 `deploy/production/app.yaml`；DigitalOcean 只从这份 Git 跟踪的清单更新。

## Pull Request Gates

所有目标分支为 `master` 的 pull request 都会运行这些 required checks：

| Check | Workflow | Job | 证明内容 |
|---|---|---|---|
| Product checks | `CI` | `Product checks` | 这个变更按类型完成了正确的产品或元数据校验。 |
| Container build and scan | `Container` | `Container build and scan` | 这个变更按类型完成了正确的镜像校验。 |

PR checks 不发布镜像，也不改变 DigitalOcean 状态。

这些 check 名称会刻意保持稳定，因为 branch protection 依赖它们。每个 check 内部实际执行的工作由 `dorny/paths-filter` 和 `.github/utils/change-filters.yaml` 按变更类型路由，而不是用 workflow 级别的 path filters。这样可以避免 workflow 被跳过后 required check 一直等待的问题。

| 变更类型 | Product checks | Container build and scan |
|---|---|---|
| 业务或运行时代码 PR | 校验 release 配置，安装依赖，运行测试、类型检查和应用构建。 | 构建生产镜像并运行 Trivy 扫描。 |
| Release PR | 校验 release 配置和 action-based change filters。跳过产品构建工作。 | 跳过镜像构建工作。 |
| Production Promotion PR | 校验 release 配置，包括 Production Manifest 结构。跳过产品构建工作。 | 跳过镜像构建工作，因为 Release Tag 已经构建并扫描过镜像。 |
| 文档或元数据 PR | 校验 release 配置和 action-based change filters。跳过产品构建工作。 | 跳过镜像构建工作。 |

## Release PR

每次 push 到 `master` 都会运行 Release Please。它会打开或更新一个需要人工 review 的 Release PR，并维护：

- `CHANGELOG.md`
- `.github/utils/.release-please-manifest.json`

Release PR 不会让 `package.json` 成为版本来源。合并 Release PR 会创建一个 `vX.Y.Z` Release Tag 和 GitHub Release。

Release Please 使用 `HALLIGALLI_RELEASE_BOT_TOKEN`，这样自动生成的 PR 可以触发后续 checks 和 workflows。

## Release Image

`Container` workflow 会为业务或运行时代码 PR 以及 release tags 构建并扫描镜像。当触发源是 `vX.Y.Z` tag 时，它还会发布：

```text
ghcr.io/<owner>/<repo>:X.Y.Z
```

它不会发布 `latest`。Production promotion 使用已推送镜像的 digest，而不是可变 tag。

## Production Promotion

release image 发布后，container workflow 会打开一个需要人工 review 的 Production Promotion PR。这个 PR 更新：

```text
deploy/production/app.yaml
```

这份 manifest 记录：

- GHCR registry 和 repository
- image digest
- `APP_VERSION`
- `COMMIT_SHA`

合并 Production Promotion PR 是生产发布的审批点。

## GitOps Reconciler

`Reconcile DO Production` 会在 `deploy/production/app.yaml` 于 `master` 发生变化时运行，也可以手动 dispatch。它会：

1. 校验 Production Manifest。
2. 使用 `doctl apps update --wait` 应用 manifest。
3. 对 `/health` 做 smoke test。
4. 如果 `/health.status`、`/health.version` 或 `/health.commit` 与 manifest 不匹配，则失败。

该 workflow 使用 `do-production` concurrency group 串行化执行。

## Drift Check

`Production Drift Check` 每 30 分钟运行一次，也可以手动 dispatch。它会比较：

- `deploy/production/app.yaml`
- 当前 live DigitalOcean app spec
- live `/health`

如果 live image digest、release version 或 commit 不再与 Git 匹配，它会失败。

## Branch Protection

受保护的 `master` ruleset 应要求：

- `Product checks`
- `Container build and scan`

不要为 release metadata、manifest validation 或 production deployment 单独增加 required checks。生产发布只会在 Production Promotion PR 修改 manifest 并合入 `master` 后发生。

## Dependency Updates

Dependabot 会每周针对 `master` 打开 PR，覆盖：

- root pnpm dependencies
- `server/` pnpm dependencies
- GitHub Actions

Dependabot 不会自动合并，也不会绕过 PR checks。
