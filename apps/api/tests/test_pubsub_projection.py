from __future__ import annotations

import unittest

from halligalli_api.app import RoomSocketHub, forward_room_revisions
from halligalli_api.authority import ParticipantSnapshot, RoomSnapshot, Viewer


class _Socket:
    def __init__(self) -> None:
        self.messages: list[dict[str, object]] = []

    async def send_json(self, message: dict[str, object]) -> None:
        self.messages.append(message)


class _ViewerAuthority:
    async def snapshot(self, room_code: str, viewer: Viewer) -> RoomSnapshot:
        return RoomSnapshot(
            room_code=room_code,
            revision=4,
            phase="lobby",
            min_participants=2,
            max_participants=6,
            viewer_seat_index=0 if viewer.credential == "host" else 1,
            participants=[
                ParticipantSnapshot(name="Host", seat_index=0),
                ParticipantSnapshot(name="Guest", seat_index=1),
            ],
        )


async def _one_revision():
    yield "ABCD"


class PubSubProjectionTest(unittest.IsolatedAsyncioTestCase):
    async def test_revision_hint_projects_current_viewer_specific_snapshots(self) -> None:
        hub = RoomSocketHub()
        host_socket, guest_socket = _Socket(), _Socket()
        hub.attach("ABCD", host_socket, "host", revision=3)
        hub.attach("ABCD", guest_socket, "guest", revision=3)

        await forward_room_revisions(_one_revision(), hub, _ViewerAuthority())

        self.assertEqual(host_socket.messages[0]["snapshot"]["viewerSeatIndex"], 0)
        self.assertEqual(guest_socket.messages[0]["snapshot"]["viewerSeatIndex"], 1)
        self.assertEqual(host_socket.messages[0]["snapshot"]["revision"], 4)
