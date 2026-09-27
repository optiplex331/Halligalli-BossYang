# Game-day report: injected API-to-Redis latency on Compose

- Date: 2026-09-27 (times below are UTC)
- Environment: local Docker Compose (`docker compose -p hg10`), Product commit `a5a9053`
- Scope: local only; no Live Demo, Azure, Kubernetes, or Terraform involvement
- Outcome: nothing breaks functionally, with zero client errors at every latency level.
  Turn timing, however, is very sensitive to Redis round-trip time. With no added delay,
  the ramp holds 15 rooms at a tick p95 of 143 ms. With 2 ms added, it crosses the 250 ms
  abort at 10 rooms. With 10 ms, it crosses at 2 rooms. With 50 ms, a single room runs
  0.3–0.6 s late. API CPU stays low, so the limit is the number of sequential Redis round
  trips per tick.

## Setup

- Stack: `docker compose -p hg10 up -d`. The measured API→Redis `PING` round trip without
  injected delay has a median of 0.007 ms and a p95 of 0.018 ms.
- Fault: `tc netem` on the Redis container's `eth0`, applied from a `nicolaka/netshoot`
  container that shares Redis's network namespace. The delay is on Redis egress, so it
  adds to every API→Redis round trip. It was checked from the API container: 50 ms added
  gave PING times of 51–58 ms.
- Load: `node tests/load/harness.mjs --step-seconds 60 --runtime-summary-file <file>`, with
  the API log stream appended to that file. A two-player probe (easy, no bells; described
  in the API kill report) ran alongside.
- Runs: a no-fault reference, plus 50 ms, 10 ms, and 2 ms delays in separate harness runs.
  Latency was removed after each run.

## Commands

```sh
# inject (DELAY = 50ms, 10ms, or 2ms)
docker run --rm --net container:hg10-redis-1 --cap-add NET_ADMIN nicolaka/netshoot \
  tc qdisc add dev eth0 root netem delay "$DELAY"
# remove
docker run --rm --net container:hg10-redis-1 --cap-add NET_ADMIN nicolaka/netshoot \
  tc qdisc del dev eth0 root
```

## Timeline

| Run | Harness start | Delay applied | Harness end | Delay removed |
|---|---|---|---|---|
| 50 ms | 03:50:11 | 03:51:41 (during `ramp-2-rooms`) | 03:51:50 (abort) | 03:54:13 |
| 10 ms | 03:54:35 | 03:54:40 | 03:55:54 (abort) | 03:57:11 |
| 2 ms | 03:57:35 | 03:57:40 | 04:00:53 (abort) | 04:00:55 |
| none | 04:01:19 | — | 04:08:16 (complete) | — |

## Harness results

Server tick p95 per step. Values above 250 ms trigger the abort.

| Step | No delay | +2 ms | +10 ms | +50 ms |
|---|---:|---:|---:|---:|
| ramp-1-rooms | 109 ms | 163 ms | 174 ms | 117 ms (before the fault) |
| ramp-2-rooms | 117 ms | 145 ms | **251 ms** | **590 ms** |
| ramp-5-rooms | 130 ms | 224 ms | — | — |
| ramp-10-rooms | 129 ms | **274 ms** | — | — |
| ramp-15-rooms | 143 ms | — | — | — |
| design-load | 127 ms (pass) | — | — | — |
| Abort | none | tick p95 > 250 ms | tick p95 > 250 ms | tick p95 > 250 ms |
| Client errors | 0/1909 | 0/442 | 0/60 | 0/84 |

Client cadence p95 lateness per step was 71 / 80 / 106 / 103 / 104 / 101 ms with no delay
and 74 / 107 / 143 / 199 ms at +2 ms. Client cadence measures the jitter between
consecutive reveals, so a constant delay does not show up in it. That is why it stays
below the server figure even where the server figure is high.

## Runtime summary samples

+2 ms, as rooms ramp up:

```text
03:57:52 rooms 9  sockets 5  tick_p95 163 ms  samples 39  cpu 0.042
03:59:52 rooms 13 sockets 19 tick_p95 180 ms  samples 81  cpu 0.115
04:00:22 rooms 14 sockets 20 tick_p95 224 ms  samples 94  cpu 0.152
04:00:52 rooms 21 sockets 42 tick_p95 274 ms  samples 161 cpu 0.207
04:01:07 rooms 21 sockets 0  tick_p95 122 ms  samples 143 cpu 0.045   # delay removed
```

+50 ms. The harness aborted at the first summary, so only the probe room, with 2 sockets,
keeps playing afterwards:

```text
03:51:35 rooms 4 sockets 8 tick_p95 104 ms  samples 26   # before the fault
03:51:50 rooms 4 sockets 8 tick_p95 590 ms  samples 38
03:52:35 rooms 4 sockets 2 tick_p95 619 ms  samples 38
03:53:21 rooms 4 sockets 2 tick_p95 320 ms  samples 12
03:53:51 rooms 4 sockets 2 tick_p95 362 ms  samples 8
```

(`rooms` counts rooms still inside their Redis TTL, including idle ones. It is not the
number of rooms currently ticking.)

The API log has no errors or tracebacks during any latency run. The runtime summary
interval stretched from 15.0 s to about 15.2 s at +50 ms, because the summary reads Redis
memory over the slow link.

## Why lateness grows with round trips (from code)

- `advance_due_rooms` (`app.py`) runs one sweep, publishes every changed room, then sleeps
  a fixed 100 ms. The next sweep starts only after the whole publish has finished, so the
  sweep period is 100 ms plus all the Redis work. This fixed sleep is also why the
  no-delay tick p95 is about 110 ms.
- Each room the sweep advances costs several sequential round trips: WATCH, HGET,
  MULTI/EXEC, plus the shared ZRANGEBYSCORE.
- `RoomSocketHub.publish` reloads the room from Redis once per socket
  (`authority.snapshot(room, viewer)` in a loop), instead of once per room.
- Every room write also publishes on the revision channel. The revision forwarder then
  calls `hub.publish` again, which repeats the per-socket reads before it discovers that
  each socket already has that revision. The channel payload carries the revision, but
  the forwarder discards it.

Roughly, a sweep costs `100 ms + RTT × (~3 × changed rooms + sockets)`, plus a second
per-socket read pass on the same event loop. At 10 rooms × 4 players, 2 ms of RTT already
adds more than 100 ms per sweep.

## What a player would experience

There are no error messages. The table deals late. At +2 ms with 10 rooms, reveals arrive
up to about 150–270 ms after their deadline at p95, with visible uneven pacing. At +50 ms,
even a lone room runs 0.3–0.6 s late on most turns. Bell Windows open late, but they are
anchored to server time, so scoring stays correct. No invariant that was checked failed in any run (the Design Load shape check was not reached in the aborted runs, and the 10 ms run ended before any final score breakdown).
The probe's easy match still completed under +50 ms in 94 s, against 90–94 s without
delay.

## Relevance to deployment targets

Container Apps runs Redis in the same app on localhost, where the round trip is close to
the Compose baseline. AKS and K3s run Redis as a separate pod. Their in-cluster round trip
is usually sub-millisecond but not zero, and by these numbers even 1–2 ms eats into the
Design Load margin. This is a Compose measurement with a synthetic delay, not a
measurement of any target.

## Follow-ups

1. Measure the real API→Redis round trip on K3s and AKS (read-only, approved operation)
   and compare it with this curve.
2. Feed this into the pre-registered fan-out decision. The data points at round trips
   per tick, not CPU. Candidate changes: load each room once per publish and render
   per-viewer snapshots from it; have the forwarder compare the published revision with
   each socket's revision before reading Redis; schedule sweeps at a fixed rate instead
   of work-then-sleep; pipeline the per-room reads.
3. Harness: the "Command p95" and "Due processing p95" columns are `n/a` without a
   metrics URL. Adding them to `runtime_summary` would make latency drills self-explaining.
