/**
 * SRP Kernel v1 - System Runtime Preprocessor
 * ============================================
 * An always-active runtime layer that:
 * 1. Accepts events (submit)
 * 2. Applies directives (tick)
 * 3. Produces deltas (collapse)
 * 4. Emits projections (project)
 *
 * This replaces imperative handlers with deterministic fold transitions.
 */

const SRP = {
  // ---- Core State ----
  state: { active: false, tickCount: 0 },
  queue: [],
  reducers: [],

  // ---- Lifecycle ----

  /**
   * Boot the SRP kernel with manifest configuration
   */
  async boot() {
    try {
      const res = await fetch('./manifest.json', { cache: 'no-store' });
      const manifest = await res.json();
      const cls = manifest?.srp?.classes?.[0];

      if (cls) {
        // Install class into kernel
        SRP.state = cls.state ?? SRP.state;
        SRP.reducers = cls.reducers ?? [];
        console.log('[SRP] Booted with class:', cls.name);
      }
    } catch (err) {
      console.error('[SRP] Boot failed:', err);
    }
  },

  // ---- Submit → Enqueue ----

  /**
   * Submit an event to the SRP queue
   */
  submit(evt) {
    if (!evt || evt['@type'] !== 'srp.event') {
      console.warn('[SRP] Invalid event rejected:', evt);
      return;
    }

    SRP.queue.push(evt);
    console.log('[SRP] Event queued:', evt.event);

    // Trigger tick (in production, this could be batched)
    SRP.tick();
  },

  // ---- Tick → Collapse → Project ----

  /**
   * Process queued events deterministically
   */
  tick() {
    // Drain queue (deterministic ordering)
    const events = SRP.queue.splice(0, SRP.queue.length);

    if (events.length === 0) return;

    console.log('[SRP] Tick processing', events.length, 'events');

    // Collapse: apply directives
    for (const ev of events) {
      for (const dir of SRP.reducers) {
        if (dir.when?.event !== ev.event) continue;

        // Check optional guard
        if (dir.when.if && !SRP.evaluateGuard(dir.when.if, ev)) continue;

        // Apply directive actions
        SRP.applyDirective(dir, ev);
      }
    }

    // Project: emit UI update
    SRP.project();
  },

  /**
   * Evaluate a guard condition
   */
  evaluateGuard(guard, event) {
    // Simple path equality check
    if (guard.path && guard.eq !== undefined) {
      return SRP.getPath(guard.path) === guard.eq;
    }
    if (guard.path && guard.neq !== undefined) {
      return SRP.getPath(guard.path) !== guard.neq;
    }
    return true;
  },

  /**
   * Apply a directive's actions
   */
  applyDirective(dir, ev) {
    for (const step of dir.do || []) {
      switch (step.op) {
        case 'delta.emit':
          if (step.delta) SRP.applyDelta(step.delta);
          break;
        case 'state.set':
          if (step.path) SRP.setPath(step.path, step.value);
          break;
        case 'state.merge':
          if (step.path) SRP.mergePath(step.path, step.value);
          break;
        case 'state.toggle':
          if (step.path) SRP.togglePath(step.path);
          break;
        case 'queue.event':
          if (step.enqueue) SRP.queue.push(step.enqueue);
          break;
      }
    }
  },

  /**
   * Apply a delta to state
   */
  applyDelta(delta) {
    for (const op of delta.ops || []) {
      switch (op.op) {
        case 'set':
          SRP.setPath(op.path, op.value);
          break;
        case 'merge':
          SRP.mergePath(op.path, op.value);
          break;
        case 'toggle':
          SRP.togglePath(op.path);
          break;
        case 'inc':
          SRP.incPath(op.path, op.value ?? 1);
          break;
        case 'dec':
          SRP.decPath(op.path, op.value ?? 1);
          break;
        case 'push':
          SRP.pushPath(op.path, op.value);
          break;
        case 'remove':
          SRP.removePath(op.path, op.value);
          break;
      }
    }
  },

  // ---- State Path Helpers ----

  getPath(path) {
    const keys = path.split('.');
    let cur = SRP.state;
    for (const k of keys) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[k];
    }
    return cur;
  },

  setPath(path, value) {
    const keys = path.split('.');
    let cur = SRP.state;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in cur) || cur[k] === null || typeof cur[k] !== 'object') {
        cur[k] = {};
      }
      cur = cur[k];
    }
    cur[keys[keys.length - 1]] = value;
  },

  mergePath(path, value) {
    const cur = SRP.getPath(path);
    if (cur && typeof cur === 'object' && value && typeof value === 'object') {
      Object.assign(cur, value);
    } else {
      SRP.setPath(path, value);
    }
  },

  togglePath(path) {
    const v = !!SRP.getPath(path);
    SRP.setPath(path, !v);
  },

  incPath(path, amount = 1) {
    const v = Number(SRP.getPath(path)) || 0;
    SRP.setPath(path, v + amount);
  },

  decPath(path, amount = 1) {
    const v = Number(SRP.getPath(path)) || 0;
    SRP.setPath(path, v - amount);
  },

  pushPath(path, value) {
    let arr = SRP.getPath(path);
    if (!Array.isArray(arr)) {
      arr = [];
      SRP.setPath(path, arr);
    }
    arr.push(value);
  },

  removePath(path, value) {
    const arr = SRP.getPath(path);
    if (Array.isArray(arr)) {
      const idx = arr.indexOf(value);
      if (idx !== -1) arr.splice(idx, 1);
    }
  },

  // ---- Projection ----

  /**
   * Emit projection to all clients
   */
  project() {
    // Derive view from state
    const view = {
      statusText: SRP.state.active ? 'active' : 'inactive',
      active: !!SRP.state.active,
      tickCount: SRP.state.tickCount || 0
    };

    console.log('[SRP] Projecting:', view);

    // Broadcast to all clients
    SRP.broadcast({
      '@type': 'srp.projection.apply',
      '@ts': Date.now(),
      view
    });
  },

  /**
   * Broadcast message to all connected clients
   */
  broadcast(msg) {
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
      .then(clients => {
        clients.forEach(client => client.postMessage(msg));
      });
  },

  // ---- Observability ----

  /**
   * Get deterministic state snapshot
   */
  snapshot() {
    return {
      '@type': 'srp.snapshot',
      '@ts': Date.now(),
      state: JSON.parse(JSON.stringify(SRP.state)),
      queueLength: SRP.queue.length
    };
  }
};

// ---- Service Worker Lifecycle ----

self.addEventListener('install', (e) => {
  console.log('[SRP] Installing...');
  e.waitUntil(SRP.boot());
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('[SRP] Activating...');
  e.waitUntil(self.clients.claim());
});

// ---- Message Handler (submit entry point) ----

self.addEventListener('message', (e) => {
  const evt = e.data;

  // Only accept SRP events
  if (!evt || evt['@type'] !== 'srp.event') return;

  // Submit to SRP kernel
  SRP.submit(evt);
});

// ---- Optional: Fetch passthrough ----

self.addEventListener('fetch', (e) => {
  // Passthrough for now (could add caching layer)
  e.respondWith(fetch(e.request));
});
