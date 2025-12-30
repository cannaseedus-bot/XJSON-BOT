"""
XJSON-BOT Configuration
=======================
Environment-based configuration using pydantic-settings.
"""

from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    WORKERS: int = 1

    # CORS
    CORS_ORIGINS: List[str] = ["*"]

    # API Security
    API_KEY_REQUIRED: bool = False
    API_KEYS: List[str] = []
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60  # seconds

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./xjson.db"
    REDIS_URL: Optional[str] = None

    # K'UHUL Engine
    KUHUL_GLYPH_DELIMITER: str = "⟁"
    KUHUL_HAZARD_PREFIX: str = "☣"
    KUHUL_COMPRESSION_ENABLED: bool = True

    # Model Providers
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    DEEPSEEK_API_KEY: Optional[str] = None
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    # Default Models
    DEFAULT_CHAT_MODEL: str = "gpt-4o-mini"
    DEFAULT_IMAGE_MODEL: str = "janus-1.3b"
    DEFAULT_REASONING_MODEL: str = "deepseek-r1"

    # Janus Settings
    JANUS_MODEL_PATH: str = "deepseek-ai/Janus-1.3B"
    JANUS_DEVICE: str = "cuda"  # or "cpu"
    JANUS_BATCH_SIZE: int = 4

    # Paths
    MODELS_DIR: str = "./models"
    CACHE_DIR: str = "./cache"
    UPLOADS_DIR: str = "./uploads"

    # Token Limits
    MAX_TOKENS: int = 4096
    MAX_CONTEXT_LENGTH: int = 128000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Global settings instance
settings = Settings()


# Model registry
MODEL_REGISTRY = {
    # OpenAI
    "gpt-4o": {
        "provider": "openai",
        "capabilities": ["text", "code", "reasoning"],
        "context_length": 128000,
        "pricing": {"input": 2.50, "output": 10.00}
    },
    "gpt-4o-mini": {
        "provider": "openai",
        "capabilities": ["text", "code"],
        "context_length": 128000,
        "pricing": {"input": 0.15, "output": 0.60}
    },

    # Anthropic
    "claude-3-5-sonnet": {
        "provider": "anthropic",
        "capabilities": ["text", "code", "reasoning"],
        "context_length": 200000,
        "pricing": {"input": 3.00, "output": 15.00}
    },
    "claude-3-5-haiku": {
        "provider": "anthropic",
        "capabilities": ["text", "code"],
        "context_length": 200000,
        "pricing": {"input": 0.25, "output": 1.25}
    },

    # DeepSeek
    "deepseek-r1": {
        "provider": "deepseek",
        "capabilities": ["text", "code", "reasoning"],
        "context_length": 64000,
        "pricing": {"input": 0.55, "output": 2.19}
    },
    "deepseek-r1-lite": {
        "provider": "deepseek",
        "capabilities": ["text", "reasoning"],
        "context_length": 32000,
        "pricing": {"input": 0.14, "output": 0.28}
    },
    "deepseek-chat": {
        "provider": "deepseek",
        "capabilities": ["text", "code"],
        "context_length": 64000,
        "pricing": {"input": 0.14, "output": 0.28}
    },

    # Janus (Local)
    "janus-1.3b": {
        "provider": "janus",
        "capabilities": ["text", "image-gen", "vision"],
        "context_length": 4096,
        "local": True
    },
    "janus-pro-7b": {
        "provider": "janus",
        "capabilities": ["text", "image-gen", "vision"],
        "context_length": 4096,
        "local": True
    },
    "janusflow-1.3b": {
        "provider": "janus",
        "capabilities": ["image-gen"],
        "context_length": 4096,
        "local": True
    },

    # Ollama (Local)
    "llama3.2": {
        "provider": "ollama",
        "capabilities": ["text", "code"],
        "context_length": 128000,
        "local": True
    },
    "qwen2.5": {
        "provider": "ollama",
        "capabilities": ["text", "code"],
        "context_length": 32000,
        "local": True
    },
    "codellama": {
        "provider": "ollama",
        "capabilities": ["code"],
        "context_length": 16000,
        "local": True
    }
}
