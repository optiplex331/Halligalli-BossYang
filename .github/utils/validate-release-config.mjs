import fs from "node:fs";
import { validateProductionManifest } from "./production-manifest.mjs";

// Reads and parses a JSON file from the repository.
function readJson(path) {
	return JSON.parse(fs.readFileSync(path, "utf8"));
}

// Prints a validation error and exits with a failing status for CI.
function fail(message) {
	console.error(message);
	process.exit(1);
}

const releaseConfig = readJson(".github/utils/release-please-config.json");
const releaseManifest = readJson(".github/utils/.release-please-manifest.json");
const packageJson = readJson("package.json");

// Validates Release Please tag shape and version ownership.
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

try {
	validateProductionManifest("deploy/production/app.yaml");
} catch (error) {
	fail(error.message);
}
