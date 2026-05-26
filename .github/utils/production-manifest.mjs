import fs from "node:fs";

const DEFAULT_SERVICE_NAME = "web";

export function fail(message) {
	throw new Error(message);
}

function unquote(value) {
	return value.trim().replace(/^["']|["']$/g, "");
}

function lineIndent(line) {
	const match = line.match(/^ */);
	return match ? match[0].length : 0;
}

function splitLines(text) {
	return text.split(/\r?\n/);
}

function findServiceRange(lines, serviceName = DEFAULT_SERVICE_NAME) {
	const servicesIndex = lines.findIndex((line) => line.trim() === "services:");

	if (servicesIndex === -1) {
		fail("Production Manifest must define services");
	}

	const matches = [];

	for (let index = servicesIndex + 1; index < lines.length; index += 1) {
		const line = lines[index];
		const serviceMatch = line.match(/^(\s*)-\s+name:\s*(.+)$/);

		if (serviceMatch) {
			const name = unquote(serviceMatch[2]);
			if (name === serviceName) {
				matches.push({ index, indent: serviceMatch[1].length });
			}
			continue;
		}

		if (/^\S/.test(line) && line.trim() !== "") {
			break;
		}
	}

	if (matches.length !== 1) {
		fail(`Production Manifest must define exactly one ${serviceName} service`);
	}

	const { index: start, indent } = matches[0];
	let end = lines.length;

	for (let index = start + 1; index < lines.length; index += 1) {
		const line = lines[index];
		const serviceMatch = line.match(/^(\s*)-\s+name:\s*(.+)$/);

		if (serviceMatch && serviceMatch[1].length === indent) {
			end = index;
			break;
		}

		if (/^\S/.test(line) && line.trim() !== "") {
			end = index;
			break;
		}
	}

	return { start, end };
}

function findNestedBlock(lines, range, key) {
	const matches = [];

	for (let index = range.start + 1; index < range.end; index += 1) {
		if (lines[index].trim() === `${key}:`) {
			matches.push({ start: index, indent: lineIndent(lines[index]) });
		}
	}

	if (matches.length !== 1) {
		fail(`Production Manifest web service must define exactly one ${key} block`);
	}

	const block = matches[0];
	let end = range.end;

	for (let index = block.start + 1; index < range.end; index += 1) {
		const line = lines[index];
		if (line.trim() === "") {
			continue;
		}

		if (lineIndent(line) <= block.indent && !line.trim().startsWith("- ")) {
			end = index;
			break;
		}
	}

	return { start: block.start, end, indent: block.indent };
}

function readScalarFromBlock(lines, block, key, { required = true } = {}) {
	const matches = [];
	const pattern = new RegExp(`^\\s*${key}:\\s*(.*)$`);

	for (let index = block.start + 1; index < block.end; index += 1) {
		const match = lines[index].match(pattern);
		if (match && lineIndent(lines[index]) > block.indent) {
			matches.push({ index, value: unquote(match[1]) });
		}
	}

	if (matches.length === 0 && !required) {
		return null;
	}

	if (matches.length !== 1) {
		fail(`Production Manifest ${key} must appear exactly once in the web image block`);
	}

	return matches[0];
}

function findEnvValueLine(lines, envBlock, key) {
	const matches = [];

	for (let index = envBlock.start + 1; index < envBlock.end; index += 1) {
		const keyMatch = lines[index].match(/^\s*-\s+key:\s*(.+)$/);
		if (!keyMatch || unquote(keyMatch[1]) !== key) {
			continue;
		}

		let valueLine = -1;
		let value = "";

		for (let next = index + 1; next < envBlock.end; next += 1) {
			if (/^\s*-\s+key:\s*/.test(lines[next])) {
				break;
			}

			const valueMatch = lines[next].match(/^\s*value:\s*(.*)$/);
			if (valueMatch) {
				valueLine = next;
				value = unquote(valueMatch[1]);
				break;
			}
		}

		if (valueLine === -1) {
			fail(`Production Manifest env ${key} must define a value`);
		}

		matches.push({ index: valueLine, value });
	}

	if (matches.length !== 1) {
		fail(`Production Manifest must define exactly one ${key} env value`);
	}

	return matches[0];
}

function parseManifestText(text) {
	const lines = splitLines(text);
	const service = findServiceRange(lines);
	const imageBlock = findNestedBlock(lines, service, "image");
	const envBlock = findNestedBlock(lines, service, "envs");

	const registryType = readScalarFromBlock(lines, imageBlock, "registry_type");
	const registry = readScalarFromBlock(lines, imageBlock, "registry");
	const repository = readScalarFromBlock(lines, imageBlock, "repository");
	const digest = readScalarFromBlock(lines, imageBlock, "digest");
	const tag = readScalarFromBlock(lines, imageBlock, "tag", { required: false });
	const version = findEnvValueLine(lines, envBlock, "APP_VERSION");
	const commit = findEnvValueLine(lines, envBlock, "COMMIT_SHA");

	return {
		lines,
		image: {
			registry_type: registryType.value,
			registry: registry.value,
			repository: repository.value,
			digest: digest.value,
			tag: tag?.value ?? "",
		},
		identity: {
			imageDigest: digest.value,
			appVersion: version.value,
			commitSha: commit.value,
		},
		lineIndexes: {
			digest: digest.index,
			appVersion: version.index,
			commitSha: commit.index,
		},
	};
}

function webService(spec) {
	if (!spec || typeof spec !== "object") {
		fail("Live production spec must be an object");
	}

	const services = Array.isArray(spec.services)
		? spec.services
		: Array.isArray(spec.spec?.services)
			? spec.spec.services
			: null;

	if (!services) {
		fail("Live production spec must define services");
	}

	const matches = services.filter((service) => service?.name === DEFAULT_SERVICE_NAME);

	if (matches.length !== 1) {
		fail(`Live production spec must define exactly one ${DEFAULT_SERVICE_NAME} service`);
	}

	return matches[0];
}

function envMap(service) {
	if (!Array.isArray(service.envs)) {
		fail("Live production web service must define envs");
	}

	return new Map(
		service.envs.map((env) => [String(env.key), String(env.value ?? "")]),
	);
}

export function readProductionManifest(text) {
	return parseManifestText(text);
}

export function readProductionManifestFile(path) {
	return readProductionManifest(fs.readFileSync(path, "utf8"));
}

export function readReleaseIdentity(path) {
	return readProductionManifestFile(path).identity;
}

export function validateProductionManifest(path) {
	const manifest = readProductionManifestFile(path);

	if (manifest.image.registry_type !== "GHCR") {
		fail("Production Manifest must reference GHCR");
	}

	if (!manifest.image.digest.startsWith("sha256:")) {
		fail("Production Manifest must use image.digest");
	}

	if (manifest.image.tag) {
		fail("Production Manifest must not use image.tag");
	}

	if (!manifest.identity.appVersion) {
		fail("Production Manifest must set APP_VERSION");
	}

	if (!manifest.identity.commitSha) {
		fail("Production Manifest must set COMMIT_SHA");
	}
}

export function writeReleaseIdentity(path, identity) {
	const current = fs.readFileSync(path, "utf8");
	const manifest = readProductionManifest(current);
	const lines = manifest.lines.slice();

	const replacements = {
		digest: identity.imageDigest,
		appVersion: identity.appVersion,
		commitSha: identity.commitSha,
	};

	if (!replacements.digest?.startsWith("sha256:")) {
		fail("IMAGE_DIGEST must be a sha256 digest");
	}

	if (!replacements.appVersion) {
		fail("VERSION must be set");
	}

	if (!replacements.commitSha) {
		fail("COMMIT_SHA must be set");
	}

	lines[manifest.lineIndexes.digest] = lines[
		manifest.lineIndexes.digest
	].replace(/digest:\s*.*$/, `digest: ${replacements.digest}`);
	lines[manifest.lineIndexes.appVersion] = lines[
		manifest.lineIndexes.appVersion
	].replace(/value:\s*.*$/, `value: ${replacements.appVersion}`);
	lines[manifest.lineIndexes.commitSha] = lines[
		manifest.lineIndexes.commitSha
	].replace(/value:\s*.*$/, `value: ${replacements.commitSha}`);

	const newline = current.endsWith("\n") ? "\n" : "";
	fs.writeFileSync(path, `${lines.join("\n").replace(/\n$/, "")}${newline}`);
}

export function compareProductionManifestToLiveSpec(manifestText, liveSpec) {
	const desired = readProductionManifest(manifestText);
	const liveWeb = webService(liveSpec);
	const liveImage = liveWeb.image ?? {};
	const liveEnv = envMap(liveWeb);

	const comparisons = [
		[
			"image.registry_type",
			desired.image.registry_type,
			liveImage.registry_type,
		],
		["image.registry", desired.image.registry, liveImage.registry],
		["image.repository", desired.image.repository, liveImage.repository],
		["image.digest", desired.image.digest, liveImage.digest],
		["APP_VERSION", desired.identity.appVersion, liveEnv.get("APP_VERSION")],
		["COMMIT_SHA", desired.identity.commitSha, liveEnv.get("COMMIT_SHA")],
	];

	const drift = comparisons
		.filter(([, expected, actual]) => expected !== actual)
		.map(
			([field, expected, actual]) =>
				`${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
		);

	return {
		drift,
		identity: desired.identity,
	};
}

export function checkHealthReleaseIdentity(body, expected) {
	let health;

	try {
		health = JSON.parse(body);
	} catch {
		fail(`Health response is not valid JSON: ${body}`);
	}

	if (health.status !== "ok") {
		fail(`Unexpected health status: ${JSON.stringify(health)}`);
	}

	if (
		health.version !== expected.appVersion ||
		health.commit !== expected.commitSha
	) {
		fail(
			`Release identity mismatch: ${JSON.stringify({
				expectedVersion: expected.appVersion,
				actualVersion: health.version,
				expectedCommit: expected.commitSha,
				actualCommit: health.commit,
			})}`,
		);
	}

	return health;
}

export function appendGithubOutputs(outputs, outputPath = process.env.GITHUB_OUTPUT) {
	const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);

	if (outputPath) {
		fs.appendFileSync(outputPath, `${lines.join("\n")}\n`);
	}

	return lines;
}
