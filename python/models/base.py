"""
Base Model Class
================
Abstract base class for all AI models in the multi-brain architecture.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, AsyncIterator
import logging

logger = logging.getLogger(__name__)


class ModelCapability(Enum):
    """Model capabilities for routing."""
    TEXT = "text"
    CODE = "code"
    REASONING = "reasoning"
    IMAGE_GEN = "image-gen"
    VISION = "vision"
    AUDIO = "audio"
    EMBEDDING = "embedding"


@dataclass
class Message:
    """Chat message."""
    role: str  # 'system', 'user', 'assistant'
    content: str
    name: Optional[str] = None
    images: Optional[List[str]] = None  # Base64 encoded images


@dataclass
class GenerationConfig:
    """Generation configuration."""
    max_tokens: int = 4096
    temperature: float = 0.7
    top_p: float = 1.0
    top_k: int = 50
    stop: Optional[List[str]] = None
    stream: bool = False


@dataclass
class ModelResponse:
    """Model response."""
    content: str
    model: str
    finish_reason: str = "stop"
    usage: Optional[Dict[str, int]] = None
    reasoning_trace: Optional[str] = None  # For reasoning models
    images: Optional[List[str]] = None  # For image generation


@dataclass
class ModelInfo:
    """Model information."""
    id: str
    name: str
    provider: str
    capabilities: List[ModelCapability]
    context_length: int = 4096
    is_local: bool = False
    pricing: Optional[Dict[str, float]] = None


class BaseModel(ABC):
    """
    Abstract base class for AI models.

    All models (OpenAI, Anthropic, DeepSeek, Janus, Ollama)
    must implement this interface for the multi-brain router.
    """

    def __init__(self, model_id: str):
        self.model_id = model_id
        self.info: Optional[ModelInfo] = None
        self._loaded = False

    @abstractmethod
    async def load(self) -> bool:
        """Load/initialize the model."""
        pass

    @abstractmethod
    async def unload(self) -> bool:
        """Unload the model to free resources."""
        pass

    @abstractmethod
    async def generate(
        self,
        messages: List[Message],
        config: Optional[GenerationConfig] = None
    ) -> ModelResponse:
        """Generate a response."""
        pass

    @abstractmethod
    async def stream(
        self,
        messages: List[Message],
        config: Optional[GenerationConfig] = None
    ) -> AsyncIterator[str]:
        """Stream a response."""
        pass

    def has_capability(self, capability: ModelCapability) -> bool:
        """Check if model has a capability."""
        if self.info is None:
            return False
        return capability in self.info.capabilities

    def is_loaded(self) -> bool:
        """Check if model is loaded."""
        return self._loaded

    async def health_check(self) -> bool:
        """Check if model is healthy."""
        return self._loaded


class OpenAIModel(BaseModel):
    """OpenAI API model wrapper."""

    def __init__(self, model_id: str, api_key: str):
        super().__init__(model_id)
        self.api_key = api_key
        self.client = None

    async def load(self) -> bool:
        """Initialize OpenAI client."""
        try:
            from openai import AsyncOpenAI
            self.client = AsyncOpenAI(api_key=self.api_key)
            self.info = ModelInfo(
                id=self.model_id,
                name=self.model_id,
                provider="openai",
                capabilities=[ModelCapability.TEXT, ModelCapability.CODE],
                context_length=128000
            )
            self._loaded = True
            return True
        except Exception as e:
            logger.error(f"Failed to load OpenAI model: {e}")
            return False

    async def unload(self) -> bool:
        self.client = None
        self._loaded = False
        return True

    async def generate(
        self,
        messages: List[Message],
        config: Optional[GenerationConfig] = None
    ) -> ModelResponse:
        if not self.client:
            raise RuntimeError("Model not loaded")

        config = config or GenerationConfig()

        response = await self.client.chat.completions.create(
            model=self.model_id,
            messages=[{"role": m.role, "content": m.content} for m in messages],
            max_tokens=config.max_tokens,
            temperature=config.temperature,
            top_p=config.top_p,
            stop=config.stop
        )

        return ModelResponse(
            content=response.choices[0].message.content,
            model=self.model_id,
            finish_reason=response.choices[0].finish_reason,
            usage={
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            }
        )

    async def stream(
        self,
        messages: List[Message],
        config: Optional[GenerationConfig] = None
    ) -> AsyncIterator[str]:
        if not self.client:
            raise RuntimeError("Model not loaded")

        config = config or GenerationConfig()

        stream = await self.client.chat.completions.create(
            model=self.model_id,
            messages=[{"role": m.role, "content": m.content} for m in messages],
            max_tokens=config.max_tokens,
            temperature=config.temperature,
            stream=True
        )

        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


class AnthropicModel(BaseModel):
    """Anthropic API model wrapper."""

    def __init__(self, model_id: str, api_key: str):
        super().__init__(model_id)
        self.api_key = api_key
        self.client = None

    async def load(self) -> bool:
        try:
            import anthropic
            self.client = anthropic.AsyncAnthropic(api_key=self.api_key)
            self.info = ModelInfo(
                id=self.model_id,
                name=self.model_id,
                provider="anthropic",
                capabilities=[ModelCapability.TEXT, ModelCapability.CODE, ModelCapability.REASONING],
                context_length=200000
            )
            self._loaded = True
            return True
        except Exception as e:
            logger.error(f"Failed to load Anthropic model: {e}")
            return False

    async def unload(self) -> bool:
        self.client = None
        self._loaded = False
        return True

    async def generate(
        self,
        messages: List[Message],
        config: Optional[GenerationConfig] = None
    ) -> ModelResponse:
        if not self.client:
            raise RuntimeError("Model not loaded")

        config = config or GenerationConfig()

        # Extract system message
        system = ""
        chat_messages = []
        for m in messages:
            if m.role == "system":
                system = m.content
            else:
                chat_messages.append({"role": m.role, "content": m.content})

        response = await self.client.messages.create(
            model=self.model_id,
            max_tokens=config.max_tokens,
            system=system,
            messages=chat_messages
        )

        return ModelResponse(
            content=response.content[0].text,
            model=self.model_id,
            finish_reason=response.stop_reason,
            usage={
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens,
                "total_tokens": response.usage.input_tokens + response.usage.output_tokens
            }
        )

    async def stream(
        self,
        messages: List[Message],
        config: Optional[GenerationConfig] = None
    ) -> AsyncIterator[str]:
        if not self.client:
            raise RuntimeError("Model not loaded")

        config = config or GenerationConfig()

        system = ""
        chat_messages = []
        for m in messages:
            if m.role == "system":
                system = m.content
            else:
                chat_messages.append({"role": m.role, "content": m.content})

        async with self.client.messages.stream(
            model=self.model_id,
            max_tokens=config.max_tokens,
            system=system,
            messages=chat_messages
        ) as stream:
            async for text in stream.text_stream:
                yield text


class OllamaModel(BaseModel):
    """Ollama local model wrapper."""

    def __init__(self, model_id: str, base_url: str = "http://localhost:11434"):
        super().__init__(model_id)
        self.base_url = base_url

    async def load(self) -> bool:
        import httpx

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code == 200:
                    self.info = ModelInfo(
                        id=self.model_id,
                        name=self.model_id,
                        provider="ollama",
                        capabilities=[ModelCapability.TEXT, ModelCapability.CODE],
                        context_length=32000,
                        is_local=True
                    )
                    self._loaded = True
                    return True
        except Exception as e:
            logger.error(f"Failed to connect to Ollama: {e}")

        return False

    async def unload(self) -> bool:
        self._loaded = False
        return True

    async def generate(
        self,
        messages: List[Message],
        config: Optional[GenerationConfig] = None
    ) -> ModelResponse:
        import httpx

        config = config or GenerationConfig()

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model_id,
                    "messages": [{"role": m.role, "content": m.content} for m in messages],
                    "stream": False,
                    "options": {
                        "temperature": config.temperature,
                        "num_predict": config.max_tokens
                    }
                }
            )

            data = response.json()
            return ModelResponse(
                content=data["message"]["content"],
                model=self.model_id,
                finish_reason="stop"
            )

    async def stream(
        self,
        messages: List[Message],
        config: Optional[GenerationConfig] = None
    ) -> AsyncIterator[str]:
        import httpx

        config = config or GenerationConfig()

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model_id,
                    "messages": [{"role": m.role, "content": m.content} for m in messages],
                    "stream": True,
                    "options": {
                        "temperature": config.temperature,
                        "num_predict": config.max_tokens
                    }
                }
            ) as response:
                import json
                async for line in response.aiter_lines():
                    if line:
                        data = json.loads(line)
                        if "message" in data and "content" in data["message"]:
                            yield data["message"]["content"]
