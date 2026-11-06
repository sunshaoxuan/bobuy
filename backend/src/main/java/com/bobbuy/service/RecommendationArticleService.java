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
 private final RecommendationArticleRevisionRepository revisions;private final ObjectMapper json;
 public RecommendationArticleService(RecommendationArticleRevisionRepository revisions,ObjectMapper json){this.revisions=revisions;this.json=json;}
 private String hash(Object value){try{return MediaBinaryService.sha(json.writeValueAsBytes(value));}catch(Exception e){throw new IllegalStateException("Article encoding failed",e);}}
 public String sourceHash(RecommendationPost p){return hash(Arrays.asList(p.articleSourceLocale,p.title,p.body));}
 public Map<String,RecommendationPost.ArticleText> current(RecommendationPost p){var result=new HashMap<String,RecommendationPost.ArticleText>();String hash=sourceHash(p);p.articleTranslations.forEach((locale,text)->{if(hash.equals(text.sourceHash()))result.put(locale,text);});return Map.copyOf(result);}
 public Map<String,String> titles(RecommendationPost p){var result=new HashMap<String,String>();current(p).forEach((locale,text)->{if(text.title()!=null&&!text.title().isBlank())result.put(locale,text.title());});return Map.copyOf(result);}
 public void snapshot(RecommendationPost p){
  if(p.id==null)return;var facts=new TreeMap<String,Object>();facts.put("sourceLocale",p.articleSourceLocale);facts.put("title",p.title);facts.put("body",p.body);facts.put("translations",new TreeMap<>(p.articleTranslations));if(p.serviceOffer!=null)facts.put("serviceOffer",p.serviceOffer);String hash=hash(facts);
  if(revisions.findFirstByPostIdOrderByIdDesc(p.id).filter(row->hash.equals(row.factsHash)).isPresent())return;
  var row=new RecommendationArticleRevision();row.postId=p.id;row.merchantId=p.merchantId;row.factsHash=hash;row.facts=facts;row.recordedAt=Instant.now();revisions.saveAndFlush(row);
 }
 public void update(RecommendationPost p,String locale,String title,String body,String expectedSource,boolean reviewed){
  if(!reviewed||!Objects.equals(sourceHash(p),expectedSource)||!Set.of("ja-JP","zh-CN","zh-TW","en-US").contains(locale))throw new ApiException(ErrorCode.INVALID_REQUEST,"translation.review_required");
  snapshot(p);
  if("ja-JP".equals(locale)){p.title=title.trim();p.body=body.trim();p.articleSourceLocale="ja-JP";}
  else {if(!"ja-JP".equals(p.articleSourceLocale))throw new ApiException(ErrorCode.INVALID_REQUEST,"translation.review_required");var next=new HashMap<>(p.articleTranslations);next.put(locale,new RecommendationPost.ArticleText(title.trim(),body.trim(),sourceHash(p),Instant.now()));p.articleTranslations=next;}
  snapshot(p);
 }
 public java.util.List<RecommendationArticleRevision> history(RecommendationPost p){return revisions.findByMerchantIdAndPostIdOrderById(p.merchantId,p.id);}
}
