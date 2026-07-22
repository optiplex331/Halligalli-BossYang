"""Resolve work behind the stable Two-Gate CI jobs."""

import os
import re
import sys
from typing import Mapping

from release_utils import append_github_outputs

RELEASE_TAG_RE = re.compile(r"^v[0-9]+\.[0-9]+\.[0-9]+$")


def is_true(value: object) -> bool:
    return str(value).lower() == "true"


def is_release_tag(ref_type: str, ref_name: str) -> bool:
    return ref_type == "tag" and RELEASE_TAG_RE.fullmatch(ref_name or "") is not None


def resolve_routing(env: Mapping[str, str]) -> dict[str, str]:
    product_runtime = is_true(env.get("PRODUCT_RUNTIME", "false"))
    delivery_control = is_true(env.get("DELIVERY_CONTROL", "false"))
    event_name = env.get("GITHUB_EVENT_NAME", "")
    ref_type = env.get("GITHUB_REF_TYPE", "")
    ref_name = env.get("GITHUB_REF_NAME", "")
    tag_release = is_release_tag(ref_type, ref_name)
    workflow_dispatch = event_name == "workflow_dispatch"

    product_checks_required = product_runtime or workflow_dispatch
    delivery_control_checks_required = delivery_control or workflow_dispatch
    container_build_required = product_runtime or workflow_dispatch or tag_release

    return {
        "product_checks_required": str(product_checks_required).lower(),
        "delivery_control_checks_required": str(
            delivery_control_checks_required
        ).lower(),
        "container_build_required": str(container_build_required).lower(),
    }


def main() -> None:
    outputs = resolve_routing(os.environ)
    for line in append_github_outputs(outputs):
        print(line)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(error, file=sys.stderr)
        sys.exit(1)
