# CI/CD

Halligalli Stage 1 uses GitHub Actions as the delivery control plane for the single-service DigitalOcean Production app. GitHub Actions builds the Docker image, publishes it to GHCR, and updates DigitalOcean to run that immutable image tag.

## Pull Request Gates

Pull requests targeting `master` run these required checks:

| Check | Workflow | Job | What it proves |
|---|---|---|---|
| Product checks | `CI` | `Product checks` | Release metadata resolves from a `vX.Y.Z` git tag, `pnpm install --frozen-lockfile`, Vitest, and `pnpm run build` pass. |
| Container build and scan | `Container` | `Container build and scan` | The production Docker image builds and Trivy finds no unfixed HIGH or CRITICAL vulnerabilities. |

These checks do not deploy, publish images, or change DigitalOcean state on pull requests.

## Container Images

The `Container` workflow builds the single-service image from `Dockerfile`. Version and image-tag commands live in `.github/utils/Taskfile.yaml` and run through the official `go-task/setup-task` GitHub Action.

On pull requests, it only builds and scans the image locally.

On `master`, it builds, scans, and publishes to GHCR:

```text
ghcr.io/<owner>/<repo>:<base-version>-<distance>-g<short-sha>
ghcr.io/<owner>/<repo>:latest
```

Version tags come from the nearest `vX.Y.Z` git tag. The workflow fails if no matching git tag exists; `package.json` is not a release-version source.

The initial release anchor is `v0.1.0`. Commits after that tag produce extended image tags such as:

```text
0.1.0-0004-gabc1234
```

## Production Release Flow

The `Release DO Production` workflow starts after the `Container` workflow succeeds on `master`, or by manual dispatch. It:

1. Resolves the same version tag and commit SHA used for the GHCR image.
2. Renders a temporary DigitalOcean app spec with the GHCR image tag, `APP_VERSION`, and `COMMIT_SHA`.
3. Runs `doctl apps update --wait` for the DO Production app.
4. Logs the commit SHA, version tag, GHCR image tag, DO app ID, and DO deployment ID.
5. Smoke tests the live `/health` endpoint and fails unless `status`, `version`, and `commit` match the release.

The release workflow is serialized by the `do-production` concurrency group, so only one production deployment runs at a time.

Manual production dispatches must be run from `master`. Dispatches from other branches are skipped so release metadata cannot describe a feature-branch image as production.

## Platform Boundary

Stage 1 production is DigitalOcean App Platform running the GHCR image produced by the `Container` workflow. AWS Staging/Portfolio, Kubernetes, GitOps, PostgreSQL, and Redis are deferred work and are not part of the implemented Stage 1 release loop.

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
