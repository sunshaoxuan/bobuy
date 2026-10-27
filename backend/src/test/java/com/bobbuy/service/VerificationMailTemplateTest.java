package com.bobbuy.service;
import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.springframework.mail.SimpleMailMessage;
import static org.assertj.core.api.Assertions.*;
class VerificationMailTemplateTest {
 @Test void fourLocalesUseCorrectSiteAndSameCodeWithoutLocaleAffectingIdentity() {
  String[] tags={"ja-JP","zh-CN","zh-TW","en-US"};String[] expected={"確認コード","验证码","驗證碼","verification code"};
  for(int i=0;i<tags.length;i++) {var m=new SimpleMailMessage();m.setFrom("postmaster@bobuy.cc");VerificationMailTemplate.apply(m,"123456",Locale.forLanguageTag(tags[i]));
   assertThat(m.getText()).contains(expected[i],"123456","https://bobuy.cc/account");assertThat(m.getFrom()).isEqualTo("postmaster@bobuy.cc");}
 }
}
