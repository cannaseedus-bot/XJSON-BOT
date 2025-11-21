/**
 * ATOMIC MEMORY ENGINE
 * ====================
 * Symbolic pattern learning and recall system for K'UHUL
 * Implements Bayesian confidence updates and pattern matching
 */

class AtomicMemory {
  constructor() {
    this.patterns = new Map();
    this.contextHistory = [];
    this.maxHistorySize = 1000;
    this.persistenceKey = 'atomic_memory_patterns';

    // Load from persistence
    this.loadFromStorage();

    console.log('🧠 Atomic Memory Engine initialized');
  }

  /**
   * Learn a symbolic pattern with confidence scoring
   */
  learn(symbol, value, confidence = 0.8, metadata = {}) {
    const existing = this.patterns.get(symbol);

    if (existing) {
      // Bayesian confidence update
      // New confidence = (old_confidence * decay) + (new_confidence * weight)
      existing.confidence = (existing.confidence * 0.7) + (confidence * 0.3);
      existing.value = value;
      existing.lastSeen = Date.now();
      existing.occurrences = (existing.occurrences || 1) + 1;

      // Merge metadata
      existing.metadata = { ...existing.metadata, ...metadata };

      // Track temporal patterns
      const timeSinceFirst = Date.now() - existing.firstSeen;
      existing.frequency = existing.occurrences / (timeSinceFirst / 1000 / 60 / 60); // per hour
    } else {
      this.patterns.set(symbol, {
        value,
        confidence,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        occurrences: 1,
        frequency: 0,
        metadata
      });
    }

    // Emit event for listeners
    this.emit('pattern_learned', { symbol, value, confidence });

    // Persist changes
    this.saveToStorage();

    return this.patterns.get(symbol);
  }

  /**
   * Recall a symbolic pattern with minimum confidence threshold
   */
  recall(symbol, minConfidence = 0.6) {
    const pattern = this.patterns.get(symbol);

    if (!pattern) {
      return null;
    }

    // Check if confidence meets threshold
    if (pattern.confidence < minConfidence) {
      return null;
    }

    // Apply temporal decay to confidence
    const hoursSinceLastSeen = (Date.now() - pattern.lastSeen) / 1000 / 60 / 60;
    const decayFactor = Math.exp(-hoursSinceLastSeen / 24); // Decay over 24 hours
    const adjustedConfidence = pattern.confidence * decayFactor;

    if (adjustedConfidence < minConfidence) {
      return null;
    }

    return {
      ...pattern,
      confidence: adjustedConfidence
    };
  }

  /**
   * Find patterns matching a context
   */
  match(context, limit = 10) {
    const matches = [];

    for (const [symbol, pattern] of this.patterns) {
      // Context can be a string (substring match) or object (key match)
      let score = 0;

      if (typeof context === 'string') {
        if (symbol.includes(context)) {
          score = pattern.confidence * (1 + pattern.occurrences / 10);
        }
      } else if (typeof context === 'object') {
        // Match based on metadata overlap
        const contextKeys = Object.keys(context);
        const matchingKeys = contextKeys.filter(key =>
          pattern.metadata && pattern.metadata[key] === context[key]
        );
        score = (matchingKeys.length / contextKeys.length) * pattern.confidence;
      }

      if (score > 0.5) {
        matches.push({
          symbol,
          ...pattern,
          matchScore: score
        });
      }
    }

    return matches
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  }

  /**
   * Forget patterns below confidence threshold
   */
  prune(minConfidence = 0.3) {
    let pruned = 0;

    for (const [symbol, pattern] of this.patterns) {
      if (pattern.confidence < minConfidence) {
        this.patterns.delete(symbol);
        pruned++;
      }
    }

    if (pruned > 0) {
      console.log(`🧹 Pruned ${pruned} low-confidence patterns`);
      this.saveToStorage();
    }

    return pruned;
  }

  /**
   * Get top N most confident patterns
   */
  getTopPatterns(n = 10) {
    return Array.from(this.patterns.entries())
      .map(([symbol, pattern]) => ({ symbol, ...pattern }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, n);
  }

  /**
   * Get patterns by category
   */
  getPatternsByCategory(category) {
    const patterns = [];

    for (const [symbol, pattern] of this.patterns) {
      if (pattern.metadata && pattern.metadata.category === category) {
        patterns.push({ symbol, ...pattern });
      }
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Record context for temporal pattern analysis
   */
  recordContext(context) {
    this.contextHistory.push({
      context,
      timestamp: Date.now()
    });

    // Maintain history size
    if (this.contextHistory.length > this.maxHistorySize) {
      this.contextHistory = this.contextHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Analyze temporal patterns
   */
  analyzeTemporalPatterns() {
    const analysis = {
      commonSequences: [],
      timeOfDayPatterns: {},
      frequencyPatterns: []
    };

    // Time of day analysis
    const hourBuckets = new Array(24).fill(0).map(() => []);

    this.contextHistory.forEach(({ context, timestamp }) => {
      const hour = new Date(timestamp).getHours();
      hourBuckets[hour].push(context);
    });

    hourBuckets.forEach((contexts, hour) => {
      if (contexts.length > 0) {
        const mostCommon = this.findMostCommon(contexts);
        analysis.timeOfDayPatterns[hour] = mostCommon;
      }
    });

    return analysis;
  }

  /**
   * Find most common element in array
   */
  findMostCommon(arr) {
    const counts = {};
    let maxCount = 0;
    let mostCommon = null;

    arr.forEach(item => {
      const key = typeof item === 'object' ? JSON.stringify(item) : item;
      counts[key] = (counts[key] || 0) + 1;
      if (counts[key] > maxCount) {
        maxCount = counts[key];
        mostCommon = item;
      }
    });

    return mostCommon;
  }

  /**
   * Event system
   */
  listeners = new Map();

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }

  emit(event, data) {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  /**
   * Persistence
   */
  saveToStorage() {
    try {
      const data = {
        patterns: Array.from(this.patterns.entries()),
        contextHistory: this.contextHistory.slice(-100), // Save last 100
        savedAt: Date.now()
      };

      localStorage.setItem(this.persistenceKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save Atomic Memory:', error);
    }
  }

  loadFromStorage() {
    try {
      const data = localStorage.getItem(this.persistenceKey);
      if (data) {
        const parsed = JSON.parse(data);
        this.patterns = new Map(parsed.patterns);
        this.contextHistory = parsed.contextHistory || [];

        console.log(`📦 Loaded ${this.patterns.size} patterns from storage`);
      }
    } catch (error) {
      console.error('Failed to load Atomic Memory:', error);
    }
  }

  clearStorage() {
    localStorage.removeItem(this.persistenceKey);
    this.patterns.clear();
    this.contextHistory = [];
    console.log('🗑️  Atomic Memory cleared');
  }

  /**
   * Export/Import for data portability
   */
  export() {
    return {
      version: '1.0',
      exported: Date.now(),
      patterns: Array.from(this.patterns.entries()),
      contextHistory: this.contextHistory,
      stats: this.getStats()
    };
  }

  import(data) {
    if (data.version !== '1.0') {
      throw new Error('Incompatible Atomic Memory version');
    }

    this.patterns = new Map(data.patterns);
    this.contextHistory = data.contextHistory || [];
    this.saveToStorage();

    console.log(`📥 Imported ${this.patterns.size} patterns`);
  }

  /**
   * Statistics
   */
  getStats() {
    const patterns = Array.from(this.patterns.values());

    return {
      totalPatterns: this.patterns.size,
      avgConfidence: patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length,
      highConfidence: patterns.filter(p => p.confidence > 0.8).length,
      mediumConfidence: patterns.filter(p => p.confidence >= 0.5 && p.confidence <= 0.8).length,
      lowConfidence: patterns.filter(p => p.confidence < 0.5).length,
      contextHistorySize: this.contextHistory.length,
      oldestPattern: Math.min(...patterns.map(p => p.firstSeen)),
      newestPattern: Math.max(...patterns.map(p => p.lastSeen))
    };
  }

  /**
   * Debug helpers
   */
  debug() {
    console.group('🧠 Atomic Memory Debug');
    console.log('Stats:', this.getStats());
    console.log('Top 10 Patterns:', this.getTopPatterns(10));
    console.log('Recent Context:', this.contextHistory.slice(-10));
    console.groupEnd();
  }
}

// Create global instance
const atomicMemory = new AtomicMemory();

// Expose globally
if (typeof window !== 'undefined') {
  window.AtomicMemory = AtomicMemory;
  window.atomicMemory = atomicMemory;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AtomicMemory, atomicMemory };
}

console.log('🧠 Atomic Memory Engine v1.0 - LOADED');
console.log('Available commands:');
console.log('  - atomicMemory.learn(symbol, value, confidence)');
console.log('  - atomicMemory.recall(symbol, minConfidence)');
console.log('  - atomicMemory.match(context, limit)');
console.log('  - atomicMemory.getStats()');
console.log('  - atomicMemory.debug()');
