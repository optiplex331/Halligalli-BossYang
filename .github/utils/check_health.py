"""Validate a deployed /health payload against the expected release identity."""

import os
import sys

from release_utils import ReleaseUtilityError, check_health_release_identity


def main() -> None:
    """Read HEALTH_RESPONSE and expected identity values from the environment."""

    try:
        check_health_release_identity(
            os.environ.get("HEALTH_RESPONSE", ""),
            {
                "appVersion": os.environ.get("EXPECTED_VERSION"),
                "commitSha": os.environ.get("EXPECTED_COMMIT"),
            },
        )

        success_message = os.environ.get("SUCCESS_MESSAGE")
        if success_message:
            print(success_message)
    except ReleaseUtilityError as error:
        print(error, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
