package com.bobbuy.livecart;
public final class LiveCartException extends RuntimeException {
  private final int status; private final String code;
  public LiveCartException(int status,String code){super(code);this.status=status;this.code=code;}
  public int status(){return status;} public String code(){return code;}
  public static LiveCartException conflict(String code){return new LiveCartException(409,code);}
  public static LiveCartException invalid(String code){return new LiveCartException(400,code);}
  public static LiveCartException forbidden(){return new LiveCartException(403,"CART_FORBIDDEN");}
}
