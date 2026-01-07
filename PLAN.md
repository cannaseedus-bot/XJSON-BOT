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
## Context
XJSON-BOT provides a local-first AI chat environment that layers the K'UHUL engine, multi-hive orchestration, and SVG-based weight visualization. The current roadmap is in Phase 2.5 (Multi-Model Integration), which focuses on adding a Python backbone for multi-brain models and integrating new providers (DeepSeek R1, Janus/JanusFlow) while merging Cline-style tooling.

## Objectives (Phase 2.5)
1. Stand up the Python inference backbone for multi-model routing (FastAPI + model registry).
2. Integrate reasoning-capable and multimodal providers (DeepSeek R1, Janus, JanusFlow) with consistent APIs.
3. Extend the UI to surface reasoning traces and multimodal interactions (image upload/display).
4. Preserve offline-friendly delivery with service worker caching and compression paths.

## Near-Term Plan
- **Python Backbone (Critical)**
  - Implement a unified FastAPI service (`python/`) with base model interfaces and provider adapters.
  - Add model registry wiring for text, reasoning, and vision/image endpoints with capability tags.
  - Create health/readiness endpoints and streaming support to align with the chat frontend.

- **DeepSeek R1 Integration (Critical)**
  - Add an adapter that supports chain-of-thought outputs and exposes reasoning traces for UI consumption.
  - Wire configuration into existing settings/provider selection, including variants (R1, R1-Lite).

- **Janus / JanusFlow Multimodal (Critical)**
  - Provide text-to-image and image-understanding routes with image upload handling.
  - Ensure generation results can be displayed in chat history and cached for offline use.

- **UI Enhancements (High Priority)**
  - Add reasoning-trace panels to the chat interface and an image upload/display component.
  - Surface model capability metadata (text, reasoning, image) and performance indicators.

- **Quality & Tooling (High Priority)**
  - Add targeted tests for the Python adapters and streaming paths.
  - Document configuration examples in `docs/` and ensure service worker caching covers new assets.

## Milestones
- **Milestone A:** Python backbone skeleton running locally with placeholder adapters and health checks.
- **Milestone B:** DeepSeek R1 live in chat with reasoning trace display.
- **Milestone C:** Janus/JanusFlow endpoints delivering image gen/vision responses with UI support.
- **Milestone D:** Cline-style tooling merge (task management, slash commands, MCP hooks) once core providers are stable.
