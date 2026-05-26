import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
	checkHealthReleaseIdentity,
	compareProductionManifestToLiveSpec,
	readProductionManifest,
	readReleaseIdentity,
	writeReleaseIdentity,
} from "../production-manifest.mjs";

const manifest = `name: halligalli
region: ams
services:
- name: web
  image:
    registry_type: GHCR
    registry: optiplex331
    repository: halligalli-bossyang
    digest: sha256:old
  instance_count: 1
  envs:
  - key: NODE_ENV
    value: production
  - key: APP_VERSION
    value: 0.2.0
  - key: COMMIT_SHA
    value: abc123
`;

function tempManifest() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "halligalli-manifest-"));
	const file = path.join(dir, "app.yaml");
	fs.writeFileSync(file, manifest);
	return file;
}

test("reads release identity from the Production Manifest", () => {
	assert.deepEqual(readProductionManifest(manifest).identity, {
		imageDigest: "sha256:old",
		appVersion: "0.2.0",
		commitSha: "abc123",
	});
});

test("updates only release identity fields in the Production Manifest", () => {
	const file = tempManifest();

	writeReleaseIdentity(file, {
		imageDigest: "sha256:new",
		appVersion: "0.3.0",
		commitSha: "def456",
	});

	const updated = fs.readFileSync(file, "utf8");
	assert.equal(readReleaseIdentity(file).imageDigest, "sha256:new");
	assert.equal(readReleaseIdentity(file).appVersion, "0.3.0");
	assert.equal(readReleaseIdentity(file).commitSha, "def456");
	assert.match(updated, /registry: optiplex331/);
	assert.match(updated, /repository: halligalli-bossyang/);
	assert.match(updated, /value: production/);
});

test("reports no drift when live spec matches the Production Manifest", () => {
	const liveSpec = {
		services: [
			{
				name: "web",
				image: {
					registry_type: "GHCR",
					registry: "optiplex331",
					repository: "halligalli-bossyang",
					digest: "sha256:old",
				},
				envs: [
					{ key: "APP_VERSION", value: "0.2.0" },
					{ key: "COMMIT_SHA", value: "abc123" },
				],
			},
		],
	};

	assert.deepEqual(
		compareProductionManifestToLiveSpec(manifest, liveSpec).drift,
		[],
	);
});

test("reports drift when live release identity differs", () => {
	const liveSpec = {
		services: [
			{
				name: "web",
				image: {
					registry_type: "GHCR",
					registry: "optiplex331",
					repository: "halligalli-bossyang",
					digest: "sha256:different",
				},
				envs: [
					{ key: "APP_VERSION", value: "0.2.0" },
					{ key: "COMMIT_SHA", value: "zzz999" },
				],
			},
		],
	};

	assert.deepEqual(compareProductionManifestToLiveSpec(manifest, liveSpec).drift, [
		'image.digest: expected "sha256:old", got "sha256:different"',
		'COMMIT_SHA: expected "abc123", got "zzz999"',
	]);
});

test("accepts a matching health response", () => {
	const health = checkHealthReleaseIdentity(
		JSON.stringify({ status: "ok", version: "0.2.0", commit: "abc123" }),
		{ appVersion: "0.2.0", commitSha: "abc123" },
	);

	assert.equal(health.status, "ok");
});

test("rejects a mismatched health response", () => {
	assert.throws(
		() =>
			checkHealthReleaseIdentity(
				JSON.stringify({ status: "ok", version: "0.3.0", commit: "abc123" }),
				{ appVersion: "0.2.0", commitSha: "abc123" },
			),
		/Release identity mismatch/,
	);
});
