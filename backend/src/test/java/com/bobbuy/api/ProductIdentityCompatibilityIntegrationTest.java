package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.service.*;
import com.bobbuy.security.JwtTokenService;
import com.bobbuy.compat.PreviousOrderLine;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.MediaType;
import java.util.*;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc
class ProductIdentityCompatibilityIntegrationTest {
 @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired BobbuyStore store;@Autowired JwtTokenService tokens;
 @Autowired ProductRepository products;@Autowired UserRepository users;@Autowired OrderHeaderRepository orders;
 @Autowired ProductCatalogRecoveryRepository recoveries;@Autowired RecommendationItemRepository items;@Autowired RecommendationPostRepository posts;@Autowired JdbcTemplate jdbc;
 String token,id;Long postId,itemId;
 @BeforeEach void setup(){recoveries.deleteAll();store.seed();token=tokens.createAccessToken(users.findById(1000L).orElseThrow());
  var p=new Product();id="identity-recovery-"+UUID.randomUUID();p.setId(id);p.setMerchantId(1000L);p.setItemNumber("ITEM-80x2");p.setBrand("Brand");p.setName(Map.of("ja-JP","Original full name"));p.setBasePrice(123);products.saveAndFlush(p);
  var post=new RecommendationPost();post.merchantId=1000L;post.title="Synthetic original";post.published=true;post=posts.saveAndFlush(post);postId=post.id;
  var item=new RecommendationItem();item.postId=postId;item.productId=id;item.name="Immutable source";item.itemNumber="ITEM-80x2";item.referencePrice=new BigDecimal("300");item.offerStart=java.time.LocalDate.of(2026,11,6);item.offerEnd=java.time.LocalDate.of(2026,11,8);item.imageHash=UUID.randomUUID().toString();item.imageUrl="/synthetic.png";itemId=items.saveAndFlush(item).id;
 }
 @AfterEach void cleanup(){recoveries.deleteAll();items.deleteById(itemId);posts.deleteById(postId);products.deleteById(id);orders.findById(990099L).ifPresent(orders::delete);}
 JsonNode profile()throws Exception{return json.readTree(mvc.perform(get("/api/merchant/product-catalog/"+id).header("Authorization","Bearer "+token)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");}
 JsonNode save()throws Exception{var row=(com.fasterxml.jackson.databind.node.ObjectNode)profile().get("value");row.putObject("name").put("ja-JP","Pure name");row.putObject("specification").put("ja-JP","80 pieces x 2");row.put("packaging","2 packs");return json.readTree(mvc.perform(put("/api/merchant/product-catalog").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("rows",List.of(row),"reviewed",true)))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data").get(0);}
 JsonNode restore(JsonNode current)throws Exception{return json.readTree(mvc.perform(post("/api/merchant/product-catalog/"+id+"/restore").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("checkpointId",current.path("recoveryId").asText(),"version",current.at("/value/version").asLong(),"reviewed",true)))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");}

 @Test void legacyFullRestoreAndRedoPreserveOriginalSourceQuotesMembershipAndPrice()throws Exception{
  var before=products.findById(id).orElseThrow();var originalName=new HashMap<>(before.getName());long version=before.getRecordVersion();
  var saved=save();assertThat(saved.path("canonical").asBoolean()).isTrue();assertThat(saved.path("recoveryId").asText()).isNotBlank();assertThat(saved.at("/value/version").asLong()).isGreaterThan(version);
  var restored=restore(saved);assertThat(restored.path("canonical").asBoolean()).isFalse();var p=products.findById(id).orElseThrow();assertThat(p.getCatalogData()).isNull();assertThat(p.getName()).isEqualTo(originalName);assertThat(p.getBasePrice()).isEqualTo(123);assertThat(p.getItemNumber()).isEqualTo("ITEM-80x2");
  var source=items.findById(itemId).orElseThrow();assertThat(source.productId).isEqualTo(id);assertThat(source.name).isEqualTo("Immutable source");assertThat(source.referencePrice).isEqualByComparingTo("300");assertThat(source.offerStart).isEqualTo(java.time.LocalDate.of(2026,11,6));assertThat(posts.findById(postId).orElseThrow().published).isTrue();
  assertThat(restore(restored).path("canonical").asBoolean()).isTrue();assertThat(recoveries.findAll()).hasSize(3);
  mvc.perform(post("/api/merchant/product-catalog/"+id+"/restore").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("checkpointId",saved.path("recoveryId").asText(),"version",saved.at("/value/version").asLong(),"reviewed",true)))).andExpect(status().isBadRequest());
 }
 @Test void changedMembershipCannotBeSilentlyOverwrittenByRestore()throws Exception{
  var saved=save();var another=new RecommendationItem();another.postId=postId;another.productId=id;another.name="Another source";another.imageHash=UUID.randomUUID().toString();another.imageUrl="/synthetic.png";another=items.saveAndFlush(another);
  try{mvc.perform(post("/api/merchant/product-catalog/"+id+"/restore").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("checkpointId",saved.path("recoveryId").asText(),"version",saved.at("/value/version").asLong(),"reviewed",true)))).andExpect(status().isBadRequest());assertThat(products.findById(id).orElseThrow().getCatalogData()).isNotNull();assertThat(recoveries.findAll()).hasSize(1);}finally{items.deleteById(another.id);}
 }
 @Test void actualStoredOrderJsonRemainsStrictOldReaderCompatibleAndSidecarSurvivesOldShapeUpdate()throws Exception{
  var p=products.findById(id).orElseThrow();p.setCatalogData(new ProductCatalogData(Map.of("ja-JP","80 pieces x 2"),"ExactModel","2 packs",List.of(),null,null,null,null));
  var line=new OrderLine(id,"Original full name","box",2,123);line.setId(990100L);line.setPricedAt(java.time.Instant.parse("2026-11-06T01:00:00Z"));line.setQuotedAmount(new BigDecimal("123.123456789"));OrderProductSnapshot.capture(line,p);
  var order=new OrderHeader("identity-compat-order",1001L,2000L);order.setId(990099L);order.addLine(line);orders.saveAndFlush(order);
  String raw=jdbc.queryForObject("select lines from bb_order_header where id=990099",String.class);List<PreviousOrderLine> old=json.readValue(raw,json.getTypeFactory().constructCollectionType(List.class,PreviousOrderLine.class));assertThat(old).hasSize(1);
  assertThat(raw).doesNotContain("specifications","saleUnit","packaging","brand","itemNumber");String retained=jdbc.queryForObject("select product_identities from bb_order_header where id=990099",String.class);
  String databaseUrl;try(var connection=jdbc.getDataSource().getConnection()){databaseUrl=connection.getMetaData().getURL();}
  assertThat(databaseUrl).startsWith("jdbc:h2:mem:");
  // Run the actual baseline entity mapping with the default strict Hibernate JSON mapper,
  // validating the expanded schema and updating through the old persistence code shape.
  try(var oldFactory=new org.hibernate.cfg.Configuration().addAnnotatedClass(com.bobbuy.compat.PreviousOrderHeader.class)
      .setPhysicalNamingStrategy(new org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy())
      .setProperty("hibernate.connection.url",databaseUrl).setProperty("hibernate.connection.driver_class","org.h2.Driver")
      .setProperty("hibernate.connection.username","sa").setProperty("hibernate.connection.password","")
      .setProperty("hibernate.physical_naming_strategy","org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy")
      .setProperty("hibernate.hbm2ddl.auto","validate").buildSessionFactory();var oldSession=oldFactory.openSession()){
   var transaction=oldSession.beginTransaction();var previous=oldSession.find(com.bobbuy.compat.PreviousOrderHeader.class,990099L);
   assertThat(previous.getLines()).hasSize(1);assertThat(previous.getLines().get(0).getSpec()).isEqualTo("box");
   previous.getLines().get(0).setQuantity(3);transaction.commit();
  }
  assertThat(jdbc.queryForObject("select product_identities from bb_order_header where id=990099",String.class)).isEqualTo(retained);
  var fresh=orders.findById(990099L).orElseThrow().getLines().get(0);assertThat(fresh.getQuantity()).isEqualTo(3);assertThat(fresh.getBrand()).isEqualTo("Brand");assertThat(fresh.getSpecifications()).containsEntry("ja-JP","80 pieces x 2");assertThat(fresh.getSpec()).isEqualTo("box");assertThat(fresh.getQuotedAmount()).isEqualByComparingTo("123.123456789");assertThat(fresh.getPricedAt()).isEqualTo(java.time.Instant.parse("2026-11-06T01:00:00Z"));
 }
 @Test void restoreRequiresReviewedCurrentOwnerAndDoesNotAcceptAnotherMerchantsCheckpoint()throws Exception{
  var saved=save();String payload=json.writeValueAsString(Map.of("checkpointId",saved.path("recoveryId").asText(),"version",saved.at("/value/version").asLong(),"reviewed",false));
  mvc.perform(post("/api/merchant/product-catalog/"+id+"/restore").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(payload)).andExpect(status().isBadRequest());
  var foreign=new User(9200L,"foreign",Role.AGENT,0);foreign.setUsername("identity-foreign");users.saveAndFlush(foreign);String foreignToken=tokens.createAccessToken(foreign);
  payload=json.writeValueAsString(Map.of("checkpointId",saved.path("recoveryId").asText(),"version",saved.at("/value/version").asLong(),"reviewed",true));
  mvc.perform(post("/api/merchant/product-catalog/"+id+"/restore").header("Authorization","Bearer "+foreignToken).contentType(MediaType.APPLICATION_JSON).content(payload)).andExpect(status().isNotFound());
  assertThat(recoveries.findAll()).hasSize(1);assertThat(products.findById(id).orElseThrow().getCatalogData()).isNotNull();
 }
}
