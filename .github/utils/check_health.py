import os
import sys

from production_manifest import ManifestError, check_health_release_identity


def main():
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
    except ManifestError as error:
        print(error, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
