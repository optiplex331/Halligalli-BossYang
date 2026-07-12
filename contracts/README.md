# Shared Behavior Contract

`contracts/` contains language-neutral data only: versioned JSON fixtures,
schemas, and generated contract snapshots. It is not a package and contains no
runtime source code.

The Web TypeScript rules and the future Python Multiplayer Authority read these
fixtures independently. A fixture describes observable game behavior, not a
React, FastAPI, Socket.IO, Redis, or CSS implementation detail.
