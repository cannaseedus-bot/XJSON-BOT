/**
 * SYMBOLIC ROUTER
 * ===============
 * Context-aware navigation system using symbolic addressing
 * Learns user navigation patterns and optimizes routes
 */

class SymbolicRouter {
  constructor() {
    this.currentLocation = null;
    this.previousLocation = null;
    this.history = [];
    this.maxHistorySize = 100;
    this.routes = new Map();
    this.navigationListeners = [];

    // Load history from storage
    this.loadHistory();

    console.log('🧭 Symbolic Router initialized');
  }

  /**
   * Register a symbolic route
   */
  registerRoute(symbol, config) {
    this.routes.set(symbol, {
      symbol,
      element: config.element || null,
      selector: config.selector || null,
      beforeNavigate: config.beforeNavigate || null,
      afterNavigate: config.afterNavigate || null,
      metadata: config.metadata || {}
    });

    return this.routes.get(symbol);
  }

  /**
   * Navigate to a symbolic location
   */
  async navigate(symbolicPath, data = {}, options = {}) {
    const startTime = performance.now();

    // Store previous location
    this.previousLocation = this.currentLocation;

    // Check if route exists
    const route = this.routes.get(symbolicPath);

    if (!route && !options.allowUnregistered) {
      console.warn(`⚠️  Route not registered: ${symbolicPath}`);

      // Try to find similar routes
      const similar = this.findSimilarRoutes(symbolicPath);
      if (similar.length > 0) {
        console.log('💡 Did you mean:', similar.slice(0, 3).join(', '));
      }

      return {
        success: false,
        error: 'Route not found',
        suggestions: similar
      };
    }

    try {
      // Before navigate hook
      if (route && route.beforeNavigate) {
        const shouldContinue = await route.beforeNavigate(symbolicPath, data);
        if (shouldContinue === false) {
          return {
            success: false,
            error: 'Navigation cancelled by beforeNavigate hook'
          };
        }
      }

      // Execute navigation
      let result;

      if (route && route.element) {
        result = await this.navigateToElement(route.element, data, options);
      } else if (route && route.selector) {
        const element = document.querySelector(route.selector);
        if (element) {
          result = await this.navigateToElement(element, data, options);
        } else {
          result = { success: false, error: 'Element not found' };
        }
      } else {
        // Custom navigation via agent routing
        result = await this.navigateViaAgent(symbolicPath, data);
      }

      if (result.success) {
        // Update current location
        this.currentLocation = symbolicPath;

        // Record in history
        this.recordNavigation(symbolicPath, data, {
          from: this.previousLocation,
          executionTime: performance.now() - startTime,
          success: true
        });

        // After navigate hook
        if (route && route.afterNavigate) {
          await route.afterNavigate(symbolicPath, data);
        }

        // Learn navigation pattern
        if (typeof atomicMemory !== 'undefined') {
          const transitionSymbol = `nav_${this.previousLocation}_to_${symbolicPath}`;
          atomicMemory.learn(transitionSymbol, {
            frequency: 1,
            timestamp: Date.now()
          }, 0.8, {
            category: 'navigation',
            from: this.previousLocation,
            to: symbolicPath
          });

          // Learn user navigation preferences
          atomicMemory.recordContext({
            type: 'navigation',
            from: this.previousLocation,
            to: symbolicPath,
            data
          });
        }

        // Notify listeners
        this.notifyListeners('navigate', {
          from: this.previousLocation,
          to: symbolicPath,
          data,
          executionTime: performance.now() - startTime
        });
      }

      return result;
    } catch (error) {
      console.error('Navigation error:', error);

      this.recordNavigation(symbolicPath, data, {
        from: this.previousLocation,
        executionTime: performance.now() - startTime,
        success: false,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Navigate to a DOM element
   */
  async navigateToElement(element, data = {}, options = {}) {
    const behavior = options.smooth !== false ? 'smooth' : 'auto';

    // Scroll into view
    element.scrollIntoView({
      behavior,
      block: options.block || 'start',
      inline: options.inline || 'nearest'
    });

    // Focus if focusable
    if (options.focus && element.tabIndex >= 0) {
      element.focus();
    }

    // Apply visual highlight
    if (options.highlight) {
      this.highlightElement(element);
    }

    return {
      success: true,
      element,
      location: this.currentLocation
    };
  }

  /**
   * Navigate via agent system
   */
  async navigateViaAgent(symbolicPath, data) {
    if (typeof atomicAgents !== 'undefined') {
      const result = await atomicAgents.route('NAVIGATE', {
        path: symbolicPath,
        ...data
      });

      return result;
    }

    return {
      success: false,
      error: 'Agent system not available'
    };
  }

  /**
   * Find similar routes (fuzzy matching)
   */
  findSimilarRoutes(symbol) {
    const similar = [];

    for (const [routeSymbol] of this.routes) {
      const distance = this.levenshteinDistance(
        symbol.toLowerCase(),
        routeSymbol.toLowerCase()
      );

      if (distance <= 3) {
        similar.push(routeSymbol);
      }
    }

    return similar;
  }

  /**
   * Levenshtein distance for fuzzy matching
   */
  levenshteinDistance(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Highlight an element temporarily
   */
  highlightElement(element) {
    const originalOutline = element.style.outline;
    const originalBoxShadow = element.style.boxShadow;

    element.style.outline = '2px solid #16f2aa';
    element.style.boxShadow = '0 0 20px rgba(22, 242, 170, 0.5)';

    setTimeout(() => {
      element.style.outline = originalOutline;
      element.style.boxShadow = originalBoxShadow;
    }, 2000);
  }

  /**
   * Go back to previous location
   */
  async back(data = {}) {
    if (this.previousLocation) {
      return await this.navigate(this.previousLocation, data);
    }

    // Try to use browser history
    const lastEntry = this.history[this.history.length - 2];
    if (lastEntry) {
      return await this.navigate(lastEntry.path, data);
    }

    return {
      success: false,
      error: 'No previous location'
    };
  }

  /**
   * Get navigation recommendations
   */
  getRecommendations(limit = 5) {
    if (typeof atomicMemory === 'undefined') {
      return [];
    }

    // Find patterns from current location
    const currentSymbol = `nav_${this.currentLocation}_to_`;
    const patterns = atomicMemory.match(currentSymbol, limit);

    return patterns.map(pattern => {
      const parts = pattern.symbol.split('_to_');
      return {
        symbol: parts[1],
        confidence: pattern.confidence,
        frequency: pattern.occurrences
      };
    }).filter(r => r.symbol);
  }

  /**
   * Prefetch likely next destinations
   */
  async prefetch() {
    const recommendations = this.getRecommendations(3);

    for (const rec of recommendations) {
      const route = this.routes.get(rec.symbol);

      if (route && route.selector) {
        // Prefetch element
        const element = document.querySelector(route.selector);
        if (element) {
          // Load any lazy-loaded content
          element.querySelectorAll('[loading="lazy"]').forEach(img => {
            img.loading = 'eager';
          });
        }
      }
    }
  }

  /**
   * Record navigation in history
   */
  recordNavigation(path, data, metadata) {
    this.history.push({
      path,
      data,
      timestamp: Date.now(),
      ...metadata
    });

    // Maintain history size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }

    // Save to storage
    this.saveHistory();
  }

  /**
   * Listen for navigation events
   */
  on(event, handler) {
    this.navigationListeners.push({ event, handler });
  }

  /**
   * Notify navigation listeners
   */
  notifyListeners(event, data) {
    this.navigationListeners
      .filter(listener => listener.event === event)
      .forEach(listener => {
        try {
          listener.handler(data);
        } catch (error) {
          console.error('Navigation listener error:', error);
        }
      });
  }

  /**
   * Get navigation statistics
   */
  getStats() {
    const navigations = this.history.filter(h => h.success);

    return {
      totalNavigations: navigations.length,
      uniqueDestinations: new Set(navigations.map(n => n.path)).size,
      avgExecutionTime: navigations.reduce((sum, n) => sum + (n.executionTime || 0), 0) / navigations.length,
      mostVisited: this.getMostVisited(5),
      currentLocation: this.currentLocation,
      previousLocation: this.previousLocation,
      recommendations: this.getRecommendations(3)
    };
  }

  /**
   * Get most visited routes
   */
  getMostVisited(limit = 10) {
    const counts = {};

    this.history.forEach(nav => {
      if (nav.success && nav.path) {
        counts[nav.path] = (counts[nav.path] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([path, count]) => ({ path, count }));
  }

  /**
   * Clear navigation history
   */
  clearHistory() {
    this.history = [];
    this.currentLocation = null;
    this.previousLocation = null;
    this.saveHistory();
  }

  /**
   * Persistence
   */
  saveHistory() {
    try {
      const data = {
        history: this.history.slice(-50), // Save last 50
        currentLocation: this.currentLocation,
        savedAt: Date.now()
      };

      localStorage.setItem('symbolic_router_history', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save navigation history:', error);
    }
  }

  loadHistory() {
    try {
      const data = localStorage.getItem('symbolic_router_history');
      if (data) {
        const parsed = JSON.parse(data);
        this.history = parsed.history || [];
        this.currentLocation = parsed.currentLocation || null;

        console.log(`📦 Loaded ${this.history.length} navigation entries`);
      }
    } catch (error) {
      console.error('Failed to load navigation history:', error);
    }
  }

  /**
   * Initialize default routes for K'UHUL
   */
  initDefaultRoutes() {
    console.log('🗺️  Initializing default routes...');

    // Dashboard
    this.registerRoute('Ω_DASHBOARD', {
      selector: '#dashboard',
      metadata: {
        title: 'Dashboard',
        icon: '📊'
      }
    });

    // Training
    this.registerRoute('Ω_TRAINING', {
      selector: '#training-dashboard',
      metadata: {
        title: 'Training Dashboard',
        icon: '🧠'
      }
    });

    // Agents
    this.registerRoute('Ω_AGENTS', {
      selector: '#agent-hive',
      metadata: {
        title: 'Agent Hive',
        icon: '🤖'
      }
    });

    // Visualizer
    this.registerRoute('Ω_VISUALIZER', {
      selector: '#weights-visualizer',
      metadata: {
        title: '3D Visualizer',
        icon: '🎨'
      }
    });

    // Settings
    this.registerRoute('Ω_SETTINGS', {
      selector: '#settings',
      metadata: {
        title: 'Settings',
        icon: '⚙️'
      }
    });

    console.log(`✅ Registered ${this.routes.size} default routes`);
  }

  /**
   * Debug helpers
   */
  debug() {
    console.group('🧭 Symbolic Router Debug');
    console.log('Stats:', this.getStats());
    console.log('Current Location:', this.currentLocation);
    console.log('Registered Routes:', Array.from(this.routes.keys()));
    console.log('Recent History:', this.history.slice(-10));
    console.groupEnd();
  }
}

// Create global instance
const symbolicRouter = new SymbolicRouter();

// Auto-initialize default routes
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      symbolicRouter.initDefaultRoutes();
    });
  } else {
    symbolicRouter.initDefaultRoutes();
  }
}

// Expose globally
if (typeof window !== 'undefined') {
  window.SymbolicRouter = SymbolicRouter;
  window.symbolicRouter = symbolicRouter;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SymbolicRouter, symbolicRouter };
}

console.log('🧭 Symbolic Router v1.0 - LOADED');
console.log('Available commands:');
console.log('  - symbolicRouter.navigate(symbol, data, options)');
console.log('  - symbolicRouter.back()');
console.log('  - symbolicRouter.getRecommendations(limit)');
console.log('  - symbolicRouter.getStats()');
console.log('  - symbolicRouter.debug()');
