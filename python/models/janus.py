"""
Janus Multimodal Model Wrapper
==============================
DeepSeek's unified multimodal understanding and generation model.

Features:
- Text-to-image generation
- Image understanding (vision)
- JanusFlow rectified flow support
"""

import base64
import io
import os
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

# Check for torch availability
try:
    import torch
    import numpy as np
    from PIL import Image
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    logger.warning("PyTorch not available - Janus will run in API-only mode")


class JanusModel(BaseModel):
    """
    Janus Multimodal Model

    Unified model for text-to-image generation and image understanding.
    Supports local inference with GPU acceleration.
    """

    # Model variants
    VARIANTS = {
        "janus-1.3b": {
            "hf_path": "deepseek-ai/Janus-1.3B",
            "capabilities": [ModelCapability.TEXT, ModelCapability.IMAGE_GEN, ModelCapability.VISION]
        },
        "janus-pro-7b": {
            "hf_path": "deepseek-ai/Janus-Pro-7B",
            "capabilities": [ModelCapability.TEXT, ModelCapability.IMAGE_GEN, ModelCapability.VISION]
        },
        "janusflow-1.3b": {
            "hf_path": "deepseek-ai/JanusFlow-1.3B",
            "capabilities": [ModelCapability.IMAGE_GEN]
        }
    }

    def __init__(
        self,
        model_id: str = "janus-1.3b",
        device: str = "cuda",
        cache_dir: Optional[str] = None
    ):
        super().__init__(model_id)
        self.device = device if HAS_TORCH and torch.cuda.is_available() else "cpu"
        self.cache_dir = cache_dir or "./cache/models"
        self.model = None
        self.processor = None

    async def load(self) -> bool:
        """Load Janus model from HuggingFace."""
        if not HAS_TORCH:
            logger.error("PyTorch required for Janus local inference")
            return False

        try:
            from transformers import AutoModelForCausalLM

            variant = self.VARIANTS.get(self.model_id, self.VARIANTS["janus-1.3b"])
            hf_path = variant["hf_path"]

            logger.info(f"Loading Janus model: {hf_path}")

            # Import Janus-specific modules
            # These would be from the janus package
            try:
                from janus.models import MultiModalityCausalLM, VLChatProcessor
                self.processor = VLChatProcessor.from_pretrained(hf_path)
                self.model = AutoModelForCausalLM.from_pretrained(
                    hf_path,
                    trust_remote_code=True,
                    cache_dir=self.cache_dir
                )
                self.model = self.model.to(torch.bfloat16).to(self.device).eval()

            except ImportError:
                # Fallback: use standard transformers
                logger.warning("Janus package not found, using transformers fallback")
                self.model = AutoModelForCausalLM.from_pretrained(
                    hf_path,
                    trust_remote_code=True,
                    torch_dtype=torch.bfloat16,
                    cache_dir=self.cache_dir
                )
                self.model = self.model.to(self.device).eval()

            self.info = ModelInfo(
                id=self.model_id,
                name=f"Janus {self.model_id}",
                provider="janus",
                capabilities=variant["capabilities"],
                context_length=4096,
                is_local=True
            )

            self._loaded = True
            logger.info(f"Janus model loaded on {self.device}")
            return True

        except Exception as e:
            logger.error(f"Failed to load Janus: {e}")
            return False

    async def unload(self) -> bool:
        """Unload model to free GPU memory."""
        if self.model is not None:
            del self.model
            self.model = None

        if self.processor is not None:
            del self.processor
            self.processor = None

        if HAS_TORCH and torch.cuda.is_available():
            torch.cuda.empty_cache()

        self._loaded = False
        return True

    async def generate(
        self,
        messages: List[Message],
        config: Optional[GenerationConfig] = None
    ) -> ModelResponse:
        """Generate text response (for vision/understanding)."""
        if not self._loaded:
            raise RuntimeError("Janus not loaded")

        config = config or GenerationConfig()

        # Check if any message has images
        has_images = any(m.images for m in messages)

        if has_images:
            return await self._vision_inference(messages, config)
        else:
            return await self._text_inference(messages, config)

    async def _text_inference(
        self,
        messages: List[Message],
        config: GenerationConfig
    ) -> ModelResponse:
        """Text-only inference."""
        # Build conversation format
        conversation = []
        for m in messages:
            conversation.append({
                "role": "User" if m.role == "user" else "Assistant",
                "content": m.content
            })

        if self.processor:
            # Use Janus processor
            sft_format = self.processor.apply_sft_template_for_multi_turn_prompts(
                conversations=conversation,
                sft_format=self.processor.sft_format,
                system_prompt=""
            )

            input_ids = self.processor.tokenizer.encode(sft_format)
            input_ids = torch.LongTensor([input_ids]).to(self.device)

            with torch.inference_mode():
                outputs = self.model.generate(
                    input_ids,
                    max_new_tokens=config.max_tokens,
                    temperature=config.temperature,
                    do_sample=config.temperature > 0,
                    pad_token_id=self.processor.tokenizer.eos_token_id
                )

            response = self.processor.tokenizer.decode(
                outputs[0][len(input_ids[0]):],
                skip_special_tokens=True
            )
        else:
            # Fallback
            response = "Janus processor not available"

        return ModelResponse(
            content=response,
            model=self.model_id,
            finish_reason="stop"
        )

    async def _vision_inference(
        self,
        messages: List[Message],
        config: GenerationConfig
    ) -> ModelResponse:
        """Vision/image understanding inference."""
        from janus.utils.io import load_pil_images

        # Build conversation with images
        conversation = []
        for m in messages:
            entry = {
                "role": "User" if m.role == "user" else "Assistant",
                "content": m.content
            }

            if m.images:
                # Handle base64 images
                entry["content"] = "<image_placeholder>\n" + m.content
                entry["images"] = []

                for img_data in m.images:
                    if img_data.startswith("data:"):
                        # Parse data URL
                        _, base64_data = img_data.split(",", 1)
                        img_bytes = base64.b64decode(base64_data)
                        img = Image.open(io.BytesIO(img_bytes))
                        entry["images"].append(img)
                    elif os.path.exists(img_data):
                        # File path
                        entry["images"].append(img_data)

            conversation.append(entry)

        # Process with Janus
        if self.processor:
            pil_images = load_pil_images(conversation)
            inputs = self.processor(
                conversations=conversation,
                images=pil_images,
                force_batchify=True
            ).to(self.device)

            inputs_embeds = self.model.prepare_inputs_embeds(**inputs)

            with torch.inference_mode():
                outputs = self.model.language_model.generate(
                    inputs_embeds=inputs_embeds,
                    attention_mask=inputs.attention_mask,
                    max_new_tokens=config.max_tokens,
                    do_sample=config.temperature > 0,
                    temperature=config.temperature if config.temperature > 0 else None,
                    pad_token_id=self.processor.tokenizer.eos_token_id,
                    eos_token_id=self.processor.tokenizer.eos_token_id
                )

            response = self.processor.tokenizer.decode(
                outputs[0].cpu().tolist(),
                skip_special_tokens=True
            )
        else:
            response = "Vision processing not available"

        return ModelResponse(
            content=response,
            model=self.model_id,
            finish_reason="stop"
        )

    async def generate_image(
        self,
        prompt: str,
        num_images: int = 1,
        cfg_weight: float = 5.0,
        temperature: float = 1.0,
        image_size: int = 384
    ) -> ModelResponse:
        """
        Generate images from text prompt.

        Args:
            prompt: Text description of image to generate
            num_images: Number of images to generate
            cfg_weight: Classifier-free guidance weight
            temperature: Sampling temperature
            image_size: Output image size

        Returns:
            ModelResponse with base64-encoded images
        """
        if not self._loaded:
            raise RuntimeError("Janus not loaded")

        if not HAS_TORCH:
            raise RuntimeError("PyTorch required for image generation")

        # Build generation prompt
        conversation = [
            {"role": "User", "content": prompt},
            {"role": "Assistant", "content": ""}
        ]

        sft_format = self.processor.apply_sft_template_for_multi_turn_prompts(
            conversations=conversation,
            sft_format=self.processor.sft_format,
            system_prompt=""
        )
        prompt_text = sft_format + self.processor.image_start_tag

        # Tokenize
        input_ids = self.processor.tokenizer.encode(prompt_text)
        input_ids = torch.LongTensor(input_ids)

        # Prepare for CFG (parallel conditional/unconditional)
        tokens = torch.zeros((num_images * 2, len(input_ids)), dtype=torch.int).to(self.device)
        for i in range(num_images * 2):
            tokens[i, :] = input_ids
            if i % 2 != 0:  # Unconditional
                tokens[i, 1:-1] = self.processor.pad_id

        # Generate image tokens
        image_token_num = 576  # 24x24 patches
        patch_size = 16

        with torch.inference_mode():
            inputs_embeds = self.model.language_model.get_input_embeddings()(tokens)
            generated_tokens = torch.zeros(
                (num_images, image_token_num),
                dtype=torch.int
            ).to(self.device)

            past_key_values = None

            for i in range(image_token_num):
                outputs = self.model.language_model.model(
                    inputs_embeds=inputs_embeds,
                    use_cache=True,
                    past_key_values=past_key_values
                )
                past_key_values = outputs.past_key_values
                hidden_states = outputs.last_hidden_state

                logits = self.model.gen_head(hidden_states[:, -1, :])
                logit_cond = logits[0::2, :]
                logit_uncond = logits[1::2, :]

                # CFG
                logits = logit_uncond + cfg_weight * (logit_cond - logit_uncond)
                probs = torch.softmax(logits / temperature, dim=-1)

                next_token = torch.multinomial(probs, num_samples=1)
                generated_tokens[:, i] = next_token.squeeze(dim=-1)

                # Prepare next embeddings
                next_token_expanded = torch.cat(
                    [next_token.unsqueeze(1), next_token.unsqueeze(1)],
                    dim=1
                ).view(-1)
                img_embeds = self.model.prepare_gen_img_embeds(next_token_expanded)
                inputs_embeds = img_embeds.unsqueeze(dim=1)

            # Decode to images
            dec = self.model.gen_vision_model.decode_code(
                generated_tokens.to(dtype=torch.int),
                shape=[num_images, 8, image_size // patch_size, image_size // patch_size]
            )
            dec = dec.to(torch.float32).cpu().numpy().transpose(0, 2, 3, 1)
            dec = np.clip((dec + 1) / 2 * 255, 0, 255).astype(np.uint8)

        # Convert to base64
        images_b64 = []
        for i in range(num_images):
            img = Image.fromarray(dec[i])
            buffer = io.BytesIO()
            img.save(buffer, format="PNG")
            b64 = base64.b64encode(buffer.getvalue()).decode()
            images_b64.append(f"data:image/png;base64,{b64}")

        return ModelResponse(
            content=f"Generated {num_images} image(s)",
            model=self.model_id,
            finish_reason="stop",
            images=images_b64
        )

    async def stream(
        self,
        messages: List[Message],
        config: Optional[GenerationConfig] = None
    ) -> AsyncIterator[str]:
        """Stream text response."""
        # For now, just return the full response
        # True streaming would require custom generation loop
        response = await self.generate(messages, config)
        yield response.content


class JanusFlowModel(JanusModel):
    """
    JanusFlow Model

    Rectified flow variant optimized for image generation.
    """

    def __init__(self, device: str = "cuda", cache_dir: Optional[str] = None):
        super().__init__("janusflow-1.3b", device, cache_dir)

    async def generate(
        self,
        messages: List[Message],
        config: Optional[GenerationConfig] = None
    ) -> ModelResponse:
        """JanusFlow only supports image generation."""
        # Extract prompt from last user message
        prompt = ""
        for m in reversed(messages):
            if m.role == "user":
                prompt = m.content
                break

        if not prompt:
            raise ValueError("No prompt found for image generation")

        return await self.generate_image(prompt)
