# CI/CD

Halligalli uses GitHub Actions as the product delivery control plane. Pull requests and normal pushes validate code, release metadata, delivery control files, and container images, but they do not create Azure resources or deploy application artifacts.

Azure Production application deployment is operated through a protected manual workflow whose product-side environment uses the `azure-production` boundary:

- `.github/workflows/azure-production.yml` for frontend deploy, backend deploy, and backend smoke checks

Azure Production infrastructure source of truth lives in the private `optiplex331/Halligalli-infra` repository. Product deployment values copied from that repo's infrastructure outputs belong in this repo's protected `azure-production` GitHub Environment.

## Pull Request Gates

Every pull request targeting `master` runs these required checks:

| Check | Workflow | Job | Proves |
|---|---|---|---|
| Product checks | `CI` | `Product checks` | The change received the right product, metadata, or control-plane validation for its type. |
| Container build and scan | `Container` | `Container build and scan` | The change received the right image validation for its type. |

PR checks do not publish images and do not mutate Azure. CI uses `package.json` as the `actions/setup-node` version source; the current product runtime baseline is Node.js 24.

The check names intentionally stay stable because branch protection depends on them. The work inside each check is routed by `dorny/paths-filter` and `.github/utils/change-filters.yaml`, not by workflow-level path filters. This avoids skipped workflows leaving required checks pending.

Short shell-native workflow orchestration stays in Bash, such as `git`, `docker`, `gh`, `curl`, Azure CLI calls, and environment checks. Structured release validation, GitHub output formatting, `/health` JSON validation, and non-trivial inline heredocs belong in dependency-free `.github/utils/*.py` scripts covered by Python's built-in `unittest`.

| Change type | Product checks | Container build and scan |
|---|---|---|
| Product/runtime PR | Validate release config and Python utility tests, install dependencies, run tests, typecheck, and build on Node.js 24. | Build the Node.js 24 Azure backend image and run Trivy. |
| Delivery control PR | Validate release config and utility tests, then run actionlint for GitHub Actions workflows. Skip heavy product work. | Skip image build work. |
| Release PR | Validate release config and utility tests. Skip heavy product work. | Skip image build work. |
| Docs or other metadata PR | Validate release config and utility tests. Skip heavy product work. | Skip image build work. |

Utility tests run unconditionally in the `Product checks` gate and do not require `pnpm install`.

## Azure Production

The Azure Production application deployment workflow only runs through `workflow_dispatch`; it is not attached to push, PR, or Release Tag events. The visible workflow and environment names use `azure-production`, but this still does not mean Halligalli has completed a production cutover.

Terraform `plan`, `apply`, `scale-down`, and `destroy` belong in `optiplex331/Halligalli-infra`.

The deployment workflow supports:

- `validate`
- `deploy-frontend` with `confirm_cost=AZURE_PRODUCTION_APPLY`
- `deploy-backend` with `confirm_cost=AZURE_PRODUCTION_APPLY`
- `smoke-backend`

Azure Production deployment changes are Delivery Control. Changes to `.github/workflows/azure-production.yml` make `Product checks` run release utility validation and actionlint, but they do not publish Azure resources during PR checks.

Azure Production operation details are documented in [Azure Production Reference](azure-production.md).

## Release PR

Every push to `master` runs Release Please. It opens or updates a human-reviewed Release PR and maintains:

- `CHANGELOG.md`
- `.github/utils/.release-please-manifest.json`

The Release PR does not make `package.json` the version source. Merging the Release PR creates a `vX.Y.Z` Release Tag and GitHub Release.

Release Please uses `HALLIGALLI_RELEASE_BOT_TOKEN` so the generated PR can trigger follow-on checks and workflows.

## Release Image

The `Container` workflow builds and scans the default Dockerfile target for product/runtime PRs, `master` integration pushes, and release tags. The default target is the Azure Container Apps backend runtime image: compiled Node.js server, shared runtime modules, production dependencies, `/readyz`, `/health`, and socket.io. It does not include Vite frontend assets because Azure Production publishes those separately to Static Web Apps.

Pull request runs do not publish images.

When the trigger is a normal `master` push, the workflow publishes a Development GHCR Image tagged from the latest Release Tag, first-parent commit distance, and short commit hash:

```text
ghcr.io/<owner>/<repo>:X.Y.Z-000N-gSHA
```

Development GHCR Images are for traceability and rollback testing only. They do not deploy Azure Production.

If the `master` push is exactly the same commit as a `vX.Y.Z` Release Tag, the workflow does not publish a duplicate `X.Y.Z-0000-gSHA` Development GHCR Image. The release-tagged `X.Y.Z` image is the canonical artifact for that commit.

When the trigger is a `vX.Y.Z` tag, the workflow publishes the release image identity without the `v` prefix:

```text
ghcr.io/<owner>/<repo>:X.Y.Z
```

It does not publish `latest`. Azure backend deployment resolves the selected GHCR backend Release Image to a digest and updates Container Apps through the manual Azure Production workflow.

## Branch Protection

The protected `master` ruleset should require:

- `Product checks`
- `Container build and scan`

Do not add separate required checks for release metadata or Azure deployment. Azure Production deployment is manually approved through the protected `azure-production` GitHub Environment and explicit workflow confirmation strings.

## Dependency Updates

Dependabot opens weekly PRs against `master` for:

- root pnpm dependencies
- `server/` pnpm dependencies
- GitHub Actions

Dependabot does not auto-merge and does not bypass PR checks.
