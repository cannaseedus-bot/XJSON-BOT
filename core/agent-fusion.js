/**
 * AGENT FUSION SYSTEM - Multi-Agent Collaboration
 * ================================================
 * Enables multiple AI agents to collaborate on complex tasks
 *
 * Features:
 * - Agent team composition
 * - Parallel agent execution
 * - Response synthesis
 * - Cross-agent knowledge sharing
 * - Personality persistence
 */

/* ============================================================
   AGENT PERSONALITY SYSTEM
   ============================================================ */

const AgentPersonality = {
  // Personality traits that influence agent behavior
  traits: {
    analytical: { temperature: 0.3, style: 'precise', focus: 'data' },
    creative: { temperature: 0.9, style: 'imaginative', focus: 'ideas' },
    practical: { temperature: 0.5, style: 'actionable', focus: 'solutions' },
    friendly: { temperature: 0.7, style: 'conversational', focus: 'engagement' },
    technical: { temperature: 0.4, style: 'detailed', focus: 'accuracy' },
    concise: { temperature: 0.5, style: 'brief', focus: 'clarity' }
  },

  // Default agent personalities
  defaults: {
    assistant: ['friendly', 'practical'],
    coder: ['technical', 'analytical'],
    writer: ['creative', 'friendly'],
    analyst: ['analytical', 'concise'],
    teacher: ['friendly', 'practical', 'creative']
  },

  // Get personality config for an agent
  getConfig(agentType, customTraits = []) {
    const baseTraits = this.defaults[agentType] || ['practical'];
    const allTraits = [...new Set([...baseTraits, ...customTraits])];

    // Merge trait configurations
    let config = {
      temperature: 0.7,
      style: 'balanced',
      focus: 'general',
      traits: allTraits
    };

    allTraits.forEach(trait => {
      if (this.traits[trait]) {
        config.temperature = (config.temperature + this.traits[trait].temperature) / 2;
        config.style = this.traits[trait].style;
        config.focus = this.traits[trait].focus;
      }
    });

    return config;
  },

  // Generate system prompt based on personality
  getSystemPrompt(agentType, personality) {
    const prompts = {
      assistant: `You are a helpful AI assistant. Be ${personality.style} and focus on ${personality.focus}.`,
      coder: `You are an expert programmer. Provide ${personality.style} code solutions with focus on ${personality.focus}.`,
      writer: `You are a creative writer. Be ${personality.style} with focus on ${personality.focus}.`,
      analyst: `You are a data analyst. Provide ${personality.style} analysis focusing on ${personality.focus}.`,
      teacher: `You are an educator. Explain concepts in a ${personality.style} way focusing on ${personality.focus}.`
    };

    return prompts[agentType] || prompts.assistant;
  },

  // Save personality to storage
  save(agentId, personality) {
    const personalities = this.loadAll();
    personalities[agentId] = {
      ...personality,
      updated: new Date().toISOString()
    };
    localStorage.setItem('agent_personalities', JSON.stringify(personalities));
  },

  // Load personality from storage
  load(agentId) {
    const personalities = this.loadAll();
    return personalities[agentId] || null;
  },

  // Load all personalities
  loadAll() {
    try {
      return JSON.parse(localStorage.getItem('agent_personalities') || '{}');
    } catch {
      return {};
    }
  }
};

/* ============================================================
   KNOWLEDGE SHARING SYSTEM
   ============================================================ */

const AgentKnowledge = {
  // Shared knowledge base
  sharedMemory: new Map(),

  // Agent-specific knowledge
  agentMemory: new Map(),

  // Share knowledge from one agent to the shared pool
  share(agentId, key, value, metadata = {}) {
    const knowledge = {
      source: agentId,
      key,
      value,
      metadata,
      timestamp: Date.now(),
      accessCount: 0
    };

    this.sharedMemory.set(`${agentId}:${key}`, knowledge);
    this.persist();
    return knowledge;
  },

  // Get knowledge from shared pool
  get(key) {
    for (const [k, v] of this.sharedMemory) {
      if (k.endsWith(`:${key}`)) {
        v.accessCount++;
        return v;
      }
    }
    return null;
  },

  // Get all knowledge matching a pattern
  query(pattern) {
    const results = [];
    const regex = new RegExp(pattern, 'i');

    for (const [key, value] of this.sharedMemory) {
      if (regex.test(key) || regex.test(JSON.stringify(value))) {
        results.push(value);
      }
    }

    return results.sort((a, b) => b.accessCount - a.accessCount);
  },

  // Store agent-specific memory
  remember(agentId, context) {
    if (!this.agentMemory.has(agentId)) {
      this.agentMemory.set(agentId, []);
    }

    const memory = this.agentMemory.get(agentId);
    memory.push({
      context,
      timestamp: Date.now()
    });

    // Keep only last 50 memories per agent
    if (memory.length > 50) {
      memory.shift();
    }

    this.persist();
  },

  // Recall agent-specific memories
  recall(agentId, limit = 10) {
    const memory = this.agentMemory.get(agentId) || [];
    return memory.slice(-limit);
  },

  // Persist to localStorage
  persist() {
    try {
      const data = {
        shared: Array.from(this.sharedMemory.entries()),
        agents: Array.from(this.agentMemory.entries())
      };
      localStorage.setItem('agent_knowledge', JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to persist agent knowledge:', e);
    }
  },

  // Load from localStorage
  load() {
    try {
      const data = JSON.parse(localStorage.getItem('agent_knowledge') || '{}');
      if (data.shared) {
        this.sharedMemory = new Map(data.shared);
      }
      if (data.agents) {
        this.agentMemory = new Map(data.agents);
      }
    } catch (e) {
      console.warn('Failed to load agent knowledge:', e);
    }
  }
};

/* ============================================================
   MULTI-AGENT FUSION ENGINE
   ============================================================ */

const AgentFusion = {
  // Active agent teams
  teams: new Map(),

  // Create a team of agents for a task
  createTeam(teamId, agents) {
    const team = {
      id: teamId,
      agents: agents.map(a => ({
        id: `agent_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: a.type,
        role: a.role || a.type,
        personality: AgentPersonality.getConfig(a.type, a.traits || []),
        weight: a.weight || 1.0
      })),
      created: Date.now(),
      responses: []
    };

    this.teams.set(teamId, team);
    return team;
  },

  // Execute a task with multiple agents in parallel
  async executeParallel(teamId, task, options = {}) {
    const team = this.teams.get(teamId);
    if (!team) throw new Error('Team not found');

    const promises = team.agents.map(agent =>
      this.executeAgent(agent, task, options)
    );

    const results = await Promise.allSettled(promises);

    team.responses = results.map((result, index) => ({
      agent: team.agents[index],
      success: result.status === 'fulfilled',
      response: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason : null
    }));

    return team.responses;
  },

  // Execute a single agent
  async executeAgent(agent, task, options = {}) {
    // Build agent-specific prompt
    const systemPrompt = AgentPersonality.getSystemPrompt(agent.type, agent.personality);

    // Get agent's memories for context
    const memories = AgentKnowledge.recall(agent.id, 5);
    const memoryContext = memories.length > 0
      ? `\n\nRelevant context from previous interactions:\n${memories.map(m => m.context).join('\n')}`
      : '';

    const messages = [
      { role: 'system', content: systemPrompt + memoryContext },
      { role: 'user', content: task }
    ];

    // Use LLM if available
    if (typeof LLM !== 'undefined' && LLM.getAvailableProviders().length > 0) {
      const response = await LLM.chat(messages, {
        temperature: agent.personality.temperature,
        ...options
      });

      // Store interaction in agent memory
      AgentKnowledge.remember(agent.id, `Task: ${task.substring(0, 100)}... Response: ${response.content.substring(0, 200)}...`);

      return {
        content: response.content,
        agent: agent,
        model: response.model
      };
    }

    // Fallback response
    return {
      content: `[${agent.type}] I would analyze this from a ${agent.personality.focus} perspective with a ${agent.personality.style} approach.`,
      agent: agent,
      simulated: true
    };
  },

  // Synthesize multiple agent responses into a unified response
  synthesize(responses, strategy = 'weighted') {
    const successful = responses.filter(r => r.success && r.response);

    if (successful.length === 0) {
      return { content: 'No agents were able to respond.', agents: [] };
    }

    if (successful.length === 1) {
      return {
        content: successful[0].response.content,
        agents: [successful[0].agent]
      };
    }

    switch (strategy) {
      case 'weighted':
        return this.synthesizeWeighted(successful);
      case 'consensus':
        return this.synthesizeConsensus(successful);
      case 'chain':
        return this.synthesizeChain(successful);
      default:
        return this.synthesizeCombined(successful);
    }
  },

  // Weighted synthesis based on agent weights
  synthesizeWeighted(responses) {
    // Sort by weight
    const sorted = responses.sort((a, b) =>
      (b.agent.weight || 1) - (a.agent.weight || 1)
    );

    // Use highest weighted response as primary
    const primary = sorted[0].response.content;
    const supplementary = sorted.slice(1).map(r =>
      `[${r.agent.type}]: ${r.response.content.substring(0, 200)}...`
    );

    return {
      content: primary,
      supplementary,
      agents: sorted.map(r => r.agent),
      strategy: 'weighted'
    };
  },

  // Consensus-based synthesis
  synthesizeConsensus(responses) {
    // Extract key points from each response
    const contents = responses.map(r => r.response.content);

    // Simple combination for now
    const combined = `Based on input from ${responses.length} agents:\n\n` +
      responses.map(r => `**${r.agent.type}**: ${r.response.content}`).join('\n\n');

    return {
      content: combined,
      agents: responses.map(r => r.agent),
      strategy: 'consensus'
    };
  },

  // Chain synthesis (each agent builds on previous)
  synthesizeChain(responses) {
    let combined = '';
    responses.forEach((r, i) => {
      if (i === 0) {
        combined = r.response.content;
      } else {
        combined += `\n\n[${r.agent.type} adds]: ${r.response.content}`;
      }
    });

    return {
      content: combined,
      agents: responses.map(r => r.agent),
      strategy: 'chain'
    };
  },

  // Simple combined synthesis
  synthesizeCombined(responses) {
    const combined = responses.map(r =>
      `[${r.agent.type}]: ${r.response.content}`
    ).join('\n\n---\n\n');

    return {
      content: combined,
      agents: responses.map(r => r.agent),
      strategy: 'combined'
    };
  },

  // Quick team execution helper
  async quickTeam(agentTypes, task, options = {}) {
    const teamId = `quick_${Date.now()}`;
    const agents = agentTypes.map(type => ({ type }));

    this.createTeam(teamId, agents);
    const responses = await this.executeParallel(teamId, task, options);
    const synthesis = this.synthesize(responses, options.strategy || 'weighted');

    // Cleanup
    this.teams.delete(teamId);

    return synthesis;
  }
};

/* ============================================================
   EXPORTS
   ============================================================ */

// Initialize knowledge on load
AgentKnowledge.load();

// Make available globally
if (typeof window !== 'undefined') {
  window.AgentFusion = AgentFusion;
  window.AgentPersonality = AgentPersonality;
  window.AgentKnowledge = AgentKnowledge;
}

console.log('AGENT FUSION SYSTEM v1.0 - LOADED');
console.log('- Multi-Agent Teams: Ready');
console.log('- Personality System: Ready');
console.log('- Knowledge Sharing: Ready');
