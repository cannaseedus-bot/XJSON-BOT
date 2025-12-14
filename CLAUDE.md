# CLAUDE.md - AI Assistant Guide for XJSON-BOT

## Project Overview

**XJSON-BOT** is a comprehensive browser-based local AI development environment featuring the complete K'UHUL multi-hive stack. This project provides AI chat interfaces, neural network weight visualization, model compression, and distributed multi-hive architecture for local AI development and training.

### Core Purpose
- **Local AI Chat Interface** with model management and conversation history
- **K'UHUL Engine** - Glyph-based execution runtime for AI operations
- **SVG Weight Geometry** - Visual representation of neural network weights
- **QLoRA Compression** - Efficient model storage using SCXQ2
- **Multi-Hive Architecture** - Distributed shard-based system
- **Colab Integration** - Connect free GPU resources for training

### Technology Stack
- **Frontend**: Pure HTML5, CSS3, JavaScript (ES6+)
- **Runtime**: K'UHUL Engine (custom glyph-based execution)
- **UI Framework**: ASX Blocks (Atomic UI components)
- **Compression**: SCX/SCXQ2 (Symbolic compression with hazard cipher)
- **Architecture**: Multi-hive shards with KLH Router
- **PWA**: Progressive Web App with service worker support

---

## Repository Structure

```
/XJSON-BOT/
├── index.html                    # Landing page and app launcher
├── manifest.json                 # PWA manifest with K'UHUL capabilities
├── README.md                     # User-facing documentation
├── CLAUDE.md                     # This file - AI assistant guide
│
├── core/                         # Core engine files
│   └── kuhul-engine.js          # K'UHUL runtime kernel (16KB)
│
├── scripts/                      # Application logic
│   └── mx2lm-chat-app.js        # Chat application with SCXQ2 layer (21KB)
│
├── ui/                          # User interface HTML files
│   └── mx2lm-chat.html          # Main chat interface (8KB)
│
├── docs/                        # Documentation
│   └── multi-hive-stack.html    # Architecture documentation (10KB)
│
└── assets/                      # Static assets
    └── css/
        └── atomic-asx.css       # ASX Block styling (15KB)
```

### File Responsibilities

#### `/core/kuhul-engine.js` (Primary Runtime)
- **K'UHUL Kernel**: Process management, weight storage, gradient handling
- **Weight Operations**: Store, load, update, quantize, visualize neural network weights
- **SVG Weight System**: Convert weights to SVG geometry for visualization
- **QLoRA Compression**: 8-bit quantization with SCXQ2 encoding
- **Micronaut Factory**: Spawn specialized AI agents
- **Optimizer Management**: Handle gradient descent and training operations

**Key Symbols**:
- `⟁` - K'UHUL glyph delimiter for operations
- `☣` - SCXQ2 hazard cipher prefix

#### `/scripts/mx2lm-chat-app.js` (Application Layer)
- **SCXQ2 Layer**: Hazard cipher for chat component encoding
- **ASX Runtime**: Atomic block system for UI components
- **User Management**: Authentication, profiles, sessions
- **Chat History**: Conversation persistence and retrieval
- **Model Manager**: Add/remove/configure AI models
- **AI Integration**: Connect to local and HuggingFace models

#### `/ui/mx2lm-chat.html` (Interface)
- **Chat Interface**: Message display and input
- **Sidebar**: Navigation, chat history, user profile
- **Settings Panel**: Model configuration, API tokens
- **Dashboard**: User statistics and activity

#### `/assets/css/atomic-asx.css` (Styling)
- **ASX Block Styles**: Component-based styling system
- **Theme Variables**: Dark theme with accent colors
- **Responsive Layout**: Mobile-first design
- **Animation System**: Smooth transitions and effects

---

## Key Architectural Concepts

### 1. K'UHUL Engine (Glyph-Based Execution)

The K'UHUL engine uses glyph-based syntax for operations:

```javascript
// Weight storage operation
await K.run('store_weights', '⟁Weights⟁store⟁Format⟁svg⟁', {
  modelId: 'my_model',
  weights: modelWeights,
  format: 'svg',
  config: { quantization: 8 }
});

// Gradient accumulation
await K.run('accumulate', '⟁Gradients⟁accumulate⟁', {
  modelId: 'my_model',
  gradients: newGradients
});
```

**Core Data Structures**:
- `K.p` - Process map (running operations)
- `K.w` - Weight storage map
- `K.g` - Gradient accumulation map
- `K.o` - Optimizer state map
- `K.m` - Model checkpoint map

### 2. SCXQ2 Compression Layer

SCXQ2 uses hazard cipher encoding (`☣`) for symbolic compression:

```javascript
const SCXQ2 = {
  HAZ: "☣CHAT:",
  PACKETS: {
    SIDEBAR: "☣CHAT:SIDEBAR",
    CHAT_VIEW: "☣CHAT:VIEW",
    INPUT: "☣CHAT:INPUT"
  }
};
```

**Benefits**:
- 87% compression ratio for artifacts
- Symbolic packet identification
- Efficient component serialization

### 3. ASX Blocks (Atomic UI Components)

ASX blocks are declarative UI components:

```javascript
{
  type: "asx-block",
  id: "chat-view",
  component: "ChatView",
  props: {
    messages: ChatHistory.getActive()?.messages || [],
    isGenerating: AI.isGenerating
  }
}
```

**Component Categories**:
- **Layout**: Sidebar, MainView, Panel
- **Interactive**: ChatInput, Button, Form
- **Display**: ChatView, MessageBubble, Avatar
- **Functional**: Settings, Dashboard, ModelManager

### 4. Multi-Hive Architecture

The system is organized into specialized shards:

- **dashboard** - Cockpit, metrics, overview
- **users** - Identity, sessions, membership
- **logistics** - Files, hosting, CI/CD
- **intel** - AI agents, models, datasets
- **settings** - System configuration

Each shard has:
- XJSON view definition
- API endpoints
- Agent capabilities
- Local state management

### 5. SVG Weight Geometry

Neural network weights are stored as SVG paths for visualization:

```javascript
// Convert model weights to SVG
const svgBrain = svgEngine.networkToSVG(modelWeights, {
  name: 'my_model',
  layers: ['embedding', 'attention', 'mlp', 'output']
});

// Render interactive visualization
svgEngine.renderSVGBrain(svgBrain, 'container-id');

// Compress with SCXQ2
const compressed = await svgCompressor.compressQLoRAToSVG(
  modelWeights,
  'my_model',
  { quantization: 8, compression: 'scxq2' }
);
```

**Features**:
- Visual inspection of weight distributions
- Path-based weight compression
- Interactive layer exploration
- SCXQ2 encoding for storage

---

## Development Workflows

### Adding New Features

1. **Determine the appropriate layer**:
   - **UI Changes**: Modify `/ui/*.html` files
   - **Application Logic**: Update `/scripts/mx2lm-chat-app.js`
   - **Core Engine**: Extend `/core/kuhul-engine.js`
   - **Styling**: Add to `/assets/css/atomic-asx.css`

2. **Follow K'UHUL conventions**:
   - Use glyph syntax (`⟁`) for K'UHUL operations
   - Use hazard cipher (`☣`) for SCXQ2 packets
   - Follow ASX block structure for UI components
   - Maintain functional, immutable patterns

3. **Test locally**:
   ```bash
   # Start local server
   python -m http.server 8000

   # Visit application
   open http://localhost:8000/ui/mx2lm-chat.html
   ```

4. **Update documentation**:
   - Add usage examples to README.md
   - Update architecture docs in `/docs/`
   - Document new K'UHUL operations

### Adding AI Models

Models are managed through the UI or programmatically:

```javascript
// Add HuggingFace model
ModelManager.add({
  name: 'Qwen 2.5 0.5B',
  url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct',
  type: 'huggingface'
});

// Add local Ollama endpoint
ModelManager.add({
  name: 'Local Llama',
  url: 'http://localhost:11434',
  type: 'local'
});
```

### Creating New ASX Blocks

1. **Define component structure**:
   ```javascript
   const MyComponent = {
     type: "asx-block",
     id: "my-component",
     component: "MyComponent",
     props: { /* ... */ }
   };
   ```

2. **Add SCXQ2 packet** (if needed):
   ```javascript
   SCXQ2.PACKETS.MY_COMPONENT = "☣CHAT:MYCOMP";
   ```

3. **Implement rendering logic** in ASX runtime

4. **Add styles** to `/assets/css/atomic-asx.css`:
   ```css
   .asx-my-component {
     /* Component styles */
   }
   ```

### Working with K'UHUL Operations

**Pattern for new operations**:

```javascript
// In kuhul-engine.js
K.handleMyOps = function(code, ctx) {
  const [_, op, ...args] = code.split('⟁');

  switch(op) {
    case 'my_operation':
      // Implementation
      return { op: 'my_operation_complete', data: result };

    case 'another_operation':
      // Implementation
      return { op: 'another_operation_complete', data: result };
  }
};

// Register in K.run()
if (code.includes('⟁MyOps⟁')) {
  return await this.handleMyOps(code, ctx);
}
```

### Adding Multi-Hive Shards

1. **Define shard in manifest.json**:
   ```json
   "shards": {
     "my_shard": {
       "id": "my_shard",
       "description": "Shard purpose",
       "entry": "/ui/my-shard.html"
     }
   }
   ```

2. **Create XJSON view definition** (declarative)

3. **Implement API endpoints** in application layer

4. **Add agent capabilities** if needed

5. **Configure routing** in KLH Router

---

## Coding Conventions

### JavaScript Style

```javascript
// Use const/let, not var
const immutableValue = 'constant';
let mutableValue = 0;

// Arrow functions for callbacks
array.map(item => item.value);

// Async/await for asynchronous operations
async function fetchData() {
  const response = await fetch(url);
  return await response.json();
}

// Destructuring for clean code
const { modelId, weights, config } = context;

// Template literals for strings
const message = `Processing ${count} items`;

// Short-circuit evaluation
const value = input || defaultValue;
```

### Naming Conventions

- **Variables**: camelCase (`modelWeights`, `chatHistory`)
- **Constants**: UPPER_SNAKE_CASE (`SCXQ2.PACKETS`, `MAX_RETRIES`)
- **Functions**: camelCase (`handleWeightOps`, `renderSVGBrain`)
- **Classes**: PascalCase (`ModelManager`, `ChatHistory`)
- **Files**: kebab-case (`kuhul-engine.js`, `mx2lm-chat.html`)
- **CSS Classes**: kebab-case with prefixes (`.asx-chat-view`, `.kuhul-weight-viz`)

### K'UHUL-Specific Conventions

1. **Glyph syntax**: Always use `⟁` for K'UHUL operation delimiters
2. **Operation naming**: Use lowercase with underscores (`store_weights`, `load_model`)
3. **Context objects**: Pass comprehensive context, not individual parameters
4. **Return format**: Always return `{ op: 'operation_name', ...data }`

### SCXQ2 Conventions

1. **Hazard prefix**: Always use `☣` for SCXQ2 packets
2. **Packet naming**: Use uppercase with colons (`☣CHAT:VIEW`, `☣MODEL:LOAD`)
3. **Compression**: Target 87% reduction ratio
4. **Decoding**: Always validate hazard prefix before decoding

### ASX Block Conventions

1. **Component structure**: Always include `type`, `id`, `component`, `props`
2. **IDs**: Use kebab-case with semantic meaning (`chat-view`, `user-settings`)
3. **Props**: Pass minimal, essential data only
4. **State**: Keep state in parent, pass down as props

---

## Testing and Quality Assurance

### Manual Testing Workflow

1. **Start local server**:
   ```bash
   python -m http.server 8000
   ```

2. **Test chat interface**:
   - Open http://localhost:8000/ui/mx2lm-chat.html
   - Verify authentication flow
   - Test message sending and receiving
   - Check model switching
   - Validate settings persistence

3. **Test K'UHUL operations**:
   - Open browser console
   - Run weight operations manually
   - Verify gradient accumulation
   - Test SVG visualization

4. **Test PWA features**:
   - Install as PWA
   - Test offline functionality
   - Verify service worker caching
   - Check manifest shortcuts

### Browser Compatibility

**Supported Browsers**:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

**Required Features**:
- ES6+ JavaScript
- LocalStorage
- Service Workers
- SVG rendering
- CSS Grid/Flexbox

### Performance Considerations

1. **Weight Storage**: Use quantization (8-bit) for large models
2. **SVG Rendering**: Lazy-load visualization on demand
3. **Message History**: Paginate old conversations
4. **Model Loading**: Cache models in localStorage
5. **Compression**: Always use SCXQ2 for persistence

---

## Common Tasks for AI Assistants

### Task 1: Adding a New Chat Feature

```javascript
// 1. Define SCXQ2 packet (in mx2lm-chat-app.js)
SCXQ2.PACKETS.NEW_FEATURE = "☣CHAT:NEWFEATURE";

// 2. Add decode function
SCXQ2._newFeature = function() {
  return [{
    type: "asx-block",
    id: "new-feature",
    component: "NewFeature",
    props: { /* ... */ }
  }];
};

// 3. Add to decode switch
case this.PACKETS.NEW_FEATURE:
  return this._newFeature();

// 4. Add UI in mx2lm-chat.html (if needed)

// 5. Add styles in atomic-asx.css
.asx-new-feature {
  /* Styles */
}
```

### Task 2: Adding K'UHUL Weight Operation

```javascript
// In kuhul-engine.js, add to handleWeightOps
case 'new_operation':
  // Perform operation on ctx.weights
  const result = this.processWeights(ctx.weights, ctx.params);
  this.w.set(ctx.modelId, result);
  return {
    op: 'new_operation_complete',
    modelId: ctx.modelId,
    result: result
  };
```

### Task 3: Adding a New Model Source

```javascript
// In mx2lm-chat-app.js, extend ModelManager
ModelManager.addSource = function(source) {
  const sources = this.getSources();
  sources.push({
    id: source.id,
    name: source.name,
    endpoint: source.endpoint,
    auth: source.auth,
    type: source.type // 'local', 'huggingface', 'openai', etc.
  });
  Settings.set('modelSources', sources);
};
```

### Task 4: Creating New Documentation Page

```html
<!-- In /docs/new-page.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>New Feature Documentation</title>
  <link rel="stylesheet" href="../assets/css/atomic-asx.css">
</head>
<body>
  <div class="asx-doc-container">
    <!-- Content -->
  </div>
</body>
</html>
```

### Task 5: Adding Multi-Hive Shard

1. Update manifest.json with shard definition
2. Create `/ui/shard-name.html` interface
3. Add routing in KLH Router
4. Implement API endpoints
5. Register agents if needed

---

## Debugging and Troubleshooting

### Common Issues

**Issue: K'UHUL operations not executing**
- Check glyph syntax (`⟁` delimiters)
- Verify operation is registered in K.run()
- Ensure context object has required properties
- Check browser console for errors

**Issue: SCXQ2 packets not decoding**
- Verify hazard prefix (`☣`)
- Check packet is registered in SCXQ2.PACKETS
- Ensure decode function exists
- Validate packet format

**Issue: ASX blocks not rendering**
- Verify block structure (type, id, component, props)
- Check ASX runtime is initialized
- Ensure styles are loaded
- Inspect element in DevTools

**Issue: Model connection failing**
- Verify endpoint URL is correct
- Check CORS settings on model server
- Validate API token if required
- Check network tab in DevTools

**Issue: Service worker not caching**
- Check service worker registration
- Verify sw.js exists and is accessible
- Look for service worker errors in console
- Clear cache and re-register

### Debug Mode

Enable verbose logging:

```javascript
// In kuhul-engine.js
K.DEBUG = true;

// In mx2lm-chat-app.js
SCXQ2.DEBUG = true;

// In browser console
localStorage.setItem('debug', 'true');
```

### Browser Console Utilities

```javascript
// Inspect K'UHUL state
K.p.forEach((proc, id) => console.log(id, proc));
K.w.forEach((weights, id) => console.log(id, weights));

// Check SCXQ2 packets
console.log(SCXQ2.PACKETS);

// View ASX blocks
console.log(ASX.blocks);

// Get user settings
console.log(Settings.getAll());

// View chat history
console.log(ChatHistory.getAll());
```

---

## Security Considerations

### Data Storage
- **LocalStorage**: Chat history, user preferences, model configurations
- **No server transmission**: All data stays local unless explicitly connected to external AI
- **API Tokens**: Store in Settings, never log or expose in code

### External Connections
- **HuggingFace**: Requires API token for model access
- **Local AI**: Connect only to localhost or trusted local IPs
- **Colab**: Use secure tunnels, validate endpoints

### Code Execution
- **K'UHUL**: Sandboxed execution, no eval() or Function() constructor
- **User Input**: Sanitize before rendering in DOM
- **SVG**: Validate SVG content before rendering

---

## Performance Optimization

### Weight Storage
```javascript
// Prefer quantized weights
const q8_weights = K.quantizeWeights(weights, 8);

// Use SCXQ2 compression
const compressed = svgCompressor.compressQLoRAToSVG(weights, modelId, {
  quantization: 8,
  compression: 'scxq2'
});
```

### Chat History
```javascript
// Paginate large chat histories
const MESSAGES_PER_PAGE = 50;
const pagedMessages = messages.slice(offset, offset + MESSAGES_PER_PAGE);
```

### SVG Rendering
```javascript
// Lazy-load weight visualizations
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      svgEngine.renderSVGBrain(svgData, entry.target.id);
    }
  });
});
```

---

## Git Workflow

### Branch Strategy
- `main` - Production-ready code
- `claude/*` - Feature branches created by AI assistants
- Feature branches should be descriptive

### Commit Messages
```bash
# Format: <type>: <description>

# Examples:
git commit -m "feat: Add SVG weight visualization to chat interface"
git commit -m "fix: Correct K'UHUL gradient accumulation logic"
git commit -m "docs: Update multi-hive architecture documentation"
git commit -m "refactor: Simplify SCXQ2 packet decoding"
git commit -m "style: Improve ASX block responsive layout"
```

### Commit Types
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Code style/formatting
- `refactor` - Code restructuring
- `test` - Adding tests
- `chore` - Maintenance tasks

---

## External Resources

### K'UHUL Multi-Hive Stack
- Architecture overview in `/docs/multi-hive-stack.html`
- Complete layer stack explanation
- Shard system documentation
- Agent orchestration guide

### Technologies
- **K'UHUL**: Custom glyph-based execution engine
- **XJSON**: Universal OS language for declarative UI
- **SCX/SCXQ2**: Symbolic compression with hazard cipher
- **ASX Blocks**: Atomic UI component system
- **KLH Router**: Multi-hive shard routing

### Model Integration
- **HuggingFace**: https://huggingface.co/models
- **Ollama**: Local model serving
- **Google Colab**: Free GPU training
- **QLoRA**: Efficient fine-tuning technique

---

## Project Vision

XJSON-BOT aims to provide a complete local AI development environment that runs entirely in the browser. Key goals:

1. **Local-First**: All processing happens locally, no server dependencies
2. **Visual AI**: Neural networks represented as interactive SVG geometry
3. **Efficient Storage**: 87% compression ratio using SCXQ2
4. **Distributed Architecture**: Multi-hive shards for specialized functions
5. **Free GPU Training**: Leverage Colab's free resources
6. **Developer-Friendly**: Clear APIs, comprehensive docs, extensible design

### Future Roadmap

- [ ] Training dashboard with real-time metrics
- [ ] ASX tape registry for app/model distribution
- [ ] Visual weight editor (edit SVG paths → modify weights)
- [ ] Multi-user collaboration through hive synchronization
- [ ] WebGPU acceleration for local inference
- [ ] Python runtime integration (MX2PY agent)
- [ ] Model export to ONNX/GGUF formats

---

## Quick Reference

### Essential Commands

```bash
# Start local server
python -m http.server 8000

# View in browser
open http://localhost:8000/ui/mx2lm-chat.html

# Git workflow
git checkout -b claude/feature-name
git add .
git commit -m "feat: Description"
git push -u origin claude/feature-name
```

### Essential Code Patterns

```javascript
// K'UHUL operation
await K.run('op_id', '⟁Category⟁operation⟁', { /* ctx */ });

// SCXQ2 decode
const blocks = SCXQ2.decode('☣CHAT:VIEW');

// ASX block
const block = {
  type: "asx-block",
  id: "block-id",
  component: "ComponentName",
  props: { /* props */ }
};

// Model management
ModelManager.add({ name, url, type });

// Settings
Settings.set('key', value);
const value = Settings.get('key');

// Chat history
ChatHistory.add(message);
const messages = ChatHistory.getActive()?.messages || [];
```

### Key Files to Modify

| Task | Primary File | Secondary Files |
|------|-------------|-----------------|
| Add UI feature | `/ui/mx2lm-chat.html` | `/assets/css/atomic-asx.css` |
| Add chat logic | `/scripts/mx2lm-chat-app.js` | `/core/kuhul-engine.js` |
| Add K'UHUL op | `/core/kuhul-engine.js` | `/scripts/mx2lm-chat-app.js` |
| Add documentation | `/docs/new-doc.html` | `README.md` |
| Add PWA feature | `manifest.json` | `index.html` |

---

## Contact and Contribution

This is an experimental AI development environment. When contributing:

1. Maintain K'UHUL conventions (glyph syntax, operation patterns)
2. Follow SCXQ2 compression standards
3. Use ASX blocks for all UI components
4. Write comprehensive comments for complex logic
5. Update documentation alongside code changes
6. Test locally before committing
7. Keep commits atomic and well-described

**Built with the K'UHUL Multi-Hive Stack** 🚀

*Turn free Colab into a $20K training rig!*
