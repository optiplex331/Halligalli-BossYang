"""Write the manifest that binds one formal Paired Release."""

import argparse
import json
from pathlib import Path
from typing import Any


def build_paired_release_manifest(
    *, tag: str, commit: str, web_image: str, web_digest: str, api_image: str, api_digest: str
) -> dict[str, Any]:
    """Bind workflow-owned release values; attestations remain provenance."""

    version = tag.removeprefix("v")
    return {
        "schemaVersion": 2,
        "releaseTag": tag,
        "commit": commit,
        "images": {
            "web": {"repository": web_image, "tag": version, "digest": web_digest},
            "api": {"repository": api_image, "tag": version, "digest": api_digest},
        },
        "runtimeIdentity": {"version": version, "commit": commit},
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    for name in ("tag", "commit", "web-image", "web-digest", "api-image", "api-digest", "output"):
        parser.add_argument(f"--{name}", required=True)
    args = parser.parse_args()
    manifest = build_paired_release_manifest(
        tag=args.tag,
        commit=args.commit,
        web_image=args.web_image,
        web_digest=args.web_digest,
        api_image=args.api_image,
        api_digest=args.api_digest,
    )
    Path(args.output).write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
