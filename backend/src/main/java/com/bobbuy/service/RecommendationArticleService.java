package com.bobbuy.service;
import com.bobbuy.model.*;
import com.bobbuy.repository.RecommendationArticleRevisionRepository;
import com.bobbuy.api.response.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import java.util.*;
import java.time.Instant;
@Service
public class RecommendationArticleService {
 private static final Set<String> LOCALES=Set.of("ja-JP","zh-CN","zh-TW","en-US");
 private static final String REVISION_KIND="REVIEWED_FOUR_LANGUAGE_ARTICLE_V1";
 public record ReviewedText(@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=200) String title,
     @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=100000) String body) {
  @com.fasterxml.jackson.annotation.JsonAnySetter public void unexpected(String name,Object value){throw new IllegalArgumentException("Unexpected article text field");}
 }
 public record RevisionReceipt(UUID requestId,String payloadHash,String previousSourceHash,String articleSourceHash,long appliedVersion) {}
 public static final class RevisionConflict extends ApiException {
  public RevisionConflict(){super(ErrorCode.INVALID_REQUEST,"error.recommendation.conflict");}
 }
 private final RecommendationArticleRevisionRepository revisions;private final ObjectMapper json;
 public RecommendationArticleService(RecommendationArticleRevisionRepository revisions,ObjectMapper json){this.revisions=revisions;this.json=json;}
 private String hash(Object value){try{return MediaBinaryService.sha(json.writeValueAsBytes(value));}catch(Exception e){throw new IllegalStateException("Article encoding failed",e);}}
 public String sourceHash(RecommendationPost p){
  // Legacy and ordinary single-language updates retain their exact old hash.
  // Only a complete server-reviewed atomic state can use the four-language hash.
  if("ja-JP".equals(p.articleSourceLocale)&&p.articleTranslations.keySet().equals(LOCALES)){
   var source=p.articleTranslations.get("ja-JP");
   if(source!=null&&source.reviewedAt()!=null&&Objects.equals(p.title,source.title())&&Objects.equals(p.body,source.body())){
    var texts=new TreeMap<String,ReviewedText>();boolean reviewed=true;
    for(String locale:LOCALES){var text=p.articleTranslations.get(locale);if(text==null||!source.reviewedAt().equals(text.reviewedAt())||!normalized(text.title(),200)||!normalized(text.body(),100000)){reviewed=false;break;}texts.put(locale,new ReviewedText(text.title(),text.body()));}
    if(reviewed){String binding=legacySourceHash(p);if(p.articleTranslations.values().stream().allMatch(t->binding.equals(t.sourceHash())))return canonicalHash(texts);}
   }
  }
  return legacySourceHash(p);
 }
 private String legacySourceHash(RecommendationPost p){return hash(Arrays.asList(p.articleSourceLocale,p.title,p.body));}
 private static boolean normalized(String text,int max){return text!=null&&!text.isBlank()&&text.length()<=max&&text.equals(text.trim());}
 private String canonicalHash(Map<String,ReviewedText> texts){return hash(Arrays.asList(REVISION_KIND,"ja-JP",new TreeMap<>(texts)));}
 public Map<String,ReviewedText> reviewedTexts(Map<String,ReviewedText> input,boolean reviewed){
  if(!reviewed)throw new ApiException(ErrorCode.INVALID_REQUEST,"translation.review_required");
  if(input==null||!input.keySet().equals(LOCALES))throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.incomplete");
  var result=new TreeMap<String,ReviewedText>();
  for(String locale:LOCALES){var text=input.get(locale);if(text==null||text.title()==null||text.body()==null||text.title().length()>200||text.body().length()>100000||text.title().isBlank()||text.body().isBlank())throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.incomplete");result.put(locale,new ReviewedText(text.title().trim(),text.body().trim()));}
  return Collections.unmodifiableMap(result);
 }
 public String revisionPayloadHash(RecommendationPost post,long version,String expectedSource,Map<String,ReviewedText> texts){
  return hash(Arrays.asList(REVISION_KIND,post.merchantId,post.id,version,expectedSource,new TreeMap<>(texts)));
 }
 public Optional<RevisionReceipt> replay(RecommendationPost post,UUID requestId,String payloadHash){
  for(var row:history(post)){
   if(!(row.facts.get("revisionRequest") instanceof Map<?,?> saved)||!requestId.toString().equals(saved.get("requestId")))continue;
   if(!REVISION_KIND.equals(saved.get("kind"))||!payloadHash.equals(saved.get("payloadHash"))||!(saved.get("appliedVersion") instanceof Number version)||!(saved.get("previousSourceHash") instanceof String previous)||!(saved.get("articleSourceHash") instanceof String result))throw new RevisionConflict();
   return Optional.of(new RevisionReceipt(requestId,payloadHash,previous,result,version.longValue()));
  }
  return Optional.empty();
 }
 public String applyReviewedRevision(RecommendationPost post,Map<String,ReviewedText> texts){
  String nextHash=canonicalHash(texts);Instant reviewedAt=Instant.now();
  // Persist the actual Japanese-source binding understood by the existing V28
  // reader. The whole-article hash belongs to the bundle receipt/API projection.
  String binding=hash(Arrays.asList("ja-JP",texts.get("ja-JP").title(),texts.get("ja-JP").body()));
  var translations=new HashMap<String,RecommendationPost.ArticleText>();
  texts.forEach((locale,text)->translations.put(locale,new RecommendationPost.ArticleText(text.title(),text.body(),binding,reviewedAt)));
  post.articleSourceLocale="ja-JP";post.title=texts.get("ja-JP").title();post.body=texts.get("ja-JP").body();post.articleTranslations=translations;
  return nextHash;
 }
 private TreeMap<String,Object> facts(RecommendationPost p){var facts=new TreeMap<String,Object>();facts.put("sourceLocale",p.articleSourceLocale);facts.put("title",p.title);facts.put("body",p.body);facts.put("translations",new TreeMap<>(p.articleTranslations));if(p.serviceOffer!=null)facts.put("serviceOffer",p.serviceOffer);return facts;}
 public Map<String,RecommendationPost.ArticleText> current(RecommendationPost p){return view(p,true);}
 public Map<String,RecommendationPost.ArticleText> all(RecommendationPost p){return view(p,false);}
 private Map<String,RecommendationPost.ArticleText> view(RecommendationPost p,boolean publicView){
  var result=new HashMap<String,RecommendationPost.ArticleText>();String binding=legacySourceHash(p),bundle=sourceHash(p);
  p.articleTranslations.forEach((locale,text)->{if(binding.equals(text.sourceHash()))result.put(locale,new RecommendationPost.ArticleText(text.title(),text.body(),bundle,text.reviewedAt()));else if(!publicView)result.put(locale,text);});
  return Map.copyOf(result);
 }
 public Map<String,String> titles(RecommendationPost p){var result=new HashMap<String,String>();current(p).forEach((locale,text)->{if(text.title()!=null&&!text.title().isBlank())result.put(locale,text.title());});return Map.copyOf(result);}
 public void snapshot(RecommendationPost p){
  if(p.id==null)return;var facts=facts(p);String hash=hash(facts);
  if(revisions.findFirstByPostIdOrderByIdDesc(p.id).filter(row->hash.equals(row.factsHash)).isPresent())return;
  var row=new RecommendationArticleRevision();row.postId=p.id;row.merchantId=p.merchantId;row.factsHash=hash;row.facts=facts;row.recordedAt=Instant.now();revisions.saveAndFlush(row);
 }
 public RevisionReceipt recordRevision(RecommendationPost post,UUID requestId,String payloadHash,String previousSource,long baseVersion,Long actor){
  String result=sourceHash(post);var facts=facts(post);var request=new TreeMap<String,Object>();
  request.put("kind",REVISION_KIND);request.put("requestId",requestId.toString());request.put("payloadHash",payloadHash);request.put("actorId",actor);request.put("reviewed",true);request.put("reviewedAt",Instant.now().toString());request.put("baseVersion",baseVersion);request.put("appliedVersion",post.version);request.put("previousSourceHash",previousSource);request.put("articleSourceHash",result);
  facts.put("revisionRequest",request);var row=new RecommendationArticleRevision();row.postId=post.id;row.merchantId=post.merchantId;row.facts=facts;row.factsHash=hash(facts);row.recordedAt=Instant.now();revisions.saveAndFlush(row);
  return new RevisionReceipt(requestId,payloadHash,previousSource,result,post.version);
 }
 public void update(RecommendationPost p,String locale,String title,String body,String expectedSource,boolean reviewed){
  if(!reviewed||!Objects.equals(sourceHash(p),expectedSource)||!Set.of("ja-JP","zh-CN","zh-TW","en-US").contains(locale))throw new ApiException(ErrorCode.INVALID_REQUEST,"translation.review_required");
  snapshot(p);
  if("ja-JP".equals(locale)){p.title=title.trim();p.body=body.trim();p.articleSourceLocale="ja-JP";var next=new HashMap<>(p.articleTranslations);next.remove("ja-JP");p.articleTranslations=next;}
  else {if(!"ja-JP".equals(p.articleSourceLocale))throw new ApiException(ErrorCode.INVALID_REQUEST,"translation.review_required");var next=new HashMap<>(p.articleTranslations);next.remove("ja-JP");next.put(locale,new RecommendationPost.ArticleText(title.trim(),body.trim(),legacySourceHash(p),Instant.now()));p.articleTranslations=next;}
  snapshot(p);
 }
 public java.util.List<RecommendationArticleRevision> history(RecommendationPost p){return revisions.findByMerchantIdAndPostIdOrderById(p.merchantId,p.id);}
}
