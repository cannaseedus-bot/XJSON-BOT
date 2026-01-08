package asx.abi;

import asx.canon.JsonCanonV1;
import asx.hash.Sha256;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

public final class AbiLoader {
  public final String abiHashHex;
  public final Object tokenizerAbi;
  public final Object grammarAbi;

  private AbiLoader(String h, Object t, Object g) {
    this.abiHashHex = h;
    this.tokenizerAbi = t;
    this.grammarAbi = g;
  }

  public static AbiLoader load(Path tokPath, Path grPath, JsonAdapter json) throws Exception {
    byte[] tokRaw = Files.readAllBytes(tokPath);
    byte[] grRaw = Files.readAllBytes(grPath);

    Object tokObj = json.parse(new String(tokRaw, StandardCharsets.UTF_8));
    Object grObj = json.parse(new String(grRaw, StandardCharsets.UTF_8));

    byte[] tokCanon = JsonCanonV1.canonBytes(tokObj, json);
    byte[] grCanon = JsonCanonV1.canonBytes(grObj, json);

    byte[] joined = new byte[tokCanon.length + 1 + grCanon.length];
    System.arraycopy(tokCanon, 0, joined, 0, tokCanon.length);
    joined[tokCanon.length] = (byte) 0x0A;
    System.arraycopy(grCanon, 0, joined, tokCanon.length + 1, grCanon.length);

    String h = Sha256.hex(joined);
    return new AbiLoader(h, tokObj, grObj);
  }

  public interface JsonAdapter extends JsonCanonV1.JsonAdapter {}
}
