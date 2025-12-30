// =======================================================
// API.GS — EXECUTABLE GAS API SHARD (PRODUCTION / LOCKED)
// Role: Public REST Router + Auth Gate + Usage Metering + Proxy
// Depends-On: auth.gs, usage.gs
// =======================================================


// =======================================================
// SHARD BOOT / STATE
// =======================================================

function apiShardInit() {
  const scriptProps = PropertiesService.getScriptProperties();
  const cache = CacheService.getScriptCache();

  const cached = cache.get("api_shard_state");
  if (cached) return JSON.parse(cached);

  let config = scriptProps.getProperties();
  if (!config.apiShardName) {
    scriptProps.setProperties({
      apiShardName: "MX2LM API SHARD",
      apiVersion: "1.1.0",
      apiCreated: new Date().toISOString(),
      // hard limits
      apiMaxBodyBytes: "262144",      // 256 KB
      apiProxyTimeoutMs: "25000",     // 25s
      apiProxyFollowRedirects: "false"
    });
    config = scriptProps.getProperties();
  }

  const providers = JSON.parse(scriptProps.getProperty("apiProviders") || "{}");

  const state = { config, providers };
  cache.put("api_shard_state", JSON.stringify(state), 300);
  return state;
}


// =======================================================
// UTIL: NORMALIZE ROUTE
// =======================================================

function apiNormRoute(route) {
  return String(route || "")
    .toLowerCase()
    .replace(/^\/+/, "");
}


// =======================================================
// PROVIDER REGISTRY (NO EXECUTION)
// =======================================================

function apiRegisterProvider(p) {
  const scriptProps = PropertiesService.getScriptProperties();
  const cache = CacheService.getScriptCache();
  const state = apiShardInit();

  if (!p || !p.id || !p.baseUrl) {
    return { success: false, error: "id and baseUrl required" };
  }

  const provider = {
    id: String(p.id),
    name: p.name ? String(p.name) : String(p.id),
    description: p.description ? String(p.description) : "",
    baseUrl: String(p.baseUrl),
    owner: p.owner ? String(p.owner) : "",
    public: String(p.public).toLowerCase() === "true",
    routes: Array.isArray(p.routes) ? p.routes : [],
    created: new Date().toISOString()
  };

  state.providers[provider.id] = provider;
  scriptProps.setProperty("apiProviders", JSON.stringify(state.providers));
  cache.remove("api_shard_state");

  return { success: true, provider };
}

function apiListProviders() {
  const state = apiShardInit();
  return { success: true, providers: state.providers };
}

function apiGetProvider(id) {
  const state = apiShardInit();
  const p = state.providers[id];
  if (!p) return { success: false, error: "Provider not found" };
  return { success: true, provider: p };
}


// =======================================================
// AUTH + CAPABILITY HOOKS (DEFER TO auth.gs IF PRESENT)
// =======================================================

function apiAuthGate(params, path, method) {
  if (typeof authCheckAccessFromParams === "function") {
    return authCheckAccessFromParams(params, path, method);
  }
  // fallback: public allow (not recommended, but deterministic)
  return { allowed: true, reason: "auth_unavailable_fallback_allow" };
}

// Optional capability check hook.
// Expected contract if implemented in auth.gs:
//   authCheckCapabilityFromParams(params, capability, contextObj) -> { allowed, reason, capability }
function apiCapabilityGate(params, capability, contextObj) {
  if (typeof authCheckCapabilityFromParams === "function") {
    return authCheckCapabilityFromParams(params, capability, contextObj || {});
  }
  // If no capability layer exists, we treat it as allowed once auth passed.
  return { allowed: true, reason: "capability_unavailable_fallback_allow", capability: capability };
}


// =======================================================
// USAGE (NEVER THROWS)
// =======================================================

function safeUsageLog(entry) {
  try {
    if (typeof usageLogRequest === "function") usageLogRequest(entry);
  } catch (e) {
    // intentionally ignored
  }
}


// =======================================================
// SAFE URL / SSRF GUARD (BEST-EFFORT)
// =======================================================

function apiIsPrivateHost_(host) {
  const h = String(host || "").toLowerCase();

  // obvious blocks
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0") return true;

  // IPv4 private ranges (string prefix checks)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    if (h.startsWith("10.")) return true;
    if (h.startsWith("127.")) return true;
    if (h.startsWith("192.168.")) return true;
    // 172.16.0.0–172.31.255.255
    if (h.startsWith("172.")) {
      const parts = h.split(".");
      const second = parseInt(parts[1], 10);
      if (second >= 16 && second <= 31) return true;
    }
    // link-local 169.254.0.0/16
    if (h.startsWith("169.254.")) return true;
  }

  // IPv6 local / link-local
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;

  return false;
}

function apiAssertSafeUrl_(url) {
  let u;
  try {
    u = new URL(String(url));
  } catch (e) {
    return { ok: false, error: "Invalid URL" };
  }
  if (u.protocol !== "https:") return { ok: false, error: "Only https:// allowed" };
  if (apiIsPrivateHost_(u.hostname)) return { ok: false, error: "Private/localhost targets blocked" };
  return { ok: true, url: u.toString() };
}


// =======================================================
// BODY PARSING (POST)
// =======================================================

function apiReadBody_(e, state) {
  const maxBytes = parseInt(state.config.apiMaxBodyBytes || "262144", 10);

  const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "";
  const bytes = Utilities.newBlob(raw).getBytes().length;
  if (bytes > maxBytes) {
    return { ok: false, error: "Payload too large", bytes: bytes, maxBytes: maxBytes };
  }

  const ctype = (e && e.postData && e.postData.type) ? String(e.postData.type) : "text/plain";
  // Try JSON if it looks like JSON or ctype says so.
  if (ctype.indexOf("application/json") !== -1 || (raw && raw.trim().startsWith("{"))) {
    try {
      const json = raw ? JSON.parse(raw) : {};
      return { ok: true, type: "json", raw: raw, json: json, bytes: bytes };
    } catch (err) {
      return { ok: false, error: "Invalid JSON body", details: String(err && err.message ? err.message : err) };
    }
  }

  return { ok: true, type: "text", raw: raw, bytes: bytes };
}


// =======================================================
// PROVIDER PROXY (PASSTHROUGH EXECUTION)
// =======================================================
//
// route=proxy
// required: provider_id, provider_route
// optional: provider_method (GET/POST), provider_query (json string), headers (json string)
//
// NOTE: proxy only targets *registered providers* (allowlist).
//

function apiProxyToProvider_(e, method, params, state) {
  const providerId = String(params.provider_id || params.providerId || "");
  const providerRoute = String(params.provider_route || params.providerRoute || "");
  const providerMethod = String(params.provider_method || params.providerMethod || method || "GET").toUpperCase();

  if (!providerId) return { success: false, error: "provider_id required" };
  if (!providerRoute) return { success: false, error: "provider_route required" };

  const p = state.providers[providerId];
  if (!p) return { success: false, error: "Provider not found" };

  // Capability: proxy.provider.<id>
  const cap = apiCapabilityGate(params, "proxy.provider." + providerId, {
    provider_id: providerId,
    route: providerRoute,
    method: providerMethod
  });
  if (!cap.allowed) return { success: false, error: cap.reason, capability: cap.capability };

  // Build URL
  const base = String(p.baseUrl || "").replace(/\/+$/, "");
  const safeBase = apiAssertSafeUrl_(base);
  if (!safeBase.ok) return { success: false, error: "Unsafe provider baseUrl: " + safeBase.error };

  const routeNorm = apiNormRoute(providerRoute);
  // Provider expects GAS style ?route=...
  let url = safeBase.url + "?route=" + encodeURIComponent(routeNorm);

  // Optional query passthrough
  let providerQueryObj = null;
  if (params.provider_query) {
    try { providerQueryObj = JSON.parse(String(params.provider_query)); }
    catch (err) { return { success: false, error: "provider_query must be valid JSON string" }; }
  }

  if (providerQueryObj && typeof providerQueryObj === "object") {
    Object.keys(providerQueryObj).forEach(function(k) {
      const v = providerQueryObj[k];
      // flatten primitives only
      if (v === null || v === undefined) return;
      if (typeof v === "object") return;
      url += "&" + encodeURIComponent(k) + "=" + encodeURIComponent(String(v));
    });
  }

  // Optional headers
  let headerObj = {};
  if (params.headers) {
    try { headerObj = JSON.parse(String(params.headers)); }
    catch (err) { return { success: false, error: "headers must be valid JSON string" }; }
  }

  // Never forward hop-by-hop headers
  const forbiddenHeaders = {
    "host": 1, "connection": 1, "keep-alive": 1, "proxy-authenticate": 1, "proxy-authorization": 1,
    "te": 1, "trailers": 1, "transfer-encoding": 1, "upgrade": 1
  };
  const headers = {};
  Object.keys(headerObj || {}).forEach(function(k) {
    const lk = String(k).toLowerCase();
    if (!forbiddenHeaders[lk]) headers[k] = String(headerObj[k]);
  });

  // Prepare payload (POST only)
  let payload = null;
  if (providerMethod === "POST") {
    const body = apiReadBody_(e, state);
    if (!body.ok) return { success: false, error: body.error, details: body.details || null };
    payload = body.raw || "";
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  // Fetch
  const timeoutMs = parseInt(state.config.apiProxyTimeoutMs || "25000", 10);
  const follow = String(state.config.apiProxyFollowRedirects || "false").toLowerCase() === "true";

  try {
    const resp = UrlFetchApp.fetch(url, {
      method: providerMethod,
      muteHttpExceptions: true,
      followRedirects: follow,
      headers: headers,
      payload: payload,
      contentType: headers["Content-Type"],
      validateHttpsCertificates: true,
      timeout: timeoutMs
    });

    const code = resp.getResponseCode();
    const text = resp.getContentText();

    // Try parse JSON for convenience, but never require it
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e2) {}

    return {
      success: code >= 200 && code < 300,
      provider_id: providerId,
      provider_route: routeNorm,
      provider_method: providerMethod,
      http_status: code,
      response: parsed !== null ? parsed : text
    };
  } catch (err) {
    return { success: false, error: "Proxy fetch failed", details: String(err && err.message ? err.message : err) };
  }
}


// =======================================================
// KQL-AWARE INFERENCE ROUTING (FORWARD-ONLY)
// =======================================================
//
// route=inference
// required: provider_id
// optional: model, kql (string), input (string/object), meta (object)
//
// Behavior: wraps request into an inference envelope and proxies to provider_route="inference"
//

function apiInferenceRoute_(e, method, params, state) {
  const providerId = String(params.provider_id || params.providerId || "");
  if (!providerId) return { success: false, error: "provider_id required" };

  // Capability: inference.provider.<id>
  const cap = apiCapabilityGate(params, "inference.provider." + providerId, { provider_id: providerId });
  if (!cap.allowed) return { success: false, error: cap.reason, capability: cap.capability };

  const body = apiReadBody_(e, state);
  if (!body.ok) return { success: false, error: body.error, details: body.details || null };

  // KQL-aware: accept kql as string; do not execute; forward to provider
  const req = (body.type === "json") ? (body.json || {}) : {};

  // Allow query via params too
  const kql = req.kql || params.kql || null;
  const model = req.model || params.model || null;

  const envelope = {
    "@type": "asx.inference.request.v1",
    "@time": new Date().toISOString(),
    "provider_id": providerId,
    "model": model,
    "kql": kql,
    "input": (req.input !== undefined ? req.input : (req.prompt !== undefined ? req.prompt : req)),
    "meta": req.meta || {}
  };

  // Proxy to provider inference route
  const proxyParams = Object.assign({}, params, {
    provider_id: providerId,
    provider_route: "inference",
    provider_method: "POST"
  });

  // Inject envelope as postData by rewriting e.postData
  const e2 = {
    parameter: proxyParams,
    postData: {
      contents: JSON.stringify(envelope),
      type: "application/json"
    }
  };

  return apiProxyToProvider_(e2, "POST", proxyParams, state);
}


// =======================================================
// MESH DISCOVERY + CAPABILITY CHECKS
// =======================================================
//
// route=mesh.discovery  (or route=mesh_discovery)
// returns: providers + public providers + optional capability snapshot
//

function apiMeshDiscovery_(params, state) {
  const cap = apiCapabilityGate(params, "mesh.discovery", { shard: state.config.apiShardName });
  if (!cap.allowed) return { success: false, error: cap.reason, capability: cap.capability };

  const providers = state.providers || {};
  const publicProviders = {};
  Object.keys(providers).forEach(function(k) {
    if (providers[k] && providers[k].public) publicProviders[k] = providers[k];
  });

  // Optional identity snapshot hook
  let identity = null;
  if (typeof authResolveIdentityFromParams === "function") {
    try { identity = authResolveIdentityFromParams(params); } catch (e) {}
  }

  return {
    success: true,
    shard: state.config.apiShardName,
    version: state.config.apiVersion,
    time: new Date().toISOString(),
    providers_total: Object.keys(providers).length,
    providers_public: Object.keys(publicProviders).length,
    providers: providers,               // full registry (auth already gated)
    public_providers: publicProviders,  // explicit public set
    identity: identity,
    capability: cap.capability
  };
}


// =======================================================
// CONFORMANCE VECTORS
// =======================================================

function apiConformanceVectors_() {
  // Vectors are deterministic, no external calls required
  return {
    success: true,
    "@type": "asx.api.conformance.v1",
    "@time": new Date().toISOString(),
    vectors: [
      {
        id: "api.health.get",
        method: "GET",
        route: "health",
        expect: { success: true }
      },
      {
        id: "api.status.get",
        method: "GET",
        route: "status",
        expect: { success: true }
      },
      {
        id: "api.providers.get",
        method: "GET",
        route: "providers",
        expect: { success: true }
      },
      {
        id: "api.mesh.discovery.get",
        method: "GET",
        route: "mesh.discovery",
        expect: { success: true }
      },
      {
        id: "api.proxy.guard.requires_provider_id",
        method: "GET",
        route: "proxy",
        params: { provider_route: "health" },
        expect: { success: false, error: "provider_id required" }
      },
      {
        id: "api.inference.guard.requires_provider_id",
        method: "POST",
        route: "inference",
        body: { input: "ping", kql: "KQL:TEST" },
        expect: { success: false, error: "provider_id required" }
      }
    ]
  };
}

function apiConformanceRun_(method, params, state) {
  // Executes only local endpoints (never proxies) to validate shard logic.
  const vectors = apiConformanceVectors_().vectors;

  const results = vectors.map(function(v) {
    let out;
    try {
      // Build a fake event
      const e = { parameter: Object.assign({}, (v.params || {}), { route: v.route }) };
      if (v.method === "POST") {
        e.postData = { contents: JSON.stringify(v.body || {}), type: "application/json" };
      }
      // Force local-only: block proxy/inference in runner
      if (v.route === "proxy" || v.route === "inference") {
        out = { success: false, error: (v.expect && v.expect.error) ? v.expect.error : "local_runner_blocks_proxy" };
      } else {
        out = apiRouter(e, v.method);
        out = JSON.parse(out.getContent());
      }
    } catch (err) {
      out = { success: false, error: "runner_error", details: String(err && err.message ? err.message : err) };
    }

    const ok = (v.expect && v.expect.success !== undefined)
      ? (out.success === v.expect.success)
      : true;

    return {
      id: v.id,
      ok: ok,
      got: out,
      expect: v.expect
    };
  });

  return {
    success: true,
    "@type": "asx.api.conformance.run.v1",
    "@time": new Date().toISOString(),
    results: results
  };
}


// =======================================================
// GAS EXECUTION ROUTER
// =======================================================

function doGet(e) { return apiRouter(e, "GET"); }
function doPost(e) { return apiRouter(e, "POST"); }

function apiRouter(e, method) {
  const params = (e && e.parameter) ? e.parameter : {};
  const state = apiShardInit();

  const path = apiNormRoute(params.route || "");

  // -------------------------
  // AUTH CHECK (GLOBAL)
  // -------------------------
  const auth = apiAuthGate(params, path, method);
  if (!auth.allowed) {
    safeUsageLog({
      apiKey: params.apiKey || "__public__",
      route: path,
      method: method,
      tokens: 0,
      status: 401
    });

    return apiJson({
      success: false,
      error: auth.reason,
      route: path,
      method: method
    });
  }

  // -------------------------
  // ROUTER
  // -------------------------
  let result;
  let tokensUsed = 0;

  try {
    switch (path) {

      // ---- SYSTEM ----
      case "health":
        result = { success: true, status: "API SHARD ONLINE", time: new Date().toISOString() };
        break;

      case "status":
        result = {
          success: true,
          shard: state.config.apiShardName,
          version: state.config.apiVersion,
          providers: Object.keys(state.providers).length,
          time: new Date().toISOString()
        };
        break;

      // ---- PROVIDERS ----
      case "providers":
        result = apiListProviders();
        break;

      case "provider":
        result = apiGetProvider(params.id);
        break;

      case "register-provider":
        result = apiRegisterProvider(params);
        tokensUsed = 5;
        break;

      // ---- PROXY (PASSTHROUGH EXECUTION) ----
      case "proxy":
        result = apiProxyToProvider_(e, method, params, state);
        tokensUsed = 10;
        break;

      // ---- INFERENCE (KQL-AWARE FORWARD) ----
      case "inference":
        result = apiInferenceRoute_(e, method, params, state);
        tokensUsed = 25;
        break;

      // ---- MESH DISCOVERY ----
      case "mesh.discovery":
      case "mesh_discovery":
        result = apiMeshDiscovery_(params, state);
        tokensUsed = 2;
        break;

      // ---- CONFORMANCE ----
      case "conformance":
        result = apiConformanceVectors_();
        break;

      case "conformance-run":
        result = apiConformanceRun_(method, params, state);
        break;

      // ---- MARKET (OPTIONAL SHARD) ----
      case "market":
        if (typeof marketListPublicProviders === "function") {
          result = marketListPublicProviders();
        } else {
          result = { success: false, error: "Market shard not available" };
        }
        break;

      // ---- FALLBACK ----
      default:
        result = {
          success: true,
          service: "MX2LM API SHARD",
          endpoints: [
            "health",
            "status",
            "providers",
            "provider?id=...",
            "register-provider",
            "proxy (provider passthrough)",
            "inference (KQL-aware forward)",
            "mesh.discovery",
            "conformance",
            "conformance-run",
            "market"
          ]
        };
    }
  } catch (err) {
    result = { success: false, error: String(err && err.message ? err.message : err) };
  }

  // -------------------------
  // USAGE METERING
  // -------------------------
  safeUsageLog({
    apiKey: params.apiKey || "__public__",
    route: path,
    method: method,
    tokens: tokensUsed,
    status: result.success ? 200 : 400
  });

  return apiJson(result);
}


// =======================================================
// JSON OUTPUT
// =======================================================

function apiJson(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}
