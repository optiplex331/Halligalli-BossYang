# Rollback

Rollback 应改变 Git 跟踪的 Production Manifest，而不是手动改变 live DigitalOcean app。rollback 单元是 `deploy/production/app.yaml` 中的 image digest 和 release identity。

## Preferred Rollback

1. 从 GitHub Releases、历史 Production Promotion PR 或 `deploy/production/app.yaml` history 中找到已知正常的 release。
2. revert 出问题的 Production Promotion PR，或打开一个新 PR 恢复已知正常的 image digest、`APP_VERSION` 和 `COMMIT_SHA`。
3. 等待 `Product checks` 和 `Container build and scan` 通过。
4. 合并 rollback Production Promotion PR。
5. 确认 `Reconcile DO Production` 完成。
6. 检查 `/health`，确认 version 和 commit 与恢复后的 manifest 匹配。

这样可以让 `master`、GitHub Actions、GHCR 和 DO Production 重新收敛。

## Emergency Containment

如果生产必须在 PR 合并前恢复，可以先把 DigitalOcean 更新到一个已知正常的 digest，或使用 App Platform deployment controls 恢复到上一个已知正常部署。把这种操作视为临时止血，随后仍然要走 preferred rollback path，让 Git 和 DO Production 重新收敛。

## What Not To Do

- 不要直接 push 到 `master`。
- 不要部署 `latest`。
- 不要在常规 rollback 中把 DigitalOcean 切回 source-based deploys。
- 不要在常规 rollback 中绕过 PR checks。
- 不要为这个 DigitalOcean App Platform 流程记录或使用 AWS、Kubernetes、GitOps controllers、PostgreSQL 或 Redis rollback 步骤。

## Verification

rollback 后执行：

```bash
curl --fail --silent --show-error "$DO_PRODUCTION_URL/health"
```

响应应该报告：

- `status: "ok"`
- 恢复后 manifest 对应的 `version`
- 恢复后 manifest 对应的 `commit`
- 合理的 `rooms` count

rollback reconcile 完成后，定时运行的 `Production Drift Check` 也应该通过。
