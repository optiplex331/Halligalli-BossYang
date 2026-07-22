"""Resolve work behind the stable Two-Gate CI jobs."""

import os
import sys
from typing import Mapping

from release_utils import write_github_outputs


def is_true(value: object) -> bool:
    return str(value).lower() == "true"


def resolve_routing(env: Mapping[str, str]) -> dict[str, str]:
    product_runtime = is_true(env.get("PRODUCT_RUNTIME", "false"))
    delivery_control = is_true(env.get("DELIVERY_CONTROL", "false"))
    event_name = env.get("GITHUB_EVENT_NAME", "")
    ref_type = env.get("GITHUB_REF_TYPE", "")
    workflow_dispatch = event_name == "workflow_dispatch"

    product_checks_required = product_runtime or workflow_dispatch
    delivery_control_checks_required = delivery_control or workflow_dispatch
    container_build_required = product_runtime or workflow_dispatch or ref_type == "tag"

    return {
        "product_checks_required": str(product_checks_required).lower(),
        "delivery_control_checks_required": str(
            delivery_control_checks_required
        ).lower(),
        "container_build_required": str(container_build_required).lower(),
    }


def main() -> None:
    write_github_outputs(resolve_routing(os.environ))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(error, file=sys.stderr)
        sys.exit(1)
