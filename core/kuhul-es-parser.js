/**
 * KUHUL-ES Parser v2.1
 * Parses KUHUL-ES source code into canonical AST
 *
 * @version 2.1.0
 * @status frozen
 * @authority @kuhul/es
 *
 * Grammar: KUHUL-ES v2.1 (ECMAScript syntax, KUHUL semantics)
 */

// ============================================================
// Token Types
// ============================================================

const TokenType = {
  // Literals
  Number: 'Number',
  String: 'String',
  Boolean: 'Boolean',
  Null: 'Null',
  RegExp: 'RegExp',

  // Identifiers
  Identifier: 'Identifier',

  // Keywords
  Keyword: 'Keyword',

  // Glyphs
  Glyph: 'Glyph',
  GlyphDelim: 'GlyphDelim',

  // Directives
  Directive: 'Directive',

  // Operators
  Operator: 'Operator',

  // Delimiters
  Punctuator: 'Punctuator',

  // Special
  Template: 'Template',
  EOF: 'EOF'
};

// ============================================================
// Keywords & Operators
// ============================================================

const KEYWORDS = new Set([
  'π', 'τ', 'function', 'λ', 'return', 'yield', 'break', 'continue',
  'true', 'false', 'null', 'undefined', 'new', 'typeof', 'void',
  'import', 'export', 'from', 'as', 'default', 'type', 'interface'
]);

const GLYPH_NAMES = new Set([
  'Pop', 'Wo', 'Sek', "Ch'en", 'Yax', 'Xul',
  'SVG', 'Path', 'Transform'
]);

const DIRECTIVES = new Set([
  '@if', '@else', '@for', '@while', '@match', '@do', '@unless',
  '@system', '@interface', '@glyph',
  '@compressed', '@flow', '@data', '@atomic', '@deterministic', '@replayable',
  '@import', '@export'
]);

const OPERATORS = [
  // Multi-char first (longest match)
  '===', '!==', '>>>', 'π**', 'π+=', 'π-=', 'π*=', 'π/=',
  '==', '!=', '<=', '>=', '&&', '||', '**', '<<', '>>', '|>', 'π>',
  '+=', '-=', '*=', '/=', '%=', 'π+', 'π-', 'π*', 'π/', 'π<', 'π=',
  '++', '--', '=>', '→', '←',
  '+', '-', '*', '/', '%', '<', '>', '=', '!', '~', '&', '|', '^', '?', ':'
];

const PUNCTUATORS = new Set([
  '(', ')', '{', '}', '[', ']', ';', ',', '.', '...'
]);

// ============================================================
// Lexer
// ============================================================

class Lexer {
  constructor(source) {
    this.source = source;
    this.pos = 0;
    this.line = 1;
    this.column = 0;
    this.tokens = [];
  }

  get current() {
    return this.source[this.pos];
  }

  peek(offset = 0) {
    return this.source[this.pos + offset];
  }

  advance() {
    const char = this.source[this.pos];
    this.pos++;
    if (char === '\n') {
      this.line++;
      this.column = 0;
    } else {
      this.column++;
    }
    return char;
  }

  skipWhitespace() {
    while (this.pos < this.source.length) {
      const char = this.current;
      if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
        this.advance();
      } else if (char === '/' && this.peek(1) === '/') {
        // Single-line comment
        while (this.pos < this.source.length && this.current !== '\n') {
          this.advance();
        }
      } else if (char === '/' && this.peek(1) === '*') {
        // Multi-line comment
        this.advance(); // /
        this.advance(); // *
        while (this.pos < this.source.length) {
          if (this.current === '*' && this.peek(1) === '/') {
            this.advance();
            this.advance();
            break;
          }
          this.advance();
        }
      } else {
        break;
      }
    }
  }

  makeToken(type, value, raw = null) {
    return {
      type,
      value,
      raw: raw || value,
      loc: {
        start: { line: this.line, column: this.column, offset: this.pos },
        end: null
      }
    };
  }

  tokenize() {
    while (this.pos < this.source.length) {
      this.skipWhitespace();
      if (this.pos >= this.source.length) break;

      const token = this.nextToken();
      if (token) {
        this.tokens.push(token);
      }
    }

    this.tokens.push({
      type: TokenType.EOF,
      value: null,
      loc: { start: { line: this.line, column: this.column, offset: this.pos } }
    });

    return this.tokens;
  }

  nextToken() {
    const startLine = this.line;
    const startCol = this.column;
    const startPos = this.pos;

    const char = this.current;

    // Glyph delimiter
    if (char === '⟁') {
      this.advance();
      return this.makeToken(TokenType.GlyphDelim, '⟁');
    }

    // π or τ (can be keyword or operator prefix)
    if (char === 'π' || char === 'τ') {
      const next = this.peek(1);
      // Check if it's an operator
      for (const op of OPERATORS) {
        if (op.startsWith(char) && this.source.slice(this.pos, this.pos + op.length) === op) {
          for (let i = 0; i < op.length; i++) this.advance();
          return this.makeToken(TokenType.Operator, op);
        }
      }
      // Otherwise it's a keyword
      this.advance();
      return this.makeToken(TokenType.Keyword, char);
    }

    // @ directive
    if (char === '@') {
      let directive = '@';
      this.advance();
      while (this.pos < this.source.length && /[a-zA-Z0-9_]/.test(this.current)) {
        directive += this.advance();
      }
      if (DIRECTIVES.has(directive)) {
        return this.makeToken(TokenType.Directive, directive);
      }
      return this.makeToken(TokenType.Identifier, directive);
    }

    // λ (lambda)
    if (char === 'λ') {
      this.advance();
      return this.makeToken(TokenType.Keyword, 'λ');
    }

    // Arrow →
    if (char === '→') {
      this.advance();
      return this.makeToken(TokenType.Operator, '→');
    }

    // Left arrow ←
    if (char === '←') {
      this.advance();
      return this.makeToken(TokenType.Operator, '←');
    }

    // String
    if (char === '"' || char === "'") {
      return this.readString(char);
    }

    // Template literal
    if (char === '`') {
      return this.readTemplateLiteral();
    }

    // Number
    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(this.peek(1)))) {
      return this.readNumber();
    }

    // Identifier or keyword
    if (/[a-zA-Z_$]/.test(char)) {
      return this.readIdentifier();
    }

    // Operators (multi-char first)
    for (const op of OPERATORS) {
      if (this.source.slice(this.pos, this.pos + op.length) === op) {
        for (let i = 0; i < op.length; i++) this.advance();
        return this.makeToken(TokenType.Operator, op);
      }
    }

    // Punctuators
    if (char === '.' && this.peek(1) === '.' && this.peek(2) === '.') {
      this.advance(); this.advance(); this.advance();
      return this.makeToken(TokenType.Punctuator, '...');
    }

    if (PUNCTUATORS.has(char)) {
      this.advance();
      return this.makeToken(TokenType.Punctuator, char);
    }

    // RegExp (after division context check - simplified)
    if (char === '/') {
      // Could be regexp or division - context dependent
      // For now, treat as operator
      this.advance();
      return this.makeToken(TokenType.Operator, '/');
    }

    // Unknown
    throw new Error(`Unexpected character '${char}' at line ${startLine}, column ${startCol}`);
  }

  readString(quote) {
    const startPos = this.pos;
    this.advance(); // opening quote
    let value = '';

    while (this.pos < this.source.length && this.current !== quote) {
      if (this.current === '\\') {
        this.advance();
        const escaped = this.advance();
        switch (escaped) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case 'r': value += '\r'; break;
          case '\\': value += '\\'; break;
          case "'": value += "'"; break;
          case '"': value += '"'; break;
          default: value += escaped;
        }
      } else {
        value += this.advance();
      }
    }

    if (this.current !== quote) {
      throw new Error(`Unterminated string at line ${this.line}`);
    }
    this.advance(); // closing quote

    return this.makeToken(TokenType.String, value, this.source.slice(startPos, this.pos));
  }

  readTemplateLiteral() {
    const startPos = this.pos;
    this.advance(); // opening backtick
    let value = '';

    while (this.pos < this.source.length && this.current !== '`') {
      if (this.current === '$' && this.peek(1) === '{') {
        // Template expression - simplified handling
        value += this.advance(); // $
        value += this.advance(); // {
        let braceCount = 1;
        while (braceCount > 0 && this.pos < this.source.length) {
          if (this.current === '{') braceCount++;
          if (this.current === '}') braceCount--;
          value += this.advance();
        }
      } else if (this.current === '\\') {
        this.advance();
        value += this.advance();
      } else {
        value += this.advance();
      }
    }

    if (this.current !== '`') {
      throw new Error(`Unterminated template literal at line ${this.line}`);
    }
    this.advance(); // closing backtick

    return this.makeToken(TokenType.Template, value, this.source.slice(startPos, this.pos));
  }

  readNumber() {
    const startPos = this.pos;
    let value = '';
    let hasUnit = false;
    let unit = null;

    // Integer part
    while (/[0-9]/.test(this.current)) {
      value += this.advance();
    }

    // Decimal part
    if (this.current === '.' && /[0-9]/.test(this.peek(1))) {
      value += this.advance(); // .
      while (/[0-9]/.test(this.current)) {
        value += this.advance();
      }
    }

    // Exponent
    if (this.current === 'e' || this.current === 'E') {
      value += this.advance();
      if (this.current === '+' || this.current === '-') {
        value += this.advance();
      }
      while (/[0-9]/.test(this.current)) {
        value += this.advance();
      }
    }

    // Unit suffix (π or τ)
    if (this.current === 'π' || this.current === 'τ') {
      unit = this.advance();
      hasUnit = true;
    }

    const numValue = parseFloat(value);
    const finalValue = hasUnit
      ? (unit === 'π' ? numValue * Math.PI : numValue * 2 * Math.PI)
      : numValue;

    const token = this.makeToken(TokenType.Number, finalValue, this.source.slice(startPos, this.pos));
    token.unit = unit;
    return token;
  }

  readIdentifier() {
    const startPos = this.pos;
    let value = '';

    while (this.pos < this.source.length && /[a-zA-Z0-9_$']/.test(this.current)) {
      value += this.advance();
    }

    // Check for keywords
    if (KEYWORDS.has(value)) {
      if (value === 'true' || value === 'false') {
        return this.makeToken(TokenType.Boolean, value === 'true');
      }
      if (value === 'null') {
        return this.makeToken(TokenType.Null, null);
      }
      return this.makeToken(TokenType.Keyword, value);
    }

    // Check for glyph names
    if (GLYPH_NAMES.has(value)) {
      return this.makeToken(TokenType.Glyph, value);
    }

    return this.makeToken(TokenType.Identifier, value);
  }
}

// ============================================================
// Parser
// ============================================================

class Parser {
  constructor(source) {
    this.lexer = new Lexer(source);
    this.tokens = this.lexer.tokenize();
    this.pos = 0;
    this.errors = [];
  }

  get current() {
    return this.tokens[this.pos];
  }

  peek(offset = 0) {
    return this.tokens[this.pos + offset];
  }

  advance() {
    const token = this.current;
    if (this.pos < this.tokens.length - 1) {
      this.pos++;
    }
    return token;
  }

  expect(type, value = null) {
    const token = this.current;
    if (token.type !== type || (value !== null && token.value !== value)) {
      throw new Error(
        `Expected ${type}${value ? ` '${value}'` : ''}, got ${token.type} '${token.value}' at line ${token.loc?.start?.line || '?'}`
      );
    }
    return this.advance();
  }

  match(type, value = null) {
    const token = this.current;
    if (token.type !== type) return false;
    if (value !== null && token.value !== value) return false;
    return true;
  }

  consume(type, value = null) {
    if (this.match(type, value)) {
      return this.advance();
    }
    return null;
  }

  // ============================================================
  // Parsing Methods
  // ============================================================

  parse() {
    const body = [];

    while (!this.match(TokenType.EOF)) {
      const node = this.parseTopLevel();
      if (node) body.push(node);
    }

    return {
      type: 'Program',
      body
    };
  }

  parseTopLevel() {
    // π declaration
    if (this.match(TokenType.Keyword, 'π')) {
      return this.parseπDeclaration();
    }

    // τ declaration
    if (this.match(TokenType.Keyword, 'τ')) {
      return this.parseτDeclaration();
    }

    // function declaration
    if (this.match(TokenType.Keyword, 'function')) {
      return this.parseFunctionDeclaration();
    }

    // λ expression (as statement)
    if (this.match(TokenType.Keyword, 'λ')) {
      return this.parseLambdaExpression();
    }

    // @system declaration
    if (this.match(TokenType.Directive, '@system')) {
      return this.parseSystemDeclaration();
    }

    // @interface declaration
    if (this.match(TokenType.Directive, '@interface')) {
      return this.parseInterfaceDeclaration();
    }

    // type declaration
    if (this.match(TokenType.Keyword, 'type')) {
      return this.parseTypeDeclaration();
    }

    // interface declaration
    if (this.match(TokenType.Keyword, 'interface')) {
      return this.parseInterfaceDeclaration();
    }

    // import/export
    if (this.match(TokenType.Keyword, 'import') || this.match(TokenType.Directive, '@import')) {
      return this.parseImportDeclaration();
    }

    if (this.match(TokenType.Keyword, 'export') || this.match(TokenType.Directive, '@export')) {
      return this.parseExportDeclaration();
    }

    // Directive blocks
    if (this.current.type === TokenType.Directive) {
      return this.parseDirectiveStatement();
    }

    // Glyph statement
    if (this.match(TokenType.GlyphDelim)) {
      return this.parseGlyphStatement();
    }

    // Regular statement
    return this.parseStatement();
  }

  parseπDeclaration() {
    this.expect(TokenType.Keyword, 'π');
    const identifier = this.parseIdentifier();

    let initializer = null;
    if (this.consume(TokenType.Operator, '=')) {
      initializer = this.parseExpression();
    }

    this.consume(TokenType.Punctuator, ';');

    return {
      type: 'πDeclaration',
      identifier,
      initializer
    };
  }

  parseτDeclaration() {
    this.expect(TokenType.Keyword, 'τ');
    const identifier = this.parseIdentifier();

    let initializer = null;
    if (this.consume(TokenType.Operator, '=')) {
      initializer = this.parseExpression();
    }

    this.consume(TokenType.Punctuator, ';');

    return {
      type: 'τDeclaration',
      identifier,
      initializer
    };
  }

  parseFunctionDeclaration() {
    this.expect(TokenType.Keyword, 'function');

    const generator = !!this.consume(TokenType.Operator, '*');
    const name = this.parseIdentifier();

    this.expect(TokenType.Punctuator, '(');
    const params = this.parseParameterList();
    this.expect(TokenType.Punctuator, ')');

    let returnType = null;
    if (this.consume(TokenType.Operator, '→')) {
      returnType = this.parseType();
    }

    const body = this.parseBlock();

    return {
      type: 'FunctionDeclaration',
      name,
      params,
      returnType,
      body,
      generator
    };
  }

  parseLambdaExpression() {
    this.expect(TokenType.Keyword, 'λ');

    this.expect(TokenType.Punctuator, '(');
    const params = this.parseParameterList();
    this.expect(TokenType.Punctuator, ')');

    let returnType = null;
    if (this.consume(TokenType.Operator, '→')) {
      returnType = this.parseType();
    }

    this.expect(TokenType.Operator, '=>');
    const body = this.parseExpression();

    return {
      type: 'LambdaExpression',
      params,
      returnType,
      body
    };
  }

  parseSystemDeclaration() {
    this.expect(TokenType.Directive, '@system');
    const name = this.parseIdentifier();

    this.expect(TokenType.Punctuator, '(');
    const params = this.parseParameterList();
    this.expect(TokenType.Punctuator, ')');

    const body = this.parseBlock();

    return {
      type: 'SystemDeclaration',
      name,
      params,
      body
    };
  }

  parseInterfaceDeclaration() {
    if (this.match(TokenType.Directive, '@interface')) {
      this.advance();
    } else {
      this.expect(TokenType.Keyword, 'interface');
    }

    const name = this.parseIdentifier();

    this.expect(TokenType.Punctuator, '{');
    const methods = [];

    while (!this.match(TokenType.Punctuator, '}') && !this.match(TokenType.EOF)) {
      methods.push(this.parseMethodSignature());
    }

    this.expect(TokenType.Punctuator, '}');

    return {
      type: 'InterfaceDeclaration',
      name,
      methods
    };
  }

  parseMethodSignature() {
    const name = this.parseIdentifier();

    this.expect(TokenType.Punctuator, '(');
    const params = this.parseParameterList();
    this.expect(TokenType.Punctuator, ')');

    let returnType = null;
    if (this.consume(TokenType.Operator, '→')) {
      returnType = this.parseType();
    }

    this.consume(TokenType.Punctuator, ';');

    return {
      type: 'MethodSignature',
      name,
      params,
      returnType
    };
  }

  parseTypeDeclaration() {
    this.expect(TokenType.Keyword, 'type');
    const name = this.parseIdentifier();
    this.expect(TokenType.Operator, '=');
    const value = this.parseType();
    this.consume(TokenType.Punctuator, ';');

    return {
      type: 'TypeDeclaration',
      name,
      value
    };
  }

  parseParameterList() {
    const params = [];

    while (!this.match(TokenType.Punctuator, ')') && !this.match(TokenType.EOF)) {
      params.push(this.parseParameter());
      if (!this.consume(TokenType.Punctuator, ',')) break;
    }

    return params;
  }

  parseParameter() {
    const identifier = this.parseIdentifier();

    let type = null;
    if (this.consume(TokenType.Operator, ':')) {
      type = this.parseType();
    }

    let defaultValue = null;
    if (this.consume(TokenType.Operator, '=')) {
      defaultValue = this.parseExpression();
    }

    return {
      type: 'Parameter',
      identifier,
      paramType: type,
      default: defaultValue
    };
  }

  parseType() {
    // Simple type parsing
    if (this.match(TokenType.Identifier) || this.match(TokenType.Keyword)) {
      const name = this.advance().value;
      return { type: 'TypeReference', name };
    }

    // Array type
    if (this.match(TokenType.Punctuator, '[')) {
      this.advance();
      const element = this.parseType();
      this.expect(TokenType.Punctuator, ']');
      return { type: 'ArrayType', element };
    }

    // Tuple type
    if (this.match(TokenType.Punctuator, '(')) {
      this.advance();
      const elements = [];
      while (!this.match(TokenType.Punctuator, ')')) {
        elements.push(this.parseType());
        if (!this.consume(TokenType.Punctuator, ',')) break;
      }
      this.expect(TokenType.Punctuator, ')');
      return { type: 'TupleType', elements };
    }

    // Record type
    if (this.match(TokenType.Punctuator, '{')) {
      this.advance();
      const fields = [];
      while (!this.match(TokenType.Punctuator, '}')) {
        const key = this.parseIdentifier();
        this.expect(TokenType.Operator, ':');
        const value = this.parseType();
        fields.push({ type: 'FieldType', key, value });
        if (!this.consume(TokenType.Punctuator, ',')) break;
      }
      this.expect(TokenType.Punctuator, '}');
      return { type: 'RecordType', fields };
    }

    throw new Error(`Unexpected token in type: ${this.current.value}`);
  }

  parseStatement() {
    // τ update statement
    if (this.match(TokenType.Keyword, 'τ') && this.peek(1).type === TokenType.Identifier) {
      const next = this.peek(2);
      if (next && next.value === '←') {
        return this.parseτUpdateStatement();
      }
    }

    // Glyph statement
    if (this.match(TokenType.GlyphDelim)) {
      return this.parseGlyphStatement();
    }

    // Directive statements
    if (this.current.type === TokenType.Directive) {
      return this.parseDirectiveStatement();
    }

    // Block
    if (this.match(TokenType.Punctuator, '{')) {
      return this.parseBlock();
    }

    // Return
    if (this.match(TokenType.Keyword, 'return')) {
      return this.parseReturnStatement();
    }

    // Yield
    if (this.match(TokenType.Keyword, 'yield')) {
      return this.parseYieldStatement();
    }

    // Break
    if (this.match(TokenType.Keyword, 'break')) {
      this.advance();
      this.consume(TokenType.Punctuator, ';');
      return { type: 'BreakStatement' };
    }

    // Continue
    if (this.match(TokenType.Keyword, 'continue')) {
      this.advance();
      this.consume(TokenType.Punctuator, ';');
      return { type: 'ContinueStatement' };
    }

    // Expression statement
    const expression = this.parseExpression();
    this.consume(TokenType.Punctuator, ';');

    return {
      type: 'ExpressionStatement',
      expression
    };
  }

  parseτUpdateStatement() {
    this.expect(TokenType.Keyword, 'τ');
    const identifier = this.parseIdentifier();
    this.expect(TokenType.Operator, '←');
    const value = this.parseExpression();
    this.consume(TokenType.Punctuator, ';');

    return {
      type: 'τUpdateStatement',
      identifier,
      value
    };
  }

  parseGlyphStatement() {
    this.expect(TokenType.GlyphDelim);

    const glyph = this.parseIdentifier();

    this.expect(TokenType.Punctuator, '(');
    const args = this.parseArgumentList();
    this.expect(TokenType.Punctuator, ')');

    let destination = null;
    if (this.consume(TokenType.Operator, '→')) {
      destination = this.parseIdentifier();
    }

    return {
      type: 'GlyphStatement',
      glyph,
      arguments: args,
      destination
    };
  }

  parseDirectiveStatement() {
    const directive = this.advance().value.slice(1); // Remove @

    // Control flow directives
    if (directive === 'if') {
      return this.parseIfStatement();
    }
    if (directive === 'for') {
      return this.parseForStatement();
    }
    if (directive === 'while') {
      return this.parseWhileStatement();
    }
    if (directive === 'match') {
      return this.parseMatchStatement();
    }

    // Block directives
    if (['compressed', 'flow', 'data', 'atomic', 'deterministic', 'replayable'].includes(directive)) {
      const body = this.parseBlock();
      return {
        type: 'DirectiveStatement',
        directive,
        body
      };
    }

    // Glyph directive
    if (directive === 'glyph') {
      const glyph = this.parseIdentifier();
      this.expect(TokenType.Punctuator, '(');
      const args = this.parseArgumentList();
      this.expect(TokenType.Punctuator, ')');
      return {
        type: 'GlyphExpression',
        glyph,
        arguments: args
      };
    }

    throw new Error(`Unknown directive: @${directive}`);
  }

  parseIfStatement() {
    this.expect(TokenType.Punctuator, '(');
    const test = this.parseExpression();
    this.expect(TokenType.Punctuator, ')');

    const consequent = this.parseStatement();

    let alternate = null;
    if (this.consume(TokenType.Directive, '@else')) {
      alternate = this.parseStatement();
    }

    return {
      type: 'IfStatement',
      test,
      consequent,
      alternate
    };
  }

  parseForStatement() {
    this.expect(TokenType.Punctuator, '(');

    // Check for for-of: @for (π x of collection)
    if (this.match(TokenType.Keyword, 'π')) {
      this.advance();
      const binding = this.parseIdentifier();
      if (this.current.value === 'of') {
        this.advance();
        const iterable = this.parseExpression();
        this.expect(TokenType.Punctuator, ')');
        const body = this.parseStatement();
        return {
          type: 'ForOfLoop',
          binding,
          iterable,
          body
        };
      }
    }

    // Check for for-in: @for (τ x in collection)
    if (this.match(TokenType.Keyword, 'τ')) {
      this.advance();
      const binding = this.parseIdentifier();
      if (this.current.value === 'in') {
        this.advance();
        const iterable = this.parseExpression();
        this.expect(TokenType.Punctuator, ')');
        const body = this.parseStatement();
        return {
          type: 'ForInLoop',
          binding,
          iterable,
          body
        };
      }
    }

    // C-style for loop
    let init = null;
    if (!this.match(TokenType.Punctuator, ';')) {
      init = this.parseExpression();
    }
    this.expect(TokenType.Punctuator, ';');

    let test = null;
    if (!this.match(TokenType.Punctuator, ';')) {
      test = this.parseExpression();
    }
    this.expect(TokenType.Punctuator, ';');

    let update = null;
    if (!this.match(TokenType.Punctuator, ')')) {
      update = this.parseExpression();
    }
    this.expect(TokenType.Punctuator, ')');

    const body = this.parseStatement();

    return {
      type: 'ForLoop',
      init,
      test,
      update,
      body
    };
  }

  parseWhileStatement() {
    this.expect(TokenType.Punctuator, '(');
    const test = this.parseExpression();
    this.expect(TokenType.Punctuator, ')');
    const body = this.parseStatement();

    return {
      type: 'WhileStatement',
      test,
      body
    };
  }

  parseMatchStatement() {
    this.expect(TokenType.Punctuator, '(');
    const discriminant = this.parseExpression();
    this.expect(TokenType.Punctuator, ')');

    this.expect(TokenType.Punctuator, '{');
    const cases = [];

    while (!this.match(TokenType.Punctuator, '}') && !this.match(TokenType.EOF)) {
      const pattern = this.parsePattern();
      this.expect(TokenType.Operator, '=>');
      const body = this.parseStatement();
      cases.push({ type: 'CaseClause', pattern, body });
    }

    this.expect(TokenType.Punctuator, '}');

    return {
      type: 'MatchStatement',
      discriminant,
      cases
    };
  }

  parsePattern() {
    // Wildcard
    if (this.match(TokenType.Identifier) && this.current.value === '_') {
      this.advance();
      return { type: 'WildcardPattern' };
    }

    // Literal patterns
    if (this.match(TokenType.Number) || this.match(TokenType.String) ||
        this.match(TokenType.Boolean) || this.match(TokenType.Null)) {
      return { type: 'LiteralPattern', value: this.parseLiteral() };
    }

    // Array pattern
    if (this.match(TokenType.Punctuator, '[')) {
      this.advance();
      const elements = [];
      while (!this.match(TokenType.Punctuator, ']')) {
        elements.push(this.parsePattern());
        if (!this.consume(TokenType.Punctuator, ',')) break;
      }
      this.expect(TokenType.Punctuator, ']');
      return { type: 'ArrayPattern', elements };
    }

    // Object pattern
    if (this.match(TokenType.Punctuator, '{')) {
      this.advance();
      const properties = [];
      while (!this.match(TokenType.Punctuator, '}')) {
        const key = this.parseIdentifier();
        this.expect(TokenType.Operator, ':');
        const value = this.parsePattern();
        properties.push({ type: 'PatternProperty', key, value });
        if (!this.consume(TokenType.Punctuator, ',')) break;
      }
      this.expect(TokenType.Punctuator, '}');
      return { type: 'ObjectPattern', properties };
    }

    // Identifier pattern
    return { type: 'IdentifierPattern', identifier: this.parseIdentifier() };
  }

  parseReturnStatement() {
    this.expect(TokenType.Keyword, 'return');

    let argument = null;
    if (!this.match(TokenType.Punctuator, ';') && !this.match(TokenType.EOF)) {
      argument = this.parseExpression();
    }
    this.consume(TokenType.Punctuator, ';');

    return {
      type: 'ReturnStatement',
      argument
    };
  }

  parseYieldStatement() {
    this.expect(TokenType.Keyword, 'yield');

    const delegate = !!this.consume(TokenType.Operator, '*');

    let argument = null;
    if (!this.match(TokenType.Punctuator, ';') && !this.match(TokenType.EOF)) {
      argument = this.parseExpression();
    }
    this.consume(TokenType.Punctuator, ';');

    return {
      type: 'YieldStatement',
      argument,
      delegate
    };
  }

  parseBlock() {
    this.expect(TokenType.Punctuator, '{');
    const statements = [];

    while (!this.match(TokenType.Punctuator, '}') && !this.match(TokenType.EOF)) {
      statements.push(this.parseStatement());
    }

    this.expect(TokenType.Punctuator, '}');

    return {
      type: 'Block',
      statements
    };
  }

  parseImportDeclaration() {
    if (this.match(TokenType.Directive, '@import')) {
      this.advance();
    } else {
      this.expect(TokenType.Keyword, 'import');
    }

    const specifiers = [];

    // import 'module'
    if (this.match(TokenType.String)) {
      const source = this.parseLiteral();
      this.consume(TokenType.Punctuator, ';');
      return { type: 'ImportDeclaration', specifiers: [], source };
    }

    // import * as name
    if (this.consume(TokenType.Operator, '*')) {
      this.expect(TokenType.Keyword, 'as');
      const local = this.parseIdentifier();
      specifiers.push({ type: 'ImportNamespaceSpecifier', local });
    }
    // import { a, b as c }
    else if (this.match(TokenType.Punctuator, '{')) {
      this.advance();
      while (!this.match(TokenType.Punctuator, '}')) {
        const imported = this.parseIdentifier();
        let local = imported;
        if (this.consume(TokenType.Keyword, 'as')) {
          local = this.parseIdentifier();
        }
        specifiers.push({ type: 'ImportSpecifier', imported, local });
        if (!this.consume(TokenType.Punctuator, ',')) break;
      }
      this.expect(TokenType.Punctuator, '}');
    }
    // import name
    else {
      const local = this.parseIdentifier();
      specifiers.push({ type: 'ImportDefaultSpecifier', local });
    }

    this.expect(TokenType.Keyword, 'from');
    const source = this.parseLiteral();
    this.consume(TokenType.Punctuator, ';');

    return {
      type: 'ImportDeclaration',
      specifiers,
      source
    };
  }

  parseExportDeclaration() {
    if (this.match(TokenType.Directive, '@export')) {
      this.advance();
    } else {
      this.expect(TokenType.Keyword, 'export');
    }

    // export default
    if (this.consume(TokenType.Keyword, 'default')) {
      const declaration = this.parseExpression();
      this.consume(TokenType.Punctuator, ';');
      return { type: 'ExportDeclaration', default: true, declaration };
    }

    // export *
    if (this.consume(TokenType.Operator, '*')) {
      this.expect(TokenType.Keyword, 'from');
      const source = this.parseLiteral();
      this.consume(TokenType.Punctuator, ';');
      return { type: 'ExportAllDeclaration', source };
    }

    // export { a, b as c }
    if (this.match(TokenType.Punctuator, '{')) {
      this.advance();
      const specifiers = [];
      while (!this.match(TokenType.Punctuator, '}')) {
        const local = this.parseIdentifier();
        let exported = local;
        if (this.consume(TokenType.Keyword, 'as')) {
          exported = this.parseIdentifier();
        }
        specifiers.push({ type: 'ExportSpecifier', local, exported });
        if (!this.consume(TokenType.Punctuator, ',')) break;
      }
      this.expect(TokenType.Punctuator, '}');
      this.consume(TokenType.Punctuator, ';');
      return { type: 'ExportDeclaration', specifiers };
    }

    // export declaration
    const declaration = this.parseTopLevel();
    return { type: 'ExportDeclaration', declaration };
  }

  // ============================================================
  // Expression Parsing (Precedence Climbing)
  // ============================================================

  parseExpression() {
    return this.parsePipeExpression();
  }

  parsePipeExpression() {
    let left = this.parseConditionalExpression();

    while (this.match(TokenType.Operator, '|>') || this.match(TokenType.Operator, 'π>')) {
      const operator = this.advance().value;
      const right = this.parseConditionalExpression();
      left = {
        type: 'PipeExpression',
        operator,
        left,
        right
      };
    }

    return left;
  }

  parseConditionalExpression() {
    let test = this.parseLogicalOrExpression();

    if (this.consume(TokenType.Operator, '?')) {
      const consequent = this.parseExpression();
      this.expect(TokenType.Operator, ':');
      const alternate = this.parseExpression();
      return {
        type: 'ConditionalExpression',
        test,
        consequent,
        alternate
      };
    }

    return test;
  }

  parseLogicalOrExpression() {
    return this.parseBinaryExpression(['||'], () => this.parseLogicalAndExpression());
  }

  parseLogicalAndExpression() {
    return this.parseBinaryExpression(['&&'], () => this.parseBitwiseOrExpression());
  }

  parseBitwiseOrExpression() {
    return this.parseBinaryExpression(['|'], () => this.parseBitwiseXorExpression());
  }

  parseBitwiseXorExpression() {
    return this.parseBinaryExpression(['^'], () => this.parseBitwiseAndExpression());
  }

  parseBitwiseAndExpression() {
    return this.parseBinaryExpression(['&'], () => this.parseEqualityExpression());
  }

  parseEqualityExpression() {
    return this.parseBinaryExpression(['==', '!=', '===', '!=='], () => this.parseRelationalExpression());
  }

  parseRelationalExpression() {
    return this.parseBinaryExpression(['<', '>', '<=', '>=', 'π<', 'π>'], () => this.parseShiftExpression());
  }

  parseShiftExpression() {
    return this.parseBinaryExpression(['<<', '>>', '>>>'], () => this.parseAdditiveExpression());
  }

  parseAdditiveExpression() {
    return this.parseBinaryExpression(['+', '-', 'π+', 'π-'], () => this.parseMultiplicativeExpression());
  }

  parseMultiplicativeExpression() {
    return this.parseBinaryExpression(['*', '/', '%', 'π*', 'π/'], () => this.parseExponentiationExpression());
  }

  parseExponentiationExpression() {
    let left = this.parseUnaryExpression();

    if (this.match(TokenType.Operator, '**') || this.match(TokenType.Operator, 'π**')) {
      const operator = this.advance().value;
      const right = this.parseExponentiationExpression(); // Right associative
      return {
        type: 'BinaryExpression',
        operator,
        left,
        right
      };
    }

    return left;
  }

  parseBinaryExpression(operators, parseNext) {
    let left = parseNext.call(this);

    while (this.current.type === TokenType.Operator && operators.includes(this.current.value)) {
      const operator = this.advance().value;
      const right = parseNext.call(this);
      left = {
        type: 'BinaryExpression',
        operator,
        left,
        right
      };
    }

    return left;
  }

  parseUnaryExpression() {
    const unaryOps = ['-', '+', '!', '~', 'π-', '++', '--'];

    if (this.current.type === TokenType.Operator && unaryOps.includes(this.current.value)) {
      const operator = this.advance().value;
      const argument = this.parseUnaryExpression();
      return {
        type: 'UnaryExpression',
        operator,
        argument,
        prefix: true
      };
    }

    return this.parsePostfixExpression();
  }

  parsePostfixExpression() {
    let expression = this.parseCallExpression();

    while (this.match(TokenType.Operator, '++') || this.match(TokenType.Operator, '--')) {
      const operator = this.advance().value;
      expression = {
        type: 'UnaryExpression',
        operator,
        argument: expression,
        prefix: false
      };
    }

    return expression;
  }

  parseCallExpression() {
    let expression = this.parseMemberExpression();

    while (true) {
      if (this.match(TokenType.Punctuator, '(')) {
        this.advance();
        const args = this.parseArgumentList();
        this.expect(TokenType.Punctuator, ')');
        expression = {
          type: 'CallExpression',
          callee: expression,
          arguments: args
        };
      } else {
        break;
      }
    }

    return expression;
  }

  parseMemberExpression() {
    let expression = this.parsePrimaryExpression();

    while (true) {
      if (this.consume(TokenType.Punctuator, '.')) {
        const property = this.parseIdentifier();
        expression = {
          type: 'MemberExpression',
          object: expression,
          property,
          computed: false
        };
      } else if (this.match(TokenType.Punctuator, '[')) {
        this.advance();
        const property = this.parseExpression();
        this.expect(TokenType.Punctuator, ']');
        expression = {
          type: 'MemberExpression',
          object: expression,
          property,
          computed: true
        };
      } else {
        break;
      }
    }

    return expression;
  }

  parsePrimaryExpression() {
    // π literal
    if (this.match(TokenType.Keyword, 'π') && this.peek(1).type === TokenType.Punctuator) {
      return this.parseπLiteral();
    }

    // τ literal
    if (this.match(TokenType.Keyword, 'τ') && this.peek(1).type === TokenType.Punctuator) {
      return this.parseτLiteral();
    }

    // Identifier
    if (this.match(TokenType.Identifier) || this.match(TokenType.Glyph)) {
      return this.parseIdentifier();
    }

    // Literals
    if (this.match(TokenType.Number) || this.match(TokenType.String) ||
        this.match(TokenType.Boolean) || this.match(TokenType.Null)) {
      return this.parseLiteral();
    }

    // Template literal
    if (this.match(TokenType.Template)) {
      return this.parseTemplateLiteral();
    }

    // Array literal
    if (this.match(TokenType.Punctuator, '[')) {
      return this.parseArrayExpression();
    }

    // Object literal
    if (this.match(TokenType.Punctuator, '{')) {
      return this.parseObjectExpression();
    }

    // Parenthesized expression
    if (this.match(TokenType.Punctuator, '(')) {
      this.advance();
      const expression = this.parseExpression();
      this.expect(TokenType.Punctuator, ')');
      return expression;
    }

    // Lambda
    if (this.match(TokenType.Keyword, 'λ')) {
      return this.parseLambdaExpression();
    }

    // new expression
    if (this.match(TokenType.Keyword, 'new')) {
      this.advance();
      const callee = this.parseIdentifier();
      this.expect(TokenType.Punctuator, '(');
      const args = this.parseArgumentList();
      this.expect(TokenType.Punctuator, ')');
      return {
        type: 'NewExpression',
        callee,
        arguments: args
      };
    }

    throw new Error(`Unexpected token: ${this.current.type} '${this.current.value}'`);
  }

  parseπLiteral() {
    this.expect(TokenType.Keyword, 'π');

    // π[...]
    if (this.match(TokenType.Punctuator, '[')) {
      this.advance();
      const elements = [];
      while (!this.match(TokenType.Punctuator, ']')) {
        elements.push(this.parseExpression());
        if (!this.consume(TokenType.Punctuator, ',')) break;
      }
      this.expect(TokenType.Punctuator, ']');
      return { type: 'πLiteral', form: 'array', value: elements };
    }

    // π{...}
    if (this.match(TokenType.Punctuator, '{')) {
      this.advance();
      const properties = [];
      while (!this.match(TokenType.Punctuator, '}')) {
        const key = this.parseIdentifier();
        this.expect(TokenType.Operator, ':');
        const value = this.parseExpression();
        properties.push({ key, value });
        if (!this.consume(TokenType.Punctuator, ',')) break;
      }
      this.expect(TokenType.Punctuator, '}');
      return { type: 'πLiteral', form: 'object', value: properties };
    }

    // π(...)
    if (this.match(TokenType.Punctuator, '(')) {
      this.advance();
      const value = this.parseExpression();
      this.expect(TokenType.Punctuator, ')');
      return { type: 'πLiteral', form: 'scalar', value };
    }

    throw new Error('Invalid π literal');
  }

  parseτLiteral() {
    this.expect(TokenType.Keyword, 'τ');

    // τ[...]
    if (this.match(TokenType.Punctuator, '[')) {
      this.advance();
      const elements = [];
      while (!this.match(TokenType.Punctuator, ']')) {
        elements.push(this.parseExpression());
        if (!this.consume(TokenType.Punctuator, ',')) break;
      }
      this.expect(TokenType.Punctuator, ']');
      return { type: 'τLiteral', form: 'array', value: elements };
    }

    // τ{...}
    if (this.match(TokenType.Punctuator, '{')) {
      this.advance();
      const properties = [];
      while (!this.match(TokenType.Punctuator, '}')) {
        const key = this.parseIdentifier();
        this.expect(TokenType.Operator, ':');
        const value = this.parseExpression();
        properties.push({ key, value });
        if (!this.consume(TokenType.Punctuator, ',')) break;
      }
      this.expect(TokenType.Punctuator, '}');
      return { type: 'τLiteral', form: 'object', value: properties };
    }

    throw new Error('Invalid τ literal');
  }

  parseArgumentList() {
    const args = [];

    while (!this.match(TokenType.Punctuator, ')') && !this.match(TokenType.EOF)) {
      args.push(this.parseExpression());
      if (!this.consume(TokenType.Punctuator, ',')) break;
    }

    return args;
  }

  parseIdentifier() {
    if (this.match(TokenType.Identifier) || this.match(TokenType.Glyph)) {
      const token = this.advance();
      return {
        type: 'Identifier',
        name: token.value
      };
    }
    throw new Error(`Expected identifier, got ${this.current.type} '${this.current.value}'`);
  }

  parseLiteral() {
    const token = this.current;

    if (this.match(TokenType.Number)) {
      this.advance();
      return {
        type: 'NumericLiteral',
        value: token.value,
        unit: token.unit || null,
        raw: token.raw
      };
    }

    if (this.match(TokenType.String)) {
      this.advance();
      return {
        type: 'StringLiteral',
        value: token.value
      };
    }

    if (this.match(TokenType.Boolean)) {
      this.advance();
      return {
        type: 'BooleanLiteral',
        value: token.value
      };
    }

    if (this.match(TokenType.Null)) {
      this.advance();
      return {
        type: 'NullLiteral'
      };
    }

    throw new Error(`Expected literal, got ${token.type}`);
  }

  parseTemplateLiteral() {
    const token = this.advance();
    // Simplified: return raw template
    return {
      type: 'TemplateLiteral',
      value: token.value
    };
  }

  parseArrayExpression() {
    this.expect(TokenType.Punctuator, '[');
    const elements = [];

    while (!this.match(TokenType.Punctuator, ']') && !this.match(TokenType.EOF)) {
      elements.push(this.parseExpression());
      if (!this.consume(TokenType.Punctuator, ',')) break;
    }

    this.expect(TokenType.Punctuator, ']');

    return {
      type: 'ArrayExpression',
      elements
    };
  }

  parseObjectExpression() {
    this.expect(TokenType.Punctuator, '{');
    const properties = [];

    while (!this.match(TokenType.Punctuator, '}') && !this.match(TokenType.EOF)) {
      let key;
      let computed = false;

      // Computed property [expr]
      if (this.match(TokenType.Punctuator, '[')) {
        this.advance();
        key = this.parseExpression();
        this.expect(TokenType.Punctuator, ']');
        computed = true;
      }
      // String key
      else if (this.match(TokenType.String)) {
        key = this.parseLiteral();
      }
      // Identifier key
      else {
        key = this.parseIdentifier();
      }

      // Shorthand property { name }
      let value;
      if (this.consume(TokenType.Operator, ':')) {
        value = this.parseExpression();
      } else {
        value = key;
      }

      properties.push({
        type: 'Property',
        key,
        value,
        computed,
        shorthand: key === value
      });

      if (!this.consume(TokenType.Punctuator, ',')) break;
    }

    this.expect(TokenType.Punctuator, '}');

    return {
      type: 'ObjectExpression',
      properties
    };
  }
}

// ============================================================
// Exports
// ============================================================

const KUHULESParser = {
  Lexer,
  Parser,
  TokenType,

  /**
   * Parse KUHUL-ES source to AST
   */
  parse(source) {
    const parser = new Parser(source);
    return parser.parse();
  },

  /**
   * Tokenize KUHUL-ES source
   */
  tokenize(source) {
    const lexer = new Lexer(source);
    return lexer.tokenize();
  }
};

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KUHULESParser;
}
if (typeof window !== 'undefined') {
  window.KUHULESParser = KUHULESParser;
}
if (typeof globalThis !== 'undefined') {
  globalThis.KUHULESParser = KUHULESParser;
}
