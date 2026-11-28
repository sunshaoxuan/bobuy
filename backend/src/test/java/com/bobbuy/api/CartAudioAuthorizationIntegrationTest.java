package com.bobbuy.api;
import com.bobbuy.security.RoleInjectionFilter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
@SpringBootTest @AutoConfigureMockMvc
class CartAudioAuthorizationIntegrationTest {
 @Autowired MockMvc mvc;
 @Test void capabilityRequiresCustomerAuthentication()throws Exception{
  mvc.perform(get("/api/cart/audio-transcription")).andExpect(status().isUnauthorized());
  mvc.perform(get("/api/cart/audio-transcription").header(RoleInjectionFilter.ROLE_HEADER,"AGENT")).andExpect(status().isForbidden());
  mvc.perform(get("/api/cart/audio-transcription").header(RoleInjectionFilter.ROLE_HEADER,"CUSTOMER")).andExpect(status().isOk());
 }
}
