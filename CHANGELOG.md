# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-07-17

### Added

- CLI commands: `init`, `create`, `recall`, `save`, `list`, `handoff`, `teardown`, `push`, `pull`
- Knowledge wiki with `knowledge search`, `knowledge list`, `knowledge get`, `knowledge create`, `knowledge delete`
- FTS5-powered full-text search across knowledge entities
- 5 built-in skills: code-review, ci-monitor, pr-management, session-management, multi-agent
- 5 scenario templates: web-api, frontend-app, infra-pipeline, research-paper, multi-agent
- GitHub sync via push/pull with transient authentication (tokens never persisted)
- Handoff PR creation for transferring scenarios to teammates
- JSON Schema (Draft 2020-12) validation for all manifests
- Interactive scenario creation with inquirer prompts
- Skill promotion pipeline: personal -> team -> root
- Scenario lifecycle state machine: active -> paused | handed-off | archived
- Cross-machine context transfer via GitHub repos
