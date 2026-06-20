"""Resolve CI check routing from GitHub context and changed file groups."""

import os
import re
import sys

from release_utils import append_github_outputs


RELEASE_TAG_RE = re.compile(r"^v[0-9]+\.[0-9]+\.[0-9]+$")


def is_true(value):
    return str(value).lower() == "true"


def is_release_tag(ref_type, ref_name):
    return ref_type == "tag" and RELEASE_TAG_RE.fullmatch(ref_name or "") is not None


def resolve_routing(env):
    product_runtime = is_true(env.get("PRODUCT_RUNTIME", "false"))
    delivery_control = is_true(env.get("DELIVERY_CONTROL", "false"))
    release_metadata = is_true(env.get("RELEASE_METADATA", "false"))
    event_name = env.get("GITHUB_EVENT_NAME", "")
    ref_type = env.get("GITHUB_REF_TYPE", "")
    ref_name = env.get("GITHUB_REF_NAME", "")

    tag_release = is_release_tag(ref_type, ref_name)
    workflow_dispatch = event_name == "workflow_dispatch"

    product_checks_required = product_runtime
    delivery_control_checks_required = delivery_control
    container_build_required = product_runtime

    if workflow_dispatch:
        product_checks_required = True
        delivery_control_checks_required = True
        container_build_required = True

    if tag_release:
        container_build_required = True

    if tag_release:
        classification = "release-tag"
    elif workflow_dispatch:
        classification = "workflow-dispatch"
    elif product_runtime:
        classification = "product-runtime"
    elif delivery_control:
        classification = "delivery-control"
    elif release_metadata:
        classification = "release-metadata"
    else:
        classification = "metadata-or-docs"

    return {
        "classification": classification,
        "product_runtime": str(product_runtime).lower(),
        "delivery_control": str(delivery_control).lower(),
        "release_metadata": str(release_metadata).lower(),
        "product_checks_required": str(product_checks_required).lower(),
        "delivery_control_checks_required": str(delivery_control_checks_required).lower(),
        "container_build_required": str(container_build_required).lower(),
    }


def main():
    outputs = resolve_routing(os.environ)
    for line in append_github_outputs(outputs):
        print(line)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(error, file=sys.stderr)
        sys.exit(1)
