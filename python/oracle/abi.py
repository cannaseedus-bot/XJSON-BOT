from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any, Dict

from .canon import canon_json_bytes_v1


@dataclass(frozen=True)
class ABI:
    tokenizer: Dict[str, Any]
    grammar: Dict[str, Any]
    abi_hash: str


def load_abi(tokenizer_path: str, grammar_path: str) -> ABI:
    with open(tokenizer_path, "rb") as f:
        tok_raw = f.read()
    with open(grammar_path, "rb") as f:
        gr_raw = f.read()

    tok_obj = json.loads(tok_raw.decode("utf-8"))
    gr_obj = json.loads(gr_raw.decode("utf-8"))

    tok_c = canon_json_bytes_v1(tok_obj)
    gr_c = canon_json_bytes_v1(gr_obj)

    h = hashlib.sha256(tok_c + b"\n" + gr_c).hexdigest()
    return ABI(tokenizer=tok_obj, grammar=gr_obj, abi_hash=h)
