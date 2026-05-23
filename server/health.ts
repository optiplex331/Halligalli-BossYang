const FALLBACK_VERSION = "local";
const FALLBACK_COMMIT = "unknown";

interface ReleaseIdentity {
  version: string;
  commit: string;
}

interface HealthPayload extends ReleaseIdentity {
  status: "ok";
  rooms: number;
}

function readEnvValue(env: NodeJS.ProcessEnv, key: string): string | null {
  const value = env[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getReleaseIdentity(env = process.env): ReleaseIdentity {
  return {
    version: readEnvValue(env, "APP_VERSION") || FALLBACK_VERSION,
    commit: readEnvValue(env, "COMMIT_SHA") || readEnvValue(env, "GITHUB_SHA") || FALLBACK_COMMIT,
  };
}

export function createHealthPayload({
  roomCount = 0,
  env = process.env,
}: { roomCount?: number; env?: NodeJS.ProcessEnv } = {}): HealthPayload {
  const release = getReleaseIdentity(env);

  return {
    status: "ok",
    rooms: roomCount,
    version: release.version,
    commit: release.commit,
  };
}
