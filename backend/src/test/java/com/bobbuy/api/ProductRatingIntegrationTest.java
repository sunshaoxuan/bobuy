package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.JwtTokenService;
import com.fasterxml.jackson.databind.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Each method owns only synthetic transactional rows; no global seed/reset or business records. */
@SpringBootTest(properties={"bobbuy.security.header-auth.enabled=false","bobbuy.seed.enabled=false","bobbuy.seed.force-reset-on-invoke=false"}) @AutoConfigureMockMvc @Transactional
class ProductRatingIntegrationTest {
 @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired ProductRepository products;
 @Autowired UserRepository users;@Autowired ProductRatingRepository ratings;@Autowired JwtTokenService tokens;
 String id,owner,foreign;final long ownerId=98732101L,foreignId=98732102L;
 @BeforeEach void setup(){
  assertThat(users.findById(ownerId)).isEmpty();assertThat(users.findById(foreignId)).isEmpty();
  var user=new User(ownerId,"Synthetic rating owner",Role.AGENT,0);user.setUsername("rating-owner-synthetic");users.saveAndFlush(user);owner=tokens.createAccessToken(user);
  var other=new User(foreignId,"Synthetic rating foreign",Role.AGENT,0);other.setUsername("rating-foreign-synthetic");users.saveAndFlush(other);foreign=tokens.createAccessToken(other);
  var product=new Product();id="rating-synthetic-"+UUID.randomUUID();product.setId(id);product.setMerchantId(ownerId);product.setName(Map.of("ja-JP","評価テスト"));product.setBasePrice(123);product.setVisibilityStatus(ProductVisibility.PUBLIC);products.saveAndFlush(product);
 }
 JsonNode getRating() throws Exception{return json.readTree(mvc.perform(get("/api/merchant/product-ratings/"+id).header("Authorization","Bearer "+owner)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");}
 String input(String stars,boolean visible,long version){return "{\"stars\":"+stars+",\"publicVisible\":"+visible+",\"version\":"+version+",\"reviewed\":true}";}
 void save(String input) throws Exception{mvc.perform(put("/api/merchant/product-ratings/"+id).header("Authorization","Bearer "+owner).contentType(MediaType.APPLICATION_JSON).content(input)).andExpect(status().isOk());}
 @Test void nullDefaultExplicitSaveReopenHideAndPublicProjection() throws Exception{
  assertThat(getRating().path("stars").isNull()).isTrue();assertThat(getRating().path("publicVisible").asBoolean()).isFalse();assertThat(ratings.findById(id)).isEmpty();
  var before=products.findById(id).orElseThrow().getRecordVersion();save(input("4.5",true,0));
  assertThat(getRating().path("stars").asDouble()).isEqualTo(4.5);assertThat(getRating().path("version").asLong()).isEqualTo(1);
  var visible=json.readTree(mvc.perform(get("/api/storefront/product-browse/"+id)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).at("/data/item/rating");assertThat(visible.asDouble()).isEqualTo(4.5);
  save(input("4.5",false,1));assertThat(json.readTree(mvc.perform(get("/api/storefront/product-browse/"+id)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).at("/data/item/rating").isNull()).isTrue();
  save(input("null",false,2));assertThat(getRating().path("stars").isNull()).isTrue();assertThat(products.findById(id).orElseThrow().getRecordVersion()).isEqualTo(before);assertThat(products.findById(id).orElseThrow().getBasePrice()).isEqualTo(123);
 }
 @Test void ownershipVersionAndValidationFailWithoutPartialWrite() throws Exception{
  var url="/api/merchant/product-ratings/"+id;
  mvc.perform(put(url).contentType(MediaType.APPLICATION_JSON).content(input("5",true,0))).andExpect(status().isUnauthorized());
  mvc.perform(put(url).header("Authorization","Bearer "+foreign).contentType(MediaType.APPLICATION_JSON).content(input("5",true,0))).andExpect(status().isNotFound());
  for(var invalid:List.of(input("5.5",true,0),input("4.25",false,0),input("null",true,0)))mvc.perform(put(url).header("Authorization","Bearer "+owner).contentType(MediaType.APPLICATION_JSON).content(invalid)).andExpect(status().isBadRequest());
  assertThat(ratings.findById(id)).isEmpty();save(input("3",false,0));
  mvc.perform(put(url).header("Authorization","Bearer "+owner).contentType(MediaType.APPLICATION_JSON).content(input("5",true,0))).andExpect(status().isBadRequest());
  assertThat(getRating().path("stars").asDouble()).isEqualTo(3);assertThat(getRating().path("publicVisible").asBoolean()).isFalse();
 }
}
