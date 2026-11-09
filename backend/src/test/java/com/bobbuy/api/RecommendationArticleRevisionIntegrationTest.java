package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.JwtTokenService;
import com.bobbuy.service.*;
import com.fasterxml.jackson.databind.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Only the existing isolated test datasource; never run against an application DB. */
@SpringBootTest
@AutoConfigureMockMvc(print=org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint.NONE)
class RecommendationArticleRevisionIntegrationTest {
 @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired RecommendationPostRepository posts;
 @Autowired RecommendationItemRepository items;@Autowired RecommendationArticleRevisionRepository revisions;
 @Autowired UserRepository users;@Autowired JwtTokenService tokens;@Autowired JdbcTemplate jdbc;
 @SpyBean RecommendationArticleService articles;
 static final AtomicLong IDS=new AtomicLong(9100000);
 RecommendationPost post;String owner,other,customer;
 @BeforeEach void setup(){
  var merchant=user(Role.AGENT);var foreign=user(Role.AGENT);var buyer=user(Role.CUSTOMER);owner=tokens.createAccessToken(merchant);other=tokens.createAccessToken(foreign);customer=tokens.createAccessToken(buyer);
  post=new RecommendationPost();post.merchantId=merchant.getId();post.title="Synthetic original source";post.body="Synthetic full original body retained";post.articleSourceLocale="ja-JP";post.published=true;post.publishedAt=Instant.parse("2026-11-09T00:01:00Z");post.publisherId=merchant.getId();post.publisherName=merchant.getName();String hash=articles.sourceHash(post);
  for(String locale:List.of("zh-CN","zh-TW","en-US"))post.articleTranslations.put(locale,new RecommendationPost.ArticleText(locale+" old title",locale+" old full body",hash,Instant.parse("2026-11-09T00:00:00Z")));
  posts.saveAndFlush(post);post=posts.findById(post.id).orElseThrow();
 }
 User user(Role role){long id=IDS.incrementAndGet();assertThat(users.existsById(id)).isFalse();var u=new User(id,"Synthetic article "+id,role,0);u.setUsername("synthetic_article_"+UUID.randomUUID());return users.saveAndFlush(u);}
 String endpoint(){return "/api/merchant/recommendations/"+post.id+"/article-revision";}
 Map<String,Object> payload(){var texts=new TreeMap<String,Object>();for(String locale:List.of("ja-JP","zh-CN","zh-TW","en-US"))texts.put(locale,Map.of("title",locale+" revised title","body",locale+" revised body"));return new HashMap<>(Map.of("requestId",UUID.randomUUID().toString(),"version",post.version,"sourceHash",articles.sourceHash(post),"reviewed",true,"articles",texts));}
 ResultActions putRevision(Map<String,Object> input,String token)throws Exception{return mvc.perform(put(endpoint()).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)));}
 JsonNode data(ResultActions result)throws Exception{return json.readTree(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");}
 List<Map<String,String>> itemRows(){return jdbc.query("SELECT * FROM bb_recommendation_item WHERE post_id=? ORDER BY id",(rs,n)->{var row=new TreeMap<String,String>();for(int i=1;i<=rs.getMetaData().getColumnCount();i++)row.put(rs.getMetaData().getColumnLabel(i),rs.getString(i));return row;},post.id);}
 @Test void published111ItemsPricesDatesSourceHashesAndGallerySurviveFourLanguageRevisionAndReplay()throws Exception{
  var linked=new ArrayList<RecommendationItem>();for(int i=0;i<111;i++){var item=new RecommendationItem();item.postId=post.id;item.name="Synthetic unchanged item "+i;item.itemNumber="SYN-ARTICLE-"+i;item.imageHash="a".repeat(64);item.imageUrl="/api/storefront/recommendation-images/synthetic-"+i;item.referencePrice=new BigDecimal("100.00");item.originalPrice=new BigDecimal("120.00");item.discountAmount=new BigDecimal("20.00");item.offerStart=java.time.LocalDate.of(2026,11,9);item.offerEnd=java.time.LocalDate.of(2026,11,15);item.gallery=List.of(new RecommendationItem.Picture("synthetic-"+i,item.imageUrl,item.imageHash,"https://www.costco.co.jp/synthetic","synthetic","Original",Instant.parse("2026-11-09T00:00:00Z")));linked.add(item);}items.saveAllAndFlush(linked);
  var before=itemRows();Instant publishedAt=post.publishedAt;var createdAt=post.createdAt;String previous=articles.sourceHash(post);var input=payload();var saved=data(putRevision(input,owner));
  assertThat(saved.path("replayed").asBoolean()).isFalse();assertThat(saved.path("current").asBoolean()).isTrue();assertThat(saved.path("articleSourceHash").asText()).isNotEqualTo(previous);assertThat(saved.at("/detail/articleTranslations").size()).isEqualTo(4);assertThat(itemRows()).isEqualTo(before);
  var after=posts.findById(post.id).orElseThrow();assertThat(after.published).isTrue();assertThat(after.publishedAt).isEqualTo(publishedAt);assertThat(after.createdAt).isEqualTo(createdAt);assertThat(after.publisherId).isEqualTo(post.publisherId);assertThat(after.publisherName).isEqualTo(post.publisherName);assertThat(after.version).isEqualTo(post.version+1);
  var publicView=data(mvc.perform(get("/api/storefront/recommendations/"+post.id)));assertThat(publicView.path("items").size()).isEqualTo(111);assertThat(publicView.path("articleTranslations").size()).isEqualTo(4);for(String locale:List.of("ja-JP","zh-CN","zh-TW","en-US"))assertThat(publicView.path("articleTranslations").path(locale).path("sourceHash").asText()).isEqualTo(saved.path("articleSourceHash").asText());
  int count=articles.history(after).size();var retry=data(putRevision(input,owner));assertThat(retry.path("replayed").asBoolean()).isTrue();assertThat(retry.path("appliedVersion")).isEqualTo(saved.path("appliedVersion"));assertThat(articles.history(after)).hasSize(count);assertThat(posts.findById(post.id).orElseThrow().version).isEqualTo(after.version);
  var history=articles.history(after);assertThat(json.writeValueAsString(history)).contains("Synthetic full original body retained","en-US old full body","en-US revised body","revisionRequest","previousSourceHash","actorId");
 }
 @Test void rejectsForeignCustomerAnonymousUnreviewedPartialUnknownAndStaleWithoutWrites()throws Exception{
  var input=payload();putRevision(input,other).andExpect(status().isNotFound());putRevision(input,customer).andExpect(status().isForbidden());mvc.perform(put(endpoint()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input))).andExpect(status().isForbidden());
  var unreviewed=new HashMap<>(input);unreviewed.put("reviewed",false);putRevision(unreviewed,owner).andExpect(status().isBadRequest());
  var partial=new HashMap<>(input);partial.put("articles",Map.of("ja-JP",Map.of("title","only source","body","partial")));putRevision(partial,owner).andExpect(status().isBadRequest());
  var unknown=new HashMap<>(input);unknown.put("merchantId",post.merchantId);putRevision(unknown,owner).andExpect(status().isBadRequest());
  var stale=new HashMap<>(input);stale.put("version",post.version+1);putRevision(stale,owner).andExpect(status().isConflict());stale.put("version",post.version);stale.put("sourceHash","f".repeat(64));putRevision(stale,owner).andExpect(status().isConflict());
  assertThat(posts.findById(post.id).orElseThrow().body).isEqualTo(post.body);assertThat(articles.history(post)).isEmpty();
 }
 @Test void sameUuidDifferentPayloadConflictsAndOlderReplayReturnsCurrentDetailWithoutReverting()throws Exception{
  var first=payload();var saved=data(putRevision(first,owner));var different=new HashMap<>(first);different.put("sourceHash","f".repeat(64));putRevision(different,owner).andExpect(status().isConflict());
  post=posts.findById(post.id).orElseThrow();var second=payload();var changedTexts=new TreeMap<String,Object>();for(String locale:List.of("ja-JP","zh-CN","zh-TW","en-US"))changedTexts.put(locale,Map.of("title",locale+" second title","body",locale+" second body"));second.put("articles",changedTexts);var next=data(putRevision(second,owner));
  var retry=data(putRevision(first,owner));assertThat(retry.path("replayed").asBoolean()).isTrue();assertThat(retry.path("current").asBoolean()).isFalse();assertThat(retry.path("articleSourceHash")).isEqualTo(saved.path("articleSourceHash"));assertThat(retry.at("/detail/articleSourceHash")).isEqualTo(next.path("articleSourceHash"));assertThat(retry.at("/detail/body").asText()).isEqualTo("ja-JP second body");
 }
 @Test void exceptionAfterPostFlushRollsBackAllFourLanguagesVersionAndHistory()throws Exception{
  var before=json.writeValueAsString(posts.findById(post.id).orElseThrow());var input=payload();
  doThrow(new IllegalStateException("Synthetic receipt storage failure")).when(articles).recordRevision(any(),any(),anyString(),anyString(),anyLong(),anyLong());
  putRevision(input,owner).andExpect(status().isInternalServerError());assertThat(json.writeValueAsString(posts.findById(post.id).orElseThrow())).isEqualTo(before);assertThat(articles.history(post)).isEmpty();
 }
 @Test void concurrentSameUuidGetsOnePersistentRevisionAndTwoConsistentReceipts()throws Exception{
  var input=payload();var gate=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
  try{Callable<JsonNode> call=()->{gate.await(10,TimeUnit.SECONDS);return data(putRevision(input,owner));};var a=pool.submit(call);var b=pool.submit(call);gate.countDown();var responses=List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS));assertThat(responses.stream().filter(x->x.path("replayed").asBoolean()).count()).isEqualTo(1);assertThat(responses.get(0).path("appliedVersion")).isEqualTo(responses.get(1).path("appliedVersion"));assertThat(articles.history(post).stream().filter(r->r.facts.containsKey("revisionRequest")).count()).isEqualTo(1);assertThat(posts.findById(post.id).orElseThrow().version).isEqualTo(post.version+1);}
  finally{pool.shutdownNow();assertThat(pool.awaitTermination(5,TimeUnit.SECONDS)).isTrue();}
 }
 @Test void concurrentDifferentIntentsAtOneVersionAcceptExactlyOneAndPreservePublication()throws Exception{
  var first=payload();var second=new HashMap<>(first);second.put("requestId",UUID.randomUUID().toString());var gate=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
  try{var a=pool.submit(()->{gate.await(10,TimeUnit.SECONDS);return putRevision(first,owner).andReturn().getResponse().getStatus();});var b=pool.submit(()->{gate.await(10,TimeUnit.SECONDS);return putRevision(second,owner).andReturn().getResponse().getStatus();});gate.countDown();assertThat(List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);assertThat(articles.history(post).stream().filter(r->r.facts.containsKey("revisionRequest")).count()).isEqualTo(1);var saved=posts.findById(post.id).orElseThrow();assertThat(saved.version).isEqualTo(post.version+1);assertThat(saved.published).isTrue();assertThat(saved.publishedAt).isEqualTo(post.publishedAt);}
  finally{pool.shutdownNow();assertThat(pool.awaitTermination(5,TimeUnit.SECONDS)).isTrue();}
 }
}
