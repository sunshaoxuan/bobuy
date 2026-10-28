package com.bobbuy.api;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.service.BobbuyStore;
import com.bobbuy.security.JwtTokenService;
import com.fasterxml.jackson.databind.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc
class ProductLifecycleIntegrationTest {
 @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired BobbuyStore store;
 @Autowired ProductRepository products;@Autowired RecommendationItemRepository items;@Autowired RecommendationPostRepository posts;
 @Autowired UserRepository users;@Autowired JwtTokenService tokens;@Autowired JdbcTemplate jdbc;
 @Autowired RecommendationImageRepository images;
 @Autowired com.bobbuy.service.MediaBinaryService binaries;
 @Autowired com.bobbuy.service.MediaReferenceCatalog mediaCatalog;
 @Autowired MediaReferenceRepository mediaReferences;
 @Autowired MediaTransferRepository mediaTransfers;
 String admin,merchant,customer,prefix;List<String> ids=new ArrayList<>();List<Long> postIds=new ArrayList<>();
 @BeforeEach void setup(){store.seed();admin=tokens.createAccessToken(users.findById(1000L).orElseThrow());
  var owner=new User(9490L,"lifecycle-merchant",Role.AGENT,0);owner.setUsername("lifecycle_merchant");users.save(owner);merchant=tokens.createAccessToken(owner);
  var buyer=new User(9491L,"lifecycle-customer",Role.CUSTOMER,0);buyer.setUsername("lifecycle_customer");users.save(buyer);customer=tokens.createAccessToken(buyer);
  prefix="lifecycle-"+UUID.randomUUID()+"-";
  for(int i=0;i<142;i++){var p=new Product();p.setId(prefix+i);p.setMerchantId(9490L);p.setItemNumber("000"+i);p.setName(new HashMap<>(Map.of("ja-JP","商品"+i)));p.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);
   if(i>=15)p.setMediaGallery(new ArrayList<>(List.of(new MediaGalleryItem("/fixture-product.png",com.bobbuy.model.MediaType.IMAGE,Map.of("ja-JP","商品")))));products.save(p);ids.add(p.getId());}products.flush();
  for(int issue=0;issue<2;issue++){var p=new RecommendationPost();p.merchantId=9490L;p.title="Synthetic period "+issue;p.published=true;p=posts.saveAndFlush(p);postIds.add(p.id);
   int count=issue==0?122:30;for(int i=0;i<count;i++){int index=issue==0?i:112+i;var r=new RecommendationItem();r.postId=p.id;r.productId=ids.get(index);r.name="商品"+index;r.itemNumber="000"+index;r.imageHash=prefix+issue+"-"+i;r.imageUrl="/fixture-source.png";r.gallery=index<15?List.of():List.of(new RecommendationItem.Picture("fixture","/fixture-product.png","fixture","https://www.costco.co.jp/fixture","fixture","Product",java.time.Instant.now()));items.save(r);}}
  items.flush();
 }
 @AfterEach void cleanup(){for(Long id:postIds){items.deleteAll(items.findByPostIdOrderById(id));posts.deleteById(id);}for(String id:ids){jdbc.update("delete from bb_product_lifecycle_event where product_id=?",id);jdbc.update("update bb_product set deleted_at=null,deleted_by=null where id=?",id);}products.deleteAllById(ids);mediaTransfers.deleteById(prefix+"source");mediaReferences.deleteById(prefix+"source");images.deleteById(prefix+"source");}
 JsonNode data(ResultActions action)throws Exception{return json.readTree(action.andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("data");}
 ResultActions call(String suffix,Object value,String token)throws Exception{return mvc.perform(post("/api/admin/products/trash"+suffix).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(value)));}
 Map<String,Object> selection(String id){return Map.of("id",id,"version",products.findById(id).orElseThrow().getRecordVersion());}
 JsonNode trash()throws Exception{return data(mvc.perform(get("/api/admin/products/trash").header("Authorization","Bearer "+admin)));}
 @Test void hidesFifteenAndRestoresExactLinksWithoutPhysicalDeletion()throws Exception{
  var selected=ids.subList(0,15).stream().map(this::selection).toList();call("/delete",selected,admin).andExpect(status().isOk());
  assertThat(products.deletedIds()).containsAll(ids.subList(0,15));
  assertThat(jdbc.queryForObject("select count(*) from bb_product where id like ?",Integer.class,prefix+"%")).isEqualTo(142);
  assertThat(items.findByPostIdOrderById(postIds.get(0))).hasSize(122);
  var a=data(mvc.perform(get("/api/storefront/recommendations/"+postIds.get(0))));var b=data(mvc.perform(get("/api/storefront/recommendations/"+postIds.get(1))));
  assertThat(a.get("items").size()).isEqualTo(107);assertThat(b.get("items").size()).isEqualTo(30);assertThat(a.get("post").get("title").asText()).isEqualTo("Synthetic period 0");
  assertThat(data(mvc.perform(get("/api/merchant/recommendations/"+postIds.get(0)).header("Authorization","Bearer "+merchant))).get("items").size()).isEqualTo(107);
  assertThat(data(mvc.perform(get("/api/mobile/products").header("Authorization","Bearer "+merchant))).toString()).doesNotContain(ids.get(0));
  assertThat(data(mvc.perform(get("/api/merchant/product-catalog").header("Authorization","Bearer "+merchant))).toString()).doesNotContain(ids.get(0));
  for(String token:List.of(admin,merchant)){mvc.perform(get("/api/mobile/products/"+ids.get(0)).header("Authorization","Bearer "+token)).andExpect(status().isNotFound());
   mvc.perform(get("/api/merchant/product-catalog/"+ids.get(0)).header("Authorization","Bearer "+token)).andExpect(status().isNotFound());}
  var rows=trash();assertThat(rows.size()).isEqualTo(15);
  for(var r:rows)call("/restore",Map.of("id",r.get("id").asText(),"version",r.get("version").asLong()),admin).andExpect(status().isOk());
  assertThat(trash().size()).isZero();assertThat(data(mvc.perform(get("/api/storefront/recommendations/"+postIds.get(0)))).get("items").size()).isEqualTo(122);
  assertThat(products.findById(ids.get(0)).orElseThrow().getSale()).isNull();
 }
 @Test void masterOnlyImageReferenceIsHiddenOnDeleteAndReturnsOnRestore()throws Exception{
  var image=new RecommendationImage();image.id=prefix+"source";image.merchantId=9490L;image.imageHash=prefix+"master-only";image.contentType="image/png";image.accessScope="PUBLIC";image.content=new byte[]{8,7,6};binaries.persist(image);
  String url="/api/storefront/recommendation-images/"+image.id,id=ids.get(20);var product=products.findById(id).orElseThrow();product.setMediaGallery(new ArrayList<>(List.of(new MediaGalleryItem(url,com.bobbuy.model.MediaType.IMAGE,Map.of("ja-JP","Synthetic master image")))));products.saveAndFlush(product);
  mvc.perform(get(url)).andExpect(status().isOk());mvc.perform(delete("/api/mobile/products/"+id).header("Authorization","Bearer "+merchant)).andExpect(status().isOk());
  mvc.perform(get(url)).andExpect(status().isNotFound());assertThat(images.existsById(image.id)).isTrue();
  var row=trash();JsonNode deleted=null;for(var entry:row)if(id.equals(entry.get("id").asText()))deleted=entry;assertThat(deleted).isNotNull();
  call("/restore",Map.of("id",id,"version",deleted.get("version").asLong()),admin).andExpect(status().isOk());mvc.perform(get(url)).andExpect(status().isOk());
 }
 @Test void rejectsEveryNonAdministratorAndAtomicConflicts()throws Exception{
  for(String token:List.of(merchant,customer)){mvc.perform(get("/api/admin/products/trash").header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
   mvc.perform(get("/api/admin/products/trash?deleted=false").header("Authorization","Bearer "+token)).andExpect(status().isForbidden());call("/delete",List.of(selection(ids.get(0))),token).andExpect(status().isForbidden());call("/restore",selection(ids.get(0)),token).andExpect(status().isForbidden());}
  assertThat(mvc.perform(get("/api/admin/products/trash")).andReturn().getResponse().getStatus()).isIn(401,403);
  var first=selection(ids.get(0));call("/delete",List.of(first,Map.of("id",ids.get(1),"version",99999)),admin).andExpect(status().isBadRequest());assertThat(products.existsById(ids.get(0))).isTrue();
  call("/delete",List.of(selection(ids.get(20))),admin).andExpect(status().isBadRequest());
  call("/delete",List.of(first,first),admin).andExpect(status().isBadRequest());
  call("/delete",List.of(first),admin).andExpect(status().isOk());call("/restore",first,admin).andExpect(status().isBadRequest());assertThat(products.existsById(ids.get(0))).isFalse();
 }
 @Test void existingMerchantDeleteBecomesRecoverableAndCannotForgeRestore()throws Exception{
  var image=new RecommendationImage();image.id=prefix+"source";image.merchantId=9490L;image.imageHash=prefix+"image";image.contentType="image/png";image.accessScope="PUBLIC";image.content=new byte[]{1,2,3};binaries.persist(image);
  String url="/api/storefront/recommendation-images/"+image.id;var source=items.findByPostIdOrderById(postIds.get(0)).get(0);source.imageUrl=url;items.saveAndFlush(source);mvc.perform(get(url)).andExpect(status().isOk());
  String id=ids.get(0);mvc.perform(delete("/api/mobile/products/"+id).header("Authorization","Bearer "+merchant)).andExpect(status().isOk());
  mvc.perform(get(url)).andExpect(status().isNotFound());assertThat(images.existsById(image.id)).isTrue();
  assertThat(mediaReferences.findById(image.id)).isPresent();assertThat(mediaCatalog.markGcCandidates()).doesNotContain(com.bobbuy.service.MediaBinaryService.sha(image.content));
  assertThat(jdbc.queryForObject("select count(*) from bb_product where id=?",Integer.class,id)).isEqualTo(1);
  assertThat(products.findByItemNumber("0000")).isEmpty();
  mvc.perform(patch("/api/mobile/products/"+id).header("Authorization","Bearer "+merchant).contentType(MediaType.APPLICATION_JSON).content("{\"deletedAt\":null}")).andExpect(status().isNotFound());
  assertThat(jdbc.queryForObject("select count(*) from bb_product_lifecycle_event where product_id=?",Integer.class,id)).isEqualTo(1);
  var retained=trash().get(0);call("/restore",Map.of("id",id,"version",retained.get("version").asLong()),admin).andExpect(status().isOk());
  mvc.perform(get(url)).andExpect(status().isOk());assertThat(mediaReferences.findById(image.id)).isPresent();
 }
 @Test void concurrentDeleteAndRestoreUseVersionAndKeepSingleAuditPerTransition()throws Exception{
  var row=selection(ids.get(0));var pool=java.util.concurrent.Executors.newFixedThreadPool(2);
  try{
   var start=new java.util.concurrent.CountDownLatch(1);var tasks=new ArrayList<java.util.concurrent.Future<Integer>>();
   for(int i=0;i<2;i++)tasks.add(pool.submit(()->{start.await();return call("/delete",List.of(row),admin).andReturn().getResponse().getStatus();}));start.countDown();
   var statuses=new ArrayList<Integer>();for(var task:tasks)statuses.add(task.get(20,java.util.concurrent.TimeUnit.SECONDS));assertThat(statuses.stream().filter(s->s==200).count()).isEqualTo(1);assertThat(statuses).allMatch(s->s==200||s==400||s==404);
   var deleted=trash().get(0);var restoreRow=Map.of("id",deleted.get("id").asText(),"version",deleted.get("version").asLong());
   tasks.clear();for(int i=0;i<2;i++)tasks.add(pool.submit(()->call("/restore",restoreRow,admin).andReturn().getResponse().getStatus()));statuses.clear();for(var task:tasks)statuses.add(task.get(20,java.util.concurrent.TimeUnit.SECONDS));assertThat(statuses).containsExactlyInAnyOrder(200,400);
   assertThat(jdbc.queryForObject("select count(*) from bb_product_lifecycle_event where product_id=?",Integer.class,ids.get(0))).isEqualTo(2);
  }finally{pool.shutdownNow();}
 }
}
