"""
XJSON-BOT API Server
====================
FastAPI-based REST API with K'UHUL engine and multi-model support.

Endpoints:
- /v1/chat/completions     - Chat with streaming
- /v1/images/generations   - Image generation (Janus)
- /v1/models               - Model management
- /v1/kuhul/*              - K'UHUL operations
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from config import settings
from api.v1 import chat, images, models, kuhul
from api.middleware import APIKeyMiddleware, RateLimitMiddleware
from core.kuhul import KuhulEngine
from models.router import ModelRouter

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown."""
    # Startup
    logger.info("🚀 Starting XJSON-BOT API Server...")

    # Initialize K'UHUL engine
    app.state.kuhul = KuhulEngine()
    await app.state.kuhul.initialize()
    logger.info("⟁ K'UHUL engine initialized")

    # Initialize model router
    app.state.router = ModelRouter()
    await app.state.router.load_models()
    logger.info("🧠 Model router initialized")

    yield

    # Shutdown
    logger.info("Shutting down XJSON-BOT API Server...")
    await app.state.kuhul.shutdown()
    await app.state.router.unload_models()


# Create FastAPI app
app = FastAPI(
    title="XJSON-BOT API",
    description="Multi-model AI API with K'UHUL engine",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom middleware
if settings.API_KEY_REQUIRED:
    app.add_middleware(APIKeyMiddleware)

if settings.RATE_LIMIT_ENABLED:
    app.add_middleware(RateLimitMiddleware)

# Include routers
app.include_router(chat.router, prefix="/v1", tags=["Chat"])
app.include_router(images.router, prefix="/v1", tags=["Images"])
app.include_router(models.router, prefix="/v1", tags=["Models"])
app.include_router(kuhul.router, prefix="/v1/kuhul", tags=["K'UHUL"])


@app.get("/")
async def root():
    """API root - health check and info."""
    return {
        "name": "XJSON-BOT API",
        "version": "1.0.0",
        "status": "healthy",
        "engine": "K'UHUL",
        "endpoints": {
            "chat": "/v1/chat/completions",
            "images": "/v1/images/generations",
            "models": "/v1/models",
            "kuhul": "/v1/kuhul/*",
            "docs": "/docs"
        }
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "kuhul": "active",
        "models_loaded": True
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler."""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "message": str(exc),
                "type": type(exc).__name__,
                "code": "internal_error"
            }
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=settings.WORKERS
    )
