# Project Plan

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
