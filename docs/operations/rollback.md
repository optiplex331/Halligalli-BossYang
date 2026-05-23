# Rollback

Rollback changes the Git-tracked Production Manifest, not the live DigitalOcean app by hand. The rollback unit is the image digest and release identity in `deploy/production/app.yaml`.

## Preferred Rollback

1. Identify the known-good release in GitHub Releases, previous Production Promotion PRs, or `deploy/production/app.yaml` history.
2. Revert the bad Production Promotion PR, or open a new PR that restores the known-good image digest, `APP_VERSION`, and `COMMIT_SHA`.
3. Wait for `Product checks` and `Container build and scan`.
4. Merge the rollback Production Promotion PR.
5. Confirm `Reconcile DO Production` completes.
6. Check `/health` and confirm the version and commit match the restored manifest.

This keeps `master`, GitHub Actions, GHCR, and DO Production converged.

## Emergency Containment

If production must be restored before a PR can merge, update DigitalOcean to a known-good digest or use App Platform deployment controls to restore the last known good deployment. Treat that as temporary containment, then follow with the preferred rollback path so Git and DO Production converge again.

## What Not To Do

- Do not push directly to `master`.
- Do not deploy `latest`.
- Do not switch DigitalOcean back to source-based deploys for normal rollback.
- Do not bypass PR checks for normal rollback.
- Do not document or use AWS, Kubernetes, GitOps controllers, PostgreSQL, or Redis rollback steps for this DigitalOcean App Platform flow.

## Verification

After rollback, verify:

```bash
curl --fail --silent --show-error "$DO_PRODUCTION_URL/health"
```

The response should report:

- `status: "ok"`
- `version` for the restored manifest
- `commit` for the restored manifest
- a plausible `rooms` count

The scheduled `Production Drift Check` should also pass after the rollback reconcile completes.
