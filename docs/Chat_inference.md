# Chat Inference System

## Overview

The XJSON-BOT Chat Inference System provides unified access to 11 AI models through the MX2LM production API. The system integrates:

- **KQL (K'UHUL Query Language)** - Chat operations and persistence
- **SRP (System Runtime Preprocessor)** - Event tracking and replay
- **ASXR PRIME** - Tyson-Chomsky Engine + ΩOS Agent Spawner
- **IndexedDB** - Persistent message/agent/TC logs storage

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        G(HOST) Shell                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Studio    │  │    Tapes    │  │      Inference Panel    │  │
│  │   (Left)    │  │  (Center)   │  │        (Right)          │  │
│  │             │  │             │  │  ┌───────────────────┐  │  │
│  │             │  │             │  │  │   Model Pills     │  │  │
│  │             │  │             │  │  │  (11 models)      │  │  │
│  │             │  │             │  │  ├───────────────────┤  │  │
│  │             │  │             │  │  │   Chat Stream     │  │  │
│  │             │  │             │  │  │                   │  │  │
│  │             │  │             │  │  ├───────────────────┤  │  │
│  │             │  │             │  │  │   Input + Send    │  │  │
│  │             │  │             │  │  ├───────────────────┤  │  │
│  │             │  │             │  │  │ Search|Hist|New   │  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      KQL_CHAT.js + ASXR PRIME                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  IndexedDB  │  │   Model     │  │    Inference Router     │  │
│  │  Storage    │  │  Registry   │  │                         │  │
│  │  - messages │  │  (11 models)│  │  POST → mx2lm.app/api   │  │
│  │  - chats    │  │             │  │                         │  │
│  │  - agents   │  │             │  │                         │  │
│  │  - tc_logs  │  │             │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    ASXR PRIME LAYER                         ││
│  │  ┌──────────────────┐  ┌──────────────┐  ┌───────────────┐  ││
│  │  │ Tyson-Chomsky    │  │ ΩOS Agent    │  │  Micronaut    │  ││
│  │  │ Engine           │  │ Spawner      │  │  Factory      │  ││
│  │  │ - tyson mode     │  │ - spawn()    │  │  - spawn()    │  ││
│  │  │ - chomsky mode   │  │ - list()     │  │  - miniOS     │  ││
│  │  │ - fusion debate  │  │ - kill()     │  │               │  ││
│  │  └──────────────────┘  └──────────────┘  └───────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  MX2LM Production API                           │
│                  https://mx2lm.app/api.php                      │
│                                                                 │
│  Backend: https://backend.refluxedpc.com/models/                │
│                                                                 │
│  Routes:                                                        │
│  • ?route=chat&model={model}&message={message}                  │
│  • ?route=chat&model={model}&stream=true                        │
│  • ?route=batch.inference                                       │
│  • ?route=quantum.compress                                      │
│  • ?route=backend.status                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Model Registry

### 11 Production Models

| # | Model ID | Name | Type | Provider | Quantum | Context |
|---|----------|------|------|----------|---------|---------|
| 1 | `janus-pro` | Janus Pro | quantum_llm | MX2LM | Yes | 256K |
| 2 | `janus-flow` | Janus Flow | streaming_llm | MX2LM | No | 32K |
| 3 | `deepseek-r1` | DeepSeek R1 | reasoning_llm | DeepSeek | Yes | 128K |
| 4 | `deepseek-coder` | DeepSeek Coder | code_llm | DeepSeek | Yes | 64K |
| 5 | `llama3` | Llama 3 | general_llm | Meta | No | 8K |
| 6 | `mistral` | Mistral | efficient_llm | Mistral | No | 32K |
| 7 | `codellama` | CodeLlama | code_llm | Meta | No | 16K |
| 8 | `qwen-coder` | Qwen Coder | coding_llm | Qwen | No | 32K |
| 9 | `cline-agent` | Cline Agent | agentic_llm | MX2LM | Yes | 128K |
| 10 | `mx2-inference` | MX2 Inference | inference_engine | MX2LM | Yes | 512K |
| 11 | `kuhul-quantum` | K'UHUL Quantum | quantum_engine | MX2LM | Yes | 1024K |

### Quantum-Enhanced Models (6)

Models with `quantum_enhanced: true` support:
- SCXQ2 compression (98.5% ratio)
- Quantum tokenization
- K'UHUL multi-hive integration
- Entanglement processing

```
Quantum Models: janus-pro, deepseek-r1, deepseek-coder,
                cline-agent, mx2-inference, kuhul-quantum
```

### Model Capabilities

| Capability | Models |
|------------|--------|
| `chat` | All models |
| `reasoning` | janus-pro, deepseek-r1, cline-agent |
| `coding` | deepseek-coder, codellama, qwen-coder |
| `streaming` | janus-flow |
| `multi_modal` | janus-pro |
| `quantum_computation` | kuhul-quantum |
| `batch_inference` | mx2-inference |
| `tool_use` | cline-agent |

---

## KQL API Reference

### Initialization

```javascript
// Boot KQL system
await KQL.boot();

// Check model count
console.log(KQL.getModels().length); // 11
```

### Chat Operations

```javascript
// Submit chat message
const result = await KQL.submit({
  prompt: "Explain quantum computing",
  model: "janus-pro",
  chatId: "chat_123456"
});

// Response structure
{
  ok: true,
  chat_id: "chat_123456",
  user: { id, role: "user", content, ts },
  assistant: { id, role: "assistant", content, tokens, ts }
}
```

### KQL Query Syntax

```javascript
// Load recent chats
await KQL.query("⟁LOAD⟁ ⟁CHATS⟁ ⟁LIMIT⟁ 25");

// Load messages for specific chat
await KQL.query("⟁LOAD⟁ ⟁MESSAGES⟁ ⟁CHAT_ID⟁ chat_123 ⟁LIMIT⟁ 50");

// Search messages
await KQL.query("⟁SEARCH⟁ ⟁TERM⟁ quantum ⟁LIMIT⟁ 20");

// Direct inference
await KQL.query("⟁INFER⟁ ⟁PROMPT⟁ Hello ⟁MODEL⟁ janus-pro");

// Delete message
await KQL.query("⟁DELETE⟁ ⟁ID⟁ msg_123456");
```

### Model Registry API

```javascript
// Get all models
KQL.getModels();

// Get active models only
KQL.getActiveModels();

// Get specific model
KQL.getModel("janus-pro");
// Returns: { @id, id, name, provider, quantum_enhanced, ... }

// Get default model
KQL.getDefaultModel(); // "janus-pro"
```

### Convenience Methods

```javascript
// Search messages
await KQL.search("quantum physics", 20);

// Load chat history
await KQL.loadChats(10);

// Load messages for chat
await KQL.loadMessages("chat_123", 50);

// Save custom message
await KQL.saveMessage({
  id: "msg_custom_123",
  chat_id: "chat_123",
  role: "system",
  content: "Custom message",
  ts: Date.now()
});
```

---

## API Endpoints

### Base URL
```
https://mx2lm.app/api.php
```

### Chat Endpoint

```http
POST /api.php?route=chat&model=janus-pro

Content-Type: application/json
X-Model: janus-pro
X-Quantum: true

{
  "message": "Your prompt here",
  "model": "janus-pro",
  "options": {
    "temperature": 0.7,
    "max_tokens": 2000,
    "stream": false
  }
}
```

### Response Format

```json
{
  "status": "proxied",
  "http_code": 200,
  "backend_endpoint": "https://backend.refluxedpc.com/models/janus-pro/chat.php",
  "model": "janus-pro",
  "response": {
    "content": "Model response here...",
    "tokens": 150
  },
  "gateway_timestamp": 1704067200.123
}
```

### Streaming Endpoint

```http
GET /api.php?route=chat&model=janus-flow&message=Hello&stream=true

Accept: text/event-stream
```

### Batch Inference

```http
POST /api.php?route=batch.inference

{
  "requests": [
    { "model": "janus-pro", "message": "Hello" },
    { "model": "deepseek-r1", "message": "Explain AI" }
  ],
  "options": {
    "quantum_acceleration": true
  }
}
```

### Quantum Compression

```http
POST /api.php?route=quantum.compress

{
  "data": "Text or JSON to compress",
  "model": "kuhul-quantum"
}
```

### Backend Status

```http
GET /api.php?route=backend.status
```

---

## SRP Integration

### Event Submission

Chat operations emit SRP events for deterministic replay:

```javascript
// Automatic SRP event on chat submit
await SRP.submit({
  event_type: 'kql/infer',
  payload: {
    prompt: "User message",
    model: "janus-pro",
    chat_id: "ghost_1704067200",
    tape: "inference"
  }
});
```

### Event Log

```javascript
// View SRP event log
SRP.log.forEach(entry => {
  console.log(entry.tick, entry.event_type, entry.hash);
});
```

---

## IndexedDB Schema

### Stores

| Store | Key | Indexes |
|-------|-----|---------|
| `messages` | `id` | `chat_id`, `ts`, `role` |
| `chats` | `id` | `ts`, `model` |
| `models` | `id` | - |

### Message Structure

```javascript
{
  id: "msg_1704067200_user",
  chat_id: "ghost_1704067200",
  role: "user" | "assistant" | "system",
  content: "Message content",
  model: "janus-pro",
  ts: 1704067200000,
  tokens: 0  // For assistant messages
}
```

### Chat Structure

```javascript
{
  id: "ghost_1704067200",
  ts: 1704067200000,
  model: "janus-pro",
  message_count: 10
}
```

---

## UI Integration

### Model Pills

```html
<div class="model-pills" id="model-pills">
  <div class="model-pill active" data-model="janus-pro">🧠 Janus Pro</div>
  <div class="model-pill" data-model="janus-flow">⚡ Flow</div>
  <div class="model-pill" data-model="deepseek-r1">🔮 R1</div>
  <!-- ... 8 more models -->
</div>
```

### Chat Actions

| Button | Action |
|--------|--------|
| 🔍 Search | Search messages across all chats |
| 📜 History | Show recent chat sessions |
| ✨ New Chat | Start new chat session |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Ctrl+Enter` | New line (future) |

---

## Configuration

### manifest.json

```json
{
  "asx_os": {
    "kql": {
      "@id": "asx://kql/chat.v1",
      "module": "core/KQL_CHAT.js",
      "schema": "schemas/kql.model.v1.schema.json",
      "registry": "schemas/kql.model-registry.v1.json",
      "api_base": "https://mx2lm.app/api.php",
      "default_model": "janus-pro",
      "models_count": 11,
      "quantum_models": 6
    }
  }
}
```

### Model Schema

Location: `schemas/kql.model.v1.schema.json`

```json
{
  "$id": "asx://schema/kql.model.v1",
  "required": ["@type", "@id", "name", "endpoint", "provider"],
  "properties": {
    "provider": {
      "enum": ["local", "ollama", "huggingface", "openai",
               "anthropic", "deepseek", "custom"]
    },
    "capabilities": {
      "items": {
        "enum": ["chat", "code", "reasoning", "vision",
                 "image-gen", "embedding", "function-call"]
      }
    }
  }
}
```

---

## Error Handling

### API Errors

```javascript
// Handled automatically in KQL
{
  content: "[Janus Pro] Backend temporarily unavailable.",
  tokens: 0,
  stub: true,
  api_url: "https://mx2lm.app/api.php?route=chat&model=janus-pro"
}
```

### Network Errors

```javascript
{
  content: "[Error] MX2LM API failed: NetworkError",
  tokens: 0,
  error: true
}
```

---

## Files

| File | Purpose |
|------|---------|
| `core/KQL_CHAT.js` | KQL module with chat operations |
| `ui/ghost.html` | G(HOST) shell with inference panel |
| `schemas/kql.model.v1.schema.json` | Model validation schema |
| `schemas/kql.model-registry.v1.json` | 11 model definitions |

---

## Quick Start

```javascript
// 1. Boot KQL
await KQL.boot();

// 2. Check available models
console.log(KQL.getModels().map(m => m.name));
// ["Janus Pro", "Janus Flow", "DeepSeek R1", ...]

// 3. Send a message
const result = await KQL.submit({
  prompt: "Hello, world!",
  model: "janus-pro"
});

// 4. Display response
console.log(result.assistant.content);
```

---

## ASXR PRIME Integration

### Tyson-Chomsky Engine

The Tyson-Chomsky Engine provides dual-mode knowledge processing:

| Mode | Description | Use Case |
|------|-------------|----------|
| **tyson** | Empirical evidence gathering | Research, fact-checking |
| **chomsky** | Symbolic grammar validation | Schema design, constraints |
| **fusion** | Debate between modes | Balanced responses |

#### TC Query API

```javascript
// Direct TC query
const result = await KQL.tcQuery({
  question: "Design an XJSON schema for products",
  mode: "fusion",
  constraints: { output_format: "xjson" }
});

// Chat with TC mode
await KQL.submit({
  prompt: "Design a schema",
  model: "janus-pro",
  mode: "chomsky"  // Use Chomsky mode for schema validation
});

// Probe TC engine status
KQL.tcProbe();
// { engine: 'tyson-chomsky-v1', modes: ['tyson', 'chomsky', 'fusion'], ... }

// Get TC logs
KQL.getTCLogs();
```

#### TC Response Format

```javascript
{
  engine: "tyson-chomsky-v1",
  mode: "fusion",
  queryId: "tc_1704067200000",
  tyson: {
    status: "ok",
    sources_used: ["wikipedia", "openalex", "crossref"],
    notes: "Public knowledge sources queried"
  },
  chomsky: {
    status: "ok",
    grammar: "xjson_ast",
    constraints_satisfied: true,
    output: { xjson: "1.0", response: {...} }
  },
  fusion: {
    strategy: "debate",
    rounds: 2,
    winner: "chomsky",
    output: {...}
  }
}
```

### ΩOS Agent Spawner

Spawn specialized micro-agents for domain-specific tasks:

```javascript
// Spawn an agent
const agent = KQL.spawnAgent("baseball", {
  sources: ["mlb", "espn"]
});

// Response
{
  id: "m_baseball_1704067200_abc123",
  topic: "baseball",
  name: "baseball Agent",
  capabilities: ["stats", "compare", "predict", "query"],
  endpoints: {
    query: "/a/m_baseball_.../q",
    infer: "/a/m_baseball_.../i",
    train: "/a/m_baseball_.../tr"
  },
  status: "live"
}

// List all agents
KQL.listAgents();

// Get specific agent
KQL.getAgent("m_baseball_1704067200_abc123");

// Kill agent
KQL.killAgent("m_baseball_1704067200_abc123");
```

### Micronaut Factory

Spawn lightweight mini-OS agents:

```javascript
const micronaut = KQL.spawnMicronaut("cooking", {
  training: false
});

// Response
{
  id: "micronaut_cooking_1704067200",
  topic: "cooking",
  miniOS: {
    version: "1.0",
    name: "cooking Micronaut",
    kernel: "k_uhul_mini",
    capabilities: ["query", "analyze", "respond"]
  },
  endpoints: {
    control: "/api/agents/.../control",
    query: "/api/agents/.../query"
  },
  status: "active"
}
```

### ASXR State

```javascript
// Get full ASXR state
KQL.getASXRState();
// { agents: [...], tcLogs: 5, vfs: 0 }
```

### SRP Event Types

```javascript
// TC query event
await SRP.submit({
  event_type: 'kql/tc',
  payload: { question: "...", mode: "fusion" }
});

// Agent spawn event
await SRP.submit({
  event_type: 'kql/spawn',
  payload: { topic: "baseball", requirements: {} }
});
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 3.0.0 | 2025 | ASXR PRIME integration (TC Engine + Agents) |
| 2.0.0 | 2024 | Production API with 11 models |
| 1.0.0 | 2024 | Initial KQL implementation |

---

*Built with the K'UHUL Multi-Hive Stack + ASXR PRIME*
