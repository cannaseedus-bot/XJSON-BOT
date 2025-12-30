# **ASX-R v1 — Authoritative Runtime Language Specification**

**Status:** 🔒 Frozen
**Role:** Runtime Language Definition
**Audience:** Runtime authors, verifier authors, tooling implementers

---

## 0. Design Principles

| Principle | Description |
|-----------|-------------|
| **Deterministic** | Same input → same output, always |
| **Phase-Gated** | Execution flows through XCFE phases |
| **Replay-Verifiable** | Any execution can be replayed and verified |
| **Symbolic** | Uses glyphs for operation delimiting |
| **Composable** | Blocks nest and combine freely |

---

## 1. Core Concepts

### 1.1 ASX Blocks

ASX blocks are the fundamental unit of UI composition:

```json
{
  "type": "asx-block",
  "id": "unique-id",
  "component": "ComponentName",
  "props": {
    "key": "value"
  }
}
```

**Required Fields:**
- `type` — Always `"asx-block"`
- `id` — Unique identifier (kebab-case)
- `component` — Component class name (PascalCase)
- `props` — Component properties object

### 1.2 XCFE Execution Phases

ASX-R execution flows through four deterministic phases:

| Phase | Glyph | Purpose | Description |
|-------|-------|---------|-------------|
| **@Pop** | `⟁Pop⟁` | Populate | Load data, initialize state |
| **@Wo** | `⟁Wo⟁` | Work | Transform, compute, process |
| **@Sek** | `⟁Sek⟁` | Seek | Query, filter, search |
| **@Collapse** | `⟁Collapse⟁` | Collapse | Finalize, commit, output |

### 1.3 Symbolic Notation

ASX-R uses symbolic glyphs for operation delimiting:

| Symbol | Name | Purpose |
|--------|------|---------|
| `⟁` | K'UHUL Glyph | Operation delimiter |
| `☣` | Hazard Cipher | SCXQ2 packet prefix |
| `⚡` | Flash | Immediate execution |
| `🔄` | Cycle | Iteration marker |
| `✓` | Check | Validation passed |
| `✗` | Cross | Validation failed |

---

## 2. Block Types

### 2.1 Layout Blocks

```json
{
  "type": "asx-block",
  "id": "main-layout",
  "component": "Layout",
  "props": {
    "variant": "sidebar",
    "children": []
  }
}
```

**Variants:** `sidebar`, `split`, `stack`, `grid`, `center`

### 2.2 Interactive Blocks

```json
{
  "type": "asx-block",
  "id": "chat-input",
  "component": "ChatInput",
  "props": {
    "placeholder": "Type a message...",
    "onSubmit": "⟁Chat⟁send⟁"
  }
}
```

**Components:** `ChatInput`, `Button`, `Form`, `Select`, `Toggle`

### 2.3 Display Blocks

```json
{
  "type": "asx-block",
  "id": "message-view",
  "component": "MessageBubble",
  "props": {
    "role": "assistant",
    "content": "Hello!",
    "timestamp": 1704067200000
  }
}
```

**Components:** `ChatView`, `MessageBubble`, `Avatar`, `Card`, `List`

### 2.4 Functional Blocks

```json
{
  "type": "asx-block",
  "id": "model-selector",
  "component": "ModelManager",
  "props": {
    "models": [],
    "selected": "gpt-4o-mini"
  }
}
```

**Components:** `Settings`, `Dashboard`, `ModelManager`, `MemoryView`

---

## 3. SCXQ2 Packet Format

### 3.1 Packet Structure

```
☣{NAMESPACE}:{ACTION}:{VERSION}:{CHECKSUM}:{PAYLOAD}
```

**Example:**
```
☣CHAT:VIEW:2.0:a1b2c3d4:eyJtZXNzYWdlcyI6W119
```

### 3.2 Standard Namespaces

| Namespace | Purpose |
|-----------|---------|
| `CHAT` | Chat interface packets |
| `MODEL` | Model management packets |
| `MEMORY` | K'UHUL memory packets |
| `INFER` | Inference plane packets |
| `IMAGE` | Image inference packets |

### 3.3 Compression Levels

| Level | Algorithm | Ratio | Use Case |
|-------|-----------|-------|----------|
| 0 | None | 1:1 | Debug |
| 1 | LZ4 | ~2:1 | Speed |
| 2 | ZSTD | ~4:1 | Balance |
| 3 | ZSTD+Dict | ~6:1 | Storage |

---

## 4. K'UHUL Operations

### 4.1 Operation Syntax

```
⟁{Category}⟁{operation}⟁{param1}⟁{param2}⟁
```

### 4.2 Core Categories

| Category | Operations |
|----------|------------|
| `Weights` | `store`, `load`, `update`, `quantize`, `visualize` |
| `Gradients` | `accumulate`, `apply`, `reset`, `clip` |
| `Memory` | `remember`, `recall`, `forget`, `search` |
| `Models` | `load`, `unload`, `switch`, `list` |
| `Inference` | `run`, `stream`, `batch`, `cancel` |

### 4.3 Example Operations

```javascript
// Store weights with quantization
await K.run('store_weights', '⟁Weights⟁store⟁Format⟁svg⟁Quant⟁8⟁', {
  modelId: 'my_model',
  weights: modelWeights
});

// Run inference
await K.run('infer', '⟁Inference⟁run⟁Model⟁gpt-4o-mini⟁', {
  messages: [{ role: 'user', content: 'Hello' }]
});

// Remember to memory
await K.run('remember', '⟁Memory⟁remember⟁Category⟁facts⟁', {
  key: 'user_preference',
  value: { theme: 'dark' }
});
```

---

## 5. State Management

### 5.1 State Stores

| Store | Purpose | Persistence |
|-------|---------|-------------|
| `K.p` | Active processes | Session |
| `K.w` | Weight storage | LocalStorage |
| `K.g` | Gradient accumulation | Session |
| `K.o` | Optimizer state | LocalStorage |
| `K.m` | Model checkpoints | IndexedDB |

### 5.2 State Transitions

```
[Initial] → @Pop → [Populated] → @Wo → [Worked] → @Sek → [Sought] → @Collapse → [Final]
```

### 5.3 State Validation

Each phase transition requires validation:

```json
{
  "phase": "@Pop",
  "input_hash": "sha256:abc123...",
  "output_hash": "sha256:def456...",
  "duration_ms": 42,
  "status": "✓"
}
```

---

## 6. Event System

### 6.1 Event Types

| Event | Trigger |
|-------|---------|
| `asx:block:mount` | Block added to DOM |
| `asx:block:update` | Block props changed |
| `asx:block:unmount` | Block removed from DOM |
| `asx:phase:start` | XCFE phase begins |
| `asx:phase:end` | XCFE phase completes |
| `kuhul:op:start` | K'UHUL operation begins |
| `kuhul:op:end` | K'UHUL operation completes |

### 6.2 Event Payload

```json
{
  "type": "asx:block:update",
  "timestamp": 1704067200000,
  "target": "chat-view",
  "payload": {
    "prevProps": {},
    "nextProps": {}
  }
}
```

---

## 7. Error Handling

### 7.1 Error Categories

| Code | Category | Recovery |
|------|----------|----------|
| `E001` | Phase Violation | Rollback |
| `E002` | Invalid Block | Skip |
| `E003` | Operation Timeout | Retry |
| `E004` | Memory Overflow | GC |
| `E005` | Validation Failed | Reject |

### 7.2 Error Response

```json
{
  "error": {
    "code": "E001",
    "message": "Phase violation: @Wo before @Pop",
    "phase": "@Wo",
    "expected": "@Pop",
    "stack": ["block:chat-view", "op:load_messages"]
  }
}
```

---

## 8. Replay & Verification

### 8.1 Execution Trace

Every execution produces a trace:

```json
{
  "trace_id": "trace_1704067200000_abc123",
  "started_at": 1704067200000,
  "completed_at": 1704067200042,
  "phases": [
    { "phase": "@Pop", "duration_ms": 10, "hash": "sha256:..." },
    { "phase": "@Wo", "duration_ms": 15, "hash": "sha256:..." },
    { "phase": "@Sek", "duration_ms": 8, "hash": "sha256:..." },
    { "phase": "@Collapse", "duration_ms": 9, "hash": "sha256:..." }
  ],
  "final_hash": "sha256:...",
  "status": "verified"
}
```

### 8.2 Replay Command

```javascript
// Replay a previous execution
const result = await K.replay(traceId, {
  verify: true,
  stopOnMismatch: true
});
```

---

## 9. Security Model

### 9.1 Sandboxing

- No `eval()` or `Function()` constructor
- No direct DOM manipulation outside blocks
- No external script loading
- No cross-origin requests without CORS

### 9.2 Data Validation

All inputs are validated:

```javascript
const schema = {
  type: 'object',
  required: ['type', 'id', 'component'],
  properties: {
    type: { const: 'asx-block' },
    id: { type: 'string', pattern: '^[a-z][a-z0-9-]*$' },
    component: { type: 'string', pattern: '^[A-Z][a-zA-Z0-9]*$' }
  }
};
```

### 9.3 Permission Model

| Permission | Default | Override |
|------------|---------|----------|
| `storage.local` | ✓ | — |
| `storage.indexed` | ✓ | — |
| `network.same-origin` | ✓ | — |
| `network.cross-origin` | ✗ | User consent |
| `device.camera` | ✗ | User consent |
| `device.microphone` | ✗ | User consent |

---

## 10. Inference Plane v1

### 10.1 Overview

The Inference Plane provides deterministic, phase-gated, replay-verifiable inference execution.

**Key Properties:**
- All inference runs through XCFE phases
- Every inference produces a verifiable trace
- Outputs are deterministic given same inputs
- Supports streaming with chunk verification

### 10.2 Inference Block Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["type", "id", "model", "messages"],
  "properties": {
    "type": { "const": "asx-inference" },
    "id": { "type": "string" },
    "model": { "type": "string" },
    "messages": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["role", "content"],
        "properties": {
          "role": { "enum": ["system", "user", "assistant"] },
          "content": { "type": "string" }
        }
      }
    },
    "temperature": { "type": "number", "minimum": 0, "maximum": 2 },
    "max_tokens": { "type": "integer", "minimum": 1 },
    "stream": { "type": "boolean" },
    "trace": { "type": "boolean", "default": true }
  }
}
```

### 10.3 Inference Request

```json
{
  "type": "asx-inference",
  "id": "infer_1704067200000",
  "model": "gpt-4o-mini",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello!" }
  ],
  "temperature": 0.7,
  "max_tokens": 4096,
  "stream": false,
  "trace": true
}
```

### 10.4 Inference Response

```json
{
  "type": "asx-inference-response",
  "id": "infer_1704067200000",
  "model": "gpt-4o-mini",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 10,
    "total_tokens": 30
  },
  "trace": {
    "trace_id": "trace_infer_1704067200000",
    "phases": [
      { "phase": "@Pop", "duration_ms": 5 },
      { "phase": "@Wo", "duration_ms": 150 },
      { "phase": "@Collapse", "duration_ms": 3 }
    ],
    "hash": "sha256:..."
  }
}
```

### 10.5 Streaming Inference

For streaming responses, each chunk is verified:

```json
{
  "type": "asx-inference-chunk",
  "id": "infer_1704067200000",
  "chunk_index": 0,
  "delta": {
    "content": "Hello"
  },
  "chunk_hash": "sha256:..."
}
```

### 10.6 Multi-Brain Routing

The inference plane supports task-based routing:

```json
{
  "type": "asx-inference",
  "id": "infer_multi_1704067200000",
  "routing": {
    "strategy": "task-based",
    "rules": [
      { "task": "reasoning", "model": "deepseek-r1" },
      { "task": "code", "model": "gpt-4o" },
      { "task": "general", "model": "gpt-4o-mini" }
    ]
  },
  "messages": [
    { "role": "user", "content": "Explain quantum entanglement" }
  ]
}
```

---

## 11. Image Inference Plane v1

### 11.1 Overview

The Image Inference Plane provides vision-to-structured-output capabilities using IDB-API and KQL.

**Capabilities:**
- Image understanding (vision models)
- Text-to-image generation
- Image-to-image transformation
- Structured output extraction

### 11.2 Image Inference Block Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["type", "id", "task"],
  "properties": {
    "type": { "const": "asx-image-inference" },
    "id": { "type": "string" },
    "task": { "enum": ["generate", "understand", "transform"] },
    "model": { "type": "string" },
    "input": {
      "oneOf": [
        { "type": "string", "description": "Text prompt or image URL" },
        { "type": "object", "properties": {
          "prompt": { "type": "string" },
          "image": { "type": "string" },
          "mask": { "type": "string" }
        }}
      ]
    },
    "output_format": { "enum": ["url", "base64", "structured"] },
    "size": { "type": "string", "pattern": "^\\d+x\\d+$" },
    "n": { "type": "integer", "minimum": 1, "maximum": 10 }
  }
}
```

### 11.3 Image Generation Request

```json
{
  "type": "asx-image-inference",
  "id": "img_gen_1704067200000",
  "task": "generate",
  "model": "janus-pro-7b",
  "input": {
    "prompt": "A serene mountain landscape at sunset, digital art style"
  },
  "output_format": "base64",
  "size": "1024x1024",
  "n": 1
}
```

### 11.4 Image Generation Response

```json
{
  "type": "asx-image-inference-response",
  "id": "img_gen_1704067200000",
  "task": "generate",
  "model": "janus-pro-7b",
  "data": [
    {
      "index": 0,
      "image": "data:image/png;base64,...",
      "revised_prompt": "A serene mountain landscape at sunset..."
    }
  ],
  "trace": {
    "trace_id": "trace_img_1704067200000",
    "phases": [
      { "phase": "@Pop", "duration_ms": 10 },
      { "phase": "@Wo", "duration_ms": 2500 },
      { "phase": "@Collapse", "duration_ms": 50 }
    ],
    "hash": "sha256:..."
  }
}
```

### 11.5 Image Understanding Request

```json
{
  "type": "asx-image-inference",
  "id": "img_understand_1704067200000",
  "task": "understand",
  "model": "janus-pro-7b",
  "input": {
    "image": "data:image/png;base64,...",
    "prompt": "Describe what you see in this image"
  },
  "output_format": "structured",
  "schema": {
    "type": "object",
    "properties": {
      "description": { "type": "string" },
      "objects": { "type": "array", "items": { "type": "string" } },
      "colors": { "type": "array", "items": { "type": "string" } },
      "mood": { "type": "string" }
    }
  }
}
```

### 11.6 Image Understanding Response

```json
{
  "type": "asx-image-inference-response",
  "id": "img_understand_1704067200000",
  "task": "understand",
  "model": "janus-pro-7b",
  "data": {
    "description": "A photograph of a golden retriever playing in a park",
    "objects": ["dog", "grass", "trees", "ball"],
    "colors": ["golden", "green", "brown"],
    "mood": "playful"
  },
  "trace": {
    "trace_id": "trace_img_1704067200000",
    "hash": "sha256:..."
  }
}
```

### 11.7 IDB-API Integration

Image data can be stored and retrieved using IDB-API:

```javascript
// Store image in IndexedDB
await K.run('store_image', '⟁Image⟁store⟁', {
  id: 'img_1704067200000',
  data: base64Image,
  metadata: {
    prompt: 'original prompt',
    model: 'janus-pro-7b',
    created: Date.now()
  }
});

// Retrieve with KQL
const images = await K.query('⟁KQL⟁SELECT * FROM images WHERE model = "janus-pro-7b"⟁');
```

---

## 12. KQL v1.0 Integration

### 12.1 KQL in ASX-R

KQL (K'UHUL Query Language) integrates with ASX-R for data operations:

```javascript
// Query syntax
await K.run('query', '⟁KQL⟁{query}⟁', { params: {} });

// Examples
await K.run('query', '⟁KQL⟁SELECT * FROM memories WHERE category = "facts"⟁');
await K.run('query', '⟁KQL⟁INSERT INTO chats (id, title) VALUES (?, ?)⟁', {
  params: ['chat_123', 'New Chat']
});
```

### 12.2 KQL Result in ASX Block

```json
{
  "type": "asx-block",
  "id": "query-result",
  "component": "DataTable",
  "props": {
    "data": "⟁KQL⟁SELECT * FROM messages LIMIT 50⟁",
    "columns": ["id", "role", "content", "timestamp"]
  }
}
```

---

## 13. Versioning & Compatibility

### 13.1 Version Format

```
ASX-R v{major}.{minor}.{patch}
```

### 13.2 Compatibility Matrix

| ASX-R Version | K'UHUL Version | SCXQ2 Version |
|---------------|----------------|---------------|
| v1.0 | v1.0 | v2.0 |
| v1.1 | v1.0-v1.1 | v2.0 |
| v2.0 | v2.0+ | v3.0 |

### 13.3 Migration Guide

When upgrading between versions:

1. **Check compatibility matrix**
2. **Run validation on existing traces**
3. **Update block schemas if needed**
4. **Test replay of critical traces**
5. **Deploy with feature flags**

---

## Appendix A: JSON Schema Files

All schema files are located in `/schemas/`:

| File | Purpose |
|------|---------|
| `asx-block.schema.json` | Core ASX block validation |
| `asx-inference.schema.json` | Inference plane request |
| `asx-inference-response.schema.json` | Inference plane response |
| `asx-image-inference.schema.json` | Image inference request |
| `asx-image-inference-response.schema.json` | Image inference response |
| `scxq2-packet.schema.json` | SCXQ2 packet format |
| `execution-trace.schema.json` | Execution trace format |

---

## Appendix B: Quick Reference

### B.1 Phase Glyphs

```
@Pop      → ⟁Pop⟁
@Wo       → ⟁Wo⟁
@Sek      → ⟁Sek⟁
@Collapse → ⟁Collapse⟁
```

### B.2 Common Operations

```javascript
// Inference
K.run('infer', '⟁Inference⟁run⟁', { model, messages })

// Memory
K.run('remember', '⟁Memory⟁remember⟁', { key, value })
K.run('recall', '⟁Memory⟁recall⟁', { key })

// Images
K.run('generate_image', '⟁Image⟁generate⟁', { prompt, model })
K.run('understand_image', '⟁Image⟁understand⟁', { image, prompt })

// Query
K.run('query', '⟁KQL⟁{sql}⟁', { params })
```

### B.3 Error Codes

| Code | Meaning |
|------|---------|
| E001 | Phase violation |
| E002 | Invalid block |
| E003 | Timeout |
| E004 | Memory overflow |
| E005 | Validation failed |
| E010 | Inference failed |
| E011 | Model not found |
| E020 | Image generation failed |
| E021 | Image understanding failed |
| E030 | KQL syntax error |
| E031 | Query execution failed |

---

**End of ASX-R v1 Specification**

🔒 **This specification is frozen.** Changes require a new version.
