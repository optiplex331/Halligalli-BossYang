"""Write dependency-free utility results as GitHub step outputs."""

import os
from typing import Mapping, Optional


def write_github_outputs(
    outputs: Mapping[str, object], output_path: Optional[str] = None
) -> None:
    destination = (
        output_path if output_path is not None else os.environ.get("GITHUB_OUTPUT")
    )
    if not destination:
        return
    with open(destination, "a", encoding="utf-8") as output_file:
        output_file.writelines(f"{key}={value}\n" for key, value in outputs.items())
