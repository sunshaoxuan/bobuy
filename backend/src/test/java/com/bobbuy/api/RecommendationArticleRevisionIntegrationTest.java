package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.JwtTokenService;
import com.bobbuy.service.*;
import com.bobbuy.test.RecommendationPublicationFixtures;
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
 @Autowired org.springframework.transaction.PlatformTransactionManager transactionManager;
 @SpyBean RecommendationArticleService articles;
 static final AtomicLong IDS=new AtomicLong(9100000);
 final String fixtureTag=UUID.randomUUID().toString();
 record FixtureUser(Long id,String username,String name){}
 record FixtureItem(Long id,Long postId,String itemNumber,String imageUrl){}
 final List<FixtureUser> fixtureUsers=new ArrayList<>();
 final List<FixtureItem> fixtureItems=new ArrayList<>();
 final List<ExecutorService> fixtureWorkers=new ArrayList<>();
 Long fixturePostId,fixtureMerchantId;String fixturePublisherName;
 RecommendationPost post;String owner,other,customer;
 @BeforeEach void setup(){
  requireIsolatedFixtureDatasource();
  var merchant=user(Role.AGENT);var foreign=user(Role.AGENT);var buyer=user(Role.CUSTOMER);owner=tokens.createAccessToken(merchant);other=tokens.createAccessToken(foreign);customer=tokens.createAccessToken(buyer);
  post=new RecommendationPost();post.merchantId=merchant.getId();post.title="Synthetic original source";post.body="Synthetic full original body retained";post.articleSourceLocale="ja-JP";post.published=true;post.publishedAt=Instant.parse("2026-11-09T00:01:00Z");post.publisherId=merchant.getId();post.publisherName=merchant.getName();String hash=articles.sourceHash(post);
  for(String locale:List.of("zh-CN","zh-TW","en-US"))post.articleTranslations.put(locale,new RecommendationPost.ArticleText(locale+" old title",locale+" old full body",hash,Instant.parse("2026-11-09T00:00:00Z")));
  posts.saveAndFlush(post);fixturePostId=post.id;fixtureMerchantId=merchant.getId();fixturePublisherName=merchant.getName();post=posts.findById(post.id).orElseThrow();
 }
 void requireIsolatedFixtureDatasource(){jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<Void>)connection->{String url=connection.getMetaData().getURL();boolean memory=url.startsWith("jdbc:h2:mem:");boolean hosted="true".equals(System.getenv("GITHUB_ACTIONS"))&&"postgres-migration-verify".equals(System.getenv("GITHUB_JOB"))&&"true".equals(System.getenv("BOBBUY_ISOLATED_CI_POSTGRES"))&&url.equals("jdbc:postgresql://127.0.0.1:5432/bobbuy");assertThat(memory||hosted).as("Only in-memory or explicit hosted CI loopback fixture datasource").isTrue();return null;});}
 User user(Role role){long id=IDS.incrementAndGet();assertThat(users.existsById(id)).isFalse();var u=new User(id,"Synthetic article "+fixtureTag+" "+id,role,0);u.setUsername("synthetic_article_"+fixtureTag+"_"+id);var saved=users.saveAndFlush(u);fixtureUsers.add(new FixtureUser(saved.getId(),saved.getUsername(),saved.getName()));return saved;}
 ExecutorService fixturePool(){var pool=Executors.newFixedThreadPool(2);fixtureWorkers.add(pool);return pool;}
 static String sqlIdentifier(String value){assertThat(value).matches("[A-Za-z_][A-Za-z0-9_]*");return "\""+value+"\"";}
 void rejectForeignUserReferences(){
  jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<Void>)connection->{
   var metadata=connection.getMetaData();boolean upper=metadata.storesUpperCaseIdentifiers();String userTable=upper?"BB_USER":"bb_user",idColumn=upper?"ID":"id";var checked=new HashSet<String>();
   try(var keys=metadata.getExportedKeys(connection.getCatalog(),connection.getSchema(),userTable)){
    while(keys.next()){String schema=keys.getString("FKTABLE_SCHEM"),table=keys.getString("FKTABLE_NAME"),column=keys.getString("FKCOLUMN_NAME");if(!checked.add(schema+"."+table+"."+column))continue;
     String qualified=(schema==null?"":sqlIdentifier(schema)+".")+sqlIdentifier(table);boolean ownPost=table.equalsIgnoreCase("bb_recommendation_post")&&(column.equalsIgnoreCase("merchant_id")||column.equalsIgnoreCase("publisher_id"))&&fixturePostId!=null;
     for(var user:fixtureUsers){String query="SELECT count(*) FROM "+qualified+" WHERE "+sqlIdentifier(column)+"=?"+(ownPost?" AND "+sqlIdentifier(idColumn)+"<>?":"");Long references=ownPost?jdbc.queryForObject(query,Long.class,user.id(),fixturePostId):jdbc.queryForObject(query,Long.class,user.id());assertThat(references).as("Refuse foreign fixture dependency %s.%s",table,column).isZero();}
    }
   }return null;
  });
 }
 @AfterEach void cleanupOwnFixtures()throws Exception{
  for(var pool:fixtureWorkers)assertThat(pool.isTerminated()).as("Owned concurrent workers must finish before cleanup").isTrue();
  if(fixtureUsers.isEmpty()&&fixturePostId==null)return;
  requireIsolatedFixtureDatasource();
  int[] deleted={0,0,0};int[] retainedHistory={0};
  new org.springframework.transaction.support.TransactionTemplate(transactionManager).executeWithoutResult(status->{
   for(var expected:fixtureUsers)users.findById(expected.id()).ifPresent(found->{assertThat(found.getUsername()).isEqualTo(expected.username());assertThat(found.getName()).isEqualTo(expected.name());assertThat(found.getUsername()).startsWith("synthetic_article_"+fixtureTag+"_");});
   var owned=fixturePostId==null?Optional.<RecommendationPost>empty():posts.findById(fixturePostId);
   if(owned.isPresent()){
    var row=owned.get();assertThat(row.merchantId).isEqualTo(fixtureMerchantId);assertThat(row.publisherId).isEqualTo(fixtureMerchantId);assertThat(row.publisherName).isEqualTo(fixturePublisherName);assertThat(row.publisherName).contains(fixtureTag);
    var linked=items.findByPostIdOrderById(fixturePostId);assertThat(linked).hasSize(fixtureItems.size());
    for(var item:linked){var expected=fixtureItems.stream().filter(f->f.id().equals(item.id)).findFirst().orElseThrow(()->new IllegalStateException("Foreign item on owned fixture post"));assertThat(item.postId).isEqualTo(expected.postId());assertThat(item.itemNumber).isEqualTo(expected.itemNumber()).startsWith("SYN-ARTICLE-"+fixtureTag+"-");assertThat(item.imageUrl).isEqualTo(expected.imageUrl());}
   }else assertThat(fixtureItems).as("No item cleanup without an identified owning post").isEmpty();
   rejectForeignUserReferences();
   var history=fixturePostId==null?List.<RecommendationArticleRevision>of():revisions.findByMerchantIdAndPostIdOrderById(fixtureMerchantId,fixturePostId);var historyIdentity=history.stream().map(r->r.id+":"+r.factsHash).toList();retainedHistory[0]=history.size();
   if(owned.isPresent()){items.deleteAllByIdInBatch(fixtureItems.stream().map(FixtureItem::id).toList());deleted[0]=fixtureItems.size();posts.deleteById(fixturePostId);posts.flush();deleted[1]=1;}
   for(var expected:fixtureUsers)if(users.existsById(expected.id())){users.deleteById(expected.id());deleted[2]++;}users.flush();
   if(fixturePostId!=null){assertThat(posts.existsById(fixturePostId)).isFalse();assertThat(items.findByPostIdOrderById(fixturePostId)).isEmpty();assertThat(revisions.findByMerchantIdAndPostIdOrderById(fixtureMerchantId,fixturePostId).stream().map(r->r.id+":"+r.factsHash).toList()).isEqualTo(historyIdentity);}
   // Any unanticipated database FK refusal rolls back this entire inverse-order
   // cleanup. V24 history has no FK to post/user and is deliberately never deleted.
  });
  System.out.println("ARTICLE_FIXTURE_CLEANUP "+json.writeValueAsString(Map.of("tag",fixtureTag,"postId",fixturePostId==null?"NONE":fixturePostId,"itemsDeleted",deleted[0],"postsDeleted",deleted[1],"usersDeleted",deleted[2],"historyRowsRetained",retainedHistory[0],"workersTerminated",true)));
 }
 String endpoint(){return "/api/merchant/recommendations/"+post.id+"/article-revision";}
 Map<String,Object> payload(){var texts=new TreeMap<String,Object>();for(String locale:List.of("ja-JP","zh-CN","zh-TW","en-US"))texts.put(locale,Map.of("title",locale+" revised title","body",locale+" revised body"));return new HashMap<>(Map.of("requestId",UUID.randomUUID().toString(),"version",post.version,"sourceHash",articles.sourceHash(post),"reviewed",true,"articles",texts));}
 ResultActions putRevision(Map<String,Object> input,String token)throws Exception{return mvc.perform(put(endpoint()).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)));}
 JsonNode data(ResultActions result)throws Exception{return json.readTree(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");}
 List<Map<String,String>> itemRows(){return jdbc.query("SELECT * FROM bb_recommendation_item WHERE post_id=? ORDER BY id",(rs,n)->{var row=new TreeMap<String,String>();for(int i=1;i<=rs.getMetaData().getColumnCount();i++)row.put(rs.getMetaData().getColumnLabel(i),rs.getString(i));return row;},post.id);}
 @Test void published111ItemsPricesDatesSourceHashesAndGallerySurviveFourLanguageRevisionAndReplay()throws Exception{
  var linked=new ArrayList<RecommendationItem>();for(int i=0;i<111;i++){var item=new RecommendationItem();item.postId=post.id;item.name="Synthetic unchanged item "+fixtureTag+" "+i;item.itemNumber="SYN-ARTICLE-"+fixtureTag+"-"+i;item.imageHash="a".repeat(64);item.imageUrl="/api/storefront/recommendation-images/synthetic-"+fixtureTag+"-"+i;item.referencePrice=new BigDecimal("100.00");item.originalPrice=new BigDecimal("120.00");item.discountAmount=new BigDecimal("20.00");com.bobbuy.test.PriceDocumentFixtures.start(item,java.time.LocalDate.of(2026,11,9));com.bobbuy.test.PriceDocumentFixtures.end(item,java.time.LocalDate.of(2026,11,15));item.gallery=List.of(new RecommendationItem.Picture("synthetic-"+fixtureTag+"-"+i,item.imageUrl,item.imageHash,"https://www.costco.co.jp/synthetic","synthetic","Original",Instant.parse("2026-11-09T00:00:00Z")));linked.add(item);}items.saveAllAndFlush(linked);linked.forEach(item->fixtureItems.add(new FixtureItem(item.id,item.postId,item.itemNumber,item.imageUrl)));
  // Existing public associations are migrated history, never new unreviewed PENDING items.
  linked.forEach(item->RecommendationPublicationFixtures.legacyItem(item,post));items.saveAllAndFlush(linked);
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
  var input=payload();var gate=new CountDownLatch(1);var pool=fixturePool();
  try{Callable<JsonNode> call=()->{gate.await(10,TimeUnit.SECONDS);return data(putRevision(input,owner));};var a=pool.submit(call);var b=pool.submit(call);gate.countDown();var responses=List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS));assertThat(responses.stream().filter(x->x.path("replayed").asBoolean()).count()).isEqualTo(1);assertThat(responses.get(0).path("appliedVersion")).isEqualTo(responses.get(1).path("appliedVersion"));assertThat(articles.history(post).stream().filter(r->r.facts.containsKey("revisionRequest")).count()).isEqualTo(1);assertThat(posts.findById(post.id).orElseThrow().version).isEqualTo(post.version+1);}
  finally{pool.shutdownNow();assertThat(pool.awaitTermination(5,TimeUnit.SECONDS)).isTrue();}
 }
 @Test void concurrentDifferentIntentsAtOneVersionAcceptExactlyOneAndPreservePublication()throws Exception{
  var first=payload();var second=new HashMap<>(first);second.put("requestId",UUID.randomUUID().toString());var gate=new CountDownLatch(1);var pool=fixturePool();
  try{var a=pool.submit(()->{gate.await(10,TimeUnit.SECONDS);return putRevision(first,owner).andReturn().getResponse().getStatus();});var b=pool.submit(()->{gate.await(10,TimeUnit.SECONDS);return putRevision(second,owner).andReturn().getResponse().getStatus();});gate.countDown();assertThat(List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);assertThat(articles.history(post).stream().filter(r->r.facts.containsKey("revisionRequest")).count()).isEqualTo(1);var saved=posts.findById(post.id).orElseThrow();assertThat(saved.version).isEqualTo(post.version+1);assertThat(saved.published).isTrue();assertThat(saved.publishedAt).isEqualTo(post.publishedAt);}
  finally{pool.shutdownNow();assertThat(pool.awaitTermination(5,TimeUnit.SECONDS)).isTrue();}
 }
}
