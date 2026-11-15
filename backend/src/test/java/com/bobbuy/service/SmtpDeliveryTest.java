package com.bobbuy.service;
import com.bobbuy.model.MailSettings;
import org.junit.jupiter.api.Test;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import static org.assertj.core.api.Assertions.*;
class SmtpDeliveryTest {
 @Test void wrappedStartTlsFailureIsTls() {
  assertWrappedFailure(new javax.net.ssl.SSLException("Unsupported or unrecognized SSL message"),SmtpDelivery.FailureCategory.TLS);
 }
 @Test void wrappedConnectionFailureIsConnection() {
  assertWrappedFailure(new java.net.ConnectException("Connection refused"),SmtpDelivery.FailureCategory.CONNECTION);
 }
 @Test void wrappedTimeoutIsTimeout() {
  assertWrappedFailure(new java.net.SocketTimeoutException("Read timed out"),SmtpDelivery.FailureCategory.TIMEOUT);
 }
 @Test void wrappedAuthenticationFailureIsAuthentication() {
  assertWrappedFailure(new jakarta.mail.AuthenticationFailedException("535 authentication failed"),SmtpDelivery.FailureCategory.AUTHENTICATION);
 }
 @Test void wrappedRejectionIsRejected() {
  assertWrappedFailure(new jakarta.mail.MessagingException("550 recipient rejected"),SmtpDelivery.FailureCategory.REJECTED);
 }
 private void assertWrappedFailure(Exception cause,SmtpDelivery.FailureCategory category) {
  var failure=new MailSendException("Mail server connection failed",cause);
  var delivery=new SmtpDelivery() {
   @Override JavaMailSenderImpl createSender(MailSettings settings,String password) {
    return new JavaMailSenderImpl() {
     @Override public void send(SimpleMailMessage message) { throw failure; }
    };
   }
  };
  assertThatThrownBy(()->delivery.send(new MailSettings(),null,new SimpleMailMessage()))
   .isInstanceOfSatisfying(SmtpDelivery.DeliveryException.class,error->assertThat(error.category()).isEqualTo(category));
 }
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
