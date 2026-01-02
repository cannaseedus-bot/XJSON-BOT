/**
 * GGL Runtime - Geometric Glyph Language Parser & Executor
 * Version: 1.0.0
 *
 * Pure geometric computation where shapes ARE operations.
 * Integrates with KUHUL pipeline for effect execution.
 */

// ============================================================================
// GLYPH DEFINITIONS
// ============================================================================

const GGL_GLYPHS = {
  // Primitives
  CIRCLE: '◯',
  SQUARE: '□',
  TRIANGLE: '△',
  LINE: '─',
  POINT: '•',
  POLYGON: '⬡',
  BEZIER: '∿',
  ARC: '⌒',

  // Operations
  UNION: '∪',
  INTERSECT: '∩',
  DIFFERENCE: '∖',
  XOR: '⊕',
  BLEND: '⊗',
  MORPH: '⟿',

  // Transforms
  TRANSLATE: '→',
  ROTATE: '↻',
  SCALE: '⇔',

  // Delimiters
  OPEN_PAREN: '(',
  CLOSE_PAREN: ')',
  OPEN_BRACKET: '[',
  CLOSE_BRACKET: ']',
  OPEN_BRACE: '{',
  CLOSE_BRACE: '}',
  COMMA: ',',
  SEMICOLON: ';',
  COLON: ':',

  // Assignment
  ASSIGN: '←',
  PIPE: '|',
  COMPOSE: '∘'
};

const GLYPH_TO_TYPE = {
  '◯': 'circle',
  '□': 'square',
  '△': 'triangle',
  '─': 'line',
  '•': 'point',
  '⬡': 'polygon',
  '∿': 'bezier',
  '⌒': 'arc'
};

const OP_TO_TYPE = {
  '∪': 'union',
  '∩': 'intersection',
  '∖': 'difference',
  '⊕': 'xor',
  '⊗': 'blend',
  '⟿': 'morph'
};

// ============================================================================
// LEXER
// ============================================================================

class GGLLexer {
  constructor(source) {
    this.source = source;
    this.pos = 0;
    this.tokens = [];
  }

  tokenize() {
    while (this.pos < this.source.length) {
      this.skipWhitespace();
      if (this.pos >= this.source.length) break;

      const char = this.source[this.pos];

      // Check for glyphs
      if (this.isPrimitiveGlyph(char)) {
        this.tokens.push({ type: 'PRIMITIVE', glyph: char, value: GLYPH_TO_TYPE[char] });
        this.pos++;
      } else if (this.isOperationGlyph(char)) {
        this.tokens.push({ type: 'OPERATION', glyph: char, value: OP_TO_TYPE[char] });
        this.pos++;
      } else if (char === GGL_GLYPHS.TRANSLATE) {
        this.tokens.push({ type: 'TRANSFORM', glyph: char, value: 'translate' });
        this.pos++;
      } else if (char === GGL_GLYPHS.ROTATE) {
        this.tokens.push({ type: 'TRANSFORM', glyph: char, value: 'rotate' });
        this.pos++;
      } else if (char === GGL_GLYPHS.SCALE) {
        this.tokens.push({ type: 'TRANSFORM', glyph: char, value: 'scale' });
        this.pos++;
      } else if (char === GGL_GLYPHS.ASSIGN) {
        this.tokens.push({ type: 'ASSIGN', glyph: char });
        this.pos++;
      } else if (char === GGL_GLYPHS.PIPE) {
        this.tokens.push({ type: 'PIPE', glyph: char });
        this.pos++;
      } else if (char === GGL_GLYPHS.COMPOSE) {
        this.tokens.push({ type: 'COMPOSE', glyph: char });
        this.pos++;
      } else if (this.isDelimiter(char)) {
        this.tokens.push({ type: 'DELIMITER', value: char });
        this.pos++;
      } else if (this.isDigit(char) || char === '-' || char === '.') {
        this.tokens.push(this.readNumber());
      } else if (this.isAlpha(char)) {
        this.tokens.push(this.readIdentifier());
      } else if (char === '#') {
        this.tokens.push(this.readColor());
      } else {
        this.pos++; // Skip unknown characters
      }
    }

    this.tokens.push({ type: 'EOF' });
    return this.tokens;
  }

  skipWhitespace() {
    while (this.pos < this.source.length && /\s/.test(this.source[this.pos])) {
      this.pos++;
    }
  }

  isPrimitiveGlyph(char) {
    return ['◯', '□', '△', '─', '•', '⬡', '∿', '⌒'].includes(char);
  }

  isOperationGlyph(char) {
    return ['∪', '∩', '∖', '⊕', '⊗', '⟿'].includes(char);
  }

  isDelimiter(char) {
    return ['(', ')', '[', ']', '{', '}', ',', ';', ':'].includes(char);
  }

  isDigit(char) {
    return /[0-9]/.test(char);
  }

  isAlpha(char) {
    return /[a-zA-Z_]/.test(char);
  }

  readNumber() {
    let numStr = '';
    const start = this.pos;

    if (this.source[this.pos] === '-') {
      numStr += '-';
      this.pos++;
    }

    while (this.pos < this.source.length && (this.isDigit(this.source[this.pos]) || this.source[this.pos] === '.')) {
      numStr += this.source[this.pos];
      this.pos++;
    }

    return { type: 'NUMBER', value: parseFloat(numStr) };
  }

  readIdentifier() {
    let id = '';
    while (this.pos < this.source.length && (this.isAlpha(this.source[this.pos]) || this.isDigit(this.source[this.pos]))) {
      id += this.source[this.pos];
      this.pos++;
    }
    return { type: 'IDENTIFIER', value: id };
  }

  readColor() {
    let color = '#';
    this.pos++; // Skip #
    while (this.pos < this.source.length && /[0-9a-fA-F]/.test(this.source[this.pos])) {
      color += this.source[this.pos];
      this.pos++;
    }
    return { type: 'COLOR', value: color };
  }
}

// ============================================================================
// PARSER
// ============================================================================

class GGLParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  parse() {
    const program = {
      type: 'ggl-program',
      version: '1.0.0',
      expressions: [],
      bindings: {}
    };

    while (!this.isAtEnd()) {
      const expr = this.parseExpression();
      if (expr) {
        program.expressions.push(expr);
      }
    }

    return program;
  }

  parseExpression() {
    // Check for assignment
    if (this.check('IDENTIFIER') && this.checkAhead('ASSIGN', 1)) {
      return this.parseAssignment();
    }

    return this.parsePipeExpression();
  }

  parseAssignment() {
    const name = this.advance().value;
    this.expect('ASSIGN');
    const value = this.parsePipeExpression();
    return {
      type: 'ggl-assignment',
      name,
      value
    };
  }

  parsePipeExpression() {
    let left = this.parseOperationExpression();

    while (this.match('PIPE')) {
      const right = this.parseOperationExpression();
      left = {
        type: 'ggl-pipe',
        left,
        right
      };
    }

    return left;
  }

  parseOperationExpression() {
    let left = this.parseTransformExpression();

    while (this.check('OPERATION')) {
      const op = this.advance();
      const right = this.parseTransformExpression();
      left = {
        type: 'ggl-operation',
        operation: op.value,
        glyph: op.glyph,
        operands: [left, right]
      };
    }

    return left;
  }

  parseTransformExpression() {
    let expr = this.parsePrimaryExpression();

    while (this.check('TRANSFORM')) {
      const transform = this.advance();
      const params = this.parseTransformParams();
      expr = {
        type: 'ggl-transform',
        transform: transform.value,
        glyph: transform.glyph,
        target: expr,
        params
      };
    }

    return expr;
  }

  parseTransformParams() {
    const params = {};

    if (this.match('DELIMITER', '(')) {
      while (!this.check('DELIMITER', ')') && !this.isAtEnd()) {
        if (this.check('IDENTIFIER')) {
          const key = this.advance().value;
          if (this.match('DELIMITER', ':')) {
            params[key] = this.parseValue();
          }
        } else {
          // Positional params
          const val = this.parseValue();
          if (params.x === undefined) params.x = val;
          else if (params.y === undefined) params.y = val;
          else if (params.z === undefined) params.z = val;
        }
        this.match('DELIMITER', ',');
      }
      this.expect('DELIMITER', ')');
    }

    return params;
  }

  parsePrimaryExpression() {
    // Primitive with params
    if (this.check('PRIMITIVE')) {
      return this.parsePrimitive();
    }

    // Grouped expression
    if (this.match('DELIMITER', '(')) {
      const expr = this.parseExpression();
      this.expect('DELIMITER', ')');
      return expr;
    }

    // Identifier reference
    if (this.check('IDENTIFIER')) {
      return {
        type: 'ggl-reference',
        name: this.advance().value
      };
    }

    return null;
  }

  parsePrimitive() {
    const token = this.advance();
    const primitive = {
      type: 'ggl-primitive',
      primitiveType: token.value,
      glyph: token.glyph,
      params: {}
    };

    // Parse optional params
    if (this.match('DELIMITER', '(')) {
      primitive.params = this.parsePrimitiveParams(token.value);
      this.expect('DELIMITER', ')');
    }

    return primitive;
  }

  parsePrimitiveParams(primitiveType) {
    const params = {};

    switch (primitiveType) {
      case 'circle':
        // ◯(x, y, r) or ◯(cx: x, cy: y, radius: r)
        params.center = { x: 0, y: 0 };
        params.radius = 1;
        break;
      case 'square':
        params.center = { x: 0, y: 0 };
        params.size = 1;
        break;
      case 'triangle':
        params.vertices = [
          { x: 0, y: 1 },
          { x: -0.866, y: -0.5 },
          { x: 0.866, y: -0.5 }
        ];
        break;
      case 'line':
        params.start = { x: 0, y: 0 };
        params.end = { x: 1, y: 1 };
        break;
      case 'point':
        params.position = { x: 0, y: 0 };
        break;
    }

    // Parse actual values
    let idx = 0;
    while (!this.check('DELIMITER', ')') && !this.isAtEnd()) {
      if (this.check('IDENTIFIER')) {
        const key = this.advance().value;
        if (this.match('DELIMITER', ':')) {
          const val = this.parseValue();
          if (key === 'cx' || key === 'x') params.center ? params.center.x = val : null;
          else if (key === 'cy' || key === 'y') params.center ? params.center.y = val : null;
          else if (key === 'r' || key === 'radius') params.radius = val;
          else if (key === 'size') params.size = val;
          else if (key === 'fill') params.fill = val;
          else if (key === 'stroke') params.stroke = val;
          else params[key] = val;
        }
      } else if (this.check('NUMBER')) {
        const val = this.parseValue();
        if (primitiveType === 'circle') {
          if (idx === 0 && params.center) params.center.x = val;
          else if (idx === 1 && params.center) params.center.y = val;
          else if (idx === 2) params.radius = val;
        } else if (primitiveType === 'square') {
          if (idx === 0 && params.center) params.center.x = val;
          else if (idx === 1 && params.center) params.center.y = val;
          else if (idx === 2) params.size = val;
        }
        idx++;
      } else if (this.check('COLOR')) {
        params.fill = this.advance().value;
      }
      this.match('DELIMITER', ',');
    }

    return params;
  }

  parseValue() {
    if (this.check('NUMBER')) {
      return this.advance().value;
    }
    if (this.check('COLOR')) {
      return this.advance().value;
    }
    if (this.check('IDENTIFIER')) {
      return this.advance().value;
    }
    if (this.match('DELIMITER', '[')) {
      const arr = [];
      while (!this.check('DELIMITER', ']') && !this.isAtEnd()) {
        arr.push(this.parseValue());
        this.match('DELIMITER', ',');
      }
      this.expect('DELIMITER', ']');
      return arr;
    }
    return null;
  }

  // Utility methods
  check(type, value = null) {
    if (this.isAtEnd()) return false;
    const token = this.tokens[this.pos];
    if (value !== null) {
      return token.type === type && token.value === value;
    }
    return token.type === type;
  }

  checkAhead(type, offset) {
    const idx = this.pos + offset;
    if (idx >= this.tokens.length) return false;
    return this.tokens[idx].type === type;
  }

  match(type, value = null) {
    if (this.check(type, value)) {
      this.advance();
      return true;
    }
    return false;
  }

  advance() {
    if (!this.isAtEnd()) this.pos++;
    return this.tokens[this.pos - 1];
  }

  expect(type, value = null) {
    if (!this.check(type, value)) {
      throw new Error(`Expected ${type}${value ? ` '${value}'` : ''} at position ${this.pos}`);
    }
    return this.advance();
  }

  isAtEnd() {
    return this.tokens[this.pos].type === 'EOF';
  }
}

// ============================================================================
// EXECUTOR
// ============================================================================

class GGLExecutor {
  constructor() {
    this.bindings = new Map();
    this.canvas = { width: 100, height: 100, origin: { x: 50, y: 50 } };
  }

  execute(program) {
    const results = [];

    for (const expr of program.expressions) {
      const result = this.evaluateExpression(expr);
      if (expr.type === 'ggl-assignment') {
        this.bindings.set(expr.name, result);
      }
      results.push(result);
    }

    return {
      type: 'ggl-result',
      program,
      results,
      bindings: Object.fromEntries(this.bindings)
    };
  }

  evaluateExpression(expr) {
    switch (expr.type) {
      case 'ggl-assignment':
        return this.evaluateExpression(expr.value);

      case 'ggl-primitive':
        return this.createPrimitive(expr);

      case 'ggl-operation':
        return this.executeOperation(expr);

      case 'ggl-transform':
        return this.executeTransform(expr);

      case 'ggl-pipe':
        const left = this.evaluateExpression(expr.left);
        const right = this.evaluateExpression(expr.right);
        return this.composePrimitives(left, right);

      case 'ggl-reference':
        if (this.bindings.has(expr.name)) {
          return this.bindings.get(expr.name);
        }
        throw new Error(`Undefined reference: ${expr.name}`);

      default:
        return expr;
    }
  }

  createPrimitive(expr) {
    const { primitiveType, glyph, params } = expr;

    const primitive = {
      glyph,
      type: primitiveType,
      ...params
    };

    // Calculate bounding box
    primitive.bounds = this.calculateBounds(primitive);

    return primitive;
  }

  executeOperation(expr) {
    const operands = expr.operands.map(op => this.evaluateExpression(op));

    switch (expr.operation) {
      case 'union':
        return this.unionPrimitives(operands);
      case 'intersection':
        return this.intersectPrimitives(operands);
      case 'difference':
        return this.differencePrimitives(operands);
      case 'xor':
        return this.xorPrimitives(operands);
      case 'blend':
        return this.blendPrimitives(operands);
      case 'morph':
        return this.morphPrimitives(operands);
      default:
        return operands[0];
    }
  }

  executeTransform(expr) {
    const target = this.evaluateExpression(expr.target);
    const { transform, params } = expr;

    switch (transform) {
      case 'translate':
        return this.translatePrimitive(target, params);
      case 'rotate':
        return this.rotatePrimitive(target, params);
      case 'scale':
        return this.scalePrimitive(target, params);
      default:
        return target;
    }
  }

  // Geometric operations
  unionPrimitives(operands) {
    return {
      type: 'compound',
      operation: 'union',
      glyph: '∪',
      children: operands,
      bounds: this.unionBounds(operands.map(o => o.bounds))
    };
  }

  intersectPrimitives(operands) {
    return {
      type: 'compound',
      operation: 'intersection',
      glyph: '∩',
      children: operands,
      bounds: this.intersectBounds(operands.map(o => o.bounds))
    };
  }

  differencePrimitives(operands) {
    return {
      type: 'compound',
      operation: 'difference',
      glyph: '∖',
      children: operands,
      bounds: operands[0]?.bounds
    };
  }

  xorPrimitives(operands) {
    return {
      type: 'compound',
      operation: 'xor',
      glyph: '⊕',
      children: operands,
      bounds: this.unionBounds(operands.map(o => o.bounds))
    };
  }

  blendPrimitives(operands, factor = 0.5) {
    return {
      type: 'compound',
      operation: 'blend',
      glyph: '⊗',
      children: operands,
      blendFactor: factor,
      bounds: this.unionBounds(operands.map(o => o.bounds))
    };
  }

  morphPrimitives(operands, t = 0.5) {
    return {
      type: 'compound',
      operation: 'morph',
      glyph: '⟿',
      children: operands,
      morphT: t,
      bounds: this.unionBounds(operands.map(o => o.bounds))
    };
  }

  // Transforms
  translatePrimitive(primitive, params) {
    const dx = params.x || 0;
    const dy = params.y || 0;

    const translated = { ...primitive };

    if (translated.center) {
      translated.center = {
        x: translated.center.x + dx,
        y: translated.center.y + dy
      };
    }
    if (translated.position) {
      translated.position = {
        x: translated.position.x + dx,
        y: translated.position.y + dy
      };
    }
    if (translated.start && translated.end) {
      translated.start = { x: translated.start.x + dx, y: translated.start.y + dy };
      translated.end = { x: translated.end.x + dx, y: translated.end.y + dy };
    }
    if (translated.vertices) {
      translated.vertices = translated.vertices.map(v => ({
        x: v.x + dx,
        y: v.y + dy
      }));
    }

    translated.bounds = this.calculateBounds(translated);
    return translated;
  }

  rotatePrimitive(primitive, params) {
    const angle = params.angle || params.x || 0; // radians
    const cx = params.cx || 0;
    const cy = params.cy || 0;

    const rotated = { ...primitive };

    const rotate = (p) => ({
      x: Math.cos(angle) * (p.x - cx) - Math.sin(angle) * (p.y - cy) + cx,
      y: Math.sin(angle) * (p.x - cx) + Math.cos(angle) * (p.y - cy) + cy
    });

    if (rotated.center) {
      rotated.center = rotate(rotated.center);
    }
    if (rotated.position) {
      rotated.position = rotate(rotated.position);
    }
    if (rotated.start && rotated.end) {
      rotated.start = rotate(rotated.start);
      rotated.end = rotate(rotated.end);
    }
    if (rotated.vertices) {
      rotated.vertices = rotated.vertices.map(rotate);
    }

    rotated.rotation = (rotated.rotation || 0) + angle;
    rotated.bounds = this.calculateBounds(rotated);
    return rotated;
  }

  scalePrimitive(primitive, params) {
    const sx = params.x || params.scale || 1;
    const sy = params.y || sx;

    const scaled = { ...primitive };

    if (scaled.radius) {
      scaled.radius *= sx;
    }
    if (scaled.size) {
      scaled.size *= sx;
    }
    if (scaled.vertices) {
      scaled.vertices = scaled.vertices.map(v => ({
        x: v.x * sx,
        y: v.y * sy
      }));
    }

    scaled.bounds = this.calculateBounds(scaled);
    return scaled;
  }

  composePrimitives(left, right) {
    return {
      type: 'composition',
      glyph: '|',
      children: [left, right],
      bounds: this.unionBounds([left.bounds, right.bounds].filter(Boolean))
    };
  }

  // Bounds calculation
  calculateBounds(primitive) {
    switch (primitive.type) {
      case 'circle':
        return {
          minX: primitive.center.x - primitive.radius,
          minY: primitive.center.y - primitive.radius,
          maxX: primitive.center.x + primitive.radius,
          maxY: primitive.center.y + primitive.radius
        };
      case 'square':
        const half = primitive.size / 2;
        return {
          minX: primitive.center.x - half,
          minY: primitive.center.y - half,
          maxX: primitive.center.x + half,
          maxY: primitive.center.y + half
        };
      case 'triangle':
      case 'polygon':
        const xs = primitive.vertices.map(v => v.x);
        const ys = primitive.vertices.map(v => v.y);
        return {
          minX: Math.min(...xs),
          minY: Math.min(...ys),
          maxX: Math.max(...xs),
          maxY: Math.max(...ys)
        };
      case 'line':
        return {
          minX: Math.min(primitive.start.x, primitive.end.x),
          minY: Math.min(primitive.start.y, primitive.end.y),
          maxX: Math.max(primitive.start.x, primitive.end.x),
          maxY: Math.max(primitive.start.y, primitive.end.y)
        };
      case 'point':
        return {
          minX: primitive.position.x,
          minY: primitive.position.y,
          maxX: primitive.position.x,
          maxY: primitive.position.y
        };
      default:
        return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
  }

  unionBounds(boundsList) {
    if (boundsList.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    return {
      minX: Math.min(...boundsList.map(b => b.minX)),
      minY: Math.min(...boundsList.map(b => b.minY)),
      maxX: Math.max(...boundsList.map(b => b.maxX)),
      maxY: Math.max(...boundsList.map(b => b.maxY))
    };
  }

  intersectBounds(boundsList) {
    if (boundsList.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    return {
      minX: Math.max(...boundsList.map(b => b.minX)),
      minY: Math.max(...boundsList.map(b => b.minY)),
      maxX: Math.min(...boundsList.map(b => b.maxX)),
      maxY: Math.min(...boundsList.map(b => b.maxY))
    };
  }
}

// ============================================================================
// TOKENIZER (for AI training)
// ============================================================================

class GGLTokenizer {
  constructor(config = {}) {
    this.config = {
      numCoordinateBins: config.numCoordinateBins || 256,
      coordinateRange: config.coordinateRange || { min: -100, max: 100 },
      maxSequenceLength: config.maxSequenceLength || 2048,
      ...config
    };

    this.vocabulary = this.buildVocabulary();
  }

  buildVocabulary() {
    const vocab = {
      // Special tokens
      '[PAD]': 0,
      '[BOS]': 1,
      '[EOS]': 2,
      '[UNK]': 3,

      // Primitive glyphs (10-19)
      '◯': 10,
      '□': 11,
      '△': 12,
      '─': 13,
      '•': 14,
      '⬡': 15,
      '∿': 16,
      '⌒': 17,

      // Operation glyphs (20-29)
      '∪': 20,
      '∩': 21,
      '∖': 22,
      '⊕': 23,
      '⊗': 24,
      '⟿': 25,

      // Transform glyphs (30-39)
      '→': 30,
      '↻': 31,
      '⇔': 32,

      // Structure tokens (40-49)
      '(': 40,
      ')': 41,
      '[': 42,
      ']': 43,
      '{': 44,
      '}': 45,
      ',': 46,
      ';': 47,
      ':': 48,
      '|': 49,

      // Coordinate tokens start at 100
      // Range: 100 to 100 + numCoordinateBins - 1
    };

    // Add coordinate bin tokens
    for (let i = 0; i < this.config.numCoordinateBins; i++) {
      vocab[`COORD_${i}`] = 100 + i;
    }

    return vocab;
  }

  tokenize(source) {
    const lexer = new GGLLexer(source);
    const tokens = lexer.tokenize();

    const ids = [this.vocabulary['[BOS]']];
    const tokenTypes = ['SPECIAL_BOS'];

    for (const token of tokens) {
      if (token.type === 'EOF') break;

      if (token.glyph && this.vocabulary[token.glyph] !== undefined) {
        ids.push(this.vocabulary[token.glyph]);
        tokenTypes.push(token.type);
      } else if (token.type === 'NUMBER') {
        const binId = this.quantizeCoordinate(token.value);
        ids.push(100 + binId);
        tokenTypes.push('COORDINATE');
      } else if (token.type === 'DELIMITER' && this.vocabulary[token.value] !== undefined) {
        ids.push(this.vocabulary[token.value]);
        tokenTypes.push('DELIMITER');
      }
    }

    ids.push(this.vocabulary['[EOS]']);
    tokenTypes.push('SPECIAL_EOS');

    // Pad to max length
    while (ids.length < this.config.maxSequenceLength) {
      ids.push(this.vocabulary['[PAD]']);
      tokenTypes.push('SPECIAL_PAD');
    }

    return {
      tokens: ids.slice(0, this.config.maxSequenceLength),
      tokenTypes: tokenTypes.slice(0, this.config.maxSequenceLength),
      attentionMask: ids.slice(0, this.config.maxSequenceLength).map(id => id === 0 ? 0 : 1)
    };
  }

  quantizeCoordinate(value) {
    const { min, max } = this.config.coordinateRange;
    const clamped = Math.max(min, Math.min(max, value));
    const normalized = (clamped - min) / (max - min);
    return Math.floor(normalized * (this.config.numCoordinateBins - 1));
  }

  dequantizeCoordinate(bin) {
    const { min, max } = this.config.coordinateRange;
    const normalized = bin / (this.config.numCoordinateBins - 1);
    return min + normalized * (max - min);
  }

  decode(tokenIds) {
    const reverseVocab = {};
    for (const [key, val] of Object.entries(this.vocabulary)) {
      reverseVocab[val] = key;
    }

    return tokenIds.map(id => {
      if (id >= 100 && id < 100 + this.config.numCoordinateBins) {
        return this.dequantizeCoordinate(id - 100).toFixed(2);
      }
      return reverseVocab[id] || '[UNK]';
    }).filter(t => !t.startsWith('[') || t === '[UNK]').join(' ');
  }
}

// ============================================================================
// FOURIER EMBEDDING
// ============================================================================

class GGLFourierEncoder {
  constructor(numDescriptors = 32) {
    this.numDescriptors = numDescriptors;
  }

  encodeShape(points) {
    if (points.length < 2) {
      return new Array(this.numDescriptors * 2).fill(0);
    }

    // Convert to complex numbers (x + iy)
    const n = points.length;
    const coefficients = [];

    for (let k = 0; k < this.numDescriptors; k++) {
      let real = 0;
      let imag = 0;

      for (let j = 0; j < n; j++) {
        const angle = -2 * Math.PI * k * j / n;
        real += points[j].x * Math.cos(angle) - points[j].y * Math.sin(angle);
        imag += points[j].x * Math.sin(angle) + points[j].y * Math.cos(angle);
      }

      coefficients.push(real / n);
      coefficients.push(imag / n);
    }

    return coefficients;
  }

  encodePrimitive(primitive) {
    const points = this.primitiveToPoints(primitive);
    return this.encodeShape(points);
  }

  primitiveToPoints(primitive, numSamples = 64) {
    const points = [];

    switch (primitive.type) {
      case 'circle':
        for (let i = 0; i < numSamples; i++) {
          const angle = 2 * Math.PI * i / numSamples;
          points.push({
            x: primitive.center.x + primitive.radius * Math.cos(angle),
            y: primitive.center.y + primitive.radius * Math.sin(angle)
          });
        }
        break;

      case 'square':
        const half = primitive.size / 2;
        const cx = primitive.center.x;
        const cy = primitive.center.y;
        // Sample along edges
        const edgeSamples = numSamples / 4;
        for (let i = 0; i < edgeSamples; i++) {
          const t = i / edgeSamples;
          points.push({ x: cx - half + t * primitive.size, y: cy - half }); // Bottom
        }
        for (let i = 0; i < edgeSamples; i++) {
          const t = i / edgeSamples;
          points.push({ x: cx + half, y: cy - half + t * primitive.size }); // Right
        }
        for (let i = 0; i < edgeSamples; i++) {
          const t = i / edgeSamples;
          points.push({ x: cx + half - t * primitive.size, y: cy + half }); // Top
        }
        for (let i = 0; i < edgeSamples; i++) {
          const t = i / edgeSamples;
          points.push({ x: cx - half, y: cy + half - t * primitive.size }); // Left
        }
        break;

      case 'triangle':
        if (primitive.vertices) {
          const v = primitive.vertices;
          const edgeSamples = Math.floor(numSamples / 3);
          for (let e = 0; e < 3; e++) {
            const v1 = v[e];
            const v2 = v[(e + 1) % 3];
            for (let i = 0; i < edgeSamples; i++) {
              const t = i / edgeSamples;
              points.push({
                x: v1.x + t * (v2.x - v1.x),
                y: v1.y + t * (v2.y - v1.y)
              });
            }
          }
        }
        break;

      case 'line':
        for (let i = 0; i < numSamples; i++) {
          const t = i / (numSamples - 1);
          points.push({
            x: primitive.start.x + t * (primitive.end.x - primitive.start.x),
            y: primitive.start.y + t * (primitive.end.y - primitive.start.y)
          });
        }
        break;

      case 'point':
        points.push(primitive.position);
        break;

      case 'polygon':
        if (primitive.vertices) {
          const n = primitive.vertices.length;
          const edgeSamples = Math.floor(numSamples / n);
          for (let e = 0; e < n; e++) {
            const v1 = primitive.vertices[e];
            const v2 = primitive.vertices[(e + 1) % n];
            for (let i = 0; i < edgeSamples; i++) {
              const t = i / edgeSamples;
              points.push({
                x: v1.x + t * (v2.x - v1.x),
                y: v1.y + t * (v2.y - v1.y)
              });
            }
          }
        }
        break;
    }

    return points;
  }

  normalizeDescriptors(descriptors) {
    // Normalize by DC component (first coefficient) for scale/position invariance
    const dcMag = Math.sqrt(descriptors[0] ** 2 + descriptors[1] ** 2);
    if (dcMag === 0) return descriptors;

    return descriptors.map((d, i) => {
      if (i < 2) return 0; // Zero out DC
      return d / dcMag;
    });
  }
}

// ============================================================================
// SVG RENDERER
// ============================================================================

class GGLSVGRenderer {
  constructor(width = 200, height = 200) {
    this.width = width;
    this.height = height;
    this.scale = Math.min(width, height) / 200;
    this.centerX = width / 2;
    this.centerY = height / 2;
  }

  render(result) {
    const elements = [];

    for (const primitive of result.results) {
      elements.push(this.renderPrimitive(primitive));
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">
  <g transform="translate(${this.centerX}, ${this.centerY}) scale(${this.scale}, -${this.scale})">
    ${elements.join('\n    ')}
  </g>
</svg>`;
  }

  renderPrimitive(primitive) {
    const fill = primitive.fill || 'none';
    const stroke = primitive.stroke || '#000';
    const strokeWidth = primitive.strokeWidth || 1;

    switch (primitive.type) {
      case 'circle':
        return `<circle cx="${primitive.center.x}" cy="${primitive.center.y}" r="${primitive.radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;

      case 'square':
        const half = primitive.size / 2;
        return `<rect x="${primitive.center.x - half}" y="${primitive.center.y - half}" width="${primitive.size}" height="${primitive.size}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;

      case 'triangle':
      case 'polygon':
        const points = primitive.vertices.map(v => `${v.x},${v.y}`).join(' ');
        return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;

      case 'line':
        return `<line x1="${primitive.start.x}" y1="${primitive.start.y}" x2="${primitive.end.x}" y2="${primitive.end.y}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;

      case 'point':
        const size = primitive.size || 2;
        return `<circle cx="${primitive.position.x}" cy="${primitive.position.y}" r="${size}" fill="${primitive.fill || '#000'}"/>`;

      case 'compound':
      case 'composition':
        return primitive.children.map(c => this.renderPrimitive(c)).join('\n');

      default:
        return '';
    }
  }
}

// ============================================================================
// GGL RUNTIME (Main Entry Point)
// ============================================================================

class GGLRuntime {
  constructor() {
    this.executor = new GGLExecutor();
    this.tokenizer = new GGLTokenizer();
    this.fourierEncoder = new GGLFourierEncoder();
    this.svgRenderer = new GGLSVGRenderer();
  }

  parse(source) {
    const lexer = new GGLLexer(source);
    const tokens = lexer.tokenize();
    const parser = new GGLParser(tokens);
    return parser.parse();
  }

  execute(source) {
    const program = typeof source === 'string' ? this.parse(source) : source;
    return this.executor.execute(program);
  }

  tokenize(source) {
    return this.tokenizer.tokenize(source);
  }

  embed(source) {
    const result = this.execute(source);
    const embeddings = [];

    for (const primitive of result.results) {
      if (primitive.type !== 'compound' && primitive.type !== 'composition') {
        embeddings.push({
          primitive: primitive.type,
          glyph: primitive.glyph,
          fourier: this.fourierEncoder.encodePrimitive(primitive),
          normalized: this.fourierEncoder.normalizeDescriptors(
            this.fourierEncoder.encodePrimitive(primitive)
          )
        });
      }
    }

    return embeddings;
  }

  toSVG(source) {
    const result = this.execute(source);
    return this.svgRenderer.render(result);
  }

  toTrainingExample(source, description) {
    return {
      id: `ggl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      input: {
        type: 'text',
        content: description
      },
      output: {
        type: 'ggl',
        program: this.parse(source),
        tokens: this.tokenize(source)
      },
      metadata: {
        task: 'text2ggl',
        source: 'ggl-runtime'
      }
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GGLRuntime,
    GGLLexer,
    GGLParser,
    GGLExecutor,
    GGLTokenizer,
    GGLFourierEncoder,
    GGLSVGRenderer,
    GGL_GLYPHS
  };
}

if (typeof window !== 'undefined') {
  window.GGL = {
    Runtime: GGLRuntime,
    Lexer: GGLLexer,
    Parser: GGLParser,
    Executor: GGLExecutor,
    Tokenizer: GGLTokenizer,
    FourierEncoder: GGLFourierEncoder,
    SVGRenderer: GGLSVGRenderer,
    GLYPHS: GGL_GLYPHS
  };
}
