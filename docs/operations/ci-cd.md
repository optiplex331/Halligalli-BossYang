# CI/CD and GitOps

Halligalli uses GitHub Actions as its delivery control plane and as the GitOps reconciler for the single-service DigitalOcean Production app. The intended production state is stored in the Git-tracked Production Manifest at `deploy/production/app.yaml`; DigitalOcean is updated from that manifest.

## Pull Request Gates

Every pull request targeting `master` runs these required checks:

| Check | Workflow | Job | Proves |
|---|---|---|---|
| Product checks | `CI` | `Product checks` | The change received the right product, metadata, or control-plane validation for its type. |
| Container build and scan | `Container` | `Container build and scan` | The change received the right image validation for its type. |

PR checks do not publish images and do not change DigitalOcean state. CI uses `package.json` as the `actions/setup-node` version source; the current product runtime baseline is Node.js 24.

The check names intentionally stay stable because branch protection depends on them. The work inside each check is routed by `dorny/paths-filter` and `.github/utils/change-filters.yaml`, not by workflow-level path filters. This avoids skipped workflows leaving required checks pending.

Short shell-native workflow orchestration stays in Bash, such as `git`, `docker`, `doctl`, `gh`, `curl`, Terraform CLI orchestration, and environment checks. Structured parsing, reusable JSON validation, Production Manifest release identity handling, drift comparison, `/health` JSON validation, and non-trivial inline heredocs belong in dependency-free `.github/utils/*.py` scripts covered by Python's built-in `unittest`.

| Change type | Product checks | Container build and scan |
|---|---|---|
| Product/runtime PR | Validate release config and Python utility tests, install dependencies, run tests, typecheck, and build on Node.js 24. | Build the Node.js 24 production image and run Trivy. |
| Delivery control PR | Validate release config and utility tests, then run actionlint for GitHub Actions workflows. Skip heavy product work. | Skip image build work. |
| Release PR | Validate release config and utility tests. Skip heavy product work. | Skip image build work. |
| Production Promotion PR | Validate release config and utility tests, including Production Manifest structure, and require the PR to modify only `deploy/production/app.yaml`. Skip heavy product work. | Skip image build work because the Release Tag already built and scanned the image. |
| Docs or other metadata PR | Validate release config and utility tests. Skip heavy product work. | Skip image build work. |

Utility tests run unconditionally in the `Product checks` gate and do not require `pnpm install`. `Container`, `Reconcile DO Production`, and `Production Drift Check` run the specific utilities they need without repeating the full utility test suite.

## AWS Staging Scaffold

The `AWS Staging Scaffold` workflow only runs through `workflow_dispatch`; it is not attached to push, PR, or Release Tag events. The default `validate` operation only runs release config and Terraform static validation. `deploy-frontend` and `deploy-backend` require the `STAGING_APPLY` confirmation before any AWS-mutating steps run.

AWS Staging/Portfolio changes are Delivery Control. Changes to `deploy/aws-staging/**` and `.github/workflows/aws-staging.yml` make `Product checks` run release utility validation and actionlint, but they do not publish AWS resources and do not change DO Production.

AWS Staging operation details are documented in [AWS staging scaffold](aws-staging.md).

## Release PR

Every push to `master` runs Release Please. It opens or updates a human-reviewed Release PR and maintains:

- `CHANGELOG.md`
- `.github/utils/.release-please-manifest.json`

The Release PR does not make `package.json` the version source. Merging the Release PR creates a `vX.Y.Z` Release Tag and GitHub Release.

Release Please uses `HALLIGALLI_RELEASE_BOT_TOKEN` so the generated PR can trigger follow-on checks and workflows.

## Release Image

The `Container` workflow builds and scans images for product/runtime PRs and release tags. When the trigger is a `vX.Y.Z` tag, it also publishes:

```text
ghcr.io/<owner>/<repo>:X.Y.Z
```

It does not publish `latest`. Production promotion uses the pushed image digest, not a mutable tag.

## Production Promotion

After the release image is published, the container workflow opens a human-reviewed Production Promotion PR. This PR updates:

```text
deploy/production/app.yaml
```

The manifest records:

- GHCR registry and repository
- image digest
- `APP_VERSION`
- `COMMIT_SHA`

Merging the Production Promotion PR is the production deployment approval point.
Production Promotion PRs must only modify `deploy/production/app.yaml`; required checks fail if product code, workflow files, release metadata, or documentation are mixed into the same PR.

## GitOps Reconciler

`Reconcile DO Production` runs when `deploy/production/app.yaml` changes on `master`; it can also be manually dispatched. It:

1. Validates the Production Manifest.
2. Applies the manifest with `doctl apps update --wait`.
3. Smoke tests `/health`.
4. Fails if `/health.status`, `/health.version`, or `/health.commit` does not match the manifest.

The workflow uses the `do-production` concurrency group to serialize production reconciles.

## Drift Check

`Production Drift Check` runs daily and can also be manually dispatched. It compares:

- `deploy/production/app.yaml`
- the current live DigitalOcean app spec
- live `/health`

It fails if the live image digest, release version, or commit no longer matches Git.

## Branch Protection

The protected `master` ruleset should require:

- `Product checks`
- `Container build and scan`

Do not add separate required checks for release metadata, manifest validation, or production deployment. Production deployment only happens after a Production Promotion PR modifies the manifest and lands on `master`.

## Dependency Updates

Dependabot opens weekly PRs against `master` for:

- root pnpm dependencies
- `server/` pnpm dependencies
- GitHub Actions

Dependabot does not auto-merge and does not bypass PR checks.
