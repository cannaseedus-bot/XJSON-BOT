package asx.ggl;

import java.util.Map;

public final class Legal {
  private Legal() {}

  @SuppressWarnings("unchecked")
  public static void check(Object ast, Object grammarAbi) {
    if (!(ast instanceof Map)) {
      throw new IllegalArgumentException("unexpected AST node type");
    }
    Object type = ((Map<String, Object>) ast).get("type");
    if (!"GGLRaw".equals(type)) {
      throw new IllegalArgumentException("unexpected AST node type");
    }
  }
}
