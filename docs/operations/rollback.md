# Rollback

Rollback should change the Git-tracked Production Manifest rather than manually changing the live DigitalOcean app. The rollback unit is the image digest and release identity in `deploy/production/app.yaml`.

## Preferred Rollback

1. Find a known-good release from GitHub Releases, historical Production Promotion PRs, or `deploy/production/app.yaml` history.
2. Revert the broken Production Promotion PR, or open a new PR that restores the known-good image digest, `APP_VERSION`, and `COMMIT_SHA`.
3. Wait for `Product checks` and `Container build and scan`.
4. Merge the rollback Production Promotion PR.
5. Confirm `Reconcile DO Production` completes.
6. Check `/health` and confirm the version and commit match the restored manifest.

This makes `master`, GitHub Actions, GHCR, and DO Production converge again.

## Emergency Containment

If production must recover before a PR can merge, temporarily update DigitalOcean to a known-good digest or use App Platform deployment controls to restore a previous known-good deployment. Treat this as temporary containment, then still follow the preferred rollback path so Git and DO Production converge again.

## What Not To Do

- Do not push directly to `master`.
- Do not deploy `latest`.
- Do not switch DigitalOcean back to source-based deploys during normal rollback.
- Do not bypass PR checks during normal rollback.
- Do not record or use AWS, Kubernetes, GitOps controller, PostgreSQL, or Redis rollback steps for this DigitalOcean App Platform flow.

## Verification

After rollback, run:

```bash
curl --fail --silent --show-error "$DO_PRODUCTION_URL/health"
```

The response should report:

- `status: "ok"`
- the `version` from the restored manifest
- the `commit` from the restored manifest
- a reasonable `rooms` count

After rollback reconcile completes, the scheduled `Production Drift Check` should also pass.
