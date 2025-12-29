/**
 * KQL MySQL Backend - Remote Database Integration
 * ================================================
 * Extends KQL to support MySQL as an optional backend
 * Similar to how Supabase wraps PostgreSQL
 *
 * Features:
 * - MySQL REST API integration
 * - Query translation (KQL → MySQL)
 * - Seamless backend switching
 * - Connection pooling via API
 * - Transaction support
 *
 * Backend Options:
 * 1. IndexedDB (local, default)
 * 2. MySQL via REST API
 * 3. Hybrid (IDB cache + MySQL sync)
 */

/* ============================================================
   MYSQL CONFIGURATION
   ============================================================ */

const MYSQL_CONFIG = {
  // Default API endpoint (configurable in settings)
  defaultEndpoint: 'http://localhost:3001/api/kql',

  // Table mapping (KQL stores → MySQL tables)
  tableMap: {
    chats: 'kql_chats',
    messages: 'kql_messages',
    models: 'kql_models',
    agents: 'kql_agents',
    settings: 'kql_settings',
    weights: 'kql_weights',
    tensors: 'kql_tensors',
    events: 'kql_events',
    memory: 'kql_memory',
    rlhf: 'kql_rlhf'
  },

  // Column type mapping
  typeMap: {
    string: 'VARCHAR(255)',
    text: 'TEXT',
    longtext: 'LONGTEXT',
    int: 'INT',
    bigint: 'BIGINT',
    float: 'FLOAT',
    double: 'DOUBLE',
    boolean: 'TINYINT(1)',
    json: 'JSON',
    timestamp: 'BIGINT',
    blob: 'LONGBLOB'
  }
};

/* ============================================================
   MYSQL QUERY TRANSLATOR
   ============================================================ */

class KQLtoMySQL {
  constructor() {
    this.glyphToSQL = {
      '⌘': 'SELECT',   // Select
      '⊕': 'INSERT',   // Insert
      '⊛': 'UPDATE',   // Update
      '⊖': 'DELETE',   // Delete
      '⊜': 'WHERE',    // Where
      '∧': 'AND',      // And
      '∨': 'OR',       // Or
      '☣': null,       // Compression (handled separately)
      '⊡': null        // Transaction (handled separately)
    };
  }

  // Translate KQL AST to MySQL query
  translate(ast) {
    if (ast.type === 'Program') {
      return ast.statements.map(stmt => this.translateStatement(stmt));
    }
    return [this.translateStatement(ast)];
  }

  translateStatement(stmt) {
    switch (stmt.type) {
      case 'SelectStatement': return this.translateSelect(stmt);
      case 'InsertStatement': return this.translateInsert(stmt);
      case 'UpdateStatement': return this.translateUpdate(stmt);
      case 'DeleteStatement': return this.translateDelete(stmt);
      case 'Transaction': return this.translateTransaction(stmt);
      default:
        throw new Error(`Unsupported statement: ${stmt.type}`);
    }
  }

  translateSelect(stmt) {
    const table = MYSQL_CONFIG.tableMap[stmt.store] || stmt.store;
    const fields = stmt.fields[0] === '*' ? '*' : stmt.fields.join(', ');

    let sql = `SELECT ${fields} FROM ${table}`;

    if (stmt.where) {
      sql += ` WHERE ${this.translateExpression(stmt.where)}`;
    }

    if (stmt.orderBy && stmt.orderBy.length > 0) {
      const orders = stmt.orderBy.map(o => `${o.field} ${o.direction}`).join(', ');
      sql += ` ORDER BY ${orders}`;
    }

    if (stmt.limit) {
      sql += ` LIMIT ${stmt.limit}`;
    }

    if (stmt.offset) {
      sql += ` OFFSET ${stmt.offset}`;
    }

    return { sql, type: 'SELECT', table, compress: stmt.compress };
  }

  translateInsert(stmt) {
    const table = MYSQL_CONFIG.tableMap[stmt.store] || stmt.store;
    const data = this.evaluateValue(stmt.data);

    if (Array.isArray(data)) {
      // Batch insert
      const columns = Object.keys(data[0]);
      const values = data.map(row =>
        `(${columns.map(c => this.escapeValue(row[c])).join(', ')})`
      ).join(', ');

      return {
        sql: `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${values} ON DUPLICATE KEY UPDATE ${columns.map(c => `${c}=VALUES(${c})`).join(', ')}`,
        type: 'INSERT',
        table,
        data
      };
    }

    const columns = Object.keys(data);
    const values = columns.map(c => this.escapeValue(data[c]));

    return {
      sql: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON DUPLICATE KEY UPDATE ${columns.map(c => `${c}=VALUES(${c})`).join(', ')}`,
      type: 'INSERT',
      table,
      data
    };
  }

  translateUpdate(stmt) {
    const table = MYSQL_CONFIG.tableMap[stmt.store] || stmt.store;
    const updates = this.evaluateValue(stmt.data);
    const setClause = Object.entries(updates)
      .map(([k, v]) => `${k} = ${this.escapeValue(v)}`)
      .join(', ');

    let sql = `UPDATE ${table} SET ${setClause}`;

    if (stmt.where) {
      sql += ` WHERE ${this.translateExpression(stmt.where)}`;
    } else if (stmt.key) {
      const keyPath = KQL_CONFIG.stores[stmt.store]?.keyPath || 'id';
      const keyValue = this.evaluateValue(stmt.key);
      sql += ` WHERE ${keyPath} = ${this.escapeValue(keyValue)}`;
    }

    return { sql, type: 'UPDATE', table };
  }

  translateDelete(stmt) {
    const table = MYSQL_CONFIG.tableMap[stmt.store] || stmt.store;
    let sql = `DELETE FROM ${table}`;

    if (stmt.where) {
      sql += ` WHERE ${this.translateExpression(stmt.where)}`;
    } else if (stmt.key) {
      const keyPath = KQL_CONFIG.stores[stmt.store]?.keyPath || 'id';
      const keyValue = this.evaluateValue(stmt.key);
      sql += ` WHERE ${keyPath} = ${this.escapeValue(keyValue)}`;
    }

    return { sql, type: 'DELETE', table };
  }

  translateTransaction(stmt) {
    const queries = stmt.statements.map(s => this.translateStatement(s));
    return {
      type: 'TRANSACTION',
      queries
    };
  }

  translateExpression(expr) {
    if (!expr) return '1=1';

    switch (expr.type) {
      case 'BinaryExpression': {
        const left = this.translateExpression(expr.left);
        const right = this.translateExpression(expr.right);
        const op = expr.operator === '∧' ? 'AND' : expr.operator === '∨' ? 'OR' : expr.operator;
        return `(${left} ${op} ${right})`;
      }

      case 'Comparison': {
        const left = this.translateValue(expr.left);
        const right = this.translateValue(expr.right);
        const op = expr.operator === '==' ? '=' : expr.operator;
        return `${left} ${op} ${right}`;
      }

      case 'InExpression': {
        const left = this.translateValue(expr.left);
        const values = expr.values.elements.map(e => this.translateValue(e)).join(', ');
        return `${left} IN (${values})`;
      }

      case 'LikeExpression': {
        const left = this.translateValue(expr.left);
        const pattern = this.translateValue(expr.pattern);
        return `${left} LIKE ${pattern}`;
      }

      default:
        return this.translateValue(expr);
    }
  }

  translateValue(node) {
    if (!node) return 'NULL';

    switch (node.type) {
      case 'Literal':
        return this.escapeValue(node.value);
      case 'Identifier':
        return node.name;
      default:
        return this.escapeValue(this.evaluateValue(node));
    }
  }

  evaluateValue(node) {
    if (!node) return null;

    switch (node.type) {
      case 'Literal': return node.value;
      case 'Identifier': return node.name;
      case 'Object': {
        const obj = {};
        for (const [key, val] of Object.entries(node.properties)) {
          obj[key] = this.evaluateValue(val);
        }
        return obj;
      }
      case 'Array':
        return node.elements.map(e => this.evaluateValue(e));
      default:
        return node;
    }
  }

  escapeValue(value) {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
    return `'${String(value).replace(/'/g, "''")}'`;
  }
}

/* ============================================================
   MYSQL REST API CLIENT
   ============================================================ */

class MySQLClient {
  constructor(config = {}) {
    this.endpoint = config.endpoint || MYSQL_CONFIG.defaultEndpoint;
    this.apiKey = config.apiKey || null;
    this.translator = new KQLtoMySQL();
    this.connected = false;
  }

  // Configure connection
  configure(config) {
    if (config.endpoint) this.endpoint = config.endpoint;
    if (config.apiKey) this.apiKey = config.apiKey;
    if (config.host) {
      // Build endpoint from individual params
      this.endpoint = `http://${config.host}:${config.port || 3001}/api/kql`;
    }
  }

  // Test connection
  async testConnection() {
    try {
      const response = await this.request('POST', '/ping', {});
      this.connected = response.ok;
      return { success: response.ok, message: response.ok ? 'Connected' : 'Failed' };
    } catch (error) {
      this.connected = false;
      return { success: false, error: error.message };
    }
  }

  // Execute raw SQL
  async executeSQL(sql, params = []) {
    return this.request('POST', '/query', { sql, params });
  }

  // Execute KQL query (translates to MySQL)
  async executeKQL(kqlQuery) {
    const ast = typeof kqlQuery === 'string'
      ? KQL.parse(kqlQuery)
      : kqlQuery;

    const translations = this.translator.translate(ast);

    const results = [];
    for (const query of translations) {
      if (query.type === 'TRANSACTION') {
        const txResult = await this.executeTransaction(query.queries);
        results.push(txResult);
      } else {
        const result = await this.executeSQL(query.sql);
        results.push(this.processResult(result, query));
      }
    }

    return results.length === 1 ? results[0] : results;
  }

  // Execute transaction
  async executeTransaction(queries) {
    return this.request('POST', '/transaction', {
      queries: queries.map(q => ({ sql: q.sql, type: q.type }))
    });
  }

  // Process result based on query type
  processResult(result, query) {
    if (!result.success) {
      throw new Error(result.error || 'Query failed');
    }

    switch (query.type) {
      case 'SELECT':
        let data = result.data || [];
        // Decompress if needed
        if (query.compress) {
          data = data.map(row => KQLCompression.decompress(row));
        }
        return data;

      case 'INSERT':
        return {
          inserted: result.affectedRows || 1,
          insertId: result.insertId
        };

      case 'UPDATE':
        return { updated: result.affectedRows || 0 };

      case 'DELETE':
        return { deleted: result.affectedRows || 0 };

      default:
        return result;
    }
  }

  // Make HTTP request to API
  async request(method, path, body) {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    try {
      const response = await fetch(`${this.endpoint}${path}`, {
        method,
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        return { success: false, error: error.error || error.message };
      }

      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============================================================
  // SHORTHAND METHODS (mirror KQL interface)
  // ============================================================

  async select(store, options = {}) {
    const table = MYSQL_CONFIG.tableMap[store] || store;
    let sql = `SELECT * FROM ${table}`;

    if (options.where) {
      const conditions = Object.entries(options.where)
        .map(([k, v]) => `${k} = ${this.translator.escapeValue(v)}`)
        .join(' AND ');
      sql += ` WHERE ${conditions}`;
    }

    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
    }

    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
    }

    if (options.offset) {
      sql += ` OFFSET ${options.offset}`;
    }

    const result = await this.executeSQL(sql);
    return result.success ? result.data : [];
  }

  async insert(store, data, compress = false) {
    const table = MYSQL_CONFIG.tableMap[store] || store;
    const toInsert = compress ? KQLCompression.compress(data) : data;

    const columns = Object.keys(toInsert);
    const values = columns.map(c => this.translator.escapeValue(toInsert[c]));

    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON DUPLICATE KEY UPDATE ${columns.map(c => `${c}=VALUES(${c})`).join(', ')}`;

    return this.executeSQL(sql);
  }

  async update(store, key, updates) {
    const table = MYSQL_CONFIG.tableMap[store] || store;
    const keyPath = KQL_CONFIG.stores[store]?.keyPath || 'id';

    const setClause = Object.entries(updates)
      .map(([k, v]) => `${k} = ${this.translator.escapeValue(v)}`)
      .join(', ');

    const sql = `UPDATE ${table} SET ${setClause} WHERE ${keyPath} = ${this.translator.escapeValue(key)}`;

    return this.executeSQL(sql);
  }

  async delete(store, key) {
    const table = MYSQL_CONFIG.tableMap[store] || store;
    const keyPath = KQL_CONFIG.stores[store]?.keyPath || 'id';

    const sql = `DELETE FROM ${table} WHERE ${keyPath} = ${this.translator.escapeValue(key)}`;

    return this.executeSQL(sql);
  }

  async get(store, key) {
    const table = MYSQL_CONFIG.tableMap[store] || store;
    const keyPath = KQL_CONFIG.stores[store]?.keyPath || 'id';

    const sql = `SELECT * FROM ${table} WHERE ${keyPath} = ${this.translator.escapeValue(key)} LIMIT 1`;

    const result = await this.executeSQL(sql);
    return result.success && result.data?.[0] ? result.data[0] : null;
  }
}

/* ============================================================
   HYBRID BACKEND (IDB + MySQL Sync)
   ============================================================ */

class HybridBackend {
  constructor(idb, mysql) {
    this.idb = idb;
    this.mysql = mysql;
    this.syncQueue = [];
    this.syncInterval = null;
    this.online = false;
  }

  // Start sync
  startSync(intervalMs = 30000) {
    this.syncInterval = setInterval(() => this.sync(), intervalMs);
    this.checkOnline();
  }

  // Stop sync
  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Check if MySQL is reachable
  async checkOnline() {
    const result = await this.mysql.testConnection();
    this.online = result.success;
    return this.online;
  }

  // Queue operation for sync
  queueSync(operation) {
    this.syncQueue.push({
      ...operation,
      timestamp: Date.now()
    });
    this.persistQueue();
  }

  // Persist queue to localStorage
  persistQueue() {
    try {
      localStorage.setItem('kql_sync_queue', JSON.stringify(this.syncQueue));
    } catch (e) {
      console.warn('Failed to persist sync queue:', e);
    }
  }

  // Load queue from localStorage
  loadQueue() {
    try {
      const queue = localStorage.getItem('kql_sync_queue');
      this.syncQueue = queue ? JSON.parse(queue) : [];
    } catch (e) {
      this.syncQueue = [];
    }
  }

  // Sync pending operations to MySQL
  async sync() {
    if (!this.online) {
      await this.checkOnline();
      if (!this.online) return { synced: 0, pending: this.syncQueue.length };
    }

    const toSync = [...this.syncQueue];
    let synced = 0;

    for (const op of toSync) {
      try {
        switch (op.type) {
          case 'INSERT':
            await this.mysql.insert(op.store, op.data);
            break;
          case 'UPDATE':
            await this.mysql.update(op.store, op.key, op.data);
            break;
          case 'DELETE':
            await this.mysql.delete(op.store, op.key);
            break;
        }

        // Remove from queue
        const idx = this.syncQueue.findIndex(q => q.timestamp === op.timestamp);
        if (idx > -1) this.syncQueue.splice(idx, 1);
        synced++;
      } catch (e) {
        console.warn('Sync failed for operation:', op, e);
      }
    }

    this.persistQueue();
    return { synced, pending: this.syncQueue.length };
  }

  // Write to both backends (IDB immediate, MySQL queued)
  async write(store, data) {
    // Write to IDB immediately
    await this.idb.put(store, data);

    // Queue for MySQL sync
    this.queueSync({
      type: 'INSERT',
      store,
      data
    });

    // Try immediate sync if online
    if (this.online) {
      this.sync();
    }
  }

  // Read (prefer IDB, fallback to MySQL)
  async read(store, key) {
    // Try IDB first
    let result = await this.idb.get(store, key);

    if (!result && this.online) {
      // Fallback to MySQL
      result = await this.mysql.get(store, key);

      // Cache in IDB
      if (result) {
        await this.idb.put(store, result);
      }
    }

    return result;
  }
}

/* ============================================================
   EXTEND KQL WITH MYSQL SUPPORT
   ============================================================ */

// Add MySQL backend to KQL
if (typeof KQL !== 'undefined') {
  KQL.mysql = new MySQLClient();
  KQL.hybrid = null;
  KQL.backendMode = 'idb'; // 'idb', 'mysql', 'hybrid'

  // Configure MySQL backend
  KQL.configureMySQL = function(config) {
    this.mysql.configure(config);
    return this;
  };

  // Set backend mode
  KQL.setBackend = async function(mode, config = {}) {
    this.backendMode = mode;

    if (mode === 'mysql') {
      if (config.endpoint || config.host) {
        this.configureMySQL(config);
      }
      const test = await this.mysql.testConnection();
      if (!test.success) {
        console.warn('MySQL connection failed, falling back to IDB');
        this.backendMode = 'idb';
      }
    }

    if (mode === 'hybrid') {
      await this.init();
      this.hybrid = new HybridBackend(this.idb, this.mysql);
      this.hybrid.loadQueue();
      this.hybrid.startSync(config.syncInterval || 30000);
    }

    console.log(`KQL backend mode: ${this.backendMode}`);
    return this.backendMode;
  };

  // Override query to route to appropriate backend
  const originalQuery = KQL.query.bind(KQL);
  KQL.query = async function(queryString) {
    if (this.backendMode === 'mysql' && this.mysql.connected) {
      return this.mysql.executeKQL(queryString);
    }
    return originalQuery(queryString);
  };

  // Override select
  const originalSelect = KQL.select.bind(KQL);
  KQL.select = async function(store, options = {}) {
    if (this.backendMode === 'mysql' && this.mysql.connected) {
      return this.mysql.select(store, options);
    }
    if (this.backendMode === 'hybrid') {
      return this.hybrid.read(store, options.where);
    }
    return originalSelect(store, options);
  };

  // Override insert
  const originalInsert = KQL.insert.bind(KQL);
  KQL.insert = async function(store, data, compress = false) {
    if (this.backendMode === 'mysql' && this.mysql.connected) {
      return this.mysql.insert(store, data, compress);
    }
    if (this.backendMode === 'hybrid') {
      return this.hybrid.write(store, data);
    }
    return originalInsert(store, data, compress);
  };

  console.log('KQL MySQL Backend - LOADED');
}

/* ============================================================
   MYSQL API SERVER TEMPLATE (for PHP/Node)
   ============================================================ */

/*
 * This is a template for the REST API server that KQL connects to.
 * Implement this in PHP or Node.js on your MySQL server.
 *
 * Endpoints:
 * POST /api/kql/ping       - Health check
 * POST /api/kql/query      - Execute SQL query
 * POST /api/kql/transaction - Execute transaction
 *
 * Request format:
 * {
 *   "sql": "SELECT * FROM table WHERE id = ?",
 *   "params": [1]
 * }
 *
 * Response format:
 * {
 *   "success": true,
 *   "data": [...],
 *   "affectedRows": 0,
 *   "insertId": null
 * }
 */

const MYSQL_API_TEMPLATE = `
// PHP Example (api/kql/index.php)
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');

$config = [
  'host' => 'localhost',
  'user' => 'root',
  'pass' => '',
  'db'   => 'kuhul_db'
];

$pdo = new PDO(
  "mysql:host={$config['host']};dbname={$config['db']}",
  $config['user'],
  $config['pass']
);

$input = json_decode(file_get_contents('php://input'), true);
$path = $_SERVER['PATH_INFO'] ?? '/query';

switch ($path) {
  case '/ping':
    echo json_encode(['ok' => true]);
    break;

  case '/query':
    try {
      $stmt = $pdo->prepare($input['sql']);
      $stmt->execute($input['params'] ?? []);
      echo json_encode([
        'success' => true,
        'data' => $stmt->fetchAll(PDO::FETCH_ASSOC),
        'affectedRows' => $stmt->rowCount()
      ]);
    } catch (Exception $e) {
      echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    break;

  case '/transaction':
    $pdo->beginTransaction();
    try {
      foreach ($input['queries'] as $q) {
        $pdo->exec($q['sql']);
      }
      $pdo->commit();
      echo json_encode(['success' => true]);
    } catch (Exception $e) {
      $pdo->rollBack();
      echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    break;
}
`;

/* ============================================================
   EXPORTS
   ============================================================ */

if (typeof window !== 'undefined') {
  window.MySQLClient = MySQLClient;
  window.KQLtoMySQL = KQLtoMySQL;
  window.HybridBackend = HybridBackend;
  window.MYSQL_CONFIG = MYSQL_CONFIG;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MySQLClient,
    KQLtoMySQL,
    HybridBackend,
    MYSQL_CONFIG,
    MYSQL_API_TEMPLATE
  };
}

console.log('KQL MySQL Backend v1.0 - LOADED');
console.log('Backend modes: idb (local), mysql (remote), hybrid (sync)');
