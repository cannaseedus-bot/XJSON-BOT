package asx.ggl;

import java.util.Map;
import java.util.HashMap;

public final class Lower {
  private Lower() {}

  @SuppressWarnings("unchecked")
  public static Object lower(Object ast, Object grammarAbi) {
    if (!(ast instanceof Map)) {
      throw new IllegalArgumentException("unexpected AST node type");
    }
    Map<String, Object> astMap = (Map<String, Object>) ast;
    if (!"GGLRaw".equals(astMap.get("type"))) {
      throw new IllegalArgumentException("unexpected AST node type");
    }
    Map<String, Object> out = new HashMap<>();
    out.put("@type", "scene.ir.v1");
    out.put("ggl", astMap.get("text"));
    if (grammarAbi instanceof Map) {
      out.put("grammar_id", ((Map<?, ?>) grammarAbi).get("id"));
    }
    return out;
  }
}
