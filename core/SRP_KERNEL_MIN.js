/* SRP_KERNEL_MIN.js (<200 lines, runnable)
   SRP: System Runtime Preprocessor (locked to ASX-R v1)
   Demo: slider → CSS(:root) → GPU(WebGL min) → MeshChain mint
   Record → replay → hash-verify (event log → projection hash chain)

   Usage:
     SRP.boot(classDef);
     SRP.submit({ event_type: 'ui/slider', payload: { value: 0.5 } });
     SRP.tick();
     SRP.verifyReplay();
*/
(() => {
  const enc = new TextEncoder();
  const j = (x) => JSON.stringify(x);
  const now = () => Date.now();

  async function sha256(s) {
    const b = await crypto.subtle.digest('SHA-256', enc.encode(s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  function getPath(obj, path) {
    const parts = path.replace(/^\//, '').split('/').filter(Boolean);
    let cur = obj;
    for (const p of parts) cur = (cur || {})[p];
    return cur;
  }

  function applyPatch(state, patch) {
    for (const op of patch) {
      const parts = op.path.replace(/^\//, '').split('/').filter(Boolean);
      let cur = state;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]] ?? (cur[parts[i]] = {});
      const k = parts[parts.length - 1];
      if (op.op === 'set') cur[k] = op.value;
      if (op.op === 'inc') cur[k] = (Number(cur[k]) || 0) + Number(op.value || 1);
      if (op.op === 'push') { (cur[k] ??= []).push(op.value); }
      if (op.op === 'del') delete cur[k];
    }
  }

  // ---- SRP Kernel Core ----
  const SRP = window.SRP = {
    classDef: null,
    state: null,
    tickNo: 0,
    log: [],
    mintCalls: 0,
    lastProjectionHash: null,
    _gpu: null,

    async boot(classDef) {
      this.classDef = classDef;
      this.state = JSON.parse(JSON.stringify(classDef.state0 || {}));
      this.tickNo = 0;
      this.log = [];
      this.mintCalls = 0;
      const e = await this._mkEvent('srp/boot', { state0: this.state });
      this.log.push(e);
      await this.project();
      return this.state;
    },

    async submit({ event_type, payload }) {
      const e = await this._mkEvent(event_type, payload || {});
      this.log.push(e);
      await this._reduce(e);
      await this.project();
      return e;
    },

    async tick() {
      this.tickNo++;
      const e = await this._mkEvent('srp/tick', { tick: this.tickNo });
      this.log.push(e);
      await this._reduce(e);
      await this.project();
      return e;
    },

    async project() {
      // SRP → :root CSS vars
      const vars = (this.classDef.projection?.css_root?.vars) || {};
      for (const k in vars) {
        document.documentElement.style.setProperty(k, String(getPath(this.state, vars[k])));
      }
      // SRP → GPU bridge
      if (this._gpu) this._gpu.apply(getPath(this.state, '/slider') ?? 0);
      // SRP → projection hash chain
      const proj = { state: this.state, css: vars, tick: this.tickNo, mintCalls: this.mintCalls };
      const prev = this.lastProjectionHash || '';
      this.lastProjectionHash = await sha256(prev + '|' + j(proj));
      return this.lastProjectionHash;
    },

    async verifyReplay() {
      const snap = j(this.log);
      const expected = this.lastProjectionHash;
      const cls = this.classDef;
      // replay from log deterministically
      const r = { state: JSON.parse(JSON.stringify(cls.state0)), tickNo: 0, mintCalls: 0, last: '' };
      for (const e of this.log) {
        if (e.event_type === 'srp/boot') {
          r.state = JSON.parse(JSON.stringify(e.payload.state0));
        } else if (e.event_type === 'ui/slider') {
          r.state.slider = Number(e.payload.value);
        } else if (e.event_type === 'srp/tick') {
          r.tickNo++;
          r.state.tick = (r.state.tick || 0) + 1;
          r.state.active = true;
          // mint rule (same as reducer hooks)
          if ((r.state.slider || 0) > 0.7 && r.state.mint_armed) {
            r.mintCalls++;
            r.state.minted = (r.state.minted || 0) + 1;
            r.state.mint_armed = false;
          }
          if ((r.state.slider || 0) < 0.65) r.state.mint_armed = true;
        }
        const proj = { state: r.state, tick: r.tickNo, mintCalls: r.mintCalls };
        r.last = await sha256(r.last + '|' + j(proj));
      }
      return { ok: r.last === expected, expected, got: r.last, log_hash: await sha256(snap) };
    },

    async _mkEvent(event_type, payload) {
      const prev = this.log.length ? this.log[this.log.length - 1].hash : '';
      const nonce = this.log.length;
      const base = { class_id: this.classDef?.['@id'] || 'asx://srp/class/unknown', event_type, payload, nonce };
      const hash = await sha256(prev + '|' + j(base));
      return {
        '@id': `asx://srp/event/${nonce}`,
        '@type': 'srp.event',
        '@ts': now(),
        class_id: base.class_id,
        event_type,
        payload,
        nonce,
        prev_hash: prev,
        hash
      };
    },

    async _reduce(e) {
      if (e.event_type === 'ui/slider') {
        this.state.slider = Number(e.payload.value);
        return;
      }
      if (e.event_type === 'srp/tick') {
        this.state.tick = (this.state.tick || 0) + 1;
        this.state.active = true;
        // MeshChain hook: mint once per armed threshold crossing
        if ((this.state.slider || 0) > 0.7 && this.state.mint_armed) {
          this.state.mint_armed = false;
          this.state.minted = (this.state.minted || 0) + 1;
          await this._meshMint({ asset: 'ASX_DEMO', amount: 1 });
        }
        if ((this.state.slider || 0) < 0.65) this.state.mint_armed = true;
      }
    },

    async _meshMint(body) {
      // stubbed MeshChain execution hook (deterministic receipt)
      this.mintCalls++;
      const receipt = await sha256('meshMint|' + j(body) + '|' + (this.lastProjectionHash || ''));
      console.log('[MeshChain mint stub]', body, 'receipt=', receipt);
      return { ok: true, receipt };
    },

    attachGPU(canvas) {
      const gl = canvas.getContext('webgl');
      if (!gl) return;
      const vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs, 'attribute vec2 p; uniform float a; void main(){float c=cos(a),s=sin(a); vec2 r=vec2(c*p.x-s*p.y,s*p.x+c*p.y); gl_Position=vec4(r,0.,1.);}');
      gl.compileShader(vs);
      const fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fs, 'precision mediump float; void main(){gl_FragColor=vec4(0.2,0.9,0.8,1.0);}');
      gl.compileShader(fs);
      const pr = gl.createProgram();
      gl.attachShader(pr, vs);
      gl.attachShader(pr, fs);
      gl.linkProgram(pr);
      gl.useProgram(pr);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.6, -0.6, 0.6, -0.6, 0.0, 0.7]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const uA = gl.getUniformLocation(pr, 'a');
      this._gpu = {
        apply: (slider) => {
          gl.viewport(0, 0, canvas.width, canvas.height);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.uniform1f(uA, (slider || 0) * 6.28318);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
      };
    }
  };

  // ---- 10-line harness ----
  SRP.harness = async (classDef) => {
    await SRP.boot(classDef);
    await SRP.submit({ event_type: 'ui/slider', payload: { value: 0.4 } });
    await SRP.tick();
    console.log('SRP.state', SRP.state);
  };

  // ---- Mount demo UI (slider + canvas + verify button) ----
  SRP.mountDemo = async (classDef) => {
    const root = document.body;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding:12px;display:grid;gap:10px;font-family:system-ui;max-width:400px;';
    wrap.innerHTML = `
      <div>slider: <input id="srp_slider" type="range" min="0" max="1" step="0.01" value="0.25"> <span id="srp_val"></span></div>
      <canvas id="srp_gpu" width="240" height="240" style="border:1px solid #333;border-radius:10px;"></canvas>
      <button id="srp_tick">tick</button>
      <button id="srp_verify">verify replay</button>
      <pre id="srp_out" style="white-space:pre-wrap;background:#0b0f1a;color:#dff;padding:10px;border-radius:10px;font-size:12px;max-height:200px;overflow:auto;"></pre>
    `;
    root.appendChild(wrap);
    const s = wrap.querySelector('#srp_slider'), v = wrap.querySelector('#srp_val');
    const out = wrap.querySelector('#srp_out');
    SRP.attachGPU(wrap.querySelector('#srp_gpu'));
    await SRP.boot(classDef);
    v.textContent = String(SRP.state.slider);
    s.addEventListener('input', async () => {
      v.textContent = s.value;
      await SRP.submit({ event_type: 'ui/slider', payload: { value: Number(s.value) } });
      out.textContent = j({ state: SRP.state, proj_hash: SRP.lastProjectionHash }, null, 2);
    });
    wrap.querySelector('#srp_tick').onclick = async () => {
      await SRP.tick();
      out.textContent = j({ state: SRP.state, proj_hash: SRP.lastProjectionHash, mintCalls: SRP.mintCalls }, null, 2);
    };
    wrap.querySelector('#srp_verify').onclick = async () => {
      const r = await SRP.verifyReplay();
      out.textContent = j(r, null, 2);
    };
    out.textContent = j({ state: SRP.state, proj_hash: SRP.lastProjectionHash }, null, 2);
  };
})();
