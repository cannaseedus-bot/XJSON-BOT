from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

from .abi import ABI
from .ggl_legal import LegalityError, check_legality
from .ggl_lower import LowerError, lower_ast_to_scene_xjson
from .ggl_parse import ParseError, parse_ggl_to_ast
from .tokenize_abi import abi_tokenize_ok


@dataclass
class OracleResult:
    ok: bool
    stage: str
    code: str
    msg: str
    line: int = 0
    col: int = 0
    partial_score: float = 0.0
    ast: Optional[Dict[str, Any]] = None
    lowered: Optional[Dict[str, Any]] = None


BOUNDARY_OPEN = "<GGL>"
BOUNDARY_CLOSE = "</GGL>"


def extract_ggl_payload(text: str) -> Tuple[Optional[str], Optional[OracleResult]]:
    a = text.find(BOUNDARY_OPEN)
    b = text.find(BOUNDARY_CLOSE)
    if a == -1 or b == -1 or b < a:
        return None, OracleResult(
            ok=False,
            stage="boundary",
            code="E_GGL_BOUNDARY",
            msg="missing or malformed <GGL>...</GGL> boundary",
            partial_score=0.0,
        )
    inner = text[a + len(BOUNDARY_OPEN) : b]
    outside = (text[:a] + text[b + len(BOUNDARY_CLOSE) :]).strip()
    if outside:
        return None, OracleResult(
            ok=False,
            stage="boundary",
            code="E_GGL_OUTSIDE_TEXT",
            msg="non-empty text outside GGL boundary",
            partial_score=0.05,
        )
    return inner.strip(), None


def legality_score(flags: Dict[str, bool]) -> float:
    s = 0.0
    if flags.get("boundary"):
        s += 0.10
    if flags.get("tokenize"):
        s += 0.15
    if flags.get("parse"):
        s += 0.35
    if flags.get("legal"):
        s += 0.30
    if flags.get("lower"):
        s += 0.10
    return round(s, 6)


def ggl_legality_oracle(text: str, abi: ABI, want_lower: bool = True) -> OracleResult:
    flags = {"boundary": False, "tokenize": False, "parse": False, "legal": False, "lower": False}

    inner, err = extract_ggl_payload(text)
    if err:
        return err

    flags["boundary"] = True

    tok_err = abi_tokenize_ok(inner, abi.tokenizer)
    if tok_err:
        return OracleResult(
            ok=False,
            stage="tokenize",
            code=tok_err["code"],
            msg=tok_err["msg"],
            line=tok_err.get("line", 0),
            col=tok_err.get("col", 0),
            partial_score=legality_score(flags),
        )
    flags["tokenize"] = True

    try:
        ast = parse_ggl_to_ast(inner, abi.grammar)
    except ParseError as e:
        return OracleResult(
            ok=False,
            stage="parse",
            code=e.code,
            msg=e.msg,
            line=e.line,
            col=e.col,
            partial_score=legality_score(flags),
        )
    flags["parse"] = True

    try:
        check_legality(ast, abi.grammar)
    except LegalityError as e:
        return OracleResult(
            ok=False,
            stage="legal",
            code=e.code,
            msg=e.msg,
            line=e.line,
            col=e.col,
            partial_score=legality_score(flags),
            ast=ast,
        )
    flags["legal"] = True

    lowered = None
    if want_lower:
        try:
            lowered = lower_ast_to_scene_xjson(ast, abi.grammar)
            flags["lower"] = True
        except LowerError as e:
            return OracleResult(
                ok=False,
                stage="lower",
                code=e.code,
                msg=e.msg,
                partial_score=legality_score(flags),
                ast=ast,
            )

    return OracleResult(
        ok=True,
        stage="ok",
        code="OK",
        msg="legal",
        partial_score=legality_score(flags),
        ast=ast,
        lowered=lowered,
    )
