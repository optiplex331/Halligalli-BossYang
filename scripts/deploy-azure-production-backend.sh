#!/usr/bin/env bash
set -euo pipefail

release_tag="${1:-${AZURE_PRODUCTION_RELEASE_TAG:-}}"
repository="${AZURE_PRODUCTION_GITHUB_REPOSITORY:-optiplex331/Halligalli-BossYang}"
resource_group="${AZURE_PRODUCTION_RESOURCE_GROUP_NAME:-halligalli-boss-practice-azure-production-rg}"
container_app="${AZURE_PRODUCTION_CONTAINER_APP_NAME:-halligalli-azprod-backend}"
frontend_url="${AZURE_PRODUCTION_FRONTEND_URL:-https://play.halligalli.games}"
backend_url="${AZURE_PRODUCTION_BACKEND_URL:-https://api.halligalli.games}"

if [[ -z "${release_tag}" ]]; then
  echo "Usage: scripts/deploy-azure-production-backend.sh vX.Y.Z" >&2
  exit 1
fi

if [[ ! "${release_tag}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Azure Production backend deployment requires a vX.Y.Z Release Tag." >&2
  exit 1
fi

for tool in az docker git curl python3; do
  if ! command -v "${tool}" >/dev/null 2>&1; then
    echo "Install ${tool} before deploying Azure Production backend." >&2
    exit 1
  fi
done

if [[ "${frontend_url}" != "https://play.halligalli.games" ]]; then
  echo "Allowed browser origin must be https://play.halligalli.games." >&2
  exit 1
fi

if [[ "${backend_url}" != "https://api.halligalli.games" ]]; then
  echo "Backend Entry must be https://api.halligalli.games." >&2
  exit 1
fi

if ! git rev-parse --verify --quiet "${release_tag}^{commit}" >/dev/null; then
  echo "Release Tag ${release_tag} is not available locally. Run: git fetch --tags" >&2
  exit 1
fi

if [[ -n "${AZURE_SUBSCRIPTION_ID:-}" ]]; then
  az account set --subscription "${AZURE_SUBSCRIPTION_ID}"
fi

version="${release_tag#v}"
commit_sha="$(git rev-list -n 1 "${release_tag}")"
image_name="ghcr.io/$(printf '%s' "${repository}" | tr '[:upper:]' '[:lower:]')"
image_tag="${image_name}:${version}"

repository_owner="$(
  printf '%s' "${repository%%/*}" | tr '[:upper:]' '[:lower:]'
)"
ghcr_username="${AZURE_PRODUCTION_GHCR_USERNAME:-${GHCR_USERNAME:-${repository_owner}}}"
ghcr_token="${AZURE_PRODUCTION_GHCR_TOKEN:-${GHCR_TOKEN:-${GITHUB_TOKEN:-}}}"

if [[ -z "${ghcr_token}" ]] && command -v gh >/dev/null 2>&1; then
  ghcr_token="$(gh auth token 2>/dev/null || true)"
fi

if [[ -z "${ghcr_token}" ]]; then
  echo "Set AZURE_PRODUCTION_GHCR_TOKEN, GHCR_TOKEN, or GITHUB_TOKEN with read:packages scope." >&2
  echo "Alternatively, authenticate the GitHub CLI with read:packages before deploying." >&2
  exit 1
fi

printf '%s' "${ghcr_token}" | docker login ghcr.io \
  --username "${ghcr_username}" \
  --password-stdin >/dev/null

image_digest="$(
  docker buildx imagetools inspect "${image_tag}" \
    --format '{{.Manifest.Digest}}'
)"

if [[ ! "${image_digest}" =~ ^sha256:[0-9a-f]{64}$ ]]; then
  echo "Could not resolve a valid GHCR image digest for ${image_tag}." >&2
  exit 1
fi

image_digest_ref="${image_name}@${image_digest}"
echo "Deploying ${image_digest_ref}"

az containerapp registry set \
  --name "${container_app}" \
  --resource-group "${resource_group}" \
  --server ghcr.io \
  --username "${ghcr_username}" \
  --password "${ghcr_token}"

az containerapp update \
  --name "${container_app}" \
  --resource-group "${resource_group}" \
  --image "${image_digest_ref}" \
  --min-replicas 1 \
  --max-replicas 1 \
  --set-env-vars \
    PORT=3001 \
    HALLIGALLI_ALLOWED_ORIGINS="${frontend_url}" \
    APP_VERSION="${version}" \
    COMMIT_SHA="${commit_sha}"

curl --max-time 20 --fail --silent --show-error "${backend_url}/readyz"
response="$(curl --max-time 20 --fail --silent --show-error "${backend_url}/health")"

export HEALTH_RESPONSE="${response}"
export EXPECTED_VERSION="${version}"
export EXPECTED_COMMIT="${commit_sha}"
export SUCCESS_MESSAGE="Azure Production /health matches deployed identity."
python3 .github/utils/check_health.py
