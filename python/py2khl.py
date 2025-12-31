#!/usr/bin/env python3
"""
PY2KHL_INTENT_COLLAPSER_v1
==========================

Semantic reducer that extracts intent from Python scripts
and collapses them into deterministic, browser-runnable *.khl files.

NOT a transpiler. NOT a VM. A lawful intent collapser.

Usage:
    python py2khl.py script.py -o output.khl
    python py2khl.py script.py --ast  # Show AST analysis
    python py2khl.py script.py --json # Output as JSON AST

Supported Python Subset (v1):
    ✅ assignments, dicts, lists
    ✅ for-loops, if/elif/else
    ✅ basic math, string ops
    ✅ hashing, chunking, compression calls
    ✅ JSON emit, file IO

    ❌ threads, async, eval/exec
    ❌ reflection, monkey-patching
    ❌ dynamic imports
"""

import ast
import json
import sys
import hashlib
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field

# ============================================================
# REJECTION LIST (Hard Errors)
# ============================================================

REJECTED_NODES = {
    'AsyncFunctionDef': 'async functions not allowed (non-deterministic)',
    'AsyncFor': 'async for not allowed (non-deterministic)',
    'AsyncWith': 'async with not allowed (non-deterministic)',
    'Await': 'await not allowed (non-deterministic)',
    'Yield': 'generators not allowed (stateful)',
    'YieldFrom': 'generators not allowed (stateful)',
    'Global': 'global state mutation not allowed',
    'Nonlocal': 'nonlocal state mutation not allowed',
}

REJECTED_CALLS = {
    'eval': 'eval() is non-deterministic',
    'exec': 'exec() is non-deterministic',
    'compile': 'compile() is non-deterministic',
    'globals': 'reflection not allowed',
    'locals': 'reflection not allowed',
    'vars': 'reflection not allowed',
    'setattr': 'dynamic attribute mutation not allowed',
    'delattr': 'dynamic attribute mutation not allowed',
    '__import__': 'dynamic imports not allowed',
}

# ============================================================
# INTENT CLASSIFICATION
# ============================================================

@dataclass
class IntentBlock:
    """A classified block of intent"""
    phase: str  # Pop, Wo, Sek, Collapse
    kind: str   # io, state, loop, condition, emit
    source: str # Original Python source
    khl: str    # Generated KHL code
    line: int   # Source line number

@dataclass
class IntentGraph:
    """The complete intent graph extracted from Python"""
    pop: List[IntentBlock] = field(default_factory=list)
    wo: List[IntentBlock] = field(default_factory=list)
    sek: List[IntentBlock] = field(default_factory=list)
    collapse: List[IntentBlock] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def to_khl(self) -> str:
        """Generate complete KHL program"""
        sections = []

        if self.pop:
            pop_body = '\n'.join(f'  {b.khl}' for b in self.pop)
            sections.append(f'@Pop {{\n{pop_body}\n}}')

        if self.wo:
            wo_body = '\n'.join(f'  {b.khl}' for b in self.wo)
            sections.append(f'@Wo {{\n{wo_body}\n}}')

        if self.sek:
            sek_body = '\n'.join(f'  {b.khl}' for b in self.sek)
            sections.append(f'@Sek {{\n{sek_body}\n}}')

        if self.collapse:
            collapse_body = '\n'.join(f'  {b.khl}' for b in self.collapse)
            sections.append(f'@Collapse {{\n{collapse_body}\n}}')

        return '\n\n'.join(sections)

    def to_json(self) -> Dict:
        """Generate JSON AST representation"""
        return {
            "@type": "khl-program",
            "@version": "1.0.0",
            "phases": {
                "Pop": [{"kind": b.kind, "khl": b.khl, "line": b.line} for b in self.pop],
                "Wo": [{"kind": b.kind, "khl": b.khl, "line": b.line} for b in self.wo],
                "Sek": [{"kind": b.kind, "khl": b.khl, "line": b.line} for b in self.sek],
                "Collapse": [{"kind": b.kind, "khl": b.khl, "line": b.line} for b in self.collapse]
            },
            "errors": self.errors,
            "warnings": self.warnings
        }

# ============================================================
# MAPPING TABLES
# ============================================================

# Python call → KHL intrinsic mapping
CALL_MAP = {
    # File operations → fs.*
    'open': 'fs.open',
    'read': 'fs.read',
    'read_bytes': 'fs.bytes',
    'read_text': 'fs.text',
    'write': 'fs.write',
    'write_bytes': 'fs.write',
    'rglob': 'fs.scan',
    'glob': 'fs.scan',
    'iterdir': 'fs.list',
    'exists': 'fs.exists',
    'is_file': 'fs.isFile',
    'is_dir': 'fs.isDir',
    'stat': 'fs.stat',
    'mkdir': 'fs.mkdir',

    # Path operations
    'Path': 'path.new',
    'suffix': 'path.ext',
    'stem': 'path.stem',
    'name': 'path.name',
    'parent': 'path.parent',
    'relative_to': 'path.relative',

    # Hashing → hash.*
    'md5': 'hash.md5',
    'sha1': 'hash.sha1',
    'sha256': 'hash.sha256',
    'hexdigest': 'hash.hex',
    'digest': 'hash.bytes',

    # Compression → cc.*
    'compress': 'cc.pack',
    'decompress': 'cc.unpack',
    'gzip': 'cc.gzip',
    'zlib': 'cc.zlib',
    'lzma': 'cc.lzma',

    # JSON → json.*
    'dumps': 'json.encode',
    'loads': 'json.decode',
    'dump': 'json.write',
    'load': 'json.read',

    # String operations → text.*
    'encode': 'text.encode',
    'decode': 'text.decode',
    'strip': 'text.trim',
    'split': 'text.split',
    'join': 'text.join',
    'replace': 'text.replace',
    'lower': 'text.lower',
    'upper': 'text.upper',
    'startswith': 'text.startsWith',
    'endswith': 'text.endsWith',

    # Collections
    'len': 'len',
    'range': 'range',
    'enumerate': 'enumerate',
    'zip': 'zip',
    'sorted': 'sort',
    'reversed': 'reverse',
    'list': 'list',
    'dict': 'dict',
    'set': 'set',
    'tuple': 'tuple',

    # Math
    'abs': 'math.abs',
    'min': 'math.min',
    'max': 'math.max',
    'sum': 'math.sum',
    'round': 'math.round',
    'int': 'int',
    'float': 'float',
    'str': 'str',

    # Type checks
    'isinstance': 'type.is',
    'type': 'type.of',

    # Time
    'time': 'time.now',
    'sleep': 'time.wait',
}

# Python operators → KHL operators
OP_MAP = {
    'Add': '+',
    'Sub': '-',
    'Mult': '*',
    'Div': '/',
    'FloorDiv': '//',
    'Mod': '%',
    'Pow': '**',
    'LShift': '<<',
    'RShift': '>>',
    'BitOr': '|',
    'BitXor': '^',
    'BitAnd': '&',
    'MatMult': '@',
}

COMPARE_MAP = {
    'Eq': '==',
    'NotEq': '!=',
    'Lt': '<',
    'LtE': '<=',
    'Gt': '>',
    'GtE': '>=',
    'Is': '===',
    'IsNot': '!==',
    'In': 'in',
    'NotIn': 'not in',
}

BOOL_MAP = {
    'And': '&&',
    'Or': '||',
}

# ============================================================
# PY2KHL CONVERTER
# ============================================================

class Py2KHL(ast.NodeVisitor):
    """
    Python AST → K'UHUL Intent Collapser

    Extracts semantic intent from Python code and maps it
    to deterministic ASX-R phases.
    """

    def __init__(self, source: str):
        self.source = source
        self.source_lines = source.split('\n')
        self.graph = IntentGraph()
        self.current_phase = 'Wo'  # Default phase
        self.indent_level = 0
        self.in_loop = False
        self.in_function = False
        self.function_name = None
        self.local_vars: set = set()
        self.global_vars: set = set()

    def get_source_line(self, node) -> str:
        """Get original source for a node"""
        if hasattr(node, 'lineno'):
            return self.source_lines[node.lineno - 1].strip()
        return ''

    def indent(self) -> str:
        """Get current indentation"""
        return '  ' * self.indent_level

    def reject(self, node, reason: str):
        """Add rejection error"""
        line = getattr(node, 'lineno', 0)
        self.graph.errors.append(f"Line {line}: {reason}")

    def warn(self, node, reason: str):
        """Add warning"""
        line = getattr(node, 'lineno', 0)
        self.graph.warnings.append(f"Line {line}: {reason}")

    # ========================================
    # VALIDATION
    # ========================================

    def validate_node(self, node) -> bool:
        """Check if node type is allowed"""
        node_type = type(node).__name__
        if node_type in REJECTED_NODES:
            self.reject(node, REJECTED_NODES[node_type])
            return False
        return True

    def validate_call(self, node) -> bool:
        """Check if function call is allowed"""
        if isinstance(node.func, ast.Name):
            name = node.func.id
            if name in REJECTED_CALLS:
                self.reject(node, REJECTED_CALLS[name])
                return False
        return True

    # ========================================
    # EXPRESSION CONVERSION
    # ========================================

    def convert_expr(self, node) -> str:
        """Convert Python expression to KHL"""
        if node is None:
            return 'null'

        # Literals
        if isinstance(node, ast.Constant):
            if isinstance(node.value, str):
                escaped = node.value.replace('\\', '\\\\').replace('"', '\\"')
                return f'"{escaped}"'
            elif isinstance(node.value, bool):
                return 'true' if node.value else 'false'
            elif node.value is None:
                return 'null'
            return str(node.value)

        # Names/identifiers
        if isinstance(node, ast.Name):
            return node.id

        # Attribute access (e.g., obj.attr)
        if isinstance(node, ast.Attribute):
            value = self.convert_expr(node.value)
            return f'{value}.{node.attr}'

        # Subscript (e.g., arr[idx])
        if isinstance(node, ast.Subscript):
            value = self.convert_expr(node.value)
            if isinstance(node.slice, ast.Slice):
                lower = self.convert_expr(node.slice.lower) if node.slice.lower else ''
                upper = self.convert_expr(node.slice.upper) if node.slice.upper else ''
                step = self.convert_expr(node.slice.step) if node.slice.step else ''
                if step:
                    return f'{value}[{lower}:{upper}:{step}]'
                return f'{value}[{lower}:{upper}]'
            else:
                index = self.convert_expr(node.slice)
                return f'{value}[{index}]'

        # Binary operations
        if isinstance(node, ast.BinOp):
            left = self.convert_expr(node.left)
            right = self.convert_expr(node.right)
            op = OP_MAP.get(type(node.op).__name__, '?')
            return f'({left} {op} {right})'

        # Unary operations
        if isinstance(node, ast.UnaryOp):
            operand = self.convert_expr(node.operand)
            if isinstance(node.op, ast.Not):
                return f'!{operand}'
            elif isinstance(node.op, ast.USub):
                return f'-{operand}'
            elif isinstance(node.op, ast.UAdd):
                return f'+{operand}'
            elif isinstance(node.op, ast.Invert):
                return f'~{operand}'

        # Boolean operations
        if isinstance(node, ast.BoolOp):
            op = BOOL_MAP.get(type(node.op).__name__, '&&')
            values = [self.convert_expr(v) for v in node.values]
            return f'({f" {op} ".join(values)})'

        # Comparisons
        if isinstance(node, ast.Compare):
            left = self.convert_expr(node.left)
            parts = [left]
            for op, comparator in zip(node.ops, node.comparators):
                op_str = COMPARE_MAP.get(type(op).__name__, '==')
                right = self.convert_expr(comparator)
                parts.append(f'{op_str} {right}')
            return ' '.join(parts)

        # Function calls
        if isinstance(node, ast.Call):
            return self.convert_call(node)

        # List literals
        if isinstance(node, ast.List):
            elements = [self.convert_expr(e) for e in node.elts]
            return f'[{", ".join(elements)}]'

        # Dict literals
        if isinstance(node, ast.Dict):
            pairs = []
            for k, v in zip(node.keys, node.values):
                key = self.convert_expr(k) if k else '...'
                val = self.convert_expr(v)
                pairs.append(f'{key}: {val}')
            return f'{{{", ".join(pairs)}}}'

        # Tuple (treat as list in KHL)
        if isinstance(node, ast.Tuple):
            elements = [self.convert_expr(e) for e in node.elts]
            return f'[{", ".join(elements)}]'

        # Set (treat as list in KHL)
        if isinstance(node, ast.Set):
            elements = [self.convert_expr(e) for e in node.elts]
            return f'set([{", ".join(elements)}])'

        # List/Dict/Set comprehensions
        if isinstance(node, ast.ListComp):
            return self.convert_comprehension(node, 'list')
        if isinstance(node, ast.DictComp):
            return self.convert_comprehension(node, 'dict')
        if isinstance(node, ast.SetComp):
            return self.convert_comprehension(node, 'set')

        # F-strings
        if isinstance(node, ast.JoinedStr):
            parts = []
            for v in node.values:
                if isinstance(v, ast.Constant):
                    parts.append(v.value)
                elif isinstance(v, ast.FormattedValue):
                    parts.append(f'${{{self.convert_expr(v.value)}}}')
            return f'`{"".join(parts)}`'

        # If expression (ternary)
        if isinstance(node, ast.IfExp):
            test = self.convert_expr(node.test)
            body = self.convert_expr(node.body)
            orelse = self.convert_expr(node.orelse)
            return f'({test} ? {body} : {orelse})'

        # Lambda (convert to inline)
        if isinstance(node, ast.Lambda):
            args = ', '.join(a.arg for a in node.args.args)
            body = self.convert_expr(node.body)
            return f'({args}) => {body}'

        # Starred expression
        if isinstance(node, ast.Starred):
            return f'...{self.convert_expr(node.value)}'

        self.warn(node, f'Unknown expression type: {type(node).__name__}')
        return f'/* {type(node).__name__} */'

    def convert_call(self, node: ast.Call) -> str:
        """Convert function call to KHL intrinsic"""
        if not self.validate_call(node):
            return '/* REJECTED */'

        args = [self.convert_expr(a) for a in node.args]
        kwargs = {kw.arg: self.convert_expr(kw.value) for kw in node.keywords if kw.arg}

        # Get function name
        if isinstance(node.func, ast.Name):
            func_name = node.func.id
        elif isinstance(node.func, ast.Attribute):
            func_name = node.func.attr
            obj = self.convert_expr(node.func.value)

            # Map method call
            if func_name in CALL_MAP:
                mapped = CALL_MAP[func_name]
                if args:
                    return f'{mapped}({obj}, {", ".join(args)})'
                return f'{mapped}({obj})'

            # Direct method call
            if args:
                return f'{obj}.{func_name}({", ".join(args)})'
            return f'{obj}.{func_name}()'
        else:
            return f'/* complex call */'

        # Map function call
        if func_name in CALL_MAP:
            mapped = CALL_MAP[func_name]
            if kwargs:
                kw_str = ', '.join(f'{k}: {v}' for k, v in kwargs.items())
                return f'{mapped}({", ".join(args)}, {{{kw_str}}})'
            return f'{mapped}({", ".join(args)})'

        # Direct call
        if kwargs:
            kw_str = ', '.join(f'{k}: {v}' for k, v in kwargs.items())
            return f'{func_name}({", ".join(args)}, {{{kw_str}}})'
        return f'{func_name}({", ".join(args)})'

    def convert_comprehension(self, node, kind: str) -> str:
        """Convert comprehension to KHL"""
        if kind == 'list':
            elt = self.convert_expr(node.elt)
        elif kind == 'dict':
            elt = f'{self.convert_expr(node.key)}: {self.convert_expr(node.value)}'
        else:
            elt = self.convert_expr(node.elt)

        parts = []
        for gen in node.generators:
            target = self.convert_expr(gen.target)
            iter_expr = self.convert_expr(gen.iter)
            parts.append(f'for {target} in {iter_expr}')
            for if_clause in gen.ifs:
                parts.append(f'if {self.convert_expr(if_clause)}')

        return f'{kind}({elt} {" ".join(parts)})'

    # ========================================
    # STATEMENT CONVERSION
    # ========================================

    def add_block(self, phase: str, kind: str, khl: str, node):
        """Add a block to the intent graph"""
        block = IntentBlock(
            phase=phase,
            kind=kind,
            source=self.get_source_line(node),
            khl=khl,
            line=getattr(node, 'lineno', 0)
        )

        if phase == 'Pop':
            self.graph.pop.append(block)
        elif phase == 'Wo':
            self.graph.wo.append(block)
        elif phase == 'Sek':
            self.graph.sek.append(block)
        elif phase == 'Collapse':
            self.graph.collapse.append(block)

    def visit_Module(self, node):
        """Visit module (entry point)"""
        for child in node.body:
            self.visit(child)

    def visit_Import(self, node):
        """Imports are stripped (no runtime effect in KHL)"""
        names = ', '.join(alias.name for alias in node.names)
        self.warn(node, f'Import stripped: {names}')

    def visit_ImportFrom(self, node):
        """From imports are stripped"""
        names = ', '.join(alias.name for alias in node.names)
        self.warn(node, f'Import stripped: from {node.module} import {names}')

    def visit_FunctionDef(self, node):
        """Function definitions become inline folds"""
        self.in_function = True
        self.function_name = node.name
        self.local_vars = {a.arg for a in node.args.args}

        # Convert function body
        body_khl = []
        for stmt in node.body:
            khl = self.visit_statement(stmt)
            if khl:
                body_khl.append(khl)

        # If this is a main/entry function, treat as program
        if node.name in ('main', 'build', 'run', 'execute', 'process'):
            for khl in body_khl:
                # Distribute to appropriate phase
                pass  # Already handled in visit_statement
        else:
            # Define as inline fold
            args = ', '.join(a.arg for a in node.args.args)
            body = '\n'.join(f'  {k}' for k in body_khl)
            self.add_block('Wo', 'function',
                f'let {node.name} = ({args}) => {{\n{body}\n}}', node)

        self.in_function = False
        self.function_name = None
        self.local_vars = set()

    def visit_statement(self, node) -> Optional[str]:
        """Visit a statement and return KHL"""
        if not self.validate_node(node):
            return None

        if isinstance(node, ast.Assign):
            return self.convert_assign(node)
        elif isinstance(node, ast.AugAssign):
            return self.convert_aug_assign(node)
        elif isinstance(node, ast.AnnAssign):
            return self.convert_ann_assign(node)
        elif isinstance(node, ast.For):
            return self.convert_for(node)
        elif isinstance(node, ast.While):
            return self.convert_while(node)
        elif isinstance(node, ast.If):
            return self.convert_if(node)
        elif isinstance(node, ast.With):
            return self.convert_with(node)
        elif isinstance(node, ast.Return):
            return self.convert_return(node)
        elif isinstance(node, ast.Expr):
            return self.convert_expr_stmt(node)
        elif isinstance(node, ast.Pass):
            return '// pass'
        elif isinstance(node, ast.Break):
            return 'break'
        elif isinstance(node, ast.Continue):
            return 'continue'
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            return None  # Stripped
        elif isinstance(node, ast.FunctionDef):
            self.visit_FunctionDef(node)
            return None
        elif isinstance(node, ast.ClassDef):
            self.warn(node, 'Class definitions not yet supported')
            return None
        elif isinstance(node, ast.Try):
            return self.convert_try(node)
        elif isinstance(node, ast.Raise):
            return self.convert_raise(node)
        elif isinstance(node, ast.Assert):
            return self.convert_assert(node)
        else:
            self.warn(node, f'Unhandled statement: {type(node).__name__}')
            return None

    def visit_Assign(self, node):
        """Handle assignment at module level"""
        khl = self.convert_assign(node)
        if khl:
            # Classify by content
            if self.is_io_expr(node.value):
                self.add_block('Pop', 'io', khl, node)
            else:
                self.add_block('Wo', 'state', khl, node)

    def visit_AugAssign(self, node):
        """Handle augmented assignment"""
        khl = self.convert_aug_assign(node)
        if khl:
            self.add_block('Wo', 'state', khl, node)

    def visit_For(self, node):
        """Handle for loop at module level"""
        khl = self.convert_for(node)
        if khl:
            self.add_block('Sek', 'loop', khl, node)

    def visit_If(self, node):
        """Handle if at module level"""
        khl = self.convert_if(node)
        if khl:
            self.add_block('Sek', 'condition', khl, node)

    def visit_Expr(self, node):
        """Handle expression statement at module level"""
        khl = self.convert_expr_stmt(node)
        if khl:
            # Check if it's a return/emit
            if isinstance(node.value, ast.Call):
                func = node.value.func
                if isinstance(func, ast.Attribute) and func.attr in ('dump', 'dumps', 'write'):
                    self.add_block('Collapse', 'emit', khl, node)
                    return
            self.add_block('Wo', 'expr', khl, node)

    def visit_Return(self, node):
        """Handle return at module level"""
        khl = self.convert_return(node)
        if khl:
            self.add_block('Collapse', 'emit', khl, node)

    # ========================================
    # STATEMENT CONVERTERS
    # ========================================

    def convert_assign(self, node: ast.Assign) -> str:
        """Convert assignment statement"""
        value = self.convert_expr(node.value)

        # Handle multiple targets
        targets = []
        for t in node.targets:
            if isinstance(t, ast.Tuple):
                # Destructuring
                names = [self.convert_expr(e) for e in t.elts]
                targets.append(f'[{", ".join(names)}]')
            else:
                targets.append(self.convert_expr(t))

        if len(targets) == 1:
            return f'let {targets[0]} = {value}'
        else:
            return f'let [{", ".join(targets)}] = {value}'

    def convert_aug_assign(self, node: ast.AugAssign) -> str:
        """Convert augmented assignment (e.g., x += 1)"""
        target = self.convert_expr(node.target)
        value = self.convert_expr(node.value)
        op = OP_MAP.get(type(node.op).__name__, '?')
        return f'{target} {op}= {value}'

    def convert_ann_assign(self, node: ast.AnnAssign) -> str:
        """Convert annotated assignment"""
        target = self.convert_expr(node.target)
        if node.value:
            value = self.convert_expr(node.value)
            return f'let {target} = {value}'
        return f'let {target}'

    def convert_for(self, node: ast.For) -> str:
        """Convert for loop to @Sek foreach"""
        target = self.convert_expr(node.target)
        iter_expr = self.convert_expr(node.iter)

        # Convert body
        self.indent_level += 1
        self.in_loop = True
        body_parts = []
        for stmt in node.body:
            khl = self.visit_statement(stmt)
            if khl:
                body_parts.append(f'{self.indent()}{khl}')
        self.in_loop = False
        self.indent_level -= 1

        body = '\n'.join(body_parts)

        # Check for enumerate
        if 'enumerate' in iter_expr:
            return f'foreach {iter_expr} as [{target}] {{\n{body}\n{self.indent()}}}'

        return f'foreach {iter_expr} as {target} {{\n{body}\n{self.indent()}}}'

    def convert_while(self, node: ast.While) -> str:
        """Convert while loop"""
        test = self.convert_expr(node.test)

        self.indent_level += 1
        self.in_loop = True
        body_parts = []
        for stmt in node.body:
            khl = self.visit_statement(stmt)
            if khl:
                body_parts.append(f'{self.indent()}{khl}')
        self.in_loop = False
        self.indent_level -= 1

        body = '\n'.join(body_parts)
        return f'while {test} {{\n{body}\n{self.indent()}}}'

    def convert_if(self, node: ast.If) -> str:
        """Convert if statement to XCFE"""
        test = self.convert_expr(node.test)

        # Convert body
        self.indent_level += 1
        body_parts = []
        for stmt in node.body:
            khl = self.visit_statement(stmt)
            if khl:
                body_parts.append(f'{self.indent()}{khl}')
        self.indent_level -= 1
        body = '\n'.join(body_parts)

        result = f'@if {test}\n{self.indent()}@then {{\n{body}\n{self.indent()}}}'

        # Handle elif/else
        if node.orelse:
            if len(node.orelse) == 1 and isinstance(node.orelse[0], ast.If):
                # elif
                elif_khl = self.convert_if(node.orelse[0])
                result += f'\n{self.indent()}@elif {elif_khl[4:]}'  # Skip "@if "
            else:
                # else
                self.indent_level += 1
                else_parts = []
                for stmt in node.orelse:
                    khl = self.visit_statement(stmt)
                    if khl:
                        else_parts.append(f'{self.indent()}{khl}')
                self.indent_level -= 1
                else_body = '\n'.join(else_parts)
                result += f'\n{self.indent()}@else {{\n{else_body}\n{self.indent()}}}'

        return result

    def convert_with(self, node: ast.With) -> str:
        """Convert with statement (context manager)"""
        parts = []
        for item in node.items:
            ctx = self.convert_expr(item.context_expr)
            if item.optional_vars:
                var = self.convert_expr(item.optional_vars)
                parts.append(f'let {var} = {ctx}')
            else:
                parts.append(ctx)

        self.indent_level += 1
        body_parts = []
        for stmt in node.body:
            khl = self.visit_statement(stmt)
            if khl:
                body_parts.append(f'{self.indent()}{khl}')
        self.indent_level -= 1

        setup = '\n'.join(f'{self.indent()}{p}' for p in parts)
        body = '\n'.join(body_parts)
        return f'// with\n{setup}\n{body}'

    def convert_return(self, node: ast.Return) -> str:
        """Convert return to emit"""
        if node.value:
            value = self.convert_expr(node.value)
            return f'emit.json({value})'
        return 'emit.null()'

    def convert_expr_stmt(self, node: ast.Expr) -> str:
        """Convert expression statement"""
        return self.convert_expr(node.value)

    def convert_try(self, node: ast.Try) -> str:
        """Convert try/except"""
        self.indent_level += 1
        try_parts = []
        for stmt in node.body:
            khl = self.visit_statement(stmt)
            if khl:
                try_parts.append(f'{self.indent()}{khl}')
        self.indent_level -= 1

        try_body = '\n'.join(try_parts)
        result = f'try {{\n{try_body}\n{self.indent()}}}'

        for handler in node.handlers:
            exc_type = self.convert_expr(handler.type) if handler.type else 'Error'
            exc_name = handler.name or 'e'

            self.indent_level += 1
            handler_parts = []
            for stmt in handler.body:
                khl = self.visit_statement(stmt)
                if khl:
                    handler_parts.append(f'{self.indent()}{khl}')
            self.indent_level -= 1

            handler_body = '\n'.join(handler_parts)
            result += f'\n{self.indent()}catch ({exc_name}: {exc_type}) {{\n{handler_body}\n{self.indent()}}}'

        return result

    def convert_raise(self, node: ast.Raise) -> str:
        """Convert raise to throw"""
        if node.exc:
            exc = self.convert_expr(node.exc)
            return f'throw {exc}'
        return 'throw'

    def convert_assert(self, node: ast.Assert) -> str:
        """Convert assert"""
        test = self.convert_expr(node.test)
        if node.msg:
            msg = self.convert_expr(node.msg)
            return f'assert({test}, {msg})'
        return f'assert({test})'

    # ========================================
    # CLASSIFICATION HELPERS
    # ========================================

    def is_io_expr(self, node) -> bool:
        """Check if expression involves IO"""
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name):
                return node.func.id in ('open', 'Path')
            if isinstance(node.func, ast.Attribute):
                return node.func.attr in (
                    'read', 'read_bytes', 'read_text', 'write', 'write_bytes',
                    'rglob', 'glob', 'iterdir', 'exists', 'stat', 'mkdir'
                )
        return False

    # ========================================
    # MAIN CONVERSION
    # ========================================

    def convert(self) -> IntentGraph:
        """Parse and convert Python source to intent graph"""
        try:
            tree = ast.parse(self.source)
            self.visit(tree)
        except SyntaxError as e:
            self.graph.errors.append(f'Syntax error: {e}')

        return self.graph


# ============================================================
# CLI
# ============================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description='PY2KHL Intent Collapser - Convert Python to K\'UHUL',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
    python py2khl.py script.py -o output.khl
    python py2khl.py script.py --ast
    python py2khl.py script.py --json > program.json
    echo "x = 1 + 2" | python py2khl.py -
'''
    )

    parser.add_argument('input', help='Python source file (or - for stdin)')
    parser.add_argument('-o', '--output', help='Output .khl file')
    parser.add_argument('--ast', action='store_true', help='Show AST analysis')
    parser.add_argument('--json', action='store_true', help='Output JSON AST')
    parser.add_argument('--strict', action='store_true', help='Fail on warnings')
    parser.add_argument('-v', '--verbose', action='store_true', help='Verbose output')

    args = parser.parse_args()

    # Read source
    if args.input == '-':
        source = sys.stdin.read()
    else:
        source = Path(args.input).read_text()

    # Convert
    converter = Py2KHL(source)
    graph = converter.convert()

    # Check for errors
    if graph.errors:
        print("ERRORS:", file=sys.stderr)
        for e in graph.errors:
            print(f"  ❌ {e}", file=sys.stderr)
        if not args.verbose:
            sys.exit(1)

    if graph.warnings and args.verbose:
        print("WARNINGS:", file=sys.stderr)
        for w in graph.warnings:
            print(f"  ⚠️ {w}", file=sys.stderr)

    if args.strict and graph.warnings:
        print("Strict mode: failing on warnings", file=sys.stderr)
        sys.exit(1)

    # Output
    if args.json:
        print(json.dumps(graph.to_json(), indent=2))
    elif args.ast:
        print("=== INTENT GRAPH ===")
        print(f"@Pop ({len(graph.pop)} blocks)")
        for b in graph.pop:
            print(f"  [{b.line}] {b.kind}: {b.khl[:60]}...")
        print(f"@Wo ({len(graph.wo)} blocks)")
        for b in graph.wo:
            print(f"  [{b.line}] {b.kind}: {b.khl[:60]}...")
        print(f"@Sek ({len(graph.sek)} blocks)")
        for b in graph.sek:
            print(f"  [{b.line}] {b.kind}: {b.khl[:60]}...")
        print(f"@Collapse ({len(graph.collapse)} blocks)")
        for b in graph.collapse:
            print(f"  [{b.line}] {b.kind}: {b.khl[:60]}...")
    else:
        khl = graph.to_khl()

        if args.output:
            Path(args.output).write_text(khl)
            print(f"✅ Written to {args.output}")

            # Generate hash
            khl_hash = hashlib.sha256(khl.encode()).hexdigest()[:16]
            print(f"   Hash: {khl_hash}")
            print(f"   Size: {len(khl)} bytes")
        else:
            print(khl)


if __name__ == '__main__':
    main()
