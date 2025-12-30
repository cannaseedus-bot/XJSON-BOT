"""
SCXQ2 - Symbolic Compression with Hazard Cipher
================================================
Python implementation of the SCXQ2 compression system.

Features:
- Hazard prefix (☣) for compressed data identification
- JSON serialization with compression
- Support for multiple compression backends (lz4, zstd)
"""

import json
import base64
import hashlib
from typing import Any, Optional, Dict
import logging

try:
    import lz4.frame as lz4
    HAS_LZ4 = True
except ImportError:
    HAS_LZ4 = False

try:
    import zstandard as zstd
    HAS_ZSTD = True
except ImportError:
    HAS_ZSTD = False

logger = logging.getLogger(__name__)


class SCXQ2:
    """
    SCXQ2 Compression Engine

    Symbolic compression with hazard cipher for K'UHUL data.
    """

    HAZARD_PREFIX = "☣"
    VERSION = "2.0"

    def __init__(self, backend: str = "auto"):
        """
        Initialize SCXQ2.

        Args:
            backend: Compression backend ('lz4', 'zstd', 'auto', 'none')
        """
        self.backend = self._select_backend(backend)
        logger.info(f"SCXQ2 initialized with backend: {self.backend}")

    def _select_backend(self, preferred: str) -> str:
        """Select available compression backend."""
        if preferred == "auto":
            if HAS_LZ4:
                return "lz4"
            elif HAS_ZSTD:
                return "zstd"
            else:
                return "none"
        elif preferred == "lz4" and HAS_LZ4:
            return "lz4"
        elif preferred == "zstd" and HAS_ZSTD:
            return "zstd"
        else:
            return "none"

    def compress(self, data: Any) -> str:
        """
        Compress data with SCXQ2.

        Args:
            data: Any JSON-serializable data

        Returns:
            Compressed string with hazard prefix
        """
        # Serialize to JSON
        json_str = json.dumps(data, separators=(',', ':'))
        json_bytes = json_str.encode('utf-8')

        # Calculate checksum
        checksum = hashlib.md5(json_bytes).hexdigest()[:8]

        # Compress
        if self.backend == "lz4":
            compressed = lz4.compress(json_bytes)
        elif self.backend == "zstd":
            cctx = zstd.ZstdCompressor(level=3)
            compressed = cctx.compress(json_bytes)
        else:
            compressed = json_bytes

        # Encode to base64
        encoded = base64.b64encode(compressed).decode('ascii')

        # Build SCXQ2 packet
        packet = f"{self.HAZARD_PREFIX}SCXQ2:{self.VERSION}:{self.backend}:{checksum}:{encoded}"

        return packet

    def decompress(self, packet: str) -> Any:
        """
        Decompress SCXQ2 data.

        Args:
            packet: SCXQ2-compressed string with hazard prefix

        Returns:
            Original data
        """
        if not packet.startswith(self.HAZARD_PREFIX):
            raise ValueError(f"Invalid SCXQ2 packet: missing hazard prefix")

        # Parse packet
        parts = packet[1:].split(':', 4)  # Skip hazard prefix
        if len(parts) < 5 or parts[0] != "SCXQ2":
            raise ValueError("Invalid SCXQ2 packet format")

        _, version, backend, checksum, encoded = parts

        # Decode base64
        compressed = base64.b64decode(encoded)

        # Decompress
        if backend == "lz4":
            if not HAS_LZ4:
                raise ValueError("LZ4 not available for decompression")
            json_bytes = lz4.decompress(compressed)
        elif backend == "zstd":
            if not HAS_ZSTD:
                raise ValueError("Zstandard not available for decompression")
            dctx = zstd.ZstdDecompressor()
            json_bytes = dctx.decompress(compressed)
        else:
            json_bytes = compressed

        # Verify checksum
        actual_checksum = hashlib.md5(json_bytes).hexdigest()[:8]
        if actual_checksum != checksum:
            logger.warning(f"SCXQ2 checksum mismatch: {checksum} != {actual_checksum}")

        # Parse JSON
        return json.loads(json_bytes.decode('utf-8'))

    def is_compressed(self, data: str) -> bool:
        """Check if data is SCXQ2 compressed."""
        return isinstance(data, str) and data.startswith(f"{self.HAZARD_PREFIX}SCXQ2:")

    def get_stats(self, original: Any, compressed: str) -> Dict[str, Any]:
        """Get compression statistics."""
        original_size = len(json.dumps(original, separators=(',', ':')))
        compressed_size = len(compressed)

        return {
            "original_size": original_size,
            "compressed_size": compressed_size,
            "ratio": compressed_size / original_size if original_size > 0 else 0,
            "savings_percent": (1 - compressed_size / original_size) * 100 if original_size > 0 else 0,
            "backend": self.backend
        }


class SCXQPacket:
    """
    SCXQ Packet Types

    Predefined packet types for common operations.
    """

    # Chat packets
    CHAT_MESSAGE = "☣CHAT:MSG"
    CHAT_HISTORY = "☣CHAT:HIST"
    CHAT_SESSION = "☣CHAT:SESS"

    # Model packets
    MODEL_WEIGHTS = "☣MODEL:WEIGHTS"
    MODEL_CONFIG = "☣MODEL:CONFIG"
    MODEL_CHECKPOINT = "☣MODEL:CKPT"

    # User packets
    USER_PROFILE = "☣USER:PROF"
    USER_SETTINGS = "☣USER:SET"
    USER_SESSION = "☣USER:SESS"

    # Agent packets
    AGENT_STATE = "☣AGENT:STATE"
    AGENT_MEMORY = "☣AGENT:MEM"
    AGENT_TASK = "☣AGENT:TASK"

    @classmethod
    def wrap(cls, packet_type: str, data: Any) -> str:
        """Wrap data in a typed packet."""
        scxq2 = SCXQ2()
        compressed = scxq2.compress(data)
        return f"{packet_type}:{compressed}"

    @classmethod
    def unwrap(cls, packet: str) -> tuple:
        """Unwrap a typed packet."""
        parts = packet.split(':', 2)
        if len(parts) < 2:
            raise ValueError("Invalid packet format")

        packet_type = f"{parts[0]}:{parts[1]}"
        compressed = parts[2] if len(parts) > 2 else ""

        scxq2 = SCXQ2()
        if scxq2.is_compressed(compressed):
            data = scxq2.decompress(compressed)
        else:
            data = compressed

        return packet_type, data
