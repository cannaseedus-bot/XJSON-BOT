/**
 * KPI - KUHUL Payload Interface
 * Binary encoder/decoder for KUHUL-ES AST
 *
 * @version 1.0.0
 * @status frozen
 * @authority @kuhul/es
 *
 * Layout:
 * [KPI Header 64 bytes] [Section Directory] [Sections...] [Footer]
 *
 * Sections: STR0, AST0, ROOT, SRC0, MAP0, TRC0, SIG0
 */

// ============================================================
// VarUInt (LEB128) Encoding
// ============================================================

const VarUInt = {
  /**
   * Encode unsigned integer as LEB128
   */
  encode(value) {
    if (value < 0) throw new Error('VarUInt requires non-negative value');
    const bytes = [];
    do {
      let byte = value & 0x7F;
      value >>>= 7;
      if (value !== 0) byte |= 0x80;
      bytes.push(byte);
    } while (value !== 0);
    return new Uint8Array(bytes);
  },

  /**
   * Decode LEB128 to unsigned integer
   */
  decode(buffer, offset = 0) {
    let result = 0;
    let shift = 0;
    let bytesRead = 0;

    while (true) {
      if (offset + bytesRead >= buffer.length) {
        throw new Error('VarUInt: unexpected end of buffer');
      }
      const byte = buffer[offset + bytesRead];
      bytesRead++;
      result |= (byte & 0x7F) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
      if (shift > 35) throw new Error('VarUInt: overflow');
    }

    return { value: result >>> 0, bytesRead };
  },

  /**
   * Calculate encoded size
   */
  size(value) {
    if (value === 0) return 1;
    let size = 0;
    while (value > 0) {
      size++;
      value >>>= 7;
    }
    return size;
  }
};

// ============================================================
// KPI Constants
// ============================================================

const KPI_MAGIC = new Uint8Array([0x4B, 0x50, 0x49, 0x31]); // "KPI1"
const KPI_VERSION_MAJOR = 1;
const KPI_VERSION_MINOR = 0;
const KPI_HEADER_SIZE = 64;

const SECTION_TAGS = {
  STR0: new Uint8Array([0x53, 0x54, 0x52, 0x30]), // String table
  AST0: new Uint8Array([0x41, 0x53, 0x54, 0x30]), // AST nodes
  ROOT: new Uint8Array([0x52, 0x4F, 0x4F, 0x54]), // Root pointer
  SRC0: new Uint8Array([0x53, 0x52, 0x43, 0x30]), // Source
  MAP0: new Uint8Array([0x4D, 0x41, 0x50, 0x30]), // Source map
  TRC0: new Uint8Array([0x54, 0x52, 0x43, 0x30]), // Trace
  SIG0: new Uint8Array([0x53, 0x49, 0x47, 0x30])  // Signature
};

const VALUE_KIND = {
  Null: 0,
  Bool: 1,
  VarUInt: 2,
  S64: 3,
  F64: 4,
  StringRef: 5,
  NodeRef: 6,
  Array: 7,
  ObjectPairs: 8
};

const FLAGS = {
  HAS_SIG0: 1 << 0,
  HAS_SRC0: 1 << 1,
  HAS_MAP0: 1 << 2,
  HAS_TRC0: 1 << 3
};

// ============================================================
// String Table Builder
// ============================================================

class StringTable {
  constructor() {
    this.strings = new Map(); // string -> index
    this.list = [''];          // index 0 = empty string
    this.strings.set('', 0);
  }

  /**
   * Intern a string, return its index
   */
  intern(str) {
    if (str === null || str === undefined) str = '';
    str = String(str);

    if (this.strings.has(str)) {
      return this.strings.get(str);
    }

    const index = this.list.length;
    this.list.push(str);
    this.strings.set(str, index);
    return index;
  }

  /**
   * Get string by index
   */
  get(index) {
    return this.list[index] || '';
  }

  /**
   * Build canonical string table (sorted by UTF-8 bytes)
   */
  canonicalize() {
    // Sort strings (excluding empty at index 0)
    const sorted = this.list.slice(1).sort((a, b) => {
      const bufA = new TextEncoder().encode(a);
      const bufB = new TextEncoder().encode(b);
      for (let i = 0; i < Math.min(bufA.length, bufB.length); i++) {
        if (bufA[i] !== bufB[i]) return bufA[i] - bufB[i];
      }
      return bufA.length - bufB.length;
    });

    // Rebuild with canonical ordering
    this.list = ['', ...sorted];
    this.strings.clear();
    this.strings.set('', 0);
    sorted.forEach((s, i) => this.strings.set(s, i + 1));
  }

  /**
   * Encode to STR0 section bytes
   */
  encode() {
    const encoder = new TextEncoder();
    const strCount = this.list.length;

    // Calculate total bytes for strings (with null terminators)
    const blobs = this.list.map(s => encoder.encode(s));
    const totalBytes = blobs.reduce((sum, b) => sum + b.length + 1, 0);

    // Build section
    const parts = [];

    // u32 str_count
    parts.push(new Uint8Array(new Uint32Array([strCount]).buffer));

    // u32 bytes_len
    parts.push(new Uint8Array(new Uint32Array([totalBytes]).buffer));

    // Concatenated strings with null terminators
    const stringBlob = new Uint8Array(totalBytes);
    let offset = 0;
    for (const blob of blobs) {
      stringBlob.set(blob, offset);
      offset += blob.length;
      stringBlob[offset] = 0; // null terminator
      offset++;
    }
    parts.push(stringBlob);

    // u32 offsets array
    const offsets = new Uint32Array(strCount);
    offset = 0;
    for (let i = 0; i < strCount; i++) {
      offsets[i] = offset;
      offset += blobs[i].length + 1;
    }
    parts.push(new Uint8Array(offsets.buffer));

    return concatBuffers(parts);
  }

  /**
   * Decode from STR0 section bytes
   */
  static decode(buffer) {
    const table = new StringTable();
    table.strings.clear();
    table.list = [];

    const view = new DataView(buffer.buffer, buffer.byteOffset);
    const strCount = view.getUint32(0, true);
    const bytesLen = view.getUint32(4, true);

    const decoder = new TextDecoder();
    const stringBlob = buffer.slice(8, 8 + bytesLen);
    const offsetsStart = 8 + bytesLen;

    for (let i = 0; i < strCount; i++) {
      const offset = view.getUint32(offsetsStart + i * 4, true);
      let end = offset;
      while (stringBlob[end] !== 0 && end < stringBlob.length) end++;
      const str = decoder.decode(stringBlob.slice(offset, end));
      table.list.push(str);
      table.strings.set(str, i);
    }

    return table;
  }
}

// ============================================================
// AST Node Encoder
// ============================================================

class NodeTable {
  constructor(stringTable) {
    this.stringTable = stringTable;
    this.nodes = [];
    this.nodeIndex = new Map(); // node object -> index
  }

  /**
   * Add node, return its index
   */
  addNode(node) {
    if (this.nodeIndex.has(node)) {
      return this.nodeIndex.get(node);
    }

    const index = this.nodes.length;
    this.nodeIndex.set(node, index);
    this.nodes.push(node);
    return index;
  }

  /**
   * Traverse AST in canonical preorder
   */
  traverse(node) {
    if (!node || typeof node !== 'object') return;

    // Add this node
    this.addNode(node);

    // Get fields in lexicographic order
    const fields = Object.keys(node)
      .filter(k => k !== 'type' && k !== 'loc')
      .sort();

    for (const field of fields) {
      const value = node[field];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === 'object' && item.type) {
            this.traverse(item);
          }
        }
      } else if (value && typeof value === 'object' && value.type) {
        this.traverse(value);
      }
    }
  }

  /**
   * Encode value to bytes
   */
  encodeValue(value) {
    const parts = [];

    if (value === null || value === undefined) {
      parts.push(new Uint8Array([VALUE_KIND.Null]));
    } else if (typeof value === 'boolean') {
      parts.push(new Uint8Array([VALUE_KIND.Bool, value ? 1 : 0]));
    } else if (typeof value === 'number') {
      if (Number.isInteger(value) && value >= 0 && value < 2147483648) {
        parts.push(new Uint8Array([VALUE_KIND.VarUInt]));
        parts.push(VarUInt.encode(value));
      } else {
        parts.push(new Uint8Array([VALUE_KIND.F64]));
        const f64 = new Float64Array([value]);
        parts.push(new Uint8Array(f64.buffer));
      }
    } else if (typeof value === 'string') {
      parts.push(new Uint8Array([VALUE_KIND.StringRef]));
      parts.push(VarUInt.encode(this.stringTable.intern(value)));
    } else if (Array.isArray(value)) {
      parts.push(new Uint8Array([VALUE_KIND.Array]));
      parts.push(VarUInt.encode(value.length));
      for (const item of value) {
        parts.push(this.encodeValue(item));
      }
    } else if (typeof value === 'object') {
      if (value.type) {
        // Node reference
        parts.push(new Uint8Array([VALUE_KIND.NodeRef]));
        const nodeIdx = this.nodeIndex.get(value);
        if (nodeIdx === undefined) {
          throw new Error(`Node not indexed: ${value.type}`);
        }
        parts.push(VarUInt.encode(nodeIdx));
      } else {
        // Object pairs
        parts.push(new Uint8Array([VALUE_KIND.ObjectPairs]));
        const keys = Object.keys(value).sort();
        parts.push(VarUInt.encode(keys.length));
        for (const key of keys) {
          parts.push(VarUInt.encode(this.stringTable.intern(key)));
          parts.push(this.encodeValue(value[key]));
        }
      }
    } else {
      throw new Error(`Cannot encode value: ${typeof value}`);
    }

    return concatBuffers(parts);
  }

  /**
   * Encode node record
   */
  encodeNode(node) {
    const parts = [];

    // node_type_id
    const typeIdx = this.stringTable.intern(node.type);
    parts.push(VarUInt.encode(typeIdx));

    // Get fields (exclude type, loc)
    const fields = Object.keys(node)
      .filter(k => k !== 'type' && k !== 'loc')
      .sort();

    // field_count
    parts.push(VarUInt.encode(fields.length));

    // fields
    for (const field of fields) {
      // field_name_id
      parts.push(VarUInt.encode(this.stringTable.intern(field)));
      // value
      parts.push(this.encodeValue(node[field]));
    }

    return concatBuffers(parts);
  }

  /**
   * Encode entire AST0 section
   */
  encode() {
    const parts = [];

    // u32 node_count
    parts.push(new Uint8Array(new Uint32Array([this.nodes.length]).buffer));

    // nodes
    for (const node of this.nodes) {
      parts.push(this.encodeNode(node));
    }

    return concatBuffers(parts);
  }
}

// ============================================================
// KPI Encoder
// ============================================================

class KPIEncoder {
  constructor() {
    this.stringTable = new StringTable();
    this.nodeTable = null;
    this.rootIndex = 0;
    this.source = null;
    this.sourceLocs = null;
    this.trace = null;
    this.signature = null;
  }

  /**
   * Encode AST to KPI binary
   */
  async encode(ast, options = {}) {
    // Reset state
    this.stringTable = new StringTable();
    this.nodeTable = new NodeTable(this.stringTable);

    // Collect strings from AST
    this.collectStrings(ast);

    // Canonicalize string table
    this.stringTable.canonicalize();

    // Traverse AST in canonical order
    this.nodeTable.traverse(ast);
    this.rootIndex = 0; // Root is first node

    // Options
    if (options.source) {
      this.source = options.source;
    }
    if (options.sourceLocs) {
      this.sourceLocs = options.sourceLocs;
    }
    if (options.trace) {
      this.trace = options.trace;
    }

    // Build sections
    const sections = [];

    // STR0 - String table (required)
    const str0 = this.stringTable.encode();
    sections.push({ tag: 'STR0', data: str0 });

    // AST0 - Node table (required)
    const ast0 = this.nodeTable.encode();
    sections.push({ tag: 'AST0', data: ast0 });

    // ROOT - Root pointer (required)
    const root = VarUInt.encode(this.rootIndex);
    sections.push({ tag: 'ROOT', data: root });

    // SRC0 - Source (optional)
    if (this.source) {
      sections.push({ tag: 'SRC0', data: this.encodeSource() });
    }

    // MAP0 - Source locations (optional)
    if (this.sourceLocs) {
      sections.push({ tag: 'MAP0', data: this.encodeSourceMap() });
    }

    // TRC0 - Trace (optional)
    if (this.trace) {
      sections.push({ tag: 'TRC0', data: this.encodeTrace() });
    }

    // Sort sections by tag (lexicographic)
    sections.sort((a, b) => a.tag.localeCompare(b.tag));

    // Build section directory
    const dir = this.buildDirectory(sections);

    // Calculate payload
    const payload = this.buildPayload(dir, sections);

    // Compute hash
    const hash = await this.computeHash(payload);

    // Build header
    const header = this.buildHeader(payload.length, hash, KPI_HEADER_SIZE);

    // Combine
    return concatBuffers([header, payload]);
  }

  /**
   * Collect all strings from AST
   */
  collectStrings(node) {
    if (!node || typeof node !== 'object') return;

    // Intern node type
    if (node.type) {
      this.stringTable.intern(node.type);
    }

    // Traverse all fields
    for (const [key, value] of Object.entries(node)) {
      this.stringTable.intern(key);

      if (typeof value === 'string') {
        this.stringTable.intern(value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          this.collectStrings(item);
        }
      } else if (typeof value === 'object' && value !== null) {
        this.collectStrings(value);
      }
    }
  }

  /**
   * Encode source section
   */
  encodeSource() {
    if (typeof this.source === 'string') {
      // Inline source
      const encoder = new TextEncoder();
      const bytes = encoder.encode(this.source);
      const result = new Uint8Array(1 + VarUInt.size(bytes.length) + bytes.length);
      result[0] = 1; // mode = inline
      const lenEnc = VarUInt.encode(bytes.length);
      result.set(lenEnc, 1);
      result.set(bytes, 1 + lenEnc.length);
      return result;
    } else {
      // Hash only
      return new Uint8Array([0, 1, ...this.source]);
    }
  }

  /**
   * Encode source map section
   */
  encodeSourceMap() {
    const parts = [];
    const count = this.sourceLocs.length;
    parts.push(new Uint8Array(new Uint32Array([count]).buffer));

    for (const loc of this.sourceLocs) {
      parts.push(VarUInt.encode(loc.nodeIndex));
      parts.push(VarUInt.encode(loc.startLine));
      parts.push(VarUInt.encode(loc.startCol));
      parts.push(VarUInt.encode(loc.startOff));
      parts.push(VarUInt.encode(loc.endLine));
      parts.push(VarUInt.encode(loc.endCol));
      parts.push(VarUInt.encode(loc.endOff));
    }

    return concatBuffers(parts);
  }

  /**
   * Encode trace section
   */
  encodeTrace() {
    const parts = [];
    const count = this.trace.events.length;
    parts.push(new Uint8Array(new Uint32Array([count]).buffer));

    for (const event of this.trace.events) {
      const typeIdx = this.stringTable.intern(event.type);
      parts.push(VarUInt.encode(typeIdx));
      parts.push(VarUInt.encode(event.timestamp));
      parts.push(VarUInt.encode(event.args.length));
      for (const arg of event.args) {
        parts.push(this.nodeTable.encodeValue(arg));
      }
    }

    return concatBuffers(parts);
  }

  /**
   * Build section directory
   */
  buildDirectory(sections) {
    const parts = [];

    // section_count
    parts.push(VarUInt.encode(sections.length));

    // Calculate offsets (after directory)
    let dirSize = VarUInt.size(sections.length);
    for (const s of sections) {
      dirSize += 4 + 4 + 4 + 4; // tag + offset + length + crc32
    }

    let currentOffset = dirSize;

    for (const section of sections) {
      // tag[4]
      parts.push(SECTION_TAGS[section.tag]);

      // u32 offset
      parts.push(new Uint8Array(new Uint32Array([currentOffset]).buffer));

      // u32 length
      parts.push(new Uint8Array(new Uint32Array([section.data.length]).buffer));

      // u32 crc32 (0 = unused)
      parts.push(new Uint8Array(new Uint32Array([0]).buffer));

      currentOffset += section.data.length;
    }

    return concatBuffers(parts);
  }

  /**
   * Build payload (directory + sections)
   */
  buildPayload(dir, sections) {
    const parts = [dir];
    for (const section of sections) {
      parts.push(section.data);
    }
    return concatBuffers(parts);
  }

  /**
   * Compute SHA-256 hash
   */
  async computeHash(payload) {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', payload);
      return new Uint8Array(hashBuffer);
    } else {
      // Fallback: simple checksum (not cryptographic)
      const hash = new Uint8Array(32);
      for (let i = 0; i < payload.length; i++) {
        hash[i % 32] ^= payload[i];
      }
      return hash;
    }
  }

  /**
   * Build 64-byte header
   */
  buildHeader(payloadLen, hash, dirOffset) {
    const header = new Uint8Array(KPI_HEADER_SIZE);
    const view = new DataView(header.buffer);

    // magic "KPI1"
    header.set(KPI_MAGIC, 0);

    // version_major (u16)
    view.setUint16(4, KPI_VERSION_MAJOR, true);

    // version_minor (u16)
    view.setUint16(6, KPI_VERSION_MINOR, true);

    // flags (u32)
    let flags = 0;
    if (this.source) flags |= FLAGS.HAS_SRC0;
    if (this.sourceLocs) flags |= FLAGS.HAS_MAP0;
    if (this.trace) flags |= FLAGS.HAS_TRC0;
    if (this.signature) flags |= FLAGS.HAS_SIG0;
    view.setUint32(8, flags, true);

    // created_epoch_ms (u64)
    const now = BigInt(Date.now());
    view.setBigUint64(12, now, true);

    // payload_len (u64)
    view.setBigUint64(20, BigInt(payloadLen), true);

    // payload_hash (32 bytes)
    header.set(hash, 28);

    // dir_offset (u32) - offset from start of file
    view.setUint32(60, dirOffset, true);

    return header;
  }
}

// ============================================================
// KPI Decoder
// ============================================================

class KPIDecoder {
  constructor() {
    this.stringTable = null;
    this.nodes = [];
    this.rootIndex = 0;
  }

  /**
   * Decode KPI binary to AST
   */
  async decode(buffer) {
    if (!(buffer instanceof Uint8Array)) {
      buffer = new Uint8Array(buffer);
    }

    // Verify header
    const header = this.decodeHeader(buffer);

    // Get directory
    const dir = this.decodeDirectory(buffer, header.dirOffset);

    // Decode sections
    for (const section of dir.sections) {
      const data = buffer.slice(
        header.dirOffset + section.offset,
        header.dirOffset + section.offset + section.length
      );

      switch (section.tag) {
        case 'STR0':
          this.stringTable = StringTable.decode(data);
          break;
        case 'AST0':
          this.decodeNodes(data);
          break;
        case 'ROOT':
          this.rootIndex = VarUInt.decode(data).value;
          break;
      }
    }

    // Reconstruct AST
    return this.reconstructAST();
  }

  /**
   * Decode header
   */
  decodeHeader(buffer) {
    const view = new DataView(buffer.buffer, buffer.byteOffset);

    // Verify magic
    const magic = String.fromCharCode(...buffer.slice(0, 4));
    if (magic !== 'KPI1') {
      throw new Error(`Invalid KPI magic: ${magic}`);
    }

    return {
      versionMajor: view.getUint16(4, true),
      versionMinor: view.getUint16(6, true),
      flags: view.getUint32(8, true),
      createdMs: view.getBigUint64(12, true),
      payloadLen: view.getBigUint64(20, true),
      payloadHash: buffer.slice(28, 60),
      dirOffset: view.getUint32(60, true)
    };
  }

  /**
   * Decode section directory
   */
  decodeDirectory(buffer, dirOffset) {
    let offset = dirOffset;
    const { value: sectionCount, bytesRead } = VarUInt.decode(buffer, offset);
    offset += bytesRead;

    const sections = [];
    for (let i = 0; i < sectionCount; i++) {
      const tag = String.fromCharCode(...buffer.slice(offset, offset + 4));
      offset += 4;

      const view = new DataView(buffer.buffer, buffer.byteOffset + offset);
      const sectionOffset = view.getUint32(0, true);
      const length = view.getUint32(4, true);
      const crc32 = view.getUint32(8, true);
      offset += 12;

      sections.push({ tag, offset: sectionOffset, length, crc32 });
    }

    return { sectionCount, sections };
  }

  /**
   * Decode AST0 nodes
   */
  decodeNodes(data) {
    const view = new DataView(data.buffer, data.byteOffset);
    const nodeCount = view.getUint32(0, true);
    let offset = 4;

    this.nodes = [];

    for (let i = 0; i < nodeCount; i++) {
      const { node, bytesRead } = this.decodeNode(data, offset);
      this.nodes.push(node);
      offset += bytesRead;
    }
  }

  /**
   * Decode single node
   */
  decodeNode(data, offset) {
    const startOffset = offset;

    // node_type_id
    const { value: typeIdx, bytesRead: typeBytes } = VarUInt.decode(data, offset);
    offset += typeBytes;
    const type = this.stringTable.get(typeIdx);

    // field_count
    const { value: fieldCount, bytesRead: countBytes } = VarUInt.decode(data, offset);
    offset += countBytes;

    const node = { type };

    // fields
    for (let i = 0; i < fieldCount; i++) {
      // field_name_id
      const { value: nameIdx, bytesRead: nameBytes } = VarUInt.decode(data, offset);
      offset += nameBytes;
      const name = this.stringTable.get(nameIdx);

      // value
      const { value, bytesRead: valueBytes } = this.decodeValue(data, offset);
      offset += valueBytes;

      node[name] = value;
    }

    return { node, bytesRead: offset - startOffset };
  }

  /**
   * Decode value
   */
  decodeValue(data, offset) {
    const startOffset = offset;
    const kind = data[offset];
    offset++;

    let value;

    switch (kind) {
      case VALUE_KIND.Null:
        value = null;
        break;

      case VALUE_KIND.Bool:
        value = data[offset] !== 0;
        offset++;
        break;

      case VALUE_KIND.VarUInt: {
        const { value: v, bytesRead } = VarUInt.decode(data, offset);
        value = v;
        offset += bytesRead;
        break;
      }

      case VALUE_KIND.F64: {
        const view = new DataView(data.buffer, data.byteOffset + offset);
        value = view.getFloat64(0, true);
        offset += 8;
        break;
      }

      case VALUE_KIND.StringRef: {
        const { value: idx, bytesRead } = VarUInt.decode(data, offset);
        value = this.stringTable.get(idx);
        offset += bytesRead;
        break;
      }

      case VALUE_KIND.NodeRef: {
        const { value: idx, bytesRead } = VarUInt.decode(data, offset);
        // Store as reference to be resolved later
        value = { __nodeRef: idx };
        offset += bytesRead;
        break;
      }

      case VALUE_KIND.Array: {
        const { value: len, bytesRead: lenBytes } = VarUInt.decode(data, offset);
        offset += lenBytes;
        value = [];
        for (let i = 0; i < len; i++) {
          const { value: item, bytesRead } = this.decodeValue(data, offset);
          value.push(item);
          offset += bytesRead;
        }
        break;
      }

      case VALUE_KIND.ObjectPairs: {
        const { value: len, bytesRead: lenBytes } = VarUInt.decode(data, offset);
        offset += lenBytes;
        value = {};
        for (let i = 0; i < len; i++) {
          const { value: keyIdx, bytesRead: keyBytes } = VarUInt.decode(data, offset);
          offset += keyBytes;
          const key = this.stringTable.get(keyIdx);
          const { value: val, bytesRead: valBytes } = this.decodeValue(data, offset);
          offset += valBytes;
          value[key] = val;
        }
        break;
      }

      default:
        throw new Error(`Unknown value kind: ${kind}`);
    }

    return { value, bytesRead: offset - startOffset };
  }

  /**
   * Reconstruct AST with resolved references
   */
  reconstructAST() {
    // Resolve all node references
    const resolve = (value) => {
      if (value === null || value === undefined) return value;

      if (typeof value === 'object' && value.__nodeRef !== undefined) {
        return this.nodes[value.__nodeRef];
      }

      if (Array.isArray(value)) {
        return value.map(resolve);
      }

      if (typeof value === 'object') {
        const resolved = {};
        for (const [k, v] of Object.entries(value)) {
          if (k !== '__nodeRef') {
            resolved[k] = resolve(v);
          }
        }
        return resolved;
      }

      return value;
    };

    // Resolve all nodes
    for (const node of this.nodes) {
      for (const [key, value] of Object.entries(node)) {
        if (key !== 'type') {
          node[key] = resolve(value);
        }
      }
    }

    return this.nodes[this.rootIndex];
  }
}

// ============================================================
// Utilities
// ============================================================

function concatBuffers(buffers) {
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }
  return result;
}

// ============================================================
// Exports
// ============================================================

const KPI = {
  Encoder: KPIEncoder,
  Decoder: KPIDecoder,
  StringTable,
  NodeTable,
  VarUInt,

  // Convenience functions
  async encode(ast, options = {}) {
    const encoder = new KPIEncoder();
    return encoder.encode(ast, options);
  },

  async decode(buffer) {
    const decoder = new KPIDecoder();
    return decoder.decode(buffer);
  },

  // Constants
  MAGIC: KPI_MAGIC,
  VERSION: { major: KPI_VERSION_MAJOR, minor: KPI_VERSION_MINOR },
  HEADER_SIZE: KPI_HEADER_SIZE,
  SECTION_TAGS,
  VALUE_KIND,
  FLAGS
};

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KPI;
}
if (typeof window !== 'undefined') {
  window.KPI = KPI;
}
if (typeof globalThis !== 'undefined') {
  globalThis.KPI = KPI;
}
