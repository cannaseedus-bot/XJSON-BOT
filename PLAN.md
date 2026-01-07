# Project Plan

## Purpose

Concrete, prioritized to-do list for stabilizing and extending XJSON-BOT. Each item is actionable and scoped so work can be tracked in short iterations.

## Near-Term Focus (1–2 weeks)

1. **Document baseline architecture**
   - Capture current UI ↔ core ↔ backend data flows.
   - Map K'UHUL runtime entry points and XJSON schema coverage.
2. **Harden local-first chat experience**
   - Verify service worker cache coverage for UI assets.
   - Add offline/online state indicator and retry cues in UI.
3. **Model management polish**
   - Validate model add/remove flows against local Ollama and remote APIs.
   - Add client-side validation for endpoint URLs and auth tokens.
4. **Telemetry and logging**
   - Standardize client logs (levels/format).
   - Add opt-in analytics hooks with clear privacy copy.
5. **Stability pass on Python backend**
   - Confirm FastAPI entry points, response schemas, and error handling.
   - Add health/readiness endpoints and minimal integration tests.

## Mid-Term Focus (3–6 weeks)

1. **Multi-model routing**
   - Implement capability tags (text, vision, reasoning) and routing rules.
   - Add ensemble/fallback logic with metrics for selection decisions.
2. **SVG weight tooling**
   - Create CLI to convert weights ⇄ SVG and validate SCXQ2 compression.
   - Add gallery view in UI for weight visualizations.
3. **Cline feature merge**
   - Port task management UI and command execution harness.
   - Introduce MCP adapters and file/browse tool shims.
4. **Deployment + packaging**
   - Produce reproducible builds (asset hashing, bundling, minification).
   - Author Dockerfiles for UI-only and full-stack modes.

## Stretch Goals (6+ weeks)

1. **Training workflows**
   - Wire Colab orchestrations for dataset upload, job launch, and status.
   - Expose progress/metrics UI with resumable checkpoints.
2. **Security and governance**
   - Define CSP and hardened CORS defaults.
   - Add role-based access controls for admin/model operations.
3. **Extensibility**
   - Plugin system for custom agents/tools with schema validation.
   - Template library for common chat/task flows.

## Tracking and Delivery

- Maintain short, labeled issues for each bullet above.
- Gate merges with lightweight automated checks (lint + targeted tests).
- Ship increments behind feature flags where appropriate.
