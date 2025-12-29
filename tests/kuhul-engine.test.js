/**
 * K'UHUL ENGINE TESTS
 * ===================
 * Unit tests for the K'UHUL execution engine
 */

// Simple test framework for browser
const TestRunner = {
  tests: [],
  passed: 0,
  failed: 0,

  describe(name, fn) {
    console.group(`📦 ${name}`);
    fn();
    console.groupEnd();
  },

  it(name, fn) {
    try {
      fn();
      this.passed++;
      console.log(`  ✅ ${name}`);
    } catch (error) {
      this.failed++;
      console.error(`  ❌ ${name}`);
      console.error(`     ${error.message}`);
    }
  },

  expect(value) {
    return {
      toBe(expected) {
        if (value !== expected) {
          throw new Error(`Expected ${expected} but got ${value}`);
        }
      },
      toEqual(expected) {
        if (JSON.stringify(value) !== JSON.stringify(expected)) {
          throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(value)}`);
        }
      },
      toBeTruthy() {
        if (!value) {
          throw new Error(`Expected truthy but got ${value}`);
        }
      },
      toBeFalsy() {
        if (value) {
          throw new Error(`Expected falsy but got ${value}`);
        }
      },
      toBeGreaterThan(expected) {
        if (value <= expected) {
          throw new Error(`Expected ${value} to be greater than ${expected}`);
        }
      },
      toContain(expected) {
        if (!value.includes(expected)) {
          throw new Error(`Expected ${value} to contain ${expected}`);
        }
      },
      toBeDefined() {
        if (value === undefined) {
          throw new Error('Expected value to be defined');
        }
      },
      toBeInstanceOf(expected) {
        if (!(value instanceof expected)) {
          throw new Error(`Expected instance of ${expected.name}`);
        }
      }
    };
  },

  summary() {
    console.log('\n📊 Test Summary:');
    console.log(`   Passed: ${this.passed}`);
    console.log(`   Failed: ${this.failed}`);
    console.log(`   Total: ${this.passed + this.failed}`);
    return this.failed === 0;
  }
};

// Shorthand
const { describe, it, expect } = TestRunner;

/* ============================================================
   K'UHUL ENGINE TESTS
   ============================================================ */

describe('K\'UHUL Core Kernel', () => {
  it('should have core data structures', () => {
    expect(K.p).toBeInstanceOf(Map);
    expect(K.w).toBeInstanceOf(Map);
    expect(K.g).toBeInstanceOf(Map);
    expect(K.o).toBeInstanceOf(Map);
    expect(K.m).toBeInstanceOf(Map);
  });

  it('should run basic operations', async () => {
    const result = await K.run('test_op', '⟁Basic⟁test⟁', { data: 'test' });
    expect(result).toBeDefined();
    expect(result.id).toBe('test_op');
  });

  it('should quantize weights correctly', () => {
    const weights = [0.5, -0.3, 0.8, -0.1, 0.0];
    const quantized = K.quantizeWeights(weights, 8);

    expect(quantized.bits).toBe(8);
    expect(quantized.originalSize).toBe(5);
    expect(quantized.data).toBeInstanceOf(Uint8Array);
    expect(quantized.scale).toBeDefined();
    expect(quantized.zeroPoint).toBe(128);
  });

  it('should find optimal scale', () => {
    const weights = [0.5, -0.8, 0.3];
    const scale = K.findOptimalScale(weights);
    expect(scale).toBeGreaterThan(0);
  });

  it('should calculate size correctly', () => {
    const obj = { test: 'data', value: 123 };
    const size = K.calculateSize(obj);
    expect(size).toBeGreaterThan(0);
  });
});

describe('K\'UHUL Weight Operations', () => {
  it('should store weights', async () => {
    const weights = [0.1, 0.2, 0.3, 0.4];
    const result = await K.run('store_test', '⟁Weights⟁store⟁', {
      modelId: 'test_model',
      weights: weights
    });

    expect(result.op).toBe('weights_stored');
    expect(K.w.has('test_model')).toBeTruthy();
  });

  it('should load weights', async () => {
    const result = await K.run('load_test', '⟁Weights⟁load⟁', {
      modelId: 'test_model'
    });

    expect(result.op).toBe('weights_loaded');
    expect(result.weights).toBeDefined();
  });

  it('should quantize and store weights', async () => {
    const weights = [0.1, 0.2, 0.3, 0.4];
    const result = await K.run('quant_test', '⟁Weights⟁quantize⟁', {
      modelId: 'quant_model',
      weights: weights,
      bits: 8
    });

    expect(result.op).toBe('weights_quantized');
    expect(result.bits).toBe(8);
    expect(K.w.has('quant_model_q8')).toBeTruthy();
  });
});

describe('K\'UHUL Gradient Operations', () => {
  it('should accumulate gradients', async () => {
    const result = await K.run('grad_test', '⟁Gradients⟁accumulate⟁', {
      trainingId: 'training_1',
      gradients: [0.01, 0.02, 0.03]
    });

    expect(result.op).toBe('gradients_accumulated');
    expect(result.count).toBeGreaterThan(0);
  });

  it('should zero gradients', async () => {
    const result = await K.run('zero_test', '⟁Gradients⟁zero⟁', {
      trainingId: 'training_1'
    });

    expect(result.op).toBe('gradients_zeroed');
  });
});

describe('K\'UHUL Optimizer Operations', () => {
  it('should initialize optimizer', async () => {
    const result = await K.run('opt_init', '⟁Optimize⟁init⟁', {
      optId: 'opt_1',
      optimizer: 'adam',
      params: { lr: 0.001 }
    });

    expect(result.op).toBe('optimizer_initialized');
    expect(result.optId).toBe('opt_1');
  });

  it('should get optimizer state', async () => {
    const result = await K.run('opt_state', '⟁Optimize⟁state⟁', {
      optId: 'opt_1'
    });

    expect(result.op).toBe('optimizer_state');
  });
});

describe('SVG Weight Geometry', () => {
  it('should create SVGWeightGeometry instance', () => {
    expect(svgEngine).toBeDefined();
    expect(svgEngine.weightPaths).toBeInstanceOf(Map);
  });

  it('should convert weights to SVG data', () => {
    const weights = [0.5, -0.3, 0.8, -0.1, 0.2];
    const result = svgEngine.weightsToSVG(weights, 'test_layer');

    expect(result.type).toBe('weight_layer');
    expect(result.layer).toBe('test_layer');
    expect(result.paths.length).toBeGreaterThan(0);
  });

  it('should generate weight colors', () => {
    const positive = svgEngine.weightToColor(0.5);
    const negative = svgEngine.weightToColor(-0.5);

    expect(positive).toContain('rgb');
    expect(negative).toContain('rgb');
  });

  it('should calculate weight norms', () => {
    const weights = [3, 4]; // 3-4-5 triangle
    const norm = svgEngine.calculateNorm(weights);
    expect(norm).toBe(5);
  });
});

describe('SVG QLoRA Compressor', () => {
  it('should create SVGQLoRACompressor instance', () => {
    expect(svgCompressor).toBeDefined();
    expect(svgCompressor.compressionRegistry).toBeInstanceOf(Map);
  });

  it('should compress weights to SVG', () => {
    const weights = {
      layer1: [0.1, 0.2, 0.3],
      layer2: [0.4, 0.5, 0.6]
    };

    const result = svgCompressor.compressQLoRAToSVG(weights, 'test_model', {
      quantization: 8,
      compression: 'scxq2'
    });

    expect(result.brainId).toContain('brain_test_model');
    expect(result.compressionRatio).toBeGreaterThan(0);
  });

  it('should compress path data with SCXQ2', () => {
    const path = 'M 0,10 L 50,20 L 100,15';
    const compressed = svgCompressor.scxq2CompressPath(path);

    expect(compressed).toContain('⟁');
  });

  it('should decompress SCXQ2 path data', () => {
    const path = 'M 0,10 L 50,20';
    const compressed = svgCompressor.scxq2CompressPath(path);
    const decompressed = svgCompressor.scxq2DecompressPath(compressed);

    // Should be similar to original
    expect(decompressed).toBeDefined();
  });
});

describe('Agent Orchestration (Ω)', () => {
  it('should spawn agents', async () => {
    const agent = await Ω.spawn('test', { topic: 'testing' });

    expect(agent.a).toBeDefined();
    expect(agent.s).toBe('live');
  });

  it('should get capabilities for agent types', () => {
    const baseCaps = Ω.cap('baseball');
    const cookCaps = Ω.cap('cooking');
    const finCaps = Ω.cap('finance');

    expect(baseCaps).toContain('stats');
    expect(cookCaps).toContain('recipes');
    expect(finCaps).toContain('analysis');
  });
});

/* ============================================================
   RUN TESTS
   ============================================================ */

function runTests() {
  console.log('🧪 Running K\'UHUL Engine Tests...\n');

  // Run all test suites
  describe('K\'UHUL Core Kernel', () => {
    it('should have core data structures', () => {
      expect(typeof K).toBe('object');
    });
  });

  return TestRunner.summary();
}

// Auto-run if in test mode
if (typeof window !== 'undefined') {
  window.runKuhulTests = runTests;
  window.TestRunner = TestRunner;
}

console.log('K\'UHUL ENGINE TESTS - LOADED');
console.log('Run tests with: runKuhulTests()');
