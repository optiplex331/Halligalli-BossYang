"""Production Manifest helpers for release and drift workflows.

The manifest is a DigitalOcean App Platform YAML file, but these utilities stay
dependency-free so they can run on GitHub-hosted runners before the product
toolchain is installed. The parser below intentionally handles only the small
manifest shape that the release workflows own.
"""

import json
import os
import re
from pathlib import Path


DEFAULT_SERVICE_NAME = "web"


class ManifestError(RuntimeError):
    """Raised when the Production Manifest or live production shape is invalid."""

    pass


def fail(message):
    raise ManifestError(message)


def _unquote(value):
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


def _line_indent(line):
    return len(line) - len(line.lstrip(" "))


def _split_lines(text):
    return text.splitlines()


def _find_service_range(lines, service_name=DEFAULT_SERVICE_NAME):
    """Return the line range for the single service owned by release workflows."""

    try:
        services_index = next(
            index for index, line in enumerate(lines) if line.strip() == "services:"
        )
    except StopIteration:
        fail("Production Manifest must define services")

    matches = []

    for index in range(services_index + 1, len(lines)):
        line = lines[index]
        service_match = re.match(r"^(\s*)-\s+name:\s*(.+)$", line)

        if service_match:
            name = _unquote(service_match.group(2))
            if name == service_name:
                matches.append({"index": index, "indent": len(service_match.group(1))})
            continue

        if re.match(r"^\S", line) and line.strip() != "":
            break

    if len(matches) != 1:
        fail(f"Production Manifest must define exactly one {service_name} service")

    start = matches[0]["index"]
    indent = matches[0]["indent"]
    end = len(lines)

    for index in range(start + 1, len(lines)):
        line = lines[index]
        service_match = re.match(r"^(\s*)-\s+name:\s*(.+)$", line)

        if service_match and len(service_match.group(1)) == indent:
            end = index
            break

        if re.match(r"^\S", line) and line.strip() != "":
            end = index
            break

    return {"start": start, "end": end}


def _find_nested_block(lines, block_range, key):
    """Find a required nested YAML block inside a known parent line range."""

    matches = []

    for index in range(block_range["start"] + 1, block_range["end"]):
        if lines[index].strip() == f"{key}:":
            matches.append({"start": index, "indent": _line_indent(lines[index])})

    if len(matches) != 1:
        fail(f"Production Manifest web service must define exactly one {key} block")

    block = matches[0]
    end = block_range["end"]

    for index in range(block["start"] + 1, block_range["end"]):
        line = lines[index]
        if line.strip() == "":
            continue

        if _line_indent(line) <= block["indent"] and not line.strip().startswith("- "):
            end = index
            break

    return {"start": block["start"], "end": end, "indent": block["indent"]}


def _read_scalar_from_block(lines, block, key, required=True):
    """Read one scalar key from a parsed block and report duplicate/missing keys."""

    matches = []
    pattern = re.compile(rf"^\s*{re.escape(key)}:\s*(.*)$")

    for index in range(block["start"] + 1, block["end"]):
        match = pattern.match(lines[index])
        if match and _line_indent(lines[index]) > block["indent"]:
            matches.append({"index": index, "value": _unquote(match.group(1))})

    if len(matches) == 0 and not required:
        return None

    if len(matches) != 1:
        fail(f"Production Manifest {key} must appear exactly once in the web image block")

    return matches[0]


def _find_env_value_line(lines, env_block, key):
    """Find the value line for a named DO env var entry.

    The updater preserves the rest of the YAML file by replacing only this line.
    """

    matches = []

    for index in range(env_block["start"] + 1, env_block["end"]):
        key_match = re.match(r"^\s*-\s+key:\s*(.+)$", lines[index])
        if not key_match or _unquote(key_match.group(1)) != key:
            continue

        value_line = -1
        value = ""

        for next_index in range(index + 1, env_block["end"]):
            if re.match(r"^\s*-\s+key:\s*", lines[next_index]):
                break

            value_match = re.match(r"^\s*value:\s*(.*)$", lines[next_index])
            if value_match:
                value_line = next_index
                value = _unquote(value_match.group(1))
                break

        if value_line == -1:
            fail(f"Production Manifest env {key} must define a value")

        matches.append({"index": value_line, "value": value})

    if len(matches) != 1:
        fail(f"Production Manifest must define exactly one {key} env value")

    return matches[0]


def read_production_manifest(text):
    """Read release identity and editable line indexes from manifest text."""

    lines = _split_lines(text)
    service = _find_service_range(lines)
    image_block = _find_nested_block(lines, service, "image")
    env_block = _find_nested_block(lines, service, "envs")

    registry_type = _read_scalar_from_block(lines, image_block, "registry_type")
    registry = _read_scalar_from_block(lines, image_block, "registry")
    repository = _read_scalar_from_block(lines, image_block, "repository")
    digest = _read_scalar_from_block(lines, image_block, "digest")
    tag = _read_scalar_from_block(lines, image_block, "tag", required=False)
    version = _find_env_value_line(lines, env_block, "APP_VERSION")
    commit = _find_env_value_line(lines, env_block, "COMMIT_SHA")

    return {
        "lines": lines,
        "image": {
            "registry_type": registry_type["value"],
            "registry": registry["value"],
            "repository": repository["value"],
            "digest": digest["value"],
            "tag": tag["value"] if tag else "",
        },
        "identity": {
            "imageDigest": digest["value"],
            "appVersion": version["value"],
            "commitSha": commit["value"],
        },
        "lineIndexes": {
            "digest": digest["index"],
            "appVersion": version["index"],
            "commitSha": commit["index"],
        },
    }


def read_production_manifest_file(path):
    return read_production_manifest(Path(path).read_text(encoding="utf-8"))


def read_release_identity(path):
    return read_production_manifest_file(path)["identity"]


def validate_production_manifest(path):
    """Validate invariants required before a manifest can represent production."""

    manifest = read_production_manifest_file(path)

    if manifest["image"]["registry_type"] != "GHCR":
        fail("Production Manifest must reference GHCR")

    if not manifest["image"]["digest"].startswith("sha256:"):
        fail("Production Manifest must use image.digest")

    if manifest["image"]["tag"]:
        fail("Production Manifest must not use image.tag")

    if not manifest["identity"]["appVersion"]:
        fail("Production Manifest must set APP_VERSION")

    if not manifest["identity"]["commitSha"]:
        fail("Production Manifest must set COMMIT_SHA")


def write_release_identity(path, identity):
    """Replace only the production image digest and runtime release identity."""

    target = Path(path)
    current = target.read_text(encoding="utf-8")
    manifest = read_production_manifest(current)
    lines = list(manifest["lines"])

    replacements = {
        "digest": identity.get("imageDigest"),
        "appVersion": identity.get("appVersion"),
        "commitSha": identity.get("commitSha"),
    }

    if not replacements["digest"] or not replacements["digest"].startswith("sha256:"):
        fail("IMAGE_DIGEST must be a sha256 digest")

    if not replacements["appVersion"]:
        fail("VERSION must be set")

    if not replacements["commitSha"]:
        fail("COMMIT_SHA must be set")

    lines[manifest["lineIndexes"]["digest"]] = re.sub(
        r"digest:\s*.*$", f"digest: {replacements['digest']}", lines[manifest["lineIndexes"]["digest"]]
    )
    lines[manifest["lineIndexes"]["appVersion"]] = re.sub(
        r"value:\s*.*$",
        f"value: {replacements['appVersion']}",
        lines[manifest["lineIndexes"]["appVersion"]],
    )
    lines[manifest["lineIndexes"]["commitSha"]] = re.sub(
        r"value:\s*.*$",
        f"value: {replacements['commitSha']}",
        lines[manifest["lineIndexes"]["commitSha"]],
    )

    newline = "\n" if current.endswith("\n") else ""
    target.write_text("\n".join(lines).rstrip("\n") + newline, encoding="utf-8")


def _web_service(spec):
    """Return the live web service from either raw or wrapped DO app specs."""

    if not isinstance(spec, dict):
        fail("Live production spec must be an object")

    services = spec.get("services")
    if not isinstance(services, list):
        nested_spec = spec.get("spec")
        services = nested_spec.get("services") if isinstance(nested_spec, dict) else None

    if not isinstance(services, list):
        fail("Live production spec must define services")

    matches = [service for service in services if service.get("name") == DEFAULT_SERVICE_NAME]

    if len(matches) != 1:
        fail(f"Live production spec must define exactly one {DEFAULT_SERVICE_NAME} service")

    return matches[0]


def _env_map(service):
    """Convert DigitalOcean env entries into a key/value map for comparison."""

    envs = service.get("envs")
    if not isinstance(envs, list):
        fail("Live production web service must define envs")

    return {str(env.get("key")): str(env.get("value", "")) for env in envs}


def _json_string(value):
    return json.dumps(value, separators=(",", ":"))


def compare_production_manifest_to_live_spec(manifest_text, live_spec):
    """Compare Git-tracked desired production state with the live DO app spec."""

    desired = read_production_manifest(manifest_text)
    live_web = _web_service(live_spec)
    live_image = live_web.get("image") or {}
    live_env = _env_map(live_web)

    comparisons = [
        ("image.registry_type", desired["image"]["registry_type"], live_image.get("registry_type")),
        ("image.registry", desired["image"]["registry"], live_image.get("registry")),
        ("image.repository", desired["image"]["repository"], live_image.get("repository")),
        ("image.digest", desired["image"]["digest"], live_image.get("digest")),
        ("APP_VERSION", desired["identity"]["appVersion"], live_env.get("APP_VERSION")),
        ("COMMIT_SHA", desired["identity"]["commitSha"], live_env.get("COMMIT_SHA")),
    ]

    drift = [
        f"{field}: expected {_json_string(expected)}, got {_json_string(actual)}"
        for field, expected, actual in comparisons
        if expected != actual
    ]

    return {"drift": drift, "identity": desired["identity"]}


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
