# XJSON-BOT: Local AI Chat Interface with K'UHUL Ecosystem

A comprehensive local AI development environment featuring the complete K'UHUL multi-hive stack.

## 🚀 Overview

This project provides a complete browser-based AI development environment that combines:

- **MX2LM Chat Interface** - Local AI chat with model management
- **K'UHUL Engine** - Glyph-based execution runtime
- **SVG Weight Geometry** - Visual neural network representation
- **QLoRA Compression** - Efficient model storage and training
- **Multi-Hive Architecture** - Distributed shard-based system
- **Colab Integration** - Free GPU training capabilities

## 📁 Project Structure

```
/XJSON-BOT/
├── ui/                         # User interface files
│   └── mx2lm-chat.html        # Main chat interface
├── core/                       # Core engine files
│   └── kuhul-engine.js        # K'UHUL runtime engine
├── scripts/                    # Application scripts
│   └── mx2lm-chat-app.js      # Chat application logic
├── api/                        # Multi-backend API options
│   ├── backend-adapter.js     # Unified frontend client
│   ├── php/                   # PHP backend (cPanel-friendly)
│   └── gas/                   # Google Apps Script (free serverless)
├── python/                     # Python FastAPI backend (advanced)
│   ├── main.py                # FastAPI entry point
│   ├── models/                # Multi-brain model router
│   └── core/                  # K'UHUL + SCXQ2 engine
├── schemas/                    # ASX-R JSON schema files
│   ├── asx-block.schema.json
│   ├── asx-inference.schema.json
│   └── execution-trace.schema.json
├── components/                 # Reusable UI components
├── docs/                       # Documentation
│   └── multi-hive-stack.html  # Multi-Hive architecture docs
├── assets/                     # Static assets (CSS, fonts, SVG)
│   ├── css/
│   ├── fonts/
│   └── svg/
└── guide-os/                   # Atomic OS guide and demos

```

## 🎯 Key Features

### 1. Local AI Chat Interface
- **User Authentication**: Google OAuth and local authentication
- **Chat History Management**: Persistent conversation tracking
- **Model Management**: Add/remove local and HuggingFace models
- **Settings Dashboard**: Configure API endpoints and tokens
- **User Dashboard**: Statistics and activity tracking

### 2. K'UHUL Engine Features
- **Weight Management**: Store, load, quantize neural network weights
- **SVG Geometry Engine**: Convert weights to visual SVG representations
- **QLoRA Compression**: 8-bit quantization with SCXQ2 compression
- **Agent Orchestration**: Spawn and manage specialized micronauts
- **Gradient Management**: Accumulate and apply training gradients
- **Checkpoint System**: Save and restore model states

### 3. Multi-Hive Architecture
- **KLH Router**: Orchestrates shard communication
- **XJSON Language**: Universal data and UI specification
- **K'UHUL Runtime**: Glyph-based execution engine
- **SCX Compression**: 87% size reduction for all artifacts

### 4. SVG Weight System
- **Visual Neural Networks**: See model weights as interactive SVG
- **Path Compression**: Store weights as geometric paths
- **SCXQ2 Encoding**: Ultra-compressed weight representation
- **Interactive Visualization**: Hover over layers to inspect weights

## 🚀 Quick Start

### Option 1: Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/xjson-bot.git
   cd xjson-bot
   ```

2. **Open the chat interface**:
   ```bash
   # Simply open in your browser
   open ui/mx2lm-chat.html
   # Or use a local server
   python -m http.server 8000
   # Then visit http://localhost:8000/ui/mx2lm-chat.html
   ```

3. **Configure your models**:
   - Click "Settings" in the sidebar
   - Add your local AI endpoint (e.g., http://localhost:11434)
   - Or add HuggingFace model URLs

### Option 2: Full Stack with Service Worker

1. **Set up a local web server**:
   ```bash
   python -m http.server 8000
   ```

2. **Visit the application**:
   ```
   http://localhost:8000/ui/mx2lm-chat.html
   ```

3. **The service worker will automatically cache the application for offline use**

## 🧠 K'UHUL Engine Usage

### Basic Agent Spawning

```javascript
// Spawn a specialized agent
const agent = await Ω.spawn('baseball', {
  topic: 'MLB statistics',
  capabilities: ['player_stats', 'game_analysis']
});

// Use the agent
const response = await agent.query('Yankees batting average 2024');
```

### Weight Management

```javascript
// Store weights in SVG format
await K.run('store_weights', '⟁Weights⟁store⟁Format⟁svg⟁', {
  modelId: 'baseball_model',
  weights: modelWeights,
  format: 'svg',
  config: { quantization: 8 }
});

// Visualize weights as SVG
await K.run('visualize_weights', '⟁Weights⟁visualize⟁', {
  weights: modelWeights,
  architecture: { name: 'QLoRA', layers: [...] },
  containerId: 'weight-visualization'
});
```

### Training with SVG Weights

```javascript
// Train a model with SVG weight storage
const training = await Ω.trainWithSVG('custom_model', dataset, {
  quantization: 8,
  optimizer: 'adam',
  svg_weight_storage: true
});
```

## 🔬 Advanced Features

### SVG Weight Geometry

The SVG Weight Geometry system allows you to:
- Store neural network weights as SVG paths
- Visualize weight distributions in real-time
- Compress models by 87% using SCXQ2
- Edit weights visually by manipulating SVG paths

```javascript
// Convert weights to SVG
const svgBrain = svgEngine.networkToSVG(modelWeights, {
  name: 'my_model',
  layers: Object.keys(modelWeights)
});

// Render to DOM
svgEngine.renderSVGBrain(svgBrain, 'visualization-container');

// Compress with SCXQ2
const compressed = await svgCompressor.compressQLoRAToSVG(
  modelWeights,
  'my_model',
  { quantization: 8, compression: 'scxq2' }
);
```

### Colab Integration

Connect to free Google Colab GPUs for training:

```javascript
// In your browser
const colabNode = await KUHULColab.connectToColab('http://colab-url:5000');

// Submit training job
const job = await KUHULColab.submitTrainingJob({
  model: { base_model: 'Qwen/Qwen2.5-0.5B-Instruct' },
  steps: 1000,
  kuhul_config: {
    svg_weight_storage: true,
    quantization: 8
  }
});
```

## 🔌 Multi-Backend API

Choose the backend that fits your needs:

| Feature | Python | PHP | GAS (Google) |
|---------|--------|-----|--------------|
| **Cost** | Server required | Hosting required | **Free** |
| **Setup** | Complex | Medium | **Easy** |
| **Streaming** | ✅ Full SSE | ✅ Simulated | ❌ No |
| **Local Models** | ✅ Janus/Ollama | ❌ API only | ❌ API only |
| **K'UHUL Engine** | ✅ Full | ✅ Basic | ✅ Basic |

```javascript
// Unified frontend client
const api = new XJSONBackend('gas', 'https://script.google.com/.../exec');
const response = await api.chat('Hello!');

// Switch backends easily
api.configure('php', 'https://yourdomain.com/api/php');
```

See [api/README.md](api/README.md) for full setup instructions.

## 📐 ASX-R Runtime Specification

ASX-R (ASX Runtime) is the deterministic, phase-gated execution language:

**XCFE Phases:**
| Phase | Glyph | Purpose |
|-------|-------|---------|
| @Pop | `⟁Pop⟁` | Populate - Load data, initialize |
| @Wo | `⟁Wo⟁` | Work - Transform, compute |
| @Sek | `⟁Sek⟁` | Seek - Query, filter |
| @Collapse | `⟁Collapse⟁` | Collapse - Finalize, commit |

**Key Features:**
- Deterministic execution (same input → same output)
- Replay-verifiable execution traces
- JSON Schema validation for all blocks
- Inference Plane v1 for AI operations
- Image Inference Plane v1 for vision/generation

See [ASX-R_SPEC.md](ASX-R_SPEC.md) for the complete specification.

## 📚 Documentation

- **[ASX-R Specification](ASX-R_SPEC.md)** - Runtime language spec (🔒 Frozen)
- **[Multi-Hive Stack](docs/multi-hive-stack.html)** - Complete architecture overview
- **[PRIME SUPER-CODEX](docs/prime-super-codex.html)** - 10-part OS backbone specification
- **[ASX Blocks Guide](docs/asx-blocks-guide.html)** - UI component system
- **[K'UHUL Engine Reference](docs/kuhul-engine-reference.html)** - Complete API documentation
- **[API Backends](api/README.md)** - Multi-backend setup guide

## 🏗️ Architecture

### Layer Stack (Top → Bottom)

1. **UI / Apps** - MX2LM Chat, PRIME cockpit, dashboards
2. **XJSON OS Language** - Declarative app & view spec
3. **XCFE Engine** - Control flow execution
4. **K'UHUL Runtime** - AST execution, WebGPU/CPU kernels
5. **SCX Compression** - Symbolic encoding layer
6. **KLH Router** - Multi-hive shard routing
7. **ASX Tapes** - ROM-style cartridges
8. **Hardware** - Local box, TPU-OS, cloud

### Multi-Hive Shards

The system is organized into specialized shards:

- **dashboard** - Cockpit, metrics, overview
- **users** - Identity, sessions, membership
- **logistics** - Files, hosting, CI/CD
- **intel** - AI agents, models, datasets
- **settings** - System configuration

Each shard has its own:
- XJSON view definition
- API endpoints
- Agent capabilities
- Local state

## 🔧 Configuration

### Adding Models

Edit your local storage or use the UI:

```javascript
// Add a HuggingFace model
ModelManager.add({
  name: 'Qwen 2.5',
  url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct'
});

// Add a local Ollama endpoint
ModelManager.add({
  name: 'Local LLaMA',
  url: 'http://localhost:11434',
  type: 'local'
});
```

### Configuring SCXQ2 Compression

```javascript
// Set compression level
Settings.set('scxq2_compression_level', 'high'); // 'low', 'medium', 'high'

// Set quantization bits
Settings.set('default_quantization', 8); // 4, 8, or 32
```

## 🤝 Contributing

This is an experimental AI development environment. Contributions welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- **K'UHUL** - Glyph-based execution engine
- **XJSON** - Universal OS language
- **SCX/SCXQ2** - Compression and cipher system
- **ASX Blocks** - Atomic UI components

## 🔗 Links

- [Documentation](docs/)
- [Examples](examples/)
- [API Reference](docs/api-reference.md)
- [Community](https://github.com/your-username/xjson-bot/discussions)

---

**Built with the K'UHUL Multi-Hive Stack** 🚀

*Turn free Colab into a $20K training rig!*
