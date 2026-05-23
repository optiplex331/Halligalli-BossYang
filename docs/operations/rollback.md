# Rollback

Stage 1 rollback uses the same PR-only `master` path as normal releases. DigitalOcean runs the GHCR image built by GitHub Actions, so the normal rollback unit is still a reverted commit on `master`; the release workflow then publishes and deploys the rollback image.

## Preferred Rollback

1. Identify the bad release in the `Release DO Production` workflow logs.
2. Note the commit SHA, version tag, GHCR image tag, and DO deployment ID.
3. Revert the bad commit in a new branch.
4. Open a PR targeting `master`.
5. Wait for `Product checks` and `Container build and scan`.
6. Merge the rollback PR.
7. Confirm the `Release DO Production` workflow completes.
8. Check `/health` and confirm the version and commit match the rollback commit.

This keeps production history auditable and preserves the same release gates as forward changes.

## Emergency Containment

If production must be restored before a revert PR can merge, update DigitalOcean to a known-good GHCR image tag or use App Platform's deployment controls to restore the last known good deployment when available. Treat that as temporary containment, then follow with the preferred rollback path so `master`, GitHub Actions, GHCR, and DO Production converge again.

## What Not To Do

- Do not push directly to `master`.
- Do not switch DigitalOcean back to source-based deploys for normal rollback.
- Do not bypass PR checks for normal rollback.
- Do not document or use AWS, Kubernetes, GitOps, PostgreSQL, or Redis rollback steps in Stage 1.

## Verification

After rollback, verify:

```bash
curl --fail --silent --show-error "$DO_PRODUCTION_URL/health"
```

The response should report:

- `status: "ok"`
- `version` for the rollback release
- `commit` for the rollback commit
- a plausible `rooms` count
