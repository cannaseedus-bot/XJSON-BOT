"""
Token Utilities
===============
Token counting and cost estimation.
"""

from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

# Try to import tiktoken
try:
    import tiktoken
    HAS_TIKTOKEN = True
except ImportError:
    HAS_TIKTOKEN = False
    logger.warning("tiktoken not available - using approximate counting")


def count_tokens(text: str, model: str = "gpt-4") -> int:
    """
    Count tokens in text.

    Args:
        text: Text to count
        model: Model to use for encoding

    Returns:
        Token count
    """
    if HAS_TIKTOKEN:
        try:
            encoding = tiktoken.encoding_for_model(model)
            return len(encoding.encode(text))
        except Exception:
            # Fall back to cl100k_base for unknown models
            encoding = tiktoken.get_encoding("cl100k_base")
            return len(encoding.encode(text))
    else:
        # Approximate: ~4 chars per token
        return len(text) // 4


def count_messages_tokens(messages: List[dict], model: str = "gpt-4") -> int:
    """
    Count tokens in a list of messages.

    Args:
        messages: List of message dicts with 'role' and 'content'
        model: Model to use

    Returns:
        Total token count
    """
    total = 0

    for msg in messages:
        # Each message has overhead (~4 tokens for role + formatting)
        total += 4
        total += count_tokens(msg.get("content", ""), model)
        if msg.get("name"):
            total += count_tokens(msg["name"], model)
            total += 1  # Extra for name

    total += 2  # Conversation overhead

    return total


def estimate_cost(
    prompt_tokens: int,
    completion_tokens: int,
    model: str
) -> dict:
    """
    Estimate cost for API call.

    Args:
        prompt_tokens: Input token count
        completion_tokens: Output token count
        model: Model ID

    Returns:
        Cost breakdown
    """
    # Pricing per 1M tokens (as of late 2024)
    PRICING = {
        # OpenAI
        "gpt-4o": {"input": 2.50, "output": 10.00},
        "gpt-4o-mini": {"input": 0.15, "output": 0.60},
        "gpt-4-turbo": {"input": 10.00, "output": 30.00},
        "gpt-3.5-turbo": {"input": 0.50, "output": 1.50},

        # Anthropic
        "claude-3-5-sonnet": {"input": 3.00, "output": 15.00},
        "claude-3-5-haiku": {"input": 0.25, "output": 1.25},
        "claude-3-opus": {"input": 15.00, "output": 75.00},

        # DeepSeek
        "deepseek-r1": {"input": 0.55, "output": 2.19},
        "deepseek-r1-lite": {"input": 0.14, "output": 0.28},
        "deepseek-chat": {"input": 0.14, "output": 0.28},
    }

    # Get pricing for model (default to gpt-4o-mini if unknown)
    pricing = PRICING.get(model, PRICING.get("gpt-4o-mini"))

    prompt_cost = (prompt_tokens / 1_000_000) * pricing["input"]
    completion_cost = (completion_tokens / 1_000_000) * pricing["output"]
    total_cost = prompt_cost + completion_cost

    return {
        "model": model,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens,
        "prompt_cost_usd": round(prompt_cost, 6),
        "completion_cost_usd": round(completion_cost, 6),
        "total_cost_usd": round(total_cost, 6),
        "pricing_per_1m": pricing
    }


def estimate_max_tokens(
    messages: List[dict],
    model: str,
    context_length: int = 128000
) -> int:
    """
    Estimate maximum completion tokens available.

    Args:
        messages: Input messages
        model: Model ID
        context_length: Model's context window

    Returns:
        Max available completion tokens
    """
    prompt_tokens = count_messages_tokens(messages, model)
    available = context_length - prompt_tokens

    # Reserve some buffer
    return max(0, available - 100)
