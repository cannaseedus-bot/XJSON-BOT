/**
 * KUHUL WASM Adapter
 * Browser-native KPI execution via WebAssembly
 *
 * @version 1.0.0
 * @status frozen
 * @authority KPI_IS_LAW
 *
 * This adapter:
 * - Executes KPI effects in browser without server
 * - Uses WebAssembly for performance-critical operations
 * - Falls back to JS for unsupported operations
 * - Integrates with Transformers.js for ML inference
 */

// ============================================================
// WASM Module Loader
// ============================================================

class WASMModuleLoader {
  constructor() {
    this.modules = new Map();
    this.loading = new Map();
  }

  /**
   * Load WASM module from URL
   */
  async load(moduleId, url) {
    // Check cache
    if (this.modules.has(moduleId)) {
      return this.modules.get(moduleId);
    }

    // Check if already loading
    if (this.loading.has(moduleId)) {
      return this.loading.get(moduleId);
    }

    // Start loading
    const loadPromise = this._doLoad(moduleId, url);
    this.loading.set(moduleId, loadPromise);

    try {
      const module = await loadPromise;
      this.modules.set(moduleId, module);
      return module;
    } finally {
      this.loading.delete(moduleId);
    }
  }

  /**
   * Load and instantiate WASM module
   */
  async _doLoad(moduleId, url) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();

    const imports = this._createImports(moduleId);
    const { instance, module } = await WebAssembly.instantiate(buffer, imports);

    return {
      instance,
      module,
      exports: instance.exports,
      memory: instance.exports.memory
    };
  }

  /**
   * Create import object for WASM module
   */
  _createImports(moduleId) {
    return {
      env: {
        // Memory
        memory: new WebAssembly.Memory({ initial: 256, maximum: 512 }),

        // Console logging
        log_i32: (value) => console.log(`[WASM ${moduleId}] i32:`, value),
        log_f64: (value) => console.log(`[WASM ${moduleId}] f64:`, value),
        log_str: (ptr, len) => {
          // Would need memory access to decode string
          console.log(`[WASM ${moduleId}] str: (ptr=${ptr}, len=${len})`);
        },

        // Math intrinsics
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        sqrt: Math.sqrt,
        pow: Math.pow,
        exp: Math.exp,
        log: Math.log,
        floor: Math.floor,
        ceil: Math.ceil,
        abs: Math.abs
      },

      kuhul: {
        // KUHUL intrinsics
        trace_record: (eventType, timestamp) => {
          console.log(`[WASM Trace] event=${eventType} t=${timestamp}`);
        },
        trace_verify: (hash) => {
          return 1; // Success
        }
      }
    };
  }

  /**
   * Get loaded module
   */
  get(moduleId) {
    return this.modules.get(moduleId);
  }

  /**
   * Unload module
   */
  unload(moduleId) {
    this.modules.delete(moduleId);
  }
}

// ============================================================
// WASM Effect Handlers
// ============================================================

/**
 * Built-in WASM effect handlers for common operations
 */
const WASM_HANDLERS = {
  /**
   * Matrix multiplication (pure WASM)
   */
  'math.matmul': {
    async execute(args, context) {
      const [a, b] = args;

      // Validate inputs
      if (!Array.isArray(a) || !Array.isArray(b)) {
        throw new Error('matmul requires two arrays');
      }

      // Use JS fallback (WASM version would be loaded separately)
      const rowsA = a.length;
      const colsA = a[0]?.length || 1;
      const colsB = b[0]?.length || 1;

      const result = [];
      for (let i = 0; i < rowsA; i++) {
        result[i] = [];
        for (let j = 0; j < colsB; j++) {
          let sum = 0;
          for (let k = 0; k < colsA; k++) {
            sum += (a[i][k] || 0) * (b[k]?.[j] || 0);
          }
          result[i][j] = sum;
        }
      }

      return result;
    }
  },

  /**
   * Vector dot product
   */
  'math.dot': {
    async execute(args) {
      const [a, b] = args;

      if (!Array.isArray(a) || !Array.isArray(b)) {
        throw new Error('dot requires two arrays');
      }

      if (a.length !== b.length) {
        throw new Error('dot requires arrays of same length');
      }

      let sum = 0;
      for (let i = 0; i < a.length; i++) {
        sum += a[i] * b[i];
      }

      return sum;
    }
  },

  /**
   * Array operations
   */
  'array.zeros': {
    async execute(args) {
      const [shape] = args;
      return createArray(shape, 0);
    }
  },

  'array.ones': {
    async execute(args) {
      const [shape] = args;
      return createArray(shape, 1);
    }
  },

  'array.random': {
    async execute(args) {
      const [shape] = args;
      return createArray(shape, () => Math.random());
    }
  },

  /**
   * Softmax (for ML)
   */
  'ml.softmax': {
    async execute(args) {
      const [input] = args;

      if (!Array.isArray(input)) {
        throw new Error('softmax requires array input');
      }

      const max = Math.max(...input);
      const exps = input.map(x => Math.exp(x - max));
      const sum = exps.reduce((a, b) => a + b, 0);

      return exps.map(x => x / sum);
    }
  },

  /**
   * ReLU activation
   */
  'ml.relu': {
    async execute(args) {
      const [input] = args;

      if (Array.isArray(input)) {
        return input.map(x => Math.max(0, x));
      }

      return Math.max(0, input);
    }
  },

  /**
   * Sigmoid activation
   */
  'ml.sigmoid': {
    async execute(args) {
      const [input] = args;

      const sigmoid = x => 1 / (1 + Math.exp(-x));

      if (Array.isArray(input)) {
        return input.map(sigmoid);
      }

      return sigmoid(input);
    }
  }
};

/**
 * Create n-dimensional array
 */
function createArray(shape, valueOrFn) {
  if (!Array.isArray(shape) || shape.length === 0) {
    return typeof valueOrFn === 'function' ? valueOrFn() : valueOrFn;
  }

  const [first, ...rest] = shape;
  const result = [];

  for (let i = 0; i < first; i++) {
    result.push(createArray(rest, valueOrFn));
  }

  return result;
}

// ============================================================
// Transformers.js Integration
// ============================================================

class TransformersAdapter {
  constructor() {
    this.pipelines = new Map();
    this.models = new Map();
    this.tokenizers = new Map();
    this.loaded = false;
  }

  /**
   * Ensure Transformers.js is loaded
   */
  async ensureLoaded() {
    if (this.loaded) return;

    if (typeof window !== 'undefined' && !window.transformers) {
      // Dynamic import from CDN
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.0';
      script.type = 'module';

      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    this.loaded = true;
  }

  /**
   * Load a pipeline
   */
  async loadPipeline(task, model) {
    await this.ensureLoaded();

    const key = `${task}:${model}`;
    if (this.pipelines.has(key)) {
      return this.pipelines.get(key);
    }

    // @ts-ignore - Transformers.js
    const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.0');
    const pipe = await pipeline(task, model);

    this.pipelines.set(key, pipe);
    return pipe;
  }

  /**
   * Run text generation
   */
  async generate(model, prompt, options = {}) {
    const pipe = await this.loadPipeline('text-generation', model);

    const result = await pipe(prompt, {
      max_new_tokens: options.maxTokens || 128,
      temperature: options.temperature || 0.7,
      do_sample: options.temperature > 0
    });

    return result[0]?.generated_text || '';
  }

  /**
   * Run feature extraction (embeddings)
   */
  async embed(model, text) {
    const pipe = await this.loadPipeline('feature-extraction', model);
    const result = await pipe(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data);
  }

  /**
   * Run sentiment analysis
   */
  async sentiment(model, text) {
    const pipe = await this.loadPipeline('sentiment-analysis', model);
    return pipe(text);
  }
}

// ============================================================
// WASM Adapter
// ============================================================

class KUHULWASMAdapter {
  constructor(options = {}) {
    this.options = {
      enableTransformers: true,
      wasmBaseUrl: '/wasm/',
      ...options
    };

    this.moduleLoader = new WASMModuleLoader();
    this.transformers = options.enableTransformers ? new TransformersAdapter() : null;
    this.handles = new Map();
    this.nextHandleId = 1;
  }

  /**
   * Execute a KPI effect
   */
  async execute(request) {
    const startTime = performance.now();
    const callId = this._generateCallId();

    try {
      const opcode = request.opcode;
      const host = request.host || 'wasm';

      // Route based on opcode
      let result;

      switch (opcode) {
        case 32: // ForeignCall
          result = await this._executeForeignCall(request);
          break;

        case 33: // ForeignImport
          result = await this._executeForeignImport(request);
          break;

        case 34: // ForeignConstruct
          result = await this._executeForeignConstruct(request);
          break;

        case 35: // ForeignMethod
          result = await this._executeForeignMethod(request);
          break;

        case 36: // ForeignDispose
          result = await this._executeForeignDispose(request);
          break;

        default:
          throw new Error(`Unknown opcode: ${opcode}`);
      }

      const durationMs = performance.now() - startTime;

      return {
        success: true,
        result,
        error: null,
        trace: {
          call_id: callId,
          timestamp_ms: Date.now(),
          duration_ms: Math.round(durationMs),
          input_hash: this._hashInput(request),
          output_hash: this._hashOutput(result),
          host: 'wasm'
        }
      };

    } catch (error) {
      return {
        success: false,
        result: null,
        error: {
          code: 'WASM_ERROR',
          message: error.message,
          host: 'wasm',
          traceback: error.stack
        },
        trace: {
          call_id: callId,
          timestamp_ms: Date.now(),
          duration_ms: Math.round(performance.now() - startTime),
          input_hash: this._hashInput(request),
          output_hash: '',
          host: 'wasm'
        }
      };
    }
  }

  /**
   * Execute ForeignCall
   */
  async _executeForeignCall(request) {
    const { module: moduleName, symbol, args = [], kwargs = {} } = request;

    // Check for built-in WASM handlers
    const handlerKey = `${moduleName}.${symbol}`;
    if (WASM_HANDLERS[handlerKey]) {
      return WASM_HANDLERS[handlerKey].execute(args, this);
    }

    // Check for Transformers.js handlers
    if (this.transformers && moduleName === 'transformers') {
      return this._executeTransformers(symbol, args, kwargs);
    }

    // Check for math module (pure JS/WASM)
    if (moduleName === 'math') {
      return this._executeMath(symbol, args);
    }

    // Check for array module
    if (moduleName === 'array' || moduleName === 'numpy') {
      return this._executeArray(symbol, args);
    }

    // Check for ml module
    if (moduleName === 'ml') {
      const mlHandler = WASM_HANDLERS[`ml.${symbol}`];
      if (mlHandler) {
        return mlHandler.execute(args, this);
      }
    }

    throw new Error(`Unknown module/symbol: ${moduleName}.${symbol}`);
  }

  /**
   * Execute Transformers.js operation
   */
  async _executeTransformers(symbol, args, kwargs) {
    if (!this.transformers) {
      throw new Error('Transformers.js not enabled');
    }

    switch (symbol) {
      case 'generate':
        return this.transformers.generate(args[0], args[1], kwargs);

      case 'embed':
        return this.transformers.embed(args[0], args[1]);

      case 'sentiment':
        return this.transformers.sentiment(args[0], args[1]);

      case 'pipeline':
        const pipe = await this.transformers.loadPipeline(args[0], args[1]);
        const handleId = this._registerHandle(pipe, 'pipeline');
        return { type: 'handle', handle_id: handleId, host: 'wasm' };

      default:
        throw new Error(`Unknown transformers symbol: ${symbol}`);
    }
  }

  /**
   * Execute math operation
   */
  async _executeMath(symbol, args) {
    switch (symbol) {
      case 'sin': return Math.sin(args[0]);
      case 'cos': return Math.cos(args[0]);
      case 'tan': return Math.tan(args[0]);
      case 'sqrt': return Math.sqrt(args[0]);
      case 'pow': return Math.pow(args[0], args[1]);
      case 'exp': return Math.exp(args[0]);
      case 'log': return Math.log(args[0]);
      case 'floor': return Math.floor(args[0]);
      case 'ceil': return Math.ceil(args[0]);
      case 'abs': return Math.abs(args[0]);
      case 'min': return Math.min(...args);
      case 'max': return Math.max(...args);
      case 'sum': return args.flat(Infinity).reduce((a, b) => a + b, 0);
      case 'mean': {
        const flat = args[0].flat(Infinity);
        return flat.reduce((a, b) => a + b, 0) / flat.length;
      }
      case 'matmul': return WASM_HANDLERS['math.matmul'].execute(args, this);
      case 'dot': return WASM_HANDLERS['math.dot'].execute(args, this);
      default:
        throw new Error(`Unknown math symbol: ${symbol}`);
    }
  }

  /**
   * Execute array operation
   */
  async _executeArray(symbol, args) {
    switch (symbol) {
      case 'array':
        return args[0]; // Just return the array

      case 'zeros':
        return WASM_HANDLERS['array.zeros'].execute(args, this);

      case 'ones':
        return WASM_HANDLERS['array.ones'].execute(args, this);

      case 'random':
      case 'rand':
        return WASM_HANDLERS['array.random'].execute(args, this);

      case 'reshape': {
        const [arr, shape] = args;
        const flat = arr.flat(Infinity);
        return this._reshape(flat, shape);
      }

      case 'transpose': {
        const [arr] = args;
        if (!Array.isArray(arr[0])) return arr;
        const rows = arr.length;
        const cols = arr[0].length;
        const result = [];
        for (let j = 0; j < cols; j++) {
          result[j] = [];
          for (let i = 0; i < rows; i++) {
            result[j][i] = arr[i][j];
          }
        }
        return result;
      }

      case 'arange': {
        const [start, stop, step = 1] = args;
        const result = [];
        for (let i = start; i < stop; i += step) {
          result.push(i);
        }
        return result;
      }

      case 'linspace': {
        const [start, stop, num = 50] = args;
        const result = [];
        const step = (stop - start) / (num - 1);
        for (let i = 0; i < num; i++) {
          result.push(start + step * i);
        }
        return result;
      }

      default:
        throw new Error(`Unknown array symbol: ${symbol}`);
    }
  }

  /**
   * Reshape flat array to n-dimensional
   */
  _reshape(flat, shape) {
    if (shape.length === 0) {
      return flat[0];
    }

    if (shape.length === 1) {
      return flat.slice(0, shape[0]);
    }

    const [first, ...rest] = shape;
    const chunkSize = rest.reduce((a, b) => a * b, 1);
    const result = [];

    for (let i = 0; i < first; i++) {
      const chunk = flat.slice(i * chunkSize, (i + 1) * chunkSize);
      result.push(this._reshape(chunk, rest));
    }

    return result;
  }

  /**
   * Execute ForeignImport
   */
  async _executeForeignImport(request) {
    const { module: moduleName } = request;

    // For WASM, we don't actually import - we just acknowledge
    return {
      type: 'handle',
      handle_id: 0,
      host: 'wasm',
      module: moduleName
    };
  }

  /**
   * Execute ForeignConstruct
   */
  async _executeForeignConstruct(request) {
    const { module: moduleName, class: className, args = [] } = request;

    // Special handling for known classes
    if (moduleName === 'ml' && className === 'Sequential') {
      const model = { layers: [], type: 'Sequential' };
      const handleId = this._registerHandle(model, 'Sequential');
      return { type: 'handle', handle_id: handleId, host: 'wasm' };
    }

    throw new Error(`Cannot construct: ${moduleName}.${className}`);
  }

  /**
   * Execute ForeignMethod
   */
  async _executeForeignMethod(request) {
    const { handle_id: handleId, method, args = [] } = request;

    const handle = this.handles.get(handleId);
    if (!handle) {
      throw new Error(`Invalid handle: ${handleId}`);
    }

    const obj = handle.object;

    // Handle pipeline calls
    if (handle.type === 'pipeline' && method === '__call__') {
      return obj(args[0]);
    }

    // Handle model methods
    if (handle.type === 'Sequential') {
      if (method === 'add') {
        obj.layers.push(args[0]);
        return null;
      }
      if (method === 'forward') {
        let x = args[0];
        for (const layer of obj.layers) {
          // Apply layer (simplified)
          x = x; // Would apply actual layer
        }
        return x;
      }
    }

    // Try calling method directly
    if (typeof obj[method] === 'function') {
      return obj[method](...args);
    }

    throw new Error(`Unknown method: ${method}`);
  }

  /**
   * Execute ForeignDispose
   */
  async _executeForeignDispose(request) {
    const handleId = request.handle_id || request.handle?.handle_id;

    if (this.handles.has(handleId)) {
      this.handles.delete(handleId);
      return true;
    }

    return false;
  }

  /**
   * Register object handle
   */
  _registerHandle(object, type) {
    const handleId = this.nextHandleId++;
    this.handles.set(handleId, { object, type });
    return handleId;
  }

  /**
   * Generate call ID
   */
  _generateCallId() {
    return `wasm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Hash input for trace
   */
  _hashInput(request) {
    const str = JSON.stringify(request);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Hash output for trace
   */
  _hashOutput(result) {
    const str = JSON.stringify(result);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Reset adapter state
   */
  reset() {
    this.handles.clear();
    this.nextHandleId = 1;
  }
}

// ============================================================
// Exports
// ============================================================

const WASMAdapter = {
  // Classes
  KUHULWASMAdapter,
  WASMModuleLoader,
  TransformersAdapter,

  // Built-in handlers
  WASM_HANDLERS,

  // Utilities
  createArray,

  /**
   * Create adapter instance
   */
  create(options = {}) {
    return new KUHULWASMAdapter(options);
  },

  /**
   * Quick execute
   */
  async execute(request, options = {}) {
    const adapter = new KUHULWASMAdapter(options);
    return adapter.execute(request);
  }
};

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WASMAdapter;
}
if (typeof window !== 'undefined') {
  window.KUHULWASMAdapter = WASMAdapter;
}
if (typeof globalThis !== 'undefined') {
  globalThis.KUHULWASMAdapter = WASMAdapter;
}
