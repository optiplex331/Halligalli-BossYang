"""Provider-neutral helpers for release and deployment workflows."""

import json
import os


class ReleaseUtilityError(RuntimeError):
    """Raised when release workflow input or deployed runtime output is invalid."""

    pass


def fail(message):
    raise ReleaseUtilityError(message)


def check_health_release_identity(body, expected):
    """Assert that a /health response exposes the expected release identity."""

    try:
        health = json.loads(body)
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


def append_github_outputs(outputs, output_path=None):
    """Append step outputs in GitHub's key=value format and echo them for logs."""

    lines = [f"{key}={value}" for key, value in outputs.items()]
    output_path = output_path if output_path is not None else os.environ.get("GITHUB_OUTPUT")

    if output_path:
        with open(output_path, "a", encoding="utf-8") as output_file:
            output_file.write("\n".join(lines) + "\n")

    return lines
