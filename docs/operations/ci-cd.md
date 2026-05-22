# CI/CD

Halligalli Stage 1 uses GitHub Actions as the delivery control plane for the existing single-service DigitalOcean Production app. The app still builds the Vite frontend into `dist/` and serves it from the Node/socket.io server.

## Pull Request Gates

Pull requests targeting `master` run these required checks:

| Check | Workflow | Job | What it proves |
|---|---|---|---|
| Product checks | `CI` | `Product checks` | `pnpm install --frozen-lockfile`, Vitest, and `pnpm run build` pass. |
| Container build and scan | `Container` | `Container build and scan` | The production Docker image builds and Trivy finds no unfixed HIGH or CRITICAL vulnerabilities. |

These checks do not deploy, publish images, or change DigitalOcean state on pull requests.

## Container Images

The `Container` workflow builds the single-service image from `Dockerfile`.

On pull requests, it only builds and scans the image locally.

On `master`, it builds, scans, and publishes to GHCR:

```text
ghcr.io/<owner>/<repo>:<base-version>-<distance>-g<short-sha>
ghcr.io/<owner>/<repo>:latest
```

Version tags come from the nearest `vX.Y.Z` git tag when one exists. If the repository has no matching tag, the workflow uses `package.json` version, the total commit count, and the current short SHA. This keeps Stage 1 deterministic before the first release tag is created.

## Production Release Flow

The `Release DO Production` workflow starts after the `Container` workflow succeeds on `master`, or by manual dispatch. It:

1. Resolves the same version tag and commit SHA used for the GHCR image.
2. Renders a temporary DigitalOcean app spec with `deploy_on_push: false`, `APP_VERSION`, and `COMMIT_SHA`.
3. Runs `doctl apps update --update-sources --wait` for the DO Production app.
4. Logs the commit SHA, version tag, GHCR image tag, DO app ID, and DO deployment ID.
5. Smoke tests the live `/health` endpoint and fails unless `status`, `version`, and `commit` match the release.

The release workflow is serialized by the `do-production` concurrency group, so only one production deployment runs at a time.

Manual production dispatches must be run from `master`. Dispatches from other branches are skipped so release metadata cannot describe a feature-branch commit while DigitalOcean deploys the `master` source.

## Platform Boundary

Stage 1 production is DigitalOcean App Platform only. GHCR images are release artifacts and container validation evidence; the live DO app still builds from the repository source. AWS Staging/Portfolio, Kubernetes, GitOps, PostgreSQL, and Redis are deferred work and are not part of the implemented Stage 1 release loop.

## Branch Protection

Configure the protected `master` rule to require:

- `Product checks`
- `Container build and scan`

Do not require `Deploy DO Production` as a PR check. Production release happens only after changes land on `master`.

## Dependency Updates

Dependabot opens weekly PRs against `master` for:

- root pnpm dependencies
- `server/` pnpm dependencies
- GitHub Actions

Dependabot does not auto-merge and does not bypass the Stage 1 PR checks.
