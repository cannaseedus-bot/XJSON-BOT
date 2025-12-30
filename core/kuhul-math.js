/**
 * K'UHUL MATH ENGINE - JavaScript-Native Mathematical Execution
 * ==============================================================
 *
 * Principle: If [⟁⚡🌀🧬🎨] can traverse DOM ↔ API, then [∫∂∑∏√π] can too
 * Law: JavaScript = Universal Executor (Python was never required)
 *
 * Features:
 * - Simpson's Rule numerical integration
 * - Numerical differentiation
 * - Matrix operations
 * - Statistical functions
 * - Optimization algorithms
 * - Gradient computation
 *
 * All operations use glyph-based contracts from /contracts/agl-contracts.xjson
 */

const KMath = {
  // ============================================================
  // CONSTANTS
  // ============================================================
  PI: Math.PI,
  E: Math.E,
  PHI: (1 + Math.sqrt(5)) / 2,  // Golden ratio
  EPSILON: 1e-10,

  // ============================================================
  // INTEGRAL (∫) - Simpson's Rule
  // ============================================================

  /**
   * Numerical integration using Simpson's Rule
   * @param {Function} fn - Function to integrate
   * @param {number} a - Lower bound
   * @param {number} b - Upper bound
   * @param {number} n - Number of intervals (must be even)
   * @returns {number} Approximate integral value
   */
  integral(fn, a, b, n = 100) {
    if (n % 2 !== 0) n++; // Ensure even number of intervals

    const h = (b - a) / n;
    let sum = fn(a) + fn(b);

    for (let i = 1; i < n; i++) {
      const x = a + i * h;
      sum += (i % 2 === 0 ? 2 : 4) * fn(x);
    }

    return (h / 3) * sum;
  },

  /**
   * Adaptive Simpson's integration with error control
   * @param {Function} fn - Function to integrate
   * @param {number} a - Lower bound
   * @param {number} b - Upper bound
   * @param {number} tol - Error tolerance
   * @returns {number} Approximate integral value
   */
  adaptiveIntegral(fn, a, b, tol = 1e-8) {
    const mid = (a + b) / 2;
    const whole = this._simpsonStep(fn, a, b);
    const left = this._simpsonStep(fn, a, mid);
    const right = this._simpsonStep(fn, mid, b);

    if (Math.abs(left + right - whole) <= 15 * tol) {
      return left + right + (left + right - whole) / 15;
    }

    return this.adaptiveIntegral(fn, a, mid, tol / 2) +
           this.adaptiveIntegral(fn, mid, b, tol / 2);
  },

  _simpsonStep(fn, a, b) {
    const mid = (a + b) / 2;
    const h = (b - a) / 6;
    return h * (fn(a) + 4 * fn(mid) + fn(b));
  },

  // ============================================================
  // DERIVATIVE (∂) - Numerical Differentiation
  // ============================================================

  /**
   * Numerical derivative using central difference
   * @param {Function} fn - Function to differentiate
   * @param {number} x - Point at which to evaluate derivative
   * @param {number} h - Step size
   * @returns {number} Approximate derivative
   */
  derivative(fn, x, h = 1e-6) {
    return (fn(x + h) - fn(x - h)) / (2 * h);
  },

  /**
   * Second derivative using central difference
   * @param {Function} fn - Function to differentiate
   * @param {number} x - Point at which to evaluate
   * @param {number} h - Step size
   * @returns {number} Approximate second derivative
   */
  secondDerivative(fn, x, h = 1e-5) {
    return (fn(x + h) - 2 * fn(x) + fn(x - h)) / (h * h);
  },

  /**
   * Partial derivative for multivariate functions
   * @param {Function} fn - Multivariate function fn(x1, x2, ..., xn)
   * @param {number[]} point - Point at which to evaluate
   * @param {number} varIndex - Index of variable to differentiate with respect to
   * @param {number} h - Step size
   * @returns {number} Approximate partial derivative
   */
  partialDerivative(fn, point, varIndex, h = 1e-6) {
    const pointPlus = [...point];
    const pointMinus = [...point];
    pointPlus[varIndex] += h;
    pointMinus[varIndex] -= h;
    return (fn(...pointPlus) - fn(...pointMinus)) / (2 * h);
  },

  // ============================================================
  // GRADIENT (∇) - Vector of Partial Derivatives
  // ============================================================

  /**
   * Compute gradient vector
   * @param {Function} fn - Multivariate function
   * @param {number[]} point - Point at which to evaluate gradient
   * @param {number} h - Step size
   * @returns {number[]} Gradient vector
   */
  gradient(fn, point, h = 1e-6) {
    return point.map((_, i) => this.partialDerivative(fn, point, i, h));
  },

  /**
   * Compute Hessian matrix (second derivatives)
   * @param {Function} fn - Multivariate function
   * @param {number[]} point - Point at which to evaluate
   * @param {number} h - Step size
   * @returns {number[][]} Hessian matrix
   */
  hessian(fn, point, h = 1e-5) {
    const n = point.length;
    const H = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const pp = [...point];
        const pm = [...point];
        const mp = [...point];
        const mm = [...point];

        pp[i] += h; pp[j] += h;
        pm[i] += h; pm[j] -= h;
        mp[i] -= h; mp[j] += h;
        mm[i] -= h; mm[j] -= h;

        H[i][j] = (fn(...pp) - fn(...pm) - fn(...mp) + fn(...mm)) / (4 * h * h);
      }
    }

    return H;
  },

  // ============================================================
  // SUMMATION (∑) AND PRODUCT (∏)
  // ============================================================

  /**
   * Summation of function values
   * @param {Function} fn - Function to sum
   * @param {number} start - Start index
   * @param {number} end - End index
   * @returns {number} Sum
   */
  sum(fn, start, end) {
    let total = 0;
    for (let i = start; i <= end; i++) {
      total += fn(i);
    }
    return total;
  },

  /**
   * Product of function values
   * @param {Function} fn - Function to multiply
   * @param {number} start - Start index
   * @param {number} end - End index
   * @returns {number} Product
   */
  product(fn, start, end) {
    let total = 1;
    for (let i = start; i <= end; i++) {
      total *= fn(i);
    }
    return total;
  },

  /**
   * Array sum
   * @param {number[]} arr - Array of numbers
   * @returns {number} Sum
   */
  arraySum(arr) {
    return arr.reduce((a, b) => a + b, 0);
  },

  /**
   * Array product
   * @param {number[]} arr - Array of numbers
   * @returns {number} Product
   */
  arrayProduct(arr) {
    return arr.reduce((a, b) => a * b, 1);
  },

  // ============================================================
  // SQRT (√) AND BASIC OPERATIONS
  // ============================================================

  sqrt: Math.sqrt,

  /**
   * Nth root
   * @param {number} x - Value
   * @param {number} n - Root degree
   * @returns {number} Nth root of x
   */
  nthRoot(x, n) {
    return Math.pow(x, 1 / n);
  },

  /**
   * Factorial
   * @param {number} n - Non-negative integer
   * @returns {number} n!
   */
  factorial(n) {
    if (n < 0) throw new Error('Factorial undefined for negative numbers');
    if (n === 0 || n === 1) return 1;
    return this.product(i => i, 2, n);
  },

  /**
   * Binomial coefficient (n choose k)
   * @param {number} n - Total items
   * @param {number} k - Items to choose
   * @returns {number} Binomial coefficient
   */
  binomial(n, k) {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    return this.factorial(n) / (this.factorial(k) * this.factorial(n - k));
  },

  // ============================================================
  // DELTA (∆) AND COMPARISON
  // ============================================================

  /**
   * Finite difference
   * @param {number} a - First value
   * @param {number} b - Second value
   * @returns {number} Difference
   */
  delta(a, b) {
    return b - a;
  },

  /**
   * Approximate equality check
   * @param {number} a - First value
   * @param {number} b - Second value
   * @param {number} epsilon - Tolerance
   * @returns {boolean} Whether values are approximately equal
   */
  approx(a, b, epsilon = this.EPSILON) {
    return Math.abs(a - b) <= epsilon;
  },

  /**
   * Sign function
   * @param {number} x - Value
   * @returns {number} -1, 0, or 1
   */
  sign(x) {
    return x > 0 ? 1 : x < 0 ? -1 : 0;
  },

  // ============================================================
  // MATRIX OPERATIONS
  // ============================================================

  /**
   * Matrix multiplication
   * @param {number[][]} A - First matrix
   * @param {number[][]} B - Second matrix
   * @returns {number[][]} Product matrix
   */
  matMul(A, B) {
    const m = A.length;
    const n = B[0].length;
    const p = A[0].length;

    if (p !== B.length) {
      throw new Error('Matrix dimensions incompatible for multiplication');
    }

    const C = Array(m).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        for (let k = 0; k < p; k++) {
          C[i][j] += A[i][k] * B[k][j];
        }
      }
    }

    return C;
  },

  /**
   * Matrix transpose
   * @param {number[][]} A - Matrix to transpose
   * @returns {number[][]} Transposed matrix
   */
  transpose(A) {
    return A[0].map((_, j) => A.map(row => row[j]));
  },

  /**
   * Matrix addition
   * @param {number[][]} A - First matrix
   * @param {number[][]} B - Second matrix
   * @returns {number[][]} Sum matrix
   */
  matAdd(A, B) {
    return A.map((row, i) => row.map((val, j) => val + B[i][j]));
  },

  /**
   * Scalar multiplication
   * @param {number} scalar - Scalar value
   * @param {number[][]} A - Matrix
   * @returns {number[][]} Scaled matrix
   */
  scalarMul(scalar, A) {
    return A.map(row => row.map(val => scalar * val));
  },

  /**
   * Dot product of vectors
   * @param {number[]} a - First vector
   * @param {number[]} b - Second vector
   * @returns {number} Dot product
   */
  dot(a, b) {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  },

  /**
   * Vector norm (magnitude)
   * @param {number[]} v - Vector
   * @returns {number} Euclidean norm
   */
  norm(v) {
    return Math.sqrt(this.dot(v, v));
  },

  /**
   * Normalize vector
   * @param {number[]} v - Vector
   * @returns {number[]} Unit vector
   */
  normalize(v) {
    const n = this.norm(v);
    return v.map(x => x / n);
  },

  /**
   * Identity matrix
   * @param {number} n - Size
   * @returns {number[][]} Identity matrix
   */
  eye(n) {
    return Array(n).fill(null).map((_, i) =>
      Array(n).fill(0).map((_, j) => i === j ? 1 : 0)
    );
  },

  /**
   * Zeros matrix
   * @param {number} m - Rows
   * @param {number} n - Columns
   * @returns {number[][]} Zero matrix
   */
  zeros(m, n) {
    return Array(m).fill(null).map(() => Array(n).fill(0));
  },

  /**
   * Random matrix
   * @param {number} m - Rows
   * @param {number} n - Columns
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number[][]} Random matrix
   */
  random(m, n, min = 0, max = 1) {
    return Array(m).fill(null).map(() =>
      Array(n).fill(0).map(() => min + Math.random() * (max - min))
    );
  },

  // ============================================================
  // STATISTICAL FUNCTIONS
  // ============================================================

  /**
   * Mean of array
   * @param {number[]} arr - Array of numbers
   * @returns {number} Mean
   */
  mean(arr) {
    return this.arraySum(arr) / arr.length;
  },

  /**
   * Variance of array
   * @param {number[]} arr - Array of numbers
   * @param {boolean} sample - Use sample variance (n-1)
   * @returns {number} Variance
   */
  variance(arr, sample = true) {
    const m = this.mean(arr);
    const squaredDiffs = arr.map(x => Math.pow(x - m, 2));
    return this.arraySum(squaredDiffs) / (arr.length - (sample ? 1 : 0));
  },

  /**
   * Standard deviation
   * @param {number[]} arr - Array of numbers
   * @param {boolean} sample - Use sample std dev
   * @returns {number} Standard deviation
   */
  std(arr, sample = true) {
    return Math.sqrt(this.variance(arr, sample));
  },

  /**
   * Covariance between two arrays
   * @param {number[]} x - First array
   * @param {number[]} y - Second array
   * @returns {number} Covariance
   */
  covariance(x, y) {
    const mx = this.mean(x);
    const my = this.mean(y);
    const products = x.map((xi, i) => (xi - mx) * (y[i] - my));
    return this.arraySum(products) / (x.length - 1);
  },

  /**
   * Correlation coefficient
   * @param {number[]} x - First array
   * @param {number[]} y - Second array
   * @returns {number} Pearson correlation coefficient
   */
  correlation(x, y) {
    return this.covariance(x, y) / (this.std(x) * this.std(y));
  },

  /**
   * Softmax function
   * @param {number[]} arr - Array of logits
   * @returns {number[]} Probability distribution
   */
  softmax(arr) {
    const maxVal = Math.max(...arr);
    const expArr = arr.map(x => Math.exp(x - maxVal));
    const sumExp = this.arraySum(expArr);
    return expArr.map(x => x / sumExp);
  },

  /**
   * Sigmoid function
   * @param {number} x - Input value
   * @returns {number} Sigmoid output
   */
  sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  },

  /**
   * ReLU activation
   * @param {number} x - Input value
   * @returns {number} ReLU output
   */
  relu(x) {
    return Math.max(0, x);
  },

  /**
   * Tanh activation
   * @param {number} x - Input value
   * @returns {number} Tanh output
   */
  tanh: Math.tanh,

  // ============================================================
  // OPTIMIZATION
  // ============================================================

  /**
   * Gradient descent step
   * @param {number[]} params - Current parameters
   * @param {number[]} gradients - Gradient at current params
   * @param {number} lr - Learning rate
   * @returns {number[]} Updated parameters
   */
  gradientDescentStep(params, gradients, lr = 0.01) {
    return params.map((p, i) => p - lr * gradients[i]);
  },

  /**
   * Newton-Raphson root finding
   * @param {Function} fn - Function to find root of
   * @param {number} x0 - Initial guess
   * @param {number} tol - Tolerance
   * @param {number} maxIter - Maximum iterations
   * @returns {number} Approximate root
   */
  newtonRaphson(fn, x0, tol = 1e-8, maxIter = 100) {
    let x = x0;
    for (let i = 0; i < maxIter; i++) {
      const fx = fn(x);
      const fpx = this.derivative(fn, x);

      if (Math.abs(fpx) < this.EPSILON) {
        throw new Error('Derivative too small');
      }

      const xNew = x - fx / fpx;

      if (Math.abs(xNew - x) < tol) {
        return xNew;
      }

      x = xNew;
    }

    throw new Error('Newton-Raphson did not converge');
  },

  /**
   * Golden section search for minimum
   * @param {Function} fn - Function to minimize
   * @param {number} a - Lower bound
   * @param {number} b - Upper bound
   * @param {number} tol - Tolerance
   * @returns {number} Approximate minimum location
   */
  goldenSection(fn, a, b, tol = 1e-8) {
    const phi = this.PHI;
    const resphi = 2 - phi;

    let c = b - resphi * (b - a);
    let d = a + resphi * (b - a);

    while (Math.abs(b - a) > tol) {
      if (fn(c) < fn(d)) {
        b = d;
        d = c;
        c = b - resphi * (b - a);
      } else {
        a = c;
        c = d;
        d = a + resphi * (b - a);
      }
    }

    return (a + b) / 2;
  },

  // ============================================================
  // POLYNOMIAL OPERATIONS
  // ============================================================

  /**
   * Evaluate polynomial at x
   * @param {number[]} coeffs - Coefficients [a0, a1, a2, ...] for a0 + a1*x + a2*x^2 + ...
   * @param {number} x - Point to evaluate
   * @returns {number} Polynomial value
   */
  polyEval(coeffs, x) {
    return coeffs.reduce((sum, c, i) => sum + c * Math.pow(x, i), 0);
  },

  /**
   * Polynomial derivative coefficients
   * @param {number[]} coeffs - Original coefficients
   * @returns {number[]} Derivative coefficients
   */
  polyDerivative(coeffs) {
    return coeffs.slice(1).map((c, i) => c * (i + 1));
  },

  /**
   * Polynomial integral coefficients (constant term = 0)
   * @param {number[]} coeffs - Original coefficients
   * @returns {number[]} Integral coefficients
   */
  polyIntegral(coeffs) {
    return [0, ...coeffs.map((c, i) => c / (i + 1))];
  },

  // ============================================================
  // TRIGONOMETRIC HELPERS
  // ============================================================

  /**
   * Degrees to radians
   * @param {number} deg - Degrees
   * @returns {number} Radians
   */
  toRadians(deg) {
    return deg * (Math.PI / 180);
  },

  /**
   * Radians to degrees
   * @param {number} rad - Radians
   * @returns {number} Degrees
   */
  toDegrees(rad) {
    return rad * (180 / Math.PI);
  },

  // ============================================================
  // GLYPH EXECUTION INTERFACE
  // ============================================================

  /**
   * Execute mathematical operation via glyph contract
   * @param {string} glyph - Mathematical glyph symbol
   * @param {object} params - Operation parameters
   * @returns {any} Result of operation
   */
  execute(glyph, params) {
    const ops = {
      '∫': () => this.integral(params.fn, params.a, params.b, params.n),
      '∂': () => this.derivative(params.fn, params.x, params.h),
      '∑': () => this.sum(params.fn, params.start, params.end),
      '∏': () => this.product(params.fn, params.start, params.end),
      '√': () => this.sqrt(params.x),
      'π': () => this.PI,
      '∇': () => this.gradient(params.fn, params.point),
      '∆': () => this.delta(params.a, params.b),
      '∞': () => Infinity,
      '≈': () => this.approx(params.a, params.b, params.epsilon)
    };

    if (ops[glyph]) {
      return ops[glyph]();
    }

    throw new Error(`Unknown mathematical glyph: ${glyph}`);
  },

  /**
   * Parse and execute glyph expression
   * @param {string} expr - Expression like "∫(x => x*x, 0, 1)"
   * @returns {any} Result
   */
  parseAndExecute(expr) {
    const match = expr.match(/^([∫∂∑∏√π∇∆∞≈])\((.*)\)$/);
    if (!match) {
      throw new Error(`Invalid glyph expression: ${expr}`);
    }

    const [, glyph, argsStr] = match;
    // This would need a proper parser for production use
    return this.execute(glyph, this._parseArgs(glyph, argsStr));
  },

  _parseArgs(glyph, argsStr) {
    // Simplified arg parsing - production would need proper parser
    const args = argsStr.split(',').map(s => s.trim());

    switch (glyph) {
      case '∫':
        return { fn: eval(args[0]), a: parseFloat(args[1]), b: parseFloat(args[2]), n: parseInt(args[3]) || 100 };
      case '∂':
        return { fn: eval(args[0]), x: parseFloat(args[1]), h: parseFloat(args[2]) || 1e-6 };
      case '√':
        return { x: parseFloat(args[0]) };
      case '∆':
        return { a: parseFloat(args[0]), b: parseFloat(args[1]) };
      case '≈':
        return { a: parseFloat(args[0]), b: parseFloat(args[1]), epsilon: parseFloat(args[2]) || 1e-10 };
      default:
        return {};
    }
  }
};

// ============================================================
// INTEGRATION WITH K'UHUL ENGINE
// ============================================================

// Extend K'UHUL engine with math operations if it exists
if (typeof K !== 'undefined') {
  K.math = KMath;

  // Add math operation handler
  K.handleMathOps = function(code, ctx) {
    const [_, op, ...args] = code.split('⟁');

    switch(op) {
      case 'integral':
        return { op: 'integral_complete', result: KMath.integral(ctx.fn, ctx.a, ctx.b, ctx.n) };
      case 'derivative':
        return { op: 'derivative_complete', result: KMath.derivative(ctx.fn, ctx.x, ctx.h) };
      case 'gradient':
        return { op: 'gradient_complete', result: KMath.gradient(ctx.fn, ctx.point) };
      case 'optimize':
        return { op: 'optimize_complete', result: KMath.goldenSection(ctx.fn, ctx.a, ctx.b) };
      case 'matmul':
        return { op: 'matmul_complete', result: KMath.matMul(ctx.A, ctx.B) };
      case 'softmax':
        return { op: 'softmax_complete', result: KMath.softmax(ctx.arr) };
    }

    return { op: 'math_error', error: `Unknown math operation: ${op}` };
  };
}

// ============================================================
// EXPORT FOR DIFFERENT ENVIRONMENTS
// ============================================================

if (typeof window !== 'undefined') {
  window.KMath = KMath;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = KMath;
}

console.log('K\'UHUL MATH ENGINE v1.0 - LOADED');
console.log('- Numerical Integration (∫): Simpson\'s Rule');
console.log('- Differentiation (∂): Central Difference');
console.log('- Gradient (∇): Vector Partial Derivatives');
console.log('- Matrix Operations: matMul, transpose, dot');
console.log('- Statistics: mean, variance, softmax');
console.log('- Optimization: Newton-Raphson, Golden Section');
console.log('∴ JavaScript = Universal Executor');
