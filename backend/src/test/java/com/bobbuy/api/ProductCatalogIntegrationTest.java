package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.service.BobbuyStore;
import com.bobbuy.security.JwtTokenService;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;
import java.math.BigDecimal;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc
class ProductCatalogIntegrationTest {
 @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired BobbuyStore store;
 @Autowired ProductRepository products; @Autowired UserRepository users; @Autowired JwtTokenService tokens;
 @Autowired RecommendationItemRepository items; @Autowired RecommendationPostRepository posts;
 String admin,other,id; List<Long> sourceIds=new ArrayList<>(); List<Long> postIds=new ArrayList<>();
 @BeforeEach void setup(){
  store.seed();admin=tokens.createAccessToken(users.findById(1000L).orElseThrow());
  var user=new User(9099L,"catalog-other",Role.AGENT,0);user.setUsername("catalog_other");users.save(user);other=tokens.createAccessToken(user);
  var p=new Product();id="catalog-test-"+UUID.randomUUID();p.setId(id);p.setMerchantId(1000L);
  p.setName(new HashMap<>(Map.of("ja-JP","日本の商品","zh-CN","中文商品（日本の商品）")));
  p.setItemNumber("000123");p.setBasePrice(123);p.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);
  p.setMediaGallery(new ArrayList<>(List.of(new MediaGalleryItem("/synthetic-official.png",com.bobbuy.model.MediaType.IMAGE,Map.of("ja-JP","Product")))));products.saveAndFlush(p);
  for(int price:List.of(500,600)){
   var post=new RecommendationPost();post.merchantId=1000L;post.title="Synthetic source";post.published=true;post=posts.saveAndFlush(post);postIds.add(post.id);
   var item=new RecommendationItem();item.postId=post.id;item.productId=id;item.name="日本の商品";item.itemNumber="000123";
   item.specification="2個入";item.imageHash=UUID.randomUUID().toString();item.imageUrl="/synthetic-original.png";item.referencePrice=BigDecimal.valueOf(price);
   item.gallery=List.of(new RecommendationItem.Picture("fixture", "/synthetic-official.png","fixture","https://www.costco.co.jp/product/000123","fixture","Product",java.time.Instant.now()));
   item.translations=Map.of("zh-CN",new RecommendationItem.Text("中文商品","2个装",null,null),"zh-TW",new RecommendationItem.Text("中文商品繁體","2個裝",null,null));
   item.translatedSource=item.getTranslationSource();sourceIds.add(items.saveAndFlush(item).id);
  }
 }
 @AfterEach void cleanup(){items.deleteAllById(sourceIds);posts.deleteAllById(postIds);products.deleteById(id);}
 JsonNode data(ResultActions result)throws Exception{return json.readTree(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).get("data");}
 ResultActions request(String method,Object body,String token)throws Exception{return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request(org.springframework.http.HttpMethod.valueOf(method),"/api/merchant/product-catalog"+(method.equals("POST")?"/preview":"")).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));}
 ObjectNode proposal()throws Exception{var rows=data(mvc.perform(get("/api/merchant/product-catalog").header("Authorization","Bearer "+admin)));for(var row:rows)if(row.at("/value/productId").asText().equals(id))return (ObjectNode)row.get("value");throw new AssertionError("missing proposal");}
 JsonNode feed(int index)throws Exception{return data(mvc.perform(get("/api/storefront/recommendations/"+postIds.get(index)))).at("/items/0");}
 @Test void explicitReviewedSaveProjectsMasterWithoutChangingSourceOffersOrSale()throws Exception{
  assertThat(feed(0).get("name").asText()).isEqualTo("日本の商品");
  var row=proposal();assertThat(row.at("/name/zh-CN").asText()).isEqualTo("中文商品");assertThat(row.at("/name/zh-TW").asText()).isEqualTo("中文商品繁體");assertThat(row.at("/specification/ja-JP").asText()).isEqualTo("2個入");
  request("POST",Map.of("rows",List.of(row)),admin).andExpect(status().isOk());assertThat(products.findById(id).orElseThrow().getCatalogData()).isNull();
  request("PUT",Map.of("rows",List.of(row),"reviewed",false),admin).andExpect(status().isBadRequest());
  ((ObjectNode)row.get("name")).put("ja-JP","主档商品");row.put("translationsReviewed",true);
  data(request("PUT",Map.of("rows",List.of(row),"reviewed",true),admin));
  var saved=products.findById(id).orElseThrow();assertThat(saved.getBasePrice()).isEqualTo(123);assertThat(saved.getSale()).isNull();assertThat(saved.getVisibilityStatus()).isEqualTo(ProductVisibility.DRAFTER_ONLY);
  assertThat(feed(0).get("name").asText()).isEqualTo("主档商品");assertThat(feed(1).get("name").asText()).isEqualTo("主档商品");
  assertThat(feed(0).get("referencePrice").asInt()).isEqualTo(500);assertThat(feed(1).get("referencePrice").asInt()).isEqualTo(600);
  assertThat(items.findById(sourceIds.get(0)).orElseThrow().name).isEqualTo("日本の商品");
  request("PUT",Map.of("rows",List.of(row),"reviewed",true),admin).andExpect(status().isBadRequest());
 }
 @Test void rejectsCrossTenantDuplicateAndCompositeNamesWithoutPartialSave()throws Exception{
  var row=proposal();request("PUT",Map.of("rows",List.of(row),"reviewed",true),other).andExpect(status().isNotFound());
  request("PUT",Map.of("rows",List.of(row,row),"reviewed",true),admin).andExpect(status().isBadRequest());
  ((ObjectNode)row.get("name")).put("zh-CN","中文商品（日本の商品）");
  request("PUT",Map.of("rows",List.of(row),"reviewed",true),admin).andExpect(status().isBadRequest());
  assertThat(products.findById(id).orElseThrow().getCatalogData()).isNull();
 }
 @Test void rejectsUnownedGalleryAndKeepsLegacyContentVisible()throws Exception{
  var row=proposal();var image=json.createObjectNode().put("url","/api/storefront/recommendation-images/foreign").put("type","IMAGE").put("visible",true).put("sourceUrl","https://www.costco.co.jp/product/000123");
  row.putArray("gallery").add(image);request("POST",Map.of("rows",List.of(row)),admin).andExpect(status().isBadRequest());
  assertThat(feed(0).get("imageUrl").asText()).isEqualTo("/synthetic-official.png");assertThat(feed(0).at("/translations/zh-TW/name").asText()).isEqualTo("中文商品繁體");
 }
 @Test void validatesWholeBatchBeforeWritesAndInvalidatesUnreviewedTranslations()throws Exception{
  var original=proposal();
  var cases=new ArrayList<ObjectNode>();
  var missing=original.deepCopy();missing.putObject("name").put("en-US","Only translation");cases.add(missing);
  var locale=original.deepCopy();((ObjectNode)locale.get("name")).put("fr","Unknown locale");cases.add(locale);
  var longModel=original.deepCopy();longModel.put("model","x".repeat(301));cases.add(longModel);
  var duplicate=original.deepCopy();duplicate.putArray("categoryIds").add("one").add("one");cases.add(duplicate);
  var supplier=original.deepCopy();supplier.put("supplierId","not-owned");cases.add(supplier);
  var query=original.deepCopy();((ObjectNode)query.at("/gallery/0")).put("sourceUrl","https://www.costco.co.jp/p?private=tracking");cases.add(query);
  var stale=original.deepCopy();stale.put("version",original.get("version").asLong()+1);cases.add(stale);
  for(var bad:cases){request("PUT",Map.of("rows",List.of(bad),"reviewed",true),admin).andExpect(status().isBadRequest());assertThat(products.findById(id).orElseThrow().getCatalogData()).isNull();}
  original.put("translationsReviewed",false);data(request("PUT",Map.of("rows",List.of(original),"reviewed",true),admin));
  assertThat(feed(0).get("translations")).isEmpty();assertThat(feed(0).get("name").asText()).isEqualTo("日本の商品");
 }
}
