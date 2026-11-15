package com.bobbuy.service;
import java.util.Locale;
import java.time.Duration;
import java.math.BigDecimal;
import org.springframework.mail.SimpleMailMessage;
final class PasswordResetMailTemplate {
 private PasswordResetMailTemplate() {}
 static void apply(SimpleMailMessage mail,String link,Locale locale,Duration ttl) {
  String language=locale.getLanguage(); boolean traditional=locale.getCountry().equals("TW")||locale.getCountry().equals("HK")||locale.getScript().equals("Hant");
  boolean minutes=ttl.getNano()==0 && ttl.getSeconds()%60==0;
  String amount=minutes?Long.toString(ttl.toMinutes()):BigDecimal.valueOf(ttl.getSeconds()).add(BigDecimal.valueOf(ttl.getNano(),9)).stripTrailingZeros().toPlainString();
  if(language.equals("ja")){mail.setSubject("Bobuy パスワード再設定");mail.setText("次のリンクから Bobuy パスワードを再設定してください（"+amount+(minutes?"分間":"秒間")+"有効）: "+link+"\nお心当たりがない場合は無視してください。");}
  else if(language.equals("en")){mail.setSubject("Reset your Bobuy password");mail.setText("Reset your Bobuy password within "+amount+(minutes?" minutes":" seconds")+": "+link+"\nIf you did not request this, ignore this email.");}
  else if(traditional){mail.setSubject("重設 Bobuy 密碼");mail.setText("請在"+amount+(minutes?"分鐘":"秒")+"內使用以下連結重設 Bobuy 密碼："+link+"\n若非本人操作，請忽略此信。");}
  else{mail.setSubject("重置 Bobuy 密码");mail.setText("请在"+amount+(minutes?"分钟":"秒")+"内使用以下链接重置 Bobuy 密码："+link+"\n如非本人操作，请忽略此邮件。");}
 }
}
