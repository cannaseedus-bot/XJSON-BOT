/**
 * KUHUL End-to-End Pipeline
 * .ts → .asx → .kpi → python
 *
 * @version 1.0.0
 * @status frozen
 * @authority KPI_IS_LAW
 *
 * This pipeline:
 * 1. Parses TypeScript/KUHUL-ES source to AST
 * 2. Normalizes AST to canonical form
 * 3. Encodes AST to KPI binary
 * 4. Executes KPI on target host (Python, WASM, etc.)
 * 5. Returns results with execution trace
 */

// ============================================================
// Pipeline Phases
// ============================================================

/**
 * Pipeline phase definitions (XCFE model)
 */
const PHASES = {
  POP: 'Pop',      // Populate - Load source, initialize state
  WO: 'Wo',        // Work - Transform, compile, encode
  SEK: 'Sek',      // Seek - Route to host, execute
  COLLAPSE: "Ch'en" // Collapse - Finalize, return results
};

/**
 * Pipeline step results
 */
class StepResult {
  constructor(phase, success, data, error = null, trace = null) {
    this.phase = phase;
    this.success = success;
    this.data = data;
    this.error = error;
    this.trace = trace;
    this.timestamp = Date.now();
  }

  static ok(phase, data, trace = null) {
    return new StepResult(phase, true, data, null, trace);
  }

  static fail(phase, error, trace = null) {
    return new StepResult(phase, false, null, error, trace);
  }
}

// ============================================================
// Source Parser
// ============================================================

class SourceParser {
  constructor(options = {}) {
    this.options = {
      language: 'kuhul-es',
      ...options
    };
  }

  /**
   * Parse source to AST
   */
  async parse(source) {
    const language = this.detectLanguage(source);

    switch (language) {
      case 'kuhul-es':
        return this.parseKUHULES(source);
      case 'typescript':
        return this.parseTypeScript(source);
      case 'javascript':
        return this.parseJavaScript(source);
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  /**
   * Detect source language
   */
  detectLanguage(source) {
    // Check for KUHUL-ES markers
    if (source.includes('π ') || source.includes('τ ') ||
        source.includes('⟁') || source.includes('@system')) {
      return 'kuhul-es';
    }

    // Check for TypeScript
    if (source.includes(': ') && (source.includes('interface') || source.includes('type '))) {
      return 'typescript';
    }

    // Default to JavaScript
    return 'javascript';
  }

  /**
   * Parse KUHUL-ES source
   */
  parseKUHULES(source) {
    // Use the KUHUL-ES parser
    if (typeof KUHULESParser !== 'undefined') {
      return KUHULESParser.parse(source);
    }

    // Fallback: dynamic import
    if (typeof require !== 'undefined') {
      const parser = require('./kuhul-es-parser.js');
      return parser.parse(source);
    }

    throw new Error('KUHUL-ES parser not available');
  }

  /**
   * Parse TypeScript source (extract foreign calls)
   */
  parseTypeScript(source) {
    // For TypeScript, we extract foreign call descriptors
    // and convert them to canonical AST

    const foreignCalls = this.extractForeignCalls(source);

    return {
      type: 'Program',
      body: foreignCalls.map(call => ({
        type: 'GlyphStatement',
        glyph: { type: 'Identifier', name: 'ForeignCall' },
        arguments: [
          { type: 'StringLiteral', value: call.host },
          { type: 'StringLiteral', value: call.module },
          { type: 'StringLiteral', value: call.symbol },
          { type: 'ArrayExpression', elements: call.args }
        ]
      }))
    };
  }

  /**
   * Parse JavaScript source
   */
  parseJavaScript(source) {
    return this.parseTypeScript(source); // Same handling
  }

  /**
   * Extract foreign calls from source
   */
  extractForeignCalls(source) {
    const calls = [];

    // Pattern: numpy.array([1, 2, 3])
    const callPattern = /(\w+)\.(\w+)\s*\(/g;
    let match;

    while ((match = callPattern.exec(source)) !== null) {
      const [, module, symbol] = match;

      // Find argument list (simplified)
      const start = match.index + match[0].length;
      let depth = 1;
      let end = start;
      while (depth > 0 && end < source.length) {
        if (source[end] === '(') depth++;
        if (source[end] === ')') depth--;
        end++;
      }

      const argsStr = source.slice(start, end - 1);

      calls.push({
        host: 'python',
        module,
        symbol,
        args: [{ type: 'RawExpression', value: argsStr }]
      });
    }

    return calls;
  }
}

// ============================================================
// AST Normalizer
// ============================================================

class ASTNormalizer {
  /**
   * Normalize AST to canonical form
   */
  normalize(ast) {
    return this.visit(ast);
  }

  /**
   * Visit and normalize node
   */
  visit(node) {
    if (!node || typeof node !== 'object') {
      return node;
    }

    if (Array.isArray(node)) {
      return node.map(n => this.visit(n));
    }

    // Clone node
    const normalized = { type: node.type };

    // Sort fields lexicographically (canonical ordering)
    const fields = Object.keys(node)
      .filter(k => k !== 'type' && k !== 'loc')
      .sort();

    for (const field of fields) {
      normalized[field] = this.visit(node[field]);
    }

    // Apply node-specific normalization
    return this.normalizeNode(normalized);
  }

  /**
   * Node-specific normalization rules
   */
  normalizeNode(node) {
    switch (node.type) {
      case 'πDeclaration':
        // Ensure π declarations are marked immutable
        return { ...node, immutable: true };

      case 'τDeclaration':
        // Ensure τ declarations are marked temporal
        return { ...node, temporal: true };

      case 'GlyphStatement':
        // Ensure glyph has proper structure
        if (typeof node.glyph === 'string') {
          node.glyph = { type: 'Identifier', name: node.glyph };
        }
        return node;

      case 'ForeignCall':
        // Normalize to GlyphStatement
        return {
          type: 'GlyphStatement',
          glyph: { type: 'Identifier', name: 'ForeignCall' },
          arguments: [
            { type: 'StringLiteral', value: node.host || 'python' },
            { type: 'StringLiteral', value: node.module || '' },
            { type: 'StringLiteral', value: node.symbol || '' },
            { type: 'ArrayExpression', elements: node.args || [] }
          ]
        };

      default:
        return node;
    }
  }
}

// ============================================================
// KPI Emitter
// ============================================================

class KPIEmitter {
  constructor(options = {}) {
    this.options = {
      includeSource: false,
      includeSourceMap: false,
      ...options
    };
  }

  /**
   * Emit KPI binary from AST
   */
  async emit(ast, options = {}) {
    const mergedOptions = { ...this.options, ...options };

    // Use KPI encoder
    if (typeof KPI !== 'undefined') {
      return await KPI.encode(ast, {
        source: mergedOptions.includeSource ? mergedOptions.source : null,
        sourceLocs: mergedOptions.includeSourceMap ? this.extractLocs(ast) : null
      });
    }

    // Fallback: dynamic import
    if (typeof require !== 'undefined') {
      const kpi = require('./kpi-encoder.js');
      return await kpi.encode(ast, {
        source: mergedOptions.includeSource ? mergedOptions.source : null,
        sourceLocs: mergedOptions.includeSourceMap ? this.extractLocs(ast) : null
      });
    }

    throw new Error('KPI encoder not available');
  }

  /**
   * Extract source locations from AST
   */
  extractLocs(node, locs = [], index = { current: 0 }) {
    if (!node || typeof node !== 'object') return locs;

    if (node.loc) {
      locs.push({
        nodeIndex: index.current,
        startLine: node.loc.start?.line || 0,
        startCol: node.loc.start?.column || 0,
        startOff: node.loc.start?.offset || 0,
        endLine: node.loc.end?.line || 0,
        endCol: node.loc.end?.column || 0,
        endOff: node.loc.end?.offset || 0
      });
    }

    index.current++;

    // Traverse children
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          this.extractLocs(item, locs, index);
        }
      } else if (typeof value === 'object' && value !== null && value.type) {
        this.extractLocs(value, locs, index);
      }
    }

    return locs;
  }
}

// ============================================================
// Host Router
// ============================================================

class HostRouter {
  constructor(options = {}) {
    this.hosts = {
      python: {
        type: 'http',
        endpoint: options.pythonEndpoint || 'http://localhost:8765',
        available: false
      },
      wasm: {
        type: 'local',
        instance: null,
        available: typeof WebAssembly !== 'undefined'
      },
      node: {
        type: 'local',
        available: typeof process !== 'undefined'
      }
    };
  }

  /**
   * Route effect to host
   */
  async route(effect) {
    const hostId = effect.host || 'python';
    const host = this.hosts[hostId];

    if (!host) {
      throw new Error(`Unknown host: ${hostId}`);
    }

    switch (host.type) {
      case 'http':
        return this.routeHTTP(host, effect);
      case 'local':
        return this.routeLocal(host, effect);
      default:
        throw new Error(`Unknown host type: ${host.type}`);
    }
  }

  /**
   * Route via HTTP
   */
  async routeHTTP(host, effect) {
    const response = await fetch(`${host.endpoint}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(effect)
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Route locally (Node.js)
   */
  async routeLocal(host, effect) {
    // For local execution, we'd need the Python adapter running as subprocess
    // This is a simplified implementation
    throw new Error('Local routing not implemented - use HTTP routing');
  }

  /**
   * Check host availability
   */
  async checkAvailability(hostId) {
    const host = this.hosts[hostId];
    if (!host) return false;

    if (host.type === 'http') {
      try {
        const response = await fetch(`${host.endpoint}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        host.available = response.ok;
      } catch {
        host.available = false;
      }
    }

    return host.available;
  }
}

// ============================================================
// Effect Executor
// ============================================================

class EffectExecutor {
  constructor(router) {
    this.router = router;
  }

  /**
   * Execute effects from AST
   */
  async execute(ast) {
    const effects = this.extractEffects(ast);
    const results = [];

    for (const effect of effects) {
      const result = await this.executeOne(effect);
      results.push(result);
    }

    return results;
  }

  /**
   * Extract effect nodes from AST
   */
  extractEffects(node, effects = []) {
    if (!node || typeof node !== 'object') return effects;

    // GlyphStatement with ForeignCall
    if (node.type === 'GlyphStatement') {
      const glyphName = node.glyph?.name || node.glyph;

      if (glyphName === 'ForeignCall' || glyphName.startsWith('Foreign')) {
        effects.push(this.glyphToEffect(node));
      }
    }

    // Traverse children
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          this.extractEffects(item, effects);
        }
      } else if (typeof value === 'object' && value !== null) {
        this.extractEffects(value, effects);
      }
    }

    return effects;
  }

  /**
   * Convert glyph node to effect request
   */
  glyphToEffect(node) {
    const args = node.arguments || [];

    return {
      opcode: 32, // ForeignCall
      host: this.extractValue(args[0]) || 'python',
      module: this.extractValue(args[1]) || '',
      symbol: this.extractValue(args[2]) || '',
      args: args.slice(3).map(a => this.extractValue(a))
    };
  }

  /**
   * Extract value from AST node
   */
  extractValue(node) {
    if (!node) return null;

    switch (node.type) {
      case 'StringLiteral':
        return node.value;
      case 'NumericLiteral':
        return node.value;
      case 'BooleanLiteral':
        return node.value;
      case 'NullLiteral':
        return null;
      case 'ArrayExpression':
        return (node.elements || []).map(e => this.extractValue(e));
      case 'ObjectExpression':
        const obj = {};
        for (const prop of (node.properties || [])) {
          const key = this.extractValue(prop.key);
          const value = this.extractValue(prop.value);
          obj[key] = value;
        }
        return obj;
      case 'Identifier':
        return node.name;
      default:
        return node.value !== undefined ? node.value : null;
    }
  }

  /**
   * Execute single effect
   */
  async executeOne(effect) {
    return this.router.route(effect);
  }
}

// ============================================================
// Main Pipeline
// ============================================================

class KUHULPipeline {
  constructor(options = {}) {
    this.options = {
      pythonEndpoint: 'http://localhost:8765',
      includeSource: false,
      includeSourceMap: false,
      ...options
    };

    this.parser = new SourceParser();
    this.normalizer = new ASTNormalizer();
    this.emitter = new KPIEmitter(this.options);
    this.router = new HostRouter(this.options);
    this.executor = new EffectExecutor(this.router);

    this.trace = [];
  }

  /**
   * Run full pipeline: source → results
   */
  async run(source, options = {}) {
    this.trace = [];
    const mergedOptions = { ...this.options, ...options };

    try {
      // Phase 1: Pop - Parse source
      const parseResult = await this.phase(PHASES.POP, async () => {
        return this.parser.parse(source);
      });

      if (!parseResult.success) {
        return this.createResult(false, null, parseResult.error);
      }

      const ast = parseResult.data;

      // Phase 2: Wo - Normalize and emit KPI
      const woResult = await this.phase(PHASES.WO, async () => {
        const normalizedAST = this.normalizer.normalize(ast);
        const kpi = await this.emitter.emit(normalizedAST, {
          source: mergedOptions.includeSource ? source : null
        });
        return { ast: normalizedAST, kpi };
      });

      if (!woResult.success) {
        return this.createResult(false, null, woResult.error);
      }

      // Phase 3: Sek - Execute effects
      const sekResult = await this.phase(PHASES.SEK, async () => {
        return this.executor.execute(woResult.data.ast);
      });

      if (!sekResult.success) {
        return this.createResult(false, null, sekResult.error);
      }

      // Phase 4: Ch'en - Collapse results
      const collapseResult = await this.phase(PHASES.COLLAPSE, async () => {
        return {
          ast: woResult.data.ast,
          kpi: woResult.data.kpi,
          results: sekResult.data
        };
      });

      return this.createResult(true, collapseResult.data);

    } catch (error) {
      return this.createResult(false, null, error);
    }
  }

  /**
   * Run pipeline phase
   */
  async phase(name, fn) {
    const startTime = Date.now();

    try {
      const data = await fn();
      const result = StepResult.ok(name, data, {
        duration_ms: Date.now() - startTime
      });
      this.trace.push(result);
      return result;
    } catch (error) {
      const result = StepResult.fail(name, error, {
        duration_ms: Date.now() - startTime
      });
      this.trace.push(result);
      return result;
    }
  }

  /**
   * Create pipeline result
   */
  createResult(success, data, error = null) {
    return {
      success,
      data,
      error: error ? {
        message: error.message || String(error),
        stack: error.stack
      } : null,
      trace: this.trace.map(t => ({
        phase: t.phase,
        success: t.success,
        duration_ms: t.trace?.duration_ms,
        error: t.error?.message
      }))
    };
  }

  /**
   * Compile only (no execution)
   */
  async compile(source) {
    const ast = await this.parser.parse(source);
    const normalizedAST = this.normalizer.normalize(ast);
    const kpi = await this.emitter.emit(normalizedAST, { source });

    return {
      ast: normalizedAST,
      kpi
    };
  }

  /**
   * Execute KPI binary directly
   */
  async executeKPI(kpiBuffer) {
    // Decode KPI
    if (typeof KPI !== 'undefined') {
      const ast = await KPI.decode(kpiBuffer);
      return this.executor.execute(ast);
    }

    if (typeof require !== 'undefined') {
      const kpi = require('./kpi-encoder.js');
      const ast = await kpi.decode(kpiBuffer);
      return this.executor.execute(ast);
    }

    throw new Error('KPI decoder not available');
  }

  /**
   * Check if Python adapter is available
   */
  async checkPython() {
    return this.router.checkAvailability('python');
  }
}

// ============================================================
// Convenience Functions
// ============================================================

/**
 * Create foreign call AST node
 */
function foreignCall(host, module, symbol, args = []) {
  return {
    type: 'GlyphStatement',
    glyph: { type: 'Identifier', name: 'ForeignCall' },
    arguments: [
      { type: 'StringLiteral', value: host },
      { type: 'StringLiteral', value: module },
      { type: 'StringLiteral', value: symbol },
      { type: 'ArrayExpression', elements: args.map(a => ({ type: 'Literal', value: a })) }
    ]
  };
}

/**
 * Create Python call shorthand
 */
function pythonCall(module, symbol, args = []) {
  return foreignCall('python', module, symbol, args);
}

/**
 * Create numpy operation
 */
function numpy(symbol, args = []) {
  return pythonCall('numpy', symbol, args);
}

/**
 * Create torch operation
 */
function torch(symbol, args = []) {
  return pythonCall('torch', symbol, args);
}

// ============================================================
// Exports
// ============================================================

const Pipeline = {
  // Classes
  KUHULPipeline,
  SourceParser,
  ASTNormalizer,
  KPIEmitter,
  HostRouter,
  EffectExecutor,
  StepResult,

  // Constants
  PHASES,

  // Helpers
  foreignCall,
  pythonCall,
  numpy,
  torch,

  /**
   * Quick run: source → results
   */
  async run(source, options = {}) {
    const pipeline = new KUHULPipeline(options);
    return pipeline.run(source, options);
  },

  /**
   * Compile only
   */
  async compile(source, options = {}) {
    const pipeline = new KUHULPipeline(options);
    return pipeline.compile(source);
  },

  /**
   * Execute KPI
   */
  async executeKPI(kpiBuffer, options = {}) {
    const pipeline = new KUHULPipeline(options);
    return pipeline.executeKPI(kpiBuffer);
  }
};

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Pipeline;
}
if (typeof window !== 'undefined') {
  window.KUHULPipeline = Pipeline;
}
if (typeof globalThis !== 'undefined') {
  globalThis.KUHULPipeline = Pipeline;
}
