# Security Policy

Halligalli Arena is a browser game and same-origin socket.io server. It does not require accounts, payments, or server-side persistence.

## Reporting

Please report security issues privately by emailing the repository owner or opening a minimal GitHub security advisory when available. Avoid posting exploit details in public issues before there is a fix.

## Supported Surface

- Client-side React app.
- Node.js socket.io server.
- Local browser progress stored in `localStorage`.
- Manual Azure Production application deployment workflow.

## Current Safety Boundaries

- No account system.
- No database.
- No server-side player profile storage.
- No payment or personal-data workflow.
- Multiplayer scoring is server-authoritative.
- Browser progress stays local to the device.
- Deployment secrets, generated config, and real cloud credentials are intentionally excluded from Git.

## Out Of Scope

- Vulnerabilities in unsupported local Node.js or browser versions.
- Third-party deployment account compromise.
- User-modified forks with changed infrastructure or credential handling.
