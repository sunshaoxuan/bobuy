package com.bobbuy.api;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.service.*;
import com.bobbuy.security.JwtTokenService;
import com.fasterxml.jackson.databind.*;
import java.util.*;
import java.time.*;
import java.io.*;
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
class RecommendationCommerceTest {
 @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired BobbuyStore store;
 @Autowired UserRepository users;@Autowired ProductRepository products;@Autowired JwtTokenService tokens;
 @Autowired RecommendationPostRepository posts;@Autowired RecommendationItemRepository items;@Autowired RecommendationImageRepository images;
 @Autowired OrderHeaderRepository orders;
 String admin,other;JsonNode detail;
 @BeforeEach void setup()throws Exception{
  items.deleteAll();posts.deleteAll();images.deleteAll();store.seed();admin=tokens.createAccessToken(users.findById(1000L).orElseThrow());
  var second=new User(9090L,"other",Role.AGENT,0);second.setUsername("commerce_other");users.save(second);other=tokens.createAccessToken(second);
  detail=data(mvc.perform(post("/api/merchant/recommendations").header("Authorization","Bearer "+admin)));
  detail=data(mvc.perform(multipart(path()+"/images").file(file(12)).header("Authorization","Bearer "+admin).param("name","日本語商品").param("itemNumber","000123").param("referencePrice","500").param("priceUnit","100g").param("version",version()))).get("detail");
 }
 @AfterEach void cleanup(){items.deleteAll();posts.deleteAll();images.deleteAll();}
 JsonNode data(ResultActions r)throws Exception{return json.readTree(r.andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("data");}
 String path(){return "/api/merchant/recommendations/"+detail.at("/post/id").asLong();}
 String version(){return detail.at("/post/version").asText();}
 long item(){return detail.at("/items/0/id").asLong();}
 String product(){return detail.at("/items/0/productId").asText();}
 MockMultipartFile file(int color)throws Exception{var image=new BufferedImage(16,10,BufferedImage.TYPE_INT_RGB);image.setRGB(0,0,color);var out=new ByteArrayOutputStream();ImageIO.write(image,"png",out);return new MockMultipartFile("file","product.png","image/png",out.toByteArray());}
 ResultActions putBody(String path,Object body,String token)throws Exception{return mvc.perform(put(path).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));}
 Map<String,Object> sale(long revision){var row=new HashMap<String,Object>();row.put("itemId",item());row.put("amount",500);row.put("currency","JPY");row.put("unit","100g");row.put("revision",revision);row.put("enabled",true);row.put("replaceExisting",false);return row;}
 Map<String,Object> sales(Map<String,Object> row){return Map.of("version",Long.valueOf(version()),"confirmedPreorder",true,"reviews",List.of(row));}
 @Test void reviewedJpyQuoteEnforcesPriceRevisionCurrencyUnitsAndCheckoutIdempotence()throws Exception{
  var before=products.findById(product()).orElseThrow();assertThat(before.getBasePrice()).isZero();assertThat(before.getSale()).isNull();
  assertThat(data(mvc.perform(get("/api/storefront/products"))).toString()).doesNotContain(product());
  assertThat(data(mvc.perform(get("/api/storefront/currencies")))).hasSize(4);
  var row=sale(0);row.put("currency","USD");putBody(path()+"/sales",sales(row),admin).andExpect(status().isBadRequest());
  row.put("currency","JPY");row.put("amount",500.5);putBody(path()+"/sales",sales(row),admin).andExpect(status().isBadRequest());
  row.put("amount",500);row.put("unit","");putBody(path()+"/sales",sales(row),admin).andExpect(status().isBadRequest());
  row.put("unit","100g");putBody(path()+"/sales",sales(row),other).andExpect(status().isNotFound());
  detail=data(putBody(path()+"/sales",sales(row),admin));
  var saved=products.findById(product()).orElseThrow();assertThat(saved.getBasePrice()).isZero();assertThat(saved.getVisibilityStatus()).isEqualTo(ProductVisibility.DRAFTER_ONLY);assertThat(saved.getSale().currency()).isEqualTo("JPY");
  assertThat(data(mvc.perform(get("/api/storefront/products"))).toString()).doesNotContain(product());
  // Synthetic test fixture only: explicit visibility preparation is separate
  // from sale confirmation. No application operation auto-publishes products.
  saved.setVisibilityStatus(ProductVisibility.PUBLIC);saved=products.saveAndFlush(saved);
  var feed=data(mvc.perform(get("/api/storefront/products")));assertThat(feed.toString()).contains(product(),"100g","JPY");
  var customer=new User(9091L,"buyer",Role.CUSTOMER,0);customer.setUsername("commerce_buyer");users.save(customer);String buyer=tokens.createAccessToken(customer);
  UUID request=UUID.randomUUID();var line=new HashMap<String,Object>(Map.of("productId",product(),"quantity",2,"priceRevision",1,"currency","JPY"));
  line.put("priceToken",data(mvc.perform(get("/api/storefront/products"))).findValuesAsText("priceToken").stream().findFirst().orElseThrow());
  var body=Map.of("requestId",request,"tripId",2000,"currency","JPY","items",List.of(line));
  var result=data(mvc.perform(post("/api/checkout").header("Authorization","Bearer "+buyer).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))));
  assertThat(result.get("total").asInt()).isEqualTo(1000);assertThat(result.get("currency").asText()).isEqualTo("JPY");
  var order=orders.findById(result.get("orderId").asLong()).orElseThrow();assertThat(order.getCurrency()).isEqualTo("JPY");assertThat(order.getLines().get(0).getSpec()).isEqualTo("100g");assertThat(order.getLines().get(0).getPriceRevision()).isEqualTo(1);
  assertThat(data(mvc.perform(post("/api/checkout").header("Authorization","Bearer "+buyer).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))).get("orderId")).isEqualTo(result.get("orderId"));
  line.put("priceRevision",0);var stale=Map.of("requestId",UUID.randomUUID(),"tripId",2000,"currency","JPY","items",List.of(line));
  mvc.perform(post("/api/checkout").header("Authorization","Bearer "+buyer).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(stale))).andExpect(status().isBadRequest());
  row=sale(1);row.put("validThrough",ProductSaleService.today().minusDays(1).toString());row.put("replaceExisting",true);putBody(path()+"/sales",sales(row),admin).andExpect(status().isBadRequest());
  row=sale(1);putBody(path()+"/sales",sales(row),admin).andExpect(status().isBadRequest());
  // A generic full-product update cannot alter or erase the reviewed quote.
  var payload=json.readTree(json.writeValueAsString(saved));((com.fasterxml.jackson.databind.node.ObjectNode)payload).putObject("sale").put("amount",1).put("currency","USD");
  store.updateProduct(product(),json.treeToValue(payload,Product.class)).orElseThrow();assertThat(products.findById(product()).orElseThrow().getSale()).isEqualTo(saved.getSale());
 }
 @Test void translationsAreReviewedSourceBoundAndGalleryIsOrderedDeduplicatedWithoutChangingSource()throws Exception{
  // Existing legacy profiles retain this source-editor compatibility path.
  var legacy=products.findById(product()).orElseThrow();legacy.setCatalogData(null);products.saveAndFlush(legacy);
  String original=detail.at("/items/0/imageUrl").asText(),hash=detail.at("/items/0/translationSource").asText();
  var row=Map.of("itemId",item(),"sourceHash",hash,"specification","16個","description","日本語説明","translations",Map.of("zh-CN",Map.of("name","中文商品","description","中文介绍"),"zh-TW",Map.of("name","繁體商品"),"en-US",Map.of("name","English item")));
  detail=data(putBody(path()+"/localizations",Map.of("version",Long.valueOf(version()),"rows",List.of(row),"reviewed",true),admin));
  assertThat(detail.at("/items/0/translationStatus").asText()).isEqualTo("REVIEWED");assertThat(products.findById(product()).orElseThrow().getName().get("zh-CN")).isEqualTo("中文商品（日本語商品）");
  putBody(path()+"/localizations",Map.of("version",Long.valueOf(version()),"rows",List.of(row),"reviewed",true),admin).andExpect(status().isBadRequest());
  for(int color:List.of(22,33))detail=data(mvc.perform(multipart(path()+"/items/"+item()+"/gallery").file(file(color)).header("Authorization","Bearer "+admin).param("version",version()).param("sourceUrl","https://www.costco.co.jp/product/000123").param("assetKey","official-"+color).param("itemNumber","000123").param("verified","true")));
  var gallery=detail.at("/items/0/gallery");assertThat(gallery).hasSize(2);
  detail=data(mvc.perform(multipart(path()+"/items/"+item()+"/gallery").file(file(22)).header("Authorization","Bearer "+admin).param("version",version()).param("sourceUrl","https://www.costco.co.jp/product/000123").param("assetKey","another-size").param("itemNumber","000123").param("verified","true")));
  assertThat(detail.at("/items/0/gallery")).hasSize(2);
  detail=data(putBody(path()+"/items/"+item()+"/gallery",Map.of("version",Long.valueOf(version()),"orderedIds",List.of(gallery.get(1).get("id").asText(),gallery.get(0).get("id").asText())),admin));
  assertThat(detail.at("/items/0/imageUrl").asText()).isEqualTo(original);
  detail=data(putBody(path(),Map.of("title","Synthetic","body","Synthetic test only","version",Long.valueOf(version())),admin));
  detail=data(mvc.perform(post(path()+"/publish").header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content("{\"version\":"+version()+"}")));
  var publicDetail=data(mvc.perform(get("/api/storefront/recommendations/"+detail.at("/post/id").asLong())));
  assertThat(publicDetail.at("/items/0/imageUrl").asText()).isEqualTo(gallery.get(1).get("url").asText());assertThat(publicDetail.toString()).doesNotContain(original);
  // Published content can be linked without withdrawal; publication remains true.
  detail=data(putBody(path()+"/catalog",Map.of("version",Long.valueOf(version()),"itemIds",List.of(item())),admin));assertThat(detail.at("/post/published").asBoolean()).isTrue();
  var changed=items.findById(item()).orElseThrow();changed.name="変更された日本語商品";items.saveAndFlush(changed);
  assertThat(items.findById(item()).orElseThrow().getTranslationStatus()).isEqualTo("STALE");
 }
}
