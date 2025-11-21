/**
 * AGENT FACTORY - SPECIALIST SPAWNING SYSTEM
 * ==========================================
 * Spawns specialized AI agents from the registry
 * Integrates with K'UHUL multi-hive architecture
 */

class AgentFactory {
  constructor() {
    this.registry = null;
    this.activeAgents = new Map();
    this.agentTeams = new Map();
    this.conversationHistory = new Map();

    this.loadRegistry();
  }

  async loadRegistry() {
    try {
      const response = await fetch('/core/agents-registry.json');
      this.registry = await response.json();
      console.log(`✅ Loaded ${this.getTotalAgentCount()} specialists from registry`);
    } catch (error) {
      console.error('Failed to load agent registry:', error);
      this.registry = this.getDefaultRegistry();
    }
  }

  getTotalAgentCount() {
    if (!this.registry) return 0;

    let count = 0;
    Object.values(this.registry.categories).forEach(category => {
      count += Object.keys(category.agents).length;
    });
    return count;
  }

  /**
   * Spawn a specialist agent by ID or specialty
   */
  async spawn(agentId, context = {}) {
    if (!this.registry) {
      await this.loadRegistry();
    }

    const agentConfig = this.findAgent(agentId);
    if (!agentConfig) {
      throw new Error(`Agent '${agentId}' not found in registry`);
    }

    const agent = {
      id: `${agentId}_${Date.now()}`,
      config: agentConfig,
      context: context,
      status: 'active',
      created: new Date().toISOString(),
      conversationHistory: [],
      knowledgeBase: agentConfig.knowledge_base,

      // Agent methods
      async query(question, options = {}) {
        return await this.processQuery(question, options);
      },

      async generateCode(spec) {
        return await this.generateCode(spec);
      },

      async review(code) {
        return await this.reviewCode(code);
      },

      async collaborate(otherAgents, task) {
        return await this.collaborateWithAgents(otherAgents, task);
      },

      // Internal methods
      async processQuery(question, options) {
        const response = await this._think(question, options);
        this.conversationHistory.push({
          role: 'user',
          content: question,
          timestamp: new Date().toISOString()
        });
        this.conversationHistory.push({
          role: 'assistant',
          content: response,
          timestamp: new Date().toISOString()
        });
        return response;
      },

      async _think(question, options) {
        // Simulate agent thinking process
        const knowledge = this.knowledgeBase;
        const specialty = this.config.specialty;

        return {
          agent: this.config.name,
          specialty: specialty,
          response: this._generateResponse(question, knowledge, options),
          confidence: this._calculateConfidence(question, knowledge),
          relatedConcepts: this._findRelatedConcepts(question, knowledge),
          codeExample: options.includeCode ? this._generateCodeExample(question) : null
        };
      },

      _generateResponse(question, knowledge, options) {
        // This would integrate with actual AI models
        // For now, generate intelligent responses based on knowledge base

        const concepts = knowledge.core_concepts || [];
        const frameworks = knowledge.frameworks || [];
        const practices = knowledge.best_practices || [];

        let response = `As a ${this.config.name}, I can help with ${specialty}. `;

        if (question.toLowerCase().includes('how')) {
          response += `The recommended approach is to use ${frameworks[0] || 'standard techniques'}. `;
          response += `Key concepts to understand: ${concepts.slice(0, 3).join(', ')}. `;
        } else if (question.toLowerCase().includes('best')) {
          response += `Best practices include: ${practices.join(', ')}. `;
        } else if (question.toLowerCase().includes('example')) {
          response += `I'll provide a code example demonstrating this concept. `;
        }

        return response;
      },

      _calculateConfidence(question, knowledge) {
        // Calculate how confident the agent is in answering
        const relevantTerms = Object.values(knowledge).flat();
        const questionLower = question.toLowerCase();

        const matches = relevantTerms.filter(term =>
          questionLower.includes(term.toLowerCase())
        ).length;

        return Math.min(0.95, 0.5 + (matches * 0.1));
      },

      _findRelatedConcepts(question, knowledge) {
        const concepts = knowledge.core_concepts || [];
        return concepts.slice(0, 5);
      },

      _generateCodeExample(question) {
        // Generate code based on agent's specialty
        const framework = this.config.knowledge_base.frameworks[0];
        return {
          language: this._getLanguageForFramework(framework),
          code: this._generateSampleCode(question, framework),
          framework: framework
        };
      },

      _getLanguageForFramework(framework) {
        const languageMap = {
          'Svelte': 'svelte',
          'SolidJS': 'jsx',
          'Qwik': 'tsx',
          'Alpine.js': 'html',
          'HTMX': 'html',
          'Express.js': 'javascript',
          'Flask': 'python',
          'Django': 'python',
          'Laravel': 'php',
          'Three.js': 'javascript'
        };
        return languageMap[framework] || 'javascript';
      },

      _generateSampleCode(question, framework) {
        // Would use templates or AI generation
        return `// ${framework} example for: ${question}\n// Code would be generated here`;
      },

      async generateCode(spec) {
        return {
          agent: this.config.name,
          code: this._generateSampleCode(spec.description, this.config.knowledge_base.frameworks[0]),
          framework: this.config.knowledge_base.frameworks[0],
          bestPractices: this.config.knowledge_base.best_practices
        };
      },

      async reviewCode(code) {
        return {
          agent: this.config.name,
          issues: [],
          suggestions: [
            `Consider following ${this.config.knowledge_base.frameworks[0]} best practices`,
            ...this.config.knowledge_base.best_practices
          ],
          score: 8.5
        };
      },

      async collaborateWithAgents(otherAgents, task) {
        const collaboration = {
          task: task,
          myRole: this.config.specialty,
          myContribution: await this.processQuery(task),
          otherAgents: otherAgents.map(a => a.config.name)
        };

        return collaboration;
      }
    };

    // Store active agent
    this.activeAgents.set(agent.id, agent);

    console.log(`🤖 Spawned ${agentConfig.icon} ${agentConfig.name}`);

    return agent;
  }

  /**
   * Spawn a team of agents for collaborative work
   */
  async spawnTeam(agentIds, teamName = 'dev_team') {
    const team = {
      id: `${teamName}_${Date.now()}`,
      name: teamName,
      agents: [],
      created: new Date().toISOString(),

      async collaborate(task) {
        const results = await Promise.all(
          this.agents.map(agent => agent.query(task, { includeCode: true }))
        );

        return {
          task: task,
          team: this.name,
          contributions: results,
          synthesis: this._synthesize(results)
        };
      },

      _synthesize(results) {
        return {
          summary: `Team of ${results.length} agents collaborated on task`,
          combinedConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
          recommendations: results.flatMap(r => r.relatedConcepts).slice(0, 10)
        };
      }
    };

    for (const agentId of agentIds) {
      const agent = await this.spawn(agentId);
      team.agents.push(agent);
    }

    this.agentTeams.set(team.id, team);

    console.log(`👥 Team '${teamName}' formed with ${team.agents.length} agents`);

    return team;
  }

  /**
   * Find agent in registry by ID or specialty
   */
  findAgent(query) {
    if (!this.registry) return null;

    for (const category of Object.values(this.registry.categories)) {
      if (category.agents[query]) {
        return category.agents[query];
      }

      // Search by specialty
      for (const agent of Object.values(category.agents)) {
        if (agent.specialty.toLowerCase().includes(query.toLowerCase()) ||
            agent.name.toLowerCase().includes(query.toLowerCase())) {
          return agent;
        }
      }
    }

    return null;
  }

  /**
   * List all available agents
   */
  listAgents(category = null) {
    if (!this.registry) return [];

    if (category) {
      return this.registry.categories[category]?.agents || {};
    }

    const allAgents = [];
    Object.entries(this.registry.categories).forEach(([catName, catData]) => {
      Object.entries(catData.agents).forEach(([agentId, agentConfig]) => {
        allAgents.push({
          ...agentConfig,
          category: catName
        });
      });
    });

    return allAgents;
  }

  /**
   * Get agents by capability
   */
  getAgentsByCapability(capability) {
    return this.listAgents().filter(agent =>
      agent.capabilities.includes(capability)
    );
  }

  /**
   * Recommend agents for a task
   */
  recommendAgents(taskDescription, maxAgents = 3) {
    const allAgents = this.listAgents();
    const taskLower = taskDescription.toLowerCase();

    // Score agents based on relevance
    const scoredAgents = allAgents.map(agent => {
      let score = 0;

      // Check specialty match
      if (taskLower.includes(agent.specialty.toLowerCase())) {
        score += 10;
      }

      // Check capabilities
      agent.capabilities.forEach(cap => {
        if (taskLower.includes(cap.toLowerCase().replace('_', ' '))) {
          score += 5;
        }
      });

      // Check framework matches
      agent.knowledge_base.frameworks.forEach(framework => {
        if (taskLower.includes(framework.toLowerCase())) {
          score += 8;
        }
      });

      return { agent, score };
    });

    // Return top scoring agents
    return scoredAgents
      .sort((a, b) => b.score - a.score)
      .slice(0, maxAgents)
      .map(item => item.agent);
  }

  /**
   * Create a project-specific agent hive
   */
  async createProjectHive(projectType, requirements = {}) {
    const hiveConfig = {
      frontend: null,
      backend: null,
      styling: null,
      specialty: []
    };

    // Auto-select agents based on project type
    switch (projectType.toLowerCase()) {
      case 'svelte_app':
        hiveConfig.frontend = await this.spawn('svelte_specialist');
        hiveConfig.styling = await this.spawn('tailwind_specialist');
        hiveConfig.backend = requirements.backend === 'python' ?
          await this.spawn('flask_specialist') :
          await this.spawn('express_specialist');
        break;

      case 'game':
        hiveConfig.frontend = await this.spawn('phaser_specialist');
        hiveConfig.specialty.push(await this.spawn('threejs_specialist'));
        break;

      case 'static_site':
        hiveConfig.frontend = await this.spawn('astro_specialist');
        hiveConfig.styling = await this.spawn('tailwind_specialist');
        break;

      case 'api':
        hiveConfig.backend = requirements.language === 'python' ?
          await this.spawn('django_specialist') :
          await this.spawn('express_specialist');
        hiveConfig.specialty.push(await this.spawn('security_specialist'));
        break;
    }

    // Always include performance and accessibility
    hiveConfig.specialty.push(
      await this.spawn('performance_specialist'),
      await this.spawn('accessibility_specialist')
    );

    const hive = {
      id: `hive_${projectType}_${Date.now()}`,
      projectType,
      config: hiveConfig,

      async develop(feature) {
        const results = {};

        if (this.config.frontend) {
          results.frontend = await this.config.frontend.generateCode({
            description: `Frontend for ${feature}`
          });
        }

        if (this.config.backend) {
          results.backend = await this.config.backend.generateCode({
            description: `Backend for ${feature}`
          });
        }

        if (this.config.styling) {
          results.styling = await this.config.styling.generateCode({
            description: `Styling for ${feature}`
          });
        }

        // Specialty agents provide review/optimization
        results.reviews = await Promise.all(
          this.config.specialty.map(async agent => ({
            agent: agent.config.name,
            review: await agent.review(JSON.stringify(results))
          }))
        );

        return results;
      }
    };

    console.log(`🏗️ Created project hive for ${projectType}`);

    return hive;
  }

  /**
   * Get default registry if loading fails
   */
  getDefaultRegistry() {
    return {
      version: "1.0.0",
      categories: {
        frontend_frameworks: {
          agents: {
            svelte_specialist: {
              id: "svelte_specialist",
              name: "Svelte Expert",
              icon: "🎯",
              specialty: "Svelte framework",
              capabilities: ["components", "stores", "routing"],
              knowledge_base: {
                core_concepts: ["reactive", "stores", "components"],
                frameworks: ["Svelte"],
                best_practices: ["reactive declarations"]
              }
            }
          }
        }
      }
    };
  }
}

// Create global agent factory instance
const agentFactory = new AgentFactory();

// Expose globally
if (typeof window !== 'undefined') {
  window.AgentFactory = AgentFactory;
  window.agentFactory = agentFactory;
  window.Agents = agentFactory; // Shorthand
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AgentFactory, agentFactory };
}

console.log('🏭 Agent Factory v1.0 - LOADED');
console.log('Available commands:');
console.log('  - agentFactory.spawn(agentId)');
console.log('  - agentFactory.spawnTeam([agentIds])');
console.log('  - agentFactory.recommendAgents(task)');
console.log('  - agentFactory.createProjectHive(projectType)');
