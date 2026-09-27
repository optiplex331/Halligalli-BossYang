from __future__ import annotations

import unittest
from dataclasses import dataclass

from halligalli_api.app import RoomSocketHub, forward_room_revisions
from halligalli_api.authority import AuthorityError, Viewer


@dataclass
class _Snapshot:
    revision: int

    def model_dump(self, *, by_alias: bool) -> dict[str, int]:
        return {"revision": self.revision}


class _Socket:
    def __init__(self) -> None:
        self.sent: list[dict] = []

    async def send_json(self, payload: dict) -> None:
        self.sent.append(payload)


class _Authority:
    """Counts room reads so a test can see how many Redis round trips a publish costs."""

    def __init__(self, revision: int) -> None:
        self.revision = revision
        self.room_reads = 0

    async def snapshots(self, room_code: str, viewers: list[Viewer]) -> list[_Snapshot | AuthorityError]:
        self.room_reads += 1
        return [_Snapshot(self.revision) for _ in viewers]


async def _events(*items: tuple[str, int | None]):
    for item in items:
        yield item


class RoomSocketHubTest(unittest.IsolatedAsyncioTestCase):
    async def test_one_room_read_serves_every_attached_socket(self) -> None:
        hub = RoomSocketHub()
        sockets = [_Socket() for _ in range(4)]
        for index, socket in enumerate(sockets):
            hub.attach("ROOM", socket, f"credential-{index}", revision=1)
        authority = _Authority(revision=2)

        await hub.publish("ROOM", authority)

        self.assertEqual(authority.room_reads, 1)
        self.assertEqual([len(socket.sent) for socket in sockets], [1, 1, 1, 1])

    async def test_forwarder_skips_a_revision_every_socket_already_holds(self) -> None:
        hub = RoomSocketHub()
        hub.attach("ROOM", _Socket(), "host", revision=5)
        hub.attach("ROOM", _Socket(), "guest", revision=5)
        authority = _Authority(revision=5)

        await forward_room_revisions(_events(("ROOM", 5)), hub, authority)

        self.assertEqual(authority.room_reads, 0)

    async def test_forwarder_still_serves_a_socket_behind_the_published_revision(self) -> None:
        hub = RoomSocketHub()
        current = _Socket()
        late_joiner = _Socket()
        hub.attach("ROOM", current, "host", revision=5)
        # Attached from a snapshot read before the write that published revision 5.
        hub.attach("ROOM", late_joiner, "guest", revision=4)
        authority = _Authority(revision=5)

        await forward_room_revisions(_events(("ROOM", 5)), hub, authority)

        self.assertEqual(authority.room_reads, 1)
        self.assertEqual(current.sent, [])
        self.assertEqual(late_joiner.sent, [{"type": "snapshot", "snapshot": {"revision": 5}}])

    async def test_forwarder_publishes_when_the_revision_is_unknown(self) -> None:
        hub = RoomSocketHub()
        socket = _Socket()
        hub.attach("ROOM", socket, "host", revision=5)
        authority = _Authority(revision=6)

        await forward_room_revisions(_events(("ROOM", None)), hub, authority)

        self.assertEqual(len(socket.sent), 1)


if __name__ == "__main__":
    unittest.main()
