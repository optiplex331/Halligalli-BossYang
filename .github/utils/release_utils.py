"""Provider-neutral helpers for release and deployment workflows."""

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
    output_path = output_path if output_path is not None else os.environ.get("GITHUB_OUTPUT")

    if output_path:
        with open(output_path, "a", encoding="utf-8") as output_file:
            output_file.write("\n".join(lines) + "\n")

    return lines
