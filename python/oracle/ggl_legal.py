from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict


@dataclass
class LegalityError(Exception):
    code: str
    msg: str
    line: int = 0
    col: int = 0


def check_legality(ast: Dict[str, Any], grammar_abi: Dict[str, Any]) -> None:
    """Validate AST against legality rules.

    Placeholder implementation accepts the raw AST.
    """
    if ast.get("type") != "GGLRaw":
        raise LegalityError(code="E_LEGAL_TYPE", msg="unexpected AST node type")
