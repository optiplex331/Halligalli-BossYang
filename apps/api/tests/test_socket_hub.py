from __future__ import annotations

import unittest
from dataclasses import dataclass

from starlette.websockets import WebSocketState

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
        self.close_code: int | None = None
        self.application_state = WebSocketState.CONNECTED

    async def send_json(self, payload: dict) -> None:
        self.sent.append(payload)

    async def close(self, code: int) -> None:
        self.close_code = code
        self.application_state = WebSocketState.DISCONNECTED


class _Authority:
    """Counts room reads so a test can see how many Redis round trips a publish costs."""

    def __init__(self, revision: int, *, room_error: AuthorityError | None = None, departed: frozenset[str] = frozenset()) -> None:
        self.revision = revision
        self.room_reads = 0
        self.room_error = room_error
        self.departed = departed

    async def snapshots(self, room_code: str, viewers: list[Viewer]) -> list[_Snapshot | AuthorityError]:
        self.room_reads += 1
        if self.room_error is not None:
            raise self.room_error
        return [
            AuthorityError("credential_invalid", 401, "Participant credential is invalid")
            if viewer.credential in self.departed
            else _Snapshot(self.revision)
            for viewer in viewers
        ]


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

    async def test_a_lost_room_closes_its_sockets_with_the_reason(self) -> None:
        hub = RoomSocketHub()
        sockets = [_Socket(), _Socket()]
        for index, socket in enumerate(sockets):
            hub.attach("ROOM", socket, f"credential-{index}", revision=3)
        lost = _Authority(revision=3, room_error=AuthorityError("room_not_found", 404, "Room was not found"))

        await hub.publish_all(lost)

        for socket in sockets:
            self.assertEqual(socket.sent[-1]["code"], "room_not_found")
            self.assertEqual(socket.close_code, 1008)
        self.assertEqual(hub.socket_count(), 0)

    async def test_a_departed_participant_is_closed_and_the_rest_are_served(self) -> None:
        hub = RoomSocketHub()
        departed = _Socket()
        staying = _Socket()
        hub.attach("ROOM", departed, "gone", revision=3)
        hub.attach("ROOM", staying, "here", revision=3)

        await hub.publish("ROOM", _Authority(revision=4, departed=frozenset({"gone"})))

        self.assertEqual(departed.close_code, 1008)
        self.assertEqual(staying.sent, [{"type": "snapshot", "snapshot": {"revision": 4}}])
        self.assertEqual(hub.socket_count(), 1)

    async def test_a_temporary_failure_keeps_every_socket_attached(self) -> None:
        hub = RoomSocketHub()
        socket = _Socket()
        hub.attach("ROOM", socket, "host", revision=3)
        unavailable = _Authority(revision=4, room_error=AuthorityError("authority_unavailable", 503, "Try again"))

        await hub.publish("ROOM", unavailable)

        self.assertEqual((socket.sent, socket.close_code, hub.socket_count()), ([], None, 1))


if __name__ == "__main__":
    unittest.main()
