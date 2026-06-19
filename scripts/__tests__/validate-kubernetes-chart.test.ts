import { describe, expect, it } from "vitest";

import { parseRenderedManifests, validateRenderedManifests } from "../validate-kubernetes-chart.js";

const validRenderedManifests = [
  {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: "halligalli",
    },
    spec: {
      replicas: 1,
      template: {
        spec: {
          containers: [
            {
              name: "halligalli",
              image:
                "ghcr.io/optiplex331/halligalli-bossyang@sha256:0000000000000000000000000000000000000000000000000000000000000000",
              env: [
                { name: "PORT", value: "3001" },
                { name: "APP_VERSION", value: "0.4.0" },
                {
                  name: "COMMIT_SHA",
                  value: "0000000000000000000000000000000000000000",
                },
              ],
              livenessProbe: {
                httpGet: {
                  path: "/health",
                  port: "http",
                },
              },
              readinessProbe: {
                httpGet: {
                  path: "/readyz",
                  port: "http",
                },
              },
              resources: {
                requests: {
                  cpu: "50m",
                  memory: "128Mi",
                },
                limits: {
                  cpu: "250m",
                  memory: "256Mi",
                },
              },
            },
          ],
        },
      },
    },
  },
  {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: "halligalli",
    },
    spec: {
      ports: [
        {
          name: "http",
          port: 80,
          targetPort: "http",
        },
      ],
    },
  },
  {
    apiVersion: "networking.k8s.io/v1",
    kind: "Ingress",
    metadata: {
      name: "halligalli",
    },
    spec: {
      ingressClassName: "nginx",
      tls: [
        {
          secretName: "halligalli-tls-placeholder",
          hosts: ["play.example.test"],
        },
      ],
      rules: [
        {
          host: "play.example.test",
          http: {
            paths: [
              {
                path: "/",
                pathType: "Prefix",
                backend: {
                  service: {
                    name: "halligalli",
                    port: {
                      name: "http",
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  },
];

describe("validateRenderedManifests", () => {
  it("accepts the standalone same-origin Kubernetes contract", () => {
    expect(validateRenderedManifests(validRenderedManifests)).toEqual([]);
  });

  it("requires rendered Ingress traffic to enter through one same-origin root path", () => {
    const manifests = structuredClone(validRenderedManifests) as Array<Record<string, any>>;
    const ingress = manifests[2]!;
    ingress.spec.rules[0].http.paths[0].path = "/api";

    expect(validateRenderedManifests(manifests)).toContain(
      "expected Ingress to route a / Prefix path to the rendered Service",
    );
  });
});

describe("parseRenderedManifests", () => {
  it("parses Helm multi-document YAML and ignores empty documents", () => {
    expect(
      parseRenderedManifests(`
---
apiVersion: v1
kind: Service
metadata:
  name: halligalli
---
# Source: halligalli/templates/empty.yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: halligalli
`),
    ).toEqual([
      {
        apiVersion: "v1",
        kind: "Service",
        metadata: {
          name: "halligalli",
        },
      },
      {
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: {
          name: "halligalli",
        },
      },
    ]);
  });
});
