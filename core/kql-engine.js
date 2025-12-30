/**
 * KQL v1.0 - K'UHUL Query Language
 * =================================
 * The canonical query dialect for ASX-R
 * Equivalent to Supabase in a traditional stack
 *
 * Provides:
 * - IndexedDB integration (IDB-API)
 * - Glyph-based query syntax
 * - SCXQ2 compression at rest
 * - Deterministic execution
 * - Chat inference delivery
 * - Memory/state management
 *
 * Stack Position:
 * ASX-R
 *  ├─ XJSON (surface form)
 *  ├─ K'UHUL-S v1 (glyph string execution)
 *  ├─ K'UHUL-A v1 (AST execution)
 *  ├─ KQL v1 (query language) ← THIS
 *  └─ SCXQ2 / CC-v1 (compression algebra)
 */

/* ============================================================
   KQL CONFIGURATION
   ============================================================ */

const KQL_CONFIG = {
  version: '1.0',
  dbName: 'kuhul_db',
  dbVersion: 1,

  // Object stores schema
  stores: {
    chats: { keyPath: 'id', indexes: ['userId', 'updated', 'title'] },
    messages: { keyPath: 'id', indexes: ['chatId', 'timestamp', 'role'] },
    models: { keyPath: 'id', indexes: ['provider', 'name'] },
    agents: { keyPath: 'id', indexes: ['type', 'status'] },
    settings: { keyPath: 'key' },
    weights: { keyPath: 'modelId', indexes: ['format', 'compressed'] },
    tensors: { keyPath: 'id', indexes: ['shape', 'dtype'] },
    events: { keyPath: 'id', indexes: ['type', 'timestamp', 'source'] },
    memory: { keyPath: 'key', indexes: ['category', 'confidence', 'accessed'] },
    rlhf: { keyPath: 'id', indexes: ['type', 'rating', 'timestamp'] }
  },

  // Glyph definitions
  glyphs: {
    QUERY: '⟁',      // Query delimiter
    SELECT: '⌘',     // Select operation
    INSERT: '⊕',     // Insert operation
    UPDATE: '⊛',     // Update operation
    DELETE: '⊖',     // Delete operation
    WHERE: '⊜',      // Where clause
    AND: '∧',        // Logical AND
    OR: '∨',         // Logical OR
    COMPRESS: '☣',   // SCXQ2 compression
    STREAM: '⟿',     // Streaming result
    BATCH: '⧫',      // Batch operation
    TX: '⊡'          // Transaction
  }
};

/* ============================================================
   KQL LEXER - Tokenize glyph-based queries
   ============================================================ */

class KQLLexer {
  constructor(input) {
    this.input = input;
    this.pos = 0;
    this.tokens = [];
  }

  tokenize() {
    while (this.pos < this.input.length) {
      this.skipWhitespace();
      if (this.pos >= this.input.length) break;

      const char = this.input[this.pos];

      // Check for glyphs
      if (this.isGlyph(char)) {
        this.tokens.push(this.readGlyph());
      }
      // Check for strings
      else if (char === '"' || char === "'") {
        this.tokens.push(this.readString());
      }
      // Check for numbers
      else if (this.isDigit(char) || (char === '-' && this.isDigit(this.peek(1)))) {
        this.tokens.push(this.readNumber());
      }
      // Check for identifiers
      else if (this.isAlpha(char) || char === '_') {
        this.tokens.push(this.readIdentifier());
      }
      // Operators and punctuation
      else {
        this.tokens.push(this.readOperator());
      }
    }

    return this.tokens;
  }

  isGlyph(char) {
    return Object.values(KQL_CONFIG.glyphs).includes(char);
  }

  readGlyph() {
    const char = this.input[this.pos++];
    const type = Object.entries(KQL_CONFIG.glyphs)
      .find(([_, v]) => v === char)?.[0] || 'UNKNOWN';
    return { type: 'GLYPH', value: char, glyphType: type, pos: this.pos - 1 };
  }

  readString() {
    const quote = this.input[this.pos++];
    let value = '';
    while (this.pos < this.input.length && this.input[this.pos] !== quote) {
      if (this.input[this.pos] === '\\') {
        this.pos++;
        value += this.input[this.pos++];
      } else {
        value += this.input[this.pos++];
      }
    }
    this.pos++; // Skip closing quote
    return { type: 'STRING', value, pos: this.pos };
  }

  readNumber() {
    let value = '';
    if (this.input[this.pos] === '-') value += this.input[this.pos++];
    while (this.pos < this.input.length && (this.isDigit(this.input[this.pos]) || this.input[this.pos] === '.')) {
      value += this.input[this.pos++];
    }
    return { type: 'NUMBER', value: parseFloat(value), pos: this.pos };
  }

  readIdentifier() {
    let value = '';
    while (this.pos < this.input.length && (this.isAlphaNum(this.input[this.pos]) || this.input[this.pos] === '_')) {
      value += this.input[this.pos++];
    }

    // Check for keywords
    const keywords = ['FROM', 'WHERE', 'ORDER', 'BY', 'LIMIT', 'OFFSET', 'ASC', 'DESC', 'IN', 'LIKE', 'NULL', 'TRUE', 'FALSE'];
    const type = keywords.includes(value.toUpperCase()) ? 'KEYWORD' : 'IDENTIFIER';
    return { type, value, pos: this.pos };
  }

  readOperator() {
    const ops = ['>=', '<=', '!=', '==', '=', '>', '<', ',', '(', ')', '[', ']', '{', '}', ':', '.'];
    for (const op of ops) {
      if (this.input.slice(this.pos, this.pos + op.length) === op) {
        this.pos += op.length;
        return { type: 'OPERATOR', value: op, pos: this.pos };
      }
    }
    return { type: 'UNKNOWN', value: this.input[this.pos++], pos: this.pos };
  }

  skipWhitespace() {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++;
    }
  }

  peek(offset = 0) {
    return this.input[this.pos + offset];
  }

  isDigit(char) { return /[0-9]/.test(char); }
  isAlpha(char) { return /[a-zA-Z]/.test(char); }
  isAlphaNum(char) { return /[a-zA-Z0-9]/.test(char); }
}

/* ============================================================
   KQL PARSER - Build AST from tokens
   ============================================================ */

class KQLParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  parse() {
    const statements = [];
    while (this.pos < this.tokens.length) {
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
    }
    return { type: 'Program', statements, loc: { start: 0, end: this.pos } };
  }

  parseStatement() {
    const token = this.current();
    if (!token) return null;

    if (token.type === 'GLYPH') {
      switch (token.glyphType) {
        case 'SELECT': return this.parseSelect();
        case 'INSERT': return this.parseInsert();
        case 'UPDATE': return this.parseUpdate();
        case 'DELETE': return this.parseDelete();
        case 'TX': return this.parseTransaction();
        case 'BATCH': return this.parseBatch();
        default: this.advance();
      }
    } else {
      this.advance();
    }

    return null;
  }

  parseSelect() {
    this.advance(); // Skip ⌘

    const node = {
      type: 'SelectStatement',
      store: null,
      fields: [],
      where: null,
      orderBy: null,
      limit: null,
      offset: null,
      compress: false
    };

    // Parse fields or *
    node.fields = this.parseFieldList();

    // FROM store
    if (this.matchKeyword('FROM')) {
      this.advance();
      node.store = this.expect('IDENTIFIER').value;
    }

    // WHERE clause
    if (this.matchKeyword('WHERE') || this.matchGlyph('WHERE')) {
      this.advance();
      node.where = this.parseExpression();
    }

    // ORDER BY
    if (this.matchKeyword('ORDER')) {
      this.advance();
      this.expectKeyword('BY');
      node.orderBy = this.parseOrderBy();
    }

    // LIMIT
    if (this.matchKeyword('LIMIT')) {
      this.advance();
      node.limit = this.expect('NUMBER').value;
    }

    // OFFSET
    if (this.matchKeyword('OFFSET')) {
      this.advance();
      node.offset = this.expect('NUMBER').value;
    }

    // Compression flag
    if (this.matchGlyph('COMPRESS')) {
      this.advance();
      node.compress = true;
    }

    return node;
  }

  parseInsert() {
    this.advance(); // Skip ⊕

    const node = {
      type: 'InsertStatement',
      store: null,
      data: null,
      compress: false
    };

    // Store name
    node.store = this.expect('IDENTIFIER').value;

    // Data object or array
    node.data = this.parseValue();

    // Compression flag
    if (this.matchGlyph('COMPRESS')) {
      this.advance();
      node.compress = true;
    }

    return node;
  }

  parseUpdate() {
    this.advance(); // Skip ⊛

    const node = {
      type: 'UpdateStatement',
      store: null,
      key: null,
      data: null,
      where: null
    };

    node.store = this.expect('IDENTIFIER').value;

    // Key or WHERE
    if (this.matchKeyword('WHERE') || this.matchGlyph('WHERE')) {
      this.advance();
      node.where = this.parseExpression();
    } else {
      node.key = this.parseValue();
    }

    // Update data
    node.data = this.parseValue();

    return node;
  }

  parseDelete() {
    this.advance(); // Skip ⊖

    const node = {
      type: 'DeleteStatement',
      store: null,
      key: null,
      where: null
    };

    node.store = this.expect('IDENTIFIER').value;

    if (this.matchKeyword('WHERE') || this.matchGlyph('WHERE')) {
      this.advance();
      node.where = this.parseExpression();
    } else if (this.pos < this.tokens.length) {
      node.key = this.parseValue();
    }

    return node;
  }

  parseTransaction() {
    this.advance(); // Skip ⊡
    const statements = [];

    while (this.pos < this.tokens.length && !this.matchGlyph('TX')) {
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
    }

    if (this.matchGlyph('TX')) this.advance();

    return { type: 'Transaction', statements };
  }

  parseBatch() {
    this.advance(); // Skip ⧫
    const operations = [];

    while (this.pos < this.tokens.length && !this.matchGlyph('BATCH')) {
      const stmt = this.parseStatement();
      if (stmt) operations.push(stmt);
    }

    if (this.matchGlyph('BATCH')) this.advance();

    return { type: 'BatchOperation', operations };
  }

  parseFieldList() {
    const fields = [];
    if (this.match('OPERATOR', '*')) {
      this.advance();
      return ['*'];
    }

    do {
      if (this.match('OPERATOR', ',')) this.advance();
      if (this.current()?.type === 'IDENTIFIER') {
        fields.push(this.advance().value);
      }
    } while (this.match('OPERATOR', ','));

    return fields.length > 0 ? fields : ['*'];
  }

  parseExpression() {
    let left = this.parseComparison();

    while (this.matchGlyph('AND') || this.matchGlyph('OR') ||
           this.matchKeyword('AND') || this.matchKeyword('OR')) {
      const op = this.advance().value;
      const right = this.parseComparison();
      left = { type: 'BinaryExpression', operator: op, left, right };
    }

    return left;
  }

  parseComparison() {
    const left = this.parseValue();

    if (this.current()?.type === 'OPERATOR' && ['=', '==', '!=', '>', '<', '>=', '<='].includes(this.current().value)) {
      const op = this.advance().value;
      const right = this.parseValue();
      return { type: 'Comparison', operator: op, left, right };
    }

    if (this.matchKeyword('IN')) {
      this.advance();
      const values = this.parseArray();
      return { type: 'InExpression', left, values };
    }

    if (this.matchKeyword('LIKE')) {
      this.advance();
      const pattern = this.parseValue();
      return { type: 'LikeExpression', left, pattern };
    }

    return left;
  }

  parseValue() {
    const token = this.current();
    if (!token) return null;

    if (token.type === 'STRING') {
      return { type: 'Literal', value: this.advance().value };
    }
    if (token.type === 'NUMBER') {
      return { type: 'Literal', value: this.advance().value };
    }
    if (token.type === 'IDENTIFIER') {
      return { type: 'Identifier', name: this.advance().value };
    }
    if (token.type === 'KEYWORD') {
      if (token.value.toUpperCase() === 'TRUE') { this.advance(); return { type: 'Literal', value: true }; }
      if (token.value.toUpperCase() === 'FALSE') { this.advance(); return { type: 'Literal', value: false }; }
      if (token.value.toUpperCase() === 'NULL') { this.advance(); return { type: 'Literal', value: null }; }
    }
    if (this.match('OPERATOR', '{')) {
      return this.parseObject();
    }
    if (this.match('OPERATOR', '[')) {
      return this.parseArray();
    }

    return null;
  }

  parseObject() {
    this.expect('OPERATOR', '{');
    const properties = {};

    while (!this.match('OPERATOR', '}')) {
      const key = this.expect('IDENTIFIER').value;
      this.expect('OPERATOR', ':');
      properties[key] = this.parseValue();
      if (this.match('OPERATOR', ',')) this.advance();
    }

    this.expect('OPERATOR', '}');
    return { type: 'Object', properties };
  }

  parseArray() {
    this.expect('OPERATOR', '[');
    const elements = [];

    while (!this.match('OPERATOR', ']')) {
      elements.push(this.parseValue());
      if (this.match('OPERATOR', ',')) this.advance();
    }

    this.expect('OPERATOR', ']');
    return { type: 'Array', elements };
  }

  parseOrderBy() {
    const orders = [];
    do {
      if (this.match('OPERATOR', ',')) this.advance();
      const field = this.expect('IDENTIFIER').value;
      let direction = 'ASC';
      if (this.matchKeyword('ASC') || this.matchKeyword('DESC')) {
        direction = this.advance().value.toUpperCase();
      }
      orders.push({ field, direction });
    } while (this.match('OPERATOR', ','));
    return orders;
  }

  // Helper methods
  current() { return this.tokens[this.pos]; }
  advance() { return this.tokens[this.pos++]; }
  match(type, value) {
    const t = this.current();
    return t && t.type === type && (value === undefined || t.value === value);
  }
  matchKeyword(kw) { return this.match('KEYWORD', kw) || this.match('KEYWORD', kw.toLowerCase()); }
  matchGlyph(type) { return this.current()?.type === 'GLYPH' && this.current()?.glyphType === type; }
  expect(type, value) {
    if (!this.match(type, value)) {
      throw new KQLError(`Expected ${type}${value ? ` "${value}"` : ''}, got ${this.current()?.type || 'EOF'}`, this.pos);
    }
    return this.advance();
  }
  expectKeyword(kw) {
    if (!this.matchKeyword(kw)) {
      throw new KQLError(`Expected keyword "${kw}"`, this.pos);
    }
    return this.advance();
  }
}

/* ============================================================
   KQL ERROR
   ============================================================ */

class KQLError extends Error {
  constructor(message, pos, code = 'KQL_ERROR') {
    super(message);
    this.name = 'KQLError';
    this.pos = pos;
    this.code = code;
  }
}

/* ============================================================
   IDB-API - IndexedDB Integration
   ============================================================ */

class IDBAPI {
  constructor() {
    this.db = null;
    this.dbName = KQL_CONFIG.dbName;
    this.dbVersion = KQL_CONFIG.dbVersion;
  }

  async open() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(new KQLError('Failed to open database', 0, 'IDB_OPEN_ERROR'));

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        this.createStores(db);
      };
    });
  }

  createStores(db) {
    for (const [name, config] of Object.entries(KQL_CONFIG.stores)) {
      if (!db.objectStoreNames.contains(name)) {
        const store = db.createObjectStore(name, { keyPath: config.keyPath });
        for (const indexName of (config.indexes || [])) {
          store.createIndex(indexName, indexName, { unique: false });
        }
      }
    }
  }

  async transaction(storeNames, mode = 'readonly') {
    await this.open();
    return this.db.transaction(storeNames, mode);
  }

  async get(storeName, key) {
    const tx = await this.transaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new KQLError(`Get failed: ${request.error}`, 0, 'IDB_GET_ERROR'));
    });
  }

  async getAll(storeName, query, count) {
    const tx = await this.transaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.getAll(query, count);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new KQLError(`GetAll failed: ${request.error}`, 0, 'IDB_GETALL_ERROR'));
    });
  }

  async put(storeName, data) {
    const tx = await this.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new KQLError(`Put failed: ${request.error}`, 0, 'IDB_PUT_ERROR'));
    });
  }

  async add(storeName, data) {
    const tx = await this.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.add(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new KQLError(`Add failed: ${request.error}`, 0, 'IDB_ADD_ERROR'));
    });
  }

  async delete(storeName, key) {
    const tx = await this.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(new KQLError(`Delete failed: ${request.error}`, 0, 'IDB_DELETE_ERROR'));
    });
  }

  async query(storeName, indexName, range) {
    const tx = await this.transaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);

    return new Promise((resolve, reject) => {
      const request = index.getAll(range);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new KQLError(`Query failed: ${request.error}`, 0, 'IDB_QUERY_ERROR'));
    });
  }

  async clear(storeName) {
    const tx = await this.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(new KQLError(`Clear failed: ${request.error}`, 0, 'IDB_CLEAR_ERROR'));
    });
  }

  async count(storeName) {
    const tx = await this.transaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new KQLError(`Count failed: ${request.error}`, 0, 'IDB_COUNT_ERROR'));
    });
  }
}

/* ============================================================
   KQL EXECUTOR - Execute AST against IDB
   ============================================================ */

class KQLExecutor {
  constructor(idb, compression) {
    this.idb = idb;
    this.compression = compression;
  }

  async execute(ast) {
    const results = [];

    for (const stmt of ast.statements) {
      const result = await this.executeStatement(stmt);
      results.push(result);
    }

    return results.length === 1 ? results[0] : results;
  }

  async executeStatement(stmt) {
    switch (stmt.type) {
      case 'SelectStatement': return this.executeSelect(stmt);
      case 'InsertStatement': return this.executeInsert(stmt);
      case 'UpdateStatement': return this.executeUpdate(stmt);
      case 'DeleteStatement': return this.executeDelete(stmt);
      case 'Transaction': return this.executeTransaction(stmt);
      case 'BatchOperation': return this.executeBatch(stmt);
      default:
        throw new KQLError(`Unknown statement type: ${stmt.type}`, 0, 'EXEC_ERROR');
    }
  }

  async executeSelect(stmt) {
    let results = await this.idb.getAll(stmt.store);

    // Apply WHERE filter
    if (stmt.where) {
      results = results.filter(item => this.evaluateExpression(stmt.where, item));
    }

    // Apply ORDER BY
    if (stmt.orderBy && stmt.orderBy.length > 0) {
      results.sort((a, b) => {
        for (const order of stmt.orderBy) {
          const aVal = a[order.field];
          const bVal = b[order.field];
          const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          if (cmp !== 0) return order.direction === 'DESC' ? -cmp : cmp;
        }
        return 0;
      });
    }

    // Apply OFFSET
    if (stmt.offset) {
      results = results.slice(stmt.offset);
    }

    // Apply LIMIT
    if (stmt.limit) {
      results = results.slice(0, stmt.limit);
    }

    // Apply field projection
    if (stmt.fields && stmt.fields[0] !== '*') {
      results = results.map(item => {
        const projected = {};
        for (const field of stmt.fields) {
          projected[field] = item[field];
        }
        return projected;
      });
    }

    // Decompress if needed
    if (stmt.compress) {
      results = results.map(item => this.compression.decompress(item));
    }

    return results;
  }

  async executeInsert(stmt) {
    let data = this.evaluateValue(stmt.data);

    // Compress if requested
    if (stmt.compress && this.compression) {
      data = this.compression.compress(data);
    }

    // Handle array of items
    if (Array.isArray(data)) {
      const keys = [];
      for (const item of data) {
        const key = await this.idb.put(stmt.store, item);
        keys.push(key);
      }
      return { inserted: keys.length, keys };
    }

    const key = await this.idb.put(stmt.store, data);
    return { inserted: 1, key };
  }

  async executeUpdate(stmt) {
    if (stmt.key) {
      const key = this.evaluateValue(stmt.key);
      const existing = await this.idb.get(stmt.store, key);
      const updates = this.evaluateValue(stmt.data);
      const updated = { ...existing, ...updates };
      await this.idb.put(stmt.store, updated);
      return { updated: 1 };
    }

    if (stmt.where) {
      let items = await this.idb.getAll(stmt.store);
      items = items.filter(item => this.evaluateExpression(stmt.where, item));
      const updates = this.evaluateValue(stmt.data);

      for (const item of items) {
        const updated = { ...item, ...updates };
        await this.idb.put(stmt.store, updated);
      }

      return { updated: items.length };
    }

    return { updated: 0 };
  }

  async executeDelete(stmt) {
    if (stmt.key) {
      const key = this.evaluateValue(stmt.key);
      await this.idb.delete(stmt.store, key);
      return { deleted: 1 };
    }

    if (stmt.where) {
      let items = await this.idb.getAll(stmt.store);
      items = items.filter(item => this.evaluateExpression(stmt.where, item));

      for (const item of items) {
        await this.idb.delete(stmt.store, item[KQL_CONFIG.stores[stmt.store]?.keyPath || 'id']);
      }

      return { deleted: items.length };
    }

    // Delete all
    await this.idb.clear(stmt.store);
    return { deleted: 'all' };
  }

  async executeTransaction(stmt) {
    const results = [];
    // Execute all statements atomically
    for (const s of stmt.statements) {
      results.push(await this.executeStatement(s));
    }
    return { transaction: true, results };
  }

  async executeBatch(stmt) {
    const results = await Promise.all(
      stmt.operations.map(op => this.executeStatement(op))
    );
    return { batch: true, results };
  }

  evaluateExpression(expr, context) {
    if (!expr) return true;

    switch (expr.type) {
      case 'BinaryExpression': {
        const left = this.evaluateExpression(expr.left, context);
        const right = this.evaluateExpression(expr.right, context);
        if (expr.operator === '∧' || expr.operator.toUpperCase() === 'AND') return left && right;
        if (expr.operator === '∨' || expr.operator.toUpperCase() === 'OR') return left || right;
        return false;
      }

      case 'Comparison': {
        const left = this.evaluateValue(expr.left, context);
        const right = this.evaluateValue(expr.right, context);
        switch (expr.operator) {
          case '=':
          case '==': return left === right;
          case '!=': return left !== right;
          case '>': return left > right;
          case '<': return left < right;
          case '>=': return left >= right;
          case '<=': return left <= right;
        }
        return false;
      }

      case 'InExpression': {
        const left = this.evaluateValue(expr.left, context);
        const values = expr.values.elements.map(e => this.evaluateValue(e, context));
        return values.includes(left);
      }

      case 'LikeExpression': {
        const left = this.evaluateValue(expr.left, context);
        const pattern = this.evaluateValue(expr.pattern, context);
        const regex = new RegExp(pattern.replace(/%/g, '.*').replace(/_/g, '.'), 'i');
        return regex.test(left);
      }

      default:
        return this.evaluateValue(expr, context);
    }
  }

  evaluateValue(node, context = {}) {
    if (!node) return null;

    switch (node.type) {
      case 'Literal': return node.value;
      case 'Identifier': return context[node.name] ?? node.name;
      case 'Object': {
        const obj = {};
        for (const [key, val] of Object.entries(node.properties)) {
          obj[key] = this.evaluateValue(val, context);
        }
        return obj;
      }
      case 'Array':
        return node.elements.map(e => this.evaluateValue(e, context));
      default:
        return node;
    }
  }
}

/* ============================================================
   KQL COMPRESSION - SCXQ2 Integration
   ============================================================ */

const KQLCompression = {
  // Compress data for storage
  compress(data) {
    const json = JSON.stringify(data);
    // Apply SCXQ2 glyph compression
    const compressed = json
      .replace(/\{"type":/g, '☣T:')
      .replace(/,"value":/g, ',☣V:')
      .replace(/,"id":/g, ',☣I:')
      .replace(/,"timestamp":/g, ',☣S:')
      .replace(/,"content":/g, ',☣C:')
      .replace(/"role":"user"/g, '☣RU')
      .replace(/"role":"assistant"/g, '☣RA')
      .replace(/"role":"system"/g, '☣RS');

    return {
      _compressed: true,
      _format: 'scxq2',
      _original_size: json.length,
      _data: compressed
    };
  },

  // Decompress data from storage
  decompress(data) {
    if (!data?._compressed) return data;

    let json = data._data
      .replace(/☣T:/g, '{"type":')
      .replace(/,☣V:/g, ',"value":')
      .replace(/,☣I:/g, ',"id":')
      .replace(/,☣S:/g, ',"timestamp":')
      .replace(/,☣C:/g, ',"content":')
      .replace(/☣RU/g, '"role":"user"')
      .replace(/☣RA/g, '"role":"assistant"')
      .replace(/☣RS/g, '"role":"system"');

    return JSON.parse(json);
  },

  // Get compression ratio
  ratio(original, compressed) {
    return original / compressed._data.length;
  }
};

/* ============================================================
   KQL MAIN ENGINE
   ============================================================ */

const KQL = {
  idb: new IDBAPI(),
  executor: null,
  initialized: false,

  // Initialize KQL
  async init() {
    if (this.initialized) return;
    await this.idb.open();
    this.executor = new KQLExecutor(this.idb, KQLCompression);
    this.initialized = true;
    console.log('KQL v1.0 initialized');
    return this;
  },

  // Parse a KQL query string
  parse(query) {
    const lexer = new KQLLexer(query);
    const tokens = lexer.tokenize();
    const parser = new KQLParser(tokens);
    return parser.parse();
  },

  // Execute a KQL query string
  async query(queryString) {
    await this.init();
    const ast = this.parse(queryString);
    return this.executor.execute(ast);
  },

  // Shorthand methods for common operations

  // Select from store
  async select(store, options = {}) {
    await this.init();
    let results = await this.idb.getAll(store);

    if (options.where) {
      results = results.filter(item => {
        for (const [key, value] of Object.entries(options.where)) {
          if (item[key] !== value) return false;
        }
        return true;
      });
    }

    if (options.orderBy) {
      const [field, dir] = options.orderBy.split(' ');
      results.sort((a, b) => {
        const cmp = a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0;
        return dir?.toUpperCase() === 'DESC' ? -cmp : cmp;
      });
    }

    if (options.offset) results = results.slice(options.offset);
    if (options.limit) results = results.slice(0, options.limit);

    return results;
  },

  // Insert into store
  async insert(store, data, compress = false) {
    await this.init();
    const toInsert = compress ? KQLCompression.compress(data) : data;
    return this.idb.put(store, toInsert);
  },

  // Update in store
  async update(store, key, updates) {
    await this.init();
    const existing = await this.idb.get(store, key);
    if (!existing) throw new KQLError(`Not found: ${key}`, 0, 'NOT_FOUND');
    const updated = { ...existing, ...updates };
    return this.idb.put(store, updated);
  },

  // Delete from store
  async delete(store, key) {
    await this.init();
    return this.idb.delete(store, key);
  },

  // Get by key
  async get(store, key) {
    await this.init();
    const result = await this.idb.get(store, key);
    if (result?._compressed) return KQLCompression.decompress(result);
    return result;
  },

  // Count items
  async count(store) {
    await this.init();
    return this.idb.count(store);
  },

  // Clear store
  async clear(store) {
    await this.init();
    return this.idb.clear(store);
  },

  // ============================================================
  // CHAT-SPECIFIC METHODS (Inference Delivery)
  // ============================================================

  // Save chat
  async saveChat(chat) {
    return this.insert('chats', {
      ...chat,
      updated: Date.now()
    });
  },

  // Get all chats for user
  async getChats(userId, limit = 50) {
    return this.select('chats', {
      where: userId ? { userId } : undefined,
      orderBy: 'updated DESC',
      limit
    });
  },

  // Save message
  async saveMessage(message) {
    return this.insert('messages', {
      ...message,
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: message.timestamp || Date.now()
    });
  },

  // Get messages for chat
  async getMessages(chatId, limit = 100) {
    return this.select('messages', {
      where: { chatId },
      orderBy: 'timestamp ASC',
      limit
    });
  },

  // Save model
  async saveModel(model) {
    return this.insert('models', model);
  },

  // Get all models
  async getModels() {
    return this.select('models');
  },

  // Save setting
  async setSetting(key, value) {
    return this.insert('settings', { key, value, updated: Date.now() });
  },

  // Get setting
  async getSetting(key) {
    const result = await this.get('settings', key);
    return result?.value;
  },

  // ============================================================
  // MEMORY METHODS
  // ============================================================

  // Store memory
  async remember(key, value, category = 'general', confidence = 1.0) {
    return this.insert('memory', {
      key,
      value,
      category,
      confidence,
      accessed: Date.now(),
      created: Date.now()
    });
  },

  // Recall memory
  async recall(key) {
    const memory = await this.get('memory', key);
    if (memory) {
      // Update access time
      await this.update('memory', key, { accessed: Date.now() });
    }
    return memory?.value;
  },

  // Query memories by category
  async recallByCategory(category, limit = 10) {
    return this.select('memory', {
      where: { category },
      orderBy: 'confidence DESC',
      limit
    });
  },

  // ============================================================
  // EVENT LOGGING
  // ============================================================

  // Log event
  async logEvent(type, data, source = 'system') {
    return this.insert('events', {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type,
      data,
      source,
      timestamp: Date.now()
    });
  },

  // Get events
  async getEvents(type, limit = 100) {
    return this.select('events', {
      where: type ? { type } : undefined,
      orderBy: 'timestamp DESC',
      limit
    });
  },

  // ============================================================
  // RLHF DATA
  // ============================================================

  // Store RLHF feedback
  async storeRLHF(type, data, rating) {
    return this.insert('rlhf', {
      id: `rlhf_${Date.now()}`,
      type,
      data,
      rating,
      timestamp: Date.now()
    });
  },

  // Get RLHF data
  async getRLHF(type, minRating = 0) {
    const all = await this.select('rlhf', { where: type ? { type } : undefined });
    return all.filter(r => r.rating >= minRating);
  }
};

/* ============================================================
   EXPORTS
   ============================================================ */

if (typeof window !== 'undefined') {
  window.KQL = KQL;
  window.KQLLexer = KQLLexer;
  window.KQLParser = KQLParser;
  window.KQLExecutor = KQLExecutor;
  window.KQLCompression = KQLCompression;
  window.KQLError = KQLError;
  window.IDBAPI = IDBAPI;
  window.KQL_CONFIG = KQL_CONFIG;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    KQL,
    KQLLexer,
    KQLParser,
    KQLExecutor,
    KQLCompression,
    KQLError,
    IDBAPI,
    KQL_CONFIG
  };
}

console.log('KQL v1.0 - K\'UHUL Query Language - LOADED');
console.log('Stack: ASX-R → XJSON → K\'UHUL → KQL → SCXQ2');
console.log('Stores:', Object.keys(KQL_CONFIG.stores).join(', '));
