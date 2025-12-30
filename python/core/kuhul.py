"""
K'UHUL Engine - Python Implementation
=====================================
Glyph-based execution runtime for AI operations.

Glyphs:
- ⟁ - Operation delimiter
- ☣ - SCXQ2 hazard prefix

Operations:
- store_weights    - Store model weights
- load_weights     - Load model weights
- accumulate       - Accumulate gradients
- quantize         - Quantize weights (8-bit)
- compress         - SCXQ2 compression
- decompress       - SCXQ2 decompression
"""

import asyncio
import json
import hashlib
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field
from datetime import datetime
import logging

from .scxq2 import SCXQ2

logger = logging.getLogger(__name__)


@dataclass
class KuhulProcess:
    """Active K'UHUL process."""
    id: str
    op: str
    status: str  # 'running', 'complete', 'error'
    started: datetime
    completed: Optional[datetime] = None
    result: Optional[Any] = None
    error: Optional[str] = None


@dataclass
class KuhulState:
    """K'UHUL engine state."""
    processes: Dict[str, KuhulProcess] = field(default_factory=dict)
    weights: Dict[str, Any] = field(default_factory=dict)
    gradients: Dict[str, Any] = field(default_factory=dict)
    optimizers: Dict[str, Any] = field(default_factory=dict)
    checkpoints: Dict[str, Any] = field(default_factory=dict)
    memory: Dict[str, Any] = field(default_factory=dict)


class KuhulEngine:
    """
    K'UHUL Execution Engine

    Glyph-based runtime for AI operations with SCXQ2 compression.
    Port of the JavaScript kuhul-engine.js to Python.
    """

    GLYPH = "⟁"  # Operation delimiter
    HAZARD = "☣"  # SCXQ2 prefix

    def __init__(self):
        self.state = KuhulState()
        self.scxq2 = SCXQ2()
        self.handlers: Dict[str, Callable] = {}
        self._initialized = False

    async def initialize(self):
        """Initialize the K'UHUL engine."""
        if self._initialized:
            return

        # Register default handlers
        self._register_handlers()

        logger.info(f"{self.GLYPH} K'UHUL Engine initialized")
        self._initialized = True

    async def shutdown(self):
        """Shutdown the engine gracefully."""
        # Clear all processes
        for proc_id in list(self.state.processes.keys()):
            await self.kill(proc_id)

        self._initialized = False
        logger.info(f"{self.GLYPH} K'UHUL Engine shutdown")

    def _register_handlers(self):
        """Register operation handlers."""
        self.handlers = {
            "store_weights": self._handle_store_weights,
            "load_weights": self._handle_load_weights,
            "accumulate": self._handle_accumulate,
            "quantize": self._handle_quantize,
            "compress": self._handle_compress,
            "decompress": self._handle_decompress,
            "checkpoint": self._handle_checkpoint,
            "restore": self._handle_restore,
            "remember": self._handle_remember,
            "recall": self._handle_recall,
        }

    def parse_glyph(self, code: str) -> Dict[str, Any]:
        """
        Parse glyph-based operation code.

        Format: ⟁Category⟁operation⟁param1⟁value1⟁param2⟁value2⟁
        """
        if not code.startswith(self.GLYPH):
            raise ValueError(f"Invalid glyph code: must start with {self.GLYPH}")

        parts = code.split(self.GLYPH)
        parts = [p for p in parts if p]  # Remove empty strings

        if len(parts) < 2:
            raise ValueError("Invalid glyph code: need at least category and operation")

        category = parts[0]
        operation = parts[1]
        params = {}

        # Parse key-value pairs
        for i in range(2, len(parts) - 1, 2):
            if i + 1 < len(parts):
                params[parts[i]] = parts[i + 1]

        return {
            "category": category,
            "operation": operation,
            "params": params,
            "raw": code
        }

    async def run(self, op_id: str, code: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Execute a K'UHUL operation.

        Args:
            op_id: Unique operation identifier
            code: Glyph-based operation code
            context: Additional context data

        Returns:
            Operation result
        """
        context = context or {}

        # Parse glyph code
        parsed = self.parse_glyph(code)

        # Create process
        process = KuhulProcess(
            id=op_id,
            op=parsed["operation"],
            status="running",
            started=datetime.now()
        )
        self.state.processes[op_id] = process

        try:
            # Find handler
            handler = self.handlers.get(parsed["operation"])
            if not handler:
                raise ValueError(f"Unknown operation: {parsed['operation']}")

            # Execute handler
            result = await handler(parsed, context)

            # Update process
            process.status = "complete"
            process.completed = datetime.now()
            process.result = result

            return {
                "op": parsed["operation"],
                "status": "complete",
                "result": result
            }

        except Exception as e:
            process.status = "error"
            process.error = str(e)
            logger.error(f"K'UHUL error in {parsed['operation']}: {e}")

            return {
                "op": parsed["operation"],
                "status": "error",
                "error": str(e)
            }

    async def kill(self, proc_id: str) -> bool:
        """Kill a running process."""
        if proc_id in self.state.processes:
            del self.state.processes[proc_id]
            return True
        return False

    # ==================== WEIGHT OPERATIONS ====================

    async def _handle_store_weights(self, parsed: Dict, ctx: Dict) -> Dict:
        """Store model weights."""
        model_id = ctx.get("model_id") or parsed["params"].get("model")
        weights = ctx.get("weights")
        format_type = parsed["params"].get("format", "raw")

        if not model_id or weights is None:
            raise ValueError("model_id and weights required")

        # Apply compression if requested
        if format_type == "scxq2":
            weights = self.scxq2.compress(weights)

        self.state.weights[model_id] = {
            "data": weights,
            "format": format_type,
            "stored_at": datetime.now().isoformat(),
            "size": len(json.dumps(weights)) if isinstance(weights, dict) else len(str(weights))
        }

        return {
            "model_id": model_id,
            "format": format_type,
            "stored": True
        }

    async def _handle_load_weights(self, parsed: Dict, ctx: Dict) -> Dict:
        """Load model weights."""
        model_id = ctx.get("model_id") or parsed["params"].get("model")

        if not model_id:
            raise ValueError("model_id required")

        if model_id not in self.state.weights:
            raise ValueError(f"No weights found for model: {model_id}")

        weight_data = self.state.weights[model_id]

        # Decompress if needed
        if weight_data["format"] == "scxq2":
            data = self.scxq2.decompress(weight_data["data"])
        else:
            data = weight_data["data"]

        return {
            "model_id": model_id,
            "weights": data,
            "format": weight_data["format"]
        }

    # ==================== GRADIENT OPERATIONS ====================

    async def _handle_accumulate(self, parsed: Dict, ctx: Dict) -> Dict:
        """Accumulate gradients."""
        model_id = ctx.get("model_id") or parsed["params"].get("model")
        gradients = ctx.get("gradients")

        if not model_id or gradients is None:
            raise ValueError("model_id and gradients required")

        if model_id not in self.state.gradients:
            self.state.gradients[model_id] = {
                "accumulated": [],
                "count": 0
            }

        grad_state = self.state.gradients[model_id]
        grad_state["accumulated"].append(gradients)
        grad_state["count"] += 1

        return {
            "model_id": model_id,
            "gradient_count": grad_state["count"],
            "accumulated": True
        }

    # ==================== QUANTIZATION ====================

    async def _handle_quantize(self, parsed: Dict, ctx: Dict) -> Dict:
        """Quantize weights to lower precision."""
        model_id = ctx.get("model_id") or parsed["params"].get("model")
        bits = int(parsed["params"].get("bits", 8))

        if model_id not in self.state.weights:
            raise ValueError(f"No weights found for model: {model_id}")

        weight_data = self.state.weights[model_id]

        # Simulate quantization (actual implementation would use numpy/torch)
        quantized = {
            "data": weight_data["data"],
            "bits": bits,
            "scale": 1.0,
            "zero_point": 0
        }

        self.state.weights[f"{model_id}_q{bits}"] = {
            "data": quantized,
            "format": f"q{bits}",
            "stored_at": datetime.now().isoformat()
        }

        return {
            "model_id": model_id,
            "quantized_id": f"{model_id}_q{bits}",
            "bits": bits
        }

    # ==================== COMPRESSION ====================

    async def _handle_compress(self, parsed: Dict, ctx: Dict) -> Dict:
        """Compress data with SCXQ2."""
        data = ctx.get("data")
        if data is None:
            raise ValueError("data required for compression")

        compressed = self.scxq2.compress(data)

        return {
            "compressed": compressed,
            "original_size": len(json.dumps(data)) if isinstance(data, dict) else len(str(data)),
            "compressed_size": len(compressed),
            "ratio": len(compressed) / (len(json.dumps(data)) if isinstance(data, dict) else len(str(data)))
        }

    async def _handle_decompress(self, parsed: Dict, ctx: Dict) -> Dict:
        """Decompress SCXQ2 data."""
        data = ctx.get("data")
        if data is None:
            raise ValueError("data required for decompression")

        decompressed = self.scxq2.decompress(data)

        return {
            "decompressed": decompressed
        }

    # ==================== CHECKPOINTS ====================

    async def _handle_checkpoint(self, parsed: Dict, ctx: Dict) -> Dict:
        """Create a checkpoint."""
        model_id = ctx.get("model_id") or parsed["params"].get("model")
        checkpoint_id = ctx.get("checkpoint_id") or f"ckpt_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        checkpoint = {
            "id": checkpoint_id,
            "model_id": model_id,
            "weights": self.state.weights.get(model_id),
            "gradients": self.state.gradients.get(model_id),
            "optimizer": self.state.optimizers.get(model_id),
            "created_at": datetime.now().isoformat()
        }

        # Compress checkpoint
        compressed = self.scxq2.compress(checkpoint)
        self.state.checkpoints[checkpoint_id] = compressed

        return {
            "checkpoint_id": checkpoint_id,
            "model_id": model_id,
            "created": True
        }

    async def _handle_restore(self, parsed: Dict, ctx: Dict) -> Dict:
        """Restore from checkpoint."""
        checkpoint_id = ctx.get("checkpoint_id") or parsed["params"].get("checkpoint")

        if checkpoint_id not in self.state.checkpoints:
            raise ValueError(f"Checkpoint not found: {checkpoint_id}")

        compressed = self.state.checkpoints[checkpoint_id]
        checkpoint = self.scxq2.decompress(compressed)

        model_id = checkpoint["model_id"]

        if checkpoint.get("weights"):
            self.state.weights[model_id] = checkpoint["weights"]
        if checkpoint.get("gradients"):
            self.state.gradients[model_id] = checkpoint["gradients"]
        if checkpoint.get("optimizer"):
            self.state.optimizers[model_id] = checkpoint["optimizer"]

        return {
            "checkpoint_id": checkpoint_id,
            "model_id": model_id,
            "restored": True
        }

    # ==================== MEMORY OPERATIONS ====================

    async def _handle_remember(self, parsed: Dict, ctx: Dict) -> Dict:
        """Store in memory system."""
        key = ctx.get("key") or parsed["params"].get("key")
        value = ctx.get("value")
        category = ctx.get("category", "general")
        confidence = ctx.get("confidence", 1.0)

        if not key or value is None:
            raise ValueError("key and value required")

        memory_entry = {
            "value": value,
            "category": category,
            "confidence": confidence,
            "access_count": 0,
            "created_at": datetime.now().isoformat(),
            "last_accessed": datetime.now().isoformat()
        }

        if category not in self.state.memory:
            self.state.memory[category] = {}

        self.state.memory[category][key] = memory_entry

        return {
            "key": key,
            "category": category,
            "remembered": True
        }

    async def _handle_recall(self, parsed: Dict, ctx: Dict) -> Dict:
        """Recall from memory system."""
        key = ctx.get("key") or parsed["params"].get("key")
        category = ctx.get("category", "general")

        if category not in self.state.memory:
            return {"key": key, "found": False}

        if key not in self.state.memory[category]:
            return {"key": key, "found": False}

        entry = self.state.memory[category][key]
        entry["access_count"] += 1
        entry["last_accessed"] = datetime.now().isoformat()

        return {
            "key": key,
            "value": entry["value"],
            "category": category,
            "confidence": entry["confidence"],
            "found": True
        }

    # ==================== UTILITY METHODS ====================

    def get_status(self) -> Dict[str, Any]:
        """Get engine status."""
        return {
            "initialized": self._initialized,
            "processes": len(self.state.processes),
            "models_stored": len(self.state.weights),
            "checkpoints": len(self.state.checkpoints),
            "memory_categories": len(self.state.memory)
        }

    def list_weights(self) -> List[str]:
        """List stored weight model IDs."""
        return list(self.state.weights.keys())

    def list_checkpoints(self) -> List[str]:
        """List checkpoint IDs."""
        return list(self.state.checkpoints.keys())
