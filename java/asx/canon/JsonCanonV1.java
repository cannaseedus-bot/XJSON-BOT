package asx.canon;

import java.nio.charset.StandardCharsets;

public final class JsonCanonV1 {
  private JsonCanonV1() {}

  public static byte[] canonBytes(Object obj, JsonAdapter json) throws Exception {
    String canonical = json.stringify(obj);
    return canonical.getBytes(StandardCharsets.UTF_8);
  }

  public interface JsonAdapter {
    Object parse(String s) throws Exception;
    String stringify(Object o) throws Exception;
  }
}
