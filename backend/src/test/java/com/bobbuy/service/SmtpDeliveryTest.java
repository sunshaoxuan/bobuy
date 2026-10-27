package com.bobbuy.service;
import com.bobbuy.model.MailSettings;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class SmtpDeliveryTest {
 @Test void alwaysVerifiesServerIdentityRequiresEncryptionAndBoundsNetworkWaits() {
  var settings=new MailSettings();var delivery=new SmtpDelivery();
  var sender=delivery.createSender(settings,"synthetic");var p=sender.getJavaMailProperties();
  assertThat(sender.getHost()).isEqualTo("mail.briconbric.com");assertThat(sender.getPort()).isEqualTo(587);
  assertThat(p).containsEntry("mail.smtp.ssl.checkserveridentity","true").containsEntry("mail.smtp.starttls.required","true")
   .containsEntry("mail.smtp.starttls.enable","true").containsEntry("mail.smtp.ssl.enable","false")
   .containsEntry("mail.debug","false").containsEntry("mail.debug.auth","false")
   .containsEntry("mail.smtp.connectiontimeout","5000").containsEntry("mail.smtp.timeout","5000").containsEntry("mail.smtp.writetimeout","5000");
  assertThat(p).doesNotContainKey("mail.smtp.ssl.trust");
  settings.port=465;settings.tlsMode="TLS";var secure=delivery.createSender(settings,"synthetic").getJavaMailProperties();
  assertThat(secure).containsEntry("mail.smtp.ssl.enable","true").containsEntry("mail.smtp.ssl.checkserveridentity","true");
 }
}
