package asx.ggl;

import asx.abi.AbiLoader;

public final class Oracle {
  public static final class Result {
    public final boolean ok;
    public final String stage;
    public final String code;
    public final String msg;
    public final double score;

    public Result(boolean ok, String stage, String code, String msg, double score) {
      this.ok = ok;
      this.stage = stage;
      this.code = code;
      this.msg = msg;
      this.score = score;
    }
  }

  private Oracle() {}

  static double score(boolean boundary, boolean tokenize, boolean parse, boolean legal, boolean lower) {
    double s = 0.0;
    if (boundary) s += 0.10;
    if (tokenize) s += 0.15;
    if (parse) s += 0.35;
    if (legal) s += 0.30;
    if (lower) s += 0.10;
    return Math.round(s * 1e6) / 1e6;
  }

  public static Result verify(String text, AbiLoader abi, boolean wantLower) {
    boolean b = false;
    boolean t = false;
    boolean p = false;
    boolean l = false;
    boolean lo = false;

    Boundary.Extract ex = Boundary.extract(text);
    if (!ex.ok) {
      return new Result(false, "boundary", ex.code, ex.msg, ex.score);
    }

    b = true;

    TokenizeAbi.Err terr = TokenizeAbi.check(ex.inner, abi.tokenizerAbi);
    if (terr != null) {
      return new Result(false, "tokenize", terr.code, terr.msg, score(b, false, false, false, false));
    }
    t = true;

    Object ast;
    try {
      ast = Parse.parseToAst(ex.inner, abi.grammarAbi);
    } catch (RuntimeException e) {
      return new Result(false, "parse", "E_PARSE", e.getMessage(), score(b, t, false, false, false));
    }
    p = true;

    try {
      Legal.check(ast, abi.grammarAbi);
    } catch (RuntimeException e) {
      return new Result(false, "legal", "E_LEGAL", e.getMessage(), score(b, t, p, false, false));
    }
    l = true;

    if (wantLower) {
      try {
        Lower.lower(ast, abi.grammarAbi);
        lo = true;
      } catch (RuntimeException e) {
        return new Result(false, "lower", "E_LOWER", e.getMessage(), score(b, t, p, l, false));
      }
    }

    return new Result(true, "ok", "OK", "legal", score(b, t, p, l, lo));
  }
}
