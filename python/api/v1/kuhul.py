"""
K'UHUL API
==========
K'UHUL engine operations via REST API.

Endpoints:
- POST /v1/kuhul/run - Execute K'UHUL operation
- GET /v1/kuhul/status - Engine status
- GET /v1/kuhul/weights - List stored weights
- POST /v1/kuhul/compress - SCXQ2 compression
- POST /v1/kuhul/decompress - SCXQ2 decompression
"""

from typing import Any, Optional, Dict
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== REQUEST/RESPONSE MODELS ====================

class KuhulRunRequest(BaseModel):
    """K'UHUL operation request."""
    op_id: str = Field(..., description="Operation ID")
    code: str = Field(..., description="Glyph-based operation code")
    context: Optional[Dict[str, Any]] = Field(None, description="Operation context")


class KuhulRunResponse(BaseModel):
    """K'UHUL operation response."""
    op: str
    status: str
    result: Optional[Any] = None
    error: Optional[str] = None


class CompressRequest(BaseModel):
    """SCXQ2 compression request."""
    data: Any = Field(..., description="Data to compress")


class CompressResponse(BaseModel):
    """SCXQ2 compression response."""
    compressed: str
    original_size: int
    compressed_size: int
    ratio: float


class DecompressRequest(BaseModel):
    """SCXQ2 decompression request."""
    data: str = Field(..., description="SCXQ2 compressed data")


class MemoryRequest(BaseModel):
    """Memory operation request."""
    key: str
    value: Optional[Any] = None
    category: str = "general"
    confidence: float = 1.0


# ==================== ENDPOINTS ====================

@router.post("/run")
async def run_operation(
    request: Request,
    body: KuhulRunRequest
) -> KuhulRunResponse:
    """
    Execute a K'UHUL operation.

    Glyph syntax: ⟁Category⟁operation⟁param1⟁value1⟁...
    """
    try:
        kuhul = request.app.state.kuhul

        result = await kuhul.run(body.op_id, body.code, body.context)

        return KuhulRunResponse(
            op=result.get("op", "unknown"),
            status=result.get("status", "unknown"),
            result=result.get("result"),
            error=result.get("error")
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"K'UHUL error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_status(request: Request):
    """
    Get K'UHUL engine status.
    """
    kuhul = request.app.state.kuhul
    return kuhul.get_status()


@router.get("/weights")
async def list_weights(request: Request):
    """
    List stored model weights.
    """
    kuhul = request.app.state.kuhul
    weights = kuhul.list_weights()

    return {
        "weights": weights,
        "count": len(weights)
    }


@router.get("/checkpoints")
async def list_checkpoints(request: Request):
    """
    List stored checkpoints.
    """
    kuhul = request.app.state.kuhul
    checkpoints = kuhul.list_checkpoints()

    return {
        "checkpoints": checkpoints,
        "count": len(checkpoints)
    }


@router.post("/compress")
async def compress_data(
    request: Request,
    body: CompressRequest
) -> CompressResponse:
    """
    Compress data with SCXQ2.
    """
    try:
        kuhul = request.app.state.kuhul

        result = await kuhul.run(
            "compress_op",
            "⟁Compress⟁compress⟁",
            {"data": body.data}
        )

        if result.get("status") == "error":
            raise HTTPException(status_code=500, detail=result.get("error"))

        res = result.get("result", {})
        return CompressResponse(
            compressed=res.get("compressed", ""),
            original_size=res.get("original_size", 0),
            compressed_size=res.get("compressed_size", 0),
            ratio=res.get("ratio", 0)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Compression error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/decompress")
async def decompress_data(
    request: Request,
    body: DecompressRequest
):
    """
    Decompress SCXQ2 data.
    """
    try:
        kuhul = request.app.state.kuhul

        result = await kuhul.run(
            "decompress_op",
            "⟁Compress⟁decompress⟁",
            {"data": body.data}
        )

        if result.get("status") == "error":
            raise HTTPException(status_code=500, detail=result.get("error"))

        return result.get("result", {})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Decompression error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/memory/remember")
async def remember(
    request: Request,
    body: MemoryRequest
):
    """
    Store in K'UHUL memory system.
    """
    try:
        kuhul = request.app.state.kuhul

        result = await kuhul.run(
            f"remember_{body.key}",
            "⟁Memory⟁remember⟁",
            {
                "key": body.key,
                "value": body.value,
                "category": body.category,
                "confidence": body.confidence
            }
        )

        return result.get("result", {})

    except Exception as e:
        logger.error(f"Memory error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/memory/recall/{category}/{key}")
async def recall(
    request: Request,
    category: str,
    key: str
):
    """
    Recall from K'UHUL memory system.
    """
    try:
        kuhul = request.app.state.kuhul

        result = await kuhul.run(
            f"recall_{key}",
            "⟁Memory⟁recall⟁",
            {"key": key, "category": category}
        )

        return result.get("result", {})

    except Exception as e:
        logger.error(f"Memory recall error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/weights/store")
async def store_weights(
    request: Request,
    model_id: str,
    weights: Any,
    format: str = "raw"
):
    """
    Store model weights.
    """
    try:
        kuhul = request.app.state.kuhul

        result = await kuhul.run(
            f"store_{model_id}",
            f"⟁Weights⟁store_weights⟁format⟁{format}⟁",
            {"model_id": model_id, "weights": weights}
        )

        return result.get("result", {})

    except Exception as e:
        logger.error(f"Store weights error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/weights/{model_id}")
async def load_weights(
    request: Request,
    model_id: str
):
    """
    Load model weights.
    """
    try:
        kuhul = request.app.state.kuhul

        result = await kuhul.run(
            f"load_{model_id}",
            "⟁Weights⟁load_weights⟁",
            {"model_id": model_id}
        )

        if result.get("status") == "error":
            raise HTTPException(status_code=404, detail=result.get("error"))

        return result.get("result", {})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Load weights error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
