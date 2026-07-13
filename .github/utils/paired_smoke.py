"""Validate that both Paired Runtime processes expose one release identity.

This script deliberately consumes captured JSON rather than making HTTP calls so
workflow shell remains responsible for local container lifecycle management.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any


class PairedSmokeError(ValueError):
    """Raised when a paired runtime is not ready or identities diverge."""


def _read_identity(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise PairedSmokeError(f"Cannot read runtime identity from {path}") from error
    if not isinstance(value, dict):
        raise PairedSmokeError(f"Runtime identity from {path} must be an object")
    return value


def validate_paired_runtime(
    *, web_identity: dict[str, Any], api_identity: dict[str, Any], version: str, commit: str
) -> None:
    expected = {"version": version, "commit": commit}
    if web_identity != expected or api_identity != expected:
        raise PairedSmokeError("Web and API must expose the same expected release identity")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--web-identity", type=Path, required=True)
    parser.add_argument("--api-identity", type=Path, required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()
    try:
        validate_paired_runtime(
            web_identity=_read_identity(args.web_identity),
            api_identity=_read_identity(args.api_identity),
            version=args.version,
            commit=args.commit,
        )
    except PairedSmokeError as error:
        print(error, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
