# Simulated player traffic

This standalone Node ESM harness is evidence tooling. It is not wired into CI and has no added dependencies. Use Node 24 so the built-in `fetch` and `WebSocket` APIs are available.

The default run uses the local Web origin only. It runs the 1, 2, 5, and 10 room ramp, then drains those rooms and runs a separate ten room Design Load step with four humans at normal difficulty. Each step lasts three minutes by default, and the complete run stops at 20 minutes. `--step-seconds` shortens all five steps for a local dry run.

Between the ramp and the Design Load, and at the end, rooms get at most 45 seconds to finish without rematching; any room still playing then forfeits, so no unobserved room keeps ticking into the next step and the full run fits inside 20 minutes.

The run aborts on a client error rate above 2% (Stale Bells and refusals caused by the harness's own drain forfeits are not errors), server p95 tick lateness above 250 ms, Redis memory above 80% of `maxmemory`, client-observed reveal lateness above 500 ms over 15 seconds (each reveal counted once per room, at the first socket that sees it), or no `runtime_summary` line for 60 seconds when a summary source is configured. The report applies the pre-registered decision rule: fan-out work is triggered only if the Design Load shows server p95 tick lateness above 150 ms or median API CPU above 80% of `--api-cpu-limit` (0.26 cores by default for the Live Demo). If client-observed lateness exceeds the server's by more than 100 ms, the Design Load verdict is inconclusive. Client errors are listed by reason.

`--ramp 15,20,25,30,40,50` runs a capacity probe instead: only the listed ramp steps, no drain into a Design Load, and the same abort conditions. It looks for the load at which the runtime degrades, so its Design Load verdict is `not_applicable` and it never decides fan-out work. The first step whose server p95 tick lateness exceeds 150 ms is the capacity knee; an abort marks the step the runtime could not sustain. Steps and drains must still fit inside 20 minutes. The Live Demo allows 480 room creations per client address per hour, so a probe run soon after a registered run can end in `room_creation_limited` refusals, which are not a capacity signal.

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
  < <(while true; do
    script -q /dev/null az containerapp logs show \
      --name <approved-container-app> \
      --resource-group <approved-resource-group> \
      --container api \
      --format text \
      --follow \
      --tail 1 </dev/null
    sleep 2
  done)
```

`az containerapp logs show --follow` prints nothing when its output is not a terminal, so `script` gives it a pseudo-TTY (this is the macOS `script` syntax; on Linux use `script -qfc "<command>" /dev/null`). The loop reconnects if Azure closes the stream, which would otherwise end the run after 60 seconds without a summary.

Run it from an otherwise idle machine: client-observed reveal lateness is measured on the load generator's event loop, so a busy host (load average well above its core count) inflates it and can abort the run on the 500 ms safety net. The Live Demo run uses the registered three-minute steps. Stop when the harness reports an abort. Review the sanitized Markdown and JSON artifacts before publishing them as evidence.
