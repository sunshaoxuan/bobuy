package com.bobbuy.service;

import java.time.Duration;
import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.springframework.mail.SimpleMailMessage;
import static org.assertj.core.api.Assertions.assertThat;

class PasswordResetMailTemplateTest {
 @Test void configuredExpiryIsExactInEveryLocale() {
  String[] tags={"ja-JP","zh-CN","zh-TW","en-US"};
  String[] minuteUnits={"分間","分钟","分鐘"," minutes"};
  String[] secondUnits={"秒間","秒","秒"," seconds"};
  Duration[] ttls={Duration.ofMinutes(5),Duration.ofMinutes(30),Duration.ofHours(24),Duration.ofSeconds(301),Duration.ofMillis(300500)};
  String[] amounts={"5","30","1440","301","300.5"};
  for(int i=0;i<tags.length;i++) for(int j=0;j<ttls.length;j++) {
   var message=new SimpleMailMessage();
   PasswordResetMailTemplate.apply(message,"https://example.test/reset",Locale.forLanguageTag(tags[i]),ttls[j]);
   assertThat(message.getText()).contains(amounts[j]+(j<3?minuteUnits[i]:secondUnits[i]),"https://example.test/reset");
  }
 }
}
