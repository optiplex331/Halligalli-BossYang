# Game-day report: publish and due-sweep changes under +2 ms Redis latency

- Date: 2026-09-27 (times below are UTC)
- Environment: a separate Linux host, not the operator workstation. API and Redis ran as
  local processes; no Live Demo, Azure, Kubernetes, or Terraform involvement.
- Compared: `v0.10.0` (before) and commit `afec775` (after), which reads a room once per
  publish, lets the revision forwarder skip a revision every socket already holds, and
  starts due sweeps on a fixed cadence.
- Outcome: at ten rooms with 2 ms added to every API→Redis round trip, server tick p95
  fell from 204 ms to 80 ms and client cadence p95 from 120 ms to 51 ms, with lower API
  CPU. Both runs had zero client errors and all five checked invariants passed. The Compose latency
  game day had crossed the 250 ms abort at ten rooms under the same delay.

## Setup

- Redis 8.0.1 built from the checksum-verified release tarball, started with the Compose
  flags (`--save '' --appendonly no --maxmemory 180mb --maxmemory-policy noeviction`) and
  flushed before each run.
- API: `uv run --project apps/api uvicorn halligalli_api.app:app` from each tree, with no
  CPU limit and the default 15 s runtime summaries.
- Fault: the host has no Docker or root access, so a small userspace TCP proxy between
  the API and Redis delayed every chunk Redis sent back by 2 ms, preserving order. This
  replaces the `tc netem` delay on Redis egress used in the Compose latency game day.
  Measured through the proxy, `PING` took a median of 2.27 ms (p95 2.50 ms) before and
  2.42 ms (p95 2.95 ms) after.
- Load: `node tests/load/harness.mjs --origin http://127.0.0.1:18000 --ramp 2,5,10
  --step-seconds 120 --runtime-summary-file <api log>`, the same command for both runs,
  with the delay applied for the whole run.

## Harness results

| Step | Server tick p95 before | after | Client cadence p95 before | after | Bell outcomes before (correct / wrong / missed) | after |
|---|---:|---:|---:|---:|---:|---:|
| ramp-2-rooms | 126 ms | 115 ms | 91.5 ms | 7.0 ms | 42 / 9 / 7 | 38 / 11 / 7 |
| ramp-5-rooms | 138 ms | 114 ms | 94.8 ms | 15.3 ms | 99 / 27 / 14 | 87 / 23 / 19 |
| ramp-10-rooms | 204 ms | 80 ms | 120.4 ms | 50.5 ms | 194 / 47 / 22 | 188 / 58 / 30 |

| | Before | After |
|---|---|---|
| Capacity knee (p95 above 150 ms) | ramp-10-rooms | not observed |
| Client errors | 0 / 1,459 | 0 / 1,513 |
| Invariants, including revision monotonic per socket | 5 pass, Design Load shape not run | 5 pass, Design Load shape not run |
| Abort | none | none |

## Runtime summaries at ten rooms

| | Before | After |
|---|---|---|
| Sockets | 34 to 45 | 37 to 52 |
| Tick p95 per 15 s window | 146 to 204 ms | 67 to 80 ms |
| API CPU | 0.16 to 0.21 cores | 0.10 to 0.14 cores |
| `WATCH` retries per window | 14 to 49 | 13 to 68 |

## Observations

- Before, lateness grew with the number of sockets, because every publish read the room
  once per socket and the forwarder repeated those reads for the same revision. After,
  ten rooms ran with lower lateness than two rooms did before.
- At light load the after run's windows range from 21 to 115 ms. A deadline still waits
  for the next sweep, so the 100 ms sweep interval bounds lateness from below regardless
  of load, and the step p95 at two and five rooms stays near that interval.
- The pre-registered 150 ms threshold is the old polling floor plus 50 ms. With a
  fixed-cadence sweep the floor is the interval itself, so the Live Demo run on the new
  release compares against the same threshold but no longer adds a whole sweep on top.
- `WATCH` retries did not fall. The bells that race each Bell Window still contend on
  the same room key, which these changes do not address.

## Caveats

- The API had no CPU limit here, unlike the 0.26-core Live Demo replica. CPU fell by
  about a third at ten rooms, which should help more under a limit, but only the Live
  Demo run can show that.
- A userspace proxy adds its own scheduling jitter, visible in the p95 spread through
  the proxy. Both runs went through the same proxy.
- Two-minute steps with one run per side; small differences at two and five rooms are
  within run-to-run noise.

## Follow-ups

1. Run the registered ramp and a probe identical to the `v0.10.0` probe 1 against the
   Live Demo on the release that carries these changes.
