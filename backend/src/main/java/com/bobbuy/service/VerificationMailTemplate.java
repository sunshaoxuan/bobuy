package com.bobbuy.service;
import java.util.Locale;
import org.springframework.mail.SimpleMailMessage;
final class VerificationMailTemplate {
 private VerificationMailTemplate() {}
 static void apply(SimpleMailMessage mail,String code,Locale locale) {
  String lang=locale.getLanguage();boolean traditional=locale.getCountry().equals("TW") || locale.getScript().equals("Hant") || locale.getCountry().equals("HK");
  String subject,text;
  if(lang.equals("ja")) {subject="Bobuy メールアドレス確認";text="確認コード: "+code+"。10分間有効です。https://bobuy.cc/account で入力してください。お心当たりがない場合は無視してください。";}
  else if(lang.equals("en")) {subject="Bobuy email verification";text="Your verification code is "+code+". It expires in 10 minutes. Enter it at https://bobuy.cc/account . If you did not request this, ignore this email.";}
  else if(traditional) {subject="Bobuy 電子郵件驗證";text="您的驗證碼為 "+code+"，10分鐘內有效。請在 https://bobuy.cc/account 輸入；若非本人操作，請忽略此信。";}
  else {subject="Bobuy 邮箱验证";text="您的验证码为 "+code+"，10分钟内有效。请在 https://bobuy.cc/account 输入；如非本人操作，请忽略此信。";}
  mail.setSubject(subject);mail.setText(text);
 }
}
