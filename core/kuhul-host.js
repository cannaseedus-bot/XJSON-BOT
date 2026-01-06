/**
 * KUHUL_JS_HOST_v1
 * ================
 *
 * K'UHUL Runtime Host for Browser/SW/Edge Execution
 *
 * JavaScript NEVER implements logic.
 * JavaScript ONLY:
 *   - exposes host intrinsics
 *   - routes events
 *   - invokes K'UHUL execution phases
 *
 * K'UHUL:
 *   - owns state
 *   - owns order
 *   - owns determinism
 *   - owns output
 *
 * Think of JS as wires and switches, K'UHUL as physics.
 */

(function(global) {
  'use strict';

  // ============================================================
  // KHL PARSER
  // ============================================================

  /**
   * Parse KHL source into phase AST
   */
  function parseKHL(source) {
    const phases = {
      Pop: [],
      Wo: [],
      Sek: [],
      Collapse: []
    };

    const phaseRegex = /@(Pop|Wo|Sek|Collapse)\s*\{([\s\S]*?)\n\}/g;
    let match;

    while ((match = phaseRegex.exec(source)) !== null) {
      const phaseName = match[1];
      const phaseBody = match[2];
      phases[phaseName] = parsePhaseBody(phaseBody);
    }

    return phases;
  }

  /**
   * Parse phase body into statements
   */
  function parsePhaseBody(body) {
    const statements = [];
    const lines = body.split('\n');
    let currentBlock = null;
    let braceDepth = 0;

    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) continue;

      // Track brace depth for nested blocks
      braceDepth += (line.match(/\{/g) || []).length;
      braceDepth -= (line.match(/\}/g) || []).length;

      if (currentBlock !== null) {
        currentBlock.body.push(trimmed);
        if (braceDepth === 0) {
          statements.push(currentBlock);
          currentBlock = null;
        }
        continue;
      }

      // Parse different statement types
      const stmt = parseStatement(trimmed);
      if (stmt) {
        if (stmt.type === 'foreach' || stmt.type === 'if' || stmt.type === 'while' || stmt.type === 'try') {
          currentBlock = stmt;
          if (braceDepth === 0) {
            statements.push(stmt);
            currentBlock = null;
          }
        } else {
          statements.push(stmt);
        }
      }
    }

    return statements;
  }

  /**
   * Parse individual statement
   */
  function parseStatement(line) {
    // let assignment
    const letMatch = line.match(/^let\s+(\w+)\s*=\s*(.+)$/);
    if (letMatch) {
      return {
        type: 'let',
        name: letMatch[1],
        value: parseExpr(letMatch[2])
      };
    }

    // Simple assignment
    const assignMatch = line.match(/^([\w.[\]]+)\s*=\s*(.+)$/);
    if (assignMatch && !line.startsWith('let ')) {
      return {
        type: 'assign',
        target: parseExpr(assignMatch[1]),
        value: parseExpr(assignMatch[2])
      };
    }

    // Augmented assignment
    const augMatch = line.match(/^([\w.[\]]+)\s*([+\-*/%])=\s*(.+)$/);
    if (augMatch) {
      return {
        type: 'aug_assign',
        target: parseExpr(augMatch[1]),
        op: augMatch[2],
        value: parseExpr(augMatch[3])
      };
    }

    // foreach
    const foreachMatch = line.match(/^foreach\s+(.+)\s+as\s+(\w+)\s*\{?$/);
    if (foreachMatch) {
      return {
        type: 'foreach',
        iter: parseExpr(foreachMatch[1]),
        target: foreachMatch[2],
        body: []
      };
    }

    // @if
    const ifMatch = line.match(/^@if\s+(.+)$/);
    if (ifMatch) {
      return {
        type: 'if',
        test: parseExpr(ifMatch[1]),
        then: [],
        else: [],
        body: []
      };
    }

    // while
    const whileMatch = line.match(/^while\s+(.+)\s*\{?$/);
    if (whileMatch) {
      return {
        type: 'while',
        test: parseExpr(whileMatch[1]),
        body: []
      };
    }

    // Function call (fs.scan, emit.json, etc.)
    const callMatch = line.match(/^([\w.]+)\s*\{/);
    if (callMatch) {
      return {
        type: 'call_block',
        func: callMatch[1],
        args: parseObjectLiteral(line.slice(callMatch[0].length - 1))
      };
    }

    // Simple function call
    const simpleCallMatch = line.match(/^([\w.]+)\s*\((.*)?\)$/);
    if (simpleCallMatch) {
      return {
        type: 'call',
        func: simpleCallMatch[1],
        args: simpleCallMatch[2] ? parseArgs(simpleCallMatch[2]) : []
      };
    }

    // Method chain (e.g., index.push({...}))
    const methodMatch = line.match(/^(\w+)\.(\w+)\s*\((.*)?\)$/);
    if (methodMatch) {
      return {
        type: 'method_call',
        object: methodMatch[1],
        method: methodMatch[2],
        args: methodMatch[3] ? [parseExpr(methodMatch[3])] : []
      };
    }

    // Expression statement
    return {
      type: 'expr',
      expr: parseExpr(line)
    };
  }

  /**
   * Parse expression
   */
  function parseExpr(str) {
    if (!str) return null;
    str = str.trim();

    // Remove trailing semicolons/commas
    str = str.replace(/[;,]$/, '').trim();

    // String literal
    if ((str.startsWith('"') && str.endsWith('"')) ||
        (str.startsWith("'") && str.endsWith("'"))) {
      return { type: 'string', value: str.slice(1, -1) };
    }

    // Number literal
    if (/^-?\d+(\.\d+)?$/.test(str)) {
      return { type: 'number', value: parseFloat(str) };
    }

    // Boolean
    if (str === 'true') return { type: 'boolean', value: true };
    if (str === 'false') return { type: 'boolean', value: false };
    if (str === 'null') return { type: 'null', value: null };

    // Array literal
    if (str.startsWith('[') && str.endsWith(']')) {
      return { type: 'array', value: parseArrayLiteral(str) };
    }

    // Object literal
    if (str.startsWith('{') && str.endsWith('}')) {
      return { type: 'object', value: parseObjectLiteral(str) };
    }

    // Function call
    const callMatch = str.match(/^([\w.]+)\s*\((.*)\)$/);
    if (callMatch) {
      return {
        type: 'call',
        func: callMatch[1],
        args: parseArgs(callMatch[2])
      };
    }

    // Member access (a.b or a[b])
    if (str.includes('.') || str.includes('[')) {
      return { type: 'member', path: str };
    }

    // Binary operation
    const binOps = ['&&', '||', '==', '!=', '<=', '>=', '<', '>', '+', '-', '*', '/', '%'];
    for (const op of binOps) {
      const idx = str.lastIndexOf(` ${op} `);
      if (idx > 0) {
        return {
          type: 'binary',
          op: op,
          left: parseExpr(str.slice(0, idx)),
          right: parseExpr(str.slice(idx + op.length + 2))
        };
      }
    }

    // Identifier
    return { type: 'identifier', name: str };
  }

  /**
   * Parse array literal
   */
  function parseArrayLiteral(str) {
    const inner = str.slice(1, -1).trim();
    if (!inner) return [];

    const items = [];
    let depth = 0;
    let current = '';

    for (const char of inner) {
      if (char === '[' || char === '{') depth++;
      else if (char === ']' || char === '}') depth--;
      else if (char === ',' && depth === 0) {
        items.push(parseExpr(current.trim()));
        current = '';
        continue;
      }
      current += char;
    }
    if (current.trim()) {
      items.push(parseExpr(current.trim()));
    }

    return items;
  }

  /**
   * Parse object literal
   */
  function parseObjectLiteral(str) {
    const inner = str.slice(1, -1).trim();
    if (!inner) return {};

    const obj = {};
    let depth = 0;
    let currentKey = '';
    let currentValue = '';
    let inValue = false;

    for (let i = 0; i < inner.length; i++) {
      const char = inner[i];

      if (char === '[' || char === '{') depth++;
      else if (char === ']' || char === '}') depth--;

      if (char === ':' && depth === 0 && !inValue) {
        inValue = true;
        continue;
      }

      if ((char === ',' || char === '\n') && depth === 0 && inValue) {
        if (currentKey.trim() && currentValue.trim()) {
          obj[currentKey.trim()] = parseExpr(currentValue.trim());
        }
        currentKey = '';
        currentValue = '';
        inValue = false;
        continue;
      }

      if (inValue) {
        currentValue += char;
      } else {
        currentKey += char;
      }
    }

    if (currentKey.trim() && currentValue.trim()) {
      obj[currentKey.trim()] = parseExpr(currentValue.trim());
    }

    return obj;
  }

  /**
   * Parse function arguments
   */
  function parseArgs(str) {
    if (!str.trim()) return [];

    const args = [];
    let depth = 0;
    let current = '';

    for (const char of str) {
      if (char === '(' || char === '[' || char === '{') depth++;
      else if (char === ')' || char === ']' || char === '}') depth--;
      else if (char === ',' && depth === 0) {
        args.push(parseExpr(current.trim()));
        current = '';
        continue;
      }
      current += char;
    }
    if (current.trim()) {
      args.push(parseExpr(current.trim()));
    }

    return args;
  }

  // ============================================================
  // HOST INTRINSICS
  // ============================================================

  /**
   * File System intrinsics
   */
  function HostFS(context) {
    return {
      scan(options = {}) {
        // If files provided via upload/drop
        if (context.files) {
          return context.files.map(f => ({
            path: f.webkitRelativePath || f.name,
            bytes: f._bytes || null,
            size: f.size,
            type: f.type
          }));
        }

        // Virtual FS from context
        if (context.vfs) {
          return Object.entries(context.vfs).map(([path, data]) => ({
            path,
            bytes: data.bytes || data,
            size: data.size || (data.bytes ? data.bytes.length : 0)
          }));
        }

        // Workspace files
        if (context.workspace) {
          return context.workspace;
        }

        return [];
      },

      read(path) {
        if (context.vfs && context.vfs[path]) {
          return context.vfs[path];
        }
        throw new Error(`File not found: ${path}`);
      },

      exists(path) {
        return !!(context.vfs && context.vfs[path]);
      },

      bytes(file) {
        if (file.bytes) return file.bytes;
        if (file._bytes) return file._bytes;
        throw new Error('Bytes not loaded for file');
      },

      text(file) {
        const bytes = this.bytes(file);
        return new TextDecoder().decode(bytes);
      }
    };
  }

  /**
   * Crypto/Hash intrinsics
   */
  function HostCrypto() {
    return {
      async sha256(data) {
        const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
        const hash = await crypto.subtle.digest('SHA-256', bytes);
        return this.hex(new Uint8Array(hash));
      },

      async sha1(data) {
        const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
        const hash = await crypto.subtle.digest('SHA-1', bytes);
        return this.hex(new Uint8Array(hash));
      },

      async md5(data) {
        // MD5 not in SubtleCrypto, use simple implementation or external
        return this.simpleHash(data, 'md5');
      },

      async blake3(data) {
        // BLAKE3 requires external library, fallback to SHA-256
        return this.sha256(data);
      },

      hex(bytes) {
        return Array.from(bytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      },

      simpleHash(data, algo) {
        // Simple hash for non-crypto purposes
        const str = typeof data === 'string' ? data : new TextDecoder().decode(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
      }
    };
  }

  /**
   * Compression Calculus intrinsics (CC-v1)
   */
  function HostCompression() {
    return {
      pack(data, mode = 'SCXQ2', level = 9) {
        // In browser, use CompressionStream if available
        if (typeof CompressionStream !== 'undefined' && mode === 'gzip') {
          return this.compressStream(data, 'gzip');
        }

        // Fallback: base64 encode (no actual compression)
        const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
        const base64 = btoa(String.fromCharCode(...bytes));

        return {
          mode,
          level,
          bytes: base64.length,
          data: base64,
          original: bytes.length
        };
      },

      unpack(packed) {
        if (packed.mode === 'base64' || !packed.mode) {
          const binary = atob(packed.data);
          return new Uint8Array(binary.split('').map(c => c.charCodeAt(0)));
        }
        return packed.data;
      },

      chunk(data, size = 262144) {
        const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
        const chunks = [];

        for (let i = 0; i < bytes.length; i += size) {
          chunks.push(bytes.slice(i, i + size));
        }

        return chunks;
      },

      async compressStream(data, format) {
        const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
        const stream = new Blob([bytes]).stream();
        const compressed = stream.pipeThrough(new CompressionStream(format));
        const reader = compressed.getReader();
        const chunks = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        const result = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }

        return result;
      }
    };
  }

  /**
   * Text processing intrinsics
   */
  function HostText() {
    return {
      normalize(data) {
        const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
        return text
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .normalize('NFC');
      },

      encode(str, encoding = 'utf-8') {
        return new TextEncoder().encode(str);
      },

      decode(bytes, encoding = 'utf-8') {
        return new TextDecoder(encoding).decode(bytes);
      },

      trim(str) {
        return str.trim();
      },

      split(str, sep) {
        return str.split(sep);
      },

      join(arr, sep) {
        return arr.join(sep);
      },

      replace(str, from, to) {
        return str.replace(new RegExp(from, 'g'), to);
      },

      lower(str) {
        return str.toLowerCase();
      },

      upper(str) {
        return str.toUpperCase();
      },

      startsWith(str, prefix) {
        return str.startsWith(prefix);
      },

      endsWith(str, suffix) {
        return str.endsWith(suffix);
      }
    };
  }

  /**
   * MIME type detection
   */
  function HostMime() {
    const MIME_MAP = {
      '.json': 'application/json',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.ts': 'text/typescript',
      '.jsx': 'text/javascript',
      '.tsx': 'text/typescript',
      '.html': 'text/html',
      '.htm': 'text/html',
      '.css': 'text/css',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.xml': 'application/xml',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.otf': 'font/otf',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.gz': 'application/gzip',
      '.wasm': 'application/wasm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.py': 'text/x-python',
      '.rb': 'text/x-ruby',
      '.go': 'text/x-go',
      '.rs': 'text/x-rust',
      '.c': 'text/x-c',
      '.cpp': 'text/x-c++',
      '.h': 'text/x-c',
      '.java': 'text/x-java',
      '.khl': 'text/x-kuhul',
      '.xjson': 'application/x-xjson'
    };

    return {
      of(path) {
        const ext = '.' + path.split('.').pop().toLowerCase();
        return MIME_MAP[ext] || 'application/octet-stream';
      },

      isText(mime) {
        return mime.startsWith('text/') ||
               mime === 'application/json' ||
               mime === 'application/xml' ||
               mime.endsWith('+xml');
      },

      isBinary(mime) {
        return !this.isText(mime);
      }
    };
  }

  /**
   * Path utilities
   */
  function HostPath() {
    return {
      ext(path) {
        const parts = path.split('.');
        return parts.length > 1 ? '.' + parts.pop() : '';
      },

      stem(path) {
        const name = this.name(path);
        const ext = this.ext(path);
        return ext ? name.slice(0, -ext.length) : name;
      },

      name(path) {
        return path.split('/').pop();
      },

      parent(path) {
        const parts = path.split('/');
        parts.pop();
        return parts.join('/') || '/';
      },

      join(...parts) {
        return parts.join('/').replace(/\/+/g, '/');
      },

      relative(path, base) {
        if (path.startsWith(base)) {
          return path.slice(base.length).replace(/^\//, '');
        }
        return path;
      }
    };
  }

  /**
   * Emit intrinsics (output)
   */
  function HostEmit(context, state) {
    return {
      json(obj) {
        const json = JSON.stringify(obj, null, 2);

        if (context.mode === 'download' || context.mode === 'button') {
          this.download(json, context.filename || 'bundle.json', 'application/json');
        }

        if (context.mode === 'api' && context.apiEndpoint) {
          fetch(context.apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: json
          });
        }

        if (context.mode === 'idb' && context.store) {
          this.saveToIDB(context.store, obj);
        }

        // Always return for chaining
        state._output = obj;
        return obj;
      },

      download(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      },

      async saveToIDB(store, data) {
        const request = indexedDB.open('KUHUL_DB', 1);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'id' });
          }
        };
        request.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction(store, 'readwrite');
          tx.objectStore(store).put({ id: Date.now(), data });
        };
      },

      null() {
        state._output = null;
        return null;
      }
    };
  }

  // ============================================================
  // PROVIDER CONFIGURATION
  // ============================================================

  const PROVIDERS = {
    'mx2lm': {
      type: 'api',
      baseUrl: 'https://mx2lm.app/api.php',
      models: ['janus-pro', 'janus-flow', 'mx2-inference', 'kuhul-quantum', 'cline-agent']
    },
    'transformers.js': {
      type: 'browser',
      models: ['qwen-0.5b', 'qwen-1.5b', 'phi-2', 'tinyllama', 'smollm']
    },
    'ollama': {
      type: 'local',
      baseUrl: 'http://localhost:11434',
      models: ['llama3', 'mistral', 'codellama', 'qwen2']
    },
    'openai': {
      type: 'api',
      baseUrl: 'https://api.openai.com/v1',
      models: ['gpt-4', 'gpt-4o', 'gpt-3.5-turbo']
    },
    'deepseek': {
      type: 'api',
      baseUrl: 'https://api.deepseek.com',
      models: ['deepseek-r1', 'deepseek-coder']
    }
  };

  // Model to provider mapping
  const MODEL_PROVIDER_MAP = {
    // MX2LM models
    'janus-pro': 'mx2lm',
    'janus-flow': 'mx2lm',
    'mx2-inference': 'mx2lm',
    'kuhul-quantum': 'mx2lm',
    'cline-agent': 'mx2lm',

    // Browser-native (Transformers.js)
    'qwen-0.5b': 'transformers.js',
    'qwen-1.5b': 'transformers.js',
    'qwen-asx': 'transformers.js',
    'phi-2': 'transformers.js',
    'tinyllama': 'transformers.js',
    'smollm': 'transformers.js',

    // Ollama (local)
    'llama3': 'ollama',
    'mistral': 'ollama',
    'codellama': 'ollama',
    'qwen2': 'ollama',

    // OpenAI
    'gpt-4': 'openai',
    'gpt-4o': 'openai',
    'gpt-3.5-turbo': 'openai',

    // DeepSeek
    'deepseek-r1': 'deepseek',
    'deepseek-coder': 'deepseek'
  };

  /**
   * Get provider for a model
   */
  function getProviderForModel(modelId) {
    const normalized = (modelId || '').toLowerCase();

    // Direct match
    if (MODEL_PROVIDER_MAP[normalized]) {
      return MODEL_PROVIDER_MAP[normalized];
    }

    // Partial match
    for (const [key, provider] of Object.entries(MODEL_PROVIDER_MAP)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return provider;
      }
    }

    // Default to MX2LM
    return 'mx2lm';
  }

  // ============================================================
  // TRANSFORMERS.JS INTEGRATION
  // ============================================================

  // Transformers.js model cache
  const TransformersCache = {
    pipelines: new Map(),
    loading: new Map(),

    async loadPipeline(modelId, task = 'text-generation') {
      const cacheKey = `${task}:${modelId}`;

      // Return cached pipeline
      if (this.pipelines.has(cacheKey)) {
        return this.pipelines.get(cacheKey);
      }

      // Wait if already loading
      if (this.loading.has(cacheKey)) {
        return this.loading.get(cacheKey);
      }

      // Load new pipeline
      const loadPromise = this._loadPipeline(modelId, task);
      this.loading.set(cacheKey, loadPromise);

      try {
        const pipeline = await loadPromise;
        this.pipelines.set(cacheKey, pipeline);
        this.loading.delete(cacheKey);
        return pipeline;
      } catch (err) {
        this.loading.delete(cacheKey);
        throw err;
      }
    },

    async _loadPipeline(modelId, task) {
      // Check if Transformers.js is available
      if (typeof window === 'undefined' || !window.Transformers) {
        // Try to dynamically import
        try {
          const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.0');
          return await pipeline(task, this.getHFModelId(modelId), {
            device: 'webgpu',
            progress_callback: (progress) => {
              console.log(`[Transformers.js] Loading ${modelId}: ${Math.round(progress.progress || 0)}%`);
            }
          });
        } catch (err) {
          console.error('[Transformers.js] Failed to load:', err);
          throw new Error(`Transformers.js not available: ${err.message}`);
        }
      }

      // Use global Transformers
      return await window.Transformers.pipeline(task, this.getHFModelId(modelId));
    },

    // Map local model ID to HuggingFace model ID
    getHFModelId(modelId) {
      const HF_MODEL_MAP = {
        'qwen-0.5b': 'Xenova/Qwen2.5-0.5B-Instruct',
        'qwen-1.5b': 'Xenova/Qwen2.5-1.5B-Instruct',
        'qwen-asx': 'Xenova/Qwen2.5-0.5B-Instruct',
        'phi-2': 'Xenova/phi-2',
        'tinyllama': 'Xenova/TinyLlama-1.1B-Chat-v1.0',
        'smollm': 'Xenova/SmolLM-135M-Instruct'
      };

      return HF_MODEL_MAP[modelId.toLowerCase()] || modelId;
    },

    async unload(modelId) {
      const keysToDelete = [];
      for (const key of this.pipelines.keys()) {
        if (key.includes(modelId)) {
          keysToDelete.push(key);
        }
      }
      for (const key of keysToDelete) {
        this.pipelines.delete(key);
      }
    }
  };

  /**
   * Inference intrinsics with multi-provider routing
   */
  function HostInfer(context) {
    const apiBase = context.apiBase || 'https://mx2lm.app/api.php';

    return {
      /**
       * Text generation with automatic provider routing
       */
      async generate(args) {
        const modelId = args.model || 'janus-pro';
        const provider = args.provider || getProviderForModel(modelId);

        console.log(`[Infer] Model: ${modelId}, Provider: ${provider}`);

        switch (provider) {
          case 'transformers.js':
            return this._generateTransformers(args);

          case 'ollama':
            return this._generateOllama(args);

          case 'openai':
            return this._generateOpenAI(args);

          case 'deepseek':
            return this._generateDeepSeek(args);

          case 'mx2lm':
          default:
            return this._generateMX2LM(args);
        }
      },

      /**
       * Generate with Transformers.js (browser-native)
       */
      async _generateTransformers(args) {
        try {
          const pipeline = await TransformersCache.loadPipeline(args.model);

          // Build prompt with correct template
          const prompt = typeof args.prompt === 'string'
            ? args.prompt
            : HostChatPrompt().build({ model: args.model, ...args.prompt });

          const output = await pipeline(prompt, {
            max_new_tokens: args.max_tokens || 256,
            temperature: args.temperature || 0.7,
            top_p: args.top_p || 0.95,
            do_sample: (args.temperature || 0.7) > 0
          });

          const text = output[0]?.generated_text || '';
          // Extract only the new text (remove prompt)
          const newText = text.slice(prompt.length).trim();

          return {
            text: newText,
            tokens: newText.split(/\s+/).length,
            model: args.model,
            provider: 'transformers.js',
            device: 'browser'
          };
        } catch (err) {
          console.error('[Transformers.js] Error:', err);
          return {
            text: `[Browser inference error: ${err.message}]`,
            tokens: 0,
            error: err.message,
            provider: 'transformers.js'
          };
        }
      },

      /**
       * Generate with Ollama (local)
       */
      async _generateOllama(args) {
        const endpoint = context.ollamaEndpoint || 'http://localhost:11434/api/generate';

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: args.model,
              prompt: args.prompt,
              options: {
                num_predict: args.max_tokens || 256,
                temperature: args.temperature || 0.7,
                top_p: args.top_p || 0.95
              },
              stream: false
            })
          });

          const data = await res.json();

          return {
            text: data.response || '',
            tokens: data.eval_count || 0,
            model: args.model,
            provider: 'ollama'
          };
        } catch (err) {
          console.error('[Ollama] Error:', err);
          return {
            text: `[Ollama error: ${err.message}]`,
            tokens: 0,
            error: err.message,
            provider: 'ollama'
          };
        }
      },

      /**
       * Generate with OpenAI API
       */
      async _generateOpenAI(args) {
        const endpoint = 'https://api.openai.com/v1/chat/completions';
        const apiKey = context.openaiApiKey || args.apiKey;

        if (!apiKey) {
          return { text: '[OpenAI API key required]', tokens: 0, error: 'No API key' };
        }

        try {
          // Build messages array
          const messages = Array.isArray(args.prompt)
            ? args.prompt
            : HostChatPrompt().build({ model: 'openai', ...args });

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: args.model || 'gpt-3.5-turbo',
              messages,
              max_tokens: args.max_tokens || 256,
              temperature: args.temperature || 0.7
            })
          });

          const data = await res.json();

          return {
            text: data.choices?.[0]?.message?.content || '',
            tokens: data.usage?.total_tokens || 0,
            model: args.model,
            provider: 'openai'
          };
        } catch (err) {
          console.error('[OpenAI] Error:', err);
          return {
            text: `[OpenAI error: ${err.message}]`,
            tokens: 0,
            error: err.message,
            provider: 'openai'
          };
        }
      },

      /**
       * Generate with DeepSeek API
       */
      async _generateDeepSeek(args) {
        const endpoint = 'https://api.deepseek.com/v1/chat/completions';
        const apiKey = context.deepseekApiKey || args.apiKey;

        if (!apiKey) {
          // Fall back to MX2LM which proxies DeepSeek
          return this._generateMX2LM(args);
        }

        try {
          const messages = [
            { role: 'user', content: args.prompt }
          ];

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: args.model || 'deepseek-chat',
              messages,
              max_tokens: args.max_tokens || 256,
              temperature: args.temperature || 0.7
            })
          });

          const data = await res.json();

          return {
            text: data.choices?.[0]?.message?.content || '',
            tokens: data.usage?.total_tokens || 0,
            model: args.model,
            provider: 'deepseek'
          };
        } catch (err) {
          console.error('[DeepSeek] Error:', err);
          return this._generateMX2LM(args);  // Fallback
        }
      },

      /**
       * Generate with MX2LM API (default)
       */
      async _generateMX2LM(args) {
        const payload = {
          action: 'chat',
          model: args.model || 'janus-pro',
          prompt: args.prompt,
          max_tokens: args.max_tokens || 256,
          temperature: args.temperature || 0.7,
          top_p: args.top_p || 0.95
        };

        const endpoint = context.inferEndpoint || apiBase;

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await res.json();

          return {
            text: data.response || data.text || data.content || '',
            tokens: data.tokens || data.usage?.total_tokens || 0,
            model: args.model,
            provider: 'mx2lm',
            raw: data
          };
        } catch (err) {
          console.error('[MX2LM] Error:', err);
          return {
            text: `[Inference error: ${err.message}]`,
            tokens: 0,
            error: err.message,
            provider: 'mx2lm'
          };
        }
      },

      /**
       * Streaming text generation
       */
      async stream(args, onToken) {
        const payload = {
          action: 'chat_stream',
          model: args.model || 'janus-pro',
          prompt: args.prompt,
          max_tokens: args.max_tokens || 256,
          temperature: args.temperature || 0.7,
          stream: true
        };

        const endpoint = context.inferEndpoint || apiBase;

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let fullText = '';
          let tokens = 0;

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullText += chunk;
            tokens++;

            if (onToken) onToken(chunk);
          }

          return { text: fullText, tokens };
        } catch (err) {
          console.error('Stream error:', err);
          return { text: '', tokens: 0, error: err.message };
        }
      },

      /**
       * Vision inference (image understanding)
       */
      async vision(args) {
        const payload = {
          action: 'vision',
          model: args.model || 'janus-pro',
          image: args.image,  // base64 encoded
          prompt: args.prompt || 'Describe this image.',
          max_tokens: args.max_tokens || 512,
          temperature: args.temperature || 0.3
        };

        const endpoint = context.inferEndpoint || apiBase;

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await res.json();

          return {
            text: data.response || data.description || '',
            tokens: data.tokens || 0,
            model: args.model,
            raw: data
          };
        } catch (err) {
          console.error('Vision error:', err);
          return { text: '', tokens: 0, error: err.message };
        }
      },

      /**
       * Image generation
       */
      async generate_image(args) {
        const payload = {
          action: 'generate_image',
          model: args.model || 'janus-flow',
          prompt: args.prompt,
          negative_prompt: args.negative_prompt || '',
          width: args.width || 512,
          height: args.height || 512,
          steps: args.steps || 30,
          guidance_scale: args.guidance_scale || 7.5,
          seed: args.seed || Date.now()
        };

        const endpoint = context.inferEndpoint || apiBase;

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await res.json();

          return {
            image: data.image || data.base64 || '',
            format: 'png',
            seed: args.seed,
            model: args.model,
            raw: data
          };
        } catch (err) {
          console.error('Image gen error:', err);
          return { image: '', error: err.message };
        }
      }
    };
  }

  // ============================================================
  // MODEL-SPECIFIC PROMPT TEMPLATES
  // ============================================================

  const PROMPT_TEMPLATES = {
    // Qwen 2.5 family (including Qwen-ASX)
    'qwen': {
      system: (s) => `<|im_start|>system\n${s}<|im_end|>\n`,
      user: (u) => `<|im_start|>user\n${u}<|im_end|>\n`,
      assistant: (a) => a ? `<|im_start|>assistant\n${a}<|im_end|>\n` : `<|im_start|>assistant\n`,
      stop: ['<|im_end|>', '<|endoftext|>']
    },

    // Llama 3 family
    'llama3': {
      system: (s) => `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${s}<|eot_id|>`,
      user: (u) => `<|start_header_id|>user<|end_header_id|>\n\n${u}<|eot_id|>`,
      assistant: (a) => a ? `<|start_header_id|>assistant<|end_header_id|>\n\n${a}<|eot_id|>` : `<|start_header_id|>assistant<|end_header_id|>\n\n`,
      stop: ['<|eot_id|>', '<|end_of_text|>']
    },

    // Mistral / Mixtral
    'mistral': {
      system: (s) => `<s>[INST] ${s}\n\n`,
      user: (u) => `[INST] ${u} [/INST]`,
      assistant: (a) => a ? `${a}</s>` : '',
      stop: ['</s>']
    },

    // DeepSeek family
    'deepseek': {
      system: (s) => `<|begin▁of▁sentence|>${s}\n\n`,
      user: (u) => `User: ${u}\n\n`,
      assistant: (a) => a ? `Assistant: ${a}<|end▁of▁sentence|>` : `Assistant: `,
      stop: ['<|end▁of▁sentence|>', 'User:']
    },

    // DeepSeek R1 (reasoning model)
    'deepseek-r1': {
      system: (s) => `<|begin▁of▁sentence|>${s}\n\n`,
      user: (u) => `User: ${u}\n\n`,
      assistant: (a) => a ? `Assistant: <think>${a}</think><|end▁of▁sentence|>` : `Assistant: `,
      stop: ['<|end▁of▁sentence|>', '</think>']
    },

    // Janus (MX2LM multimodal)
    'janus': {
      system: (s) => `[SYSTEM]\n${s}\n[/SYSTEM]\n`,
      user: (u) => `[USER]\n${u}\n[/USER]\n`,
      assistant: (a) => a ? `[ASSISTANT]\n${a}\n[/ASSISTANT]\n` : `[ASSISTANT]\n`,
      stop: ['[/ASSISTANT]', '[USER]']
    },

    // ChatML (default fallback)
    'chatml': {
      system: (s) => `<|system|>\n${s}\n`,
      user: (u) => `<|user|>\n${u}\n`,
      assistant: (a) => a ? `<|assistant|>\n${a}\n` : `<|assistant|>\n`,
      stop: ['<|user|>', '<|system|>']
    },

    // OpenAI-style (for API compatibility)
    'openai': {
      system: (s) => ({ role: 'system', content: s }),
      user: (u) => ({ role: 'user', content: u }),
      assistant: (a) => ({ role: 'assistant', content: a || '' }),
      stop: [],
      isMessages: true  // Returns message array, not string
    }
  };

  // Model ID to template mapping
  const MODEL_TEMPLATE_MAP = {
    // Qwen family
    'qwen': 'qwen',
    'qwen2': 'qwen',
    'qwen2.5': 'qwen',
    'qwen-coder': 'qwen',
    'qwen-asx': 'qwen',

    // Llama family
    'llama': 'llama3',
    'llama3': 'llama3',
    'llama-3': 'llama3',
    'codellama': 'llama3',

    // Mistral family
    'mistral': 'mistral',
    'mixtral': 'mistral',

    // DeepSeek family
    'deepseek': 'deepseek',
    'deepseek-coder': 'deepseek',
    'deepseek-r1': 'deepseek-r1',

    // Janus (MX2LM)
    'janus': 'janus',
    'janus-pro': 'janus',
    'janus-flow': 'janus',

    // MX2LM special models
    'mx2lm': 'janus',
    'mx2-inference': 'janus',
    'kuhul-quantum': 'janus',
    'cline-agent': 'janus',

    // OpenAI
    'gpt': 'openai',
    'gpt-4': 'openai',
    'gpt-3.5': 'openai',
    'chatgpt': 'openai'
  };

  /**
   * Get template for a model
   */
  function getTemplateForModel(modelId) {
    const normalizedId = (modelId || '').toLowerCase();

    // Direct match
    if (MODEL_TEMPLATE_MAP[normalizedId]) {
      return PROMPT_TEMPLATES[MODEL_TEMPLATE_MAP[normalizedId]];
    }

    // Partial match
    for (const [key, templateId] of Object.entries(MODEL_TEMPLATE_MAP)) {
      if (normalizedId.includes(key)) {
        return PROMPT_TEMPLATES[templateId];
      }
    }

    // Default to ChatML
    return PROMPT_TEMPLATES['chatml'];
  }

  /**
   * Chat prompt builder intrinsic (model-aware)
   */
  function HostChatPrompt() {
    return {
      /**
       * Build structured prompt from history
       * @param {object} args - { model, system, history, user }
       */
      build(args) {
        const template = getTemplateForModel(args.model);

        // OpenAI-style returns message array
        if (template.isMessages) {
          const messages = [];
          if (args.system) messages.push(template.system(args.system));
          if (args.history) {
            for (const msg of args.history) {
              if (msg.role === 'user') messages.push(template.user(msg.content));
              else messages.push(template.assistant(msg.content));
            }
          }
          if (args.user) messages.push(template.user(args.user));
          return messages;
        }

        // String-based templates
        const parts = [];

        if (args.system) {
          parts.push(template.system(args.system));
        }

        if (args.history && args.history.length > 0) {
          for (const msg of args.history) {
            if (msg.role === 'user') {
              parts.push(template.user(msg.content));
            } else {
              parts.push(template.assistant(msg.content));
            }
          }
        }

        if (args.user) {
          parts.push(template.user(args.user));
        }

        // Add assistant turn marker
        parts.push(template.assistant(''));

        return parts.join('');
      },

      /**
       * Build vision prompt (model-aware)
       */
      buildVision(args) {
        const template = getTemplateForModel(args.model);

        if (template.isMessages) {
          const messages = [];
          if (args.system) messages.push(template.system(args.system));
          messages.push({
            role: 'user',
            content: [
              { type: 'image', image: args.image },
              { type: 'text', text: args.user || 'Describe this image.' }
            ]
          });
          return messages;
        }

        const parts = [];
        if (args.system) {
          parts.push(template.system(args.system));
        }
        parts.push(template.user(`[Image: ${args.task || 'analyze'}]\n${args.user || 'Describe this image.'}`));
        parts.push(template.assistant(''));

        return parts.join('');
      },

      /**
       * Get stop tokens for a model
       */
      getStopTokens(modelId) {
        const template = getTemplateForModel(modelId);
        return template.stop || [];
      },

      /**
       * Get available templates
       */
      listTemplates() {
        return Object.keys(PROMPT_TEMPLATES);
      },

      /**
       * Get template info
       */
      getTemplate(templateId) {
        return PROMPT_TEMPLATES[templateId] || null;
      }
    };
  }

  /**
   * Image encoding utilities
   */
  function HostImage() {
    return {
      /**
       * Encode image to base64
       */
      encode(args) {
        const bytes = args.bytes || args;
        const format = args.format || 'png';
        const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
        return `data:image/${format};base64,${base64}`;
      },

      /**
       * Resize image (canvas-based)
       */
      async resize(imageData, maxSize = 1024) {
        // For browser with canvas
        if (typeof document !== 'undefined') {
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let { width, height } = img;

              if (width > maxSize || height > maxSize) {
                const ratio = Math.min(maxSize / width, maxSize / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, width, height);

              resolve(canvas.toDataURL('image/png'));
            };
            img.src = imageData;
          });
        }

        // Fallback: return as-is
        return imageData;
      }
    };
  }

  /**
   * Classification helper
   */
  function classify(path) {
    const groups = {
      theme: ['/themes/', '/styles/', '/css/', '.css', '.scss', '.less'],
      app: ['/app/', '/src/', '/components/', '.jsx', '.tsx', '.vue'],
      game: ['/game/', '/games/', '/play/', '.unity', '.godot'],
      guide: ['/docs/', '/guide/', '/help/', '.md', '.rst', '.txt'],
      kit: ['/kit/', '/lib/', '/vendor/', '/node_modules/']
    };

    for (const [group, patterns] of Object.entries(groups)) {
      if (patterns.some(p => path.includes(p))) {
        return group;
      }
    }

    return 'misc';
  }

  // ============================================================
  // PHASE EXECUTOR
  // ============================================================

  /**
   * Execute a single phase
   */
  async function executePhase(statements, env, state) {
    for (const stmt of statements) {
      await executeStatement(stmt, env, state);
    }
  }

  /**
   * Execute a statement
   */
  async function executeStatement(stmt, env, state) {
    switch (stmt.type) {
      case 'let':
        state[stmt.name] = await evalExpr(stmt.value, env, state);
        break;

      case 'assign':
        const target = resolveTarget(stmt.target, state);
        target.obj[target.key] = await evalExpr(stmt.value, env, state);
        break;

      case 'aug_assign':
        const augTarget = resolveTarget(stmt.target, state);
        const current = augTarget.obj[augTarget.key] || 0;
        const augValue = await evalExpr(stmt.value, env, state);
        switch (stmt.op) {
          case '+': augTarget.obj[augTarget.key] = current + augValue; break;
          case '-': augTarget.obj[augTarget.key] = current - augValue; break;
          case '*': augTarget.obj[augTarget.key] = current * augValue; break;
          case '/': augTarget.obj[augTarget.key] = current / augValue; break;
          case '%': augTarget.obj[augTarget.key] = current % augValue; break;
        }
        break;

      case 'foreach':
        const iterable = await evalExpr(stmt.iter, env, state);
        for (const item of iterable) {
          state[stmt.target] = item;
          for (const bodyStmt of stmt.body) {
            const parsed = parseStatement(bodyStmt);
            if (parsed) await executeStatement(parsed, env, state);
          }
        }
        break;

      case 'if':
        const test = await evalExpr(stmt.test, env, state);
        if (test) {
          for (const thenStmt of stmt.body.filter(l => l.includes('@then'))) {
            // Execute then block
          }
        }
        break;

      case 'while':
        while (await evalExpr(stmt.test, env, state)) {
          for (const bodyStmt of stmt.body) {
            const parsed = parseStatement(bodyStmt);
            if (parsed) await executeStatement(parsed, env, state);
          }
        }
        break;

      case 'call':
        await evalCall(stmt.func, stmt.args, env, state);
        break;

      case 'call_block':
        await evalCall(stmt.func, [stmt.args], env, state);
        break;

      case 'method_call':
        const obj = state[stmt.object];
        if (obj && typeof obj[stmt.method] === 'function') {
          const args = await Promise.all(stmt.args.map(a => evalExpr(a, env, state)));
          obj[stmt.method](...args);
        } else if (Array.isArray(obj)) {
          const args = await Promise.all(stmt.args.map(a => evalExpr(a, env, state)));
          if (stmt.method === 'push') obj.push(...args);
        }
        break;

      case 'expr':
        await evalExpr(stmt.expr, env, state);
        break;
    }
  }

  /**
   * Evaluate expression
   */
  async function evalExpr(expr, env, state) {
    if (!expr) return null;

    switch (expr.type) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'null':
        return expr.value;

      case 'array':
        return Promise.all(expr.value.map(e => evalExpr(e, env, state)));

      case 'object':
        const obj = {};
        for (const [k, v] of Object.entries(expr.value)) {
          obj[k] = await evalExpr(v, env, state);
        }
        return obj;

      case 'identifier':
        return resolvePath(expr.name, state, env);

      case 'member':
        return resolvePath(expr.path, state, env);

      case 'binary':
        const left = await evalExpr(expr.left, env, state);
        const right = await evalExpr(expr.right, env, state);
        return evalBinaryOp(expr.op, left, right);

      case 'call':
        return evalCall(expr.func, expr.args, env, state);

      default:
        return null;
    }
  }

  /**
   * Evaluate function call
   */
  async function evalCall(funcPath, args, env, state) {
    const parts = funcPath.split('.');
    const namespace = parts[0];
    const method = parts.slice(1).join('.');

    const evalArgs = await Promise.all(
      args.map(a => a.type ? evalExpr(a, env, state) : a)
    );

    // Route to intrinsics
    switch (namespace) {
      case 'fs':
        return env.fs[method]?.(...evalArgs);

      case 'hash':
        return env.crypto[method]?.(...evalArgs);

      case 'cc':
        return env.cc[method]?.(...evalArgs);

      case 'text':
        return env.text[method]?.(...evalArgs);

      case 'mime':
        return env.mime[method]?.(...evalArgs);

      case 'path':
        return env.path[method]?.(...evalArgs);

      case 'emit':
        return env.emit[method]?.(...evalArgs);

      case 'infer':
        return env.infer[method]?.(...evalArgs);

      case 'chat':
        if (method.startsWith('prompt.')) {
          const promptMethod = method.slice(7);
          return env.chat.prompt[promptMethod]?.(evalArgs[0]);
        }
        return null;

      case 'image':
        return env.image[method]?.(...evalArgs);

      case 'now':
        return Date.now();

      case 'len':
        const val = evalArgs[0];
        return val?.length ?? 0;

      case 'concat':
        return evalArgs.join('');

      case 'classify':
        return classify(evalArgs[0]);

      default:
        // Check state for custom functions
        if (state[funcPath] && typeof state[funcPath] === 'function') {
          return state[funcPath](...evalArgs);
        }
        console.warn(`Unknown function: ${funcPath}`);
        return null;
    }
  }

  /**
   * Evaluate binary operation
   */
  function evalBinaryOp(op, left, right) {
    switch (op) {
      case '+': return left + right;
      case '-': return left - right;
      case '*': return left * right;
      case '/': return left / right;
      case '%': return left % right;
      case '==': return left == right;
      case '!=': return left != right;
      case '<': return left < right;
      case '<=': return left <= right;
      case '>': return left > right;
      case '>=': return left >= right;
      case '&&': return left && right;
      case '||': return left || right;
      default: return null;
    }
  }

  /**
   * Resolve a dotted path to a value
   */
  function resolvePath(path, state, env) {
    const parts = path.split('.');
    let current = state;

    for (const part of parts) {
      if (current === undefined || current === null) {
        // Check env
        if (env[parts[0]]) {
          current = env;
        } else {
          return undefined;
        }
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Resolve assignment target
   */
  function resolveTarget(expr, state) {
    if (expr.type === 'identifier') {
      return { obj: state, key: expr.name };
    }

    if (expr.type === 'member') {
      const path = expr.path;
      const parts = path.split('.');
      let current = state;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        // Handle array access
        const bracketMatch = part.match(/^(\w+)\[(.+)\]$/);
        if (bracketMatch) {
          current = current[bracketMatch[1]][bracketMatch[2]];
        } else {
          if (current[part] === undefined) {
            current[part] = {};
          }
          current = current[part];
        }
      }

      const lastPart = parts[parts.length - 1];
      const bracketMatch = lastPart.match(/^(\w+)\[(.+)\]$/);
      if (bracketMatch) {
        return { obj: current[bracketMatch[1]], key: bracketMatch[2].replace(/['"]/g, '') };
      }

      return { obj: current, key: lastPart };
    }

    return { obj: state, key: 'unknown' };
  }

  // ============================================================
  // KUHUL MAIN RUNTIME
  // ============================================================

  const KUHUL = {
    programs: new Map(),
    VERSION: '1.0.0',

    /**
     * Register a KHL program
     */
    register(id, khlSource) {
      const ast = parseKHL(khlSource);
      this.programs.set(id, {
        id,
        source: khlSource,
        ast,
        registered: Date.now()
      });
      console.log(`⟁ KHL registered: ${id}`);
      return this;
    },

    /**
     * Execute a registered KHL program
     */
    async run(id, context = {}) {
      const program = this.programs.get(id);
      if (!program) {
        throw new Error(`KHL program not found: ${id}`);
      }

      console.log(`⟁ Executing: ${id}`);
      console.log(`  Mode: ${context.mode || 'default'}`);

      // Initialize state
      const state = {};

      // Create environment with intrinsics
      const env = {
        context,
        fs: HostFS(context),
        crypto: HostCrypto(),
        cc: HostCompression(),
        text: HostText(),
        mime: HostMime(),
        path: HostPath(),
        emit: HostEmit(context, state),
        infer: HostInfer(context),
        chat: { prompt: HostChatPrompt() },
        image: HostImage(),
        now: () => Date.now(),
        concat: (...args) => args.join('')
      };

      // Execute phases in order (MANDATORY)
      const startTime = performance.now();

      console.log('  @Pop...');
      await executePhase(program.ast.Pop, env, state);

      console.log('  @Wo...');
      await executePhase(program.ast.Wo, env, state);

      console.log('  @Sek...');
      await executePhase(program.ast.Sek, env, state);

      console.log('  @Collapse...');
      await executePhase(program.ast.Collapse, env, state);

      const duration = performance.now() - startTime;
      console.log(`⟁ Complete: ${id} (${duration.toFixed(2)}ms)`);

      return state._output || state;
    },

    /**
     * Load KHL from URL
     */
    async load(id, url) {
      const response = await fetch(url);
      const source = await response.text();
      return this.register(id, source);
    },

    /**
     * Get registered programs
     */
    list() {
      return Array.from(this.programs.keys());
    },

    /**
     * Get program info
     */
    info(id) {
      return this.programs.get(id);
    },

    /**
     * Parse KHL source (for debugging)
     */
    parse(source) {
      return parseKHL(source);
    }
  };

  // ============================================================
  // EVENT BINDING HELPERS
  // ============================================================

  KUHUL.bindButton = function(selector, programId, contextFn = () => ({})) {
    document.querySelector(selector)?.addEventListener('click', () => {
      this.run(programId, { mode: 'button', ...contextFn() });
    });
  };

  KUHUL.bindForm = function(selector, programId) {
    document.querySelector(selector)?.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      this.run(programId, { mode: 'form', params: data });
    });
  };

  KUHUL.bindFileInput = function(selector, programId, contextFn = () => ({})) {
    document.querySelector(selector)?.addEventListener('change', async (e) => {
      const files = [...e.target.files];

      // Pre-load file bytes
      for (const file of files) {
        file._bytes = new Uint8Array(await file.arrayBuffer());
      }

      this.run(programId, { mode: 'upload', files, ...contextFn() });
    });
  };

  KUHUL.bindDropZone = function(selector, programId, contextFn = () => ({})) {
    const zone = document.querySelector(selector);
    if (!zone) return;

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');

      const files = [...e.dataTransfer.files];

      // Pre-load file bytes
      for (const file of files) {
        file._bytes = new Uint8Array(await file.arrayBuffer());
      }

      this.run(programId, { mode: 'drop', files, ...contextFn() });
    });
  };

  KUHUL.autoRun = function(programId, context = {}) {
    window.addEventListener('load', () => {
      this.run(programId, { mode: 'auto', ...context });
    });
  };

  // ============================================================
  // EXPORT
  // ============================================================

  global.KUHUL = KUHUL;

  // Also export for module systems
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KUHUL;
  }

})(typeof window !== 'undefined' ? window : global);
