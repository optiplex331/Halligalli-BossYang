#!/usr/bin/env python3
"""Generate private Terraform config files for Azure Production Scaffold CI."""

from __future__ import annotations

import json
import os
from pathlib import Path


ENVIRONMENT_NAME = "azure-production-scaffold"


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Set {name} in the {ENVIRONMENT_NAME} GitHub environment.")
    return value


def optional(name: str) -> str | None:
    value = os.environ.get(name, "").strip()
    return value or None


def optional_int(name: str) -> int | None:
    value = optional(name)
    if value is None:
        return None
    try:
        return int(value)
    except ValueError as error:
        raise SystemExit(f"{name} must be an integer.") from error


def put_if_present(config: dict[str, object], key: str, value: object | None) -> None:
    if value is not None:
        config[key] = value


def main() -> None:
    operation = required("AZURE_PRODUCTION_TERRAFORM_OPERATION")
    backend_path = Path(required("TERRAFORM_BACKEND_CONFIG_PATH"))
    tfvars_path = Path(required("TERRAFORM_TFVARS_JSON_PATH"))

    organization = required("HCP_TERRAFORM_ORGANIZATION")
    workspace = required("HCP_TERRAFORM_WORKSPACE")

    backend_path.write_text(
        f'organization = "{organization}"\n\nworkspaces {{\n  name = "{workspace}"\n}}\n',
        encoding="utf-8",
    )

    backend_min_replicas = optional_int("AZURE_PRODUCTION_BACKEND_MIN_REPLICAS")
    if operation == "scale-down":
        backend_min_replicas = 0

    config: dict[str, object] = {
        "domain_name": required("AZURE_PRODUCTION_DOMAIN_NAME"),
        "github_repository": required("AZURE_PRODUCTION_GITHUB_REPOSITORY"),
    }

    put_if_present(config, "project_name", optional("AZURE_PRODUCTION_PROJECT_NAME"))
    put_if_present(config, "azure_region", optional("AZURE_PRODUCTION_REGION"))
    put_if_present(config, "static_web_app_location", optional("AZURE_PRODUCTION_STATIC_WEB_APP_LOCATION"))
    put_if_present(config, "frontend_subdomain", optional("AZURE_PRODUCTION_FRONTEND_SUBDOMAIN"))
    put_if_present(config, "backend_subdomain", optional("AZURE_PRODUCTION_BACKEND_SUBDOMAIN"))
    put_if_present(config, "resource_group_name", optional("AZURE_PRODUCTION_RESOURCE_GROUP_NAME"))
    put_if_present(config, "static_web_app_name", optional("AZURE_PRODUCTION_STATIC_WEB_APP_NAME"))
    put_if_present(config, "backend_image", optional("AZURE_PRODUCTION_BACKEND_IMAGE"))
    put_if_present(config, "backend_min_replicas", backend_min_replicas)
    put_if_present(config, "backend_max_replicas", optional_int("AZURE_PRODUCTION_BACKEND_MAX_REPLICAS"))
    put_if_present(config, "backend_app_version", optional("AZURE_PRODUCTION_BACKEND_APP_VERSION"))
    put_if_present(config, "backend_commit_sha", optional("AZURE_PRODUCTION_BACKEND_COMMIT_SHA"))
    put_if_present(config, "azure_deploy_principal_id", optional("AZURE_DEPLOY_PRINCIPAL_ID"))

    tfvars_path.write_text(json.dumps(config, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Wrote Terraform backend config to {backend_path}")
    print(f"Wrote Terraform tfvars JSON to {tfvars_path}")


if __name__ == "__main__":
    main()
