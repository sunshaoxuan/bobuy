package com.bobbuy.service;

import com.bobbuy.api.response.*;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MailSettingsService {
 private final MailSettingsRepository settings;
 private final MailSettingsEventRepository events;
 private final MailSecretCipher cipher;
 private final SmtpDelivery delivery;
 private final AuthService auth;
 private final Set<String> allowedHosts;
 private final Set<String> testRecipients;
 private Instant nextTest=Instant.EPOCH;
 public MailSettingsService(MailSettingsRepository settings,MailSettingsEventRepository events,
   MailSecretCipher cipher,SmtpDelivery delivery,AuthService auth,
   @Value("${bobuy.mail.allowed-hosts:mail.briconbric.com}") String hosts,
   @Value("${bobuy.mail.test-recipients:}") String recipients) {
  this.settings=settings; this.events=events; this.cipher=cipher; this.delivery=delivery; this.auth=auth;
  allowedHosts=split(hosts); testRecipients=split(recipients);
 }
 private Set<String> split(String text) {
  Set<String> result=new HashSet<>();
  for(String item:text.split(",")) if(!item.isBlank()) result.add(item.trim().toLowerCase(Locale.ROOT));
  return Set.copyOf(result);
 }
 public record View(long version,boolean enabled,String host,int port,String tlsMode,String username,
   String fromAddress,String replyTo,boolean passwordStored,String keyId,boolean keyReady,
   Instant updatedAt,List<String> allowedHosts,List<String> testRecipients) {}
 public record Edit(@Min(-1) long version,boolean enabled,@NotBlank @Size(max=253) String host,
   int port,@NotBlank String tlsMode,@NotBlank @Email @Size(max=254) String username,
   @NotBlank @Email @Size(max=254) String fromAddress,@NotBlank @Email @Size(max=254) String replyTo,
   @Size(max=1024) String password) {
  @Override public String toString() { return "MailSettingsEdit[REDACTED]"; }
 }
 public View view() { return view(settings.findById(1).orElseGet(MailSettings::new)); }
 private View view(MailSettings s) { return new View(s.updatedAt==null?-1:s.version,s.enabled,s.host,s.port,s.tlsMode,s.username,
  s.fromAddress,s.replyTo,s.encryptedPassword!=null,s.keyId,cipher.ready(),s.updatedAt,
  allowedHosts.stream().sorted().toList(),testRecipients.stream().sorted().toList()); }
 @Transactional
 public View save(Edit edit,Authentication authentication) {
  MailSettings s=settings.findById(1).orElseGet(MailSettings::new);
  if(edit.version()!=(s.updatedAt==null?-1:s.version)) throw invalid("Mail settings changed; reload before saving");
  String host=edit.host().trim().toLowerCase(Locale.ROOT);
  if(!allowedHosts.contains(host) || !host.matches("[a-z0-9][a-z0-9.-]*[a-z0-9]")) throw invalid("SMTP host is outside the approved allowlist");
  if(!(edit.port()==587 && "STARTTLS".equals(edit.tlsMode())) && !(edit.port()==465 && "TLS".equals(edit.tlsMode())))
   throw invalid("SMTP requires STARTTLS on 587 or TLS on 465");
  for(String value:List.of(edit.username(),edit.fromAddress(),edit.replyTo()))
   if(value.contains("\r") || value.contains("\n")) throw invalid("Invalid mailbox address");
  String password=edit.password();
  boolean supplied=password!=null && !password.isEmpty();
  boolean changed=!host.equals(s.host) || edit.port()!=s.port || !edit.tlsMode().equals(s.tlsMode)
   || !edit.username().trim().equals(s.username) || !edit.fromAddress().trim().equals(s.fromAddress) || !edit.replyTo().trim().equals(s.replyTo);
  if(changed && s.encryptedPassword!=null && !supplied) throw invalid("Re-enter the password when changing the SMTP identity or destination");
  if(!supplied && s.encryptedPassword!=null && cipher.ready()) password=cipher.decrypt(s.encryptedPassword,s.keyId,context(s));
  s.host=host; s.port=edit.port(); s.tlsMode=edit.tlsMode();
  s.username=edit.username().trim(); s.fromAddress=edit.fromAddress().trim(); s.replyTo=edit.replyTo().trim();
  if(password!=null && !password.isEmpty()) {
   if(!cipher.ready()) throw invalid("A protected external mail encryption key is required");
   s.encryptedPassword=cipher.encrypt(password,context(s)); s.keyId=cipher.activeId();
  }
  if(edit.enabled() && s.encryptedPassword==null) throw invalid("SMTP password is required before enabling delivery");
  if(edit.enabled() && !cipher.ready()) throw invalid("The mail encryption key is unavailable");
  s.enabled=edit.enabled(); s.updatedBy=auth.currentUser(authentication).id(); s.updatedAt=Instant.now();
  settings.saveAndFlush(s);
  events.save(new MailSettingsEvent(s.updatedBy,s.version,supplied?"SAVE_PASSWORD":"SAVE"));
  return view(s);
 }
 public synchronized void test(String recipient,Authentication authentication) {
  if(recipient==null || !testRecipients.contains(recipient.toLowerCase(Locale.ROOT))) throw invalid("Test recipient is not approved");
  if(Instant.now().isBefore(nextTest)) throw invalid("Wait 60 seconds before another test");
  MailSettings s=settings.findById(1).orElseThrow(()->invalid("Save SMTP settings first"));
  if(s.encryptedPassword==null) throw invalid("SMTP password is required");
  nextTest=Instant.now().plusSeconds(60);
  SimpleMailMessage message=new SimpleMailMessage();
  message.setTo(recipient); message.setSubject("Bobuy SMTP test");
  message.setText("Bobuy mail settings test. No account or verification token is included.");
  long actor=auth.currentUser(authentication).id();
  try { send(s,message); events.save(new MailSettingsEvent(actor,s.version,"TEST_SUCCESS")); }
  catch(Exception ignored) { events.save(new MailSettingsEvent(actor,s.version,"TEST_FAILED")); throw invalid("SMTP test failed; check the saved settings and mail server"); }
 }
 public boolean sendIfConfigured(SimpleMailMessage message) {
  var saved=settings.findById(1);
  if(saved.isEmpty()) return false;
  if(!saved.get().enabled) throw invalid("Configured email delivery is disabled");
  try { send(saved.get(),message); return true; }
  catch(Exception ignored) { throw invalid("Verification email could not be delivered; please try again later"); }
 }
 private void send(MailSettings s,SimpleMailMessage message) {
  // Revalidate persisted destination policy, including after an allowlist change.
  if(!allowedHosts.contains(s.host) || !(s.port==587 && "STARTTLS".equals(s.tlsMode) || s.port==465 && "TLS".equals(s.tlsMode)))
   throw invalid("SMTP destination is not approved");
  delivery.send(s,cipher.decrypt(s.encryptedPassword,s.keyId,context(s)),message);
 }
 private String context(MailSettings s) { return "bobuy-mail:v1:1:"+s.host+":"+s.port+":"+s.tlsMode+":"+s.username+":"+s.fromAddress+":"+s.replyTo; }
 private ApiException invalid(String text) { return new ApiException(ErrorCode.INVALID_REQUEST,text); }
}
