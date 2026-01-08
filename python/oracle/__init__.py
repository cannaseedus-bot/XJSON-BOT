"""GGL legality oracle modules."""

from .abi import ABI, load_abi
from .oracle import ggl_legality_oracle, OracleResult

__all__ = ["ABI", "load_abi", "ggl_legality_oracle", "OracleResult"]
