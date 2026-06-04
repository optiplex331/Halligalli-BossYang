#!/usr/bin/env python3
"""Generate private Terraform config files for AWS Production CI."""

from __future__ import annotations

import json
import os
from pathlib import Path


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Set {name} in the aws-production GitHub environment.")
    return value


def optional(name: str) -> str | None:
    value = os.environ.get(name, "").strip()
    return value or None


def optional_bool(name: str) -> bool | None:
    value = optional(name)
    if value is None:
        return None
    normalized = value.lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise SystemExit(f"{name} must be a boolean-like value.")


def optional_int(name: str) -> int | None:
    value = optional(name)
    if value is None:
        return None
    try:
        return int(value)
    except ValueError as error:
        raise SystemExit(f"{name} must be an integer.") from error


def oidc_subjects() -> list[str]:
    raw = required("AWS_PRODUCTION_GITHUB_OIDC_SUBJECTS")
    if raw.startswith("["):
        parsed = json.loads(raw)
        if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
            raise SystemExit("AWS_PRODUCTION_GITHUB_OIDC_SUBJECTS must be a JSON string array.")
        return parsed
    return [item.strip() for item in raw.replace("\n", ",").split(",") if item.strip()]


def put_if_present(config: dict[str, object], key: str, value: object | None) -> None:
    if value is not None:
        config[key] = value


def main() -> None:
    operation = required("AWS_PRODUCTION_TERRAFORM_OPERATION")
    backend_path = Path(required("TERRAFORM_BACKEND_CONFIG_PATH"))
    tfvars_path = Path(required("TERRAFORM_TFVARS_JSON_PATH"))

    organization = required("HCP_TERRAFORM_ORGANIZATION")
    workspace = required("HCP_TERRAFORM_WORKSPACE")

    backend_path.write_text(
        f'organization = "{organization}"\n\nworkspaces {{\n  name = "{workspace}"\n}}\n',
        encoding="utf-8",
    )

    desired_count = optional_int("AWS_PRODUCTION_BACKEND_DESIRED_COUNT")
    if operation == "scale-down":
        desired_count = 0

    config: dict[str, object] = {
        "domain_name": required("AWS_PRODUCTION_DOMAIN_NAME"),
        "route53_zone_id": required("AWS_PRODUCTION_ROUTE53_ZONE_ID"),
        "backend_certificate_arn": required("AWS_PRODUCTION_BACKEND_CERTIFICATE_ARN"),
        "github_repository": required("AWS_PRODUCTION_GITHUB_REPOSITORY"),
        "github_oidc_subjects": oidc_subjects(),
    }

    put_if_present(config, "project_name", optional("AWS_PRODUCTION_PROJECT_NAME"))
    put_if_present(config, "aws_region", optional("AWS_PRODUCTION_AWS_REGION"))
    put_if_present(config, "frontend_subdomain", optional("AWS_PRODUCTION_FRONTEND_SUBDOMAIN"))
    put_if_present(config, "backend_subdomain", optional("AWS_PRODUCTION_BACKEND_SUBDOMAIN"))
    put_if_present(config, "frontend_cloudfront_enabled", optional_bool("AWS_PRODUCTION_FRONTEND_CLOUDFRONT_ENABLED"))
    put_if_present(config, "backend_image_tag", optional("AWS_PRODUCTION_BACKEND_IMAGE_TAG"))
    put_if_present(config, "backend_desired_count", desired_count)
    put_if_present(config, "backend_task_cpu", optional_int("AWS_PRODUCTION_BACKEND_TASK_CPU"))
    put_if_present(config, "backend_task_memory", optional_int("AWS_PRODUCTION_BACKEND_TASK_MEMORY"))
    put_if_present(config, "backend_app_version", optional("AWS_PRODUCTION_BACKEND_APP_VERSION"))
    put_if_present(config, "backend_commit_sha", optional("AWS_PRODUCTION_BACKEND_COMMIT_SHA"))
    put_if_present(config, "github_oidc_provider_arn", optional("AWS_PRODUCTION_GITHUB_OIDC_PROVIDER_ARN"))

    tfvars_path.write_text(json.dumps(config, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Wrote Terraform backend config to {backend_path}")
    print(f"Wrote Terraform tfvars JSON to {tfvars_path}")


if __name__ == "__main__":
    main()
