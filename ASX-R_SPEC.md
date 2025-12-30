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
