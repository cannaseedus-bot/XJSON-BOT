package asx.ggl;

import java.util.List;
import java.util.Set;
import java.util.HashSet;

public final class TokenizeAbi {
  public static final class Err {
    public final String code;
    public final String msg;

    public Err(String code, String msg) {
      this.code = code;
      this.msg = msg;
    }
  }

  private TokenizeAbi() {}

  @SuppressWarnings("unchecked")
  public static Err check(String text, Object tokenizerAbi) {
    if (!(tokenizerAbi instanceof java.util.Map)) {
      return null;
    }
    Object allowed = ((java.util.Map<String, Object>) tokenizerAbi).get("allowed_chars");
    if (!(allowed instanceof List)) {
      return null;
    }
    Set<String> allowedSet = new HashSet<>();
    for (Object o : (List<Object>) allowed) {
      allowedSet.add(String.valueOf(o));
    }
    for (int i = 0; i < text.length(); i += 1) {
      String ch = String.valueOf(text.charAt(i));
      if (!allowedSet.contains(ch)) {
        return new Err("E_TOKEN_CHAR", "disallowed character: " + ch);
      }
    }
    return null;
  }
}
