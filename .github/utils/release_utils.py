"""Write dependency-free utility results as GitHub step outputs."""

import os
from typing import Mapping, Optional


def append_github_outputs(
    outputs: Mapping[str, object], output_path: Optional[str] = None
) -> list[str]:
    lines = [f"{key}={value}" for key, value in outputs.items()]
    destination = (
        output_path if output_path is not None else os.environ.get("GITHUB_OUTPUT")
    )
    if destination:
        with open(destination, "a", encoding="utf-8") as output_file:
            output_file.write("\n".join(lines) + "\n")
    return lines
