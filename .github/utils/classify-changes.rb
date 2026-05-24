#!/usr/bin/env ruby

require "open3"
require "set"

def git(*args)
  stdout, stderr, status = Open3.capture3("git", *args)
  abort(stderr.empty? ? "git #{args.join(" ")} failed" : stderr) unless status.success?
  stdout
end

def changed_files_from_git
  event_name = ENV.fetch("GITHUB_EVENT_NAME", "")
  base_sha = ENV.fetch("CHANGE_BASE_SHA", "")
  head_sha = ENV.fetch("CHANGE_HEAD_SHA", "HEAD")
  before_sha = ENV.fetch("CHANGE_BEFORE_SHA", "")

  if event_name == "pull_request" && !base_sha.empty?
    git("diff", "--name-only", "#{base_sha}...#{head_sha}").lines
  elsif event_name == "push" && !before_sha.empty? && before_sha !~ /\A0+\z/
    git("diff", "--name-only", before_sha, head_sha).lines
  else
    parent = git("rev-parse", "--verify", "#{head_sha}^").strip
    git("diff", "--name-only", parent, head_sha).lines
  end
rescue StandardError
  []
end

files = if ARGV.empty?
  changed_files_from_git
else
  ARGV
end.map(&:strip).reject(&:empty?).uniq.sort

release_metadata_paths = Set[
  ".github/utils/.release-please-manifest.json",
  ".github/utils/release-please-config.json",
  "CHANGELOG.md",
]

production_manifest_paths = Set[
  "deploy/production/app.yaml",
]

product_patterns = [
  %r{\A\.github/workflows/},
  %r{\A\.github/utils/(Taskfile\.yaml|classify-changes\.rb)\z},
  %r{\A\.dockerignore\z},
  %r{\ADockerfile\z},
  %r{\Aindex\.html\z},
  %r{\Apackage\.json\z},
  %r{\Apnpm-lock\.yaml\z},
  %r{\Apnpm-workspace\.yaml\z},
  %r{\Apublic/},
  %r{\Ascripts/},
  %r{\Aserver/},
  %r{\Asrc/},
  %r{\Atsconfig(?:\.server)?\.json\z},
  %r{\Avite\.config\.ts\z},
]

container_patterns = product_patterns

tag_release = ENV.fetch("GITHUB_REF_TYPE", "") == "tag" &&
  ENV.fetch("GITHUB_REF_NAME", "").match?(/\Av[0-9]+\.[0-9]+\.[0-9]+\z/)

manual_dispatch = ENV.fetch("GITHUB_EVENT_NAME", "") == "workflow_dispatch"

product_required = manual_dispatch || files.any? { |file| product_patterns.any? { |pattern| file.match?(pattern) } }
container_required = tag_release || manual_dispatch || files.any? { |file| container_patterns.any? { |pattern| file.match?(pattern) } }
release_metadata_changed = files.any? { |file| release_metadata_paths.include?(file) }
production_manifest_changed = files.any? { |file| production_manifest_paths.include?(file) }

classification = if tag_release
  "release-tag"
elsif product_required
  "product-runtime"
elsif production_manifest_changed && !release_metadata_changed
  "production-manifest"
elsif release_metadata_changed && !production_manifest_changed
  "release-metadata"
elsif production_manifest_changed && release_metadata_changed
  "release-and-production-metadata"
else
  "metadata-or-docs"
end

outputs = {
  "classification" => classification,
  "product_checks_required" => product_required.to_s,
  "container_build_required" => container_required.to_s,
  "release_metadata_changed" => release_metadata_changed.to_s,
  "production_manifest_changed" => production_manifest_changed.to_s,
}

puts "Changed files:"
if files.empty?
  puts "- none detected"
else
  files.each { |file| puts "- #{file}" }
end
outputs.each { |key, value| puts "#{key}=#{value}" }

if (github_output = ENV["GITHUB_OUTPUT"])
  File.open(github_output, "a") do |file|
    outputs.each { |key, value| file.puts("#{key}=#{value}") }
  end
end
