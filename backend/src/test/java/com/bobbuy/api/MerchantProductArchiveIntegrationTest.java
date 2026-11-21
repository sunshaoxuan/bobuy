package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.repository.ProductRepository;
import com.bobbuy.repository.UserRepository;
import com.bobbuy.security.JwtTokenService;
import com.bobbuy.service.BobbuyStore;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@EnabledIfEnvironmentVariable(named="BOBBUY_ARCHIVE_ISOLATED_TEST",matches="true")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.DEFINED_PORT,properties={
 "server.port=18082","spring.datasource.url=jdbc:postgresql://127.0.0.1:55433/archive",
 "spring.datasource.username=archive","spring.datasource.password=archive-local-only",
 "spring.datasource.driver-class-name=org.postgresql.Driver","spring.jpa.hibernate.ddl-auto=create-drop",
 "spring.flyway.enabled=false","bobbuy.security.header-auth.enabled=false","bobbuy.seed.force-reset-on-invoke=false"
})
@AutoConfigureMockMvc
class MerchantProductArchiveIntegrationTest {
 private static final String PATH="/api/merchant/product-archive";
 @Autowired MockMvc mvc;
 @Autowired ObjectMapper json;
 @Autowired ProductRepository products;
 @Autowired UserRepository users;
 @Autowired JwtTokenService tokens;
 @Autowired JdbcTemplate jdbc;
 @Autowired BobbuyStore store;

 @Test void paginatesAnOwnedArchiveBeforeSerializationWithStableOrderAndGlobalSearch() throws Exception {
  try(var connection=java.util.Objects.requireNonNull(jdbc.getDataSource()).getConnection()){
   if(!Boolean.TRUE.equals(jdbc.queryForObject("select to_regclass('bb_costco_onboarding_job') is not null",Boolean.class)))
    ScriptUtils.executeSqlScript(connection,new ClassPathResource("db/migration/V30__costco_onboarding_jobs.sql"));
   ScriptUtils.executeSqlScript(connection,new ClassPathResource("db/migration/V48__product_photo_observations.sql"));
  }
  store.seed();
  var owner=new User(8180L,"archive-test-merchant",Role.AGENT,0);
  owner.setUsername("archive-test-merchant");
  users.saveAndFlush(owner);
  var foreign=users.saveAndFlush(new User(8181L,"archive-test-other",Role.AGENT,0));
  var customer=users.findAll().stream().filter(user->user.getRoles().contains(Role.CUSTOMER)).findFirst().orElseThrow();
  String auth=tokens.createAccessToken(owner);
  String foreignAuth=tokens.createAccessToken(foreign);
  var fixture=new ArrayList<Product>();
  for(int i=0;i<520;i++)fixture.add(product(i,owner.getId()));
  fixture.add(product(800,foreign.getId()));
  var deleted=product(801,owner.getId());
  deleted.setDeletedAt(Instant.now());
  fixture.add(deleted);
  products.saveAllAndFlush(fixture);
  jdbc.update("""
     update bb_product set updated_at=case when id='archive-0519' then null
       when id in ('archive-0001','archive-0002') then timestamp '2026-11-01 10:00:00'
       else timestamp '2026-10-01 10:00:00' end
     where merchant_id=?
     """,owner.getId());

  var firstResponse=request(PATH,auth).andExpect(status().isOk()).andReturn().getResponse();
  var first=json.readTree(firstResponse.getContentAsByteArray()).path("data");
  assertThat(first.path("total").asInt()).isEqualTo(520);
  assertThat(first.path("rows").size()).isEqualTo(24);
  assertThat(ids(first)).startsWith("archive-0003","archive-0001","archive-0002","archive-0000");
  var row=first.path("rows").get(0);
  assertThat(row.path("image").asText()).isEqualTo("/favicon.svg?v=1");
  assertThat(row.path("mediaCount").asInt()).isEqualTo(3);
  assertThat(row.path("currentRegular").path("amount").asInt()).isEqualTo(1299);
  assertThat(row.has("product")||row.has("description")||row.has("mediaGallery")||row.has("attributes")).isFalse();
  var second=data(PATH+"?page=1",auth);
  assertThat(ids(second)).hasSize(24).doesNotContainAnyElementsOf(ids(first)).startsWith("archive-0024");
  assertThat(ids(data(PATH+"?page=21",auth))).endsWith("archive-0519");
  assertThat(ids(data(PATH+"?query=CODE-0519",auth))).containsExactly("archive-0519");
  assertThat(ids(data(PATH+"?query=後方検索",auth))).containsExactly("archive-0519");
  assertThat(ids(data(PATH+"?query=%25",auth))).isEmpty();
  assertThat(ids(data(PATH,foreignAuth))).containsExactly("archive-0800");
  assertThat(ids(data(PATH+"?query=CODE-0801",auth))).isEmpty();
  request(PATH,tokens.createAccessToken(customer)).andExpect(status().isForbidden());
  mvc.perform(get(PATH)).andExpect(status().isUnauthorized());
  request(PATH+"?page=-1",auth).andExpect(status().isBadRequest());
  assertThat(data(PATH+"/export-selection",auth).path("limitExceeded").asBoolean()).isTrue();
  assertThat(data(PATH+"/export-selection",foreignAuth).path("ids").get(0).asText()).isEqualTo("archive-0800");
  request("/api/mobile/products/archive-0519",auth).andExpect(status().isOk());
  request("/api/mobile/products/archive-0519",foreignAuth).andExpect(status().isNotFound());
  var legacy=request("/api/mobile/products",auth).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
  assertThat(json.readTree(legacy).path("data").size()).isEqualTo(520);
  assertThat(firstResponse.getContentAsByteArray().length).isLessThan(legacy.length/30);
  System.out.printf("Archive isolated body bytes: legacy=%d for 520, page=%d for 24%n",
    legacy.length,firstResponse.getContentAsByteArray().length);

  if("true".equals(System.getenv("BOBBUY_ARCHIVE_BROWSER"))) {
   var browser=new ProcessBuilder("node","../frontend/scripts/merchant-archive-browser.mjs").inheritIO();
   browser.environment().put("ARCHIVE_TEST_TOKEN",auth);
   assertThat(browser.start().waitFor()).isZero();
  }
 }

 private static Product product(int number,long owner) {
  var product=new Product();
  String suffix=String.format(java.util.Locale.ROOT,"%04d",number);
  product.setId("archive-"+suffix);
  product.setMerchantId(owner);
  product.setItemNumber("CODE-"+suffix);
  product.setName(Map.of("en-US","Fixture product "+suffix,"ja-JP",number==519?"後方検索":"検証商品 "+suffix));
  product.setDescription(Map.of("en-US","Synthetic description ".repeat(85),"ja-JP","検証用の説明".repeat(40)));
  product.setRecommended(number==3);
  product.setMediaGallery(List.of(
    new MediaGalleryItem("/favicon.svg?v=1",MediaType.IMAGE,Map.of("en-US","Fixture cover")),
    new MediaGalleryItem("/favicon.svg?v=2",MediaType.IMAGE,Map.of("en-US","Fixture detail")),
    new MediaGalleryItem("/favicon.svg?v=3",MediaType.IMAGE,Map.of("en-US","Fixture package"))
  ));
  product.setSale(new ProductSale(new BigDecimal("1299"),"JPY","pack",null,null,1L,owner,Instant.now(),true));
  return product;
 }

 private ResultActions request(String path,String token) throws Exception {
  return mvc.perform(get(java.net.URI.create(path.replace("後方検索","%E5%BE%8C%E6%96%B9%E6%A4%9C%E7%B4%A2")))
    .header("Authorization","Bearer "+token).header("Accept-Language","en-US"));
 }
 private JsonNode data(String path,String auth) throws Exception {
  return json.readTree(request(path,auth).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray()).path("data");
 }
 private static List<String> ids(JsonNode page) {
  var result=new ArrayList<String>();
  page.path("rows").forEach(row->result.add(row.path("id").asText()));
  return result;
 }
}
