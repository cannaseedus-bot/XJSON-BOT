from __future__ import annotations

from typing import Any, Dict

import torch
from transformers import Trainer

from .abi import ABI
from .oracle import ggl_legality_oracle


class GGLGrammarAwareTrainer(Trainer):
    def __init__(
        self,
        *args,
        abi: ABI,
        tokenizer_for_decode,
        lambda_legal: float = 20.0,
        alpha_free: float = 0.25,
        free_every: int = 4,
        max_new_tokens: int = 256,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        self.abi = abi
        self.tok_decode = tokenizer_for_decode
        self.lambda_legal = float(lambda_legal)
        self.alpha_free = float(alpha_free)
        self.free_every = int(free_every)
        self.max_new_tokens = int(max_new_tokens)
        self._step = 0

    def _decode_ids(self, ids: torch.Tensor) -> str:
        return self.tok_decode.decode(ids.tolist(), skip_special_tokens=False)

    @torch.no_grad()
    def _free_run_decode(self, model, inputs: Dict[str, Any]) -> str:
        gen = model.generate(
            input_ids=inputs["input_ids"],
            attention_mask=inputs.get("attention_mask"),
            max_new_tokens=self.max_new_tokens,
            do_sample=False,
            num_beams=1,
        )
        return self._decode_ids(gen[0])

    def _oracle_penalty(self, text: str) -> torch.Tensor:
        res = ggl_legality_oracle(text, self.abi, want_lower=False)
        penalty = 1.0 - float(res.partial_score)
        return torch.tensor(penalty, device=self.model.device, dtype=torch.float32)

    def compute_loss(self, model, inputs, return_outputs=False):
        self._step += 1
        outputs = model(**inputs)
        base_loss = outputs.loss

        if (self._step % self.free_every) != 0:
            if return_outputs:
                return base_loss, outputs
            return base_loss

        with torch.no_grad():
            text = self._free_run_decode(model, inputs)

        legal_pen = self._oracle_penalty(text)
        loss = base_loss + (self.alpha_free * (self.lambda_legal * legal_pen))

        if return_outputs:
            return loss, outputs
        return loss
