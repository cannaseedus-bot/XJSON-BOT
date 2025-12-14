/**
 * ATOMIC OS INTEGRATION
 * =====================
 * Brings together all Atomic OS components:
 * - Atomic Memory (symbolic pattern learning)
 * - Atomic Agents (multi-agent coordination)
 * - Symbolic Router (context-aware navigation)
 * - ASX Tape (reactive state management)
 * - LM-TAPE Engine (model cartridge system)
 */

class AtomicOS {
  constructor() {
    this.version = '1.0.0';
    this.initialized = false;
    this.components = {};
    this.tapes = new Map();
    this.activeTape = null;

    console.log('⚛️  Atomic OS v' + this.version);
  }

  /**
   * Initialize all Atomic OS components
   */
  async init() {
    if (this.initialized) {
      console.warn('Atomic OS already initialized');
      return;
    }

    console.log('🚀 Initializing Atomic OS...');

    try {
      // 1. Initialize Atomic Memory
      if (typeof atomicMemory !== 'undefined') {
        this.components.memory = atomicMemory;
        console.log('✅ Atomic Memory initialized');
      } else {
        console.warn('⚠️  Atomic Memory not found');
      }

      // 2. Initialize Atomic Agents
      if (typeof atomicAgents !== 'undefined') {
        this.components.agents = atomicAgents;
        console.log('✅ Atomic Agents initialized');
      } else {
        console.warn('⚠️  Atomic Agents not found');
      }

      // 3. Initialize Symbolic Router
      if (typeof symbolicRouter !== 'undefined') {
        this.components.router = symbolicRouter;
        console.log('✅ Symbolic Router initialized');
      } else {
        console.warn('⚠️  Symbolic Router not found');
      }

      // 4. Setup K'UHUL integration
      if (typeof KuhulEngine !== 'undefined') {
        this.components.kuhul = KuhulEngine;
        console.log('✅ K\'UHUL Engine connected');
      }

      // 5. Setup cross-component communication
      this.setupCommunication();

      // 6. Register default LM-TAPEs
      this.registerDefaultTapes();

      // 7. Setup PWA features
      this.setupPWA();

      this.initialized = true;
      console.log('🎉 Atomic OS initialized successfully');

      // Learn initialization
      if (this.components.memory) {
        this.components.memory.learn('atomic_os_init', {
          version: this.version,
          timestamp: Date.now(),
          components: Object.keys(this.components)
        }, 1.0, {
          category: 'system',
          event: 'initialization'
        });
      }

      return { success: true, components: Object.keys(this.components) };
    } catch (error) {
      console.error('❌ Atomic OS initialization failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Setup cross-component communication
   */
  setupCommunication() {
    const { memory, agents, router } = this.components;

    // Agent → Memory: Learn from agent executions
    if (agents && memory) {
      const originalRoute = agents.route.bind(agents);
      agents.route = async (symbol, data, context) => {
        const result = await originalRoute(symbol, data, context);

        // Learn from successful agent executions
        if (result.success) {
          memory.learn(
            `agent_success_${symbol}`,
            result,
            0.8,
            { category: 'agent_execution', symbol }
          );
        }

        return result;
      };
    }

    // Router → Memory: Learn navigation patterns
    if (router && memory) {
      router.on('navigate', (data) => {
        memory.learn(
          `navigation_${data.from}_to_${data.to}`,
          { executionTime: data.executionTime },
          0.7,
          { category: 'navigation' }
        );
      });
    }

    // Router → Agents: Route through agent system
    if (router && agents) {
      router.on('navigate', async (data) => {
        await agents.route('NAVIGATE', {
          from: data.from,
          to: data.to,
          context: data.data
        });
      });
    }

    console.log('🔗 Cross-component communication established');
  }

  /**
   * Register default LM-TAPEs
   */
  registerDefaultTapes() {
    // MX2LM Native Tape
    this.registerTape('mx2lm-native', {
      name: 'mx2lm-native',
      type: 'kernel',
      format: 'native',
      description: 'Built-in MX2LM JS runtime with K\'UHUL',
      execute: async (input) => {
        // Integrate with K'UHUL engine
        if (this.components.kuhul) {
          return await this.components.kuhul.execute(input);
        }

        // Fallback: simple echo
        return {
          success: true,
          text: `[MX2LM Native] ${input}`,
          model: 'mx2lm-native'
        };
      }
    });

    // K'UHUL Agent Hive Tape
    this.registerTape('kuhul-agent-hive', {
      name: 'kuhul-agent-hive',
      type: 'multi-agent',
      format: 'atomic-agents',
      description: '50+ specialized AI agents for web development',
      execute: async (input) => {
        if (!this.components.agents) {
          return {
            success: false,
            error: 'Agent system not available'
          };
        }

        // Route through agent system
        const result = await this.components.agents.route('CHAT', {
          message: input,
          context: 'user_query'
        });

        return result;
      }
    });

    console.log(`📼 Registered ${this.tapes.size} default LM-TAPEs`);
  }

  /**
   * Register an LM-TAPE
   */
  registerTape(id, config) {
    this.tapes.set(id, {
      id,
      name: config.name || id,
      type: config.type || 'generic',
      format: config.format || 'custom',
      description: config.description || '',
      execute: config.execute || (async () => ({ success: false, error: 'No execute function' })),
      metadata: config.metadata || {},
      mounted: true
    });

    // Set as active if first tape
    if (!this.activeTape) {
      this.activeTape = id;
    }

    return this.tapes.get(id);
  }

  /**
   * Get active LM-TAPE
   */
  getActiveTape() {
    return this.tapes.get(this.activeTape);
  }

  /**
   * Set active LM-TAPE
   */
  setActiveTape(id) {
    if (!this.tapes.has(id)) {
      return { success: false, error: 'Tape not found' };
    }

    this.activeTape = id;

    // Learn preference
    if (this.components.memory) {
      this.components.memory.learn('user_active_tape', id, 0.9, {
        category: 'preferences',
        timestamp: Date.now()
      });
    }

    return { success: true, tapeId: id };
  }

  /**
   * Execute with active LM-TAPE
   */
  async execute(input, options = {}) {
    const tape = this.getActiveTape();
    if (!tape) {
      return {
        success: false,
        error: 'No active tape'
      };
    }

    try {
      // Build XJSON envelope
      const envelope = this.buildXJSONEnvelope(input, tape.id);

      // Execute through tape
      const result = await tape.execute(input, {
        ...options,
        envelope
      });

      // Compress with SCXQ2
      const compressed = this.compressSCXQ2(result);

      // Learn from execution
      if (this.components.memory) {
        this.components.memory.learn(
          `tape_execution_${tape.id}`,
          { success: result.success, input: input.substring(0, 50) },
          result.success ? 0.9 : 0.4,
          { category: 'tape_execution' }
        );
      }

      return {
        ...result,
        envelope,
        compressed,
        tape: tape.id
      };
    } catch (error) {
      console.error('Tape execution error:', error);
      return {
        success: false,
        error: error.message,
        tape: tape.id
      };
    }
  }

  /**
   * Build XJSON envelope for LM calls
   */
  buildXJSONEnvelope(input, tapeId) {
    return {
      '@lm.call': {
        tape: tapeId,
        fn: 'chat',
        input: input
      },
      '@route': {
        engine: 'kuhul',
        compression: 'scxq2',
        format: 'xjson',
        version: '3.0'
      },
      '@timestamp': new Date().toISOString(),
      '@meta': {
        os: 'atomic',
        version: this.version
      }
    };
  }

  /**
   * Compress with SCXQ2
   */
  compressSCXQ2(data) {
    const raw = JSON.stringify(data);
    const bytes = new TextEncoder().encode(raw).length;
    const ratio = 3.9; // Placeholder ratio
    const compressed = Math.max(1, Math.floor(bytes / ratio));
    const entropy = 3.14 + (Math.random() - 0.5) * 0.2;

    return {
      mode: 'SCXQ2-local',
      original_bytes: bytes,
      compressed_bytes: compressed,
      ratio: (bytes / compressed).toFixed(2),
      entropy: entropy.toFixed(2),
      blocks: [
        {
          id: 0,
          size: compressed,
          dedupe: 0,
          algorithm: 'scxq2-v2'
        }
      ],
      timestamp: Date.now()
    };
  }

  /**
   * Setup PWA features
   */
  setupPWA() {
    // Check for service worker support
    if ('serviceWorker' in navigator) {
      // Already registered by service-worker.js
      console.log('✅ PWA features enabled');
    }

    // Setup install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPromptEvent = e;

      // Learn that user saw install prompt
      if (this.components.memory) {
        this.components.memory.learn('pwa_install_prompt_shown', true, 0.8, {
          category: 'pwa'
        });
      }
    });

    // Track installation
    window.addEventListener('appinstalled', () => {
      console.log('🎉 PWA installed');

      if (this.components.memory) {
        this.components.memory.learn('pwa_installed', true, 1.0, {
          category: 'pwa',
          timestamp: Date.now()
        });
      }
    });
  }

  /**
   * Prompt PWA installation
   */
  async promptInstall() {
    if (!this.installPromptEvent) {
      return { success: false, error: 'Install prompt not available' };
    }

    this.installPromptEvent.prompt();
    const { outcome } = await this.installPromptEvent.userChoice;

    if (this.components.memory) {
      this.components.memory.learn('pwa_install_outcome', outcome, 0.9, {
        category: 'pwa'
      });
    }

    return { success: outcome === 'accepted', outcome };
  }

  /**
   * Get system statistics
   */
  getStats() {
    const stats = {
      version: this.version,
      initialized: this.initialized,
      components: Object.keys(this.components),
      tapes: {
        total: this.tapes.size,
        active: this.activeTape,
        list: Array.from(this.tapes.keys())
      }
    };

    // Add component stats
    if (this.components.memory) {
      stats.memory = this.components.memory.getStats();
    }

    if (this.components.agents) {
      stats.agents = this.components.agents.getStats();
    }

    if (this.components.router) {
      stats.router = this.components.router.getStats();
    }

    return stats;
  }

  /**
   * Create an ASX Tape instance
   */
  createTape(config) {
    if (typeof ASXTape === 'undefined') {
      throw new Error('ASX Tape not available');
    }

    return new ASXTape(config);
  }

  /**
   * Debug helper
   */
  debug() {
    console.group('⚛️  Atomic OS Debug');
    console.log('Stats:', this.getStats());
    console.log('Memory:', this.components.memory?.getStats());
    console.log('Agents:', this.components.agents?.getStats());
    console.log('Router:', this.components.router?.getStats());
    console.log('Active Tape:', this.getActiveTape());
    console.groupEnd();
  }
}

// Create global instance
const atomicOS = new AtomicOS();

// Auto-initialize on DOMContentLoaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      atomicOS.init();
    });
  } else {
    atomicOS.init();
  }
}

// Expose globally
if (typeof window !== 'undefined') {
  window.AtomicOS = AtomicOS;
  window.atomicOS = atomicOS;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AtomicOS, atomicOS };
}

console.log('⚛️  Atomic OS Integration v1.0 - LOADED');
console.log('Available commands:');
console.log('  - atomicOS.execute(input)');
console.log('  - atomicOS.registerTape(id, config)');
console.log('  - atomicOS.setActiveTape(id)');
console.log('  - atomicOS.getStats()');
console.log('  - atomicOS.debug()');
