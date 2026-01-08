package asx.hash;

import java.security.MessageDigest;

public final class Sha256 {
  private Sha256() {}

  public static String hex(byte[] data) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    byte[] out = digest.digest(data);
    StringBuilder sb = new StringBuilder(out.length * 2);
    for (byte b : out) {
      sb.append(String.format("%02x", b));
    }
    return sb.toString();
  }
}
