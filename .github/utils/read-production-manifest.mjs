import {
	appendGithubOutputs,
	readReleaseIdentity,
} from "./production-manifest.mjs";

try {
	const identity = readReleaseIdentity(
		process.env.SPEC_PATH ?? "deploy/production/app.yaml",
	);
	const outputs = {
		image_digest: identity.imageDigest,
		app_version: identity.appVersion,
		commit_sha: identity.commitSha,
	};

	for (const line of appendGithubOutputs(outputs)) {
		console.log(line);
	}
} catch (error) {
	console.error(error.message);
	process.exit(1);
}
