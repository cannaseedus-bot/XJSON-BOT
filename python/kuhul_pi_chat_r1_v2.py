#!/usr/bin/env python3
"""
KUHUL π Chat Inference — DeepSeek-style Conversation
Windows Low-Memory Safe
Bound to local Qwen-ASX weights
π-cluster ready (CPU bootstrap)
"""

# ─────────────────────────────────────────────
# Windows Low-Memory / No-MMAP Safeguards
# MUST be before torch import
# ─────────────────────────────────────────────
import os

os.environ["SAFETENSORS_DISABLE_MMAP"] = "1"
os.environ["SAFETENSORS_FAST_GPU"] = "0"
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "max_split_size_mb:64"
os.environ["PYTORCH_NO_MMAP"] = "1"

# ─────────────────────────────────────────────
# Imports
# ─────────────────────────────────────────────
import sys
import torch
from pathlib import Path
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    GenerationConfig
)

# DeepSeek / Janus conversation utilities
from janus.utils.conversation import get_conv_template

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR  # model.safetensors + tokenizer live here

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32

# ─────────────────────────────────────────────
# KUHUL π CHAT ENGINE
# ─────────────────────────────────────────────

class KuhulPiChatR1:
    """
    KUHUL π Chat Runtime
    DeepSeek-style conversation
    Local Qwen-ASX weights
    """

    def __init__(self, model_path: Path):
        self.model_path = model_path

        print("🔹 Loading tokenizer...")
        self.tokenizer = AutoTokenizer.from_pretrained(
            self.model_path,
            trust_remote_code=True,
            local_files_only=True,
            use_fast=True
        )

        print("🔹 Loading model (Windows-safe, low-memory mode)...")
        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_path,
            dtype=DTYPE,
            device_map={"": "cpu"},        # FORCE CPU BOOTSTRAP
            low_cpu_mem_usage=True,        # STREAM WEIGHTS
            trust_remote_code=True,
            local_files_only=True,
        )

        self.model.eval()

        # Load generation config if present
        try:
            self.generation_config = GenerationConfig.from_pretrained(
                self.model_path,
                local_files_only=True
            )
        except Exception:
            self.generation_config = GenerationConfig(
                max_new_tokens=512,
                temperature=0.7,
                top_p=0.95
            )

        # Initialize DeepSeek-style conversation
        self.reset()

        print("✓ KUHUL π Chat Engine Ready\n")

    def reset(self):
        self.conv = get_conv_template("deepseek")

    def ask(self, user_text: str) -> str:
        # Append messages
        self.conv.append_message(self.conv.roles[0], user_text)
        self.conv.append_message(self.conv.roles[1], None)

        prompt = self.conv.get_prompt()

        inputs = self.tokenizer(
            prompt,
            return_tensors="pt"
        )

        inputs = {k: v.to(self.model.device) for k, v in inputs.items()}

        with torch.no_grad():
            output_ids = self.model.generate(
                **inputs,
                generation_config=self.generation_config
            )

        output_text = self.tokenizer.decode(
            output_ids[0][inputs["input_ids"].shape[-1]:],
            skip_special_tokens=True
        ).strip()

        self.conv.update_last_message(output_text)
        return output_text

# ─────────────────────────────────────────────
# INTERACTIVE MODE
# ─────────────────────────────────────────────

def interactive():
    engine = KuhulPiChatR1(model_path=MODEL_PATH)

    print("🧠 KUHUL π Chat — DeepSeek Protocol / Qwen-ASX Weights")
    print("Type 'exit' or 'quit' to stop.\n")

    while True:
        try:
            user = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting.")
            break

        if user.lower() in ("exit", "quit"):
            break

        reply = engine.ask(user)
        print(f"\nπ: {reply}\n")

# ─────────────────────────────────────────────
# ENTRY
# ─────────────────────────────────────────────

def main():
    interactive()

if __name__ == "__main__":
    main()
