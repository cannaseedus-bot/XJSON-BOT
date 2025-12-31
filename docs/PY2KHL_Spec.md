# PY2KHL Intent Collapser Specification

**Version:** 1.0.0
**Status:** Active
**Module:** `python/py2khl.py`

---

## Overview

PY2KHL is a **semantic reducer** that extracts intent from Python scripts and collapses them into deterministic, browser-runnable `*.khl` files.

**NOT a transpiler. NOT a VM. A lawful intent collapser.**

```
Python Source
     ↓
Python AST
     ↓
Intent Graph (side-effect classified)
     ↓
ASX-R Fold Mapping
     ↓
K'UHUL π Emission
     ↓
Verified *.khl
```

---

## Core Principle

> **Python → KHL is not transpiling code**
> **It's collapsing intent into a lawful runtime fold**

Python scripts already obey:
- Ordered execution
- Pure transforms
- Explicit IO
- Loops + conditionals
- Deterministic data shaping

This maps perfectly to ASX-R XCFE phases.

---

## Phase Mapping

| Python | ASX-R Phase | Purpose |
|--------|-------------|---------|
| imports | ❌ (removed) | No runtime effect |
| globals | `@Wo` | State declaration |
| file IO | `@Pop` | IO boundary |
| loops | `@Sek foreach` | Ordered execution |
| if/else | `XCFE @if/@then/@else` | Conditional |
| functions | inline fold blocks | Reusable logic |
| return | `@Collapse emit` | Final output |

---

## Usage

### CLI

```bash
# Convert Python to KHL
python py2khl.py script.py -o output.khl

# Show AST analysis
python py2khl.py script.py --ast

# Output JSON AST
python py2khl.py script.py --json > program.json

# Strict mode (fail on warnings)
python py2khl.py script.py --strict -o output.khl

# From stdin
echo "x = 1 + 2" | python py2khl.py -
```

### Programmatic

```python
from py2khl import Py2KHL

source = """
for f in files:
    raw = f.read_bytes()
    out[f] = compress(raw)
"""

converter = Py2KHL(source)
graph = converter.convert()

# Get KHL source
khl = graph.to_khl()

# Get JSON AST
ast = graph.to_json()
```

---

## Supported Python Subset (v1)

### ✅ Fully Supported

| Feature | KHL Mapping |
|---------|-------------|
| Assignments | `let x = value` |
| Augmented assignments | `x += 1` |
| Dictionaries | `{key: value}` |
| Lists | `[a, b, c]` |
| For loops | `foreach iter as item` |
| While loops | `while condition` |
| If/elif/else | `@if/@then/@else` |
| Basic math | Same operators |
| String operations | `text.*` intrinsics |
| Hashing | `hash.*` intrinsics |
| Compression | `cc.*` intrinsics |
| JSON output | `emit.json(...)` |
| File IO | `fs.*` intrinsics |

### ❌ Explicitly Rejected

These trigger **hard errors** (lawful):

| Python Feature | Reason |
|----------------|--------|
| `async/await` | Non-deterministic |
| `yield/generators` | Stateful |
| `eval/exec` | Non-deterministic |
| `compile` | Non-deterministic |
| `globals()/locals()` | Reflection |
| `setattr/delattr` | Dynamic mutation |
| `__import__` | Dynamic imports |
| Threads | Non-deterministic |
| Monkey-patching | Unsafe |

---

## Conversion Examples

### 1. File Processing Loop

**Python:**
```python
for f in files:
    raw = f.read_bytes()
    if is_text(f):
        norm = normalize(raw)
        out[f] = compress(norm)
    else:
        out[f] = compress(raw)
```

**KHL:**
```khl
@Sek {
  foreach fs.file as f {
    let raw = f.bytes

    @if mime.of(f.path).startsWith("text/")
    @then {
      let norm = text.normalize(raw)
      files[f.path] = cc.pack(norm)
    }
    @else {
      files[f.path] = cc.pack(raw)
    }
  }
}
```

### 2. State Initialization

**Python:**
```python
stats = {"files": 0, "bytes": 0}
compression = "zlib"
chunk_size = 262144
```

**KHL:**
```khl
@Wo {
  let stats = { files: 0, bytes: 0 }
  let cc.mode = "SCXQ2"
  let cc.chunk = 262144
}
```

### 3. File Scanning

**Python:**
```python
files = Path(root).rglob("*")
```

**KHL:**
```khl
@Pop {
  fs.scan { root: "...", recursive: true }
}
```

### 4. Output

**Python:**
```python
return json.dumps(bundle)
```

**KHL:**
```khl
@Collapse {
  emit.json(bundle)
}
```

---

## Intrinsic Mapping

### File System (`fs.*`)

| Python | KHL |
|--------|-----|
| `open(f).read()` | `fs.read(f)` |
| `Path(f).read_bytes()` | `fs.bytes(f)` |
| `Path(root).rglob("*")` | `fs.scan({ root, recursive: true })` |
| `Path(f).exists()` | `fs.exists(f)` |
| `Path(f).is_file()` | `fs.isFile(f)` |

### Hashing (`hash.*`)

| Python | KHL |
|--------|-----|
| `hashlib.sha256(data).hexdigest()` | `hash.sha256(data)` |
| `hashlib.md5(data).hexdigest()` | `hash.md5(data)` |
| `hashlib.sha1(data).hexdigest()` | `hash.sha1(data)` |

### Compression (`cc.*`)

| Python | KHL |
|--------|-----|
| `zlib.compress(data, level)` | `cc.pack(data, mode, level)` |
| `zlib.decompress(data)` | `cc.unpack(data)` |
| `gzip.compress(data)` | `cc.gzip(data)` |

### Text (`text.*`)

| Python | KHL |
|--------|-----|
| `s.encode('utf-8')` | `text.encode(s)` |
| `b.decode('utf-8')` | `text.decode(b)` |
| `s.strip()` | `text.trim(s)` |
| `s.split(sep)` | `text.split(s, sep)` |
| `sep.join(arr)` | `text.join(arr, sep)` |
| `s.lower()` | `text.lower(s)` |
| `s.upper()` | `text.upper(s)` |

### Path (`path.*`)

| Python | KHL |
|--------|-----|
| `Path(f).suffix` | `path.ext(f)` |
| `Path(f).stem` | `path.stem(f)` |
| `Path(f).name` | `path.name(f)` |
| `Path(f).parent` | `path.parent(f)` |

### MIME (`mime.*`)

| Python | KHL |
|--------|-----|
| `mimetypes.guess_type(f)` | `mime.of(f)` |
| `mime.startswith('text/')` | `mime.isText(f)` |

### Emit (`emit.*`)

| Python | KHL |
|--------|-----|
| `json.dumps(obj)` | `emit.json(obj)` |
| `return value` | `emit.json(value)` |

---

## Intent Graph Structure

The converter produces an `IntentGraph` with four phase lists:

```python
@dataclass
class IntentGraph:
    pop: List[IntentBlock]      # IO operations
    wo: List[IntentBlock]       # State declarations
    sek: List[IntentBlock]      # Execution logic
    collapse: List[IntentBlock] # Output operations
    errors: List[str]           # Conversion errors
    warnings: List[str]         # Conversion warnings
```

Each `IntentBlock`:

```python
@dataclass
class IntentBlock:
    phase: str   # Pop, Wo, Sek, Collapse
    kind: str    # io, state, loop, condition, emit
    source: str  # Original Python source
    khl: str     # Generated KHL code
    line: int    # Source line number
```

---

## JSON AST Format

```json
{
  "@type": "khl-program",
  "@version": "1.0.0",
  "phases": {
    "Pop": [
      { "kind": "io", "khl": "fs.scan {...}", "line": 1 }
    ],
    "Wo": [
      { "kind": "state", "khl": "let stats = {...}", "line": 5 }
    ],
    "Sek": [
      { "kind": "loop", "khl": "foreach fs.file as f {...}", "line": 10 }
    ],
    "Collapse": [
      { "kind": "emit", "khl": "emit.json({...})", "line": 50 }
    ]
  },
  "errors": [],
  "warnings": []
}
```

---

## Error Handling

### Rejection Errors

When unsupported Python features are detected:

```
Line 15: async functions not allowed (non-deterministic)
Line 23: eval() is non-deterministic
Line 42: reflection not allowed
```

### Warnings

Non-critical issues that don't prevent conversion:

```
Line 3: Import stripped: from pathlib import Path
Line 7: Class definitions not yet supported
```

---

## Integration with KUHUL Host

Once converted, KHL programs run in the browser via `KUHUL_JS_HOST_v1`:

```javascript
// Load KHL
const khlSource = await fetch('bundle_builder.khl').then(r => r.text());

// Register
KUHUL.register('bundle_builder', khlSource);

// Execute
const result = await KUHUL.run('bundle_builder', {
  mode: 'upload',
  files: uploadedFiles
});
```

---

## Architecture

```
┌─────────────────────────────┐
│  Python Source (.py)        │
└──────────────┬──────────────┘
               │ ast.parse()
┌──────────────▼──────────────┐
│  Python AST                 │
│  (Module, FunctionDef, etc) │
└──────────────┬──────────────┘
               │ Py2KHL.visit()
┌──────────────▼──────────────┐
│  Intent Graph               │
│  (Pop, Wo, Sek, Collapse)   │
└──────────────┬──────────────┘
               │ IntentGraph.to_khl()
┌──────────────▼──────────────┐
│  KHL Source (.khl)          │
└──────────────┬──────────────┘
               │ KUHUL.register()
┌──────────────▼──────────────┐
│  Browser Execution          │
│  (KUHUL_JS_HOST_v1)         │
└─────────────────────────────┘
```

---

## Why This Works

1. **Python is prototyping** - Write and iterate quickly
2. **KHL is law** - Deterministic, verifiable, portable
3. **JS is wiring** - Events, rendering, IO

Once converted:
- Same input → same output (always)
- Runs in browser, SW, Edge, GAS
- No Python runtime needed
- Replayable and verifiable

---

## Related Files

| File | Purpose |
|------|---------|
| `python/py2khl.py` | Python → KHL converter |
| `core/kuhul-host.js` | Browser execution host |
| `schemas/khl.program.schema.json` | JSON AST schema |
| `ui/khl-runner.html` | Interactive runner UI |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01 | Initial release |

---

*Built with the K'UHUL Multi-Hive Stack*
