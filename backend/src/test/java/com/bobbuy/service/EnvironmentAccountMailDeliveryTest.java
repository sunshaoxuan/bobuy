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
  var delivery=new EnvironmentAccountMailDelivery(properties,smtp,"synthetic-password");
  var message=new SimpleMailMessage(); message.setTo("postmaster@bobuy.cc"); delivery.send(message);
  var settings=ArgumentCaptor.forClass(MailSettings.class); verify(smtp).send(settings.capture(),eq("synthetic-password"),same(message));
  assertThat(properties.isDeliveryEnabled()).isFalse(); assertThat(properties.isPasswordResetEnabled()).isFalse();
  assertThat(settings.getValue().fromAddress).isEqualTo("postmaster@bobuy.cc"); assertThat(delivery.toString()).doesNotContain("synthetic-password");
 }
 @Test void missingCredentialFailsClosed() {
  var delivery=new EnvironmentAccountMailDelivery(new AccountMailProperties(),mock(SmtpDelivery.class),"");
  assertThatThrownBy(()->delivery.send(new SimpleMailMessage())).isInstanceOf(SmtpDelivery.DeliveryException.class).hasMessageNotContaining("password");
 }
}
