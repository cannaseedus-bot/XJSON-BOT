# ASX-R v2 — Runtime Language Specification

**Status:** 🔒 Frozen
**Supersedes:** ASX-R v1
**Role:** Authoritative Runtime Language + SRP Subsystem
**Binding:** SRP v1 locked into ASX-R v2

---

## Version History

| Version | Status | Changes |
|---------|--------|---------|
| v1.0 | Frozen | Initial XCFE + Inference Plane |
| v2.0 | **Frozen** | +SRP subsystem, +π⊗XCFE unification |

---

## 0. Design Principles

| Principle | Description |
|-----------|-------------|
| **Deterministic** | Same input → same output, always |
| **Phase-Gated** | Execution flows through XCFE phases |
| **Replay-Verifiable** | Any execution can be replayed and verified |
| **Symbolic** | Uses glyphs for operation delimiting |
| **Composable** | Blocks nest and combine freely |
| **SRP-Native** | State transitions are lawful folds, not code |

---

## 1. Canonical Stack (v2)

```
ASX (Universal OS)
 └── ASX-R v2 (Authoritative Runtime)
      ├── XCFE (Control-Flow Enforcement Law)
      ├── π (State Physics + Invariants)
      ├── SRP v1 (System Runtime Preprocessor)    ← NEW
      ├── SCXQ2 (Compressed Symbolic Intent)
      ├── XJSON (Structural Memory + Folds)
      ├── IDB-API + KQL (Storage Layer)
      ├── Inference Plane v1 (Chat)
      └── Image Inference Plane v1 (Vision)
```

**Hard Rule:** Nothing executes unless XCFE allows it. SRP governs state transitions.

---

## 2. SRP — System Runtime Preprocessor (First-Class Subsystem)

### 2.1 Definition

**SRP is not a language. SRP is not a framework. SRP is a runtime preprocessor that governs state → projection.**

SRP is a **deterministic runtime fold** that:

* Accepts **events** (`srp.event.v1`)
* Applies **directives** (`srp.directive.v1`)
* Produces **deltas** (`srp.delta.v1`)
* Advances via **ticks**
* Emits **projections** (`srp.projection.v1`)
* Records **replayable proofs**

### 2.2 SRP Kernel Phases

```
submit → tick → collapse → project → verify
```

| Phase | Purpose |
|-------|---------|
| **Submit** | Accept event(s) into the event log |
| **Tick** | Select pending events + run directives |
| **Collapse** | Compute and apply deltas deterministically |
| **Project** | Emit projection payload (DOM/CSS/API surface) |
| **Verify** | Extend projection hash chain for replay |

### 2.3 SRP Determinism Law

| Rule | Requirement |
|------|-------------|
| `ordering` | Events sorted by (ts, id). Directives sorted by (order, id). Delta ops applied in stable order. |
| `no_eval` | true |
| `no_time_reads` | true (use event timestamp only) |
| `no_rng` | true (deterministic outputs only) |

### 2.4 Why JS Frameworks Emulate This Badly

| JS Pattern | What It Tries | Why It Fails |
|------------|---------------|--------------|
| `setState()` | Declare state change | State is mutable & temporal |
| Virtual DOM | Projection caching | Still imperative |
| Hooks | Event → state wiring | Order-dependent |
| Reducers | Delta simulation | Not provable |
| Effects | Async side effects | Nondeterministic |
| SSR | Runtime pre-pass | Only on request |

**SRP does this structurally, once, forever.**

### 2.5 SRP Schemas (Frozen)

| Schema ID | Purpose |
|-----------|---------|
| `asx://schema/srp.class.v1` | SRP class definition |
| `asx://schema/srp.event.v1` | Event structure |
| `asx://schema/srp.directive.v1` | Directive (replaces functions) |
| `asx://schema/srp.delta.v1` | State transition unit |
| `asx://schema/srp.projection.v1` | UI/IO output surface |

### 2.6 SRP Event Schema

```json
{
  "$id": "asx://schema/srp.event.v1",
  "type": "object",
  "required": ["@type", "id", "kind", "ts", "class_id", "payload"],
  "properties": {
    "@type": { "const": "srp.event.v1" },
    "id": { "type": "string" },
    "kind": { "enum": ["submit", "tick", "system"] },
    "ts": { "type": "integer" },
    "class_id": { "type": "string", "pattern": "^asx://.*" },
    "payload": { "type": "object" }
  }
}
```

### 2.7 SRP Directive Schema

Directives replace imperative functions with declarative control:

```json
{
  "$id": "asx://schema/srp.directive.v1",
  "type": "object",
  "required": ["id", "when"],
  "properties": {
    "id": { "type": "string" },
    "order": { "type": "integer", "default": 0 },
    "when": { "type": "object", "description": "XCFE-compatible predicate" },
    "emit_delta": {
      "type": "object",
      "properties": {
        "set": { "type": "array" },
        "ops": { "type": "array" }
      }
    },
    "emit_projection": { "$ref": "asx://schema/srp.projection.v1" }
  }
}
```

### 2.8 SRP Delta Schema

```json
{
  "$id": "asx://schema/srp.delta.v1",
  "type": "object",
  "required": ["@type", "id", "from_event", "ops"],
  "properties": {
    "@type": { "const": "srp.delta.v1" },
    "id": { "type": "string" },
    "from_event": { "type": "string" },
    "ops": {
      "type": "array",
      "items": {
        "type": "array",
        "description": "[op, path, value]"
      }
    }
  }
}
```

### 2.9 SRP Projection Schema

```json
{
  "$id": "asx://schema/srp.projection.v1",
  "type": "object",
  "required": ["@type", "id", "class_id", "view"],
  "properties": {
    "@type": { "const": "srp.projection.v1" },
    "id": { "type": "string" },
    "class_id": { "type": "string" },
    "view": { "type": "string" },
    "css_vars": { "type": "object" },
    "dom": { "type": "object" },
    "mesh_hooks": { "type": "object" },
    "gpu_svg3d": { "type": "object" }
  }
}
```

### 2.10 SRP Class Example

```json
{
  "@id": "asx://srp/demo.class.v1",
  "@type": "srp.class.v1",
  "@version": "1.0.0",
  "@status": "frozen",
  "name": "demo.toggle_active",
  "state": { "status": "inactive" },
  "invariants": [
    { "path": "state.status", "enum": ["inactive", "active"] }
  ],
  "directives": [
    {
      "id": "d1",
      "order": 0,
      "when": { "@eq": [{ "@ref": "state.status" }, "inactive"] },
      "emit_delta": { "set": [["state.status", "active"]] }
    },
    {
      "id": "d2",
      "order": 1,
      "when": { "@eq": [{ "@ref": "state.status" }, "active"] },
      "emit_projection": {
        "@type": "srp.projection.v1",
        "id": "p_demo_active",
        "class_id": "asx://srp/demo.class.v1",
        "view": "active",
        "css_vars": { "--asx-view": "active" },
        "dom": { "blocks": [{ "type": "card", "state": "active" }] }
      }
    }
  ]
}
```

### 2.11 SRP Replay Verifier v1

**Law:**
> Same event log → same projection hash

```json
{
  "@id": "asx://srp/replay_verifier.v1",
  "hash": "sha256",
  "canonicalization": "json:sort_keys,separators(',',':')",
  "chain_rule": "H0 = '00..00'(64 hex); Hn = sha256(H(n-1) + '|' + canon(obj_n))",
  "objects_in_chain": ["srp.event.v1", "srp.delta.v1", "srp.projection.v1"]
}
```

### 2.12 SRP REST Mesh Routes

```json
{
  "routes": [
    { "method": "POST", "path": "/srp/submit", "in": "srp.event.v1" },
    { "method": "POST", "path": "/srp/tick", "in": "srp.tick.request.v1" },
    { "method": "POST", "path": "/srp/project", "in": "srp.project.request.v1" },
    { "method": "POST", "path": "/srp/verify", "in": "srp.verify.request.v1" }
  ]
}
```

### 2.13 SRP Formal Bindings

| Binding | Law |
|---------|-----|
| **SRP↔XCFE** | directive.when is XCFE-pure predicate. Multiple matching directives collapse in stable order. |
| **SRP→CSS** | projection.css_vars → :root variables. projection.view → .asx-view-{view} class. |
| **SRP→MeshChain** | projection.mesh_hooks → MeshChain envelope queue. |
| **SRP→GPU/SVG-3D** | projection.gpu_svg3d → declarative scene ops. |

---

## 3. XCFE Execution Phases

ASX-R execution flows through four deterministic phases:

| Phase | Glyph | Purpose |
|-------|-------|---------|
| **@Pop** | `⟁Pop⟁` | Populate - Load data, initialize state |
| **@Wo** | `⟁Wo⟁` | Work - Transform, compute, process |
| **@Sek** | `⟁Sek⟁` | Seek - Query, filter, search |
| **@Collapse** | `⟁Collapse⟁` | Collapse - Finalize, commit, output |

**XCFE + SRP Integration:**

| XCFE Phase | SRP Kernel Phase |
|------------|------------------|
| @Pop | submit (perceive events) |
| @Wo | tick + collapse (apply directives) |
| @Sek | (internal directive matching) |
| @Collapse | project + verify (emit + seal) |

---

## 4. π⊗XCFE Unified Control Field

### 4.1 Control Vectors

| Vector | Type | Description |
|--------|------|-------------|
| `@law` | law_id | Authoritative law identity |
| `@phase` | phase_id | Current execution phase |
| `@allow` | capability[] | Permitted operations |
| `@deny` | capability[] | Forbidden operations |
| `@barrier` | barrier_state | Synchronization locks |
| `@scope` | string | Authority domain |
| `@entropy` | entropy_mode | Alias/cipher allowance |
| `@runtime` | runtime_lane | CPU/GPU/TPU/IO lanes |

### 4.2 XCFE Law Envelope

```json
{
  "@xcfe": {
    "@law": "law.pi_xcfe.srp_runtime.v1",
    "@phase": "pi_act",
    "@allow": ["dom", "ui", "svg", "audit", "effect", "srp"],
    "@deny": ["network", "crypto", "cluster"],
    "@scope": "ui:app",
    "@barrier": "idle",
    "@entropy": "static",
    "@runtime": "browser_cpu"
  }
}
```

---

## 5. SRP Conformance Vectors

### 5.1 Pass Vector: Toggle Active

```json
{
  "id": "SRP_OK_TOGGLE_ACTIVE",
  "h0": "0000000000000000000000000000000000000000000000000000000000000000",
  "chain": [
    { "@type": "srp.event.v1", "id": "e1", "kind": "submit", "ts": 1890000012300, "class_id": "asx://srp/demo.class.v1", "payload": { "intent": "click" } },
    { "@type": "srp.delta.v1", "id": "x1", "from_event": "e1", "ops": [["set", "state.status", "active"]] },
    { "@type": "srp.projection.v1", "id": "p1", "class_id": "asx://srp/demo.class.v1", "view": "active", "css_vars": { "--asx-view": "active" } }
  ],
  "expect": { "ok": true, "last_hash": "789959ba5bf7ecb7e2f901e8ac9bfe20d7078bed8a5b07535e8d9cf89405c3a5" }
}
```

### 5.2 Fail Vector: Invariant Violation

```json
{
  "id": "SRP_FAIL_INVARIANT",
  "chain": [
    { "@type": "srp.event.v1", "id": "e_bad", "kind": "submit", "ts": 1890000012310, "class_id": "asx://srp/demo.class.v1", "payload": { "intent": "force_bad_state" } },
    { "@type": "srp.delta.v1", "id": "x_bad", "from_event": "e_bad", "ops": [["set", "state.status", "banana"]] }
  ],
  "expect": { "ok": false, "errors_any": ["SRP_INVARIANT_VIOLATION"] }
}
```

### 5.3 Error Codes

| Code | Meaning |
|------|---------|
| `SRP_SCHEMA_INVALID` | Object failed schema validation |
| `SRP_INVARIANT_VIOLATION` | Delta violates class invariant |
| `SRP_VERIFY_BAD_TYPE` | Object type not in hash chain allowlist |
| `SRP_VERIFY_HASH_MISMATCH` | Replay hash doesn't match claimed |

---

## 6. Runnable SRP Kernel

### 6.1 Kernel Files

| File | Purpose |
|------|---------|
| `core/SRP_KERNEL_MIN.js` | Runnable SRP kernel (<200 lines) |
| `schemas/SRP_PACK_v1.json` | Single source of truth (locked fold) |
| `ui/srp-demo.html` | Demo: slider → CSS → GPU → MeshChain |

### 6.2 Kernel API

```javascript
// Boot with class definition
SRP.boot(classDef);

// Submit event
SRP.submit({ event_type: 'ui/slider', payload: { value: 0.5 } });

// Advance tick (triggers reduce → project)
SRP.tick();

// Verify replay determinism
SRP.verifyReplay();

// Attach WebGL GPU bridge
SRP.attachGPU(canvasElement);
```

### 6.3 10-Line Harness (Proof It Works)

```javascript
SRP.boot({ slider: 0 });
SRP.submit({ event_type: 'ui/slider', payload: { value: 0.42 } });
SRP.tick();
console.log(SRP.state); // { slider: 0.42, tick: 1, ... }
```

### 6.4 Demo: Slider → CSS → GPU → MeshChain

Open `ui/srp-demo.html`:

1. Slider updates `--srp_slider` on `:root`
2. WebGL triangle rotates deterministically from `/slider`
3. Threshold crossing (>0.7) mints via MeshChain stub
4. "Verify replay" recomputes hash chain and matches

### 6.5 Projection Targets

| Target | How |
|--------|-----|
| **CSS** | `:root` CSS variables (`--srp_slider`, `--srp_tick`, etc.) |
| **GPU** | `SRP.attachGPU(canvas)` → WebGL triangle rotation |
| **MeshChain** | `SRP._meshMint()` stub with deterministic receipt |
| **Hash Chain** | `SRP.lastProjectionHash` updated on each projection |

---

## 7. Integration with Existing ASX-R v1 Features

### 7.1 Inference Plane + SRP

Inference requests can be modeled as SRP events:

```json
{
  "@type": "srp.event.v1",
  "id": "evt_infer_001",
  "kind": "submit",
  "ts": 1735570800000,
  "class_id": "asx://srp/inference.class.v1",
  "payload": {
    "intent": "chat",
    "prompt": "Hello",
    "model": "gpt-4o-mini"
  }
}
```

### 7.2 Image Inference + SRP

Image operations follow the same pattern:

```json
{
  "@type": "srp.event.v1",
  "id": "evt_image_001",
  "kind": "submit",
  "class_id": "asx://srp/image.class.v1",
  "payload": {
    "intent": "generate",
    "prompt": "A sunset over mountains",
    "model": "janus-pro-7b"
  }
}
```

### 7.3 KQL + SRP

Storage queries emit via SRP:

```json
{
  "id": "d_kql_load",
  "when": { "@eq": [{ "@ref": "intent" }, "load_history"] },
  "emit_delta": {
    "ops": [
      ["idb.kql", "ctx", "⟁LOAD⟁ ⟁EVENTS⟁ \"chat\" ⟁LIMIT⟁ 25"]
    ]
  }
}
```

---

## 8. Final Law Statement

> **PHP preprocesses requests.**
> **SRP preprocesses reality.**

SRP is the always-active preprocessor that collapses structured control directives into the next lawful OS state, then projects that state into UI and IO surfaces. It replaces imperative handlers with deterministic fold transitions.

---

## 9. Schema Files Reference

### 9.1 SRP Single Source of Truth (v2)

| File | $id | Role |
|------|-----|------|
| `schemas/SRP_PACK_v1.json` | `asx://fold/srp.pack.v1` | **Single canonical fold** |

**All SRP schemas are embedded in `SRP_PACK_v1.json`:**

- `asx://schema/srp.class.v1`
- `asx://schema/srp.event.v1`
- `asx://schema/srp.directive.v1`
- `asx://schema/srp.delta.v1`
- `asx://schema/srp.projection.v1`

**No individual schema files.** The pack is the law.

### 9.2 Progress Tracking Schemas

| File | $id |
|------|-----|
| `progress-phases.schema.json` | `asx://schema/progress-phases.v1` |

### 9.3 Inherited from v1

All schemas from ASX-R v1 remain valid:

- Core schemas (asx-block, execution-trace, scxq2-packet)
- Inference plane schemas
- Image inference plane schemas
- XCFE schemas
- π schemas

---

## 10. Compatibility

### 10.1 Migration from v1

ASX-R v2 is **backwards compatible** with v1:

- All v1 blocks remain valid
- All v1 execution traces remain valid
- SRP is **additive** — existing code continues to work

### 10.2 SRP Adoption Path

1. **Phase 1:** Use existing ASX-R v1 code
2. **Phase 2:** Add SRP classes for new features
3. **Phase 3:** Migrate existing state logic to SRP directives
4. **Phase 4:** Full SRP-native development

---

## Appendix A: Quick Reference

### A.1 SRP One-Liner

> **SRP is the always-on OS preprocessor that collapses structured control directives into lawful state transitions, then projects that state into UI and IO surfaces.**

### A.2 SRP vs Frameworks

```
Framework:  onClick={() => setState({ active: true })}
SRP:        { "@if": { "path": "active", "eq": false }, "@then": { "@set": { "path": "active", "value": true } } }
```

### A.3 Hash Chain Formula

```
H0 = '00..00' (64 hex zeros)
Hn = sha256(H(n-1) + '|' + canon(obj_n))
```

---

**End of ASX-R v2 Specification**

🔒 **This specification is frozen.** Changes require a new version.
