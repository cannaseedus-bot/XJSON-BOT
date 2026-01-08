package asx.ggl;

public final class Boundary {
  public static final String OPEN = "<GGL>";
  public static final String CLOSE = "</GGL>";

  public static final class Extract {
    public final boolean ok;
    public final String inner;
    public final String code;
    public final String msg;
    public final double score;

    private Extract(boolean ok, String inner, String code, String msg, double score) {
      this.ok = ok;
      this.inner = inner;
      this.code = code;
      this.msg = msg;
      this.score = score;
    }
  }

  private Boundary() {}

  public static Extract extract(String text) {
    int a = text.indexOf(OPEN);
    int b = text.indexOf(CLOSE);
    if (a < 0 || b < 0 || b < a) {
      return new Extract(false, null, "E_GGL_BOUNDARY", "missing or malformed <GGL>...</GGL> boundary", 0.0);
    }
    String inner = text.substring(a + OPEN.length(), b).trim();
    String outside = (text.substring(0, a) + text.substring(b + CLOSE.length())).trim();
    if (!outside.isEmpty()) {
      return new Extract(false, null, "E_GGL_OUTSIDE_TEXT", "non-empty text outside GGL boundary", 0.05);
    }
    return new Extract(true, inner, "OK", "ok", 0.0);
  }
}
