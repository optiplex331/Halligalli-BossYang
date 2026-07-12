# Halligalli API

This package owns the future FastAPI transport and Multiplayer Authority. It is
intentionally not a runnable server in the single-player migration slice.

The next implementation slice adds the REST entry surface, native WebSocket
transport, Participant Credentials, and Redis-backed authority state. This
package must not import Web source or browser APIs; it consumes only data from
`../../contracts/fixtures` in its own tests.
