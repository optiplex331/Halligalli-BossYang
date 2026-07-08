"""Validate a captured /health response against an expected release identity.

Purpose:
- Prove that the reachable runtime is the intended release artifact.
Inputs:
- Environment: HEALTH_RESPONSE, EXPECTED_VERSION, EXPECTED_COMMIT.
- Optional environment: SUCCESS_MESSAGE.
Outputs:
- Prints SUCCESS_MESSAGE when validation passes and the variable is set.
- Exits non-zero when the health payload is invalid or identity mismatches.
Boundaries:
- Does not perform HTTP requests.
- Does not deploy, roll back, or mutate runtime state.
"""

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
