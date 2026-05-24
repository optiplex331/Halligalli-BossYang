# CI/CD and GitOps

Halligalli uses GitHub Actions as the delivery control plane and GitOps reconciler for the single-service DigitalOcean Production app. Production desired state lives in `deploy/production/app.yaml`; DigitalOcean is updated only from that Git-tracked manifest.

## Pull Request Gates

Pull requests targeting `master` run these required checks:

| Check | Workflow | Job | What it proves |
|---|---|---|---|
| Product checks | `CI` | `Product checks` | The change has the right product or metadata validation for its type. |
| Container build and scan | `Container` | `Container build and scan` | The change has the right image validation for its type. |

PR checks do not publish images or change DigitalOcean state.

The check names are intentionally stable because branch protection depends on them. The work inside each check is routed by change type instead of using workflow-level path filters that could leave required checks waiting for a skipped workflow.

| Change type | Product checks | Container build and scan |
|---|---|---|
| Business/runtime PR | Validates release config, installs dependencies, runs tests, typechecks, and builds the app. | Builds the production image and runs Trivy. |
| Release PR | Validates release config and routed-check classification. Skips product build work. | Skips image build work. |
| Production Promotion PR | Validates release config, including the Production Manifest shape. Skips product build work. | Skips image build work because the Release Tag already built and scanned the image. |
| Docs or metadata-only PR | Validates release config and routed-check classification. Skips product build work. | Skips image build work. |

## Release PR

Pushes to `master` run Release Please. It opens or updates a human-reviewed Release PR that maintains:

- `CHANGELOG.md`
- `.github/utils/.release-please-manifest.json`

The Release PR does not make `package.json` a version source. Merging it creates a `vX.Y.Z` Release Tag and GitHub Release.

Release Please uses `HALLIGALLI_RELEASE_BOT_TOKEN` so the generated PR can run follow-on checks and workflows.

## Release Image

The `Container` workflow builds and scans images for business/runtime PRs and release tags. On a `vX.Y.Z` tag it also publishes:

```text
ghcr.io/<owner>/<repo>:X.Y.Z
```

It does not publish `latest`. Production promotion uses the pushed image digest, not a mutable tag.

## Production Promotion

After a release image is published, the container workflow opens a human-reviewed Production Promotion PR. That PR updates:

```text
deploy/production/app.yaml
```

The manifest records:

- GHCR registry and repository
- image digest
- `APP_VERSION`
- `COMMIT_SHA`

Merging the Production Promotion PR is the production approval point.

## GitOps Reconciler

`Reconcile DO Production` runs when `deploy/production/app.yaml` changes on `master`, or by manual dispatch. It:

1. Validates the Production Manifest.
2. Applies it with `doctl apps update --wait`.
3. Smoke tests `/health`.
4. Fails unless `/health.status`, `/health.version`, and `/health.commit` match the manifest.

The workflow is serialized by the `do-production` concurrency group.

## Drift Check

`Production Drift Check` runs every 30 minutes and by manual dispatch. It compares:

- `deploy/production/app.yaml`
- the live DigitalOcean app spec
- live `/health`

It fails if the live image digest, release version, or commit no longer match Git.

## Branch Protection

Configure the protected `master` ruleset to require:

- `Product checks`
- `Container build and scan`

Do not add separate required checks for release metadata, manifest validation, or production deployment. Production release happens only after a Production Promotion PR changes the manifest on `master`.

## Dependency Updates

Dependabot opens weekly PRs against `master` for:

- root pnpm dependencies
- `server/` pnpm dependencies
- GitHub Actions

Dependabot does not auto-merge and does not bypass PR checks.
