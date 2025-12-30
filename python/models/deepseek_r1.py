"""
DeepSeek R1 Model Wrapper
=========================
Reasoning model with Chain-of-Thought (CoT) support.

Features:
- Reasoning trace extraction
- Thinking/reflection display
- Extended context for complex reasoning
"""

import re
from typing import List, Optional, AsyncIterator
import logging

from .base import (
    BaseModel,
    ModelInfo,
    ModelCapability,
    Message,
    GenerationConfig,
    ModelResponse
)

logger = logging.getLogger(__name__)


class DeepSeekR1(BaseModel):
    """
    DeepSeek R1 Reasoning Model

    Specialized wrapper for DeepSeek's R1 reasoning model family.
    Extracts and formats Chain-of-Thought reasoning traces.
    """

    # R1 model variants
    VARIANTS = {
        "deepseek-r1": {
            "context_length": 64000,
            "pricing": {"input": 0.55, "output": 2.19}
        },
        "deepseek-r1-0528": {
            "context_length": 64000,
            "pricing": {"input": 0.55, "output": 2.19}
        },
        "deepseek-r1-lite": {
            "context_length": 32000,
            "pricing": {"input": 0.14, "output": 0.28}
        }
    }

    # Reasoning markers
    THINK_START = "<think>"
    THINK_END = "</think>"

    def __init__(self, model_id: str = "deepseek-r1", api_key: Optional[str] = None):
        super().__init__(model_id)
        self.api_key = api_key
        self.client = None
        self.base_url = "https://api.deepseek.com"

    async def load(self) -> bool:
        """Initialize DeepSeek client."""
        try:
            from openai import AsyncOpenAI

            self.client = AsyncOpenAI(
                api_key=self.api_key,
                base_url=self.base_url
            )

            variant = self.VARIANTS.get(self.model_id, self.VARIANTS["deepseek-r1"])

            self.info = ModelInfo(
                id=self.model_id,
                name=f"DeepSeek {self.model_id.upper()}",
                provider="deepseek",
                capabilities=[
                    ModelCapability.TEXT,
                    ModelCapability.CODE,
                    ModelCapability.REASONING
                ],
                context_length=variant["context_length"],
                pricing=variant["pricing"]
            )

            self._loaded = True
            logger.info(f"DeepSeek R1 loaded: {self.model_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to load DeepSeek R1: {e}")
            return False

    async def unload(self) -> bool:
        self.client = None
        self._loaded = False
        return True

    def _extract_reasoning(self, content: str) -> tuple:
        """
        Extract reasoning trace from response.

        Returns:
            (answer, reasoning_trace)
        """
        # Check for <think> tags
        think_match = re.search(
            f"{self.THINK_START}(.*?){self.THINK_END}",
            content,
            re.DOTALL
        )

        if think_match:
            reasoning = think_match.group(1).strip()
            answer = re.sub(
                f"{self.THINK_START}.*?{self.THINK_END}",
                "",
                content,
                flags=re.DOTALL
            ).strip()
            return answer, reasoning

        return content, None

    async def generate(
        self,
        messages: List[Message],
        config: Optional[GenerationConfig] = None
    ) -> ModelResponse:
        """Generate with reasoning trace extraction."""
        if not self.client:
            raise RuntimeError("DeepSeek R1 not loaded")

        config = config or GenerationConfig()

        # Add reasoning instruction if needed
        enhanced_messages = list(messages)
        if not any("think step by step" in m.content.lower() for m in messages):
            # Prepend reasoning instruction
            if enhanced_messages and enhanced_messages[0].role == "system":
                enhanced_messages[0] = Message(
                    role="system",
                    content=enhanced_messages[0].content + "\n\nThink through your reasoning step by step before answering."
                )

        response = await self.client.chat.completions.create(
            model=self.model_id,
            messages=[{"role": m.role, "content": m.content} for m in enhanced_messages],
            max_tokens=config.max_tokens,
            temperature=config.temperature,
            top_p=config.top_p,
            stop=config.stop
        )

        raw_content = response.choices[0].message.content
        answer, reasoning = self._extract_reasoning(raw_content)

        return ModelResponse(
            content=answer,
            model=self.model_id,
            finish_reason=response.choices[0].finish_reason,
            reasoning_trace=reasoning,
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
        """Stream with reasoning markers."""
        if not self.client:
            raise RuntimeError("DeepSeek R1 not loaded")

        config = config or GenerationConfig()

        stream = await self.client.chat.completions.create(
            model=self.model_id,
            messages=[{"role": m.role, "content": m.content} for m in messages],
            max_tokens=config.max_tokens,
            temperature=config.temperature,
            stream=True
        )

        in_thinking = False
        buffer = ""

        async for chunk in stream:
            if chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                buffer += content

                # Track thinking state
                if self.THINK_START in buffer and not in_thinking:
                    in_thinking = True
                    yield "\n💭 **Reasoning:**\n"
                    # Yield content after think tag
                    idx = buffer.find(self.THINK_START) + len(self.THINK_START)
                    yield buffer[idx:]
                    buffer = ""
                elif self.THINK_END in buffer and in_thinking:
                    in_thinking = False
                    # Yield content before end tag
                    idx = buffer.find(self.THINK_END)
                    yield buffer[:idx]
                    yield "\n\n**Answer:**\n"
                    buffer = buffer[idx + len(self.THINK_END):]
                elif in_thinking or not in_thinking:
                    yield content

    async def reason(
        self,
        question: str,
        context: Optional[str] = None,
        depth: str = "standard"
    ) -> ModelResponse:
        """
        Dedicated reasoning method.

        Args:
            question: The question to reason about
            context: Optional context/background
            depth: 'quick', 'standard', or 'deep'
        """
        # Build reasoning prompt
        depth_instructions = {
            "quick": "Provide a brief, focused analysis.",
            "standard": "Think through the problem step by step.",
            "deep": "Conduct a thorough, multi-perspective analysis. Consider edge cases, alternatives, and implications."
        }

        messages = []

        if context:
            messages.append(Message(
                role="system",
                content=f"Context:\n{context}\n\n{depth_instructions.get(depth, depth_instructions['standard'])}"
            ))
        else:
            messages.append(Message(
                role="system",
                content=depth_instructions.get(depth, depth_instructions['standard'])
            ))

        messages.append(Message(role="user", content=question))

        config = GenerationConfig(
            max_tokens=8192 if depth == "deep" else 4096,
            temperature=0.3 if depth == "quick" else 0.7
        )

        return await self.generate(messages, config)


class DeepSeekChat(DeepSeekR1):
    """
    DeepSeek Chat Model

    General-purpose chat model (non-reasoning variant).
    """

    def __init__(self, api_key: Optional[str] = None):
        super().__init__("deepseek-chat", api_key)

    async def load(self) -> bool:
        try:
            from openai import AsyncOpenAI

            self.client = AsyncOpenAI(
                api_key=self.api_key,
                base_url=self.base_url
            )

            self.info = ModelInfo(
                id="deepseek-chat",
                name="DeepSeek Chat",
                provider="deepseek",
                capabilities=[ModelCapability.TEXT, ModelCapability.CODE],
                context_length=64000,
                pricing={"input": 0.14, "output": 0.28}
            )

            self._loaded = True
            return True

        except Exception as e:
            logger.error(f"Failed to load DeepSeek Chat: {e}")
            return False

    def _extract_reasoning(self, content: str) -> tuple:
        """No reasoning extraction for chat model."""
        return content, None
