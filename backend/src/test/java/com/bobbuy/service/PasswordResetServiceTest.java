package com.bobbuy.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.bobbuy.api.response.ApiException;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import java.net.URI;
import java.time.*;
import java.util.Optional;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class PasswordResetServiceTest {
 PasswordResetTokenRepository tokens=mock(PasswordResetTokenRepository.class); UserRepository users=mock(UserRepository.class);
 RefreshTokenService refresh=mock(RefreshTokenService.class); MailSettingsService mail=mock(MailSettingsService.class);
 ApplicationEventPublisher events=mock(ApplicationEventPublisher.class);
 AccountMailProperties properties=new AccountMailProperties(); PasswordResetService service; User user;
 @BeforeEach void setup(){properties.setPasswordResetEnabled(true);properties.setDeliveryEnabled(true);properties.setPublicBaseUrl(URI.create("https://bobuy.example"));properties.setPasswordResetLinkTtl(Duration.ofMinutes(30));service=new PasswordResetService(tokens,users,new BCryptPasswordEncoder(4),refresh,mail,properties,events);user=new User();user.setId(7L);user.setName("Customer");user.setEmail("customer@example.test");user.setEnabled(true);}
 @Test void forgotIsIndistinguishableAndFailsClosed(){when(mail.protectedDeliveryReady()).thenReturn(false);assertTrue(service.forgot(user.getEmail()).accepted());assertTrue(service.forgot("missing@example.test").accepted());verifyNoInteractions(users,tokens);}
 @Test void forgotStoresOnlyHashAndQueuesLocalizedMail(){when(mail.protectedDeliveryReady()).thenReturn(true);when(users.findByEmailIgnoreCase(user.getEmail())).thenReturn(Optional.of(user));when(users.lockById(user.getId())).thenReturn(Optional.of(user));service.forgot(user.getEmail());var stored=ArgumentCaptor.forClass(PasswordResetToken.class);verify(tokens).saveAndFlush(stored.capture());var requested=ArgumentCaptor.forClass(PasswordResetService.PasswordResetMailRequested.class);verify(events).publishEvent(requested.capture());SimpleMailMessage sent=requested.getValue().message();String body=sent.getText();assertNotNull(body);assertTrue(body.contains("#token="));assertFalse(body.contains("?token="));String raw=body.substring(body.indexOf("#token=")+7,body.indexOf('\n'));assertFalse(stored.getValue().getTokenHash().contains(raw));assertEquals(64,stored.getValue().getTokenHash().length());assertEquals(64,stored.getValue().getEmailHash().length());verifyNoInteractions(refresh);}
 @Test void resetConsumesChangesPasswordAndRevokesAllSessions(){var token=new PasswordResetToken();token.setUserId(user.getId());token.setEmailHash(serviceHash(user.getEmail()));token.setExpiresAt(Instant.now().plusSeconds(60));when(tokens.findUserIdByTokenHash(anyString())).thenReturn(Optional.of(user.getId()));when(tokens.findByTokenHashForUpdate(anyString())).thenReturn(Optional.of(token));when(users.lockById(user.getId())).thenReturn(Optional.of(user));assertTrue(service.reset("opaque-token","new-password").reset());assertTrue(new BCryptPasswordEncoder().matches("new-password",user.getPasswordHash()));verify(tokens).deleteAllByUserIdAndConsumedAtIsNull(user.getId());verify(refresh).revokeAllForUser(eq(user.getId()),eq(token.getConsumedAt()));assertThrows(ApiException.class,()->service.reset("opaque-token","new-password"));}
 @Test void rejectsTamperedExpiredAndOversizeUtf8(){when(tokens.findByTokenHash(anyString())).thenReturn(Optional.empty());assertThrows(ApiException.class,()->service.reset("tampered","valid-password"));assertThrows(ApiException.class,()->service.reset("token","界".repeat(25)));}
 private String serviceHash(String value){try{return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}catch(Exception e){throw new AssertionError(e);}}
}
