import { sha256Hex } from "./sha.js";
import { canonJsonBytesV1 } from "./canon.js";
import { abiTokenizeOk } from "./tokenize_abi.js";
import { parseGglToAst } from "./ggl_parse.js";
import { checkLegality } from "./ggl_legal.js";
import { lowerAstToSceneXjson } from "./ggl_lower.js";

export const BOUNDARY_OPEN = "<GGL>";
export const BOUNDARY_CLOSE = "</GGL>";

export function abiHash(tokenizerAbiObj, grammarAbiObj) {
  const tok = canonJsonBytesV1(tokenizerAbiObj);
  const gr = canonJsonBytesV1(grammarAbiObj);
  const joined = new Uint8Array(tok.length + 1 + gr.length);
  joined.set(tok, 0);
  joined[tok.length] = 0x0a;
  joined.set(gr, tok.length + 1);
  return sha256Hex(joined);
}

export function extractGgl(text) {
  const a = text.indexOf(BOUNDARY_OPEN);
  const b = text.indexOf(BOUNDARY_CLOSE);
  if (a < 0 || b < 0 || b < a) {
    return { ok: false, stage: "boundary", code: "E_GGL_BOUNDARY", score: 0.0 };
  }
  const inner = text.slice(a + BOUNDARY_OPEN.length, b).trim();
  const outside = (text.slice(0, a) + text.slice(b + BOUNDARY_CLOSE.length)).trim();
  if (outside.length) {
    return { ok: false, stage: "boundary", code: "E_GGL_OUTSIDE_TEXT", score: 0.05 };
  }
  return { ok: true, inner };
}

export function legalityScore(flags) {
  let s = 0;
  if (flags.boundary) s += 0.1;
  if (flags.tokenize) s += 0.15;
  if (flags.parse) s += 0.35;
  if (flags.legal) s += 0.3;
  if (flags.lower) s += 0.1;
  return Math.round(s * 1e6) / 1e6;
}

export function gglLegalityOracle(text, abi, wantLower = true) {
  const flags = { boundary: false, tokenize: false, parse: false, legal: false, lower: false };
  const ex = extractGgl(text);
  if (!ex.ok) return ex;

  flags.boundary = true;
  const tokErr = abiTokenizeOk(ex.inner, abi.tokenizer);
  if (tokErr) return { ok: false, stage: "tokenize", ...tokErr, score: legalityScore(flags) };
  flags.tokenize = true;

  let ast;
  try {
    ast = parseGglToAst(ex.inner, abi.grammar);
  } catch (e) {
    return { ok: false, stage: "parse", code: e.code || "E_PARSE", msg: e.message, score: legalityScore(flags) };
  }
  flags.parse = true;

  try {
    checkLegality(ast, abi.grammar);
  } catch (e) {
    return { ok: false, stage: "legal", code: e.code || "E_LEGAL", msg: e.message, score: legalityScore(flags), ast };
  }
  flags.legal = true;

  let lowered = null;
  if (wantLower) {
    try {
      lowered = lowerAstToSceneXjson(ast, abi.grammar);
      flags.lower = true;
    } catch (e) {
      return { ok: false, stage: "lower", code: e.code || "E_LOWER", msg: e.message, score: legalityScore(flags), ast };
    }
  }

  return { ok: true, stage: "ok", code: "OK", score: legalityScore(flags), ast, lowered };
}
