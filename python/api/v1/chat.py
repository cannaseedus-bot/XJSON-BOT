"""
Chat Completions API
====================
OpenAI-compatible chat completions endpoint.

Endpoints:
- POST /v1/chat/completions - Chat completion with optional streaming
"""

import json
import time
import uuid
from typing import List, Optional
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse
import logging

from models.base import Message, GenerationConfig

logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== REQUEST/RESPONSE MODELS ====================

class ChatMessage(BaseModel):
    """Chat message."""
    role: str = Field(..., description="Message role: system, user, assistant")
    content: str = Field(..., description="Message content")
    name: Optional[str] = Field(None, description="Optional name")


class ChatCompletionRequest(BaseModel):
    """Chat completion request (OpenAI-compatible)."""
    model: str = Field(..., description="Model ID to use")
    messages: List[ChatMessage] = Field(..., description="Conversation messages")
    temperature: Optional[float] = Field(0.7, ge=0, le=2)
    top_p: Optional[float] = Field(1.0, ge=0, le=1)
    max_tokens: Optional[int] = Field(4096, ge=1)
    stream: Optional[bool] = Field(False)
    stop: Optional[List[str]] = Field(None)
    user: Optional[str] = Field(None)


class ChatChoice(BaseModel):
    """Chat completion choice."""
    index: int
    message: ChatMessage
    finish_reason: str


class ChatUsage(BaseModel):
    """Token usage."""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatCompletionResponse(BaseModel):
    """Chat completion response (OpenAI-compatible)."""
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[ChatChoice]
    usage: Optional[ChatUsage] = None


# ==================== ENDPOINTS ====================

@router.post("/chat/completions")
async def create_chat_completion(
    request: Request,
    body: ChatCompletionRequest
):
    """
    Create a chat completion.

    OpenAI-compatible endpoint supporting:
    - Multiple models (OpenAI, Anthropic, DeepSeek, Ollama, Janus)
    - Streaming responses (SSE)
    - Auto-routing based on task type
    """
    try:
        router_instance = request.app.state.router

        # Convert messages
        messages = [
            Message(role=m.role, content=m.content, name=m.name)
            for m in body.messages
        ]

        # Build config
        config = GenerationConfig(
            max_tokens=body.max_tokens or 4096,
            temperature=body.temperature or 0.7,
            top_p=body.top_p or 1.0,
            stop=body.stop,
            stream=body.stream or False
        )

        # Handle streaming
        if body.stream:
            return EventSourceResponse(
                stream_response(router_instance, messages, body.model, config),
                media_type="text/event-stream"
            )

        # Non-streaming response
        response = await router_instance.route(messages, body.model, config)

        # Build OpenAI-compatible response
        completion_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"

        return ChatCompletionResponse(
            id=completion_id,
            created=int(time.time()),
            model=response.model,
            choices=[
                ChatChoice(
                    index=0,
                    message=ChatMessage(role="assistant", content=response.content),
                    finish_reason=response.finish_reason
                )
            ],
            usage=ChatUsage(
                prompt_tokens=response.usage.get("prompt_tokens", 0) if response.usage else 0,
                completion_tokens=response.usage.get("completion_tokens", 0) if response.usage else 0,
                total_tokens=response.usage.get("total_tokens", 0) if response.usage else 0
            ) if response.usage else None
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Chat completion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def stream_response(router_instance, messages, model_id, config):
    """Generate SSE stream for chat completion."""
    completion_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"
    created = int(time.time())

    try:
        async for chunk in router_instance.route_stream(messages, model_id, config):
            # OpenAI-compatible streaming format
            data = {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model_id,
                "choices": [{
                    "index": 0,
                    "delta": {"content": chunk},
                    "finish_reason": None
                }]
            }
            yield {"data": json.dumps(data)}

        # Final message with finish_reason
        final_data = {
            "id": completion_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model_id,
            "choices": [{
                "index": 0,
                "delta": {},
                "finish_reason": "stop"
            }]
        }
        yield {"data": json.dumps(final_data)}
        yield {"data": "[DONE]"}

    except Exception as e:
        logger.error(f"Stream error: {e}")
        error_data = {
            "error": {
                "message": str(e),
                "type": "stream_error"
            }
        }
        yield {"data": json.dumps(error_data)}
