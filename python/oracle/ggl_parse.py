from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict


@dataclass
class ParseError(Exception):
    code: str
    msg: str
    line: int = 0
    col: int = 0


def parse_ggl_to_ast(text: str, grammar_abi: Dict[str, Any]) -> Dict[str, Any]:
    """Parse GGL text into a deterministic AST.

    This placeholder parser wraps the raw text until a concrete grammar is supplied.
    """
    if not text.strip():
        raise ParseError(code="E_PARSE_EMPTY", msg="empty GGL payload", line=1, col=1)

    return {
        "type": "GGLRaw",
        "text": text,
        "grammar_id": grammar_abi.get("id", "unknown"),
    }
