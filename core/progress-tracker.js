/**
 * K'UHUL PROGRESS TRACKER - XCFE Phase-Based Progress Tracking
 * ==============================================================
 * Implements:
 * - XCFE execution phases (@Pop, @Wo, @Sek, @Collapse)
 * - Todo/task management with priorities
 * - Recap systems matrix
 * - Milestone tracking
 * - Progress persistence via K'UHUL storage
 */

/* ============================================================
   PROGRESS TRACKER CORE
   ============================================================ */

const ProgressTracker = {
  // Storage for all trackers
  trackers: new Map(),

  // Active tracker reference
  activeTracker: null,

  // Event listeners
  listeners: new Map(),

  // XCFE Phase definitions
  PHASES: {
    POP: { glyph: '⟁Pop⟁', name: '@Pop', description: 'Populate - Load data, initialize state' },
    WO: { glyph: '⟁Wo⟁', name: '@Wo', description: 'Work - Transform, compute, process' },
    SEK: { glyph: '⟁Sek⟁', name: '@Sek', description: 'Seek - Query, filter, search' },
    COLLAPSE: { glyph: '⟁Collapse⟁', name: '@Collapse', description: 'Collapse - Finalize, commit, output' }
  },

  // Priority levels
  PRIORITIES: {
    P0: { level: 0, name: 'Critical', color: '#ff4444' },
    P1: { level: 1, name: 'High', color: '#ff8800' },
    P2: { level: 2, name: 'Medium', color: '#ffcc00' },
    P3: { level: 3, name: 'Low', color: '#44cc44' },
    P4: { level: 4, name: 'Future', color: '#888888' }
  },

  /**
   * Create a new progress tracker
   */
  create(name, options = {}) {
    const trackerId = `tracker_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;

    const tracker = {
      tracker_id: trackerId,
      name: name,
      version: options.version || '1.0.0',
      created_at: Date.now(),
      updated_at: Date.now(),
      phases: {
        pop: this._createPhase('pop', this.PHASES.POP),
        wo: this._createPhase('wo', this.PHASES.WO),
        sek: this._createPhase('sek', this.PHASES.SEK),
        collapse: this._createPhase('collapse', this.PHASES.COLLAPSE)
      },
      milestones: [],
      todos: [],
      recap: {
        summary: {
          title: name,
          description: options.description || '',
          key_achievements: [],
          blockers: [],
          next_steps: []
        },
        metrics: {
          tasks_completed: 0,
          tasks_total: 0,
          lines_of_code: 0,
          files_created: 0,
          files_modified: 0,
          commits: 0,
          duration_hours: 0
        },
        systems_matrix: []
      },
      status: 'pending',
      progress_pct: 0,
      metadata: {
        author: options.author || 'system',
        branch: options.branch || '',
        session_id: options.session_id || '',
        tags: options.tags || []
      }
    };

    this.trackers.set(trackerId, tracker);
    this.activeTracker = trackerId;
    this._persist(trackerId);
    this._emit('tracker_created', { trackerId, tracker });

    return tracker;
  },

  /**
   * Create a phase object
   */
  _createPhase(key, phaseInfo) {
    return {
      glyph: phaseInfo.glyph,
      status: 'pending',
      progress_pct: 0,
      started_at: null,
      completed_at: null,
      duration_ms: 0,
      tasks: [],
      blockers: [],
      outputs: []
    };
  },

  /**
   * Start a phase
   */
  startPhase(trackerId, phaseName) {
    const tracker = this.trackers.get(trackerId || this.activeTracker);
    if (!tracker) return null;

    const phase = tracker.phases[phaseName];
    if (!phase) return null;

    phase.status = 'active';
    phase.started_at = Date.now();
    tracker.status = 'in_progress';
    tracker.updated_at = Date.now();

    this._persist(trackerId);
    this._emit('phase_started', { trackerId, phaseName, phase });

    // Run K'UHUL operation for phase start
    if (typeof K !== 'undefined') {
      K.run(`progress_${trackerId}`, `${phase.glyph}start⟁`, { tracker, phase: phaseName });
    }

    return phase;
  },

  /**
   * Complete a phase
   */
  completePhase(trackerId, phaseName, outputs = []) {
    const tracker = this.trackers.get(trackerId || this.activeTracker);
    if (!tracker) return null;

    const phase = tracker.phases[phaseName];
    if (!phase) return null;

    phase.status = 'completed';
    phase.completed_at = Date.now();
    phase.progress_pct = 100;
    phase.duration_ms = phase.started_at ? (phase.completed_at - phase.started_at) : 0;
    phase.outputs = outputs;
    tracker.updated_at = Date.now();

    this._recalculateProgress(trackerId);
    this._persist(trackerId);
    this._emit('phase_completed', { trackerId, phaseName, phase });

    return phase;
  },

  /**
   * Update phase progress
   */
  updatePhaseProgress(trackerId, phaseName, progressPct) {
    const tracker = this.trackers.get(trackerId || this.activeTracker);
    if (!tracker) return null;

    const phase = tracker.phases[phaseName];
    if (!phase) return null;

    phase.progress_pct = Math.min(100, Math.max(0, progressPct));
    if (phase.status === 'pending' && progressPct > 0) {
      phase.status = 'active';
      phase.started_at = Date.now();
    }
    tracker.updated_at = Date.now();

    this._recalculateProgress(trackerId);
    this._persist(trackerId);
    this._emit('phase_progress', { trackerId, phaseName, progress: progressPct });

    return phase;
  },

  /**
   * Add a todo item
   */
  addTodo(trackerId, todoData) {
    const tracker = this.trackers.get(trackerId || this.activeTracker);
    if (!tracker) return null;

    const todoId = `todo_${Date.now()}`;
    const todo = {
      id: todoId,
      content: todoData.content,
      status: todoData.status || 'pending',
      priority: todoData.priority || 'P2',
      phase: todoData.phase || 'cross_phase',
      category: todoData.category || 'general',
      dependencies: todoData.dependencies || [],
      created_at: Date.now(),
      completed_at: null
    };

    tracker.todos.push(todo);
    tracker.recap.metrics.tasks_total++;
    tracker.updated_at = Date.now();

    // Add to phase tasks if phase specified
    if (todoData.phase && tracker.phases[todoData.phase]) {
      tracker.phases[todoData.phase].tasks.push({
        id: todoId,
        content: todo.content,
        status: todo.status,
        priority: todo.priority
      });
    }

    this._persist(trackerId);
    this._emit('todo_added', { trackerId, todo });

    return todo;
  },

  /**
   * Update todo status
   */
  updateTodo(trackerId, todoId, updates) {
    const tracker = this.trackers.get(trackerId || this.activeTracker);
    if (!tracker) return null;

    const todo = tracker.todos.find(t => t.id === todoId);
    if (!todo) return null;

    const previousStatus = todo.status;
    Object.assign(todo, updates);

    if (updates.status === 'completed' && previousStatus !== 'completed') {
      todo.completed_at = Date.now();
      tracker.recap.metrics.tasks_completed++;
    }

    tracker.updated_at = Date.now();
    this._recalculateProgress(trackerId);
    this._persist(trackerId);
    this._emit('todo_updated', { trackerId, todo });

    return todo;
  },

  /**
   * Add a milestone
   */
  addMilestone(trackerId, milestoneData) {
    const tracker = this.trackers.get(trackerId || this.activeTracker);
    if (!tracker) return null;

    const milestone = {
      id: `ms_${Date.now()}`,
      name: milestoneData.name,
      description: milestoneData.description || '',
      target_phase: milestoneData.target_phase || 'collapse',
      status: 'pending',
      target_date: milestoneData.target_date || null,
      reached_at: null,
      deliverables: milestoneData.deliverables || []
    };

    tracker.milestones.push(milestone);
    tracker.updated_at = Date.now();

    this._persist(trackerId);
    this._emit('milestone_added', { trackerId, milestone });

    return milestone;
  },

  /**
   * Reach a milestone
   */
  reachMilestone(trackerId, milestoneId) {
    const tracker = this.trackers.get(trackerId || this.activeTracker);
    if (!tracker) return null;

    const milestone = tracker.milestones.find(m => m.id === milestoneId);
    if (!milestone) return null;

    milestone.status = 'reached';
    milestone.reached_at = Date.now();
    tracker.updated_at = Date.now();

    this._persist(trackerId);
    this._emit('milestone_reached', { trackerId, milestone });

    return milestone;
  },

  /**
   * Add system to the systems matrix
   */
  addSystem(trackerId, systemData) {
    const tracker = this.trackers.get(trackerId || this.activeTracker);
    if (!tracker) return null;

    const system = {
      system: systemData.system,
      category: systemData.category || 'core',
      status: systemData.status || 'not_started',
      health: systemData.health || 'unknown',
      progress_pct: systemData.progress_pct || 0,
      owner: systemData.owner || '',
      notes: systemData.notes || '',
      dependencies: systemData.dependencies || []
    };

    tracker.recap.systems_matrix.push(system);
    tracker.updated_at = Date.now();

    this._persist(trackerId);
    this._emit('system_added', { trackerId, system });

    return system;
  },

  /**
   * Update system status
   */
  updateSystem(trackerId, systemName, updates) {
    const tracker = this.trackers.get(trackerId || this.activeTracker);
    if (!tracker) return null;

    const system = tracker.recap.systems_matrix.find(s => s.system === systemName);
    if (!system) return null;

    Object.assign(system, updates);
    tracker.updated_at = Date.now();

    this._persist(trackerId);
    this._emit('system_updated', { trackerId, system });

    return system;
  },

  /**
   * Update recap summary
   */
  updateRecap(trackerId, recapUpdates) {
    const tracker = this.trackers.get(trackerId || this.activeTracker);
    if (!tracker) return null;

    if (recapUpdates.summary) {
      Object.assign(tracker.recap.summary, recapUpdates.summary);
    }
    if (recapUpdates.metrics) {
      Object.assign(tracker.recap.metrics, recapUpdates.metrics);
    }

    tracker.updated_at = Date.now();
    this._persist(trackerId);
    this._emit('recap_updated', { trackerId, recap: tracker.recap });

    return tracker.recap;
  },

  /**
   * Add key achievement
   */
  addAchievement(trackerId, achievement) {
    const tracker = this.trackers.get(trackerId || this.activeTracker);
    if (!tracker) return null;

    tracker.recap.summary.key_achievements.push(achievement);
    tracker.updated_at = Date.now();

    this._persist(trackerId);
    this._emit('achievement_added', { trackerId, achievement });

    return tracker.recap.summary.key_achievements;
  },

  /**
   * Add blocker
   */
  addBlocker(trackerId, blocker, phaseName = null) {
    const tracker = this.trackers.get(trackerId || this.activeTracker);
    if (!tracker) return null;

    tracker.recap.summary.blockers.push(blocker);

    if (phaseName && tracker.phases[phaseName]) {
      tracker.phases[phaseName].blockers.push(blocker);
      tracker.phases[phaseName].status = 'blocked';
    }

    tracker.updated_at = Date.now();
    this._persist(trackerId);
    this._emit('blocker_added', { trackerId, blocker, phaseName });

    return tracker.recap.summary.blockers;
  },

  /**
   * Recalculate overall progress
   */
  _recalculateProgress(trackerId) {
    const tracker = this.trackers.get(trackerId || this.activeTracker);
    if (!tracker) return;

    // Calculate phase-based progress (each phase is 25%)
    const phaseWeight = 25;
    let totalProgress = 0;

    ['pop', 'wo', 'sek', 'collapse'].forEach(phaseName => {
      const phase = tracker.phases[phaseName];
      totalProgress += (phase.progress_pct / 100) * phaseWeight;
    });

    tracker.progress_pct = Math.round(totalProgress * 100) / 100;

    // Update status based on progress
    if (tracker.progress_pct === 100) {
      tracker.status = 'completed';
    } else if (tracker.progress_pct > 0) {
      tracker.status = 'in_progress';
    }
  },

  /**
   * Get tracker by ID
   */
  get(trackerId) {
    return this.trackers.get(trackerId || this.activeTracker);
  },

  /**
   * Get all trackers
   */
  getAll() {
    return Array.from(this.trackers.values());
  },

  /**
   * Generate progress report
   */
  generateReport(trackerId) {
    const tracker = this.trackers.get(trackerId || this.activeTracker);
    if (!tracker) return null;

    const report = {
      tracker_id: tracker.tracker_id,
      name: tracker.name,
      status: tracker.status,
      progress_pct: tracker.progress_pct,
      generated_at: Date.now(),

      phase_summary: Object.entries(tracker.phases).map(([key, phase]) => ({
        phase: key,
        glyph: phase.glyph,
        status: phase.status,
        progress: phase.progress_pct,
        tasks_count: phase.tasks.length,
        blockers_count: phase.blockers.length
      })),

      todos_summary: {
        total: tracker.todos.length,
        pending: tracker.todos.filter(t => t.status === 'pending').length,
        in_progress: tracker.todos.filter(t => t.status === 'in_progress').length,
        completed: tracker.todos.filter(t => t.status === 'completed').length,
        blocked: tracker.todos.filter(t => t.status === 'blocked').length
      },

      milestones_summary: {
        total: tracker.milestones.length,
        reached: tracker.milestones.filter(m => m.status === 'reached').length,
        pending: tracker.milestones.filter(m => m.status === 'pending').length
      },

      systems_health: tracker.recap.systems_matrix.map(s => ({
        system: s.system,
        status: s.status,
        health: s.health,
        progress: s.progress_pct
      })),

      recap: tracker.recap
    };

    return report;
  },

  /**
   * Generate markdown report
   */
  generateMarkdownReport(trackerId) {
    const tracker = this.trackers.get(trackerId || this.activeTracker);
    if (!tracker) return '';

    const report = this.generateReport(trackerId);
    const now = new Date();

    let md = `# ${tracker.name} - Progress Report\n\n`;
    md += `**Generated:** ${now.toISOString()}\n`;
    md += `**Status:** ${tracker.status}\n`;
    md += `**Progress:** ${tracker.progress_pct}%\n\n`;
    md += `---\n\n`;

    // XCFE Phase Progress
    md += `## XCFE Phase Progress\n\n`;
    md += `| Phase | Glyph | Status | Progress |\n`;
    md += `|-------|-------|--------|----------|\n`;
    report.phase_summary.forEach(p => {
      const statusEmoji = p.status === 'completed' ? '\\u2705' : p.status === 'active' ? '\\u23F3' : '\\u23F8';
      md += `| ${p.phase} | \`${p.glyph}\` | ${statusEmoji} ${p.status} | ${p.progress}% |\n`;
    });
    md += `\n`;

    // Todos Summary
    md += `## Todos Summary\n\n`;
    md += `- **Total:** ${report.todos_summary.total}\n`;
    md += `- **Pending:** ${report.todos_summary.pending}\n`;
    md += `- **In Progress:** ${report.todos_summary.in_progress}\n`;
    md += `- **Completed:** ${report.todos_summary.completed}\n`;
    md += `- **Blocked:** ${report.todos_summary.blocked}\n\n`;

    // Systems Matrix
    if (report.systems_health.length > 0) {
      md += `## Systems Matrix\n\n`;
      md += `| System | Status | Health | Progress |\n`;
      md += `|--------|--------|--------|----------|\n`;
      report.systems_health.forEach(s => {
        const healthEmoji = s.health === 'healthy' ? '\\u1F7E2' : s.health === 'degraded' ? '\\u1F7E1' : '\\u1F534';
        md += `| ${s.system} | ${s.status} | ${healthEmoji} ${s.health} | ${s.progress}% |\n`;
      });
      md += `\n`;
    }

    // Key Achievements
    if (tracker.recap.summary.key_achievements.length > 0) {
      md += `## Key Achievements\n\n`;
      tracker.recap.summary.key_achievements.forEach(a => {
        md += `- \\u2705 ${a}\n`;
      });
      md += `\n`;
    }

    // Blockers
    if (tracker.recap.summary.blockers.length > 0) {
      md += `## Blockers\n\n`;
      tracker.recap.summary.blockers.forEach(b => {
        md += `- \\u1F6A7 ${b}\n`;
      });
      md += `\n`;
    }

    // Next Steps
    if (tracker.recap.summary.next_steps.length > 0) {
      md += `## Next Steps\n\n`;
      tracker.recap.summary.next_steps.forEach(s => {
        md += `- \\u27A1 ${s}\n`;
      });
      md += `\n`;
    }

    // Metrics
    md += `## Metrics\n\n`;
    md += `| Metric | Value |\n`;
    md += `|--------|-------|\n`;
    md += `| Tasks Completed | ${tracker.recap.metrics.tasks_completed} / ${tracker.recap.metrics.tasks_total} |\n`;
    md += `| Lines of Code | ${tracker.recap.metrics.lines_of_code} |\n`;
    md += `| Files Created | ${tracker.recap.metrics.files_created} |\n`;
    md += `| Files Modified | ${tracker.recap.metrics.files_modified} |\n`;
    md += `| Commits | ${tracker.recap.metrics.commits} |\n`;

    return md;
  },

  /**
   * Persist tracker to storage
   */
  _persist(trackerId) {
    const tracker = this.trackers.get(trackerId);
    if (!tracker) return;

    try {
      const key = `progress_tracker_${trackerId}`;
      localStorage.setItem(key, JSON.stringify(tracker));

      // Update index
      const index = JSON.parse(localStorage.getItem('progress_tracker_index') || '[]');
      if (!index.includes(trackerId)) {
        index.push(trackerId);
        localStorage.setItem('progress_tracker_index', JSON.stringify(index));
      }
    } catch (e) {
      console.warn('Failed to persist tracker:', e);
    }
  },

  /**
   * Load trackers from storage
   */
  load() {
    try {
      const index = JSON.parse(localStorage.getItem('progress_tracker_index') || '[]');
      index.forEach(trackerId => {
        const data = localStorage.getItem(`progress_tracker_${trackerId}`);
        if (data) {
          this.trackers.set(trackerId, JSON.parse(data));
        }
      });

      // Set active tracker to most recent
      if (index.length > 0) {
        this.activeTracker = index[index.length - 1];
      }
    } catch (e) {
      console.warn('Failed to load trackers:', e);
    }
  },

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  },

  /**
   * Emit event
   */
  _emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error('Event callback error:', e);
      }
    });
  },

  /**
   * K'UHUL integration - execute phase operation
   */
  async executePhase(trackerId, phaseName, operation) {
    const tracker = this.trackers.get(trackerId || this.activeTracker);
    if (!tracker) return null;

    const phase = tracker.phases[phaseName];
    if (!phase) return null;

    // Start phase if not already active
    if (phase.status === 'pending') {
      this.startPhase(trackerId, phaseName);
    }

    // Execute K'UHUL operation
    let result = null;
    if (typeof K !== 'undefined') {
      result = await K.run(
        `${trackerId}_${phaseName}`,
        `${phase.glyph}${operation}⟁`,
        { tracker, phase: phaseName, operation }
      );
    }

    return { phase, result };
  }
};

/* ============================================================
   SCXQ2 PROGRESS PACKET DEFINITIONS
   ============================================================ */

const SCXQ2_PROGRESS = {
  HAZ: "☣PROGRESS:",
  PACKETS: {
    TRACKER: "☣PROGRESS:TRACKER",
    PHASE: "☣PROGRESS:PHASE",
    TODO: "☣PROGRESS:TODO",
    MILESTONE: "☣PROGRESS:MILESTONE",
    RECAP: "☣PROGRESS:RECAP",
    MATRIX: "☣PROGRESS:MATRIX"
  },

  encode(type, data) {
    const packet = this.PACKETS[type.toUpperCase()];
    if (!packet) return null;

    return `${packet}:${btoa(JSON.stringify(data))}`;
  },

  decode(encoded) {
    const match = encoded.match(/^☣PROGRESS:([A-Z]+):(.+)$/);
    if (!match) return null;

    return {
      type: match[1].toLowerCase(),
      data: JSON.parse(atob(match[2]))
    };
  }
};

/* ============================================================
   ASX BLOCK COMPONENT FOR PROGRESS
   ============================================================ */

const ASXProgressBlock = {
  /**
   * Create progress tracker ASX block
   */
  createTrackerBlock(tracker) {
    return {
      type: "asx-block",
      id: `progress-tracker-${tracker.tracker_id}`,
      component: "ProgressTracker",
      props: {
        trackerId: tracker.tracker_id,
        name: tracker.name,
        status: tracker.status,
        progress: tracker.progress_pct,
        phases: tracker.phases
      },
      state: {
        phase: this._getCurrentPhase(tracker),
        mounted: true,
        hash: this._computeHash(tracker)
      }
    };
  },

  /**
   * Create phase progress ASX block
   */
  createPhaseBlock(tracker, phaseName) {
    const phase = tracker.phases[phaseName];
    return {
      type: "asx-block",
      id: `progress-phase-${phaseName}`,
      component: "ProgressPhase",
      props: {
        phaseName: phaseName,
        glyph: phase.glyph,
        status: phase.status,
        progress: phase.progress_pct,
        tasks: phase.tasks,
        blockers: phase.blockers
      },
      state: {
        phase: `@${phaseName.charAt(0).toUpperCase() + phaseName.slice(1)}`,
        mounted: true
      }
    };
  },

  /**
   * Create systems matrix ASX block
   */
  createMatrixBlock(tracker) {
    return {
      type: "asx-block",
      id: "systems-matrix",
      component: "SystemsMatrix",
      props: {
        systems: tracker.recap.systems_matrix,
        metrics: tracker.recap.metrics
      },
      state: {
        mounted: true
      }
    };
  },

  /**
   * Get current active phase
   */
  _getCurrentPhase(tracker) {
    for (const [key, phase] of Object.entries(tracker.phases)) {
      if (phase.status === 'active') {
        return `@${key.charAt(0).toUpperCase() + key.slice(1)}`;
      }
    }
    return '@Pop';
  },

  /**
   * Compute hash for state tracking
   */
  _computeHash(tracker) {
    const str = JSON.stringify({
      status: tracker.status,
      progress: tracker.progress_pct,
      updated: tracker.updated_at
    });
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `sha256:${Math.abs(hash).toString(16).padStart(16, '0')}`;
  }
};

/* ============================================================
   INITIALIZE AND EXPORT
   ============================================================ */

// Load existing trackers on initialization
if (typeof localStorage !== 'undefined') {
  ProgressTracker.load();
}

// Make available globally
if (typeof window !== 'undefined') {
  window.ProgressTracker = ProgressTracker;
  window.SCXQ2_PROGRESS = SCXQ2_PROGRESS;
  window.ASXProgressBlock = ASXProgressBlock;
}

/* ============================================================
   SRP KERNEL - System Runtime Preprocessor
   ============================================================ */

/**
 * SRP (System Runtime Preprocessor) - Always-active runtime layer
 * Implements: submit -> tick -> collapse -> project cycle
 */
const SRP = {
  // Core state (Wo-plane)
  state: {},

  // Event queue
  queue: [],

  // Registered directives
  directives: [],

  // Projector rules
  projectorRules: [],

  // Configuration
  config: {
    tick_mode: 'microtask',
    batch_events: true,
    validate_events: true,
    record_trace: false
  },

  // Execution trace for replay
  trace: [],

  // Listeners for projections
  projectionListeners: [],

  /**
   * Boot the SRP kernel with initial state
   */
  boot(seed = {}) {
    this.state = { ...seed.state };
    this.directives = seed.directives || [];
    this.projectorRules = seed.projector?.rules || [];
    this.config = { ...this.config, ...seed.scheduler };

    console.log('SRP Kernel booted with state:', Object.keys(this.state));
    return { status: 'booted', state_keys: Object.keys(this.state) };
  },

  /**
   * Submit an event to the SRP queue
   */
  submit(event) {
    // Validate event structure
    if (this.config.validate_events && !this._validateEvent(event)) {
      console.warn('SRP: Invalid event rejected:', event);
      return { status: 'rejected', reason: 'invalid_event' };
    }

    // Add timestamp if missing
    if (!event['@ts']) {
      event['@ts'] = Date.now();
    }

    // Enqueue
    this.queue.push(event);

    // Record trace
    if (this.config.record_trace) {
      this.trace.push({ type: 'submit', event, ts: Date.now() });
    }

    // Schedule tick
    this._scheduleTick();

    return { status: 'queued', event_id: event['@id'] };
  },

  /**
   * Schedule the next tick based on config
   */
  _scheduleTick() {
    if (this._tickScheduled) return;
    this._tickScheduled = true;

    switch (this.config.tick_mode) {
      case 'immediate':
        this.tick();
        break;
      case 'microtask':
        queueMicrotask(() => this.tick());
        break;
      case 'animation_frame':
        requestAnimationFrame(() => this.tick());
        break;
      default:
        setTimeout(() => this.tick(), 0);
    }
  },

  /**
   * Tick - Process queued events through collapse cycle
   */
  tick() {
    this._tickScheduled = false;

    if (this.queue.length === 0) return;

    // Drain queue deterministically
    const events = this.config.batch_events
      ? this.queue.splice(0, this.queue.length)
      : [this.queue.shift()];

    // Collapse phase
    const deltas = [];
    for (const event of events) {
      const eventDeltas = this._collapse(event);
      deltas.push(...eventDeltas);
    }

    // Commit deltas
    for (const delta of deltas) {
      this._commit(delta);
    }

    // Project
    const projection = this._project();

    // Record trace
    if (this.config.record_trace) {
      this.trace.push({ type: 'tick', events: events.length, deltas: deltas.length, ts: Date.now() });
    }

    // Emit projection to listeners
    this._emitProjection(projection);

    // Continue if more events
    if (this.queue.length > 0) {
      this._scheduleTick();
    }
  },

  /**
   * Collapse - Apply directives to produce deltas
   */
  _collapse(event) {
    const deltas = [];

    for (const directive of this.directives) {
      if (!this._matchesDirective(directive, event)) continue;

      const control = directive['@control'];
      const conditionMet = this._evaluateCondition(control['@if']);

      const actions = conditionMet ? control['@then'] : control['@else'];
      if (!actions) continue;

      const delta = this._executeActions(actions, event);
      if (delta) {
        delta['@source'] = directive['@id'] || 'anonymous_directive';
        deltas.push(delta);
      }
    }

    return deltas;
  },

  /**
   * Check if directive matches event
   */
  _matchesDirective(directive, event) {
    const when = directive['@control']?.['@if'];
    // If directive has no explicit event filter, it matches all
    return true;
  },

  /**
   * Evaluate a condition against current state
   */
  _evaluateCondition(condition) {
    if (!condition) return true;

    // Path equality
    if (condition.path && 'eq' in condition) {
      return this._getPath(condition.path) === condition.eq;
    }

    // Path inequality
    if (condition.path && 'neq' in condition) {
      return this._getPath(condition.path) !== condition.neq;
    }

    // Path membership
    if (condition.path && 'in' in condition) {
      return condition.in.includes(this._getPath(condition.path));
    }

    // Greater than
    if (condition.path && 'gt' in condition) {
      return this._getPath(condition.path) > condition.gt;
    }

    // Less than
    if (condition.path && 'lt' in condition) {
      return this._getPath(condition.path) < condition.lt;
    }

    // Exists
    if (condition.path && 'exists' in condition) {
      const exists = this._getPath(condition.path) !== undefined;
      return condition.exists ? exists : !exists;
    }

    // Logical AND
    if (condition.and) {
      return condition.and.every(c => this._evaluateCondition(c));
    }

    // Logical OR
    if (condition.or) {
      return condition.or.some(c => this._evaluateCondition(c));
    }

    // Logical NOT
    if (condition.not) {
      return !this._evaluateCondition(condition.not);
    }

    return true;
  },

  /**
   * Execute actions and produce delta
   */
  _executeActions(actions, event) {
    const delta = {
      '@type': 'srp.delta.v1',
      '@ts': Date.now(),
      '@writes': [],
      '@emits': []
    };

    // Handle sequence of actions
    if (actions['@sequence']) {
      for (const action of actions['@sequence']) {
        this._processAction(action, delta, event);
      }
    } else {
      this._processAction(actions, delta, event);
    }

    return delta['@writes'].length > 0 || delta['@emits'].length > 0 ? delta : null;
  },

  /**
   * Process a single action
   */
  _processAction(action, delta, event) {
    // Set value
    if (action['@set']) {
      delta['@writes'].push({
        op: 'set',
        path: action['@set'].path,
        value: action['@set'].value
      });
    }

    // Toggle boolean
    if (action['@toggle']) {
      const currentValue = this._getPath(action['@toggle'].path);
      delta['@writes'].push({
        op: 'set',
        path: action['@toggle'].path,
        value: !currentValue,
        prev: currentValue
      });
    }

    // Increment
    if (action['@inc']) {
      const currentValue = this._getPath(action['@inc'].path) || 0;
      const by = action['@inc'].by || 1;
      delta['@writes'].push({
        op: 'set',
        path: action['@inc'].path,
        value: currentValue + by,
        prev: currentValue
      });
    }

    // Decrement
    if (action['@dec']) {
      const currentValue = this._getPath(action['@dec'].path) || 0;
      const by = action['@dec'].by || 1;
      delta['@writes'].push({
        op: 'set',
        path: action['@dec'].path,
        value: currentValue - by,
        prev: currentValue
      });
    }

    // Push to array
    if (action['@push']) {
      delta['@writes'].push({
        op: 'push',
        path: action['@push'].path,
        value: action['@push'].value
      });
    }

    // Emit to surface
    if (action['@view']) {
      delta['@emits'].push({
        surface: 'view',
        value: action['@view']
      });
    }

    // Emit event
    if (action['@emit']) {
      this.submit({
        '@type': 'srp.event.v1',
        '@id': `evt:${action['@emit'].event}:${Date.now()}`,
        '@ts': Date.now(),
        '@source': 'kernel',
        '@name': action['@emit'].event,
        '@payload': action['@emit'].payload || {}
      });
    }
  },

  /**
   * Commit delta to state
   */
  _commit(delta) {
    for (const write of delta['@writes'] || []) {
      switch (write.op) {
        case 'set':
          this._setPath(write.path, write.value);
          break;
        case 'push':
          const arr = this._getPath(write.path) || [];
          arr.push(write.value);
          this._setPath(write.path, arr);
          break;
        case 'toggle':
          const current = this._getPath(write.path);
          this._setPath(write.path, !current);
          break;
      }
    }
  },

  /**
   * Project state to output surfaces
   */
  _project() {
    const projection = {
      '@type': 'srp.projection.v1',
      '@ts': Date.now(),
      '@css_vars': {},
      '@dom_tokens': []
    };

    // Apply projector rules
    for (const rule of this.projectorRules) {
      if (rule.when && !this._evaluateCondition(rule.when)) continue;

      const proj = rule.project;
      if (proj['@css_vars']) {
        Object.assign(projection['@css_vars'], proj['@css_vars']);
      }
      if (proj['@dom_tokens']) {
        projection['@dom_tokens'].push(...proj['@dom_tokens']);
      }
    }

    // Add state-derived CSS vars
    projection['@css_vars']['--srp-state'] = JSON.stringify(this.state);

    return projection;
  },

  /**
   * Emit projection to listeners
   */
  _emitProjection(projection) {
    for (const listener of this.projectionListeners) {
      try {
        listener(projection, this.state);
      } catch (e) {
        console.error('SRP projection listener error:', e);
      }
    }
  },

  /**
   * Register projection listener
   */
  onProjection(callback) {
    this.projectionListeners.push(callback);
  },

  /**
   * Validate event structure
   */
  _validateEvent(event) {
    return event &&
      event['@type'] === 'srp.event.v1' &&
      typeof event['@name'] === 'string';
  },

  /**
   * Get value at dot-notation path
   */
  _getPath(path) {
    const keys = path.split('.');
    let current = this.state;
    for (const key of keys) {
      if (current === undefined || current === null) return undefined;
      current = current[key];
    }
    return current;
  },

  /**
   * Set value at dot-notation path
   */
  _setPath(path, value) {
    const keys = path.split('.');
    let current = this.state;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (current[key] === undefined) {
        current[key] = {};
      }
      current = current[key];
    }
    current[keys[keys.length - 1]] = value;
  },

  /**
   * Get current state snapshot
   */
  snapshot() {
    return {
      state: JSON.parse(JSON.stringify(this.state)),
      queue_length: this.queue.length,
      directive_count: this.directives.length,
      trace_length: this.trace.length
    };
  },

  /**
   * Replay from trace
   */
  replay(trace) {
    const results = [];
    for (const entry of trace) {
      if (entry.type === 'submit') {
        results.push(this.submit(entry.event));
      }
    }
    return results;
  }
};

/* ============================================================
   SRP + PROGRESS TRACKER INTEGRATION
   ============================================================ */

/**
 * Create SRP class for ProgressTracker
 */
function createProgressTrackerSRPClass(tracker) {
  return {
    '@type': 'srp.class.v1',
    '@id': `asx://srp/class/progress-tracker-${tracker.tracker_id}`,
    '@version': '1.0.0',
    'name': 'ProgressTrackerSRP',
    'state': {
      phases: tracker.phases,
      active_phase: null,
      overall_progress: tracker.progress_pct,
      status: tracker.status
    },
    'directives': [
      {
        '@type': 'srp.directive.v1',
        '@id': 'dir:start_phase',
        '@control': {
          '@if': { 'path': 'active_phase', 'eq': null },
          '@then': { '@set': { 'path': 'active_phase', 'value': 'pop' } }
        }
      },
      {
        '@type': 'srp.directive.v1',
        '@id': 'dir:phase_progress',
        '@control': {
          '@if': { 'path': 'overall_progress', 'lt': 100 },
          '@then': { '@view': 'in_progress' }
        }
      },
      {
        '@type': 'srp.directive.v1',
        '@id': 'dir:phase_complete',
        '@control': {
          '@if': { 'path': 'overall_progress', 'eq': 100 },
          '@then': {
            '@sequence': [
              { '@set': { 'path': 'status', 'value': 'completed' } },
              { '@view': 'completed' }
            ]
          }
        }
      }
    ],
    'projector': {
      'surfaces': ['dom', 'css'],
      'rules': [
        {
          'when': { 'path': 'status', 'eq': 'in_progress' },
          'project': {
            '@type': 'srp.projection.v1',
            '@css_vars': { '--tracker-status': 'in_progress' },
            '@dom_tokens': [
              { 'selector': '.tracker', 'class_add': ['active'] }
            ]
          }
        }
      ]
    }
  };
}

// Export SRP integration
if (typeof window !== 'undefined') {
  window.SRP = SRP;
  window.createProgressTrackerSRPClass = createProgressTrackerSRPClass;
}

/* ============================================================
   INITIALIZE AND EXPORT
   ============================================================ */

// Load existing trackers on initialization
if (typeof localStorage !== 'undefined') {
  ProgressTracker.load();
}

// Make available globally
if (typeof window !== 'undefined') {
  window.ProgressTracker = ProgressTracker;
  window.SCXQ2_PROGRESS = SCXQ2_PROGRESS;
  window.ASXProgressBlock = ASXProgressBlock;
}

console.log('K\'UHUL PROGRESS TRACKER v1.0 + SRP v1 - LOADED');
console.log('- XCFE Phases: Ready');
console.log('- Todo Management: Active');
console.log('- Systems Matrix: Initialized');
console.log('- Recap Engine: Ready');
console.log('- SRP Kernel: Initialized');
