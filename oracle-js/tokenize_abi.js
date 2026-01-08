export function abiTokenizeOk(text, abi) {
  const allowed = Array.isArray(abi?.allowed_chars) ? new Set(abi.allowed_chars.map(String)) : null;
  if (!allowed) {
    return null;
  }
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (!allowed.has(ch)) {
      const line = text.slice(0, i).split("\n").length;
      const col = i - text.lastIndexOf("\n", i - 1);
      return {
        code: "E_TOKEN_CHAR",
        msg: `disallowed character: ${JSON.stringify(ch)}`,
        line,
        col,
      };
    }
  }
  return null;
}
