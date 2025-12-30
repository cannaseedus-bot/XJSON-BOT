// =======================================================
// auth.gs — GLOBAL MULTI-APP AUTH SHARD
// Artifact: AUTH_IDB_KQL_SHEETS_GLOBAL_v5
// Status: FROZEN / CANONICAL
// Scope: ALL APPS, ALL USERS
// Authority: Auth + Automation ONLY
// Runtime Authority: Client IndexedDB + KQL
// Brand: ASX
// =======================================================


// =======================================================
// GLOBAL CONFIG
// =======================================================

var AUTH_CONFIG = {
  shardName: 'ASX_GAS_AUTH_SHARD',
  version: '5.0.0',

  // Google OAuth Web Client ID
  googleClientId: '1007325672364-cha9ad0b520arhfo6vsnsjk8pa5jbabk.apps.googleusercontent.com',

  props: {
    securolinkSecret: 'SECUROLINK_HMAC_SECRET',
    userSheetsMap: 'USER_SHEETS_MAP',
    apiKeys: 'AUTH_API_KEYS'
  }
};


// =======================================================
// UTILITIES
// =======================================================

function nowIso() {
  return new Date().toISOString();
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function requireProp(key) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('Missing ScriptProperty: ' + key);
  return v;
}

function getScriptMap(propKey) {
  return JSON.parse(
    PropertiesService.getScriptProperties().getProperty(propKey) || '{}'
  );
}

function setScriptMap(propKey, obj) {
  PropertiesService.getScriptProperties().setProperty(
    propKey,
    JSON.stringify(obj)
  );
}


// =======================================================
// GOOGLE ID TOKEN VERIFICATION
// =======================================================

function verifyGoogleIdToken(idToken) {
  if (!idToken) return null;

  var url =
    'https://oauth2.googleapis.com/tokeninfo?id_token=' +
    encodeURIComponent(idToken);

  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;

  var d = JSON.parse(res.getContentText() || '{}');
  if (d.aud !== AUTH_CONFIG.googleClientId) return null;

  return {
    sub: d.sub,
    email: d.email,
    email_verified: d.email_verified === true || d.email_verified === 'true',
    name: d.name || '',
    picture: d.picture || ''
  };
}


// =======================================================
// SECUROLINK TOKEN (HMAC)
// =======================================================

function generateSecurolinkToken(user) {
  var secret = requireProp(AUTH_CONFIG.props.securolinkSecret);

  var payload = {
    sub: user.sub,
    email: user.email,
    iat: Date.now()
  };

  var json = JSON.stringify(payload);
  var sig = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(json, secret)
  );

  return Utilities.base64EncodeWebSafe(json) + '.' + sig;
}


// =======================================================
// API KEY (GLOBAL, USER-SCOPED)
// =======================================================

function getOrCreateApiKey(email) {
  var keys = getScriptMap(AUTH_CONFIG.props.apiKeys);

  for (var k in keys) {
    if (keys[k].owner === email && keys[k].active) {
      keys[k].lastUsed = nowIso();
      setScriptMap(AUTH_CONFIG.props.apiKeys, keys);
      return keys[k];
    }
  }

  var key = 'key_' + Utilities.getUuid().replace(/-/g, '');
  keys[key] = {
    key: key,
    owner: email,
    active: true,
    scopes: ['*'],
    created: nowIso(),
    lastUsed: nowIso()
  };

  setScriptMap(AUTH_CONFIG.props.apiKeys, keys);
  return keys[key];
}


// =======================================================
// PER-USER SPREADSHEET (GLOBAL, MULTI-APP)
// =======================================================

function getUserSpreadsheet(externalId) {
  var map = getScriptMap(AUTH_CONFIG.props.userSheetsMap);

  if (map[externalId]) {
    return SpreadsheetApp.openById(map[externalId]);
  }

  var ss = SpreadsheetApp.create('ASX_USER_' + externalId);
  map[externalId] = ss.getId();
  setScriptMap(AUTH_CONFIG.props.userSheetsMap, map);

  var sheets = [
    ['users',   ['external_id','email','verified','name','picture','last_login']],
    ['sessions',['securoToken','external_id','issued_at']],
    ['api_keys',['key','owner','active','created','lastUsed']],
    ['apps',    ['app_id','first_seen','last_seen']],
    ['events',  ['event_id','app_id','type','timestamp','payload']],
    ['rlhf',    ['id','app_id','model','score','timestamp','meta']]
  ];

  ss.getSheets()[0].setName(sheets[0][0]);

  sheets.forEach(function(def, i) {
    var sh = i === 0 ? ss.getSheets()[0] : ss.insertSheet(def[0]);
    sh.clear();
    sh.appendRow(def[1]);
  });

  return ss;
}


// =======================================================
// WRITE OPERATIONS (AUTO)
// =======================================================

function writeUser(ss, user) {
  ss.getSheetByName('users').appendRow([
    user.sub,
    user.email,
    user.email_verified,
    user.name,
    user.picture,
    nowIso()
  ]);
}

function writeSession(ss, user, token) {
  ss.getSheetByName('sessions').appendRow([
    token,
    user.sub,
    nowIso()
  ]);
}

function writeApiKey(ss, keyRec) {
  ss.getSheetByName('api_keys').appendRow([
    keyRec.key,
    keyRec.owner,
    keyRec.active,
    keyRec.created,
    keyRec.lastUsed
  ]);
}

function writeAppUsage(ss, appId) {
  ss.getSheetByName('apps').appendRow([
    appId,
    nowIso(),
    nowIso()
  ]);
}


// =======================================================
// db.json GENERATOR (GLOBAL SNAPSHOT)
// =======================================================

function generateDbJson(ss) {
  function readSheet(name) {
    var sh = ss.getSheetByName(name);
    var v = sh.getDataRange().getValues();
    if (v.length < 2) return [];
    var h = v.shift();
    return v.map(function(r) {
      var o = {};
      h.forEach(function(k, i) { o[k] = r[i]; });
      return o;
    });
  }

  return {
    "@schema": "asx://db/db.json.v1",
    "@authority": "ASX-R",
    "@generated_by": AUTH_CONFIG.shardName,
    "@exported": nowIso(),
    "users": readSheet('users'),
    "sessions": readSheet('sessions'),
    "api_keys": readSheet('api_keys'),
    "apps": readSheet('apps'),
    "events": readSheet('events'),
    "rlhf": readSheet('rlhf')
  };
}


// =======================================================
// LOGIN — GLOBAL, MULTI-APP, AUTO-FIRE
// =======================================================

function handleSecuroLogin(p) {
  var appId = p.app_id || 'global';
  var user = verifyGoogleIdToken(p.idToken || p.credential);
  if (!user) return { ok: false, error: 'Invalid Google token' };

  var securoToken = generateSecurolinkToken(user);
  var apiKey = getOrCreateApiKey(user.email);
  var ss = getUserSpreadsheet(user.sub);

  writeUser(ss, user);
  writeSession(ss, user, securoToken);
  writeApiKey(ss, apiKey);
  writeAppUsage(ss, appId);

  return {
    ok: true,
    app_id: appId,
    identity: {
      external_id: user.sub,
      email: user.email,
      verified: user.email_verified,
      name: user.name,
      picture: user.picture
    },
    securoToken: securoToken,
    apiKey: apiKey.key,
    db_json: generateDbJson(ss),
    persistence: {
      server: "google_sheets",
      client: "indexeddb"
    },
    query: {
      language: "kql.v1",
      authority: "client"
    }
  };
}


// =======================================================
// WEB APP ROUTER
// =======================================================

function doPost(e) {
  var p = {};
  if (e.postData && e.postData.contents) {
    try { p = JSON.parse(e.postData.contents); } catch (_) {}
  }

  if (p.action === 'securoLogin') {
    return jsonResponse(handleSecuroLogin(p));
  }

  return jsonResponse({ ok: false, error: 'Unknown action' });
}

function doGet() {
  return jsonResponse({
    ok: true,
    shard: AUTH_CONFIG.shardName,
    version: AUTH_CONFIG.version,
    time: nowIso()
  });
}
