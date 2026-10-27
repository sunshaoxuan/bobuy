package com.bobbuy.api;

import com.bobbuy.repository.UserRepository;
import com.bobbuy.security.JwtTokenService;
import com.bobbuy.service.BobbuyStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="bobbuy.security.header-auth.enabled=false") @AutoConfigureMockMvc
class CurrencyDirectoryIntegrationTest {
 @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired BobbuyStore store;
 @Autowired UserRepository users; @Autowired JwtTokenService tokens;
 @Test void sharedDirectoryRetainsBothReadContractsAndMerchantBoundary() throws Exception {
  store.seed();
  String agent=tokens.createAccessToken(users.findById(1000L).orElseThrow());
  String customer=tokens.createAccessToken(users.findById(1001L).orElseThrow());
  var publicRows=json.readTree(mvc.perform(get("/api/storefront/currencies")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("data");
  var merchantRows=json.readTree(mvc.perform(get("/api/merchant/currencies").header("Authorization","Bearer "+agent)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("data");
  assertThat(merchantRows).isEqualTo(publicRows);assertThat(publicRows).hasSize(4);
  assertThat(publicRows.findValuesAsText("code")).containsExactly("CNY","JPY","TWD","USD");
  assertThat(publicRows.findValues("saleEnabled").stream().filter(n->n.asBoolean()).count()).isEqualTo(1);
  mvc.perform(get("/api/merchant/currencies")).andExpect(status().isUnauthorized());
  mvc.perform(get("/api/merchant/currencies").header("Authorization","Bearer "+customer)).andExpect(status().isForbidden());
 }
}
