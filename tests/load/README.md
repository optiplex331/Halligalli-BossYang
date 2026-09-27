# Simulated player traffic

This standalone Node ESM harness is evidence tooling. It is not wired into CI and has no added dependencies. Use Node 24 so the built-in `fetch` and `WebSocket` APIs are available.

The default run uses the local Web origin only. It runs the 1, 2, 5, 10, and 15 room ramp, then drains those rooms and runs a separate ten room Design Load step with four humans at normal difficulty. Each step lasts three minutes by default, and the complete run stops at 20 minutes. `--step-seconds` shortens all six steps for a local dry run.

The JSON result and Markdown report contain only aggregate values. They omit participant names, room codes, credentials, IP addresses, and the request origin. Release Tag and Web/API digests are placeholders unless their flags are supplied.

## Local Compose dry run

From the Product repository root:

```sh
docker compose up -d --build
node tests/load/harness.mjs \
  --step-seconds 20 \
  --runtime-summary-stdin \
  --json-out /tmp/halligalli-load-result.json \
  --report-out /tmp/halligalli-load-report.md \
  < <(docker compose logs --follow --no-color --tail=0 api)
harness_status=$?
docker compose down
exit "$harness_status"
```

Compose publishes the Web origin on `http://localhost:5173`, but does not publish the API port. The API's `/internal/metrics` endpoint is therefore not reachable from the host in the default Compose setup. The command above consumes the API's JSON `runtime_summary` stream instead. If a local setup already exposes `/internal/metrics`, pass a loopback URL such as `--metrics-url http://localhost:8000/internal/metrics`; metrics URLs are restricted to loopback hosts.

The summary reader accepts Compose's prefixed log lines, raw JSON lines from stdin, or a file it follows from the current end:

```sh
node tests/load/harness.mjs --runtime-summary-file /tmp/api-follow.log
```

## Approved Live Demo run

Only use this after the operator has explicit approval and selected an off-peak window. The Live Demo target is an explicit opt-in (`--target live-demo`); the harness accepts only `https://play.halligalli.games` for that target. Use the approved API log stream as the runtime summary source because `/internal/metrics` is not public:

```sh
node tests/load/harness.mjs \
  --target live-demo \
  --runtime-summary-stdin \
  --release-tag <release-tag> \
  --web-digest <web-image-digest> \
  --api-digest <api-image-digest> \
  --json-out /tmp/halligalli-live-load-result.json \
  --report-out /tmp/halligalli-live-load-report.md \
  < <(az containerapp logs show \
    --name <approved-container-app> \
    --resource-group <approved-resource-group> \
    --follow)
```

The Live Demo run uses the registered three-minute steps. Stop when the harness reports an abort. Review the sanitized Markdown and JSON artifacts before publishing them as evidence.
