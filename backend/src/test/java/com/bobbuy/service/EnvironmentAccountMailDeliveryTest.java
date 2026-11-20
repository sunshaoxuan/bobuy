package com.bobbuy.service;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.bobbuy.model.MailSettings;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
class EnvironmentAccountMailDeliveryTest {
 @Test void controlledDeliveryWorksWithBusinessFlagsOffAndDoesNotExposeCredential() {
  var properties=new AccountMailProperties(); var smtp=mock(SmtpDelivery.class);
  properties.setFromAddress("receipts@example.test");
  var delivery=new EnvironmentAccountMailDelivery(properties,smtp,"synthetic-password");
  delivery.sendControlledTest();
  var settings=ArgumentCaptor.forClass(MailSettings.class);
  var message=ArgumentCaptor.forClass(SimpleMailMessage.class);
  verify(smtp).send(settings.capture(),eq("synthetic-password"),message.capture());
  assertThat(properties.isDeliveryEnabled()).isFalse(); assertThat(properties.isPasswordResetEnabled()).isFalse();
  assertThat(settings.getValue().fromAddress).isEqualTo("postmaster@bobuy.cc");
  assertThat(message.getValue().getTo()).containsExactly("postmaster@bobuy.cc");
  assertThat(delivery.toString()).doesNotContain("synthetic-password");
 }
 @Test void missingCredentialFailsClosed() {
  var delivery=new EnvironmentAccountMailDelivery(new AccountMailProperties(),mock(SmtpDelivery.class),"");
  assertThatThrownBy(()->delivery.send(new SimpleMailMessage())).isInstanceOf(SmtpDelivery.DeliveryException.class).hasMessageNotContaining("password");
 }
}
