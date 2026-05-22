const FALLBACK_VERSION = "local";
const FALLBACK_COMMIT = "unknown";

function readEnvValue(env, key) {
  const value = env[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getReleaseIdentity(env = process.env) {
  return {
    version: readEnvValue(env, "APP_VERSION") || FALLBACK_VERSION,
    commit: readEnvValue(env, "COMMIT_SHA") || readEnvValue(env, "GITHUB_SHA") || FALLBACK_COMMIT,
  };
}

export function createHealthPayload({ roomCount = 0, env = process.env } = {}) {
  const release = getReleaseIdentity(env);

  return {
    status: "ok",
    rooms: roomCount,
    version: release.version,
    commit: release.commit,
  };
}
