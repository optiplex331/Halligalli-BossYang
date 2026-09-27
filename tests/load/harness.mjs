#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { createInterface } from "node:readline";

const RAMP_STEPS = [1, 2, 5, 10, 15].map((targetRooms) => ({
  id: `ramp-${targetRooms}-rooms`,
  targetRooms,
  designLoad: false,
}));
const DESIGN_STEP = { id: "design-load", targetRooms: 10, designLoad: true };
const STEP_COUNT = RAMP_STEPS.length + 1;
const MAX_STEP_SECONDS = 180;
const RUN_LIMIT_MS = 20 * 60 * 1_000;
const SUMMARY_SILENCE_MS = 60_000;
// Steps use 6 x 180 s; the two drains share the remaining budget so a full run ends inside 20 minutes.
const DRAIN_LIMIT_MS = 45_000;
const FORFEIT_GRACE_MS = 10_000;
const DRAIN_EXPECTED_ERRORS = new Set(["participant_departed", "forfeit_not_allowed", "match_not_running"]);
const CLIENT_LATENESS_WINDOW_MS = 15_000;
const CLIENT_LATENESS_ABORT_MS = 500;
const SIGNAL_DISAGREEMENT_MS = 100;
const TURN_INTERVAL_MS = { easy: 900, normal: 700, hard: 550 };
const BELL_WINDOW_MS = { easy: 1_800, normal: 1_500, hard: 1_200 };
const FRUITS = ["banana", "strawberry", "lemon", "grape"];
const BREAKDOWN_FIELDS = [
  "correctBase", "collectionBonus", "speedBonus", "streakBonus",
  "wrongPenalty", "missedPenalty", "cardPenalty",
];

function usage() {
  return `Usage: node tests/load/harness.mjs [options]

Options:
  --step-seconds <1..180>       Duration of each of the six steps (default: 180)
  --origin <loopback-http-url>  Web origin (default: http://localhost:5173)
  --target live-demo            Explicitly select https://play.halligalli.games
  --metrics-url <loopback-url>  Optional local /internal/metrics endpoint
  --runtime-summary-file <path> Tail appended runtime_summary JSON lines
  --runtime-summary-stdin       Read runtime_summary JSON lines from stdin
  --json-out <path>             JSON result path (default: load-result.json)
  --report-out <path>           Markdown report path (default: load-report.md)
  --release-tag <tag>           Release Tag to record in the report
  --web-digest <digest>         Web image digest to record in the report
  --api-digest <digest>         API image digest to record in the report
  --api-cpu-limit <cores>       API container CPU limit (default: 0.26 for live-demo, none locally)
  --help                        Show this help
`;
}

function parseArgs(argv) {
  const options = {
    stepSeconds: 180,
    origin: "http://localhost:5173",
    target: "local",
    jsonOut: "load-result.json",
    reportOut: "load-report.md",
    releaseTag: null,
    webDigest: null,
    apiDigest: null,
  };
  const valueOptions = new Map([
    ["--step-seconds", "stepSeconds"], ["--origin", "origin"],
    ["--target", "target"], ["--metrics-url", "metricsUrl"],
    ["--runtime-summary-file", "runtimeSummaryFile"],
    ["--json-out", "jsonOut"], ["--report-out", "reportOut"],
    ["--release-tag", "releaseTag"], ["--web-digest", "webDigest"],
    ["--api-digest", "apiDigest"], ["--api-cpu-limit", "apiCpuLimit"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") {
      options.help = true;
      continue;
    }
    if (argument === "--runtime-summary-stdin") {
      options.runtimeSummaryStdin = true;
      continue;
    }
    const key = valueOptions.get(argument);
    if (!key || argv[index + 1] === undefined) throw new Error(`Invalid option: ${argument}`);
    options[key] = argv[index + 1];
    index += 1;
  }
  if (options.help) return options;
  options.stepSeconds = Number(options.stepSeconds);
  if (!Number.isInteger(options.stepSeconds) || options.stepSeconds < 1 || options.stepSeconds > MAX_STEP_SECONDS) {
    throw new Error(`--step-seconds must be an integer from 1 to ${MAX_STEP_SECONDS}`);
  }
  if (options.target !== "local" && options.target !== "live-demo") {
    throw new Error("--target must be local or live-demo");
  }
  if (options.target === "live-demo") {
    if (options.origin !== "http://localhost:5173") {
      throw new Error("--origin cannot be combined with --target live-demo");
    }
    options.origin = "https://play.halligalli.games";
  }
  const origin = new URL(options.origin);
  const isLoopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(origin.hostname);
  if (options.target === "local" && (!isLoopback || origin.protocol !== "http:")) {
    throw new Error("Local target origin must use http and a loopback host");
  }
  if (options.target === "live-demo" && (origin.hostname !== "play.halligalli.games" || origin.protocol !== "https:")) {
    throw new Error("Live Demo target must use https://play.halligalli.games");
  }
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") {
    throw new Error("Origin must not include credentials, a path, a query, or a fragment");
  }
  if (options.apiCpuLimit === undefined && options.target === "live-demo") options.apiCpuLimit = 0.26;
  if (options.apiCpuLimit !== undefined) {
    options.apiCpuLimit = Number(options.apiCpuLimit);
    if (!(options.apiCpuLimit > 0)) throw new Error("--api-cpu-limit must be a positive number of cores");
  }
  options.originUrl = origin;
  options.websocketOrigin = `${origin.protocol === "https:" ? "wss:" : "ws:"}//${origin.host}`;
  if (options.metricsUrl) {
    const metrics = new URL(options.metricsUrl);
    if (!isLoopbackHost(metrics.hostname) || metrics.protocol !== "http:" || metrics.username || metrics.password) {
      throw new Error("Metrics URL must use http and a loopback host");
    }
    options.metricsUrl = metrics.href;
  }
  return options;
}

function isLoopbackHost(hostname) {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
}

function percentile(values, quantile) {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(quantile * ordered.length) - 1)];
}

function scoreFingerprint(snapshot, seatIndex) {
  const entry = snapshot?.scoreboard?.find((score) => score.seatIndex === seatIndex);
  if (!entry) return null;
  return JSON.stringify({
    score: entry.score,
    correctHits: entry.correctHits,
    wrongHits: entry.wrongHits,
    missedHits: entry.missedHits,
    scoreBreakdown: entry.scoreBreakdown,
  });
}

function summaryFromValue(value, depth = 0) {
  if (depth > 3) return null;
  if (typeof value === "string") {
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return summaryFromValue(JSON.parse(value.slice(start, end + 1)), depth + 1);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  if (value.event === "runtime_summary") return value;
  // Log streams such as `az containerapp logs show --format json` wrap the app's line in a field.
  for (const nested of Object.values(value)) {
    if (typeof nested === "string" && nested.includes("runtime_summary")) {
      const record = summaryFromValue(nested, depth + 1);
      if (record) return record;
    }
  }
  return null;
}

function parseSummaryLine(line) {
  if (!line.includes("runtime_summary")) return null;
  return summaryFromValue(line);
}

class Monitor {
  constructor(options) {
    this.options = options;
    this.startedAt = Date.now();
    this.currentStep = null;
    this.clientOperations = 0;
    this.clientErrors = 0;
    this.abortReason = null;
    this.runtimeSummaries = [];
    this.clients = new Set();
    this.abortWaiters = [];
    this.roomScheduler = null;
    this.lineReader = null;
    this.fileTailTimer = null;
    this.fileOffset = 0;
    this.filePartial = "";
    this.tailingFile = false;
    this.summarySamples = [];
    this.globalClientOutcomes = { correct: 0, wrong: 0, missed: 0, staleFrames: 0 };
    this.totalRaceAttempts = 0;
    this.totalMissedWindowsPlanned = 0;
    this.totalWrongBellAttempts = 0;
    this.totalReconnects = 0;
    this.totalRevealReactions = [];
    this.clientLatenessWindow = [];
    this.errorReasons = new Map();
    this.metricsTimer = null;
    this.previousMetrics = null;
    this.metricsWindowStartedAt = null;
    this.metricsPolling = false;
    this.hardLimitTimer = setTimeout(() => this.abort("20-minute run limit reached"), RUN_LIMIT_MS);
    this.hardLimitTimer.unref();
    this.lastSummaryAt = Date.now();
    if (options.runtimeSummaryStdin || options.runtimeSummaryFile) {
      // Without summaries the server-side abort conditions cannot fire, so silence is itself an abort.
      this.summaryWatchdog = setInterval(() => {
        if (Date.now() - this.lastSummaryAt > SUMMARY_SILENCE_MS) this.abort("runtime summary stream went silent");
      }, 5_000);
      this.summaryWatchdog.unref();
    }
    if (options.runtimeSummaryStdin) this.readStdin();
    if (options.runtimeSummaryFile) this.tailSummaryFile(options.runtimeSummaryFile);
  }

  setScheduler(scheduler) {
    this.roomScheduler = scheduler;
  }

  recordOperation(ok, reason = "operation failed") {
    this.clientOperations += 1;
    if (this.currentStep) this.currentStep.clientOperations += 1;
    if (!ok) {
      this.errorReasons.set(reason, (this.errorReasons.get(reason) ?? 0) + 1);
      this.clientErrors += 1;
      if (this.currentStep) this.currentStep.clientErrors += 1;
      this.checkErrorRate();
    }
  }

  recordClientLateness(latenessMs) {
    const now = Date.now();
    this.clientLatenessWindow.push({ at: now, latenessMs });
    while (this.clientLatenessWindow.length > 0 && now - this.clientLatenessWindow[0].at > CLIENT_LATENESS_WINDOW_MS) {
      this.clientLatenessWindow.shift();
    }
    // A safety net that does not depend on the server summary stream; network jitter sets the higher bound.
    if (this.clientLatenessWindow.length >= 20) {
      const p95 = percentile(this.clientLatenessWindow.map((sample) => sample.latenessMs), 0.95);
      if (p95 > CLIENT_LATENESS_ABORT_MS) this.abort("client-observed reveal lateness exceeded 500 ms");
    }
  }

  recordError(reason = "unclassified") {
    this.errorReasons.set(reason, (this.errorReasons.get(reason) ?? 0) + 1);
    this.clientErrors += 1;
    if (this.currentStep) this.currentStep.clientErrors += 1;
    this.checkErrorRate();
  }

  checkErrorRate() {
    if (this.clientOperations > 0 && this.clientErrors / this.clientOperations > 0.02) {
      this.abort("client error rate exceeded 2%");
    }
  }

  registerClient(client) {
    this.clients.add(client);
  }

  unregisterClient(client) {
    this.clients.delete(client);
  }

  receiveSummary(record) {
    this.lastSummaryAt = Date.now();
    const sample = {
      at: new Date().toISOString(),
      tickLatenessP95Ms: finiteNumber(record.tick_lateness_p95_ms),
      redisUsedMemoryBytes: finiteNumber(record.redis_used_memory_bytes),
      redisMaxmemoryBytes: finiteNumber(record.redis_maxmemory_bytes),
      activeRooms: finiteNumber(record.active_rooms),
      activeSockets: finiteNumber(record.active_sockets),
      watchRetries: finiteNumber(record.watch_retries),
      tickSamples: finiteNumber(record.tick_samples),
      apiCpuCores: finiteNumber(record.api_cpu_cores),
    };
    this.runtimeSummaries.push(sample);
    this.summarySamples.push(sample);
    if (this.currentStep) this.currentStep.runtimeSummaries.push(sample);
    if (sample.tickLatenessP95Ms !== null) {
      this.currentStep?.serverP95Samples.push(sample.tickLatenessP95Ms);
      if (sample.tickLatenessP95Ms > 250) this.abort("server p95 tick lateness exceeded 250 ms");
    }
    if (sample.redisUsedMemoryBytes !== null && sample.redisMaxmemoryBytes > 0) {
      const ratio = sample.redisUsedMemoryBytes / sample.redisMaxmemoryBytes;
      if (this.currentStep) this.currentStep.redisMemoryRatios.push(ratio);
      if (ratio > 0.8) this.abort("Redis memory exceeded 80% of maxmemory");
    }
    if (sample.apiCpuCores !== null) this.currentStep?.apiCpuSamples.push(sample.apiCpuCores);
  }

  readStdin() {
    this.lineReader = createInterface({ input: process.stdin, crlfDelay: Infinity });
    this.lineReader.on("line", (line) => {
      const record = parseSummaryLine(line);
      if (record) this.receiveSummary(record);
    });
  }

  async tailSummaryFile(path) {
    try {
      this.fileOffset = (await stat(path)).size;
    } catch {
      this.fileOffset = 0;
    }
    this.fileTailTimer = setInterval(async () => {
      if (this.tailingFile) return;
      this.tailingFile = true;
      try {
        const current = await stat(path);
        if (current.size < this.fileOffset) {
          this.fileOffset = 0;
          this.filePartial = "";
        }
        if (current.size === this.fileOffset) return;
        const stream = createReadStream(path, { start: this.fileOffset, end: current.size - 1 });
        let chunk = this.filePartial;
        for await (const part of stream) chunk += part.toString("utf8");
        this.fileOffset = current.size;
        const lines = chunk.split(/\r?\n/);
        this.filePartial = lines.pop() ?? "";
        for (const line of lines) {
          const record = parseSummaryLine(line);
          if (record) this.receiveSummary(record);
        }
      } catch {
        // The tail can resume if the log file is created or rotated during startup.
      } finally {
        this.tailingFile = false;
      }
    }, 500);
    this.fileTailTimer.unref();
  }

  abort(reason) {
    if (this.abortReason) return;
    this.abortReason = reason;
    this.roomScheduler?.stop();
    for (const client of this.clients) client.close(true);
    for (const resolve of this.abortWaiters.splice(0)) resolve();
  }

  async wait(milliseconds) {
    if (this.abortReason) return false;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (elapsed) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.abortWaiters = this.abortWaiters.filter((waiter) => waiter !== onAbort);
        resolve(elapsed);
      };
      const onAbort = () => finish(false);
      const timer = setTimeout(() => finish(true), milliseconds);
      this.abortWaiters.push(onAbort);
    });
  }

  closeInputs() {
    clearTimeout(this.hardLimitTimer);
    clearInterval(this.summaryWatchdog);
    clearInterval(this.fileTailTimer);
    clearInterval(this.metricsTimer);
    this.lineReader?.close();
  }

  startMetricsWatcher(url, initialMetrics) {
    if (!url) return;
    this.previousMetrics = initialMetrics;
    this.metricsWindowStartedAt = Date.now();
    this.metricsTimer = setInterval(async () => {
      if (this.metricsPolling) return;
      this.metricsPolling = true;
      try {
        const latest = await fetchMetrics(url);
        if (!latest) return;
        if (Date.now() - this.metricsWindowStartedAt < 15_000) return;
        const delta = metricsDelta(this.previousMetrics, latest);
        this.previousMetrics = latest;
        this.metricsWindowStartedAt = Date.now();
        if (delta?.serverP95Ms !== null && delta?.serverP95Ms !== undefined) {
        this.currentStep?.serverP95Samples.push(delta.serverP95Ms);
        if (delta.serverP95Ms > 250) this.abort("server p95 tick lateness exceeded 250 ms");
      }
      } finally {
        this.metricsPolling = false;
      }
    }, 2_000);
    this.metricsTimer.unref();
  }
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function updateStepOutcome(step, name, amount) {
  if (step && amount > 0) step.clientBellOutcomes[name] += amount;
}

class SocketClient {
  constructor({ monitor, manager, roomCode, credential, seatIndex, origin, websocketOrigin }) {
    this.monitor = monitor;
    this.manager = manager;
    this.roomCode = roomCode;
    this.credential = credential;
    this.seatIndex = seatIndex;
    this.origin = origin;
    this.websocketOrigin = websocketOrigin;
    this.socket = null;
    this.latestSnapshot = null;
    this.lastRevision = null;
    this.openPromise = null;
    this.waiters = [];
    this.intentionalClose = false;
    this.isClosed = false;
    this.openFailed = false;
    this.pendingStaleChecks = new Map();
    this.pendingBellResponses = new Map();
    this.lastCadence = null;
    this.connect();
  }

  get socketUrl() {
    return `${this.websocketOrigin}/ws/v1/rooms/${this.roomCode}`;
  }

  connect() {
    this.isClosed = false;
    this.intentionalClose = false;
    this.openPromise = new Promise((resolve, reject) => {
      let settled = false;
      const socket = new WebSocket(this.socketUrl);
      this.socket = socket;
      let connectionTimer;
      const failOpen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(connectionTimer);
        this.openFailed = true;
        this.monitor.recordOperation(false, "WebSocket connection failed");
        const error = new Error("WebSocket connection failed");
        error.clientCounted = true;
        reject(error);
      };
      connectionTimer = setTimeout(failOpen, 8_000);
      socket.addEventListener("open", () => {
        socket.send(JSON.stringify({ type: "authenticate", credential: this.credential }));
      }, { once: true });
      socket.addEventListener("message", ({ data }) => {
        let message;
        try {
          message = JSON.parse(String(data));
        } catch {
          this.monitor.recordError("unparseable server frame");
          return;
        }
        if (message.type === "snapshot") {
          this.receiveSnapshot(message.snapshot);
          if (!settled) {
            clearTimeout(connectionTimer);
            this.monitor.recordOperation(true);
            settled = true;
            resolve();
          }
          return;
        }
        if (message.type === "bell_stale") {
          this.monitor.globalClientOutcomes.staleFrames += 1;
          if (this.manager.currentStep) this.manager.currentStep.clientBellOutcomes.staleFrames += 1;
          this.checkStaleScore(message.revealSequence);
          this.finishBell(message.revealSequence, "stale");
          return;
        }
        if (message.type === "error") {
          // Drain forfeits race queued commands; these refusals are the harness ending rooms, not server faults.
          if (this.manager.forfeiting && DRAIN_EXPECTED_ERRORS.has(message.code)) {
            for (const waiter of this.waiters.splice(0)) waiter.reject(Object.assign(new Error("room forfeited"), { clientCounted: true }));
            return;
          }
          this.monitor.recordError(`server error frame: ${String(message.code ?? "unknown").slice(0, 40)}`);
          for (const waiter of this.waiters.splice(0)) {
            const error = new Error(`WebSocket command returned ${message.code ?? "error"}`);
            error.clientCounted = true;
            waiter.reject(error);
          }
        }
      });
      socket.addEventListener("error", failOpen);
      socket.addEventListener("close", (event) => {
        this.isClosed = true;
        if (!settled && !this.intentionalClose) failOpen();
        if (!this.intentionalClose && !this.openFailed && !this.monitor.abortReason) {
          this.monitor.recordError(`unexpected socket close ${event.code}`);
        }
        this.manager.onSocketClose(this);
      });
      this.monitor.registerClient(this);
    });
    return this.openPromise;
  }

  receiveSnapshot(snapshot) {
    if (this.lastRevision !== null && snapshot.revision < this.lastRevision) {
      this.manager.recordInvariant("room revision monotonic per socket", "revision decreased");
    }
    this.lastRevision = snapshot.revision;
    this.latestSnapshot = snapshot;
    this.recordCadence(snapshot);
    this.checkBellSnapshots(snapshot);
    for (let index = this.waiters.length - 1; index >= 0; index -= 1) {
      const waiter = this.waiters[index];
      if (waiter.predicate(snapshot)) {
        this.waiters.splice(index, 1);
        clearTimeout(waiter.timer);
        waiter.resolve(snapshot);
      }
    }
    this.manager.onSnapshot(snapshot, this);
  }

  checkBellSnapshots(snapshot) {
    for (const [sequence, pending] of this.pendingBellResponses) {
      const score = snapshot.scoreboard?.find((entry) => entry.seatIndex === this.seatIndex);
      if (!score) continue;
      if (score.correctHits > pending.correctHits) {
        this.finishBell(sequence, "scored");
      } else if (score.wrongHits > pending.wrongHits) {
        this.finishBell(sequence, "wrong");
      }
    }
  }

  finishBell(sequence, outcome) {
    const pending = this.pendingBellResponses.get(sequence);
    if (!pending) return;
    this.pendingBellResponses.delete(sequence);
    clearTimeout(pending.timer);
    pending.resolve(outcome);
  }

  recordCadence(snapshot) {
    if (snapshot.phase !== "playing" || !snapshot.lastReveal?.sequence) return;
    const now = performance.now();
    const current = {
      matchNumber: snapshot.matchNumber,
      sequence: snapshot.lastReveal.sequence,
      at: now,
      // A coalesced first view may already show the window won, which still means it was open.
      opensBellWindow: Boolean(snapshot.bellFruit) || snapshot.lastEvent === "correct_bell",
    };
    const previous = this.lastCadence;
    // Later snapshots of the same reveal (a correct bell, another player's command) keep the reveal's time.
    if (previous && previous.matchNumber === current.matchNumber && current.sequence <= previous.sequence) return;
    this.lastCadence = current;
    if (!previous || previous.matchNumber !== current.matchNumber) return;
    const pace = snapshot.configuration.difficulty;
    // A reveal that opened a Bell Window holds the next flip until the window's deadline, whether the
    // window was won or missed; any further skipped reveals each took one turn interval.
    const expectedMs = (previous.opensBellWindow ? BELL_WINDOW_MS[pace] : TURN_INTERVAL_MS[pace])
      + TURN_INTERVAL_MS[pace] * (current.sequence - previous.sequence - 1);
    const gapMs = now - previous.at;
    const latenessMs = Math.max(0, gapMs - expectedMs);
    if (this.monitor.currentStep) {
      this.monitor.currentStep.clientCadenceGapMs.push(gapMs);
      this.monitor.currentStep.clientCadenceLatenessMs.push(latenessMs);
    }
    this.monitor.recordClientLateness(latenessMs);
  }

  waitForSnapshot(predicate, timeoutMs = 8_000) {
    if (this.latestSnapshot && predicate(this.latestSnapshot)) return Promise.resolve(this.latestSnapshot);
    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((item) => item !== waiter);
          reject(new Error("Timed out waiting for a room snapshot"));
        }, timeoutMs),
      };
      this.waiters.push(waiter);
    });
  }

  async authenticate() {
    await this.openPromise;
    if (!this.latestSnapshot) await this.waitForSnapshot(() => true);
    return this.latestSnapshot;
  }

  async command(type, predicate = () => true) {
    if (!this.socket || this.isClosed || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }
    const before = this.latestSnapshot?.revision ?? -1;
    const waiter = this.waitForSnapshot((snapshot) => snapshot.revision > before && predicate(snapshot));
    this.monitor.recordOperation(true);
    this.socket.send(JSON.stringify({ type, commandId: randomUUID() }));
    return waiter;
  }

  async ring(revealSequence, plannedReactionMs, waitForResolution = false) {
    if (!this.socket || this.isClosed || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }
    const baseline = scoreFingerprint(this.latestSnapshot, this.seatIndex);
    if (waitForResolution) {
      await this.waitForSnapshot((snapshot) => (
        snapshot.phase !== "playing"
        || (snapshot.lastReveal?.sequence ?? 0) > revealSequence
      ));
    }
    const scoreAtSend = scoreFingerprint(this.latestSnapshot, this.seatIndex) ?? baseline;
    const initialScore = this.latestSnapshot?.scoreboard?.find((entry) => entry.seatIndex === this.seatIndex);
    this.pendingStaleChecks.set(revealSequence, scoreAtSend);
    this.monitor.recordOperation(true);
    this.socket.send(JSON.stringify({ type: "bell", commandId: randomUUID(), revealSequence }));
    this.monitor.currentStep && this.monitor.currentStep.reactionSamplesMs.push(plannedReactionMs);
    if (!initialScore) return;
    await new Promise((resolve) => {
      const pending = {
        correctHits: initialScore.correctHits,
        wrongHits: initialScore.wrongHits,
        resolve,
        timer: setTimeout(() => {
          this.pendingBellResponses.delete(revealSequence);
          this.monitor.recordError("bell response timeout");
          resolve("timeout");
        }, 5_000),
      };
      this.pendingBellResponses.set(revealSequence, pending);
    });
  }

  checkStaleScore(revealSequence) {
    const baseline = this.pendingStaleChecks.get(revealSequence);
    this.pendingStaleChecks.delete(revealSequence);
    if (!baseline) return;
    const after = scoreFingerprint(this.latestSnapshot, this.seatIndex);
    if (after && after !== baseline) {
      this.manager.recordInvariant("Stale Bells change no score", "participant score or breakdown changed around a stale response");
    }
  }

  close(intentional = false) {
    if (this.isClosed) return;
    this.intentionalClose = intentional;
    this.manager.monitor.unregisterClient(this);
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) this.socket.close(1000);
    this.isClosed = true;
    for (const waiter of this.waiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error("WebSocket closed"));
    }
    for (const [sequence, pending] of this.pendingBellResponses) {
      clearTimeout(pending.timer);
      pending.resolve("closed");
      this.pendingBellResponses.delete(sequence);
    }
  }
}

async function requestJson(monitor, origin, path, body) {
  let response;
  try {
    response = await fetch(new URL(path, origin), {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
      body: JSON.stringify(body),
    });
  } catch {
    monitor.recordOperation(false, "room entry request failed");
    throw countedError("Web-origin room entry request failed");
  }
  if (response.status !== 201) {
    monitor.recordOperation(false, `room entry HTTP ${response.status}`);
    throw countedError(`Web-origin room entry returned HTTP ${response.status}`);
  }
  try {
    const result = await response.json();
    monitor.recordOperation(true);
    return result;
  } catch {
    monitor.recordOperation(false, "room entry invalid JSON");
    throw countedError("Web-origin room entry returned invalid JSON");
  }
}

function countedError(message) {
  const error = new Error(message);
  error.clientCounted = true;
  return error;
}

function randomInteger(minimum, maximum) {
  return minimum + Math.floor(Math.random() * (maximum - minimum + 1));
}

function chooseDifficulty() {
  const choice = Math.random();
  return choice < 0.3 ? "easy" : choice < 0.8 ? "normal" : "hard";
}

function lognormalReactionMs() {
  const u1 = Math.max(Number.EPSILON, Math.random());
  const u2 = Math.random();
  const standardNormal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const sigma = 0.35;
  return Math.round(Math.exp(Math.log(450) + sigma * standardNormal));
}

class RoomManager {
  constructor({ monitor, origin, websocketOrigin, config, roomNumber }) {
    this.monitor = monitor;
    this.origin = origin;
    this.websocketOrigin = websocketOrigin;
    this.config = config;
    this.roomNumber = roomNumber;
    this.roomCode = null;
    this.bots = [];
    this.clients = [];
    this.snapshotWaiters = new Map();
    this.invariantViolations = [];
    this.matchSummaries = [];
    this.openWindowSequences = new Set();
    this.handledTransitions = new Set();
    this.closedSockets = new Set();
    this.socketLifecycles = 0;
    this.lastProcessedRevision = -1;
    this.lastProcessedMatchNumber = null;
    this.lastProcessedScores = null;
    this.currentStep = null;
    this.matchStartTimes = new Map();
    this.pendingBellTasks = new Set();
  }

  async enter() {
    const credentials = Array.from({ length: this.config.humans }, () => randomUUID());
    const prefix = `Load-${String(this.roomNumber).padStart(3, "0")}`;
    const created = await requestJson(this.monitor, this.origin, "/api/v1/rooms", {
      name: `${prefix}-1`,
      credentialVerifier: createHash("sha256").update(credentials[0]).digest("hex"),
      tableSeatCount: this.config.seats,
      targetHumanParticipantCount: this.config.humans,
      difficulty: this.config.difficulty,
    });
    this.roomCode = created.roomCode;
    for (let index = 1; index < credentials.length; index += 1) {
      await requestJson(this.monitor, this.origin, `/api/v1/rooms/${this.roomCode}/participants`, {
        name: `${prefix}-${index + 1}`,
        credentialVerifier: createHash("sha256").update(credentials[index]).digest("hex"),
      });
    }
    this.bots = credentials.map((credential, seatIndex) => ({ credential, seatIndex, socketClient: null }));
    await Promise.all(this.bots.map((bot) => this.connectBot(bot)));
  }

  async connectBot(bot) {
    const client = new SocketClient({
      monitor: this.monitor,
      manager: this,
      roomCode: this.roomCode,
      credential: bot.credential,
      seatIndex: bot.seatIndex,
      origin: this.origin,
      websocketOrigin: this.websocketOrigin,
    });
    bot.socketClient = client;
    this.socketLifecycles += 1;
    await client.authenticate();
  }

  async reconnectBot(bot) {
    bot.socketClient?.close(true);
    await this.connectBot(bot);
    this.monitor.totalReconnects += 1;
    if (this.currentStep) this.currentStep.reconnects += 1;
  }

  onSocketClose(client) {
    this.closedSockets.add(client);
  }

  recordInvariant(invariant, observed) {
    this.invariantViolations.push({
      step: this.monitor.currentStep?.id ?? null,
      invariant,
      observed,
    });
  }

  onSnapshot(snapshot, client) {
    const step = this.monitor.currentStep;
    if (snapshot.phase === "playing" && snapshot.lastReveal?.sequence && snapshot.bellFruit) {
      const key = `${snapshot.matchNumber}:${snapshot.lastReveal.sequence}`;
      if (!this.openWindowSequences.has(key)) {
        this.openWindowSequences.add(key);
        if (step) step.clientObservedWindows += 1;
      }
    }
    this.captureScoreChanges(snapshot, step);
    const matchKey = snapshot.matchNumber;
    if (snapshot.phase === "playing" && !this.matchStartTimes.has(matchKey)) {
      this.matchStartTimes.set(matchKey, Date.now());
      if (step) step.matchesStarted += 1;
    }
    if (snapshot.phase === "playing" && snapshot.lastReveal?.sequence) {
      this.observeReveal(snapshot, client, step);
    }
    if (snapshot.phase === "post_match" && snapshot.matchNumber > 0) {
      this.captureFinalMatch(snapshot, step);
    }
    const waiter = this.snapshotWaiters.get(snapshot.phase);
    if (waiter) {
      this.snapshotWaiters.delete(snapshot.phase);
      clearTimeout(waiter.timer);
      waiter.resolve(snapshot);
    }
  }

  captureScoreChanges(snapshot, step) {
    const scores = snapshot.scoreboard ?? [];
    if (snapshot.matchNumber !== this.lastProcessedMatchNumber) {
      this.lastProcessedMatchNumber = snapshot.matchNumber;
      this.lastProcessedRevision = snapshot.revision;
      this.lastProcessedScores = new Map(scores.map((score) => [score.seatIndex, score]));
      return;
    }
    if (snapshot.revision <= this.lastProcessedRevision) return;
    const previous = this.lastProcessedScores ?? new Map();
    const outcomeChanges = { correct: 0, wrong: 0, missedHits: 0 };
    for (const score of scores) {
      const old = previous.get(score.seatIndex);
      if (!old) continue;
      const changes = {
        correct: score.correctHits - old.correctHits,
        wrong: score.wrongHits - old.wrongHits,
        missedHits: score.missedHits - old.missedHits,
      };
      for (const [name, amount] of Object.entries(changes)) {
        if (amount > 0) outcomeChanges[name] += amount;
      }
    }
    for (const name of ["correct", "wrong"]) {
      updateStepOutcome(step, name, outcomeChanges[name]);
      this.monitor.globalClientOutcomes[name] += outcomeChanges[name];
    }
    const missedWindows = scores.length > 0 ? outcomeChanges.missedHits / scores.length : 0;
    updateStepOutcome(step, "missed", missedWindows);
    this.monitor.globalClientOutcomes.missed += missedWindows;
    this.lastProcessedRevision = snapshot.revision;
    this.lastProcessedScores = new Map(scores.map((score) => [score.seatIndex, score]));
  }

  observeReveal(snapshot, client, step) {
    const sequence = snapshot.lastReveal.sequence;
    const openKey = `${snapshot.matchNumber}:${sequence}`;
    const transitionKey = `${snapshot.matchNumber}:${sequence}`;
    if (this.handledTransitions.has(transitionKey)) return;
    if (snapshot.bellFruit) {
      this.handledTransitions.add(transitionKey);
      const bots = this.availableBots();
      if (bots.length < 2) {
        this.recordInvariant("at least two bots race every open Bell Window", "fewer than two connected bots");
        return;
      }
      const racers = chooseDistinct(bots, 2);
      const intentionallyMissed = Math.random() < 0.15;
      if (intentionallyMissed) {
        this.monitor.totalMissedWindowsPlanned += 1;
        if (step) step.plannedMissedWindows += 1;
      }
      if (step) step.raceAttempts += racers.length;
      this.monitor.totalRaceAttempts += racers.length;
      for (const bot of racers) {
        const reaction = lognormalReactionMs();
        this.monitor.totalRevealReactions.push(reaction);
        let waitMs = Math.min(reaction, BELL_WINDOW_MS[this.config.difficulty] - 30);
        if (intentionallyMissed) waitMs = BELL_WINDOW_MS[this.config.difficulty] + randomInteger(30, 120);
        this.trackBell(bot, sequence, waitMs, intentionallyMissed);
      }
      return;
    }
    // A sequence that was previously open can be closed after a correct bell. It must never
    // generate a wrong bell; only no-window transitions get the accidental 5% behavior.
    if (!this.openWindowSequences.has(openKey) && Math.random() < 0.05) {
      this.handledTransitions.add(transitionKey);
      const bots = this.availableBots();
      if (bots.length === 0) return;
      const bot = bots[randomInteger(0, bots.length - 1)];
      let reaction = lognormalReactionMs();
      // Half the turn interval leaves room for snapshot delivery, so the bell still names the current transition.
      reaction = Math.min(reaction, Math.floor(TURN_INTERVAL_MS[this.config.difficulty] / 2));
      if (step) step.wrongBellAttempts += 1;
      this.monitor.totalWrongBellAttempts += 1;
      this.trackBell(bot, sequence, reaction, false);
    } else if (!this.openWindowSequences.has(openKey)) {
      // Ensure this no-window transition is sampled only once even when all socket views arrive.
      this.handledTransitions.add(transitionKey);
    }
  }

  async scheduleBell(bot, sequence, waitMs, waitForResolution) {
    try {
      await delay(waitMs);
      if (this.monitor.abortReason || this.forfeiting) return;
      const client = bot.socketClient;
      if (!client || client.isClosed) return;
      await client.ring(sequence, waitMs, waitForResolution);
    } catch (error) {
      if (!this.monitor.abortReason && !error?.clientCounted) this.monitor.recordError(`flow: ${String(error?.message ?? error).slice(0, 80)}`);
    }
  }

  trackBell(bot, sequence, waitMs, waitForResolution) {
    const task = this.scheduleBell(bot, sequence, waitMs, waitForResolution);
    this.pendingBellTasks.add(task);
    task.then(() => this.pendingBellTasks.delete(task), () => this.pendingBellTasks.delete(task));
  }

  async settleBellTasks() {
    if (this.pendingBellTasks.size === 0) return;
    await Promise.race([
      Promise.allSettled([...this.pendingBellTasks]),
      delay(3_000),
    ]);
  }

  availableBots() {
    return this.bots.filter((bot) => bot.socketClient && !bot.socketClient.isClosed);
  }

  captureFinalMatch(snapshot, step) {
    if (this.matchSummaries.some((match) => match.matchNumber === snapshot.matchNumber)) return;
    const participants = snapshot.result?.participants ?? snapshot.scoreboard ?? [];
    const correctHits = participants.reduce((sum, participant) => sum + participant.correctHits, 0);
    const wrongHits = participants.reduce((sum, participant) => sum + participant.wrongHits, 0);
    const missedHits = participants.reduce((sum, participant) => sum + participant.missedHits, 0);
    const breakdowns = participants.map((participant) => {
      const breakdown = participant.scoreBreakdown ?? {};
      const calculated = breakdown.correctBase + breakdown.collectionBonus + breakdown.speedBonus
        + breakdown.streakBonus - breakdown.wrongPenalty - breakdown.missedPenalty - breakdown.cardPenalty;
      const valid = BREAKDOWN_FIELDS.every((field) => Number.isFinite(breakdown[field]))
        && calculated === participant.score;
      if (!valid) {
        this.recordInvariant("Score Breakdown sums to score", "final participant score does not equal its breakdown");
      }
      return valid;
    });
    const windowsOpened = [...this.openWindowSequences]
      .filter((key) => key.startsWith(`${snapshot.matchNumber}:`)).length;
    if (correctHits > windowsOpened) {
      this.recordInvariant("at most one correct bell per Bell Window", `correct hits ${correctHits} exceeded observed windows ${windowsOpened}`);
    }
    const match = {
      matchNumber: snapshot.matchNumber,
      humanParticipants: participants.length,
      correctHits,
      wrongHits,
      missedHits,
      missedBellOutcomes: participants.length > 0 ? missedHits / participants.length : 0,
      observedWindowsOpened: windowsOpened,
      scoreBreakdownsValid: breakdowns.every(Boolean),
    };
    this.matchSummaries.push(match);
    if (step) {
      step.matchesCompleted += 1;
      step.completedMatchStats.push(match);
    }
  }

  waitForPhase(phase, timeoutMs = 180_000) {
    const current = this.bots[0]?.socketClient?.latestSnapshot;
    if (current?.phase === phase) return Promise.resolve(current);
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, timer: null };
      waiter.timer = setTimeout(() => {
        this.snapshotWaiters.delete(phase);
        reject(new Error(`Timed out waiting for room phase ${phase}`));
      }, timeoutMs);
      this.snapshotWaiters.set(phase, waiter);
    });
  }

  async readyAndStart() {
    let clients = this.bots.map((bot) => bot.socketClient);
    await Promise.all(clients.map((client) => client.command("ready", (snapshot) => (
      snapshot.participants.some((participant) => (
        participant.seatIndex === snapshot.viewerSeatIndex && participant.ready
      ))
    ))));
    clients = this.bots.map((bot) => bot.socketClient);
    const latest = clients[0].latestSnapshot;
    const running = this.waitForPhase("playing");
    if (latest?.phase === "playing") {
      running.catch(() => {});
      return latest;
    }
    await clients[0].command("start", (snapshot) => snapshot.phase === "playing");
    return running;
  }

  scheduleMatchReconnect() {
    // About 5% of matches lose one bot's socket mid-match, exercising resume while the room keeps ticking.
    if (Math.random() >= 0.05) return;
    const bot = this.bots[randomInteger(0, this.bots.length - 1)];
    const timer = setTimeout(() => {
      if (this.monitor.abortReason || !bot.socketClient || bot.socketClient.isClosed) return;
      this.reconnectBot(bot).catch((error) => {
        if (!this.monitor.abortReason && !error?.clientCounted) this.monitor.recordError(`flow: ${String(error?.message ?? error).slice(0, 80)}`);
      });
    }, randomInteger(5_000, 20_000));
    timer.unref();
  }

  async forfeitAll() {
    this.forfeiting = true;
    const clients = this.availableBots().map((bot) => bot.socketClient);
    await Promise.allSettled(clients.map((client) => client.command("forfeit")));
  }

  async continueMatch() {
    const clients = this.bots.map((bot) => bot.socketClient);
    await Promise.all(clients.map((client) => client.command("continue")));
    await Promise.all(clients.map((client) => client.waitForSnapshot((snapshot) => snapshot.phase === "lobby", 40_000)));
    await this.readyAndStart();
  }

  async leaveAfterMatch() {
    const clients = this.bots.map((bot) => bot.socketClient);
    await Promise.all(clients.map((client) => client.command("post_match_leave")));
  }

  close() {
    for (const bot of this.bots) bot.socketClient?.close(true);
    for (const waiter of this.snapshotWaiters.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error("Room manager closed"));
    }
    this.snapshotWaiters.clear();
  }
}

function chooseDistinct(items, count) {
  const values = [...items];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swap = randomInteger(0, index);
    [values[index], values[swap]] = [values[swap], values[index]];
  }
  return values.slice(0, count);
}

function createStepState(definition) {
  return {
    id: definition.id,
    targetRooms: definition.targetRooms,
    designLoad: definition.designLoad,
    roomsStarted: 0,
    peakConcurrentRooms: 0,
    matchesStarted: 0,
    matchesCompleted: 0,
    participantCounts: { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    tableSeatCounts: { 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
    difficultyCounts: { easy: 0, normal: 0, hard: 0 },
    invalidRoomShapes: 0,
    clientObservedWindows: 0,
    raceAttempts: 0,
    plannedMissedWindows: 0,
    wrongBellAttempts: 0,
    reconnects: 0,
    reactionSamplesMs: [],
    clientCadenceLatenessMs: [],
    clientCadenceGapMs: [],
    clientBellOutcomes: { correct: 0, wrong: 0, missed: 0, staleFrames: 0 },
    completedMatchStats: [],
    runtimeSummaries: [],
    serverP95Samples: [],
    redisMemoryRatios: [],
    apiCpuSamples: [],
    metricsAtStart: null,
    metricsAtEnd: null,
    startedAt: null,
    endedAt: null,
    clientOperations: 0,
    clientErrors: 0,
  };
}

class RoomScheduler {
  constructor({ monitor, origin, websocketOrigin }) {
    this.monitor = monitor;
    this.origin = origin;
    this.websocketOrigin = websocketOrigin;
    this.active = new Set();
    this.managers = [];
    this.roomNumber = 0;
    this.target = 0;
    this.enabled = false;
    this.stopped = false;
    this.roomStartHistory = [];
    this.lastConfig = null;
    this.draining = false;
  }

  setLoad(targetRooms, enabled = true) {
    this.target = targetRooms;
    this.enabled = enabled;
    if (enabled) this.fill();
  }

  fill() {
    if (!this.enabled || this.stopped || this.monitor.abortReason) return;
    while (this.active.size < this.target) {
      const step = this.monitor.currentStep;
      if (!step) return;
      const config = step.designLoad
        ? { humans: 4, seats: 4, difficulty: "normal" }
        : { humans: randomInteger(2, 6), seats: randomInteger(4, 8), difficulty: chooseDifficulty() };
      if (config.humans > config.seats) config.seats = config.humans;
      this.roomNumber += 1;
      step.roomsStarted += 1;
      step.participantCounts[config.humans] += 1;
      step.tableSeatCounts[config.seats] += 1;
      step.difficultyCounts[config.difficulty] += 1;
      if (config.humans < 2 || config.humans > 6 || config.seats < 4 || config.seats > 8 || config.humans > config.seats) {
        step.invalidRoomShapes += 1;
      }
      const manager = new RoomManager({
        monitor: this.monitor,
        origin: this.origin,
        websocketOrigin: this.websocketOrigin,
        config,
        roomNumber: this.roomNumber,
      });
      this.managers.push(manager);
      const task = this.runRoom(manager);
      this.active.add(task);
      this.roomStartHistory.push({ at: Date.now(), step: step.id, target: this.target });
      step.peakConcurrentRooms = Math.max(step.peakConcurrentRooms, this.active.size);
      task.then(() => this.roomFinished(task), () => this.roomFinished(task));
    }
  }

  async runRoom(manager) {
    try {
      await manager.enter();
      await manager.readyAndStart();
      manager.scheduleMatchReconnect();
      let matchesPlayed = 1;
      while (!this.monitor.abortReason) {
        const finalSnapshot = await manager.waitForPhase("post_match");
        await manager.settleBellTasks();
        manager.captureFinalMatch(finalSnapshot, this.monitor.currentStep);
        if (matchesPlayed === 1 && !this.draining && Math.random() < 0.5) {
          await manager.continueMatch();
          manager.scheduleMatchReconnect();
          matchesPlayed += 1;
          continue;
        }
        await manager.leaveAfterMatch();
        break;
      }
    } catch (error) {
      if (!this.monitor.abortReason && !error?.clientCounted) this.monitor.recordError(`flow: ${String(error?.message ?? error).slice(0, 80)}`);
    } finally {
      manager.close();
    }
  }

  roomFinished(task) {
    this.active.delete(task);
    if (this.monitor.currentStep) {
      this.monitor.currentStep.peakConcurrentRooms = Math.max(
        this.monitor.currentStep.peakConcurrentRooms,
        this.active.size,
      );
    }
    this.fill();
  }

  stop() {
    this.stopped = true;
    this.enabled = false;
    this.target = 0;
    for (const manager of this.managers) manager.close();
  }

  async drain(limitMs = DRAIN_LIMIT_MS) {
    this.setLoad(0, false);
    this.draining = true;
    const settled = () => Promise.allSettled([...this.active]);
    if (this.active.size > 0 && !this.monitor.abortReason) await Promise.race([settled(), delay(limitMs, undefined, { ref: false })]);
    if (this.active.size > 0) {
      // Rooms still mid-match forfeit so no unobserved room keeps ticking into the next step.
      await Promise.allSettled(this.managers.map((manager) => manager.forfeitAll()));
      await Promise.race([settled(), delay(FORFEIT_GRACE_MS, undefined, { ref: false })]);
    }
    if (this.active.size > 0) for (const manager of this.managers) manager.close();
    this.draining = false;
  }
}

function parsePrometheus(text) {
  const metrics = {
    bellOutcomes: { correct: 0, wrong: 0, stale: 0, missed: 0 },
    histograms: {
      tick: { buckets: new Map(), count: 0 },
      command: { buckets: new Map(), count: 0 },
      due: { buckets: new Map(), count: 0 },
    },
  };
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+([0-9.eE+-]+)$/);
    if (!match) continue;
    const [, name, rawLabels = "", rawValue] = match;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) continue;
    const outcome = rawLabels.match(/(?:^|,)outcome="([^"]+)"/);
    if (name === "halligalli_bell_outcomes_total" && outcome && outcome[1] in metrics.bellOutcomes) {
      metrics.bellOutcomes[outcome[1]] = value;
    }
    for (const [key, prefix] of [
      ["tick", "halligalli_turn_tick_lateness_seconds"],
      ["command", "halligalli_command_latency_seconds"],
      ["due", "halligalli_due_processing_seconds"],
    ]) {
      const histogram = metrics.histograms[key];
      if (name === `${prefix}_bucket`) {
        const le = rawLabels.match(/(?:^|,)le="([^"]+)"/);
        if (le) histogram.buckets.set(le[1], (histogram.buckets.get(le[1]) ?? 0) + value);
      } else if (name === `${prefix}_count`) {
        histogram.count += value;
      }
    }
  }
  return metrics;
}

async function fetchMetrics(url) {
  if (!url) return null;
  try {
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(3_000) });
    if (!response.ok) return null;
    return parsePrometheus(await response.text());
  } catch {
    return null;
  }
}

function metricsDelta(start, end) {
  if (!start || !end) return null;
  const outcomes = {};
  for (const name of Object.keys(end.bellOutcomes)) outcomes[name] = Math.max(0, end.bellOutcomes[name] - start.bellOutcomes[name]);
  const histogramP95 = (name) => {
    const before = start.histograms[name];
    const after = end.histograms[name];
    const count = Math.max(0, after.count - before.count);
    if (count === 0) return { count: 0, p95Ms: null };
    const threshold = Math.ceil(count * 0.95);
    const bounds = [...after.buckets.keys()].sort((left, right) => {
      const a = left === "+Inf" ? Infinity : Number(left);
      const b = right === "+Inf" ? Infinity : Number(right);
      return a - b;
    });
    for (const bound of bounds) {
      const samples = Math.max(0, after.buckets.get(bound) - (before.buckets.get(bound) ?? 0));
      if (samples >= threshold) return { count, p95Ms: bound === "+Inf" ? 2_500 : Number(bound) * 1_000 };
    }
    return { count, p95Ms: null };
  };
  const tick = histogramP95("tick");
  const command = histogramP95("command");
  const due = histogramP95("due");
  return {
    bellOutcomes: outcomes,
    tickSamples: tick.count,
    serverP95Ms: tick.p95Ms,
    commandLatencyP95Ms: command.p95Ms,
    commandLatencySamples: command.count,
    dueProcessingP95Ms: due.p95Ms,
    dueProcessingSamples: due.count,
  };
}

function stepReport(step) {
  const metrics = metricsDelta(step.metricsAtStart, step.metricsAtEnd);
  const summaryLateness = step.serverP95Samples;
  const summaryP95 = percentile(summaryLateness, 0.95);
  const metricP95 = metrics?.serverP95Ms ?? null;
  const serverP95Ms = [summaryP95, metricP95].filter((value) => value !== null).length
    ? Math.max(summaryP95 ?? 0, metricP95 ?? 0)
    : null;
  const commandP95Ms = metrics?.commandLatencyP95Ms ?? null;
  const dueP95Ms = metrics?.dueProcessingP95Ms ?? null;
  const memoryRatio = step.redisMemoryRatios.length ? Math.max(...step.redisMemoryRatios) : null;
  const observedMatches = step.completedMatchStats;
  const bellOutcomes = metrics?.bellOutcomes ?? {
    correct: step.clientBellOutcomes.correct,
    wrong: step.clientBellOutcomes.wrong,
    stale: step.clientBellOutcomes.staleFrames,
    missed: step.clientBellOutcomes.missed,
  };
  return {
    id: step.id,
    targetConcurrentRooms: step.targetRooms,
    peakConcurrentRooms: step.peakConcurrentRooms,
    roomsStarted: step.roomsStarted,
    designLoad: step.designLoad ? { rooms: 10, humansPerRoom: 4, difficulty: "normal" } : null,
    matchesStarted: step.matchesStarted,
    matchesCompleted: step.matchesCompleted,
    roomShapes: {
      humansPerRoom: step.participantCounts,
      tableSeats: step.tableSeatCounts,
      difficulty: step.difficultyCounts,
      invalidShapes: step.invalidRoomShapes,
    },
    clientCadence: {
      p50LatenessMs: round(percentile(step.clientCadenceLatenessMs, 0.5)),
      p95LatenessMs: round(percentile(step.clientCadenceLatenessMs, 0.95)),
      p99LatenessMs: round(percentile(step.clientCadenceLatenessMs, 0.99)),
      p95RevealGapMs: round(percentile(step.clientCadenceGapMs, 0.95)),
    },
    serverTickLatenessP95Ms: round(serverP95Ms),
    serverCommandLatencyP95Ms: round(commandP95Ms),
    serverDueProcessingP95Ms: round(dueP95Ms),
    serverTickSamples: metrics?.tickSamples ?? null,
    maxRedisMemoryRatio: round(memoryRatio, 4),
    medianApiCpuCores: round(percentile(step.apiCpuSamples, 0.5), 3),
    bellOutcomes,
    clientObservedBellWindows: step.clientObservedWindows,
    racingBellAttempts: step.raceAttempts,
    plannedMissedWindows: step.plannedMissedWindows,
    accidentalWrongBellAttempts: step.wrongBellAttempts,
    reconnects: step.reconnects,
    clientErrorRate: step.clientOperations > 0 ? round(step.clientErrors / step.clientOperations) : 0,
    clientOperations: step.clientOperations,
    clientErrors: step.clientErrors,
    invariantMatchesObserved: observedMatches.length,
  };
}

function round(value, digits = 1) {
  return value === null || value === undefined ? null : Number(value.toFixed(digits));
}

function buildResult({ monitor, scheduler, steps, globalMetricsStart, globalMetricsEnd, options }) {
  const violationList = scheduler.managers.flatMap((manager) => manager.invariantViolations);
  const matchSummaries = scheduler.managers.flatMap((manager) => manager.matchSummaries);
  const runComplete = !monitor.abortReason && steps.length === STEP_COUNT && scheduler.active.size === 0;
  const invalidRoomShapes = steps.reduce((sum, step) => sum + step.invalidRoomShapes, 0);
  const designShape = steps.find((step) => step.id === "design-load");
  const designShapeValid = Boolean(
    designShape
    && designShape.peakConcurrentRooms === 10
    && designShape.roomsStarted >= 10
    && designShape.invalidRoomShapes === 0
    && designShape.participantCounts[4] === designShape.roomsStarted
    && designShape.tableSeatCounts[4] === designShape.roomsStarted
    && designShape.difficultyCounts.normal === designShape.roomsStarted,
  );
  const totalCorrectHits = matchSummaries.reduce((sum, match) => sum + match.correctHits, 0);
  const totalMissedHits = matchSummaries.reduce((sum, match) => sum + match.missedHits, 0);
  const totalMissedOutcomes = matchSummaries.reduce((sum, match) => sum + match.missedBellOutcomes, 0);
  const totalWrongHits = matchSummaries.reduce((sum, match) => sum + match.wrongHits, 0);
  const observedWindows = scheduler.managers.reduce((sum, manager) => sum + manager.openWindowSequences.size, 0);
  const observedCorrectHits = runComplete ? totalCorrectHits : monitor.globalClientOutcomes.correct;
  if (observedCorrectHits > observedWindows) {
    violationList.push({
      step: "final-reconciliation",
      invariant: "at most one correct bell per Bell Window",
      observed: `correct hits ${observedCorrectHits} exceeded observed windows ${observedWindows}`,
    });
  }
  const finalMetrics = metricsDelta(globalMetricsStart, globalMetricsEnd);
  const reconciliation = [];
  if (options.metricsUrl && finalMetrics) {
    const outcomeSnapshotSource = runComplete ? "final match snapshots" : "score snapshots before abort";
    const observedScoreOutcomes = runComplete
      ? { correct: totalCorrectHits, wrong: totalWrongHits, missed: totalMissedOutcomes }
      : monitor.globalClientOutcomes;
    for (const [outcome, hits] of [
      ["correct", observedScoreOutcomes.correct],
      ["wrong", observedScoreOutcomes.wrong],
      ["missed", observedScoreOutcomes.missed],
      ["stale", monitor.globalClientOutcomes.staleFrames],
    ]) {
      const server = finalMetrics.bellOutcomes[outcome];
      const snapshotSourceName = outcome === "stale" ? "client stale frames" : outcomeSnapshotSource;
      if (server !== hits) {
        violationList.push({
          step: runComplete ? "final-reconciliation" : null,
          invariant: `server ${outcome} bell counter reconciles with ${snapshotSourceName}`,
          observed: `server=${server}, observed=${hits}`,
        });
      }
      reconciliation.push({
        outcome,
        server,
        observedScoreCount: hits,
        source: snapshotSourceName,
        matches: server === hits,
      });
    }
    const resolvedWindows = finalMetrics.bellOutcomes.correct + finalMetrics.bellOutcomes.missed;
    if (runComplete && observedWindows !== resolvedWindows) {
      violationList.push({
        step: "final-reconciliation",
        invariant: "observed Bell Windows reconcile with server bell outcomes",
        observed: `observed=${observedWindows}, serverResolved=${resolvedWindows}`,
      });
    }
    reconciliation.push({
      outcome: "windowsOpened",
      observed: observedWindows,
      serverResolved: resolvedWindows,
      matches: runComplete ? observedWindows === resolvedWindows : null,
      status: runComplete ? (observedWindows === resolvedWindows ? "pass" : "fail") : "not_run",
    });
  }
  const invariants = [
    {
      name: "at most one correct bell per Bell Window",
      status: observedWindows === 0 ? "not_run" : observedCorrectHits <= observedWindows ? "pass" : "fail",
      observed: {
        correctHits: observedCorrectHits,
        source: runComplete ? "final match snapshots" : "in-flight score snapshots",
        windowsOpened: observedWindows,
        finalMatches: matchSummaries.length,
      },
    },
    {
      name: "Stale Bells change no score",
      status: violationList.some((item) => item.invariant === "Stale Bells change no score")
        ? "fail"
        : monitor.globalClientOutcomes.staleFrames > 0 ? "pass" : "not_run",
      observed: { staleFrames: monitor.globalClientOutcomes.staleFrames },
    },
    {
      name: "Score Breakdown sums to score",
      status: violationList.some((item) => item.invariant === "Score Breakdown sums to score")
        ? "fail"
        : matchSummaries.length > 0 ? "pass" : "not_run",
      observed: { finalParticipantsChecked: matchSummaries.reduce((sum, match) => sum + match.humanParticipants, 0) },
    },
    {
      name: "room revision monotonic per socket",
      status: violationList.some((item) => item.invariant === "room revision monotonic per socket")
        ? "fail"
        : scheduler.managers.some((manager) => manager.socketLifecycles > 0) ? "pass" : "not_run",
      observed: { socketLifecycles: scheduler.managers.reduce((sum, manager) => sum + manager.socketLifecycles, 0) },
    },
    {
      name: "room sizes stay within 2-6 humans and 4-8 seats without overfilling",
      status: scheduler.roomNumber === 0 ? "not_run" : invalidRoomShapes === 0 ? "pass" : "fail",
      observed: { roomsCreated: scheduler.roomNumber, invalidRoomShapes },
    },
    {
      name: "Design Load uses ten four-human normal rooms",
      status: !designShape ? "not_run" : designShapeValid ? "pass" : "fail",
      observed: designShape
        ? { peakConcurrentRooms: designShape.peakConcurrentRooms, roomShapes: stepReport(designShape).roomShapes }
        : { step: "not reached" },
    },
  ];
  for (const item of reconciliation) {
    invariants.push({
      name: `metrics reconciliation: ${item.outcome}`,
      status: item.status ?? (item.matches ? "pass" : "fail"),
      observed: item,
    });
  }
  const stepResults = steps.map(stepReport);
  const bellOutcomeCountersReconciled = reconciliation
    .filter((item) => item.outcome !== "windowsOpened")
    .every((item) => item.matches === true);
  const capacityKnee = stepResults.find((step) => (
    (step.serverTickLatenessP95Ms !== null && step.serverTickLatenessP95Ms > 150)
    || violationList.some((violation) => violation.step === step.id)
  ))?.id ?? (violationList.length > 0 ? "final-reconciliation" : null);
  const designStep = stepResults.find((step) => step.id === "design-load");
  // The client cadence is the second lateness signal: if it exceeds the server's view by more than
  // network jitter explains, the server measurement is suspect and the verdict cannot pass.
  const clientP95 = designStep?.clientCadence?.p95LatenessMs ?? null;
  const signalsDisagree = clientP95 !== null && designStep?.serverTickLatenessP95Ms !== null
    && clientP95 - designStep.serverTickLatenessP95Ms > SIGNAL_DISAGREEMENT_MS;
  const invariantFailed = invariants.some((invariant) => invariant.status === "fail");
  const invariantUnverified = invariants.some((invariant) => invariant.status === "not_run");
  const designLoadVerdict = monitor.abortReason || invariantFailed
    ? "fail"
    : invariantUnverified || designStep?.matchesStarted < 10 || designStep?.peakConcurrentRooms !== 10
      ? "inconclusive"
      : designStep?.serverTickLatenessP95Ms === null || designStep?.maxRedisMemoryRatio === null
      ? "inconclusive"
      : signalsDisagree
      ? "inconclusive"
      : designStep.serverTickLatenessP95Ms <= 150 && designStep.maxRedisMemoryRatio <= 0.8
        ? "pass"
        : "fail";
  // Pre-registered rule: fan-out work only if the Design Load shows p95 tick lateness > 150 ms or
  // sustained (median) API CPU above 80% of the container limit.
  const designCpuRatio = options.apiCpuLimit && designStep?.medianApiCpuCores !== null && designStep?.medianApiCpuCores !== undefined
    ? round(designStep.medianApiCpuCores / options.apiCpuLimit, 3)
    : null;
  const fanOutWorkTriggered = designStep?.serverTickLatenessP95Ms === null || designStep?.serverTickLatenessP95Ms === undefined
    ? null
    : designStep.serverTickLatenessP95Ms > 150 || (designCpuRatio !== null && designCpuRatio > 0.8);
  return {
    schemaVersion: 1,
    target: options.target === "local" ? "localhost" : "approved-live-demo",
    startedAt: new Date(monitor.startedAt).toISOString(),
    finishedAt: new Date().toISOString(),
    totalDurationSeconds: round((Date.now() - monitor.startedAt) / 1_000, 2),
    runLimitSeconds: 1_200,
    configuration: {
      stepSeconds: options.stepSeconds,
      steps: STEP_COUNT,
      mixedHumanParticipantsPerRoom: { min: 2, max: 6 },
      mixedTableSeats: { min: 4, max: 8 },
      difficultyWeights: { easy: 0.3, normal: 0.5, hard: 0.2 },
      reactionMedianMs: 450,
      reactionSigma: 0.35,
      missedWindowProbability: 0.15,
      wrongBellProbability: 0.05,
      reconnectProbabilityPerMatch: 0.05,
      rematchProbabilityAfterFirstMatch: 0.5,
    },
    release: {
      tag: options.releaseTag ?? "not supplied",
      webDigest: options.webDigest ?? "not supplied",
      apiDigest: options.apiDigest ?? "not supplied",
    },
    totals: {
      roomsStarted: scheduler.roomNumber,
      matchesCompleted: matchSummaries.length,
      humanParticipantsInCompletedMatches: matchSummaries.reduce((sum, match) => sum + (match.humanParticipants ?? 0), 0),
      clientOperations: monitor.clientOperations,
      clientErrors: monitor.clientErrors,
      clientErrorRate: monitor.clientOperations > 0 ? round(monitor.clientErrors / monitor.clientOperations, 4) : 0,
      observedBellWindows: observedWindows,
      correctHits: observedCorrectHits,
      wrongHits: runComplete ? totalWrongHits : monitor.globalClientOutcomes.wrong,
      missedHits: runComplete ? totalMissedHits : null,
      missedBellOutcomes: runComplete ? totalMissedOutcomes : monitor.globalClientOutcomes.missed,
      staleFrames: monitor.globalClientOutcomes.staleFrames,
      racingBellAttempts: monitor.totalRaceAttempts,
      plannedMissedWindows: monitor.totalMissedWindowsPlanned,
      accidentalWrongBellAttempts: monitor.totalWrongBellAttempts,
      reconnects: monitor.totalReconnects,
      intendedReactionP50Ms: round(percentile(monitor.totalRevealReactions, 0.5)),
    },
    steps: stepResults,
    invariants,
    invariantViolations: violationList,
    metrics: {
      endpointConfigured: Boolean(options.metricsUrl),
      endpointReachable: Boolean(globalMetricsStart && globalMetricsEnd),
      finalBellOutcomeCounters: finalMetrics?.bellOutcomes ?? null,
      bellOutcomeReconciliation: reconciliation,
      bellOutcomeCountersReconciled: options.metricsUrl && finalMetrics ? bellOutcomeCountersReconciled : null,
      matchSnapshotReconciliationComplete: runComplete,
      runtimeSummarySamples: monitor.summarySamples.length,
      latestRuntimeSummary: monitor.summarySamples.at(-1) ?? null,
    },
    abortReason: monitor.abortReason,
    capacityKnee,
    designLoadVerdict,
    designLoadApiCpuRatio: designCpuRatio,
    fanOutWorkTriggered,
    latencySignalsDisagree: signalsDisagree,
    clientErrorReasons: Object.fromEntries([...monitor.errorReasons].sort((a, b) => b[1] - a[1])),
    runtimeSummary: monitor.summarySamples,
  };
}

function markdownReport(result) {
  const lines = [
    "# Simulated Player Traffic Report",
    "",
    `- Target: ${result.target}`,
    `- Started: ${result.startedAt}`,
    `- Duration: ${result.totalDurationSeconds} s (maximum 1,200 s)`,
    `- Release Tag: ${result.release.tag}`,
    `- Web digest: ${result.release.webDigest}`,
    `- API digest: ${result.release.apiDigest}`,
    `- Capacity knee: ${result.capacityKnee ?? "not observed"}`,
    `- Design Load verdict: ${result.designLoadVerdict}`,
    `- Design Load median API CPU: ${result.designLoadApiCpuRatio === null ? "n/a" : `${(result.designLoadApiCpuRatio * 100).toFixed(1)}% of limit`}`,
    `- Latency signals disagree: ${result.latencySignalsDisagree ? "yes" : "no"}`,
    `- Fan-out work triggered (pre-registered rule): ${result.fanOutWorkTriggered === null ? "undetermined" : result.fanOutWorkTriggered ? "yes" : "no"}`,
    `- Abort reason: ${result.abortReason ?? "none"}`,
    `- Client error rate: ${(result.totals.clientErrorRate * 100).toFixed(2)}% (${result.totals.clientErrors}/${result.totals.clientOperations})`,
    `- Client error reasons: ${Object.keys(result.clientErrorReasons).length ? Object.entries(result.clientErrorReasons).map(([reason, count]) => `${reason} (${count})`).join("; ") : "none"}`,
    "",
    "## Steps",
    "",
    "| Step | Target / peak rooms | Rooms started | Client cadence p95 lateness | Server tick p95 | Command p95 | Due processing p95 | Bell outcomes (correct / wrong / stale / missed) | Redis maxmemory ratio |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const step of result.steps) {
    const outcomes = step.bellOutcomes;
    const server = step.serverTickLatenessP95Ms === null ? "n/a" : `${step.serverTickLatenessP95Ms} ms`;
    const command = step.serverCommandLatencyP95Ms === null ? "n/a" : `${step.serverCommandLatencyP95Ms} ms`;
    const due = step.serverDueProcessingP95Ms === null ? "n/a" : `${step.serverDueProcessingP95Ms} ms`;
    const client = step.clientCadence.p95LatenessMs === null ? "n/a" : `${step.clientCadence.p95LatenessMs} ms`;
    const memory = step.maxRedisMemoryRatio === null ? "n/a" : `${(step.maxRedisMemoryRatio * 100).toFixed(2)}%`;
    lines.push(`| ${step.id} | ${step.targetConcurrentRooms} / ${step.peakConcurrentRooms} | ${step.roomsStarted} | ${client} | ${server} | ${command} | ${due} | ${outcomes.correct} / ${outcomes.wrong} / ${outcomes.stale} / ${outcomes.missed} | ${memory} |`);
  }
  lines.push(
    "",
    "## Room shapes",
    "",
    "| Step | Humans per room | Table seats | Difficulty | Invalid shapes |",
    "|---|---|---|---|---:|",
  );
  for (const step of result.steps) {
    lines.push(`| ${step.id} | ${JSON.stringify(step.roomShapes.humansPerRoom)} | ${JSON.stringify(step.roomShapes.tableSeats)} | ${JSON.stringify(step.roomShapes.difficulty)} | ${step.roomShapes.invalidShapes} |`);
  }
  lines.push("", "## Invariants", "", "| Invariant | Result | Evidence |", "|---|---|---|");
  for (const invariant of result.invariants) {
    lines.push(`| ${invariant.name} | ${invariant.status} | ${JSON.stringify(invariant.observed)} |`);
  }
  lines.push(
    "",
    "## Traffic summary",
    "",
    `- Matches completed: ${result.totals.matchesCompleted}`,
    `- Observed Bell Windows: ${result.totals.observedBellWindows}`,
    `- Racing bell attempts: ${result.totals.racingBellAttempts}`,
    `- Planned missed windows: ${result.totals.plannedMissedWindows}`,
    `- Accidental wrong bell attempts: ${result.totals.accidentalWrongBellAttempts}`,
    `- Reconnects: ${result.totals.reconnects}`,
    `- Intended reaction median: ${result.totals.intendedReactionP50Ms ?? "n/a"} ms`,
    "",
  );
  if (result.invariantViolations.length) {
    lines.push("## Violations", "");
    for (const violation of result.invariantViolations) lines.push(`- ${violation.invariant}: ${violation.observed}`);
    lines.push("");
  }
  return lines.join("\n");
}

function makeReportSafe(result) {
  // The result model intentionally uses aggregate fields only. Keep this allowlist boundary
  // explicit so later bot telemetry cannot accidentally add credentials, room codes, or IPs.
  for (const key of ["roomCode", "credential", "ip", "address", "participantName"]) {
    if (key in result) delete result[key];
  }
  return result;
}

async function run(options) {
  const monitor = new Monitor(options);
  const scheduler = new RoomScheduler({
    monitor,
    origin: options.originUrl,
    websocketOrigin: options.websocketOrigin,
  });
  monitor.setScheduler(scheduler);
  const steps = [];
  const globalMetricsStart = await fetchMetrics(options.metricsUrl);
  monitor.startMetricsWatcher(options.metricsUrl, globalMetricsStart);
  for (const definition of RAMP_STEPS) {
    if (monitor.abortReason) break;
    const step = createStepState(definition);
    step.startedAt = new Date().toISOString();
    step.metricsAtStart = await fetchMetrics(options.metricsUrl);
    steps.push(step);
    monitor.currentStep = step;
    scheduler.setLoad(definition.targetRooms, true);
    process.stdout.write(`Starting ${step.id} (${options.stepSeconds}s)\n`);
    await monitor.wait(options.stepSeconds * 1_000);
    scheduler.setLoad(0, false);
    step.metricsAtEnd = await fetchMetrics(options.metricsUrl);
    step.endedAt = new Date().toISOString();
  }
  if (!monitor.abortReason && steps.length === RAMP_STEPS.length) {
    // Drain ramp rooms so the Design Load contains exactly ten normal rooms, including in a short dry run.
    monitor.currentStep = null;
    await scheduler.drain();
  }
  if (!monitor.abortReason && steps.length === RAMP_STEPS.length) {
    const step = createStepState(DESIGN_STEP);
    step.startedAt = new Date().toISOString();
    step.metricsAtStart = await fetchMetrics(options.metricsUrl);
    steps.push(step);
    monitor.currentStep = step;
    scheduler.setLoad(DESIGN_STEP.targetRooms, true);
    process.stdout.write(`Starting ${step.id} (${options.stepSeconds}s)\n`);
    await monitor.wait(options.stepSeconds * 1_000);
    scheduler.setLoad(0, false);
    step.metricsAtEnd = await fetchMetrics(options.metricsUrl);
    step.endedAt = new Date().toISOString();
    monitor.currentStep = null;
    await scheduler.drain();
  }
  monitor.currentStep = null;
  if (monitor.abortReason) scheduler.stop();
  await scheduler.drain();
  const globalMetricsEnd = await fetchMetrics(options.metricsUrl);
  monitor.closeInputs();
  const result = makeReportSafe(buildResult({ monitor, scheduler, steps, globalMetricsStart, globalMetricsEnd, options }));
  await writeFile(options.jsonOut, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(options.reportOut, markdownReport(result), "utf8");
  process.stdout.write(`Wrote JSON result: ${options.jsonOut}\nWrote Markdown report: ${options.reportOut}\n`);
  return result;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${usage()}`);
    process.exitCode = 2;
    return;
  }
  try {
    const result = await run(options);
    if (result.abortReason || result.invariantViolations.length || result.designLoadVerdict === "fail") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`Load harness failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

await main();
