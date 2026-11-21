package com.bobbuy.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.bobbuy.api.response.ApiException;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import java.net.URI;
import java.time.*;
import java.util.Locale;
import java.util.Optional;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class PasswordResetServiceTest {
 PasswordResetTokenRepository tokens=mock(PasswordResetTokenRepository.class); UserRepository users=mock(UserRepository.class);
 RefreshTokenService refresh=mock(RefreshTokenService.class); MailSettingsService mail=mock(MailSettingsService.class);
 ApplicationEventPublisher events=mock(ApplicationEventPublisher.class);
 AccountMailProperties properties=new AccountMailProperties(); PasswordResetService service; User user;
 @BeforeEach void setup(){properties.setPasswordResetEnabled(true);properties.setDeliveryEnabled(true);properties.setPublicBaseUrl(URI.create("https://bobuy.example"));properties.setPasswordResetLinkTtl(Duration.ofMinutes(30));service=new PasswordResetService(tokens,users,new BCryptPasswordEncoder(4),refresh,mail,properties,events);user=new User();user.setId(7L);user.setName("Customer");user.setEmail("customer@example.test");user.setEnabled(true);}
 @Test void forgotIsIndistinguishableAndFailsClosed(){when(mail.protectedDeliveryReady()).thenReturn(false);assertTrue(service.forgot(user.getEmail()).accepted());assertTrue(service.forgot("missing@example.test").accepted());verifyNoInteractions(users,tokens);}
 @ParameterizedTest
 @CsvSource({
     "en-US, Reset your Bobuy password, 30 minutes, If you did not request this",
     "zh-CN, 重置 Bobuy 密码, 30分钟, 如非本人操作",
     "zh-TW, 重設 Bobuy 密碼, 30分鐘, 若非本人操作",
     "ja-JP, Bobuy パスワード再設定, 30分間, お心当たりがない場合"
 })
 void forgotStoresOnlyHashAndQueuesLocalizedMail(String tag, String subject, String expiry, String ignoreNotice) {
  when(mail.protectedDeliveryReady()).thenReturn(true);
  when(users.findByEmailIgnoreCase(user.getEmail())).thenReturn(Optional.of(user));
  when(users.lockById(user.getId())).thenReturn(Optional.of(user));
  var previousLocale = LocaleContextHolder.getLocaleContext();
  try {
   LocaleContextHolder.setLocale(Locale.forLanguageTag(tag));
   assertTrue(service.forgot(user.getEmail()).accepted());
  } finally {
   LocaleContextHolder.setLocaleContext(previousLocale);
  }

  var stored = ArgumentCaptor.forClass(PasswordResetToken.class);
  verify(tokens).saveAndFlush(stored.capture());
  var requested = ArgumentCaptor.forClass(PasswordResetService.PasswordResetMailRequested.class);
  verify(events).publishEvent(requested.capture());
  SimpleMailMessage sent = requested.getValue().message();
  assertEquals(subject, sent.getSubject());
  assertArrayEquals(new String[]{user.getEmail()}, sent.getTo());
  String body = sent.getText();
  assertNotNull(body);
  assertTrue(body.contains(expiry));
  assertTrue(body.contains(ignoreNotice));
  assertEquals(1, body.lines().filter(line -> line.contains("https://bobuy.example/reset-password#token=")).count());
  assertFalse(body.contains("?token="));
  String raw = body.substring(body.indexOf("#token=") + 7, body.indexOf('\n'));
  assertFalse(stored.getValue().getTokenHash().contains(raw));
  assertEquals(serviceHash(raw), stored.getValue().getTokenHash());
  assertEquals(64, stored.getValue().getEmailHash().length());
  verifyNoInteractions(refresh);
 }

 @Test void disabledPasswordResetDoesNotLookUpUsersOrQueueMail() {
  properties.setPasswordResetEnabled(false);
  assertTrue(service.forgot(user.getEmail()).accepted());
  verifyNoInteractions(mail, users, tokens, events);
 }
 @Test void resetConsumesChangesPasswordAndRevokesAllSessions(){var token=new PasswordResetToken();token.setUserId(user.getId());token.setEmailHash(serviceHash(user.getEmail()));token.setExpiresAt(Instant.now().plusSeconds(60));when(tokens.findUserIdByTokenHash(anyString())).thenReturn(Optional.of(user.getId()));when(tokens.findByTokenHashForUpdate(anyString())).thenReturn(Optional.of(token));when(users.lockById(user.getId())).thenReturn(Optional.of(user));assertTrue(service.reset("opaque-token","new-password").reset());assertTrue(new BCryptPasswordEncoder().matches("new-password",user.getPasswordHash()));verify(tokens).deleteAllByUserIdAndConsumedAtIsNull(user.getId());verify(refresh).revokeAllForUser(eq(user.getId()),eq(token.getConsumedAt()));assertThrows(ApiException.class,()->service.reset("opaque-token","new-password"));}
 @Test void rejectsTamperedExpiredAndOversizeUtf8(){when(tokens.findByTokenHash(anyString())).thenReturn(Optional.empty());assertThrows(ApiException.class,()->service.reset("tampered","valid-password"));assertThrows(ApiException.class,()->service.reset("token","界".repeat(25)));}
 private String serviceHash(String value){try{return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}catch(Exception e){throw new AssertionError(e);}}
}
