"""
Multi-Brain Model Router
========================
Routes requests to appropriate models based on task type.

Routing Strategy:
- Text/Chat → LLM (OpenAI, Anthropic, Ollama)
- Reasoning → DeepSeek R1
- Image Generation → Janus
- Vision/Image Understanding → Janus
- Code → Specialized code models
"""

import re
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import logging

from .base import (
    BaseModel,
    ModelCapability,
    Message,
    GenerationConfig,
    ModelResponse,
    OpenAIModel,
    AnthropicModel,
    OllamaModel
)
from .deepseek_r1 import DeepSeekR1, DeepSeekChat
from .janus import JanusModel, JanusFlowModel

from config import settings, MODEL_REGISTRY

logger = logging.getLogger(__name__)


@dataclass
class RoutingDecision:
    """Routing decision for a request."""
    model_id: str
    capability: ModelCapability
    confidence: float
    reason: str


class ModelRouter:
    """
    Multi-Brain Model Router

    Intelligently routes requests to the most appropriate model
    based on the task type, content, and available models.
    """

    # Task detection patterns
    PATTERNS = {
        ModelCapability.IMAGE_GEN: [
            r"generate\s+(an?\s+)?image",
            r"create\s+(an?\s+)?image",
            r"draw\s+",
            r"make\s+(an?\s+)?(picture|image|art)",
            r"visualize",
            r"illustrate"
        ],
        ModelCapability.VISION: [
            r"what('s|\s+is)\s+in\s+(this|the)\s+image",
            r"describe\s+(this|the)\s+image",
            r"analyze\s+(this|the)\s+(image|photo|picture)",
            r"look\s+at\s+(this|the)",
            r"can\s+you\s+see"
        ],
        ModelCapability.REASONING: [
            r"explain\s+step\s+by\s+step",
            r"think\s+through",
            r"reason\s+about",
            r"analyze\s+carefully",
            r"what\s+are\s+the\s+implications",
            r"complex\s+problem",
            r"mathematical\s+proof",
            r"logical\s+analysis"
        ],
        ModelCapability.CODE: [
            r"write\s+(a\s+)?(code|function|program|script)",
            r"implement\s+",
            r"debug\s+",
            r"fix\s+(this|the)\s+(code|bug|error)",
            r"refactor\s+",
            r"```\w+"
        ]
    }

    def __init__(self):
        self.models: Dict[str, BaseModel] = {}
        self.default_models: Dict[ModelCapability, str] = {}

    async def load_models(self):
        """Load configured models."""
        logger.info("Loading models...")

        # Load default models based on config
        await self._load_default_models()

        logger.info(f"Loaded {len(self.models)} models")

    async def _load_default_models(self):
        """Load default models from configuration."""

        # OpenAI
        if settings.OPENAI_API_KEY:
            model = OpenAIModel(settings.DEFAULT_CHAT_MODEL, settings.OPENAI_API_KEY)
            if await model.load():
                self.models[settings.DEFAULT_CHAT_MODEL] = model
                self.default_models[ModelCapability.TEXT] = settings.DEFAULT_CHAT_MODEL

        # Anthropic
        if settings.ANTHROPIC_API_KEY:
            model = AnthropicModel("claude-3-5-sonnet-20241022", settings.ANTHROPIC_API_KEY)
            if await model.load():
                self.models["claude-3-5-sonnet"] = model

        # DeepSeek R1
        if settings.DEEPSEEK_API_KEY:
            model = DeepSeekR1(settings.DEFAULT_REASONING_MODEL, settings.DEEPSEEK_API_KEY)
            if await model.load():
                self.models[settings.DEFAULT_REASONING_MODEL] = model
                self.default_models[ModelCapability.REASONING] = settings.DEFAULT_REASONING_MODEL

        # Ollama (local)
        try:
            model = OllamaModel("llama3.2", settings.OLLAMA_BASE_URL)
            if await model.load():
                self.models["llama3.2"] = model
                if ModelCapability.TEXT not in self.default_models:
                    self.default_models[ModelCapability.TEXT] = "llama3.2"
        except Exception:
            logger.info("Ollama not available")

        # Note: Janus is loaded on-demand due to GPU memory requirements
        self.default_models[ModelCapability.IMAGE_GEN] = settings.DEFAULT_IMAGE_MODEL
        self.default_models[ModelCapability.VISION] = settings.DEFAULT_IMAGE_MODEL

    async def unload_models(self):
        """Unload all models."""
        for model_id, model in self.models.items():
            await model.unload()
        self.models.clear()

    def detect_task_type(self, messages: List[Message]) -> RoutingDecision:
        """
        Detect the task type from messages.

        Returns:
            RoutingDecision with model and confidence
        """
        # Get last user message
        user_message = ""
        has_images = False

        for m in reversed(messages):
            if m.role == "user":
                user_message = m.content.lower()
                has_images = bool(m.images)
                break

        # Check for images first
        if has_images:
            return RoutingDecision(
                model_id=self.default_models.get(ModelCapability.VISION, "janus-1.3b"),
                capability=ModelCapability.VISION,
                confidence=0.95,
                reason="Image attached - using vision model"
            )

        # Check patterns
        for capability, patterns in self.PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, user_message, re.IGNORECASE):
                    model_id = self.default_models.get(capability)
                    if model_id:
                        return RoutingDecision(
                            model_id=model_id,
                            capability=capability,
                            confidence=0.85,
                            reason=f"Pattern match: {pattern}"
                        )

        # Default to text model
        return RoutingDecision(
            model_id=self.default_models.get(ModelCapability.TEXT, settings.DEFAULT_CHAT_MODEL),
            capability=ModelCapability.TEXT,
            confidence=0.5,
            reason="Default text model"
        )

    async def get_model(self, model_id: str) -> Optional[BaseModel]:
        """Get or load a specific model."""
        if model_id in self.models:
            return self.models[model_id]

        # Try to load on demand
        model = await self._create_model(model_id)
        if model and await model.load():
            self.models[model_id] = model
            return model

        return None

    async def _create_model(self, model_id: str) -> Optional[BaseModel]:
        """Create a model instance by ID."""
        info = MODEL_REGISTRY.get(model_id)
        if not info:
            return None

        provider = info.get("provider")

        if provider == "openai":
            return OpenAIModel(model_id, settings.OPENAI_API_KEY)
        elif provider == "anthropic":
            return AnthropicModel(model_id, settings.ANTHROPIC_API_KEY)
        elif provider == "deepseek":
            return DeepSeekR1(model_id, settings.DEEPSEEK_API_KEY)
        elif provider == "ollama":
            return OllamaModel(model_id, settings.OLLAMA_BASE_URL)
        elif provider == "janus":
            if "flow" in model_id:
                return JanusFlowModel()
            return JanusModel(model_id)

        return None

    async def route(
        self,
        messages: List[Message],
        model_id: Optional[str] = None,
        config: Optional[GenerationConfig] = None
    ) -> ModelResponse:
        """
        Route request to appropriate model and generate response.

        Args:
            messages: Chat messages
            model_id: Optional specific model to use
            config: Generation configuration

        Returns:
            Model response
        """
        # Use specific model if provided
        if model_id:
            model = await self.get_model(model_id)
            if not model:
                raise ValueError(f"Model not available: {model_id}")
        else:
            # Auto-detect task type
            decision = self.detect_task_type(messages)
            logger.info(f"Routing decision: {decision}")
            model = await self.get_model(decision.model_id)

            if not model:
                # Fallback to any available model
                if self.models:
                    model = list(self.models.values())[0]
                else:
                    raise ValueError("No models available")

        # Generate response
        return await model.generate(messages, config)

    async def route_stream(
        self,
        messages: List[Message],
        model_id: Optional[str] = None,
        config: Optional[GenerationConfig] = None
    ):
        """Stream routed response."""
        if model_id:
            model = await self.get_model(model_id)
        else:
            decision = self.detect_task_type(messages)
            model = await self.get_model(decision.model_id)

        if not model:
            raise ValueError("No model available")

        async for chunk in model.stream(messages, config):
            yield chunk

    def list_models(self) -> List[Dict[str, Any]]:
        """List available models."""
        models = []

        for model_id, info in MODEL_REGISTRY.items():
            models.append({
                "id": model_id,
                "name": model_id,
                "provider": info.get("provider"),
                "capabilities": info.get("capabilities", []),
                "context_length": info.get("context_length", 4096),
                "local": info.get("local", False),
                "loaded": model_id in self.models,
                "pricing": info.get("pricing")
            })

        return models

    def get_model_info(self, model_id: str) -> Optional[Dict[str, Any]]:
        """Get info for a specific model."""
        if model_id in MODEL_REGISTRY:
            info = MODEL_REGISTRY[model_id].copy()
            info["id"] = model_id
            info["loaded"] = model_id in self.models
            return info
        return None
