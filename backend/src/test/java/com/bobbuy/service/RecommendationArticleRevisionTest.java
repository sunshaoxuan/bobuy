package com.bobbuy.service;

import com.bobbuy.api.RecommendationController;
import com.bobbuy.model.*;
import com.bobbuy.repository.RecommendationArticleRevisionRepository;
import com.fasterxml.jackson.databind.*;
import java.lang.reflect.Proxy;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;

class RecommendationArticleRevisionTest {
 final ObjectMapper json=new ObjectMapper().findAndRegisterModules();
 final List<RecommendationArticleRevision> rows=new ArrayList<>();
 RecommendationArticleService articles;
 RecommendationPost post;
 @BeforeEach void setup(){
  RecommendationArticleRevisionRepository repository=(RecommendationArticleRevisionRepository)Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{RecommendationArticleRevisionRepository.class},(proxy,method,args)->{
   return switch(method.getName()){
    case "findByMerchantIdAndPostIdOrderById"->rows.stream().filter(r->Objects.equals(r.merchantId,args[0])&&Objects.equals(r.postId,args[1])).toList();
    case "findFirstByPostIdOrderByIdDesc"->rows.stream().filter(r->Objects.equals(r.postId,args[0])).reduce((first,last)->last);
    case "saveAndFlush"->{var row=(RecommendationArticleRevision)args[0];row.id=(long)rows.size()+1;rows.add(row);yield row;}
    case "toString"->"In-memory immutable revision repository test double";
    default->throw new UnsupportedOperationException(method.getName());
   };
  });
  articles=new RecommendationArticleService(repository,json);post=new RecommendationPost();post.id=8L;post.merchantId=1000L;post.articleSourceLocale="ja-JP";post.title="Old source";post.body="Old full original body";
 }
 Map<String,RecommendationArticleService.ReviewedText> texts(){
  var result=new HashMap<String,RecommendationArticleService.ReviewedText>();for(String locale:List.of("ja-JP","zh-CN","zh-TW","en-US"))result.put(locale,new RecommendationArticleService.ReviewedText(locale+" title",locale+" body"));return result;
 }
 @Test void legacyHashRemainsExactAndMixedSourceIsNeverInferred()throws Exception{
  assertEquals(MediaBinaryService.sha(json.writeValueAsBytes(Arrays.asList("ja-JP",post.title,post.body))),articles.sourceHash(post));
  post.articleSourceLocale=null;assertEquals(MediaBinaryService.sha(json.writeValueAsBytes(Arrays.asList(null,post.title,post.body))),articles.sourceHash(post));assertNull(post.articleSourceLocale);
 }
 @Test void allFourLanguagesBecomeCurrentTogetherAndTranslationOnlyRevisionChangesHash(){
  String old=articles.sourceHash(post);String hash=articles.applyReviewedRevision(post,articles.reviewedTexts(texts(),true));
  assertNotEquals(old,hash);assertEquals(hash,articles.sourceHash(post));assertEquals(Set.of("ja-JP","zh-CN","zh-TW","en-US"),articles.current(post).keySet());
  var changed=texts();changed.put("en-US",new RecommendationArticleService.ReviewedText("en-US title","Revised English only"));
  String next=articles.applyReviewedRevision(post,articles.reviewedTexts(changed,true));assertNotEquals(hash,next);assertEquals("ja-JP body",post.body);assertEquals(next,articles.sourceHash(post));
  String legacy=MediaBinaryService.sha(write(Arrays.asList("ja-JP",post.title,post.body)));assertEquals(4,post.articleTranslations.values().stream().filter(t->legacy.equals(t.sourceHash())).count());
  var persisted=new HashMap<>(post.articleTranslations);post.articleTranslations.replaceAll((locale,t)->new RecommendationPost.ArticleText(t.title(),t.body(),next,t.reviewedAt()));assertEquals(0,post.articleTranslations.values().stream().filter(t->legacy.equals(t.sourceHash())).count(),"Negative control: persisting canonical binding is unreadable by old V28 current algorithm");
  post.articleTranslations=persisted;assertEquals(4,articles.current(post).size());assertTrue(articles.current(post).values().stream().allMatch(t->next.equals(t.sourceHash())));assertTrue(post.articleTranslations.values().stream().allMatch(t->legacy.equals(t.sourceHash())),"Projection must not dirty JPA translations");
 }
 byte[] write(Object value){try{return json.writeValueAsBytes(value);}catch(Exception e){throw new IllegalStateException(e);}}
 @Test void canonicalRecognitionRequiresSourceMatchFourBoundLanguagesAndSameServerReview(){
  String hash=articles.applyReviewedRevision(post,articles.reviewedTexts(texts(),true));var complete=new HashMap<>(post.articleTranslations);
  post.title="different source";assertNotEquals(hash,articles.sourceHash(post));post.title="ja-JP title";
  post.articleTranslations.remove("ja-JP");assertNotEquals(hash,articles.sourceHash(post));post.articleTranslations=new HashMap<>(complete);
  var en=post.articleTranslations.get("en-US");post.articleTranslations.put("en-US",new RecommendationPost.ArticleText(en.title(),en.body(),hash,en.reviewedAt().plusSeconds(1)));assertNotEquals(hash,articles.sourceHash(post));
  post.articleTranslations=new HashMap<>(complete);post.articleTranslations.put("en-US",new RecommendationPost.ArticleText(en.title(),en.body(),"0".repeat(64),en.reviewedAt()));assertNotEquals(hash,articles.sourceHash(post));
 }
 @Test void missingUnreviewedOversizedOrBlankLanguageDoesNotChangeAnything(){
  String before=articles.sourceHash(post);var missing=texts();missing.remove("en-US");assertThrows(RuntimeException.class,()->articles.reviewedTexts(missing,true));
  assertThrows(RuntimeException.class,()->articles.reviewedTexts(texts(),false));var unknown=texts();unknown.remove("en-US");unknown.put("fr-FR",new RecommendationArticleService.ReviewedText("title","body"));assertThrows(RuntimeException.class,()->articles.reviewedTexts(unknown,true));
  var blank=texts();blank.put("en-US",new RecommendationArticleService.ReviewedText("   ","body"));assertThrows(RuntimeException.class,()->articles.reviewedTexts(blank,true));
  var huge=texts();huge.put("en-US",new RecommendationArticleService.ReviewedText("x".repeat(201),"body"));assertThrows(RuntimeException.class,()->articles.reviewedTexts(huge,true));assertEquals(before,articles.sourceHash(post));assertTrue(rows.isEmpty());
 }
 @Test void canonicalHashIgnoresReviewTimeAndMapOrderButPreservesNormalizedText(){
  var input=texts();input.put("en-US",new RecommendationArticleService.ReviewedText("  English title  ","  English body  "));
  String first=articles.applyReviewedRevision(post,articles.reviewedTexts(input,true));assertEquals("English body",post.articleTranslations.get("en-US").body());
  var reverse=new LinkedHashMap<String,RecommendationArticleService.ReviewedText>();input.keySet().stream().sorted(Comparator.reverseOrder()).forEach(k->reverse.put(k,input.get(k)));
  assertEquals(first,articles.applyReviewedRevision(post,articles.reviewedTexts(reverse,true)));
 }
 @Test void snapshotsKeepOldFullTextAndNewFourLanguagesWithDurableActorReceipt()throws Exception{
  String previous=articles.sourceHash(post);articles.snapshot(post);var requestId=UUID.randomUUID();var text=articles.reviewedTexts(texts(),true);String payload=articles.revisionPayloadHash(post,4,previous,text);
  articles.applyReviewedRevision(post,text);post.version=5;var receipt=articles.recordRevision(post,requestId,payload,previous,4,1000L);
  assertEquals(2,rows.size());assertEquals("Old full original body",rows.get(0).facts.get("body"));assertEquals("ja-JP body",rows.get(1).facts.get("body"));
  assertEquals(MediaBinaryService.sha(json.writeValueAsBytes(rows.get(1).facts)),rows.get(1).factsHash);var audit=(Map<?,?>)rows.get(1).facts.get("revisionRequest");assertEquals(1000L,audit.get("actorId"));assertEquals(true,audit.get("reviewed"));assertEquals(previous,audit.get("previousSourceHash"));assertEquals(5L,receipt.appliedVersion());
  // Existing unchanged model treats facts as a generic JSON map, retaining extra
  // metadata instead of parsing a narrower article DTO or discarding old text.
  var oldReader=json.readValue(json.writeValueAsBytes(rows.get(1)),RecommendationArticleRevision.class);assertEquals("ja-JP body",oldReader.facts.get("body"));assertTrue(oldReader.facts.containsKey("revisionRequest"));assertEquals(4,((Map<?,?>)oldReader.facts.get("translations")).size());
 }
 @Test void sameUuidReplaySurvivesSerializationAndServiceReconstruction()throws Exception{
  String before=articles.sourceHash(post);var id=UUID.randomUUID();var text=articles.reviewedTexts(texts(),true);String payload=articles.revisionPayloadHash(post,0,before,text);articles.applyReviewedRevision(post,text);post.version=1;articles.recordRevision(post,id,payload,before,0,1000L);
  var stored=json.readValue(json.writeValueAsBytes(rows.get(0)),RecommendationArticleRevision.class);rows.set(0,stored);var reconstructed=new RecommendationArticleService((RecommendationArticleRevisionRepository)Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{RecommendationArticleRevisionRepository.class},(p,m,a)->{if(m.getName().equals("findByMerchantIdAndPostIdOrderById"))return List.copyOf(rows);throw new UnsupportedOperationException(m.getName());}),json);
  var replay=reconstructed.replay(post,id,payload).orElseThrow();assertEquals(before,replay.previousSourceHash());assertEquals(1,replay.appliedVersion());assertEquals(1,rows.size());
 }
 @Test void sameUuidDifferentPayloadConflictsAndNeverMutatesHistory(){
  String before=articles.sourceHash(post);var id=UUID.randomUUID();String payload=articles.revisionPayloadHash(post,0,before,texts());articles.applyReviewedRevision(post,texts());post.version=1;articles.recordRevision(post,id,payload,before,0,1000L);
  assertThrows(RecommendationArticleService.RevisionConflict.class,()->articles.replay(post,id,"f".repeat(64)));assertEquals(1,rows.size());
 }
 @Test void payloadBindsPostOwnerVersionAndOldSourceHash(){
  String h=articles.revisionPayloadHash(post,0,"a".repeat(64),texts());assertNotEquals(h,articles.revisionPayloadHash(post,1,"a".repeat(64),texts()));assertNotEquals(h,articles.revisionPayloadHash(post,0,"b".repeat(64),texts()));post.id=9L;assertNotEquals(h,articles.revisionPayloadHash(post,0,"a".repeat(64),texts()));post.id=8L;post.merchantId=2000L;assertNotEquals(h,articles.revisionPayloadHash(post,0,"a".repeat(64),texts()));
 }
 @Test void ordinaryLegacyLanguageUpdateDoesNotAdoptAtomicHash(){
  for(String locale:List.of("zh-CN","zh-TW","en-US"))articles.update(post,locale,locale+" title",locale+" body",articles.sourceHash(post),true);
  assertEquals(3,post.articleTranslations.size());assertEquals(3,articles.current(post).size());assertNotEquals(articles.applyReviewedRevision(new RecommendationPost(),texts()),articles.sourceHash(post));
  String atomic=articles.applyReviewedRevision(post,texts());Instant originalReview=post.articleTranslations.get("ja-JP").reviewedAt();articles.update(post,"en-US","Single draft title","Single draft body",atomic,true);
  var en=post.articleTranslations.get("en-US");post.articleTranslations.put("en-US",new RecommendationPost.ArticleText(en.title(),en.body(),en.sourceHash(),originalReview));
  assertFalse(post.articleTranslations.containsKey("ja-JP"),"Sentinel removed even if the review clock/DB precision is identical");assertNotEquals(atomic,articles.sourceHash(post));assertEquals("ja-JP body",post.body);assertEquals(3,articles.current(post).size());
 }
 @Test void unknownTopLevelOrTextIdentityFieldsAreRejectedEvenWithGlobalUnknownsDisabled()throws Exception{
  var mapper=json.copy().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);var valid=new TreeMap<String,Object>();valid.put("requestId",UUID.randomUUID().toString());valid.put("version",0);valid.put("sourceHash","a".repeat(64));valid.put("reviewed",true);valid.put("articles",texts());
  assertNotNull(mapper.readValue(mapper.writeValueAsBytes(valid),RecommendationController.ArticleRevisionInput.class));valid.put("merchantId",2000);assertThrows(Exception.class,()->mapper.readValue(mapper.writeValueAsBytes(valid),RecommendationController.ArticleRevisionInput.class));
  assertThrows(Exception.class,()->mapper.readValue("{\"title\":\"x\",\"body\":\"y\",\"reviewedAt\":\"client\"}",RecommendationArticleService.ReviewedText.class));
 }
 @Test void unreviewedOrStaleLegacyTextsCannotMasqueradeAsCanonical(){
  String hash=articles.applyReviewedRevision(post,texts());var en=post.articleTranslations.get("en-US");post.articleTranslations.put("en-US",new RecommendationPost.ArticleText(en.title(),en.body(),en.sourceHash(),null));assertNotEquals(hash,articles.sourceHash(post));assertTrue(articles.current(post).values().stream().noneMatch(t->hash.equals(t.sourceHash())));
 }
}
