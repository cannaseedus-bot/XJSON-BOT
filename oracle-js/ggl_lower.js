export class LowerError extends Error {
  constructor(code, msg) {
    super(msg);
    this.code = code;
    this.msg = msg;
  }
}

export function lowerAstToSceneXjson(ast, grammarAbi) {
  if (ast?.type !== "GGLRaw") {
    throw new LowerError("E_LOWER_TYPE", "unexpected AST node type");
  }
  return {
    "@type": "scene.ir.v1",
    ggl: ast.text ?? "",
    grammar_id: grammarAbi?.id ?? "unknown",
  };
}
