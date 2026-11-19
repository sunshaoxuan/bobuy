package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.JwtTokenService;
import com.bobbuy.service.BobbuyStore;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="bobbuy.security.header-auth.enabled=false") @AutoConfigureMockMvc
class ManualProductCreationTest {
 @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired BobbuyStore store;
 @Autowired ProductRepository products; @Autowired UserRepository users; @Autowired JwtTokenService tokens;
 @Autowired CategoryTreeNodeRepository nodes; @Autowired ProductPrimaryCategoryPathRepository paths;
 @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
 String auth,other,customer;
 @BeforeEach void setup(){
  store.seed();auth=tokens.createAccessToken(users.findById(1000L).orElseThrow());
  var foreign=new User(9098L,"manual-other",Role.AGENT,0);foreign.setUsername("manual_other");users.saveAndFlush(foreign);other=tokens.createAccessToken(foreign);
  customer=tokens.createAccessToken(users.findAll().stream().filter(u->u.getRoles().contains(Role.CUSTOMER)).findFirst().orElseThrow());
  nodes.saveAndFlush(new CategoryTreeNode("system-uncategorized",null,Map.of("ja-JP","未分類"),List.of("system-uncategorized"),Integer.MAX_VALUE,"UNCATEGORIZED"));
  nodes.saveAndFlush(new CategoryTreeNode("manual-root",null,Map.of("ja-JP","合成親分類"),List.of("manual-root"),0,null));
  nodes.saveAndFlush(new CategoryTreeNode("manual-leaf","manual-root",Map.of("ja-JP","合成子分類"),List.of("manual-root","manual-leaf"),0,null));
 }
 ObjectNode input(){var x=json.createObjectNode();x.put("requestId",UUID.randomUUID().toString());x.put("itemNumber","SYNTHETIC-"+UUID.randomUUID());x.putObject("name").put("ja-JP","合成手入力").put("zh-CN","合成手动录入").put("en-US","Synthetic manual item");x.putObject("description").put("ja-JP","日本語説明").put("zh-CN","中文说明").put("en-US","English description");x.putObject("specification").put("ja-JP","2個").put("zh-CN","2件").put("en-US","2 pieces");x.put("categoryNodeId","manual-leaf");x.putObject("attributes").put("netContent","1L").put("packSize","2");return x;}
 JsonNode create(ObjectNode x,String token) throws Exception{return json.readTree(mvc.perform(post("/api/mobile/products").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(x.toString())).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).path("data");}
 @Test void persistsPrivateMultilingualProductAndCurrentPathThenReadsAndEdits() throws Exception{
  var x=input();x.put("visibilityStatus","PUBLIC");x.put("merchantId",9098);x.put("basePrice",9999);
  var result=create(x,auth);String id=result.at("/product/id").asText();assertThat(id).isNotBlank();
  var p=products.findById(id).orElseThrow();assertThat(p.getMerchantId()).isEqualTo(1000);assertThat(p.getVisibilityStatus()).isEqualTo(ProductVisibility.DRAFTER_ONLY);assertThat(p.getSale()).isNull();assertThat(p.getBasePrice()).isZero();assertThat(p.getCategoryId()).isNull();assertThat(p.getCatalogData().categoryIds()).isEmpty();assertThat(p.getName()).containsEntry("en-US","Synthetic manual item");assertThat(p.getCatalogData().specification()).containsEntry("ja-JP","2個");assertThat(p.getAttributes()).containsEntry("netContent","1L");assertThat(paths.findById(id).orElseThrow().getCategoryNodeId()).isEqualTo("manual-leaf");
  mvc.perform(get("/api/mobile/products/"+id).header("Authorization","Bearer "+auth)).andExpect(status().isOk()).andExpect(jsonPath("$.data.product.description.en-US").value("English description"));
  mvc.perform(get("/api/mobile/products/"+id).header("Authorization","Bearer "+other)).andExpect(status().isNotFound());
  mvc.perform(patch("/api/mobile/products/"+id).header("Authorization","Bearer "+auth).contentType(MediaType.APPLICATION_JSON).content("{\"storageCondition\":\"CHILLED\"}")).andExpect(status().isOk());assertThat(products.findById(id).orElseThrow().getStorageCondition()).isEqualTo(StorageCondition.CHILLED);
 }
 @Test void minimalUnclassifiedDraftAndMandatoryNamePermissions() throws Exception{
  var x=input();x.remove(List.of("categoryNodeId","itemNumber","description","specification","attributes"));
  mvc.perform(post("/api/mobile/products").contentType(MediaType.APPLICATION_JSON).content(x.toString())).andExpect(status().isUnauthorized());
  mvc.perform(post("/api/mobile/products").header("Authorization","Bearer "+customer).contentType(MediaType.APPLICATION_JSON).content(x.toString())).andExpect(status().isForbidden());
  var bad=x.deepCopy();bad.set("name",json.createObjectNode().put("en-US","Only English"));mvc.perform(post("/api/mobile/products").header("Authorization","Bearer "+auth).contentType(MediaType.APPLICATION_JSON).content(bad.toString())).andExpect(status().isBadRequest());
  String id=create(x,auth).at("/product/id").asText();assertThat(paths.findById(id).orElseThrow().getCategoryNodeId()).isEqualTo("system-uncategorized");
 }
 @Test void categoryFailureRollsBackAndSameRequestCanRetry() throws Exception{
  var x=input();for(String category:List.of("家电数码","manual-root","rec-cat-retired")){
   x.put("categoryNodeId",category);mvc.perform(post("/api/mobile/products").header("Authorization","Bearer "+auth).contentType(MediaType.APPLICATION_JSON).content(x.toString())).andExpect(status().isBadRequest());
   assertThat(products.findAllByMerchantIdAndItemNumber(1000L,x.get("itemNumber").asText())).isEmpty();
  }
  x.put("categoryNodeId","manual-leaf");assertThat(create(x,auth).at("/product/id").asText()).isNotBlank();
 }
 @Test void concurrentRetryIsIdempotentAndDifferentRequestNeverOverwritesItem() throws Exception{
  var x=input();var executor=Executors.newFixedThreadPool(2);
  try{var futures=executor.invokeAll(List.<Callable<String>>of(()->create(x,auth).at("/product/id").asText(),()->create(x,auth).at("/product/id").asText()));String id=futures.get(0).get();assertThat(futures.get(1).get()).isEqualTo(id);
   var changed=x.deepCopy();changed.putObject("name").put("ja-JP","上書き禁止");assertThat(create(changed,auth).at("/product/name/ja-JP").asText()).isEqualTo("合成手入力");
   changed.put("requestId",UUID.randomUUID().toString());mvc.perform(post("/api/mobile/products").header("Authorization","Bearer "+auth).contentType(MediaType.APPLICATION_JSON).content(changed.toString())).andExpect(status().isBadRequest());
   assertThat(products.findAllByMerchantIdAndItemNumber(1000L,x.get("itemNumber").asText())).hasSize(1);
   assertThat(create(x,other).at("/product/id").asText()).isNotEqualTo(id);
   jdbc.update("update bb_product set deleted_at=current_timestamp where id=?",id);
   mvc.perform(post("/api/mobile/products").header("Authorization","Bearer "+auth).contentType(MediaType.APPLICATION_JSON).content(x.toString())).andExpect(status().isBadRequest());
  }finally{executor.shutdownNow();}
 }
}
