/**
 * ATOMIC AGENTS - SYMBOLIC MULTI-AGENT COORDINATION
 * =================================================
 * Intelligent agent system for K'UHUL ecosystem
 * Coordinates specialized agents via symbolic messaging
 */

class AtomicAgents {
  constructor() {
    this.agents = new Map();
    this.messageQueue = [];
    this.activeConversations = new Map();
    this.routingTable = new Map();

    console.log('🤖 Atomic Agents System initialized');
  }

  /**
   * Register a new agent
   */
  register(id, config) {
    if (this.agents.has(id)) {
      console.warn(`Agent ${id} already registered, updating...`);
    }

    const agent = {
      id,
      type: config.type || 'generic',
      capabilities: config.capabilities || [],
      execute: config.execute || (() => ({ success: false, error: 'No execute function' })),
      status: 'ready',
      lastActive: Date.now(),
      messageCount: 0,
      successRate: 1.0,
      metadata: config.metadata || {}
    };

    this.agents.set(id, agent);

    // Update routing table
    config.capabilities.forEach(capability => {
      if (!this.routingTable.has(capability)) {
        this.routingTable.set(capability, []);
      }
      this.routingTable.get(capability).push(id);
    });

    console.log(`✅ Registered agent: ${id} (${config.capabilities.join(', ')})`);

    return agent;
  }

  /**
   * Unregister an agent
   */
  unregister(id) {
    const agent = this.agents.get(id);
    if (!agent) {
      return false;
    }

    // Remove from routing table
    agent.capabilities.forEach(capability => {
      const handlers = this.routingTable.get(capability) || [];
      this.routingTable.set(
        capability,
        handlers.filter(agentId => agentId !== id)
      );
    });

    this.agents.delete(id);
    console.log(`🗑️  Unregistered agent: ${id}`);

    return true;
  }

  /**
   * Route a symbolic message to appropriate agent(s)
   */
  async route(symbol, data = {}, context = {}) {
    const startTime = performance.now();

    // Find capable agents
    const capableAgents = this.findCapableAgents(symbol);

    if (capableAgents.length === 0) {
      console.warn(`⚠️  No capable agent found for symbol: ${symbol}`);

      // Learn this gap
      if (typeof atomicMemory !== 'undefined') {
        atomicMemory.learn(`missing_capability_${symbol}`, true, 0.9, {
          category: 'gaps',
          timestamp: Date.now()
        });
      }

      return {
        success: false,
        error: 'No capable agent',
        symbol,
        suggestedCapability: this.inferCapability(symbol)
      };
    }

    // Select best agent
    const selectedAgent = this.selectBestAgent(capableAgents, symbol, context);

    // Execute
    try {
      selectedAgent.status = 'busy';
      selectedAgent.messageCount++;

      const result = await selectedAgent.execute(symbol, data, context);

      selectedAgent.lastActive = Date.now();
      selectedAgent.status = 'ready';

      // Update success rate
      if (result.success) {
        selectedAgent.successRate = (selectedAgent.successRate * 0.9) + (1.0 * 0.1);
      } else {
        selectedAgent.successRate = (selectedAgent.successRate * 0.9) + (0.0 * 0.1);
      }

      const executionTime = performance.now() - startTime;

      // Learn from execution
      if (typeof atomicMemory !== 'undefined') {
        atomicMemory.learn(
          `agent_${selectedAgent.id}_${symbol}`,
          {
            success: result.success,
            executionTime,
            timestamp: Date.now()
          },
          result.success ? 0.9 : 0.4,
          {
            category: 'agent_execution',
            agentType: selectedAgent.type
          }
        );
      }

      return {
        ...result,
        agent: selectedAgent.id,
        executionTime
      };
    } catch (error) {
      selectedAgent.status = 'error';
      selectedAgent.successRate = (selectedAgent.successRate * 0.9) + (0.0 * 0.1);

      console.error(`❌ Agent ${selectedAgent.id} failed:`, error);

      return {
        success: false,
        error: error.message,
        agent: selectedAgent.id,
        executionTime: performance.now() - startTime
      };
    }
  }

  /**
   * Find agents capable of handling a symbol
   */
  findCapableAgents(symbol) {
    const capable = [];

    for (const [id, agent] of this.agents) {
      // Check if any capability matches the symbol
      const matchScore = agent.capabilities.reduce((score, cap) => {
        if (symbol.toUpperCase().includes(cap.toUpperCase())) {
          return score + 1;
        }
        if (cap.toUpperCase().includes(symbol.toUpperCase())) {
          return score + 0.5;
        }
        return score;
      }, 0);

      if (matchScore > 0) {
        capable.push({ agent, matchScore });
      }
    }

    return capable
      .sort((a, b) => b.matchScore - a.matchScore)
      .map(item => item.agent);
  }

  /**
   * Select the best agent for a task
   */
  selectBestAgent(agents, symbol, context) {
    if (agents.length === 1) {
      return agents[0];
    }

    // Score each agent
    const scored = agents.map(agent => {
      let score = agent.successRate * 100; // Success rate: 0-100

      // Prefer recently active agents
      const hoursSinceActive = (Date.now() - agent.lastActive) / 1000 / 60 / 60;
      score += Math.max(0, 10 - hoursSinceActive);

      // Prefer less busy agents
      if (agent.status === 'ready') {
        score += 20;
      }

      // Use learned patterns
      if (typeof atomicMemory !== 'undefined') {
        const pattern = atomicMemory.recall(`agent_${agent.id}_${symbol}`);
        if (pattern && pattern.value.success) {
          score += pattern.confidence * 30;
        }
      }

      return { agent, score };
    });

    // Return highest scored agent
    scored.sort((a, b) => b.score - a.score);
    return scored[0].agent;
  }

  /**
   * Infer required capability from symbol
   */
  inferCapability(symbol) {
    // Simple keyword extraction
    const keywords = symbol.toLowerCase().split('_');
    const common = ['the', 'a', 'an', 'to', 'for', 'of', 'in', 'on'];
    const meaningful = keywords.filter(k => !common.includes(k));

    return meaningful.length > 0 ? meaningful[0] : symbol;
  }

  /**
   * Broadcast message to all agents
   */
  async broadcast(symbol, data = {}, context = {}) {
    const results = [];

    for (const [id, agent] of this.agents) {
      try {
        const result = await agent.execute(symbol, data, context);
        results.push({
          agent: id,
          ...result
        });
      } catch (error) {
        results.push({
          agent: id,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Multi-agent collaboration on a task
   */
  async collaborate(symbol, data = {}, requiredCapabilities = []) {
    const collaboratingAgents = [];

    // Find one agent for each capability
    requiredCapabilities.forEach(cap => {
      const agentIds = this.routingTable.get(cap) || [];
      if (agentIds.length > 0) {
        const agent = this.agents.get(agentIds[0]);
        if (agent) {
          collaboratingAgents.push(agent);
        }
      }
    });

    if (collaboratingAgents.length === 0) {
      return {
        success: false,
        error: 'No agents available for collaboration'
      };
    }

    console.log(`🤝 Collaboration: ${collaboratingAgents.map(a => a.id).join(', ')}`);

    // Execute in sequence
    let currentData = data;
    const results = [];

    for (const agent of collaboratingAgents) {
      try {
        const result = await agent.execute(symbol, currentData, {
          collaboration: true,
          previousResults: results
        });

        results.push({
          agent: agent.id,
          ...result
        });

        // Pass result to next agent
        if (result.success && result.data) {
          currentData = { ...currentData, ...result.data };
        }
      } catch (error) {
        results.push({
          agent: agent.id,
          success: false,
          error: error.message
        });
        break; // Stop collaboration on error
      }
    }

    const success = results.every(r => r.success);

    return {
      success,
      results,
      collaborators: collaboratingAgents.map(a => a.id)
    };
  }

  /**
   * Get agent status
   */
  getStatus(id) {
    const agent = this.agents.get(id);
    if (!agent) {
      return null;
    }

    return {
      id: agent.id,
      type: agent.type,
      status: agent.status,
      capabilities: agent.capabilities,
      messageCount: agent.messageCount,
      successRate: (agent.successRate * 100).toFixed(1) + '%',
      lastActive: new Date(agent.lastActive).toISOString(),
      metadata: agent.metadata
    };
  }

  /**
   * List all agents
   */
  listAgents() {
    return Array.from(this.agents.values()).map(agent => ({
      id: agent.id,
      type: agent.type,
      status: agent.status,
      capabilities: agent.capabilities,
      successRate: (agent.successRate * 100).toFixed(1) + '%'
    }));
  }

  /**
   * Get system statistics
   */
  getStats() {
    const agents = Array.from(this.agents.values());

    return {
      totalAgents: agents.length,
      readyAgents: agents.filter(a => a.status === 'ready').length,
      busyAgents: agents.filter(a => a.status === 'busy').length,
      errorAgents: agents.filter(a => a.status === 'error').length,
      totalMessages: agents.reduce((sum, a) => sum + a.messageCount, 0),
      avgSuccessRate: agents.reduce((sum, a) => sum + a.successRate, 0) / agents.length,
      capabilities: this.routingTable.size,
      queuedMessages: this.messageQueue.length
    };
  }

  /**
   * Initialize default agents for K'UHUL ecosystem
   */
  initDefaultAgents() {
    console.log('🚀 Initializing default agents...');

    // Theme Agent
    this.register('φ_theme', {
      type: 'ui_controller',
      capabilities: ['theme_switch', 'pack_coordination', 'ui_theming'],
      execute: async (symbol, data) => {
        if (symbol.includes('THEME_SWITCH') || symbol.includes('THEME')) {
          const root = document.documentElement;
          if (data.theme && root) {
            root.dataset.theme = data.theme;

            // Learn user preference
            if (typeof atomicMemory !== 'undefined') {
              atomicMemory.learn('user_theme_preference', data.theme, 0.9, {
                category: 'ui_preferences'
              });
            }

            return {
              success: true,
              newTheme: data.theme,
              message: `Theme switched to ${data.theme}`
            };
          }
        }

        return { success: false, error: 'Unknown theme operation' };
      },
      metadata: {
        description: 'Manages UI theming and pack coordination',
        version: '1.0'
      }
    });

    // Training Agent
    this.register('τ_training', {
      type: 'training_controller',
      capabilities: ['training', 'model_management', 'metrics', 'colab'],
      execute: async (symbol, data) => {
        if (symbol.includes('TRAIN') || symbol.includes('MODEL')) {
          // Integrate with training dashboard
          return {
            success: true,
            action: 'training_initiated',
            jobId: `job_${Date.now()}`,
            data: data
          };
        }

        return { success: false, error: 'Unknown training operation' };
      },
      metadata: {
        description: 'Manages training jobs and model operations',
        version: '1.0'
      }
    });

    // Visualization Agent
    this.register('ψ_viz', {
      type: 'visualization_engine',
      capabilities: ['visualization', '3d', 'charts', 'weights'],
      execute: async (symbol, data) => {
        if (symbol.includes('VIZ') || symbol.includes('VISUALIZE')) {
          return {
            success: true,
            action: 'visualization_created',
            type: data.type || '3d_weights'
          };
        }

        return { success: false, error: 'Unknown visualization operation' };
      },
      metadata: {
        description: '3D visualization and charting engine',
        version: '1.0'
      }
    });

    // Storage Agent
    this.register('σ_storage', {
      type: 'data_persistence',
      capabilities: ['storage', 'cache', 'persistence', 'export'],
      execute: async (symbol, data) => {
        if (symbol.includes('SAVE') || symbol.includes('LOAD')) {
          try {
            if (symbol.includes('SAVE')) {
              localStorage.setItem(data.key, JSON.stringify(data.value));
              return {
                success: true,
                action: 'data_saved',
                key: data.key
              };
            } else if (symbol.includes('LOAD')) {
              const value = localStorage.getItem(data.key);
              return {
                success: true,
                action: 'data_loaded',
                value: value ? JSON.parse(value) : null
              };
            }
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        }

        return { success: false, error: 'Unknown storage operation' };
      },
      metadata: {
        description: 'Handles data persistence and caching',
        version: '1.0'
      }
    });

    // Agent Coordination Agent (meta-agent)
    this.register('ω_coordinator', {
      type: 'meta_agent',
      capabilities: ['coordination', 'multi_agent', 'workflow'],
      execute: async (symbol, data) => {
        if (symbol.includes('COORDINATE') || symbol.includes('WORKFLOW')) {
          const capabilities = data.capabilities || [];
          const result = await this.collaborate(symbol, data, capabilities);

          return {
            success: result.success,
            action: 'coordination_complete',
            results: result.results
          };
        }

        return { success: false, error: 'Unknown coordination operation' };
      },
      metadata: {
        description: 'Coordinates multi-agent workflows',
        version: '1.0'
      }
    });

    console.log(`✅ Initialized ${this.agents.size} default agents`);
  }

  /**
   * Debug helpers
   */
  debug() {
    console.group('🤖 Atomic Agents Debug');
    console.log('Stats:', this.getStats());
    console.log('Agents:', this.listAgents());
    console.log('Routing Table:', Array.from(this.routingTable.entries()));
    console.groupEnd();
  }
}

// Create global instance
const atomicAgents = new AtomicAgents();

// Auto-initialize default agents
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      atomicAgents.initDefaultAgents();
    });
  } else {
    atomicAgents.initDefaultAgents();
  }
}

// Expose globally
if (typeof window !== 'undefined') {
  window.AtomicAgents = AtomicAgents;
  window.atomicAgents = atomicAgents;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AtomicAgents, atomicAgents };
}

console.log('🤖 Atomic Agents v1.0 - LOADED');
console.log('Available commands:');
console.log('  - atomicAgents.route(symbol, data, context)');
console.log('  - atomicAgents.register(id, config)');
console.log('  - atomicAgents.collaborate(symbol, data, capabilities)');
console.log('  - atomicAgents.listAgents()');
console.log('  - atomicAgents.getStats()');
console.log('  - atomicAgents.debug()');
