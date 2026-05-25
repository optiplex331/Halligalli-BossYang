import fs from "node:fs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function unquote(value) {
  return value.trim().replace(/^["']|["']$/g, "");
}

function findServiceBlock(manifest, serviceName) {
  const lines = manifest.split(/\r?\n/);
  const servicesIndex = lines.findIndex((line) => line.trim() === "services:");

  if (servicesIndex === -1) {
    return "";
  }

  let currentName = "";
  let currentBlock = [];

  for (const line of lines.slice(servicesIndex + 1)) {
    if (/^\S/.test(line) && !line.startsWith("- ")) {
      break;
    }

    const serviceMatch = line.match(/^\s*-\s+name:\s*(.+)$/);
    if (serviceMatch) {
      if (currentName === serviceName) {
        return currentBlock.join("\n");
      }

      currentName = unquote(serviceMatch[1]);
      currentBlock = [line];
      continue;
    }

    if (currentBlock.length > 0) {
      currentBlock.push(line);
    }
  }

  return currentName === serviceName ? currentBlock.join("\n") : "";
}

function readBlockValue(block, key) {
  const match = block.match(new RegExp(`^\\s+${key}:\\s*(.+)$`, "m"));
  return match ? unquote(match[1]) : "";
}

function readEnvValues(block) {
  const envs = new Map();
  const matches = block.matchAll(/^\s*-\s+key:\s*(.+)\r?\n\s+value:\s*(.*)$/gm);

  for (const match of matches) {
    envs.set(unquote(match[1]), unquote(match[2]));
  }

  return envs;
}

const releaseConfig = readJson(".github/utils/release-please-config.json");
const releaseManifest = readJson(".github/utils/.release-please-manifest.json");
const packageJson = readJson("package.json");
const productionManifest = fs.readFileSync("deploy/production/app.yaml", "utf8");

if (releaseConfig["include-v-in-tag"] !== true) {
  fail("Release Please must include v in tags");
}

if (releaseConfig["include-component-in-tag"] !== false) {
  fail("Release Please must not include component names in tags");
}

if (!Object.hasOwn(releaseManifest, ".")) {
  fail("Release Please manifest must track the root package");
}

if (Object.hasOwn(packageJson, "version")) {
  fail("package.json must not be a release version source");
}

const web = findServiceBlock(productionManifest, "web");
if (!web) {
  fail("Production Manifest must define the web service");
}

if (readBlockValue(web, "registry_type") !== "GHCR") {
  fail("Production Manifest must reference GHCR");
}

if (!readBlockValue(web, "digest").startsWith("sha256:")) {
  fail("Production Manifest must use image.digest");
}

if (/^\s+tag:\s*/m.test(web)) {
  fail("Production Manifest must not use image.tag");
}

const envs = readEnvValues(web);
if (!envs.get("APP_VERSION")) {
  fail("Production Manifest must set APP_VERSION");
}

if (!envs.get("COMMIT_SHA")) {
  fail("Production Manifest must set COMMIT_SHA");
}
