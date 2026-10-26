package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.service.BobbuyStore;
import com.bobbuy.security.JwtTokenService;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.*;
import java.util.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc
class RecommendationClassificationTest {
 @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired BobbuyStore store;
 @Autowired UserRepository users;@Autowired JwtTokenService tokens;@Autowired RecommendationItemRepository items;
 @Autowired RecommendationPostRepository posts;@Autowired RecommendationImageRepository images;@Autowired SupplierRepository suppliers;
 String admin,other;
 @BeforeEach void setup(){cleanup();store.seed();admin=tokens.createAccessToken(users.findById(1000L).orElseThrow());var user=new User(9090L,"Other",Role.AGENT,0);user.setUsername("classification-other");users.save(user);other=tokens.createAccessToken(user);}
 @AfterEach void cleanup(){items.deleteAll();posts.deleteAll();images.deleteAll();}
 JsonNode data(ResultActions result)throws Exception{return json.readTree(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("data");}
 JsonNode label(String token,String name)throws Exception{return data(mvc.perform(post("/api/merchant/recommendation-taxonomy/categories").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("name",name,"locale","en-US")))));}
 JsonNode draft()throws Exception{return data(mvc.perform(post("/api/merchant/recommendations").header("Authorization","Bearer "+admin)));}
 String path(JsonNode value){return "/api/merchant/recommendations/"+value.at("/post/id").asLong();}
 JsonNode image(JsonNode value,String code)throws Exception{
  var image=new BufferedImage(2,2,BufferedImage.TYPE_INT_RGB);var bytes=new ByteArrayOutputStream();ImageIO.write(image,"png",bytes);
  return data(mvc.perform(multipart(path(value)+"/images").file(new MockMultipartFile("file","synthetic.png","image/png",bytes.toByteArray())).header("Authorization","Bearer "+admin).param("name","Synthetic "+code).param("itemNumber",code).param("referencePrice","400").param("version",value.at("/post/version").asText()))).path("detail");
 }
 ResultActions assign(JsonNode post,String token,List<Long> ids,List<String> cats,String mode,String supplier,boolean show)throws Exception{
  var input=new LinkedHashMap<String,Object>();input.put("itemIds",ids);input.put("categoryIds",cats);input.put("categoryMode",mode);input.put("updateCategories",true);input.put("supplierId",supplier);input.put("updateSupplier",true);input.put("showSupplier",show);input.put("version",post.at("/post/version").asLong());
  return mvc.perform(put(path(post)+"/classification").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)));
 }
 @Test void bulkCategoriesAndSupplierPrivacyPreserveSourceFacts()throws Exception{
  String a=label(admin,"Fixture A").path("id").asText(),b=label(admin,"Fixture B").path("id").asText();
  assertThat(label(admin,"  Fixture A  ").path("id").asText()).isEqualTo(a);
  data(mvc.perform(post("/api/mobile/suppliers").header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content("{\"id\":\"fixture-supplier\",\"name\":{\"en-US\":\"Fixture Warehouse\"}}")));
  var current=image(image(draft(),"00123"),"OTHER");var ids=List.of(current.at("/items/0/id").asLong(),current.at("/items/1/id").asLong());
  String originalHash=current.at("/items/0/imageHash").asText();
  var assigned=data(assign(current,admin,ids,List.of(a,b,a),"add","fixture-supplier",false));
  assertThat(assigned.at("/items/0/categoryIds").size()).isEqualTo(2);assertThat(assigned.at("/items/1/categoryIds").size()).isEqualTo(2);
  assertThat(assigned.at("/items/0/itemNumber").asText()).isEqualTo("00123");assertThat(assigned.at("/items/0/referencePrice").asInt()).isEqualTo(400);
  assertThat(assigned.at("/items/0/imageHash").asText()).isEqualTo(originalHash);assertThat(assigned.at("/post/published").asBoolean()).isFalse();
  var saved=data(mvc.perform(put(path(assigned)).header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("title","Synthetic classifications","body","Synthetic source facts","version",assigned.at("/post/version").asLong())))));
  var live=data(mvc.perform(post(path(saved)+"/publish").header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content("{\"version\":"+saved.at("/post/version").asLong()+"}")));
  var visible=data(mvc.perform(get("/api/storefront/recommendations/"+live.at("/post/id").asLong())));
  assertThat(visible.at("/items/0/supplierId").isNull()).isTrue();assertThat(visible.at("/items/0/supplierName").isNull()).isTrue();assertThat(visible.at("/items/0/categories").size()).isEqualTo(2);
  assign(live,admin,ids,List.of(a),"replace","fixture-supplier",true).andExpect(status().isBadRequest());
  var withdrawn=data(mvc.perform(post(path(live)+"/withdraw").header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content("{\"version\":"+live.at("/post/version").asLong()+"}")));
  var shown=data(assign(withdrawn,admin,ids,List.of(b),"remove","fixture-supplier",true));assertThat(shown.at("/items/0/categoryIds").size()).isEqualTo(1);
  data(mvc.perform(post(path(shown)+"/publish").header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content("{\"version\":"+shown.at("/post/version").asLong()+"}")));
  assertThat(data(mvc.perform(get("/api/storefront/recommendations/"+shown.at("/post/id").asLong()))).at("/items/0/supplierName/en-US").asText()).isEqualTo("Fixture Warehouse");
 }
 @Test void rejectsForeignRecordsCrossPostSelectionAndStaleVersionAtomically()throws Exception{
  String own=label(admin,"Owned label").path("id").asText(),foreign=label(other,"Other label").path("id").asText();
  var current=image(draft(),"A");var ids=List.of(current.at("/items/0/id").asLong());
  assign(current,admin,ids,List.of(foreign),"add",null,false).andExpect(status().isBadRequest());
  assign(current,other,ids,List.of(own),"add",null,false).andExpect(status().isNotFound());
  var another=image(draft(),"B");assign(current,admin,List.of(ids.get(0),another.at("/items/0/id").asLong()),List.of(own),"add",null,false).andExpect(status().isNotFound());
  assertThat(items.findById(ids.get(0)).orElseThrow().categoryIds).isEmpty();
  var assigned=data(assign(current,admin,ids,List.of(own),"replace",null,false));
  assign(current,admin,ids,List.of(),"replace",null,false).andExpect(status().isBadRequest());
  var cleared=data(assign(assigned,admin,ids,List.of(),"replace",null,false));assertThat(cleared.at("/items/0/categoryIds").size()).isZero();
  var options=data(mvc.perform(get("/api/merchant/recommendation-taxonomy").header("Authorization","Bearer "+admin)));assertThat(options.toString()).doesNotContain(foreign);
  assertThat(data(mvc.perform(get("/api/mobile/categories").header("Authorization","Bearer "+admin))).toString()).contains(own).doesNotContain(foreign);
  assertThat(data(mvc.perform(get("/api/mobile/categories").header("Authorization","Bearer "+other))).toString()).contains(foreign).doesNotContain(own);
  mvc.perform(get("/api/mobile/categories/"+foreign).header("Authorization","Bearer "+admin)).andExpect(status().isNotFound());
  mvc.perform(get("/api/mobile/categories/"+own).header("Authorization","Bearer "+admin)).andExpect(status().isOk());
 }
 @Test void supplierCreationCannotTakeOverAnotherOwnersExistingRecord()throws Exception{
  data(mvc.perform(post("/api/mobile/suppliers").header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content("{\"id\":\"owned-supplier\",\"name\":{\"en-US\":\"Owned\"}}")));
  mvc.perform(post("/api/mobile/suppliers").header("Authorization","Bearer "+other).contentType(MediaType.APPLICATION_JSON).content("{\"id\":\"owned-supplier\",\"name\":{\"en-US\":\"Changed\"}}")).andExpect(status().isBadRequest());
  assertThat(suppliers.findById("owned-supplier").orElseThrow().getMerchantId()).isEqualTo(1000L);
 }
}
