"""
API Middleware
==============
Authentication, rate limiting, and request processing.
"""

import time
from typing import Callable, Dict
from collections import defaultdict
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import logging

from config import settings

logger = logging.getLogger(__name__)


class APIKeyMiddleware(BaseHTTPMiddleware):
    """API Key authentication middleware."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip auth for certain paths
        skip_paths = ["/", "/health", "/docs", "/redoc", "/openapi.json"]
        if request.url.path in skip_paths:
            return await call_next(request)

        # Check for API key
        api_key = request.headers.get("Authorization", "").replace("Bearer ", "")

        if not api_key:
            api_key = request.headers.get("X-API-Key", "")

        if not api_key or api_key not in settings.API_KEYS:
            return JSONResponse(
                status_code=401,
                content={
                    "error": {
                        "message": "Invalid or missing API key",
                        "type": "authentication_error",
                        "code": "invalid_api_key"
                    }
                }
            )

        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware."""

    def __init__(self, app, **kwargs):
        super().__init__(app, **kwargs)
        self.request_counts: Dict[str, list] = defaultdict(list)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Get client identifier
        client_id = self._get_client_id(request)

        # Check rate limit
        now = time.time()
        window_start = now - settings.RATE_LIMIT_WINDOW

        # Clean old requests
        self.request_counts[client_id] = [
            t for t in self.request_counts[client_id]
            if t > window_start
        ]

        # Check limit
        if len(self.request_counts[client_id]) >= settings.RATE_LIMIT_REQUESTS:
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "message": "Rate limit exceeded",
                        "type": "rate_limit_error",
                        "code": "rate_limit_exceeded"
                    }
                },
                headers={
                    "Retry-After": str(settings.RATE_LIMIT_WINDOW),
                    "X-RateLimit-Limit": str(settings.RATE_LIMIT_REQUESTS),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(window_start + settings.RATE_LIMIT_WINDOW))
                }
            )

        # Record request
        self.request_counts[client_id].append(now)

        # Add rate limit headers
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(settings.RATE_LIMIT_REQUESTS)
        response.headers["X-RateLimit-Remaining"] = str(
            settings.RATE_LIMIT_REQUESTS - len(self.request_counts[client_id])
        )
        response.headers["X-RateLimit-Reset"] = str(int(window_start + settings.RATE_LIMIT_WINDOW))

        return response

    def _get_client_id(self, request: Request) -> str:
        """Get client identifier for rate limiting."""
        # Try API key first
        api_key = request.headers.get("Authorization", "").replace("Bearer ", "")
        if api_key:
            return f"key:{api_key[:8]}"

        # Fall back to IP
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return f"ip:{forwarded.split(',')[0].strip()}"

        return f"ip:{request.client.host if request.client else 'unknown'}"
