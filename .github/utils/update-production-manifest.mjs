import { writeReleaseIdentity } from "./production-manifest.mjs";

try {
	writeReleaseIdentity(process.env.SPEC_PATH ?? "deploy/production/app.yaml", {
		appVersion: process.env.VERSION,
		commitSha: process.env.COMMIT_SHA,
		imageDigest: process.env.IMAGE_DIGEST,
	});
} catch (error) {
	console.error(error.message);
	process.exit(1);
}
