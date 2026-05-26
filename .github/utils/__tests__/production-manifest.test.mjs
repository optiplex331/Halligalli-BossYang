import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
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

describe("Production Manifest utilities", () => {
	it("reads release identity from the Production Manifest", () => {
		expect(readProductionManifest(manifest).identity).toEqual({
			imageDigest: "sha256:old",
			appVersion: "0.2.0",
			commitSha: "abc123",
		});
	});

	it("updates only release identity fields in the Production Manifest", () => {
		const file = tempManifest();

		writeReleaseIdentity(file, {
			imageDigest: "sha256:new",
			appVersion: "0.3.0",
			commitSha: "def456",
		});

		const updated = fs.readFileSync(file, "utf8");
		expect(readReleaseIdentity(file).imageDigest).toBe("sha256:new");
		expect(readReleaseIdentity(file).appVersion).toBe("0.3.0");
		expect(readReleaseIdentity(file).commitSha).toBe("def456");
		expect(updated).toMatch(/registry: optiplex331/);
		expect(updated).toMatch(/repository: halligalli-bossyang/);
		expect(updated).toMatch(/value: production/);
	});

	it("reports no drift when live spec matches the Production Manifest", () => {
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

		expect(compareProductionManifestToLiveSpec(manifest, liveSpec).drift).toEqual(
			[],
		);
	});

	it("reports drift when live release identity differs", () => {
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

		expect(compareProductionManifestToLiveSpec(manifest, liveSpec).drift).toEqual(
			[
				'image.digest: expected "sha256:old", got "sha256:different"',
				'COMMIT_SHA: expected "abc123", got "zzz999"',
			],
		);
	});

	it("accepts a matching health response", () => {
		const health = checkHealthReleaseIdentity(
			JSON.stringify({ status: "ok", version: "0.2.0", commit: "abc123" }),
			{ appVersion: "0.2.0", commitSha: "abc123" },
		);

		expect(health.status).toBe("ok");
	});

	it("rejects a mismatched health response", () => {
		expect(() =>
			checkHealthReleaseIdentity(
				JSON.stringify({ status: "ok", version: "0.3.0", commit: "abc123" }),
				{ appVersion: "0.2.0", commitSha: "abc123" },
			),
		).toThrow(/Release identity mismatch/);
	});
});
