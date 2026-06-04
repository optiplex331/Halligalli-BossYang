# Rollback

Rollback for AWS Production Scaffold is an application deployment operation. Terraform should not be used for ordinary application rollback unless the infrastructure itself is broken.

## Preferred Rollback

1. Find a known-good GitHub Release, commit SHA, or previously deployed ECR image tag from workflow logs.
2. Run `AWS Production Scaffold` with `operation=deploy-backend`, `backend_image_tag=<known-good-tag>`, and `confirm_cost=AWS_PRODUCTION_APPLY` if the backend image is already in ECR.
3. If the known-good image is not in ECR, check out the known-good commit and run `deploy-backend` to build and push a fresh ECR image from that revision.
4. Run `operation=deploy-frontend` if frontend assets also need to roll back.
5. Run `operation=smoke-backend` with `expected_version` and `expected_commit` when those values are known.
6. Check the public frontend, `/readyz`, `/health`, and a socket.io multiplayer room.

## Emergency Containment

If production must recover before a clean redeploy can complete, use AWS console or CLI controls to point the ECS service at a previous healthy task definition revision, then follow with a normal `AWS Production Scaffold` workflow run so GitHub Actions logs capture the restored runtime identity.

## What Not To Do

- Do not push directly to `master`.
- Do not deploy `latest`.
- Do not run Terraform `destroy` as application rollback.
- Do not use untracked local `.env`, tfvars, task definition JSON, or AWS credentials as the source of truth.
- Do not bypass the protected `aws-production-scaffold` GitHub Environment for normal rollback.

## Verification

After rollback, run:

```bash
curl --fail --silent --show-error "$AWS_PRODUCTION_BACKEND_URL/readyz"
curl --fail --silent --show-error "$AWS_PRODUCTION_BACKEND_URL/health"
```

The `/health` response should report:

- `status: "ok"`
- the expected `version`
- the expected `commit`
- a reasonable `rooms` count
