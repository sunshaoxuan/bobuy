package com.bobbuy.api;
import static com.bobbuy.test.RecommendationPublicationFixtures.*;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.service.BobbuyStore;
import com.bobbuy.service.ProductCatalogService;
import com.bobbuy.security.JwtTokenService;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;
import java.math.BigDecimal;
import java.io.ByteArrayOutputStream;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc
class ProductCatalogIntegrationTest {
 @Test void auditReturnsActualValuesReferencesAndPricesWithoutCanonicalizing() throws Exception {
  var before=products.findById(id).orElseThrow();long version=before.getRecordVersion();
  var response=json.readTree(mvc.perform(get("/api/merchant/product-catalog/audit").header("Authorization","Bearer "+admin)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");
  com.fasterxml.jackson.databind.JsonNode row=null;for(var value:response)if(id.equals(value.at("/current/value/productId").asText()))row=value;
  assertThat(row).isNotNull();assertThat(row.at("/current/canonical").asBoolean()).isFalse();assertThat(row.get("originalCatalogData").isNull()).isTrue();
  assertThat(row.at("/current/value/version").asLong()).isEqualTo(version);assertThat(row.get("sources")).hasSize(2);
  assertThat(row.at("/sources/0/referencePrice").asInt()).isEqualTo(500);assertThat(row.at("/sources/1/referencePrice").asInt()).isEqualTo(600);
  assertThat(products.findById(id).orElseThrow().getCatalogData()).isNull();
  var otherData=json.readTree(mvc.perform(get("/api/merchant/product-catalog/audit").header("Authorization","Bearer "+other)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");
  for(var value:otherData)assertThat(value.at("/current/value/productId").asText()).isNotEqualTo(id);
 }
 @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired BobbuyStore store;
 @Autowired ProductRepository products; @Autowired UserRepository users; @Autowired JwtTokenService tokens;
 @Autowired RecommendationItemRepository items; @Autowired RecommendationPostRepository posts;
 @Autowired RecommendationImageRepository images;
 String admin,other,id; List<Long> sourceIds=new ArrayList<>(); List<Long> postIds=new ArrayList<>();
 List<String> uploadedImageIds=new ArrayList<>();
 @BeforeEach void setup(){
  store.seed();admin=tokens.createAccessToken(users.findById(1000L).orElseThrow());
  var user=new User(9099L,"catalog-other",Role.AGENT,0);user.setUsername("catalog_other");users.save(user);other=tokens.createAccessToken(user);
  var p=new Product();id="catalog-test-"+UUID.randomUUID();p.setId(id);p.setMerchantId(1000L);
  p.setName(new HashMap<>(Map.of("ja-JP","日本の商品","zh-CN","中文商品（日本の商品）")));
  p.setItemNumber("000123");p.setBasePrice(123);p.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);
  p.setMediaGallery(new ArrayList<>(List.of(new MediaGalleryItem("/synthetic-official.png",com.bobbuy.model.MediaType.IMAGE,Map.of("ja-JP","Product")))));products.saveAndFlush(p);
  for(int price:List.of(500,600)){
   var post=new RecommendationPost();post.merchantId=1000L;post.title="Synthetic source";legacyPost(post);post=posts.saveAndFlush(post);postIds.add(post.id);
   var item=new RecommendationItem();item.postId=post.id;item.productId=id;item.name="日本の商品";item.itemNumber="000123";
   item.specification="2個入";item.imageHash=UUID.randomUUID().toString();item.imageUrl="/synthetic-original.png";item.referencePrice=BigDecimal.valueOf(price);
   item.gallery=List.of(new RecommendationItem.Picture("fixture", "/synthetic-official.png","fixture","https://www.costco.co.jp/product/000123","fixture","Product",java.time.Instant.now()));
   item.translations=Map.of("zh-CN",new RecommendationItem.Text("中文商品","2个装",null,null),"zh-TW",new RecommendationItem.Text("中文商品繁體","2個裝",null,null));
   item.translatedSource=item.getTranslationSource();legacyItem(item,post);sourceIds.add(items.saveAndFlush(item).id);
  }
 }
 @AfterEach void cleanup(){items.deleteAllById(sourceIds);posts.deleteAllById(postIds);products.deleteById(id);images.deleteAllById(uploadedImageIds);}
 JsonNode data(ResultActions result)throws Exception{return json.readTree(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).get("data");}
 ResultActions request(String method,Object body,String token)throws Exception{return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request(org.springframework.http.HttpMethod.valueOf(method),"/api/merchant/product-catalog"+(method.equals("POST")?"/preview":"")).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));}
 ObjectNode proposal()throws Exception{var rows=data(mvc.perform(get("/api/merchant/product-catalog").header("Authorization","Bearer "+admin)));for(var row:rows)if(row.at("/value/productId").asText().equals(id))return (ObjectNode)row.get("value");throw new AssertionError("missing proposal");}
 JsonNode feed(int index)throws Exception{return data(mvc.perform(get("/api/storefront/recommendations/"+postIds.get(index)))).at("/items/0");}
 JsonNode verifiedPicture()throws Exception{
  var before=images.findAll().stream().map(image->image.id).toList();var tag=UUID.randomUUID().toString().replace("-","");
  var pixels=new BufferedImage(4,4,BufferedImage.TYPE_INT_RGB);for(int i=0;i<16;i++)pixels.setRGB(i%4,i/4,(tag.charAt(i)<<8)|tag.charAt(i+16));
  var bytes=new ByteArrayOutputStream();ImageIO.write(pixels,"png",bytes);
  var result=data(mvc.perform(multipart("/api/merchant/product-catalog/"+id+"/images").file(new MockMultipartFile("file","synthetic-master.png","image/png",bytes.toByteArray())).header("Authorization","Bearer "+admin).param("sourceUrl","https://www.costco.co.jp/product/000123").param("label","Synthetic reviewed master image").param("verified","true")));
  String prefix="/api/storefront/recommendation-images/",url=result.path("url").asText();assertThat(url).startsWith(prefix);String imageId=url.substring(prefix.length());assertThat(before).doesNotContain(imageId);uploadedImageIds.add(imageId);
  assertThat(result.path("sha256").asText()).matches("[0-9a-f]{64}");return result;
 }
 @Test void explicitReviewedSaveProjectsMasterWithoutChangingSourceOffersOrSale()throws Exception{
  assertThat(feed(0).get("name").asText()).isEqualTo("日本の商品");
  var row=proposal();assertThat(row.at("/name/zh-CN").asText()).isEqualTo("中文商品");assertThat(row.at("/name/zh-TW").asText()).isEqualTo("中文商品繁體");assertThat(row.at("/specification/ja-JP").asText()).isEqualTo("2個入");
  request("POST",Map.of("rows",List.of(row)),admin).andExpect(status().isOk());assertThat(products.findById(id).orElseThrow().getCatalogData()).isNull();
  request("PUT",Map.of("rows",List.of(row),"reviewed",false),admin).andExpect(status().isBadRequest());
  assertThat(products.findById(id).orElseThrow().getCatalogData()).isNull();
  ((ObjectNode)row.get("name")).put("ja-JP","主档商品");row.put("translationsReviewed",true);
  var reviewedPicture=verifiedPicture();row.putArray("gallery").add(reviewedPicture);
  data(request("PUT",Map.of("rows",List.of(row),"reviewed",true),admin));
  var saved=products.findById(id).orElseThrow();assertThat(saved.getBasePrice()).isEqualTo(123);assertThat(saved.getSale()).isNull();assertThat(saved.getVisibilityStatus()).isEqualTo(ProductVisibility.DRAFTER_ONLY);
  // Existing issues retain migrated source facts; editing today's master never rewrites history.
  assertThat(feed(0).get("name").asText()).isEqualTo("日本の商品");assertThat(feed(1).get("name").asText()).isEqualTo("日本の商品");
  assertThat(items.findById(sourceIds.get(0)).orElseThrow().publicationSnapshot.productVersion()).isNull();
  assertThat(feed(0).get("referencePrice").asInt()).isEqualTo(500);assertThat(feed(1).get("referencePrice").asInt()).isEqualTo(600);
  assertThat(items.findById(sourceIds.get(0)).orElseThrow().name).isEqualTo("日本の商品");
  request("PUT",Map.of("rows",List.of(row),"reviewed",true),admin).andExpect(status().isBadRequest());
  // A new explicitly reviewed occurrence binds the newer master through the real authenticated API.
  var next=data(mvc.perform(post("/api/merchant/recommendations").header("Authorization","Bearer "+admin)));long nextId=next.at("/post/id").asLong();postIds.add(nextId);
  next=data(mvc.perform(put("/api/merchant/recommendations/"+nextId).header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("title","Synthetic next master version","body","New reviewed occurrence","version",next.at("/post/version").asLong())))));
  var invalidName=Map.of("productId",id,"productVersion",saved.getRecordVersion(),"facts",Map.of("name","New occurrence source","itemNumber","000123","referencePrice",700,"priceUnit","per pack"),"version",next.at("/post/version").asLong(),"reviewed",true);
  mvc.perform(post("/api/merchant/recommendations/"+nextId+"/from-product").header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(invalidName))).andExpect(status().isBadRequest());
  assertThat(items.findByPostIdOrderById(nextId)).isEmpty();assertThat(posts.findById(nextId).orElseThrow().version).isEqualTo(next.at("/post/version").asLong());
  next=data(mvc.perform(post("/api/merchant/recommendations/"+nextId+"/from-product").header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("productId",id,"productVersion",saved.getRecordVersion(),"facts",Map.of("name",ProductCatalogService.text(saved.getName(),"ja-JP"),"itemNumber","000123","referencePrice",700,"priceUnit","per pack"),"version",next.at("/post/version").asLong(),"reviewed",true)))));
  long nextItem=next.at("/items/0/id").asLong();sourceIds.add(nextItem);next=data(publishPending(mvc,json,items,next,admin));
  var newest=data(mvc.perform(get("/api/storefront/recommendations/"+nextId))).at("/items/0");assertThat(newest.path("name").asText()).isEqualTo("主档商品");assertThat(newest.path("referencePrice").asInt()).isEqualTo(700);
  assertThat(newest.path("imageUrl").asText()).isEqualTo(reviewedPicture.path("url").asText());
  var published=items.findById(nextItem).orElseThrow();assertThat(published.publicationSnapshot.legacy()).isFalse();assertThat(published.publicationSnapshot.productVersion()).isEqualTo(products.findById(id).orElseThrow().getRecordVersion());assertThat(published.publicationSnapshot.reviewHash()).matches("[0-9a-f]{64}");
  assertThat(feed(0).get("name").asText()).isEqualTo("日本の商品");assertThat(feed(1).get("name").asText()).isEqualTo("日本の商品");
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
  assertThat(feed(0).get("translations")).hasSize(2);assertThat(feed(0).at("/translations/zh-TW/name").asText()).isEqualTo("中文商品繁體");assertThat(feed(0).get("name").asText()).isEqualTo("日本の商品"); // Historical translations remain unchanged when today's master becomes unreviewed.
 }
}
