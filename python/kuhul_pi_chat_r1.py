# kuhul_pi_chat_r1.py
# KUHUL π Chat Inference — DeepSeek-style Conversation
# Bound to local Qwen-ASX weights (MX2LM)

import torch
from pathlib import Path
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    GenerationConfig
)

# DeepSeek / Janus conversation utilities
from janus.utils.conversation import get_conv_template

# -----------------------------
# CONFIG
# -----------------------------

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR  # root contains model.safetensors + tokenizer

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32

# Sanity check (fail fast)
required_files = ["model.safetensors", "tokenizer.json"]
missing = [f for f in required_files if not (MODEL_PATH / f).exists()]
if missing:
    raise FileNotFoundError(
        f"MX2LM model files missing in {MODEL_PATH}: {', '.join(missing)}"
    )

# -----------------------------
# LOAD TOKENIZER + MODEL
# -----------------------------

tokenizer = AutoTokenizer.from_pretrained(
    MODEL_PATH,
    trust_remote_code=True,
    local_files_only=True
)

# Ensure pad token exists (Qwen safety)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    MODEL_PATH,
    torch_dtype=DTYPE,
    device_map="auto",
    trust_remote_code=True,
    local_files_only=True
)

model.eval()

# Optional generation config
try:
    generation_config = GenerationConfig.from_pretrained(
        MODEL_PATH,
        local_files_only=True
    )
except Exception:
    generation_config = GenerationConfig(
        max_new_tokens=512,
        temperature=0.7,
        top_p=0.95,
        do_sample=True,
        use_cache=True
    )

# -----------------------------
# KUHUL π CHAT ENGINE
# -----------------------------

class KuhulPiChatR1:
    """
    KUHUL π Chat Runtime
    DeepSeek-style conversation, MX2LM / Qwen-ASX weights
    """

    def __init__(self):
        self.reset()

    def reset(self):
        self.conv = get_conv_template("deepseek")

    def ask(self, user_text: str) -> str:
        # Append user message
        self.conv.append_message(self.conv.roles[0], user_text)
        self.conv.append_message(self.conv.roles[1], None)

        prompt = self.conv.get_prompt()

        inputs = tokenizer(
            prompt,
            return_tensors="pt",
            padding=True
        ).to(model.device)

        with torch.no_grad():
            output_ids = model.generate(
                **inputs,
                generation_config=generation_config
            )

        output_text = tokenizer.decode(
            output_ids[0][inputs.input_ids.shape[-1]:],
            skip_special_tokens=True
        ).strip()

        # Store assistant response
        self.conv.update_last_message(output_text)

        return output_text

# -----------------------------
# INTERACTIVE MODE
# -----------------------------

def interactive():
    engine = KuhulPiChatR1()

    print("🧠 KUHUL π Chat — DeepSeek Protocol / MX2LM (Qwen-ASX)")
    print("Type 'exit' to quit.\n")

    while True:
        user = input("You: ").strip()
        if user.lower() in ("exit", "quit"):
            break

        reply = engine.ask(user)
        print(f"\nπ: {reply}\n")

# -----------------------------
# ENTRY
# -----------------------------

if __name__ == "__main__":
    interactive()
