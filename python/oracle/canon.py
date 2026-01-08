from __future__ import annotations

import json
from typing import Any


CANON_SPEC_V1 = "asx://canon/json.bytes.v1"


def canon_json_bytes_v1(obj: Any) -> bytes:
    """Return canonical JSON bytes for ABI hashing.

    Canonicalization rules (v1):
    - UTF-8 encoding
    - Object keys sorted lexicographically
    - No insignificant whitespace
    """
    canon = json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return canon.encode("utf-8")
