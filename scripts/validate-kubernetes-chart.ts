import { execFileSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { parseAllDocuments } from "yaml";

type Manifest = Record<string, unknown>;

export function parseRenderedManifests(renderedYaml: string): Manifest[] {
  return parseAllDocuments(renderedYaml)
    .map((document) => document.toJSON())
    .filter(isRecord)
    .filter((manifest) => typeof manifest.kind === "string");
}

export function validateRenderedManifests(manifests: Manifest[]): string[] {
  const errors: string[] = [];
  const deployments = manifests.filter((manifest) => manifest.kind === "Deployment");
  const services = manifests.filter((manifest) => manifest.kind === "Service");
  const ingresses = manifests.filter((manifest) => manifest.kind === "Ingress");
  const secrets = manifests.filter((manifest) => manifest.kind === "Secret");

  if (deployments.length !== 1) {
    errors.push(`expected exactly one Deployment, found ${deployments.length}`);
  }
  if (services.length !== 1) {
    errors.push(`expected exactly one Service, found ${services.length}`);
  }
  if (ingresses.length > 1) {
    errors.push(`expected at most one Ingress, found ${ingresses.length}`);
  }
  if (secrets.length > 0) {
    errors.push("expected no rendered Kubernetes Secret objects");
  }

  assertSameOriginIngress(errors, ingresses[0], services[0]);

  const deployment = deployments[0];
  if (!deployment) {
    return errors;
  }

  const replicas = readPath(deployment, ["spec", "replicas"]);
  if (replicas !== 1) {
    errors.push(`expected Deployment replicas to be 1, found ${String(replicas)}`);
  }
  assertSinglePodRollbackStrategy(errors, deployment);

  const containers = readPath(deployment, ["spec", "template", "spec", "containers"]);
  if (!Array.isArray(containers) || containers.length === 0) {
    errors.push("expected Deployment to render at least one container");
    return errors;
  }

  const container = containers.find((item) => isRecord(item) && item.name === "halligalli");
  if (!isRecord(container)) {
    errors.push("expected Deployment to render a halligalli container");
    return errors;
  }

  const image = container.image;
  if (typeof image !== "string" || !/^.+@sha256:[0-9a-f]{64}$/.test(image)) {
    errors.push("expected container image to be digest-pinned with @sha256:<64 lowercase hex characters>");
  }
  if (typeof image === "string" && image.includes(":latest")) {
    errors.push("expected container image not to use the latest tag");
  }

  const envNames = readEnvNames(container);
  for (const requiredEnvName of ["PORT", "APP_VERSION", "COMMIT_SHA"]) {
    if (!envNames.has(requiredEnvName)) {
      errors.push(`expected container env to include ${requiredEnvName}`);
    }
  }
  if (envNames.has("VITE_HALLIGALLI_BACKEND_URL")) {
    errors.push("expected standalone runtime not to set VITE_HALLIGALLI_BACKEND_URL");
  }

  assertHttpProbe(errors, container, "livenessProbe", "/health");
  assertHttpProbe(errors, container, "readinessProbe", "/readyz");
  assertResources(errors, container);

  return errors;
}

export function runLocalKubernetesValidation(): void {
  const chartPath = "charts/halligalli";
  const valuesPath = "examples/kubernetes/standalone-values.yaml";

  console.log("Validating Halligalli Helm Chart locally.");
  console.log("Local/static check: this runs Helm rendering only and does not contact Azure or a cluster.");

  runHelm(["lint", chartPath]);
  runHelm(["lint", chartPath, "-f", valuesPath]);

  const renderedYaml = runHelm(["template", "halligalli", chartPath, "-f", valuesPath]);
  const errors = validateRenderedManifests(parseRenderedManifests(renderedYaml));

  if (errors.length > 0) {
    throw new Error(`Rendered Kubernetes contract failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }

  console.log("Rendered Kubernetes contract passed.");
}

function assertSinglePodRollbackStrategy(errors: string[], deployment: Manifest): void {
  const strategyType = readPath(deployment, ["spec", "strategy", "type"]);
  const maxSurge = readPath(deployment, ["spec", "strategy", "rollingUpdate", "maxSurge"]);
  const maxUnavailable = readPath(deployment, ["spec", "strategy", "rollingUpdate", "maxUnavailable"]);

  if (strategyType !== "RollingUpdate" || String(maxSurge) !== "0" || String(maxUnavailable) !== "1") {
    errors.push("expected Deployment strategy to be RollingUpdate with maxSurge 0 and maxUnavailable 1");
  }
}

function runHelm(args: string[]): string {
  try {
    return execFileSync("helm", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      throw new Error("helm is required to validate the chart locally. Install Helm and retry.");
    }
    if (isExecFileError(error)) {
      const stderr = formatCommandOutput(error.stderr);
      throw new Error(`helm ${args.join(" ")} failed${stderr ? `:\n${stderr}` : ""}`);
    }
    throw error;
  }
}

function assertSameOriginIngress(
  errors: string[],
  ingress: Manifest | undefined,
  service: Manifest | undefined,
): void {
  if (!ingress) {
    return;
  }

  const serviceName = readPath(service, ["metadata", "name"]);
  const rules = readPath(ingress, ["spec", "rules"]);
  if (typeof serviceName !== "string" || !Array.isArray(rules)) {
    errors.push("expected Ingress to route a / Prefix path to the rendered Service");
    return;
  }

  const hasSameOriginRootPath = rules.some((rule) => {
    const paths = readPath(rule, ["http", "paths"]);
    if (!Array.isArray(paths)) {
      return false;
    }

    return paths.some((path) => {
      const renderedPath = readPath(path, ["path"]);
      const pathType = readPath(path, ["pathType"]);
      const backendServiceName = readPath(path, ["backend", "service", "name"]);
      const backendServicePort = readPath(path, ["backend", "service", "port", "name"]);

      return (
        renderedPath === "/" &&
        pathType === "Prefix" &&
        backendServiceName === serviceName &&
        backendServicePort === "http"
      );
    });
  });

  if (!hasSameOriginRootPath) {
    errors.push("expected Ingress to route a / Prefix path to the rendered Service");
  }
}

function assertHttpProbe(
  errors: string[],
  container: Manifest,
  probeName: "livenessProbe" | "readinessProbe",
  expectedPath: string,
): void {
  const path = readPath(container, [probeName, "httpGet", "path"]);
  const port = readPath(container, [probeName, "httpGet", "port"]);

  if (path !== expectedPath) {
    errors.push(`expected ${probeName} path to be ${expectedPath}, found ${String(path)}`);
  }
  if (port !== "http") {
    errors.push(`expected ${probeName} port to be http, found ${String(port)}`);
  }
}

function assertResources(errors: string[], container: Manifest): void {
  for (const path of [
    ["resources", "requests", "cpu"],
    ["resources", "requests", "memory"],
    ["resources", "limits", "cpu"],
    ["resources", "limits", "memory"],
  ]) {
    const value = readPath(container, path);
    if (typeof value !== "string" || value.length === 0) {
      errors.push(`expected container ${path.join(".")} to be set`);
    }
  }
}

function readEnvNames(container: Manifest): Set<string> {
  const env = container.env;
  if (!Array.isArray(env)) {
    return new Set();
  }

  return new Set(
    env
      .map((entry) => (isRecord(entry) && typeof entry.name === "string" ? entry.name : undefined))
      .filter((name): name is string => Boolean(name)),
  );
}

function readPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function isRecord(value: unknown): value is Manifest {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isErrnoException(value: unknown): value is NodeJS.ErrnoException {
  return isRecord(value) && typeof value.code === "string";
}

function isExecFileError(value: unknown): value is Error & { stderr?: unknown } {
  return isRecord(value) && "stderr" in value;
}

function formatCommandOutput(output: unknown): string {
  if (typeof output === "string") {
    return output.trim();
  }
  if (Buffer.isBuffer(output)) {
    return output.toString("utf8").trim();
  }
  return "";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    runLocalKubernetesValidation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}
