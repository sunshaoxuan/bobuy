package com.bobbuy.service;
import java.util.Locale;
import org.springframework.mail.SimpleMailMessage;
final class PasswordResetMailTemplate {
 private PasswordResetMailTemplate() {}
 static void apply(SimpleMailMessage mail,String link,Locale locale) {
  String language=locale.getLanguage(); boolean traditional=locale.getCountry().equals("TW")||locale.getCountry().equals("HK")||locale.getScript().equals("Hant");
  if(language.equals("ja")){mail.setSubject("Bobuy パスワード再設定");mail.setText("次のリンクから Bobuy パスワードを再設定してください（30分間有効）: "+link+"\nお心当たりがない場合は無視してください。");}
  else if(language.equals("en")){mail.setSubject("Reset your Bobuy password");mail.setText("Reset your Bobuy password within 30 minutes: "+link+"\nIf you did not request this, ignore this email.");}
  else if(traditional){mail.setSubject("重設 Bobuy 密碼");mail.setText("請在30分鐘內使用以下連結重設 Bobuy 密碼："+link+"\n若非本人操作，請忽略此信。");}
  else{mail.setSubject("重置 Bobuy 密码");mail.setText("请在30分钟内使用以下链接重置 Bobuy 密码："+link+"\n如非本人操作，请忽略此邮件。");}
 }
}
