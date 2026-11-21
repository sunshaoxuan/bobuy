package com.bobbuy.service;
import com.bobbuy.model.MailSettings;
import jakarta.mail.Address;
import jakarta.mail.MessagingException;
import jakarta.mail.Transport;
import org.junit.jupiter.api.Test;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
class SmtpDeliveryTest {
 @Test void alwaysVerifiesServerIdentityRequiresEncryptionAndBoundsNetworkWaits() {
  var settings=new MailSettings();var delivery=new SmtpDelivery(15000);
  var sender=delivery.createSender(settings,"synthetic");var p=sender.getJavaMailProperties();
  assertThat(sender.getHost()).isEqualTo("mail.briconbric.com");assertThat(sender.getPort()).isEqualTo(587);
  assertThat(p).containsEntry("mail.smtp.ssl.checkserveridentity","true").containsEntry("mail.smtp.starttls.required","true")
   .containsEntry("mail.smtp.starttls.enable","true").containsEntry("mail.smtp.ssl.enable","false")
   .containsEntry("mail.debug","false").containsEntry("mail.debug.auth","false")
   .containsEntry("mail.smtp.connectiontimeout","5000").containsEntry("mail.smtp.timeout","15000").containsEntry("mail.smtp.writetimeout","5000");
  assertThat(p).doesNotContainKey("mail.smtp.ssl.trust");
  settings.port=465;settings.tlsMode="TLS";var secure=delivery.createSender(settings,"synthetic").getJavaMailProperties();
  assertThat(secure).containsEntry("mail.smtp.ssl.enable","true").containsEntry("mail.smtp.ssl.checkserveridentity","true");
 }

 @Test void readTimeoutIsConfigurableWithinBounds() {
  var settings=new MailSettings();
  assertThat(new SmtpDelivery(12000).createSender(settings,"synthetic").getJavaMailProperties())
      .containsEntry("mail.smtp.timeout","12000");
  assertThatIllegalArgumentException().isThrownBy(()->new SmtpDelivery(4999));
  assertThatIllegalArgumentException().isThrownBy(()->new SmtpDelivery(30001));
 }

 @Test void acceptedSubmissionSurvivesFailureDuringCloseWithoutRetry() throws Exception {
  Transport transport=mock(Transport.class);
  SmtpDelivery delivery=deliveryWith(transport);
  doThrow(new MessagingException("synthetic quit failure")).when(transport).close();
  assertThatCode(()->delivery.send(new MailSettings(),"synthetic",message())).doesNotThrowAnyException();
  verify(transport).sendMessage(any(),any(Address[].class));
  verify(transport).close();
 }

 @Test void lostSubmissionReplyRemainsUnknownWithoutRetry() throws Exception {
  Transport transport=mock(Transport.class);
  SmtpDelivery delivery=deliveryWith(transport);
  doThrow(new MessagingException("synthetic lost reply")).when(transport).sendMessage(any(),any(Address[].class));
  assertThatThrownBy(()->delivery.send(new MailSettings(),"synthetic",message()))
      .isInstanceOfSatisfying(SmtpDelivery.Failure.class,failure->assertThat(failure.stage).isEqualTo(SmtpDelivery.Stage.SUBMIT_UNKNOWN))
      .hasMessageNotContaining("synthetic");
  verify(transport).sendMessage(any(),any(Address[].class));
  verify(transport).close();
 }

 private SmtpDelivery deliveryWith(Transport transport) {
  return new SmtpDelivery(15000) {
   @Override Transport openTransport(JavaMailSenderImpl sender) { return transport; }
  };
 }

 private SimpleMailMessage message() {
  var message=new SimpleMailMessage();
  message.setTo("recipient@example.test");
  message.setSubject("Synthetic test");
  message.setText("Synthetic content");
  return message;
 }
}
