# End-to-End Journeys

This directory owns the small Compose-level journeys that cross the deployed
Web/API seam. Start the stack with `pnpm run dev`, then run `pnpm run test:e2e`.
The script reaches the API through Web's same-origin proxy and covers duplicate
room creation, four-seat/two-human, eight-seat/two-human, eight-seat/eight-human,
WebSocket reconnect, and sequential-room journeys. Web-only behavior tests stay
with `apps/web`; API module tests stay with `apps/api`.
