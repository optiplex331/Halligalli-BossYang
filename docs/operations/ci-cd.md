# CI/CD

Halligalli uses GitHub Actions as the product delivery control plane. Pull requests and normal pushes validate code, release metadata, delivery control files, and container images, but they do not create Azure resources or deploy application artifacts.

The selected AKS proof rollout is reviewed through the Infrastructure Repo's Azure Kubernetes Desired State: Release Tag -> paired Web/API GHCR images -> schema-V2 Release Attestation -> digest-pinned GitOps values -> Argo CD -> AKS.

The historical Azure Production application deployment path was Static Web Apps plus Container Apps. Its executable workflow and local backend rollout script have been removed from this product repo after AKS cutover, so the old path remains docs-only history.

## Pull Request Gates

Every pull request targeting `master` runs these required checks:

| Check | Workflow | Job | Proves |
|---|---|---|---|
| Product checks | `CI` | `Product checks` | The change received the right product, metadata, or control-plane validation for its type. |
| Container build and scan | `Container` | `Container build and scan` | The change received the right image validation for its type. |

PR checks do not publish images and do not mutate Azure. CI uses `package.json` as the `actions/setup-node` version source; the current product runtime baseline is Node.js 24.

The check names intentionally stay stable because branch protection depends on them. The work inside each check is routed by `dorny/paths-filter` and `.github/utils/change-filters.yaml`, not by workflow-level path filters. This avoids skipped workflows leaving required checks pending.

Short shell-native workflow orchestration stays in Bash, such as `git`, `docker`, `gh`, `curl`, Azure CLI calls, and environment checks. Structured release validation, GitHub output formatting, and non-trivial inline heredocs belong in dependency-free `.github/utils/*.py` scripts covered by Python's built-in `unittest`.

| Change type | Product checks | Container build and scan |
|---|---|---|
| Product/runtime PR | Validate release config and Python utility tests, install dependencies, run tests, typecheck, and build on Node.js 24. | Build the Web and API images and run Trivy. |
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

## Paired Release Images

The `Container` workflow builds and scans `apps/web/Dockerfile` and `apps/api/Dockerfile` from the same source commit for product/runtime PRs, `master` integration pushes, and release tags. The Web image serves the Vite build through nginx; the API image runs FastAPI with native WebSocket support and Redis-backed authority.

One Release Tag produces two immutable release images, for example:

```text
ghcr.io/<owner>/<repo>-web:X.Y.Z
ghcr.io/<owner>/<repo>-api:X.Y.Z
```

The pair shares the release version and source commit. It is the only deployable
production-shaped identity; a one-sided or mixed-version release is invalid.

Pull request runs do not publish images.

When the trigger is a normal `master` push that includes product runtime changes, the workflow publishes a Development GHCR Image tagged from the latest Release Tag, first-parent commit distance, and short commit hash:

```text
ghcr.io/<owner>/<repo>:X.Y.Z-000N-gSHA
```

Development GHCR Images are for traceability and rollback testing only. They do not feed active Azure Kubernetes Production. Docs-only and metadata-only `master` pushes do not publish them.

If the `master` push is exactly the same commit as a `vX.Y.Z` Release Tag, the workflow does not publish a duplicate `X.Y.Z-0000-gSHA` Development GHCR Image. The release-tagged `X.Y.Z` image is the canonical artifact for that commit.

When the trigger is a `vX.Y.Z` tag, the workflow publishes both release image identities without the `v` prefix:

```text
ghcr.io/<owner>/<repo>-web:X.Y.Z
ghcr.io/<owner>/<repo>-api:X.Y.Z
```

It does not publish `latest`. After both image pushes resolve immutable digests, the workflow writes schema-V2 `release-attestation.json` with the Release Tag, release commit, both image repositories and tags, both digests, and the shared runtime identity. A tag-only job uploads that file to the existing GitHub Release as a public Release asset. Workflow reruns reuse an identical asset and fail if the same asset name already contains different evidence; they never overwrite it.

Azure Kubernetes Desired State should consume the Release Attestation and independently verify both selected GHCR release images before Argo CD sync. Historical Container Apps deployment is not a maintained path.

The active digest handoff is:

1. Merge a Release PR.
2. Release Please creates `vX.Y.Z`.
3. The `Container` workflow builds, scans, and pushes the Web/API image pair from the same commit.
4. The workflow records both `sha256:<digest>` values and publishes schema-V2 `release-attestation.json` on the GitHub Release.
5. The Infrastructure Repo pulls the public asset, verifies exact provenance for both digests, runs a digest-pinned registry candidate smoke, validates the rendered chart, then creates or updates one Draft promotion PR.
6. A human reviews and merges the Infrastructure Repo promotion PR.
7. Argo CD reconciles the reviewed desired state into AKS; approved operations then prove every current Web/API Pod `imageID` matches the selected digest and run functional journeys.

The Child Repo has no Infrastructure write credential. The tag remains human-readable release context, the digest is the deployment selector, and the Infrastructure Repo remains the owner of production intent.

## Branch Protection

The protected `master` ruleset should require:

- `Product checks`
- `Container build and scan`

Do not add separate required checks for release metadata or Azure deployment. The
AKS proof rollout is reviewed through the Infrastructure Repo desired-state
change, not this product repo PR gate; the historical Azure Production workflow
should not become a branch-protection requirement.

## Dependency Updates

Dependabot opens weekly PRs against `master` for:

- root pnpm dependencies
- GitHub Actions

Dependabot does not auto-merge and does not bypass PR checks.
