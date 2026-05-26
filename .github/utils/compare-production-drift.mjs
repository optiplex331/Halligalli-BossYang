import fs from "node:fs";
import {
	appendGithubOutputs,
	compareProductionManifestToLiveSpec,
} from "./production-manifest.mjs";

const specPath = process.env.SPEC_PATH ?? "deploy/production/app.yaml";
const liveSpecPath = process.env.LIVE_SPEC_PATH ?? "live-app-spec.json";

try {
	const result = compareProductionManifestToLiveSpec(
		fs.readFileSync(specPath, "utf8"),
		JSON.parse(fs.readFileSync(liveSpecPath, "utf8")),
	);

	if (result.drift.length > 0) {
		console.error("Production drift detected:");
		for (const line of result.drift) {
			console.error(`- ${line}`);
		}
		process.exit(1);
	}

	const outputs = {
		app_version: result.identity.appVersion,
		commit_sha: result.identity.commitSha,
		image_digest: result.identity.imageDigest,
	};

	for (const line of appendGithubOutputs(outputs)) {
		console.log(line);
	}
} catch (error) {
	console.error(error.message);
	process.exit(1);
}
