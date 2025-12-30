"""
Images API
==========
Image generation and understanding endpoints.

Endpoints:
- POST /v1/images/generations - Generate images from text
- POST /v1/images/understand - Analyze/understand images
"""

import time
import uuid
from typing import List, Optional
from fastapi import APIRouter, Request, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
import base64
import logging

from models.janus import JanusModel
from models.base import Message, GenerationConfig

logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== REQUEST/RESPONSE MODELS ====================

class ImageGenerationRequest(BaseModel):
    """Image generation request (OpenAI-compatible)."""
    model: str = Field("janus-1.3b", description="Model to use")
    prompt: str = Field(..., description="Text description of image")
    n: int = Field(1, ge=1, le=4, description="Number of images")
    size: str = Field("384x384", description="Image size")
    response_format: str = Field("b64_json", description="Response format")
    cfg_scale: float = Field(5.0, description="Classifier-free guidance scale")
    temperature: float = Field(1.0, description="Sampling temperature")


class ImageData(BaseModel):
    """Generated image data."""
    b64_json: Optional[str] = None
    url: Optional[str] = None
    revised_prompt: Optional[str] = None


class ImageGenerationResponse(BaseModel):
    """Image generation response."""
    created: int
    data: List[ImageData]


class ImageUnderstandRequest(BaseModel):
    """Image understanding request."""
    model: str = Field("janus-1.3b", description="Model to use")
    image: str = Field(..., description="Base64-encoded image or URL")
    prompt: str = Field("Describe this image.", description="Question about the image")
    max_tokens: int = Field(512, description="Max response tokens")


class ImageUnderstandResponse(BaseModel):
    """Image understanding response."""
    id: str
    created: int
    model: str
    content: str


# ==================== ENDPOINTS ====================

@router.post("/images/generations")
async def create_image(
    request: Request,
    body: ImageGenerationRequest
):
    """
    Generate images from text prompt.

    Uses Janus multimodal model for text-to-image generation.
    """
    try:
        router_instance = request.app.state.router

        # Get or load Janus model
        model = await router_instance.get_model(body.model)
        if not model:
            raise HTTPException(
                status_code=400,
                detail=f"Model not available: {body.model}"
            )

        # Check if model supports image generation
        if not isinstance(model, JanusModel):
            raise HTTPException(
                status_code=400,
                detail=f"Model {body.model} does not support image generation"
            )

        # Parse size
        try:
            width, height = map(int, body.size.split("x"))
            image_size = min(width, height, 384)  # Janus max is 384
        except:
            image_size = 384

        # Generate images
        response = await model.generate_image(
            prompt=body.prompt,
            num_images=body.n,
            cfg_weight=body.cfg_scale,
            temperature=body.temperature,
            image_size=image_size
        )

        # Build response
        data = []
        if response.images:
            for img in response.images:
                if body.response_format == "b64_json":
                    # Extract base64 from data URL
                    if img.startswith("data:"):
                        b64 = img.split(",", 1)[1]
                    else:
                        b64 = img
                    data.append(ImageData(b64_json=b64))
                else:
                    data.append(ImageData(url=img))

        return ImageGenerationResponse(
            created=int(time.time()),
            data=data
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/images/understand")
async def understand_image(
    request: Request,
    body: ImageUnderstandRequest
):
    """
    Analyze and understand an image.

    Uses Janus vision capabilities.
    """
    try:
        router_instance = request.app.state.router

        # Get model
        model = await router_instance.get_model(body.model)
        if not model:
            raise HTTPException(
                status_code=400,
                detail=f"Model not available: {body.model}"
            )

        # Build message with image
        messages = [
            Message(
                role="user",
                content=body.prompt,
                images=[body.image]
            )
        ]

        config = GenerationConfig(max_tokens=body.max_tokens)

        # Generate response
        response = await model.generate(messages, config)

        return ImageUnderstandResponse(
            id=f"img-{uuid.uuid4().hex[:16]}",
            created=int(time.time()),
            model=body.model,
            content=response.content
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image understanding error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/images/upload")
async def upload_image(
    request: Request,
    file: UploadFile = File(...)
):
    """
    Upload an image for processing.

    Returns base64-encoded image for use with other endpoints.
    """
    try:
        # Read file
        contents = await file.read()

        # Encode to base64
        b64 = base64.b64encode(contents).decode()

        # Determine content type
        content_type = file.content_type or "image/png"

        # Build data URL
        data_url = f"data:{content_type};base64,{b64}"

        return {
            "success": True,
            "filename": file.filename,
            "content_type": content_type,
            "size": len(contents),
            "data_url": data_url
        }

    except Exception as e:
        logger.error(f"Image upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
