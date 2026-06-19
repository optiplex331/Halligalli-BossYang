{{/*
Expand the name of the chart.
*/}}
{{- define "halligalli.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "halligalli.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "halligalli.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Labels shared by all rendered resources.
*/}}
{{- define "halligalli.labels" -}}
helm.sh/chart: {{ include "halligalli.chart" . }}
{{ include "halligalli.selectorLabels" . }}
app.kubernetes.io/version: {{ include "halligalli.releaseVersion" . | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Stable selector labels.
*/}}
{{- define "halligalli.selectorLabels" -}}
app.kubernetes.io/name: {{ include "halligalli.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
The deployable image. Digest wins over tag for immutable runtime selection.
*/}}
{{- define "halligalli.image" -}}
{{- $repository := required "image.repository is required" .Values.image.repository -}}
{{- $tag := required "image.tag is required and must not be latest" (.Values.image.tag | toString) -}}
{{- if eq (lower $tag) "latest" -}}
{{- fail "image.tag must not be latest; use a release tag and optionally image.digest" -}}
{{- end -}}
{{- if .Values.image.digest -}}
{{- if not (regexMatch "^sha256:[0-9a-f]{64}$" .Values.image.digest) -}}
{{- fail "image.digest must be empty or match sha256:<64 lowercase hex characters>" -}}
{{- end -}}
{{- printf "%s@%s" $repository .Values.image.digest -}}
{{- else -}}
{{- printf "%s:%s" $repository $tag -}}
{{- end -}}
{{- end -}}

{{/*
Human-readable release identity exposed by /health as APP_VERSION.
*/}}
{{- define "halligalli.releaseVersion" -}}
{{- required "releaseIdentity.version or image.tag is required" ((default .Values.image.tag .Values.releaseIdentity.version) | toString) -}}
{{- end -}}

{{/*
Commit identity exposed by /health as COMMIT_SHA.
*/}}
{{- define "halligalli.releaseCommit" -}}
{{- required "releaseIdentity.commit is required" (.Values.releaseIdentity.commit | toString) -}}
{{- end -}}

{{/*
Value checks that need clearer errors than JSON schema gives.
*/}}
{{- define "halligalli.validateValues" -}}
{{- if ne (int .Values.replicaCount) 1 -}}
{{- fail "replicaCount must remain 1 until Multiplayer Authority is externalized or socket.io routing is redesigned" -}}
{{- end -}}
{{- range $name, $_ := .Values.config.extraEnv -}}
{{- if eq $name "VITE_HALLIGALLI_BACKEND_URL" -}}
{{- fail "the standalone chart must not set VITE_HALLIGALLI_BACKEND_URL; socket.io is same-origin" -}}
{{- end -}}
{{- end -}}
{{- if and .Values.ingress.enabled (not .Values.ingress.hosts) -}}
{{- fail "ingress.hosts must contain at least one host when ingress.enabled is true" -}}
{{- end -}}
{{- end -}}
