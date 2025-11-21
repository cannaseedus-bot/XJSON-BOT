/**
 * ASX TAPE FORMAT
 * ===============
 * Enhanced atomic tape format for K'UHUL applications
 * Combines declarative state, computed properties, and symbolic effects
 */

class ASXTape {
  constructor(config) {
    this.schema = config.$schema || 'asx-tape-v2';
    this.metadata = config.metadata || {};
    this.state = config.state || {};
    this.computed = config.computed || {};
    this.effects = config.effects || [];
    this.components = config.components || {};
    this.listeners = new Map();
    this.effectHandlers = new Map();

    // Initialize reactive state
    this.reactiveState = this.createReactiveState(this.state);

    // Setup computed properties
    this.computedValues = new Map();
    this.setupComputed();

    // Setup effects
    this.setupEffects();

    console.log(`📼 ASX Tape "${this.metadata.name}" initialized`);
  }

  /**
   * Create reactive state using Proxy
   */
  createReactiveState(initialState) {
    const self = this;

    return new Proxy(initialState, {
      get(target, property) {
        return target[property];
      },

      set(target, property, value) {
        const oldValue = target[property];

        if (oldValue !== value) {
          target[property] = value;

          // Trigger reactivity
          self.onStateChange(property, value, oldValue);

          // Learn state changes
          if (typeof atomicMemory !== 'undefined') {
            atomicMemory.learn(
              `tape_${self.metadata.id}_state_${property}`,
              value,
              0.8,
              {
                category: 'tape_state',
                tapeId: self.metadata.id
              }
            );
          }
        }

        return true;
      }
    });
  }

  /**
   * State change handler
   */
  onStateChange(property, newValue, oldValue) {
    // Update computed properties that depend on this state
    this.updateComputedDependencies(property);

    // Check effects
    this.checkEffects(property, newValue, oldValue);

    // Notify listeners
    this.notifyListeners('state', {
      property,
      newValue,
      oldValue
    });
  }

  /**
   * Setup computed properties
   */
  setupComputed() {
    for (const [name, expression] of Object.entries(this.computed)) {
      this.computedValues.set(name, {
        expression,
        value: null,
        dependencies: this.extractDependencies(expression),
        lastComputed: null
      });
    }

    // Initial computation
    this.updateAllComputed();
  }

  /**
   * Extract state dependencies from expression
   */
  extractDependencies(expression) {
    const dependencies = [];
    const getPattern = /get\(['\"]([^'\"]+)['\"]\)/g;
    let match;

    while ((match = getPattern.exec(expression)) !== null) {
      const path = match[1];
      const topLevel = path.split('.')[0];
      dependencies.push(topLevel);
    }

    return [...new Set(dependencies)]; // Remove duplicates
  }

  /**
   * Evaluate computed expression
   */
  evaluateComputed(expression) {
    const self = this;

    // Helper function for get()
    const get = (path) => {
      const parts = path.split('.');
      let value = self.reactiveState;

      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = value[part];
        } else {
          return undefined;
        }
      }

      return value;
    };

    try {
      // Safe evaluation using Function constructor
      const fn = new Function('get', `return ${expression}`);
      return fn(get);
    } catch (error) {
      console.error('Error evaluating computed:', expression, error);
      return null;
    }
  }

  /**
   * Update all computed properties
   */
  updateAllComputed() {
    for (const [name, computed] of this.computedValues) {
      const newValue = this.evaluateComputed(computed.expression);

      if (newValue !== computed.value) {
        computed.value = newValue;
        computed.lastComputed = Date.now();

        this.notifyListeners('computed', {
          name,
          value: newValue
        });
      }
    }
  }

  /**
   * Update computed properties that depend on a state property
   */
  updateComputedDependencies(property) {
    for (const [name, computed] of this.computedValues) {
      if (computed.dependencies.includes(property)) {
        const newValue = this.evaluateComputed(computed.expression);

        if (newValue !== computed.value) {
          computed.value = newValue;
          computed.lastComputed = Date.now();

          this.notifyListeners('computed', {
            name,
            value: newValue
          });
        }
      }
    }
  }

  /**
   * Setup effects
   */
  setupEffects() {
    this.effects.forEach((effect, index) => {
      this.effectHandlers.set(index, {
        when: effect.when,
        run: effect.run,
        condition: effect.condition || null,
        lastTriggered: null
      });
    });
  }

  /**
   * Check and trigger effects
   */
  checkEffects(property, newValue, oldValue) {
    for (const [index, effect] of this.effectHandlers) {
      // Check if this effect watches this property
      if (effect.when === property) {
        // Check condition if exists
        let shouldRun = true;

        if (effect.condition) {
          shouldRun = this.evaluateCondition(effect.condition, newValue, oldValue);
        }

        if (shouldRun) {
          this.runEffect(effect, newValue);
        }
      }
    }
  }

  /**
   * Evaluate effect condition
   */
  evaluateCondition(condition, newValue, oldValue) {
    try {
      const fn = new Function('newValue', 'oldValue', 'state', `return ${condition}`);
      return fn(newValue, oldValue, this.reactiveState);
    } catch (error) {
      console.error('Error evaluating condition:', condition, error);
      return false;
    }
  }

  /**
   * Run effect
   */
  async runEffect(effect, value) {
    effect.lastTriggered = Date.now();

    // Parse symbolic effect expression
    // Example: "(?) caps ≤ 25 (∴) (💬>) 'Low on caps!' (%) ui.warning"
    const effectStr = effect.run;

    // Simple implementation - can be extended with full symbolic parser
    if (effectStr.includes('💬>')) {
      // Extract message
      const msgMatch = effectStr.match(/['"]([^'"]+)['"]/);
      if (msgMatch) {
        const message = msgMatch[1];

        // Show notification
        this.showNotification(message, 'warning');

        // Route through agent system
        if (typeof atomicAgents !== 'undefined') {
          await atomicAgents.route('NOTIFICATION', {
            message,
            type: 'warning',
            source: 'tape_effect'
          });
        }
      }
    }

    this.notifyListeners('effect', {
      effect: effectStr,
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Show notification (can be customized)
   */
  showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);

    // Create toast notification if in browser
    if (typeof document !== 'undefined') {
      const toast = document.createElement('div');
      toast.className = `asx-toast asx-toast-${type}`;
      toast.textContent = message;
      toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'warning' ? '#fbbf24' : '#16f2aa'};
        color: #0a0f1c;
        padding: 15px 20px;
        border-radius: 8px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
      `;

      document.body.appendChild(toast);

      setTimeout(() => {
        toast.remove();
      }, 3000);
    }
  }

  /**
   * Get state value
   */
  get(path) {
    const parts = path.split('.');
    let value = this.reactiveState;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Set state value
   */
  set(path, value) {
    const parts = path.split('.');
    const lastPart = parts.pop();
    let target = this.reactiveState;

    for (const part of parts) {
      if (!target[part]) {
        target[part] = {};
      }
      target = target[part];
    }

    target[lastPart] = value;
  }

  /**
   * Get computed value
   */
  getComputed(name) {
    const computed = this.computedValues.get(name);
    return computed ? computed.value : undefined;
  }

  /**
   * Get component element
   */
  getComponent(name) {
    const selector = this.components[name];
    if (!selector) {
      return null;
    }

    return typeof document !== 'undefined'
      ? document.querySelector(selector)
      : null;
  }

  /**
   * Listen for events
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }

  /**
   * Notify listeners
   */
  notifyListeners(event, data) {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }

  /**
   * Export tape state
   */
  export() {
    return {
      $schema: this.schema,
      metadata: this.metadata,
      state: this.reactiveState,
      computed: Object.fromEntries(
        Array.from(this.computedValues.entries()).map(([name, computed]) => [
          name,
          { expression: computed.expression, value: computed.value }
        ])
      ),
      effects: this.effects,
      components: this.components,
      exportedAt: Date.now()
    };
  }

  /**
   * Import tape state
   */
  import(data) {
    if (data.$schema !== this.schema) {
      console.warn('Schema mismatch during import');
    }

    // Merge state
    Object.assign(this.reactiveState, data.state);

    // Recompute
    this.updateAllComputed();

    console.log('📥 Tape state imported');
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      schema: this.schema,
      id: this.metadata.id,
      name: this.metadata.name,
      stateProperties: Object.keys(this.reactiveState).length,
      computedProperties: this.computedValues.size,
      effects: this.effects.length,
      components: Object.keys(this.components).length,
      listeners: Array.from(this.listeners.values()).reduce((sum, arr) => sum + arr.length, 0)
    };
  }

  /**
   * Debug helpers
   */
  debug() {
    console.group(`📼 ASX Tape: ${this.metadata.name}`);
    console.log('Stats:', this.getStats());
    console.log('State:', this.reactiveState);
    console.log('Computed:', Object.fromEntries(
      Array.from(this.computedValues.entries()).map(([k, v]) => [k, v.value])
    ));
    console.log('Components:', this.components);
    console.groupEnd();
  }
}

// Expose globally
if (typeof window !== 'undefined') {
  window.ASXTape = ASXTape;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ASXTape };
}

console.log('📼 ASX Tape Format v2.0 - LOADED');
console.log('Create a tape: new ASXTape(config)');
