from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from halligalli_api.app import create_app
from redis_test_case import RedisTestCase


class ReleaseIdentityTest(RedisTestCase):
    def test_runtime_environment_cannot_rewrite_build_identity(self) -> None:
        with patch.dict(
            "os.environ",
            {
                "HALLIGALLI_RELEASE_VERSION": "9.9.9",
                "HALLIGALLI_RELEASE_COMMIT": "f" * 40,
            },
        ):
            with TestClient(create_app(self.authority)) as client:
                response = client.get("/internal/identity")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"version": "local", "commit": "development"},
        )


if __name__ == "__main__":
    unittest.main()
