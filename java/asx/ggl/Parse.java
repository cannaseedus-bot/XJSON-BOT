package asx.ggl;

import java.util.Map;
import java.util.HashMap;

public final class Parse {
  private Parse() {}

  public static Object parseToAst(String text, Object grammarAbi) {
    if (text == null || text.trim().isEmpty()) {
      throw new IllegalArgumentException("empty GGL payload");
    }
    Map<String, Object> ast = new HashMap<>();
    ast.put("type", "GGLRaw");
    ast.put("text", text);
    ast.put("grammar_id", grammarAbi instanceof Map ? ((Map<?, ?>) grammarAbi).get("id") : "unknown");
    return ast;
  }
}
