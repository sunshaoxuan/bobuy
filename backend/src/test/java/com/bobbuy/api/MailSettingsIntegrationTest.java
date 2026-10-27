package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.JwtTokenService;
import com.bobbuy.service.*;
import com.fasterxml.jackson.databind.*;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.system.*;
import org.springframework.test.context.*;
import org.springframework.http.MediaType;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.web.servlet.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ExtendWith(OutputCaptureExtension.class)
class MailSettingsIntegrationTest {
 static final Path KEYRING;
 static { try {
  KEYRING=Files.createTempFile("bobuy-synthetic-mail-", ".keys");KEYRING.toFile().deleteOnExit();
  byte[] key=new byte[32];new java.security.SecureRandom().nextBytes(key);
  Files.writeString(KEYRING,"test-v1="+Base64.getEncoder().encodeToString(key));
 } catch(Exception e) {throw new ExceptionInInitializerError(e);} }
 @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
  registry.add("bobuy.mail.keyring-file",KEYRING::toString);
  registry.add("bobuy.mail.active-key-id",()->"test-v1");
  registry.add("bobuy.mail.test-recipients",()->"self@example.test");
 }
 @Autowired MockMvc mvc; @Autowired ObjectMapper json;
 @Autowired UserRepository users; @Autowired JwtTokenService tokens;
 @Autowired MailSettingsRepository settings; @Autowired MailSettingsEventRepository events;
 @Autowired MailSettingsService service; @Autowired MailSecretCipher cipher;
 @MockBean SmtpDelivery smtp; @MockBean JavaMailSender fallback;
 String admin;String merchant;String customer;
 @BeforeEach void setup() {
  events.deleteAll();settings.deleteAll();reset(smtp,fallback);
  admin=token(918000L,true,Role.AGENT);merchant=token(918001L,false,Role.AGENT);customer=token(918002L,false,Role.CUSTOMER);
 }
 @AfterEach void cleanup() {events.deleteAll();settings.deleteAll();for(long id:List.of(918000L,918001L,918002L))users.deleteById(id);}
 String token(long id,boolean platform,Role role) {User u=new User(id,"mail-test-"+id,role,0);u.setPlatformAdmin(platform);users.save(u);return tokens.createAccessToken(u);}
 Map<String,Object> edit() {return new HashMap<>(Map.of("version",-1,"enabled",false,"host","mail.briconbric.com","port",587,"tlsMode","STARTTLS","username","postmaster@bobuy.cc","fromAddress","postmaster@bobuy.cc","replyTo","postmaster@bobuy.cc","password","synthetic-secret"));}
 ResultActions save(Map<String,Object> body,String token) throws Exception {return mvc.perform(put("/api/admin/settings/mail").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));}
 @Test void onlyPlatformAdministratorCanReadWriteOrTest() throws Exception {
  mvc.perform(get("/api/admin/settings/mail")).andExpect(status().isForbidden());
  for(String token:List.of(merchant,customer)) {
   mvc.perform(get("/api/admin/settings/mail").header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
   save(edit(),token).andExpect(status().isForbidden());
   mvc.perform(post("/api/admin/settings/mail/test").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content("{\"recipient\":\"self@example.test\"}")).andExpect(status().isForbidden());
  }
  assertThat(settings.count()).isZero();verifyNoInteractions(smtp);
 }
 @Test void persistsOnlyAuthenticatedCiphertextAndBlankPasswordKeepsItOnReopen() throws Exception {
  save(edit(),admin).andExpect(status().isOk()).andExpect(jsonPath("$.data.passwordStored").value(true)).andExpect(jsonPath("$.data.password").doesNotExist()).andExpect(jsonPath("$.data.encryptedPassword").doesNotExist());
  var first=settings.findById(1).orElseThrow();assertThat(first.encryptedPassword).doesNotContain("synthetic-secret");
  var request=edit();request.put("version",first.version);request.put("password","");
  save(request,admin).andExpect(status().isOk());
  mvc.perform(get("/api/admin/settings/mail").header("Authorization","Bearer "+admin)).andExpect(status().isOk()).andExpect(jsonPath("$.data.passwordStored").value(true)).andExpect(jsonPath("$.data.keyId").value("test-v1"));
  assertThat(events.findAll()).allSatisfy(e->assertThat(e.eventType).isIn("SAVE","SAVE_PASSWORD"));
  assertThat(json.writeValueAsString(events.findAll())).doesNotContain("synthetic-secret","postmaster@bobuy.cc");
  verifyNoInteractions(smtp);
 }
 @Test void rejectsInsecureTlsUnapprovedHostsHeaderInjectionAndStaleSave() throws Exception {
  for(var change:List.of(Map.of("port",25),Map.of("tlsMode","NONE"),Map.of("host","127.0.0.1"),Map.of("host","unapproved.example"),Map.of("fromAddress","postmaster@bobuy.cc\r\nBcc:target@example.test"))) {
   var request=edit();request.putAll(change);save(request,admin).andExpect(status().isBadRequest());
  }
  save(edit(),admin).andExpect(status().isOk());
  var request=edit();request.put("version",99);save(request,admin).andExpect(status().isBadRequest());
  verifyNoInteractions(smtp);
 }
 @Test void parsingValidationAndTransportFailureDoNotLeakSubmittedPassword(CapturedOutput output) throws Exception {
  String marker="must-not-log-UNIQUE-987";
  mvc.perform(put("/api/admin/settings/mail").header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content("{\"password\":\""+marker+"\",BROKEN}")).andExpect(status().isBadRequest()).andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString(marker))));
  var invalid=edit();invalid.put("password",marker);invalid.put("username","invalid");save(invalid,admin).andExpect(status().isBadRequest());
  assertThat(output.getAll()).doesNotContain(marker);
 }
 @Test void controlledTestUsesOnlyApprovedRecipientSavedConfigAndRateLimit() throws Exception {
  save(edit(),admin).andExpect(status().isOk());
  mvc.perform(post("/api/admin/settings/mail/test").header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content("{\"recipient\":\"third-party@example.test\"}")).andExpect(status().isBadRequest());
  verifyNoInteractions(smtp);
  mvc.perform(post("/api/admin/settings/mail/test").header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content("{\"recipient\":\"self@example.test\"}")).andExpect(status().isOk());
  verify(smtp).send(argThat(s->s.port==587 && s.tlsMode.equals("STARTTLS")),eq("synthetic-secret"),argThat(m->Arrays.equals(m.getTo(),new String[]{"self@example.test"})));
  mvc.perform(post("/api/admin/settings/mail/test").header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content("{\"recipient\":\"self@example.test\"}")).andExpect(status().isBadRequest());
  assertThat(events.findAll()).anyMatch(e->e.eventType.equals("TEST_SUCCESS"));
 }
 @Test void registrationDeliveryUsesSameSavedIdentityAndFailsClosedWhenDisabledOrTampered() throws Exception {
  assertThat(service.sendIfConfigured(new SimpleMailMessage())).isFalse();
  var request=edit();save(request,admin).andExpect(status().isOk());
  assertThatThrownBy(()->service.sendIfConfigured(new SimpleMailMessage())).hasMessage("Configured email delivery is disabled");
  var row=settings.findById(1).orElseThrow();request.put("version",row.version);request.put("enabled",true);request.put("password","");save(request,admin).andExpect(status().isOk());
  assertThat(service.sendIfConfigured(new SimpleMailMessage())).isTrue();verify(smtp).send(any(),eq("synthetic-secret"),any());reset(smtp);
  row=settings.findById(1).orElseThrow();row.username="tampered@bobuy.cc";settings.saveAndFlush(row);
  assertThatThrownBy(()->service.sendIfConfigured(new SimpleMailMessage())).hasMessage("Verification email could not be delivered; please try again later");
  verifyNoInteractions(smtp);
 }
}
