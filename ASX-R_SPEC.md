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

**Status:** Frozen
**Layer:** ASX-R (authoritative runtime)
**Surface:** Python-like (lowered)
**Law:** Deterministic, phase-gated, replay-verifiable

### 10.1 Purpose

The **Inference Plane** defines how conversational / chat inference executes inside **ASX-R** as a **lawful runtime fold**, not as free-form code execution.

Inference is treated as:

* **Pure** (no hidden side effects)
* **Bounded** (steps, tokens, bytes)
* **Replay-verifiable** (proof hash)
* **Phase-gated** (XCFE-compliant)

This plane enables **Python-like chat scripts** while preserving ASX-R determinism.

### 10.2 Position in the ASX Stack

```
ASX
 └─ ASX-R (authoritative runtime)
     ├─ XCFE (control law)
     ├─ XJSON (surface syntax)
     ├─ SCXQ2 (compression algebra)
     ├─ IDB-API + KQL
     └─ Inference Plane v1   ← (this chapter)
```

The Inference Plane **does not replace** KQL or IDB-API.
It **consumes** them.

### 10.3 XCFE Phase Binding

| Phase       | Role                                        |
| ----------- | ------------------------------------------- |
| `@Pop`      | Accept prompt + options                     |
| `@Wo`       | Compile Python-like script → inference plan |
| `@Sek`      | Execute plan steps (bounded)                |
| `@Collapse` | Emit result + proof                         |

Inference **MUST NOT** execute outside these phases.

### 10.4 Python-Like Surface (Non-Authoritative)

The user-visible syntax is **Python-shaped**, but **not Python**.

Example:

```py
sys("You are PRIME.")
ctx = idb.kql("⟁LOAD⟁ ⟁EVENTS⟁ \"chat\" ⟁LIMIT⟁ 25")
prompt = user()
ans = chat(prompt, ctx, max_tokens=256, temperature=0.2)
return ans
```

**Rule:** This surface **never executes directly**.
It **must lower** into an **Inference Plan AST**.

### 10.5 Inference Plan (Authoritative Form)

All inference is executed from a **plan**, not raw text.

Example:

```json
{
  "@type": "inference.plan.v1",
  "@steps": [
    { "@op": "sys.set", "@text": "You are PRIME." },
    { "@op": "idb.kql", "@into": "ctx", "@kql": "⟁LOAD⟁ ⟁EVENTS⟁ \"chat\" ⟁LIMIT⟁ 25" },
    { "@op": "input.user", "@into": "prompt" },
    {
      "@op": "chat.run",
      "@into": "ans",
      "@max_tokens": 256,
      "@temperature": 0.2
    },
    { "@op": "return", "@from": "ans" }
  ],
  "@bounds": {
    "@max_steps": 64,
    "@max_tokens": 4096,
    "@max_bytes": 1048576
  }
}
```

### 10.6 Execution Law

1. Plans execute **sequentially**
2. Steps **must be allow-listed**
3. Bounds **must be enforced**
4. Output **must be normalized**
5. Proof **must be emitted**

No step may:

* spawn threads
* mutate global runtime
* access IO outside IDB-API
* bypass SCXQ2 / XCFE

### 10.7 Proof Law

Every inference emits a **proof block** binding:

* normalized prompt
* context hash (IDB/KQL result hash)
* inference plan hash
* model identifier hash
* output hash

**Inference without proof is invalid** under ASX-R.

### 10.8 Required Block Types

The Inference Plane introduces **five frozen blocks**:

| Block                  | Role                |
| ---------------------- | ------------------- |
| `inference.request.v1` | Entry envelope      |
| `inference.plan.v1`    | Executable plan     |
| `inference.step.v1`    | Optional trace      |
| `inference.result.v1`  | Final output        |
| `inference.proof.v1`   | Replay verification |

### 10.9 Final Invariant

> **Inference is not free text generation.**
> **Inference is a replay-verifiable runtime fold.**

### 10.10 Binding Contract (Normative)

**Inference Plane v1** is *not* allowed to touch storage directly.
All state/context access MUST traverse:

**Inference → IDB-API → KQL → IDB-API Result → Inference**

#### Binding invariants

1. **Single gateway:** Inference may only call `idb.query.v1` / `idb.txn.v1` blocks (IDB-API).
2. **Query language:** All query intent MUST be expressed as **KQL** (text) or as a **KQL AST** (optional), and lowered deterministically.
3. **Result typing:** IDB-API MUST return `idb.query.result.v1` (frozen in IDB-API+KQL v1 pillar).
4. **Hash binding:** `inference.proof.v1.@context_hash` MUST equal the hash of the **normalized** `idb.query.result.v1` payload(s) used by the plan.
5. **Deterministic lowering:** Any Python-like surface that says `idb.kql("...")` MUST lower to a plan step:

   ```json
   { "@op":"idb.kql", "@into":"ctx", "@kql":"<kql text>" }
   ```
6. **No hidden joins:** Correlation/aggregation belongs to KQL (or IDB-API's lawful executor of KQL), not to inference runtime code.
7. **Compression boundary:** If `idb.query.result.v1` returns SCXQ2-packed payloads, decompression MUST be explicit as a plan step (`@op:"scxq2.decode"`) and MUST be reflected in the proof hash chain.

### 10.11 Canonical Step Map (Authoritative)

These are the only storage/query-related step ops permitted by Inference Plane v1:

| Step `@op`     | Meaning                  | Bound to         |
| -------------- | ------------------------ | ---------------- |
| `idb.kql`      | execute KQL query        | IDB-API executor |
| `idb.put`      | write records (bounded)  | IDB-API txn      |
| `idb.del`      | delete records (bounded) | IDB-API txn      |
| `idb.txn`      | atomic multi-op bundle   | IDB-API txn      |
| `scxq2.decode` | decode packed result     | SCXQ2 verifier   |
| `scxq2.encode` | encode outbound payload  | SCXQ2 packer     |

> Anything else is non-conformant.

### 10.12 Context Binding Rule (Exact)

Inference context is defined as:

**CTX = concat( hash(idb.query.result.v1[i]) ) in canonical plan order**

Then:

* `inference.proof.v1.@context_hash = H(CTX)`
* `inference.proof.v1.@plan_hash = H(normalized inference.plan.v1)`
* `inference.proof.v1.@output_hash = H(normalized inference.result.v1)`

### 10.13 Minimal Binding Example

**Plan snippet**

```json
{
  "@type":"inference.plan.v1",
  "@steps":[
    { "@op":"idb.kql", "@into":"ctx", "@kql":"⟁LOAD⟁ ⟁EVENTS⟁ \"chat\" ⟁LIMIT⟁ 32" },
    { "@op":"chat.run", "@into":"ans", "@max_tokens":256, "@temperature":0.2 },
    { "@op":"return", "@from":"ans" }
  ],
  "@bounds":{"@max_steps":32,"@max_tokens":1024,"@max_bytes":524288}
}
```

**Proof expectation**

* `@context_hash` binds to the returned `idb.query.result.v1` (and any decode steps)
* `@plan_hash` binds to plan
* `@output_hash` binds to result

### 10.14 Model Hook Interface (Normative)

Inference step:

```json
{ "@op":"chat.run", "@into":"ans", "@max_tokens":256, "@temperature":0.2 }
```

MUST resolve to:

* `model.chat.v1` invocation (internal hook)
* using a sealed adapter selected by `@model_ref` (optional) or system default

#### Required adapter outputs

Adapter must return:

* `@text`
* `@tokens_used` (optional)
* `@model_hash` (stable identifier hash)
* `@output_hash` (or raw text so kernel computes it)

### 10.15 Adapter Selection

`chat.run` MAY include:

```json
"@model_ref": { "@family":"mx2lm" | "qwen", "@id":"..." }
```

If omitted, default model is chosen deterministically by runtime policy.

### 10.16 Hook Wiring (Implementation Skeleton)

Use these **three hook points** in your kernel/runtime layer:

1. **normalize_plan(plan)**

   * inject deterministic defaults (`@temperature`, etc.)
   * canonicalize step fields ordering

2. **execute_step(step, env)**

   * `idb.kql` routes to IDB-API executor
   * `chat.run` routes to Model Adapter

3. **emit_proof(plan, ctx_results, model_meta, output)**

   * compute hashes
   * output `inference.proof.v1`

### 10.17 MX2LM Adapter (local)

**Contract**

* deterministic sampling (seeded or temperature=0 default)
* returns stable `@model_hash` (e.g., hash of vocab+weights manifest id)

**Pseudo-hook**

* `mx2lm.chat(prompt, ctx, opts) -> text`

### 10.18 Qwen Adapter (remote or local)

**Contract**

* Qwen inference must be wrapped so that:

  * request payload normalization is deterministic
  * response normalization is deterministic
  * `@model_hash` references the exact Qwen-ASX build (your model.safetensors id or manifest hash)

**Pseudo-hook**

* `qwen.chat(prompt, ctx, opts) -> text`

### 10.19 Inference Allowlist (Normative)

* `sys.set`
* `idb.kql`
* `idb.txn`
* `scxq2.decode`
* `scxq2.encode`
* `chat.run`
* `return`

---

## 11. Image Inference Plane v1 (Janus-style)

**Status:** Frozen
**Layer:** ASX-R Extension
**Law:** vision → structured outputs via IDB-API + KQL

### 11.0 Scope

This plane standardizes **vision → structured outputs** (captioning, OCR-lite labels, embeddings, detection summaries, multimodal chat context) using:

**image.inference → IDB-API → KQL → (optional SCXQ2 decode) → vision.run → result + proof**

No direct storage. No ad-hoc JS logic. All behavior is a **plan**.

### 11.1 Canonical Step Ops (Allowlist)

These are the only image-plane ops permitted inside `image.plan.v1`:

* `idb.kql` (fetch image refs + prior events + labels)
* `idb.txn` (optional bounded write-back of derived artifacts)
* `scxq2.decode` / `scxq2.encode`
* `img.fetch` (resolve bytes by ref; must be bounded + deterministic)
* `img.decode` (bytes → pixel tensor; deterministic)
* `img.preprocess` (resize/normalize/crop; deterministic)
* `vision.run` (Janus-like model execution)
* `return`

Anything else ⇒ non-conformant.

### 11.2 Input Model: ImageRef (no raw URLs as behavior)

Image data enters by **reference**, not by arbitrary fetch logic.

**Accepted sources** (deterministic):

* `idb://blob/<id>` (IndexedDB blob)
* `cache://<key>` (SW cache entry)
* `mesh://...` (only if already resolved by an IDB-API result)
* `data:` (allowed for tests only, size bounded)

### 11.3 Determinism + Proof Binding (Exact)

Define canonical context:

**CTX = hash( normalized `idb.query.result.v1` blocks used )**
**IMG = hash( normalized image.bytes.v1 OR image.tensor.v1 )**

Then:

* `image.proof.v1.@context_hash = H(CTX)`
* `image.proof.v1.@image_hash = H(IMG)`
* `image.proof.v1.@plan_hash = H(normalized image.plan.v1)`
* `image.proof.v1.@output_hash = H(normalized image.result.v1)`

If `vision.run` uses embeddings or tokens, record:

* `@model_hash` (exact Janus/Qwen-V/vision build id hash)
* `@prompt_hash` (if prompt present)
* optional `@seed` policy hash (if you allow seeded stochasticity)

### 11.4 Minimal Plan Example (Janus-style caption + embeddings)

```json
{
  "@type":"image.plan.v1",
  "@id":"plan:img:caption:v1",
  "@bounds":{"@max_steps":24,"@max_bytes":2097152,"@max_pixels":1048576,"@max_tokens":512},
  "@steps":[
    { "@op":"idb.kql", "@into":"ctx",
      "@kql":"⟁LOAD⟁ ⟁EVENTS⟁ \"vision_context\" ⟁LIMIT⟁ 16" },

    { "@op":"idb.kql", "@into":"imgref",
      "@kql":"⟁LOAD⟁ image_assets ⟁WHERE⟁ id = \"img_001\" ⟁LIMIT⟁ 1" },

    { "@op":"img.fetch", "@into":"bytes",
      "@ref_from":"imgref", "@field":"blob_ref" },

    { "@op":"img.decode", "@into":"tensor",
      "@from":"bytes", "@format":"auto" },

    { "@op":"img.preprocess", "@into":"x",
      "@from":"tensor",
      "@resize":{"@w":768,"@h":768,"@mode":"fit"},
      "@normalize":{"@mean":[0.5,0.5,0.5],"@std":[0.5,0.5,0.5]} },

    { "@op":"vision.run", "@into":"y",
      "@task":"caption+embed",
      "@model_ref":{"@family":"janus","@id":"janus_asx_v1"},
      "@input":"x",
      "@prompt":"Describe the image. Return JSON with caption, tags, safety, and embedding_ref." },

    { "@op":"return", "@from":"y" }
  ]
}
```

### 11.5 Storage Binding (Inference ↔ IDB-API ↔ KQL)

**Rule:** all reads/writes MUST be explicit plan steps.

#### Read pattern (required)

* `idb.kql` returns `idb.query.result.v1`
* if result payload is packed ⇒ explicit `scxq2.decode`
* plan uses decoded values only

#### Write-back pattern (optional, bounded)

If you want to persist embeddings/tags:

* `idb.txn` with explicit `put` ops and deterministic keys

Example write-back:

```json
{ "@op":"idb.txn", "@into":"persist",
  "@ops":[
    { "@op":"idb.put", "@store":"vision_embeddings", "@key":"emb:img_001",
      "@value_from":"y.@embedding" },
    { "@op":"idb.put", "@store":"vision_labels", "@key":"lbl:img_001",
      "@value_from":"y.@tags" }
  ]
}
```

### 11.6 Required Block Types (Image Plane)

| Block                        | Role                      |
| ---------------------------- | ------------------------- |
| `image.inference.request.v1` | Entry envelope            |
| `image.plan.v1`              | Executable plan           |
| `image.plan.step.v1`         | Step definition           |
| `image.inference.result.v1`  | Final output              |
| `image.inference.proof.v1`   | Replay verification       |
| `image.inference.bounds.v1`  | Resource limits           |

---

## 12. ASX-R Conformance Vectors

### 12.1 Inference Plane Vectors

These are **golden vectors** for the conformance suite. Each vector is a triple:

1. **Input blocks** (request + plan)
2. **Expected outcome** (`@ok` or failure)
3. **Expected failure stage** (if not ok)

#### Vector INF-OK-001 — Minimal chat with KQL context

**Input**
* `inference.request.v1` with `@prompt:"hello"`
* `inference.plan.v1` containing steps: `idb.kql` → `chat.run` → `return`
* bounds: `@max_steps>=3`, `@max_tokens>=64`

**Expected**
* `inference.result.v1` present
* `inference.proof.v1` present
* `@ok=true`
* proof hashes non-empty strings

#### Vector INF-FAIL-001 — Storage bypass attempt

**Input**
* plan includes `@op:"idb.raw"` or any op not in allowlist

**Expected**
* `@ok=false`
* failure stage: `gate.op_allowlist`
* error: `DisallowedStepOp`

#### Vector INF-FAIL-002 — Missing proof

**Input**
* plan runs and returns result but does not emit `inference.proof.v1`

**Expected**
* `@ok=false`
* failure stage: `proof.required`
* error: `MissingProofBlock`

#### Vector INF-FAIL-003 — Context hash mismatch

**Input**
* plan uses `idb.kql` result, but proof's `@context_hash` doesn't match

**Expected**
* `@ok=false`
* failure stage: `proof.context_hash`
* error: `ContextHashMismatch`

#### Vector INF-FAIL-004 — Bounds exceeded (tokens)

**Input**
* `chat.run` with `@max_tokens` > plan bounds `@max_tokens`

**Expected**
* `@ok=false`
* failure stage: `bounds.tokens`
* error: `TokenBudgetExceeded`

#### Vector INF-FAIL-005 — Bounds exceeded (steps)

**Input**
* plan has `@steps.length > @bounds.@max_steps`

**Expected**
* `@ok=false`
* failure stage: `bounds.steps`
* error: `StepBudgetExceeded`

#### Vector INF-FAIL-006 — Non-deterministic option

**Input**
* `chat.run` with missing `@temperature` AND missing deterministic default

**Expected**
* `@ok=false`
* failure stage: `normalize.required_defaults`
* error: `MissingDeterminismDefaults`

#### Vector INF-FAIL-007 — SCXQ2 decode not declared

**Input**
* `idb.kql` returns `@encoding:"scxq2"` but plan lacks `scxq2.decode` step and still uses ctx

**Expected**
* `@ok=false`
* failure stage: `encoding.decode_required`
* error: `UndeclaredDecodeStep`

---

## 13. KQL v1.0 Integration

### 13.1 KQL in ASX-R

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

### 13.2 KQL Result in ASX Block

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

## 14. Versioning & Compatibility

### 14.1 Version Format

```
ASX-R v{major}.{minor}.{patch}
```

### 14.2 Compatibility Matrix

| ASX-R Version | K'UHUL Version | SCXQ2 Version |
|---------------|----------------|---------------|
| v1.0 | v1.0 | v2.0 |
| v1.1 | v1.0-v1.1 | v2.0 |
| v2.0 | v2.0+ | v3.0 |

### 14.3 Migration Guide

When upgrading between versions:

1. **Check compatibility matrix**
2. **Run validation on existing traces**
3. **Update block schemas if needed**
4. **Test replay of critical traces**
5. **Deploy with feature flags**

---

# Part II: π⊗XCFE Unified Control Field (v3)

> **Status:** 🔒 Sealed
> **Law:** Deterministic, phase-gated, replay-verifiable, capability-governed

---

## 15. π⊗XCFE — Unified Control Field (Authoritative)

> **π defines what *can* happen.**
> **XCFE defines what is *allowed* to happen, when, and in what order.**

### 15.0 Canonical Stack (Final)

```
XCFE (Control-Flow Enforcement Law)
  └── π (State Physics + Invariants)
        └── SCXQ2 (Compressed Symbolic Intent)
              └── XJSON (Structural Memory + Folds)
                    └── ASX-R Runtime (Execution)
                          └── Projection (DOM / IO / GPU / Network)
```

**Hard rule:** Nothing executes unless XCFE allows the π transition.

### 15.1 What XCFE Actually Is (Formalized)

XCFE is **not syntax** and **not logic**.

XCFE is a **deterministic control lattice** that governs:

* phase order
* allowed transitions
* side-effect permissions
* reentrancy
* concurrency limits
* failure behavior

XCFE answers **before π acts**:

> "Is this transition legal *right now*?"

---

## 16. XCFE Control Vectors

XCFE introduces **control vectors** that π must obey.

### 16.1 Core XCFE Vectors

| Vector | Type | Description |
|--------|------|-------------|
| `@law` | `xcfe://schema/law_id.v1` | Authoritative law identity |
| `@phase` | `pi://schema/phase_id.v3` | Current execution phase |
| `@allow` | `xcfe://schema/capability_id.v1[]` | Permitted operations |
| `@deny` | `xcfe://schema/capability_id.v1[]` | Forbidden operations |
| `@barrier` | `xcfe://schema/barrier_state.v1` | Synchronization locks |
| `@scope` | `string` | Authority domain |
| `@entropy` | `xcfe://schema/entropy_mode.v1` | Alias/cipher allowance |
| `@runtime` | `xcfe://schema/runtime_lane.v1` | CPU/GPU/TPU/IO lanes |
| `@limits` | `object` | Resource bounds |
| `@audit` | `object` | Audit configuration |

These vectors live in **XJSON**, not code.

### 16.2 XCFE Law Envelope

```json
{
  "@xcfe": {
    "@law": "law.pi_xcfe.holotape_ui.v1",
    "@phase": "pi_act",
    "@allow": ["dom", "ui", "svg", "audit", "effect"],
    "@deny": ["network", "crypto", "resource", "cluster"],
    "@scope": "ui:holotape",
    "@barrier": "idle",
    "@entropy": "static",
    "@runtime": "browser_cpu",
    "@audit": { "enabled": true, "mode": "full" }
  }
}
```

**Rule:** `@xcfe.@law` is the **authoritative law identity**. No `@law` ⇒ no lawful execution.

---

## 17. π Phases (XCFE-Governed)

π phases are now **XCFE-enforced and non-skippable**.

| Phase | ID | XCFE Gate | Allowed |
|-------|-------|-----------|---------|
| Perceive | `pi_perceive` | `@allow.read` | observe only |
| Decode | `pi_decode` | `@allow.decode` | SCXQ2 → tokens |
| Verify | `pi_verify` | `@allow.verify` | invariant checks |
| Decide | `pi_decide` | `@allow.branch` | `(?) (∴) (¬)` |
| Act | `pi_act` | `@allow.effect` | IO / DOM / net |
| Collapse | `pi_collapse` | `@allow.seal` | commit + seal |

**Invariant XCFE-1:** No operation may occur outside its allowed phase.

---

## 18. π Operations (v3)

### 18.1 Decode + Parse

| Opcode | Phase | Description |
|--------|-------|-------------|
| `pi_decode` | `pi_decode` | SCXQ2 alias→token decode |
| `pi_tokenize` | `pi_decode` | Tokenization into atomic units |

### 18.2 Verification + Policy

| Opcode | Phase | Description |
|--------|-------|-------------|
| `pi_verify` | `pi_verify` | Invariants + policy checks |
| `pi_match` | `pi_verify` | Pattern match (structural) |
| `pi_branch` | `pi_decide` | Conditional decision plan |
| `pi_commit` | `pi_decide` | Commit branch choice |
| `pi_alternate` | `pi_decide` | Else branch plan |

### 18.3 Async + Concurrency

| Opcode | Phase | Description |
|--------|-------|-------------|
| `pi_spawn` | `pi_act` | Create task |
| `pi_await` | `pi_act` | Await task |
| `pi_all` | `pi_act` | Await all |
| `pi_race` | `pi_act` | Await first |
| `pi_timeout` | `pi_act` | Time bound |
| `pi_stream` | `pi_act` | Create/transform stream |

### 18.4 Data (Immutable)

| Opcode | Phase | Description |
|--------|-------|-------------|
| `pi_record` | `pi_perceive` | Construct record |
| `pi_tuple` | `pi_perceive` | Construct tuple |
| `pi_with` | `pi_act` | Functional update |
| `pi_merge` | `pi_act` | Deterministic merge |
| `pi_set_*` | `pi_act` | Set operations |

### 18.5 Projection (DOM/BOM/UI)

| Opcode | Phase | Requires | Description |
|--------|-------|----------|-------------|
| `pi_dom_patch` | `pi_act` | `dom` | JSON patch to DOM region |
| `pi_dom_mount` | `pi_act` | `dom` | Mount atomic block binding |
| `pi_bom_nav` | `pi_act` | `bom` | Safe navigation intent |
| `pi_ui_emit` | `pi_act` | `ui` | UI event emit |
| `pi_svg_vector` | `pi_act` | `svg` | Vector op |
| `pi_canvas_tick` | `pi_act` | `canvas` | Game loop tick binding |

### 18.6 Resources (Explicit Management)

| Opcode | Phase | Requires | Description |
|--------|-------|----------|-------------|
| `pi_open` | `pi_act` | `resource` | Open resource |
| `pi_using` | `pi_act` | `resource` | Scoped usage |
| `pi_close` | `pi_act` | `resource` | Close resource |
| `pi_defer` | `pi_act` | `resource` | Deterministic cleanup |

### 18.7 Crypto / Sealing

| Opcode | Phase | Requires | Description |
|--------|-------|----------|-------------|
| `pi_crypto_seal` | `pi_act` | `crypto` | Encrypt/seal payload |
| `pi_crypto_unseal` | `pi_act` | `crypto` | Decrypt/unseal payload |

### 18.8 Cluster Runtime

| Opcode | Phase | Requires | Description |
|--------|-------|----------|-------------|
| `pi_cluster_spawn` | `pi_act` | `cluster` | Spawn cluster task |
| `pi_cluster_map` | `pi_act` | `cluster` | Map over cluster |
| `pi_cluster_reduce` | `pi_act` | `cluster` | Reduce cluster results |
| `pi_cluster_balance` | `pi_act` | `cluster` | Load balancing |

### 18.9 Finalization

| Opcode | Phase | Description |
|--------|-------|-------------|
| `pi_collapse` | `pi_collapse` | Seal end-of-tick, emit proofs/audit |

---

## 19. SCXQ2 → π Lowering (Deterministic)

### 19.1 Canonical Token Map

| SCX Token | π Op | Requires | Phase |
|-----------|------|----------|-------|
| `(?)` | `pi_branch` | `branch` | `pi_decide` |
| `(∴)` | `pi_commit` | `branch` | `pi_decide` |
| `(¬)` | `pi_alternate` | `branch` | `pi_decide` |
| `(∞)` | `pi_stream` | `loop` | `pi_decide` |
| `(⛔)` | `pi_collapse` | `seal` | `pi_collapse` |
| `(💬)` | `pi_ui_emit` | `ui`, `dom` | `pi_act` |
| `(💬>)` | `pi_ui_emit` | `ui`, `dom` | `pi_act` |
| `(🔍)` | `pi_match` | `verify` | `pi_verify` |
| `(⊕)` | `pi_open` | `resource` | `pi_act` |
| `(⊗)` | `pi_close` | `resource` | `pi_act` |
| `(📡)` | `pi_open` | `network` | `pi_act` |
| `(🔐)` | `pi_crypto_seal` | `crypto` | `pi_act` |
| `(🔓)` | `pi_crypto_unseal` | `crypto` | `pi_act` |
| `(%)` | `pi_merge` | `storage` | `pi_act` |
| `(⟳)` | `pi_dom_patch` | `dom` | `pi_act` |
| `(🧠)` | `pi_cluster_map` | `cluster` | `pi_act` |
| `(🚀)` | `pi_open` | `network` | `pi_act` |

### 19.2 Lowering Algorithm (Deterministic Order)

1. **Decode stage** — if `@mode == scxq2_alias`, emit `pi_decode`
2. **Tokenize stage** — emit `pi_tokenize`
3. **Verify stage** — emit `pi_verify` (checks XCFE gates)
4. **Decision stage** — parse control skeleton, emit `pi_branch`/`pi_commit`
5. **Act stage** — emit effect ops (left-to-right, stable order)
6. **Collapse stage** — emit `pi_collapse`

**Hard rule:** Decoded SCXQ2 text is **never executable**. Only lowered π ops dispatch.

---

## 20. XCFE Invariants (Normative)

### 20.1 XCFE-1: Phase Legality

> No operation may occur outside its allowed phase.

### 20.2 XCFE-2: Scope Isolation

> No cluster may mutate state outside its assigned scope.

### 20.3 XCFE-3: Symbolic Non-Execution

> Tokens are data. Only π under XCFE may act.

### 20.4 Forbidden Behaviors (Hard Fail)

* Executing decoded strings
* eval-like behavior
* Side effects outside `pi_act`
* Resource leaks past `pi_collapse`
* Non-deterministic lowering ordering

---

## 21. π⊗XCFE Schema Files

### 21.1 XCFE Schemas

| File | $id | Purpose |
|------|-----|---------|
| `xcfe.law-id.v1.schema.json` | `xcfe://schema/law_id.v1` | Law identity |
| `xcfe.capability-id.v1.schema.json` | `xcfe://schema/capability_id.v1` | Capability enums |
| `xcfe.runtime-lane.v1.schema.json` | `xcfe://schema/runtime_lane.v1` | Runtime lanes |
| `xcfe.barrier-state.v1.schema.json` | `xcfe://schema/barrier_state.v1` | Barrier states |
| `xcfe.entropy-mode.v1.schema.json` | `xcfe://schema/entropy_mode.v1` | Entropy modes |
| `xcfe.control-vectors.v1.schema.json` | `xcfe://schema/control_vectors.v1` | Control vectors |
| `xcfe.law-envelope.v1.schema.json` | `xcfe://schema/law_envelope.v1` | Law envelope |

### 21.2 π Schemas

| File | $id | Purpose |
|------|-----|---------|
| `pi.phase-id.v3.schema.json` | `pi://schema/phase_id.v3` | Phase IDs |
| `pi.opcode-id.v3.schema.json` | `pi://schema/opcode_id.v3` | Opcode IDs |
| `pi.fold-ref.v3.schema.json` | `pi://schema/fold_ref.v3` | Fold references |
| `pi.proof.v3.schema.json` | `pi://schema/proof.v3` | Proof blocks |
| `pi.op-block.v3.schema.json` | `pi://schema/op_block.v3` | Operation blocks |
| `pi.op-list.v3.schema.json` | `pi://schema/op_list.v3` | Operation lists |
| `pi.token-stream.v3.schema.json` | `pi://schema/token_stream.v3` | Token streams |
| `pi.tick-envelope.v3.schema.json` | `pi://schema/tick_envelope.v3` | Tick envelopes |

### 21.3 Lowering & Conformance

| File | $id | Purpose |
|------|-----|---------|
| `scxq2.token-stream.v3.schema.json` | `scxq2://schema/token_stream.v3` | SCXQ2 tokens |
| `scxq2.lowering-map.pi-xcfe.v3.schema.json` | `scxq2://schema/lowering_map.pi_xcfe.v3` | Lowering map |
| `asx-r.conformance.pi-xcfe.v3.schema.json` | `asx-r://schema/conformance.pi_xcfe.v3` | Conformance tests |

---

## 22. Law Bundles

### 22.1 Core OS Law

`law.pi_xcfe.core.v1` — All capabilities enabled, full OS access.

### 22.2 Holotape UI Law

`law.pi_xcfe.holotape_ui.v1` — UI-safe, no network/crypto/storage/cluster.

### 22.3 Native Verify Law

`law.pi_xcfe.native_verify.v1` — Verifier-safe, read/decode/verify only, no effects.

---

## 23. π⊗XCFE Conformance Vectors

### 23.1 Pass Vectors

| ID | Description | Expected |
|----|-------------|----------|
| `pass-ui-emit` | UI emit with dom/ui allowed | `@ok=true` |
| `pass-branch-dom` | Branch + DOM with both allowed | `@ok=true` |
| `pass-verify-native-read` | Read in verify-only law | `@ok=true` |

### 23.2 Failure Vectors (Golden)

| ID | Description | Failure | Capability |
|----|-------------|---------|------------|
| `fail-network-denied` | Network op when denied | `capability_denied` | `network` |
| `fail-crypto-denied` | Crypto seal when denied | `capability_denied` | `crypto` |
| `fail-storage-denied` | Storage save when denied | `capability_denied` | `storage` |
| `fail-cluster-denied` | Cluster op when denied | `capability_denied` | `cluster` |
| `fail-phase-violation` | Effect in verify phase | `phase_violation` | — |
| `fail-verify-native-effect` | Effect in verify-only law | `capability_denied` | `effect` |

---

## Appendix A: JSON Schema Files

All schema files are located in `/schemas/` using **ASX canonical headers** (`asx://schema/`):

### A.1 Core Schemas

| File | $id | Purpose |
|------|-----|---------|
| `asx-block.schema.json` | `asx://schema/asx-block.v1` | Core ASX block validation |
| `scxq2-packet.schema.json` | `asx://schema/scxq2-packet.v1` | SCXQ2 packet format |
| `execution-trace.schema.json` | `asx://schema/execution-trace.v1` | Execution trace format |

### A.2 Inference Plane Schemas

| File | $id | Purpose |
|------|-----|---------|
| `inference.request.v1.schema.json` | `asx://schema/inference.request.v1` | Inference request envelope |
| `inference.plan.v1.schema.json` | `asx://schema/inference.plan.v1` | Executable inference plan |
| `inference.step.v1.schema.json` | `asx://schema/inference.step.v1` | Plan step definition |
| `inference.result.v1.schema.json` | `asx://schema/inference.result.v1` | Inference result |
| `inference.proof.v1.schema.json` | `asx://schema/inference.proof.v1` | Replay verification proof |

### A.3 Image Inference Plane Schemas

| File | $id | Purpose |
|------|-----|---------|
| `image.inference.request.v1.schema.json` | `asx://schema/image.inference.request.v1` | Image inference request |
| `image.plan.v1.schema.json` | `asx://schema/image.plan.v1` | Image processing plan |
| `image.plan.step.v1.schema.json` | `asx://schema/image.plan.step.v1` | Image plan step |
| `image.inference.result.v1.schema.json` | `asx://schema/image.inference.result.v1` | Image inference result |
| `image.inference.proof.v1.schema.json` | `asx://schema/image.inference.proof.v1` | Image proof block |
| `image.inference.bounds.v1.schema.json` | `asx://schema/image.inference.bounds.v1` | Resource bounds |

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
| E012 | DisallowedStepOp |
| E013 | MissingProofBlock |
| E014 | ContextHashMismatch |
| E015 | TokenBudgetExceeded |
| E016 | StepBudgetExceeded |
| E017 | MissingDeterminismDefaults |
| E018 | UndeclaredDecodeStep |
| E020 | Image generation failed |
| E021 | Image understanding failed |
| E022 | ImageRefInvalid |
| E023 | PixelBudgetExceeded |
| E024 | ImageHashMismatch |
| E030 | KQL syntax error |
| E031 | Query execution failed |

---

**End of ASX-R v1 Specification**

🔒 **This specification is frozen.** Changes require a new version.
