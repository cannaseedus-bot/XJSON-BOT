from __future__ import annotations

from typing import Any, Dict, Optional


class TokenizeError(Exception):
    def __init__(self, code: str, msg: str, line: int = 0, col: int = 0) -> None:
        super().__init__(msg)
        self.code = code
        self.msg = msg
        self.line = line
        self.col = col


def _allowed_chars_from_abi(abi: Dict[str, Any]) -> Optional[set[str]]:
    allowed = abi.get("allowed_chars")
    if allowed is None:
        return None
    if isinstance(allowed, list):
        return set(str(ch) for ch in allowed)
    return None


def abi_tokenize_ok(text: str, abi: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Basic tokenizer ABI validation.

    Returns an error dict on failure, or None on success.
    """
    allowed_chars = _allowed_chars_from_abi(abi)
    if not allowed_chars:
        return None

    for idx, ch in enumerate(text):
        if ch not in allowed_chars:
            line = text.count("\n", 0, idx) + 1
            col = idx - text.rfind("\n", 0, idx)
            return {
                "code": "E_TOKEN_CHAR",
                "msg": f"disallowed character: {ch!r}",
                "line": line,
                "col": col,
            }

    return None
