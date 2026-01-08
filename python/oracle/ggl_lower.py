from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict


@dataclass
class LowerError(Exception):
    code: str
    msg: str


def lower_ast_to_scene_xjson(ast: Dict[str, Any], grammar_abi: Dict[str, Any]) -> Dict[str, Any]:
    """Lower AST to a scene XJSON representation.

    Placeholder lowering preserves the raw text in a simple envelope.
    """
    if ast.get("type") != "GGLRaw":
        raise LowerError(code="E_LOWER_TYPE", msg="unexpected AST node type")

    return {
        "@type": "scene.ir.v1",
        "ggl": ast.get("text", ""),
        "grammar_id": grammar_abi.get("id", "unknown"),
    }
