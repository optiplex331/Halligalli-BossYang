# CI/CD

Halligalli uses GitHub Actions as the product delivery control plane. Pull requests and normal pushes validate code, release metadata, delivery control files, and container images, but they do not create Azure resources or deploy application artifacts.

Active production rollout is reviewed through the infrastructure repo's Azure Kubernetes Desired State: Release Tag -> standalone GHCR image -> digest-pinned GitOps values -> Argo CD -> AKS.

The historical Azure Production application deployment path was Static Web Apps plus Container Apps. Its executable workflow and local backend rollout script have been removed from this product repo after AKS cutover, so the old path remains docs-only history.

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
| Product/runtime PR | Validate release config and Python utility tests, install dependencies, run tests, typecheck, and build on Node.js 24. | Build the Node.js 24 standalone image and run Trivy. |
| Delivery control PR | Validate release config and utility tests, then run actionlint for GitHub Actions workflows. Skip heavy product work. | Skip image build work. |
| Release PR | Validate release config and utility tests. Skip heavy product work. | Skip image build work. |
| Docs or other metadata PR | Validate release config and utility tests. Skip heavy product work. | Skip image build work. |
| Docs or metadata `master` push | Validate release config and utility tests. Skip heavy product work. | Skip image build and do not publish a Development GHCR Image. |

Utility tests run unconditionally in the `Product checks` gate and do not require `pnpm install`.

## Azure Production History

The Child Repo no longer carries a runnable Azure Production workflow or Container Apps backend rollout script. The old `azure-production` environment, Static Web Apps token, split-origin backend URL, and Container Apps smoke shape are historical context only.

Terraform `plan`, `apply`, `scale-down`, and `destroy` are separate from product deployment.

Azure Production history is documented in [Azure Production History](azure-production.md). Do not reintroduce a mutating Static Web Apps or Container Apps workflow unless a future ADR explicitly reverses the AKS-only production decision.

## Release PR

Every push to `master` runs Release Please. It opens or updates a human-reviewed Release PR and maintains:

- `CHANGELOG.md`
- `.github/utils/.release-please-manifest.json`

The Release PR does not make `package.json` the version source. Merging the Release PR creates a `vX.Y.Z` Release Tag and GitHub Release.

Release Please uses `HALLIGALLI_RELEASE_BOT_TOKEN` so the generated PR can trigger follow-on checks and workflows.

## Release Image

The `Container` workflow builds and scans the Dockerfile `standalone` target for product/runtime PRs, `master` integration pushes, and release tags. The standalone target packages the built Vite frontend, the Node.js 24 server, shared runtime modules, production dependencies, `/readyz`, `/health`, and socket.io in one image for Azure Kubernetes Production.

Container Apps backend-only images are historical after the AKS cutover. The canonical `ghcr.io/<owner>/<repo>:X.Y.Z` Release Image now means the standalone AKS image.

Pull request runs do not publish images.

When the trigger is a normal `master` push that includes product runtime changes, the workflow publishes a Development GHCR Image tagged from the latest Release Tag, first-parent commit distance, and short commit hash:

```text
ghcr.io/<owner>/<repo>:X.Y.Z-000N-gSHA
```

Development GHCR Images are for traceability and rollback testing only. They do not feed active Azure Kubernetes Production. Docs-only and metadata-only `master` pushes do not publish them.

If the `master` push is exactly the same commit as a `vX.Y.Z` Release Tag, the workflow does not publish a duplicate `X.Y.Z-0000-gSHA` Development GHCR Image. The release-tagged `X.Y.Z` image is the canonical artifact for that commit.

When the trigger is a `vX.Y.Z` tag, the workflow publishes the release image identity without the `v` prefix:

```text
ghcr.io/<owner>/<repo>:X.Y.Z
```

It does not publish `latest`. Azure Kubernetes Desired State should resolve the selected GHCR standalone Release Image to a digest before Argo CD sync. Historical Container Apps backend deployment is not a maintained path after AKS cutover.

## Branch Protection

The protected `master` ruleset should require:

- `Product checks`
- `Container build and scan`

Do not add separate required checks for release metadata or Azure deployment. Active production rollout is reviewed through the infrastructure repo desired-state change, not this product repo PR gate; the historical Azure Production workflow should not become a branch-protection requirement.

## Dependency Updates

Dependabot opens weekly PRs against `master` for:

- root pnpm dependencies
- `server/` pnpm dependencies
- GitHub Actions

Dependabot does not auto-merge and does not bypass PR checks.
