# Security Policy

Halligalli Arena is a browser game moving to a paired Web/FastAPI runtime. It does not require accounts, payments, or durable player records.

## Reporting

Please report security issues privately by emailing the repository owner or opening a minimal GitHub security advisory when available. Avoid posting exploit details in public issues before there is a fix.

## Supported Surface

- Client-side React app.
- Future FastAPI/Redis API package and its dependency lock.
- Normalized browser `halligalli_settings` Local Preferences.
- Product release automation and paired-runtime work as those slices land.

## Current Safety Boundaries

- No account system.
- No database.
- No server-side player profile storage.
- No payment or personal-data workflow.
- The future Multiplayer Authority is server-authoritative and ephemeral.
- Only presentation preferences stay local to the device.
- Deployment secrets, generated config, and real cloud credentials are intentionally excluded from Git.
- Production-used Helm chart templates, real Azure Kubernetes Desired State, cluster credentials, and production values are intentionally kept out of this product repo.

## Out Of Scope

- Vulnerabilities in unsupported local Node.js or browser versions.
- Third-party deployment account compromise.
- User-modified forks with changed infrastructure or credential handling.
- Future AKS topology changes, Container Apps reactivation, or infrastructure operations not explicitly confirmed and run through the infrastructure repo runbooks.
