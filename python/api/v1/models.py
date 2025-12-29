"""
Models API
==========
Model management and listing endpoints.

Endpoints:
- GET /v1/models - List available models
- GET /v1/models/{model_id} - Get model details
"""

from typing import List, Optional
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
import logging

from config import MODEL_REGISTRY

logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== RESPONSE MODELS ====================

class ModelInfo(BaseModel):
    """Model information (OpenAI-compatible)."""
    id: str
    object: str = "model"
    created: int = 1700000000
    owned_by: str
    permission: List[dict] = []
    root: str
    parent: Optional[str] = None


class ModelDetails(BaseModel):
    """Extended model details."""
    id: str
    name: str
    provider: str
    capabilities: List[str]
    context_length: int
    is_local: bool
    loaded: bool
    pricing: Optional[dict] = None


class ModelListResponse(BaseModel):
    """Model list response."""
    object: str = "list"
    data: List[ModelInfo]


# ==================== ENDPOINTS ====================

@router.get("/models")
async def list_models(request: Request) -> ModelListResponse:
    """
    List all available models.

    OpenAI-compatible endpoint.
    """
    router_instance = request.app.state.router

    models = []
    for model_id, info in MODEL_REGISTRY.items():
        models.append(ModelInfo(
            id=model_id,
            owned_by=info.get("provider", "unknown"),
            root=model_id,
            parent=None
        ))

    return ModelListResponse(data=models)


@router.get("/models/{model_id}")
async def get_model(request: Request, model_id: str) -> ModelDetails:
    """
    Get details for a specific model.
    """
    router_instance = request.app.state.router

    info = router_instance.get_model_info(model_id)
    if not info:
        raise HTTPException(status_code=404, detail=f"Model not found: {model_id}")

    return ModelDetails(
        id=model_id,
        name=info.get("name", model_id),
        provider=info.get("provider", "unknown"),
        capabilities=info.get("capabilities", []),
        context_length=info.get("context_length", 4096),
        is_local=info.get("local", False),
        loaded=info.get("loaded", False),
        pricing=info.get("pricing")
    )


@router.get("/models/loaded")
async def list_loaded_models(request: Request):
    """
    List currently loaded models.
    """
    router_instance = request.app.state.router

    loaded = []
    for model_id, model in router_instance.models.items():
        if model.is_loaded():
            loaded.append({
                "id": model_id,
                "info": model.info.__dict__ if model.info else {}
            })

    return {"loaded_models": loaded, "count": len(loaded)}


@router.post("/models/{model_id}/load")
async def load_model(request: Request, model_id: str):
    """
    Load a model into memory.
    """
    router_instance = request.app.state.router

    try:
        model = await router_instance.get_model(model_id)
        if model and model.is_loaded():
            return {"success": True, "model_id": model_id, "status": "loaded"}
        else:
            return {"success": False, "model_id": model_id, "status": "failed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/models/{model_id}/unload")
async def unload_model(request: Request, model_id: str):
    """
    Unload a model from memory.
    """
    router_instance = request.app.state.router

    if model_id in router_instance.models:
        await router_instance.models[model_id].unload()
        del router_instance.models[model_id]
        return {"success": True, "model_id": model_id, "status": "unloaded"}

    raise HTTPException(status_code=404, detail=f"Model not loaded: {model_id}")


@router.get("/models/capabilities")
async def list_capabilities():
    """
    List model capabilities and which models support them.
    """
    capabilities = {}

    for model_id, info in MODEL_REGISTRY.items():
        for cap in info.get("capabilities", []):
            if cap not in capabilities:
                capabilities[cap] = []
            capabilities[cap].append(model_id)

    return {"capabilities": capabilities}
