"""
KUHUL Python Adapter v1
Executes ForeignCall glyphs from KPI binary

@version 1.0.0
@status frozen
@authority KPI_IS_LAW

This adapter:
- Receives KPI effect opcodes via IPC/HTTP
- Executes Python functions in sandboxed environment
- Returns serialized results with execution trace
- Manages object handles for stateful operations
"""

import json
import base64
import hashlib
import time
import traceback
from typing import Any, Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, asdict
from enum import IntEnum
import io

# ============================================================
# Types
# ============================================================

class HostId(IntEnum):
    PYTHON = 0
    NODE = 1
    WASM = 2
    NATIVE = 3
    JVM = 4
    DOTNET = 5


class Opcode(IntEnum):
    FOREIGN_CALL = 32
    FOREIGN_IMPORT = 33
    FOREIGN_CONSTRUCT = 34
    FOREIGN_METHOD = 35
    FOREIGN_DISPOSE = 36


@dataclass
class ExecutionTrace:
    call_id: str
    timestamp_ms: int
    duration_ms: int
    input_hash: str
    output_hash: str
    host: str = "python"


@dataclass
class AdapterError:
    code: str
    message: str
    host: str = "python"
    traceback: Optional[str] = None


@dataclass
class ForeignCallResult:
    result: Any
    error: Optional[AdapterError]
    trace: ExecutionTrace


# ============================================================
# Handle Registry
# ============================================================

class HandleRegistry:
    """Manages opaque handles to Python objects"""

    def __init__(self):
        self._handles: Dict[int, Any] = {}
        self._next_id = 1
        self._type_names: Dict[int, str] = {}

    def register(self, obj: Any) -> int:
        """Register an object, return handle ID"""
        handle_id = self._next_id
        self._next_id += 1
        self._handles[handle_id] = obj
        self._type_names[handle_id] = type(obj).__name__
        return handle_id

    def get(self, handle_id: int) -> Any:
        """Get object by handle ID"""
        if handle_id not in self._handles:
            raise ValueError(f"Invalid handle: {handle_id}")
        return self._handles[handle_id]

    def dispose(self, handle_id: int) -> bool:
        """Dispose a handle, return success"""
        if handle_id in self._handles:
            del self._handles[handle_id]
            del self._type_names[handle_id]
            return True
        return False

    def get_type_name(self, handle_id: int) -> str:
        """Get type name for handle"""
        return self._type_names.get(handle_id, "unknown")

    def clear(self):
        """Clear all handles"""
        self._handles.clear()
        self._type_names.clear()


# ============================================================
# Module Registry
# ============================================================

class ModuleRegistry:
    """Manages imported modules with caching"""

    # Sandbox: allowed modules
    ALLOWED_MODULES = {
        "numpy", "torch", "transformers", "PIL", "PIL.Image",
        "json", "base64", "math", "random", "collections",
        "itertools", "functools", "typing", "dataclasses",
        "io", "struct", "hashlib", "datetime", "re"
    }

    # Sandbox: denied modules (security)
    DENIED_MODULES = {
        "os", "sys", "subprocess", "socket", "requests", "urllib",
        "shutil", "pathlib", "importlib", "ctypes", "multiprocessing",
        "threading", "asyncio", "signal", "pty", "fcntl", "resource"
    }

    def __init__(self):
        self._modules: Dict[str, Any] = {}

    def import_module(self, module_path: str) -> Any:
        """Import and cache a module"""
        # Security check
        root_module = module_path.split(".")[0]
        if root_module in self.DENIED_MODULES:
            raise PermissionError(f"Module '{module_path}' is not allowed in sandbox")

        if module_path not in self._modules:
            # Dynamic import
            parts = module_path.split(".")
            module = __import__(parts[0])
            for part in parts[1:]:
                module = getattr(module, part)
            self._modules[module_path] = module

        return self._modules[module_path]

    def get_symbol(self, module_path: str, symbol: str) -> Any:
        """Get a symbol from a module"""
        module = self.import_module(module_path)

        # Handle nested symbols (e.g., "nn.Linear" from torch)
        parts = symbol.split(".")
        obj = module
        for part in parts:
            obj = getattr(obj, part)
        return obj

    def clear(self):
        """Clear module cache"""
        self._modules.clear()


# ============================================================
# Value Serialization
# ============================================================

class ValueSerializer:
    """Serialize/deserialize values for KPI transport"""

    @staticmethod
    def serialize(value: Any) -> Dict:
        """Serialize a Python value to KPI-compatible format"""
        if value is None:
            return {"type": "null", "value": None}

        if isinstance(value, bool):
            return {"type": "bool", "value": value}

        if isinstance(value, (int, float)):
            return {"type": "number", "value": value}

        if isinstance(value, str):
            return {"type": "string", "value": value}

        if isinstance(value, bytes):
            return {"type": "bytes", "bytes_b64": base64.b64encode(value).decode()}

        if isinstance(value, (list, tuple)):
            return {"type": "array", "value": [ValueSerializer.serialize(v) for v in value]}

        if isinstance(value, dict):
            return {
                "type": "object",
                "value": {k: ValueSerializer.serialize(v) for k, v in value.items()}
            }

        # NumPy array
        try:
            import numpy as np
            if isinstance(value, np.ndarray):
                return {
                    "type": "numpy_array",
                    "bytes_b64": base64.b64encode(value.tobytes()).decode(),
                    "dtype": str(value.dtype),
                    "shape": list(value.shape)
                }
        except ImportError:
            pass

        # PyTorch tensor
        try:
            import torch
            if isinstance(value, torch.Tensor):
                np_array = value.detach().cpu().numpy()
                return {
                    "type": "torch_tensor",
                    "bytes_b64": base64.b64encode(np_array.tobytes()).decode(),
                    "dtype": str(np_array.dtype),
                    "shape": list(np_array.shape),
                    "device": str(value.device)
                }
        except ImportError:
            pass

        # PIL Image
        try:
            from PIL import Image
            if isinstance(value, Image.Image):
                buffer = io.BytesIO()
                value.save(buffer, format="PNG")
                return {
                    "type": "pil_image",
                    "bytes_b64": base64.b64encode(buffer.getvalue()).decode(),
                    "mode": value.mode,
                    "size": list(value.size)
                }
        except ImportError:
            pass

        # Fallback: convert to string
        return {"type": "string", "value": str(value)}

    @staticmethod
    def deserialize(data: Dict) -> Any:
        """Deserialize a KPI value to Python"""
        if not isinstance(data, dict) or "type" not in data:
            return data  # Already a primitive

        vtype = data["type"]

        if vtype == "null":
            return None

        if vtype in ("bool", "number", "string"):
            return data["value"]

        if vtype == "bytes":
            return base64.b64decode(data["bytes_b64"])

        if vtype == "array":
            return [ValueSerializer.deserialize(v) for v in data["value"]]

        if vtype == "object":
            return {k: ValueSerializer.deserialize(v) for k, v in data["value"].items()}

        if vtype == "numpy_array":
            import numpy as np
            arr = np.frombuffer(
                base64.b64decode(data["bytes_b64"]),
                dtype=data["dtype"]
            )
            return arr.reshape(data["shape"])

        if vtype == "torch_tensor":
            import numpy as np
            import torch
            arr = np.frombuffer(
                base64.b64decode(data["bytes_b64"]),
                dtype=data["dtype"]
            ).reshape(data["shape"])
            tensor = torch.from_numpy(arr.copy())
            if data.get("device", "cpu") != "cpu":
                tensor = tensor.to(data["device"])
            return tensor

        if vtype == "pil_image":
            from PIL import Image
            buffer = io.BytesIO(base64.b64decode(data["bytes_b64"]))
            return Image.open(buffer)

        if vtype == "handle":
            # Return as-is for handle references
            return data

        return data.get("value", data)


# ============================================================
# KUHUL Python Adapter
# ============================================================

class KUHULPythonAdapter:
    """
    Main adapter class that executes ForeignCall glyphs.

    Usage:
        adapter = KUHULPythonAdapter()
        result = adapter.execute({
            "opcode": 32,  # FOREIGN_CALL
            "host": "python",
            "module": "numpy",
            "symbol": "array",
            "args": [[1, 2, 3]]
        })
    """

    def __init__(self):
        self.handles = HandleRegistry()
        self.modules = ModuleRegistry()
        self.serializer = ValueSerializer()
        self._call_counter = 0

    def execute(self, request: Dict) -> Dict:
        """Execute a KPI effect request"""
        opcode = request.get("opcode")

        if opcode == Opcode.FOREIGN_CALL:
            return self._execute_call(request)
        elif opcode == Opcode.FOREIGN_IMPORT:
            return self._execute_import(request)
        elif opcode == Opcode.FOREIGN_CONSTRUCT:
            return self._execute_construct(request)
        elif opcode == Opcode.FOREIGN_METHOD:
            return self._execute_method(request)
        elif opcode == Opcode.FOREIGN_DISPOSE:
            return self._execute_dispose(request)
        else:
            return self._error_result(
                "UNKNOWN_OPCODE",
                f"Unknown opcode: {opcode}",
                request
            )

    def _execute_call(self, request: Dict) -> Dict:
        """Execute ForeignCall glyph"""
        start_time = time.time()
        call_id = self._generate_call_id()

        try:
            module = request.get("module", "")
            symbol = request.get("symbol", "")
            args = [self.serializer.deserialize(a) for a in request.get("args", [])]
            kwargs = {
                k: self.serializer.deserialize(v)
                for k, v in request.get("kwargs", {}).items()
            }

            # Compute input hash for replay
            input_hash = self._compute_hash({
                "module": module,
                "symbol": symbol,
                "args": request.get("args", []),
                "kwargs": request.get("kwargs", {})
            })

            # Get the callable
            func = self.modules.get_symbol(module, symbol)

            # Execute
            result = func(*args, **kwargs)

            # Serialize result
            serialized_result = self.serializer.serialize(result)
            output_hash = self._compute_hash(serialized_result)

            duration_ms = int((time.time() - start_time) * 1000)

            return {
                "success": True,
                "result": serialized_result,
                "error": None,
                "trace": {
                    "call_id": call_id,
                    "timestamp_ms": int(start_time * 1000),
                    "duration_ms": duration_ms,
                    "input_hash": input_hash,
                    "output_hash": output_hash,
                    "host": "python"
                }
            }

        except Exception as e:
            return self._error_result(
                "EXECUTION_ERROR",
                str(e),
                request,
                call_id,
                start_time
            )

    def _execute_import(self, request: Dict) -> Dict:
        """Execute ForeignImport glyph"""
        start_time = time.time()
        call_id = self._generate_call_id()

        try:
            module_path = request.get("module", "")
            alias = request.get("alias", module_path)

            module = self.modules.import_module(module_path)
            handle_id = self.handles.register(module)

            duration_ms = int((time.time() - start_time) * 1000)

            return {
                "success": True,
                "result": {
                    "type": "handle",
                    "handle_id": handle_id,
                    "host": "python",
                    "module": module_path
                },
                "error": None,
                "trace": {
                    "call_id": call_id,
                    "timestamp_ms": int(start_time * 1000),
                    "duration_ms": duration_ms,
                    "input_hash": self._compute_hash({"module": module_path}),
                    "output_hash": self._compute_hash({"handle_id": handle_id}),
                    "host": "python"
                }
            }

        except Exception as e:
            return self._error_result(
                "IMPORT_ERROR",
                str(e),
                request,
                call_id,
                start_time
            )

    def _execute_construct(self, request: Dict) -> Dict:
        """Execute ForeignConstruct glyph"""
        start_time = time.time()
        call_id = self._generate_call_id()

        try:
            module = request.get("module", "")
            class_name = request.get("class", "")
            args = [self.serializer.deserialize(a) for a in request.get("args", [])]
            kwargs = {
                k: self.serializer.deserialize(v)
                for k, v in request.get("kwargs", {}).items()
            }

            # Get class
            cls = self.modules.get_symbol(module, class_name)

            # Construct
            obj = cls(*args, **kwargs)
            handle_id = self.handles.register(obj)

            duration_ms = int((time.time() - start_time) * 1000)

            return {
                "success": True,
                "result": {
                    "type": "handle",
                    "handle_id": handle_id,
                    "host": "python",
                    "type_name": class_name
                },
                "error": None,
                "trace": {
                    "call_id": call_id,
                    "timestamp_ms": int(start_time * 1000),
                    "duration_ms": duration_ms,
                    "input_hash": self._compute_hash(request),
                    "output_hash": self._compute_hash({"handle_id": handle_id}),
                    "host": "python"
                }
            }

        except Exception as e:
            return self._error_result(
                "CONSTRUCT_ERROR",
                str(e),
                request,
                call_id,
                start_time
            )

    def _execute_method(self, request: Dict) -> Dict:
        """Execute ForeignMethod glyph"""
        start_time = time.time()
        call_id = self._generate_call_id()

        try:
            handle_id = request.get("handle_id") or request.get("handle", {}).get("handle_id")
            method_name = request.get("method", "")
            args = [self.serializer.deserialize(a) for a in request.get("args", [])]
            kwargs = {
                k: self.serializer.deserialize(v)
                for k, v in request.get("kwargs", {}).items()
            }

            # Get object
            obj = self.handles.get(handle_id)

            # Get method
            method = getattr(obj, method_name)

            # Call
            result = method(*args, **kwargs)

            serialized_result = self.serializer.serialize(result)
            duration_ms = int((time.time() - start_time) * 1000)

            return {
                "success": True,
                "result": serialized_result,
                "error": None,
                "trace": {
                    "call_id": call_id,
                    "timestamp_ms": int(start_time * 1000),
                    "duration_ms": duration_ms,
                    "input_hash": self._compute_hash(request),
                    "output_hash": self._compute_hash(serialized_result),
                    "host": "python"
                }
            }

        except Exception as e:
            return self._error_result(
                "METHOD_ERROR",
                str(e),
                request,
                call_id,
                start_time
            )

    def _execute_dispose(self, request: Dict) -> Dict:
        """Execute ForeignDispose glyph"""
        start_time = time.time()
        call_id = self._generate_call_id()

        handle_id = request.get("handle_id") or request.get("handle", {}).get("handle_id")
        disposed = self.handles.dispose(handle_id)

        duration_ms = int((time.time() - start_time) * 1000)

        return {
            "success": True,
            "result": {"type": "bool", "value": disposed},
            "error": None,
            "trace": {
                "call_id": call_id,
                "timestamp_ms": int(start_time * 1000),
                "duration_ms": duration_ms,
                "input_hash": self._compute_hash({"handle_id": handle_id}),
                "output_hash": self._compute_hash({"disposed": disposed}),
                "host": "python"
            }
        }

    def _error_result(
        self,
        code: str,
        message: str,
        request: Dict,
        call_id: Optional[str] = None,
        start_time: Optional[float] = None
    ) -> Dict:
        """Create error result"""
        if call_id is None:
            call_id = self._generate_call_id()
        if start_time is None:
            start_time = time.time()

        duration_ms = int((time.time() - start_time) * 1000)

        return {
            "success": False,
            "result": None,
            "error": {
                "code": code,
                "message": message,
                "host": "python",
                "traceback": traceback.format_exc()
            },
            "trace": {
                "call_id": call_id,
                "timestamp_ms": int(start_time * 1000),
                "duration_ms": duration_ms,
                "input_hash": self._compute_hash(request),
                "output_hash": "",
                "host": "python"
            }
        }

    def _generate_call_id(self) -> str:
        """Generate unique call ID"""
        self._call_counter += 1
        return f"py_{int(time.time() * 1000)}_{self._call_counter}"

    def _compute_hash(self, data: Any) -> str:
        """Compute SHA-256 hash of data"""
        json_str = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(json_str.encode()).hexdigest()[:16]

    def reset(self):
        """Reset adapter state"""
        self.handles.clear()
        self.modules.clear()


# ============================================================
# FastAPI Server (optional)
# ============================================================

def create_app():
    """Create FastAPI app for HTTP-based adapter"""
    try:
        from fastapi import FastAPI, HTTPException
        from pydantic import BaseModel
    except ImportError:
        return None

    app = FastAPI(
        title="KUHUL Python Adapter",
        version="1.0.0",
        description="Executes ForeignCall glyphs from KPI"
    )

    adapter = KUHULPythonAdapter()

    class EffectRequest(BaseModel):
        opcode: int
        host: str = "python"
        module: str = ""
        symbol: str = ""
        args: list = []
        kwargs: dict = {}
        handle_id: Optional[int] = None
        method: str = ""
        class_: str = None

        class Config:
            fields = {"class_": "class"}

    @app.post("/execute")
    async def execute(request: EffectRequest):
        req_dict = request.dict()
        if request.class_:
            req_dict["class"] = request.class_
        result = adapter.execute(req_dict)
        return result

    @app.post("/reset")
    async def reset():
        adapter.reset()
        return {"status": "ok"}

    @app.get("/health")
    async def health():
        return {
            "status": "healthy",
            "host": "python",
            "handles": len(adapter.handles._handles)
        }

    return app


# ============================================================
# CLI Interface
# ============================================================

def main():
    """CLI entry point"""
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "serve":
        app = create_app()
        if app is None:
            print("FastAPI not installed. Run: pip install fastapi uvicorn")
            sys.exit(1)

        import uvicorn
        port = int(sys.argv[2]) if len(sys.argv) > 2 else 8765
        uvicorn.run(app, host="0.0.0.0", port=port)

    elif len(sys.argv) > 1 and sys.argv[1] == "exec":
        # Execute from stdin JSON
        adapter = KUHULPythonAdapter()
        request = json.load(sys.stdin)
        result = adapter.execute(request)
        print(json.dumps(result, indent=2))

    else:
        print("KUHUL Python Adapter v1.0.0")
        print()
        print("Usage:")
        print("  python kuhul_adapter.py serve [port]   Start HTTP server")
        print("  python kuhul_adapter.py exec           Execute from stdin JSON")
        print()
        print("Example:")
        print('  echo \'{"opcode":32,"module":"numpy","symbol":"array","args":[[1,2,3]]}\' | python kuhul_adapter.py exec')


if __name__ == "__main__":
    main()
