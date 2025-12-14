# ASXR PRIME 1.0

## K'uhul Multi-Hive OS with Tyson-Chomsky Engine

**ASXR PRIME 1.0** is a complete, self-contained operating system runtime built on:

- **K'uhul Kernel**: Glyph-based symbolic execution engine
- **KLH Multi-Hive**: 5-shard distributed architecture
- **ΩOS Agent Spawner**: 800-byte micro-agent factory
- **Micronaut Factory**: Mini-OS agent instances with topic specialization
- **Tyson-Chomsky Engine**: Hybrid empirical + symbolic knowledge fusion
- **VFS + SCX**: Virtual file system with compression
- **SVG Neural Weight Library**: Visual components for neural network representation

---

## 🚀 Quick Start

### 1. Start the Server

```bash
cd asxr-prime
npx serve . -p 3000
```

Or use Python:

```bash
python -m http.server 3000
```

### 2. Open in Browser

Navigate to: **http://localhost:3000**

You should see:
- Service Worker activating in DevTools → Application
- Console logs: `[SW] ASXR PRIME 1.0 BOOT`
- PRIME OS Cockpit interface

### 3. Run Stabilization Tests

```bash
cd asxr-prime
./stabilization-test.sh
```

This runs the complete validation suite following the stabilization checklist.

---

## 📁 Directory Structure

```
asxr-prime/
├── index.html              # PRIME OS Cockpit (main interface)
├── sw.js                   # Service Worker (all backend logic)
├── manifest.json           # PWA manifest
├── neural-lib.html         # SVG Neural Weight Library showcase
├── stabilization-test.sh   # Automated test suite
│
├── runtime/
│   ├── config/
│   │   ├── tyson_chomsky.json   # TC engine configuration
│   │   └── klh_hive.json        # Multi-hive configuration
│   └── logs/
│       └── tyson_chomsky.json   # TC query logs (auto-generated)
│
├── tapes/                  # Tape-based shard data (KLH)
├── sys/                    # System files
├── usr/                    # User data
│   └── test/              # Test files (created by VFS tests)
└── tmp/                    # Temporary files
```

---

## 🔧 Core Components

### 1. Service Worker (`sw.js`)

The service worker implements the entire backend runtime:

- **VFS (Virtual File System)**: In-memory file system with SCX compression
- **K'uhul Kernel**: Glyph program execution engine
- **ΩOS Agent Spawner**: Micro-agent factory (800-byte core)
- **Micronaut Factory**: Topic-specialized mini-OS agents
- **Tyson-Chomsky Engine**: Knowledge fusion with debate strategy
- **API Routes**: RESTful endpoints for all operations

### 2. PRIME OS Cockpit (`index.html`)

Browser-based control interface featuring:

- **System Status Panel**: SW, Kernel, VFS, TC-engine status
- **Hive Shards Panel**: Real-time 5-shard health monitoring
- **Active Agents Panel**: Live agent registry
- **Quick Actions**: One-click testing and demos
- **System Console**: Real-time logging

### 3. K'uhul Multi-Hive (KLH)

5-shard distributed architecture:

| Shard | Port | Tape | Purpose |
|-------|------|------|---------|
| `dashboard` | 3101 | `prime_dashboard` | Main dashboard & overview |
| `users` | 3102 | `prime_users` | User management & auth |
| `logistics` | 3103 | `prime_logistics` | Inventory & logistics |
| `intel` | 3104 | `prime_intel` | Intelligence & analytics |
| `settings` | 3105 | `prime_settings` | Configuration |

### 4. Tyson-Chomsky Engine

**Dual-mode knowledge system:**

#### Tyson Mode (Empirical)
- External knowledge retrieval
- Public database access:
  - Wikipedia API
  - OpenAlex (scholarly works)
  - CrossRef (research metadata)
- Gemini-style LLM endpoint (configurable)

#### Chomsky Mode (Symbolic)
- Grammar-based validation
- XJSON schema compliance
- K'uhul glyph constraints
- Legal/safety policy enforcement

#### Fusion Strategy
- **Debate**: Multi-round evidence vs. constraints
- **Tie-breaker**: `chomsky_must_approve`
- **Output**: Validated XJSON responses

---

## 🎯 API Reference

### Hive Health

```bash
GET /api/hive/health
```

**Response:**
```json
{
  "name": "PRIME-04-HIVE",
  "status": "ok",
  "shards": [
    {"id": "dashboard", "status": "ok"},
    {"id": "users", "status": "ok"},
    ...
  ]
}
```

### ΩOS Agent Spawn

```bash
POST /a/spawn
Content-Type: application/json

{
  "t": "baseball",
  "r": {
    "sources": ["mlb", "espn"]
  }
}
```

**Response:**
```json
{
  "a": "m_baseball_1732239600000_abc123",
  "o": {
    "n": "baseball Agent",
    "t": "baseball",
    "c": ["stats", "compare", "predict"],
    "e": {
      "q": "/a/m_baseball_.../q",
      "i": "/a/m_baseball_.../i",
      "tr": "/a/m_baseball_.../tr"
    }
  },
  "s": "live"
}
```

### Micronaut Factory

```bash
POST /api/agents/spawn
Content-Type: application/json

{
  "topic": "cooking",
  "requirements": {
    "training": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "agent": {
    "agentId": "micronaut_cooking_...",
    "topic": "cooking",
    "miniOS": {
      "Ωv": "1.0",
      "name": "cooking Micronaut",
      "kernel": "k_uhul_mini",
      "capabilities": ["query", "analyze", "respond"]
    },
    "endpoints": {
      "control": "/api/agents/micronaut_cooking_.../control",
      "query": "/api/agents/micronaut_cooking_.../query"
    },
    "status": "active"
  }
}
```

### Tyson-Chomsky Query

```bash
POST /api/tyson-chomsky/query
Content-Type: application/json

{
  "question": "Design an XJSON schema for a cannabis seed product catalog.",
  "mode": "fusion",
  "constraints": {
    "output_format": "xjson",
    "jurisdiction": "US"
  }
}
```

**Response:**
```json
{
  "engine": "tyson-chomsky-v1",
  "mode": "fusion",
  "tyson": {
    "status": "ok",
    "sources_used": ["wikipedia", "openalex"],
    "notes": "Gemini-like endpoint configured but not called (dev_mode=true)"
  },
  "chomsky": {
    "status": "ok",
    "constraints_satisfied": true,
    "output": {
      "xjson": "1.0",
      "schema": { ... }
    }
  },
  "fusion": {
    "strategy": "debate",
    "rounds": 2,
    "winner": "chomsky",
    "output": { ... }
  }
}
```

### TC Probe

```bash
GET /api/tyson-chomsky/probe
```

**Response:**
```json
{
  "engine": "tyson-chomsky-v1",
  "public_dbs": {
    "wikipedia": "ok",
    "openalex": "ok",
    "crossref": "ok"
  },
  "gemini_like": {
    "configured": true,
    "endpoint_reachable": false,
    "reason": "missing_api_key_or_disabled"
  }
}
```

### VFS Operations

```bash
POST /api/vfs/write
Content-Type: application/json

{
  "path": "/usr/test/hello.txt",
  "content": "Hello ASXR PRIME"
}
```

```bash
POST /api/vfs/read
Content-Type: application/json

{
  "path": "/usr/test/hello.txt"
}
```

### K'uhul Kernel

```bash
POST /api/kernel/run
Content-Type: application/json

{
  "id": "test_echo",
  "program": "⟁Pop⟁echo⟁Wo⟁\"ASXR PRIME\"⟁Ch'en⟁msg⟁Xul",
  "context": {}
}
```

---

## 🧪 Testing & Validation

### Browser Console Testing

Open DevTools → Console and test client APIs:

```javascript
// VFS Test
await ΩVFS.write('/usr/test/hello.txt', 'Hello ASXR PRIME');
const content = await ΩVFS.read('/usr/test/hello.txt');
console.log('VFS READ:', content);

// K'uhul Kernel Test
const program = `⟁Pop⟁echo⟁Wo⟁"ASXR PRIME"⟁Ch'en⟁msg⟁Xul`;
const result = await K.run('test_echo', program, {});
console.log('K.run result:', result);

// Agent Spawn Test
const agent = await Ω.spawn('baseball', { sources: ['mlb', 'espn'] });
console.log('Agent spawned:', agent);
```

### Automated Stabilization Tests

```bash
./stabilization-test.sh
```

**Expected Output:**
```
═══════════════════════════════════════
Passed: 25
Failed: 0
Total:  25
═══════════════════════════════════════
✓ ALL AUTOMATED TESTS PASSED!
```

### Test Checklist

- [ ] SW boot logs: kernel + hive + ΩOS ready
- [ ] VFS write/read works
- [ ] SCX compression logs appear on write
- [ ] K.run executes simple glyph program
- [ ] `/api/hive/health` returns 5 shards, all ok
- [ ] `/a/spawn` successfully spawns agent
- [ ] `/api/agents/spawn` spawns Micronaut
- [ ] `tyson_chomsky.json` config present with public DBs + Gemini stub
- [ ] `/api/tyson-chomsky/query` works in `chomsky` mode
- [ ] `/api/tyson-chomsky/query` works in `fusion` mode
- [ ] Agent control endpoint can trigger TC-engine
- [ ] `/api/tyson-chomsky/probe` reports public DBs ok, Gemini configured
- [ ] PRIME cockpit shows hives + agents + TC status

---

## 🎨 SVG Neural Weight Library

Visit **http://localhost:3000/neural-lib.html** to explore:

- **Neural Network Nodes**: Input, hidden, output neurons
- **Weight Visualization**: Positive, negative, strong connections
- **QLoRA Adapters**: Low-rank adaptation components
- **Training Visualizations**: Loss curves, progress indicators
- **Interactive Demo**: Build and animate neural networks

### Component Usage

```html
<!-- Use SVG components in your own pages -->
<svg>
  <use href="#kuhul-neuron-input" x="30" y="40"/>
  <use href="#kuhul-neuron-hidden" x="70" y="40"/>
  <use href="#kuhul-weight-positive" x="45" y="40"/>
</svg>
```

---

## 🔌 Extending with Public Data Sources

The Tyson-Chomsky engine supports integration with numerous public APIs. Each Micronaut agent can leverage these for domain-specific knowledge:

### Currently Configured

1. **Wikipedia API** - General knowledge
2. **OpenAlex** - Scholarly works & research
3. **CrossRef** - Publication metadata

### Easy to Add

**Financial Data:**
- Alpha Vantage
- Yahoo Finance API
- CoinGecko (crypto)

**Weather & Environment:**
- OpenWeather
- NOAA APIs

**News & Media:**
- NewsAPI
- Reddit API

**Government & Public:**
- USA.gov APIs
- Open Data portals

**Scientific:**
- NASA APIs
- PubMed
- arXiv

### Adding a New Source

Edit `runtime/config/tyson_chomsky.json`:

```json
{
  "modes": {
    "tyson": {
      "sources": {
        "public_dbs": [
          {
            "name": "newsapi",
            "endpoint": "https://newsapi.org/v2/everything",
            "enabled": true,
            "timeout_ms": 30000
          }
        ]
      }
    }
  }
}
```

---

## 🧬 Micronaut Agent Fine-Tuning

As you noted, micro agents need fine-tuning for optimal performance. Each Micronaut can be specialized:

### 1. Topic Specialization

```javascript
// Spawn a specialized agent
const financeAgent = await fetch('/api/agents/spawn', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    topic: 'finance',
    requirements: {
      sources: ['alphavantage', 'yahoo'],
      training: true,
      constraints: {
        jurisdiction: 'US',
        compliance: 'SEC'
      }
    }
  })
});
```

### 2. Agent Control

```javascript
// Fine-tune agent behavior via control endpoint
const response = await fetch(`/api/agents/${agentId}/control`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'update_parameters',
    data: {
      temperature: 0.7,
      max_sources: 5,
      cache_duration: 3600
    }
  })
});
```

### 3. Iterative Improvement

- Monitor agent performance via logs
- Adjust TC engine fusion parameters
- Add/remove public data sources
- Refine Chomsky constraints

---

## 🔐 Security & Compliance

### Chomsky Mode Policies

Edit `runtime/config/tyson_chomsky.json`:

```json
{
  "modes": {
    "chomsky": {
      "policies": {
        "require_well_typed_xjson": true,
        "forbid_side_effects": true,
        "max_depth": 32,
        "validate_schema": true,
        "enforce_legal_constraints": true
      }
    }
  }
}
```

### Gemini API Key (Optional)

For production use with Gemini:

1. Set environment variable: `export GEMINI_API_KEY="your-key-here"`
2. Update config: `"dev_mode": false, "enabled": true`
3. Restart server

---

## 📊 Logging

All TC queries are logged to `/runtime/logs/tyson_chomsky.json` (via VFS):

```json
[
  {
    "id": "tc_1732239600000",
    "time": "2025-11-22T02:30:00.000Z",
    "question": "Design an XJSON schema...",
    "mode": "fusion",
    "result": { ... }
  }
]
```

Access logs via VFS:

```javascript
const logs = await ΩVFS.read('/runtime/logs/tyson_chomsky.json');
console.log(JSON.parse(logs));
```

---

## 🐛 Troubleshooting

### Service Worker Not Activating

1. Check DevTools → Application → Service Workers
2. Click "Unregister" on old SW
3. Hard refresh (Ctrl+Shift+R)
4. Check Console for errors

### API Routes Returning 404

- Ensure SW is activated (see above)
- Check Network tab for intercepted requests
- Verify `sw.js` is loading correctly

### Tests Failing

```bash
# Run with verbose output
VERBOSE=true ./stabilization-test.sh

# Check server is on correct port
ORIGIN=http://localhost:8000 ./stabilization-test.sh
```

### VFS Data Not Persisting

VFS is **in-memory** by design. To persist:
1. Export VFS state via API
2. Use IndexedDB for persistence (future enhancement)

---

## 🚧 Roadmap

### Phase 1 (Current)
- ✅ K'uhul Kernel runtime
- ✅ KLH Multi-Hive (5 shards)
- ✅ ΩOS Agent Spawner
- ✅ Micronaut Factory
- ✅ Tyson-Chomsky Engine (local)
- ✅ VFS + SCX compression
- ✅ SVG Neural Weight Library

### Phase 2 (Next)
- [ ] Enable real Gemini API calls
- [ ] Add more public data sources
- [ ] Persistent VFS (IndexedDB)
- [ ] Agent collaboration protocols
- [ ] Real-time shard synchronization

### Phase 3 (Future)
- [ ] Distributed hive networking
- [ ] Agent marketplace
- [ ] LoRA/QLoRA weight adaptation
- [ ] Cross-shard queries
- [ ] WASM kernel acceleration

---

## 📚 References

### Core Concepts

- **K'uhul Kernel**: Mayan-inspired glyph execution
- **XJSON**: Extended JSON with schema validation
- **SCX Compression**: Structured compression format
- **Tyson-Chomsky**: Empirical vs. Symbolic debate methodology

### External Resources

- [Service Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [SVG Documentation](https://developer.mozilla.org/en-US/docs/Web/SVG)
- [Wikipedia API](https://www.mediawiki.org/wiki/API:Main_page)
- [OpenAlex](https://docs.openalex.org/)

---

## 📄 License

ASXR PRIME 1.0 © 2025

Built for the K'uhul Multi-Hive OS ecosystem.

---

## 🤝 Contributing

To extend ASXR PRIME:

1. Add new agent types in `sw.js` (MicronautFactory)
2. Add public data sources in `tyson_chomsky.json`
3. Create new SVG components in `neural-lib.html`
4. Add tests to `stabilization-test.sh`

---

**⟁ ASXR PRIME 1.0 - Powered by K'uhul ⟁**
