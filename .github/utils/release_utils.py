"""Provide shared helpers for dependency-free release utility scripts.

Purpose:
- Centralize release identity validation and GitHub step-output formatting.
Inputs:
- Function arguments supplied by utility scripts under .github/utils.
- Optional environment: GITHUB_OUTPUT for GitHub Actions step outputs.
Outputs:
- Parsed health payloads, formatted key=value output lines, or typed failures.
Boundaries:
- Does not resolve workflow routing or image identity.
- Does not call the network, Docker, GitHub, Azure, or git.
"""

import json
import os
from typing import Any, Mapping, NoReturn, Optional


class ReleaseUtilityError(RuntimeError):
    """Raised when release workflow input or deployed runtime output is invalid."""

    pass


def fail(message: str) -> NoReturn:
    raise ReleaseUtilityError(message)


def check_health_release_identity(
    body: str,
    expected: Mapping[str, Optional[str]],
) -> dict[str, Any]:
    """Assert that a /health response exposes the expected release identity."""

    try:
        health: dict[str, Any] = json.loads(body)
    except json.JSONDecodeError:
        fail(f"Health response is not valid JSON: {body}")

    if health.get("status") != "ok":
        fail(f"Unexpected health status: {json.dumps(health, separators=(',', ':'))}")

    if (
        health.get("version") != expected.get("appVersion")
        or health.get("commit") != expected.get("commitSha")
    ):
        fail(
            "Release identity mismatch: "
            + json.dumps(
                {
                    "expectedVersion": expected.get("appVersion"),
                    "actualVersion": health.get("version"),
                    "expectedCommit": expected.get("commitSha"),
                    "actualCommit": health.get("commit"),
                },
                separators=(",", ":"),
            )
        )

    return health


def append_github_outputs(
    outputs: Mapping[str, object],
    output_path: Optional[str] = None,
) -> list[str]:
    """Append step outputs in GitHub's key=value format and echo them for logs."""

    lines = [f"{key}={value}" for key, value in outputs.items()]
    if output_path is None:
        output_path = os.environ.get("GITHUB_OUTPUT")

    if output_path:
        with open(output_path, "a", encoding="utf-8") as output_file:
            output_file.write("\n".join(lines) + "\n")

    return lines
