#!/usr/bin/env python3
"""
KUHUL Inference Host (Python)
=============================

Minimal inference backend for KUHUL_JS_HOST integration.
Provides text generation, vision, and image generation endpoints.

Usage:
    # Run standalone server
    python infer_host.py --port 8001

    # Or import and use programmatically
    from infer_host import InferenceHost
    host = InferenceHost(model="Qwen/Qwen2.5-0.5B-Instruct")
    result = host.generate("Hello!")

Supported Models:
    - Text: Qwen2.5, Llama3, DeepSeek, Mistral
    - Vision: Janus Pro, LLaVA
    - Image: Janus Flow, SDXL

Environment:
    MODEL_NAME: Default model to load
    DEVICE: cuda, cpu, or auto
    MAX_MEMORY: GPU memory limit (e.g., "8GB")
"""

import os
import sys
import json
import time
import base64
import hashlib
from pathlib import Path
from typing import Dict, Any, Optional, Generator
from dataclasses import dataclass, field
from io import BytesIO

# ============================================================
# CONFIGURATION
# ============================================================

@dataclass
class InferConfig:
    """Inference configuration"""
    model_name: str = "Qwen/Qwen2.5-0.5B-Instruct"
    device: str = "auto"
    max_memory: Optional[str] = None
    dtype: str = "float16"
    max_tokens: int = 256
    temperature: float = 0.7
    top_p: float = 0.95
    host: str = "0.0.0.0"
    port: int = 8001


# ============================================================
# INFERENCE HOST
# ============================================================

class InferenceHost:
    """
    Minimal inference host for KUHUL integration.
    Loads models lazily and provides generation endpoints.
    """

    def __init__(self, config: Optional[InferConfig] = None):
        self.config = config or InferConfig()
        self.model = None
        self.tokenizer = None
        self.vision_model = None
        self.image_model = None
        self._loaded_models: Dict[str, Any] = {}

    def _ensure_loaded(self, model_type: str = "text"):
        """Lazy load model on first use"""
        if model_type == "text" and self.model is None:
            self._load_text_model()
        elif model_type == "vision" and self.vision_model is None:
            self._load_vision_model()
        elif model_type == "image" and self.image_model is None:
            self._load_image_model()

    def _load_text_model(self):
        """Load text generation model"""
        try:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer

            print(f"Loading text model: {self.config.model_name}")

            self.tokenizer = AutoTokenizer.from_pretrained(
                self.config.model_name,
                trust_remote_code=True
            )

            dtype = getattr(torch, self.config.dtype, torch.float16)

            self.model = AutoModelForCausalLM.from_pretrained(
                self.config.model_name,
                torch_dtype=dtype,
                device_map=self.config.device,
                trust_remote_code=True
            )

            print(f"Model loaded on {self.model.device}")

        except ImportError:
            print("Warning: transformers not installed. Text generation disabled.")
        except Exception as e:
            print(f"Error loading model: {e}")

    def _load_vision_model(self):
        """Load vision-language model"""
        try:
            # Placeholder for vision model loading
            # Could be Janus, LLaVA, etc.
            print("Vision model loading not implemented yet")
        except Exception as e:
            print(f"Error loading vision model: {e}")

    def _load_image_model(self):
        """Load image generation model"""
        try:
            # Placeholder for image generation model
            # Could be Janus Flow, SDXL, etc.
            print("Image model loading not implemented yet")
        except Exception as e:
            print(f"Error loading image model: {e}")

    def generate(
        self,
        prompt: str,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate text from prompt.

        Returns:
            {
                "text": "generated text",
                "tokens": 42,
                "model": "model_name",
                "latency_ms": 123.45
            }
        """
        self._ensure_loaded("text")

        if self.model is None or self.tokenizer is None:
            return {
                "text": "[Model not loaded]",
                "tokens": 0,
                "error": "Model not available"
            }

        max_tokens = max_tokens or self.config.max_tokens
        temperature = temperature or self.config.temperature
        top_p = top_p or self.config.top_p

        start_time = time.perf_counter()

        try:
            import torch

            inputs = self.tokenizer(prompt, return_tensors="pt")
            inputs = {k: v.to(self.model.device) for k, v in inputs.items()}

            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=max_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    do_sample=temperature > 0,
                    pad_token_id=self.tokenizer.eos_token_id
                )

            # Decode only the new tokens
            input_length = inputs["input_ids"].shape[1]
            generated = outputs[0][input_length:]
            text = self.tokenizer.decode(generated, skip_special_tokens=True)

            latency = (time.perf_counter() - start_time) * 1000

            return {
                "text": text,
                "tokens": len(generated),
                "model": self.config.model_name,
                "latency_ms": round(latency, 2)
            }

        except Exception as e:
            return {
                "text": f"[Generation error: {e}]",
                "tokens": 0,
                "error": str(e)
            }

    def generate_stream(
        self,
        prompt: str,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        **kwargs
    ) -> Generator[str, None, None]:
        """
        Stream text generation token by token.
        """
        self._ensure_loaded("text")

        if self.model is None or self.tokenizer is None:
            yield "[Model not loaded]"
            return

        max_tokens = max_tokens or self.config.max_tokens
        temperature = temperature or self.config.temperature

        try:
            import torch
            from transformers import TextIteratorStreamer
            from threading import Thread

            inputs = self.tokenizer(prompt, return_tensors="pt")
            inputs = {k: v.to(self.model.device) for k, v in inputs.items()}

            streamer = TextIteratorStreamer(
                self.tokenizer,
                skip_prompt=True,
                skip_special_tokens=True
            )

            generation_kwargs = dict(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=temperature,
                do_sample=temperature > 0,
                streamer=streamer,
                pad_token_id=self.tokenizer.eos_token_id
            )

            thread = Thread(target=self.model.generate, kwargs=generation_kwargs)
            thread.start()

            for text in streamer:
                yield text

            thread.join()

        except Exception as e:
            yield f"[Stream error: {e}]"

    def vision(
        self,
        image: str,  # base64 encoded
        prompt: str = "Describe this image.",
        max_tokens: int = 512,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Vision inference - analyze image with text prompt.
        """
        self._ensure_loaded("vision")

        # Placeholder implementation
        return {
            "text": "[Vision model not implemented]",
            "tokens": 0,
            "error": "Vision model not available"
        }

    def generate_image(
        self,
        prompt: str,
        negative_prompt: str = "",
        width: int = 512,
        height: int = 512,
        steps: int = 30,
        guidance_scale: float = 7.5,
        seed: Optional[int] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate image from text prompt.
        """
        self._ensure_loaded("image")

        # Placeholder implementation
        return {
            "image": "",
            "format": "png",
            "error": "Image generation not implemented"
        }

    def health(self) -> Dict[str, Any]:
        """Health check endpoint"""
        return {
            "status": "ok",
            "model": self.config.model_name,
            "model_loaded": self.model is not None,
            "device": str(self.model.device) if self.model else "none"
        }


# ============================================================
# FASTAPI SERVER
# ============================================================

def create_app(host: Optional[InferenceHost] = None):
    """Create FastAPI application"""
    try:
        from fastapi import FastAPI, HTTPException
        from fastapi.middleware.cors import CORSMiddleware
        from fastapi.responses import StreamingResponse
        from pydantic import BaseModel
        from typing import List, Optional
    except ImportError:
        print("FastAPI not installed. Run: pip install fastapi uvicorn")
        return None

    app = FastAPI(
        title="KUHUL Inference Host",
        description="Python inference backend for K'UHUL runtime",
        version="1.0.0"
    )

    # CORS for browser access
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Initialize host
    inference_host = host or InferenceHost()

    # Request models
    class ChatRequest(BaseModel):
        prompt: str
        model: Optional[str] = None
        max_tokens: Optional[int] = 256
        temperature: Optional[float] = 0.7
        top_p: Optional[float] = 0.95
        stream: Optional[bool] = False

    class VisionRequest(BaseModel):
        image: str  # base64
        prompt: Optional[str] = "Describe this image."
        model: Optional[str] = None
        max_tokens: Optional[int] = 512
        temperature: Optional[float] = 0.3

    class ImageGenRequest(BaseModel):
        prompt: str
        negative_prompt: Optional[str] = ""
        model: Optional[str] = None
        width: Optional[int] = 512
        height: Optional[int] = 512
        steps: Optional[int] = 30
        guidance_scale: Optional[float] = 7.5
        seed: Optional[int] = None

    # Endpoints
    @app.get("/health")
    async def health():
        return inference_host.health()

    @app.post("/infer")
    async def infer(request: ChatRequest):
        if request.stream:
            return StreamingResponse(
                inference_host.generate_stream(
                    request.prompt,
                    max_tokens=request.max_tokens,
                    temperature=request.temperature
                ),
                media_type="text/plain"
            )

        return inference_host.generate(
            request.prompt,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            top_p=request.top_p
        )

    @app.post("/vision")
    async def vision(request: VisionRequest):
        return inference_host.vision(
            request.image,
            request.prompt,
            max_tokens=request.max_tokens
        )

    @app.post("/generate_image")
    async def generate_image(request: ImageGenRequest):
        return inference_host.generate_image(
            request.prompt,
            negative_prompt=request.negative_prompt,
            width=request.width,
            height=request.height,
            steps=request.steps,
            guidance_scale=request.guidance_scale,
            seed=request.seed
        )

    # Legacy endpoint compatibility (for mx2lm.app/api.php format)
    class LegacyRequest(BaseModel):
        action: str
        model: Optional[str] = None
        prompt: Optional[str] = None
        message: Optional[str] = None
        image: Optional[str] = None
        max_tokens: Optional[int] = 256
        temperature: Optional[float] = 0.7

    @app.post("/api")
    async def legacy_api(request: LegacyRequest):
        prompt = request.prompt or request.message or ""

        if request.action == "chat":
            return inference_host.generate(
                prompt,
                max_tokens=request.max_tokens,
                temperature=request.temperature
            )
        elif request.action == "vision":
            return inference_host.vision(
                request.image or "",
                prompt,
                max_tokens=request.max_tokens
            )
        elif request.action == "generate_image":
            return inference_host.generate_image(
                prompt
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unknown action: {request.action}")

    return app


# ============================================================
# CLI
# ============================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description="KUHUL Inference Host")
    parser.add_argument("--model", default="Qwen/Qwen2.5-0.5B-Instruct", help="Model name or path")
    parser.add_argument("--device", default="auto", help="Device: cuda, cpu, auto")
    parser.add_argument("--host", default="0.0.0.0", help="Server host")
    parser.add_argument("--port", type=int, default=8001, help="Server port")
    parser.add_argument("--dtype", default="float16", help="Model dtype")

    args = parser.parse_args()

    config = InferConfig(
        model_name=args.model,
        device=args.device,
        dtype=args.dtype,
        host=args.host,
        port=args.port
    )

    host = InferenceHost(config)
    app = create_app(host)

    if app is None:
        print("Failed to create app. Install dependencies: pip install fastapi uvicorn transformers torch")
        sys.exit(1)

    try:
        import uvicorn
        print(f"Starting KUHUL Inference Host on {args.host}:{args.port}")
        print(f"Model: {args.model}")
        uvicorn.run(app, host=args.host, port=args.port)
    except ImportError:
        print("uvicorn not installed. Run: pip install uvicorn")


if __name__ == "__main__":
    main()
