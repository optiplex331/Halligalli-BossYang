import { randomUUID, subtle } from "node:crypto";
import assert from "node:assert/strict";

const origin = process.env.HALLIGALLI_E2E_ORIGIN ?? "http://localhost:5173";
const websocketOrigin = origin.replace(/^http/, "ws");

async function verifier(credential) {
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(credential));
  return Buffer.from(digest).toString("hex");
}

async function enter(path, name, credential, configuration, idempotencyKey = randomUUID()) {
  const response = await fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ name, credentialVerifier: await verifier(credential), ...configuration }),
  });
  assert.equal(response.status, 201, `entry for ${name} succeeds through Web proxy`);
  return response.json();
}

async function connect(roomCode, credential) {
  const socket = new WebSocket(`${websocketOrigin}/ws/v1/rooms/${roomCode}`);
  const snapshots = [];
  const waiters = [];
  let latestSnapshot = null;
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(String(data));
    if (message.type !== "snapshot") return;
    latestSnapshot = message.snapshot;
    const waiter = waiters.shift();
    if (waiter) waiter(message.snapshot);
    else snapshots.push(message.snapshot);
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.send(JSON.stringify({ type: "authenticate", credential }));
  const client = {
    socket,
    snapshot: null,
    async next() {
      const snapshot = snapshots.shift() ?? await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("snapshot timed out")), 5_000);
        waiters.push((value) => {
          clearTimeout(timer);
          resolve(value);
        });
      });
      this.snapshot = snapshot;
      return snapshot;
    },
    async command(type) {
      const revision = latestSnapshot?.revision ?? -1;
      socket.send(JSON.stringify({ type, commandId: randomUUID() }));
      let snapshot;
      do {
        snapshot = await this.next();
      } while (snapshot.revision <= revision);
      return snapshot;
    },
    async waitFor(predicate) {
      let snapshot;
      do {
        snapshot = await this.next();
      } while (!predicate(snapshot));
      return snapshot;
    },
    close() { socket.close(); },
  };
  await client.next();
  return client;
}

async function roomWith(tableSeatCount, count, prefix) {
  const credentials = Array.from({ length: count }, (_, index) => `${prefix}-${index}-${randomUUID()}`);
  const created = await enter("/api/v1/rooms", `${prefix} 1`, credentials[0], {
    tableSeatCount,
    targetHumanParticipantCount: count,
    difficulty: "normal",
    durationSec: 60,
  });
  for (let index = 1; index < count; index += 1) {
    await enter(`/api/v1/rooms/${created.roomCode}/participants`, `${prefix} ${index + 1}`, credentials[index]);
  }
  const clients = await Promise.all(credentials.map((credential) => connect(created.roomCode, credential)));
  return { roomCode: created.roomCode, credentials, clients };
}

async function readyAndStart(clients) {
  for (const client of clients) {
    const requestedReady = await client.command("ready");
    const isReady = (snapshot) => snapshot.participants.some(
      (participant) => participant.seatIndex === snapshot.viewerSeatIndex && participant.ready,
    );
    if (!isReady(requestedReady)) await client.waitFor(isReady);
  }
  const requestedStart = await clients[0].command("start");
  const started = requestedStart.phase === "playing"
    ? requestedStart
    : await clients[0].waitFor((snapshot) => snapshot.phase === "playing");
  assert.equal(started.phase, "playing");
  return started;
}

async function run() {
  console.log("paired runtime sequential-match journey");
  const sequential = await roomWith(4, 3, "Next");
  const started = await readyAndStart(sequential.clients);
  assert.equal(started.configuration.tableSeatCount, 4);
  assert.equal(started.configuration.targetHumanParticipantCount, 3);
  assert.equal(started.seats.length, 4);
  assert.equal(started.scoreboard.length, 3);
  const requestedForfeit = await sequential.clients[2].command("forfeit");
  const postMatch = requestedForfeit.phase === "post_match"
    ? requestedForfeit
    : await sequential.clients[2].waitFor((snapshot) => snapshot.phase === "post_match");
  assert.equal(postMatch.phase, "post_match");
  await sequential.clients[0].command("continue");
  await sequential.clients[1].command("continue");
  console.log("waiting for post-match decision window");
  await new Promise((resolve) => setTimeout(resolve, 31_000));
  const lobby = await sequential.clients[0].waitFor((snapshot) => snapshot.phase === "lobby");
  assert.equal(lobby.phase, "lobby");
  const replacementCredential = `Next replacement-${randomUUID()}`;
  await enter(`/api/v1/rooms/${sequential.roomCode}/participants`, "Next replacement", replacementCredential);
  const replacement = await connect(sequential.roomCode, replacementCredential);
  const secondMatch = await readyAndStart([...sequential.clients.slice(0, 2), replacement]);
  assert.equal(secondMatch.matchNumber, 2);
  replacement.close();
  sequential.clients.forEach((client) => client.close());
}

await run();
console.log("Compose multiplayer journey passed");
