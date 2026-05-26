import { checkHealthReleaseIdentity } from "./production-manifest.mjs";

try {
	checkHealthReleaseIdentity(process.env.HEALTH_RESPONSE ?? "", {
		appVersion: process.env.EXPECTED_VERSION,
		commitSha: process.env.EXPECTED_COMMIT,
	});

	if (process.env.SUCCESS_MESSAGE) {
		console.log(process.env.SUCCESS_MESSAGE);
	}
} catch (error) {
	console.error(error.message);
	process.exit(1);
}
