package com.bobbuy.service;

import com.bobbuy.api.response.*;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.MerchantScope;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Pattern;

/** Review assistant. Artifact bytes are consumed only inside this service and never returned. */
@Service
public class RecommendationRepairService {
 private static final Set<String> LOCALES=Set.of("ja-JP","zh-CN","zh-TW","en-US");
 private static final Pattern HTTPS=Pattern.compile("https://[^\\s<>\\\"']+");
 private final RecommendationPostRepository posts; private final RecommendationItemRepository items;
 private final RecommendationSourceArtifactRepository artifacts; private final ProductRepository products;
 private final UserRepository users; private final LlmGateway llm;
 public RecommendationRepairService(RecommendationPostRepository posts,RecommendationItemRepository items,RecommendationSourceArtifactRepository artifacts,ProductRepository products,UserRepository users,LlmGateway llm){this.posts=posts;this.items=items;this.artifacts=artifacts;this.products=products;this.users=users;this.llm=llm;}
 public record FieldSuggestion(String field,String currentValue,String suggestedValue,String evidence,String unresolvedReason,boolean overwrite){}
 public record ItemSuggestion(Long itemId,String productId,long itemVersion,Long productVersion,List<FieldSuggestion> fields){}
 public record SourcePreview(Long postId,long version,List<ItemSuggestion> items){}
 public record LocaleSuggestion(String productId,long productVersion,String field,String locale,String sourceLocale,String sourceText,String suggestion,String error,boolean aiSuggested){}
 public record LocalePreview(Long postId,long version,List<LocaleSuggestion> suggestions){}
 public record LocaleEdit(String productId,long productVersion,String field,String locale,String value){}
 private Long owner(){var id=MerchantScope.current();if(id==null)throw new ApiException(ErrorCode.FORBIDDEN,"error.auth.forbidden");return id;}
 private RecommendationPost owned(Long id){return posts.findByIdAndMerchantId(id,owner()).orElseThrow(()->new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"error.recommendation.not_found"));}
 private static boolean blank(String s){return s==null||s.isBlank();}
 private static String https(String value){try{var u=java.net.URI.create(value);return "https".equals(u.getScheme())&&u.getHost()!=null&&u.getUserInfo()==null?value:null;}catch(Exception e){return null;}}
 private Map<String,String> sourceCandidates(RecommendationPost post){
  var result=new HashMap<String,String>();String ref=post.issueDateSourceRef;
  if(ref!=null&&ref.startsWith("message:")&&ref.length()>8)result.put("sourceMessageKey",ref);
  if(https(ref)!=null)result.put("sourceUrl",ref);
  if(post.hasReviewedIssueDate())artifacts.findBySourceRef(ref).ifPresent(a->{
   String text=new String(a.content,StandardCharsets.UTF_8);var urls=HTTPS.matcher(text);var unique=new LinkedHashSet<String>();while(urls.find()){String url=https(urls.group());if(url!=null)unique.add(url);}
   if(unique.size()==1)result.putIfAbsent("sourceUrl",unique.iterator().next());
   String lower=text.toLowerCase(Locale.ROOT);boolean online=lower.contains("costco online")||lower.contains("オンライン")||lower.contains("costco.co.jp/online");boolean warehouse=lower.contains("warehouse")||lower.contains("倉庫店");
   if(online^warehouse)result.put("channel",online?"COSTCO_ONLINE":"COSTCO_WAREHOUSE");
  });return result;
 }
 @Transactional(readOnly=true) public SourcePreview previewSource(Long postId,boolean overwrite){
  var post=owned(postId);var source=sourceCandidates(post);var rows=new ArrayList<ItemSuggestion>();String defaultSupplier=postSupplier(postId,source);
  for(var item:items.findByPostIdOrderById(postId)){var current=item.referenceContext;var product=item.productId==null?null:products.findById(item.productId).filter(p->owner().equals(p.getMerchantId())).orElse(null);
   String supplier=product==null||product.getCatalogData()==null?null:product.getCatalogData().supplierId();
   if(blank(supplier)&&product!=null)supplier=product.getAttributes().get("referenceSupplierKey");
   if(blank(supplier))supplier=defaultSupplier;
   var candidate=new LinkedHashMap<String,String>();candidate.put("supplierKey",supplier);candidate.put("channel",source.get("channel"));candidate.put("sourceMessageKey",source.get("sourceMessageKey"));candidate.put("sourceUrl",source.get("sourceUrl"));
   var fields=new ArrayList<FieldSuggestion>();for(var e:candidate.entrySet()){String old=switch(e.getKey()){case "supplierKey"->current==null?null:current.supplierKey();case "channel"->current==null?null:current.channel();case "sourceMessageKey"->current==null?null:current.sourceMessageKey();default->current==null?null:current.sourceUrl();};String suggestion=e.getValue();boolean blocked=!blank(old)&&!overwrite;
    fields.add(new FieldSuggestion(e.getKey(),old,blocked?null:suggestion,suggestion==null?null:(e.getKey().equals("supplierKey")?"product master":"reviewed issue-date source"),suggestion==null?"not uniquely derivable":null,!blank(old)&&overwrite));}
   rows.add(new ItemSuggestion(item.id,item.productId,post.version,product==null?null:Objects.requireNonNullElse(product.getRecordVersion(),0L),fields));
  }return new SourcePreview(postId,post.version,rows);
 }
 private String postSupplier(Long postId,Map<String,String> source){
  var suppliers=new HashSet<String>();
  for(var item:items.findByPostIdOrderById(postId)){
   if(item.referenceContext!=null&&!blank(item.referenceContext.supplierKey()))suppliers.add(item.referenceContext.supplierKey());
   if(item.productId!=null)products.findById(item.productId).filter(p->owner().equals(p.getMerchantId())).ifPresent(p->{String key=p.getCatalogData()==null?null:p.getCatalogData().supplierId();if(blank(key))key=p.getAttributes().get("referenceSupplierKey");if(!blank(key))suppliers.add(key);});
  }
  String url=source.get("sourceUrl");
  if(url!=null){String host=java.net.URI.create(url).getHost();if("costco.co.jp".equalsIgnoreCase(host)||host.toLowerCase(Locale.ROOT).endsWith(".costco.co.jp"))suppliers.add("costco-jp");}
  return suppliers.size()==1?suppliers.iterator().next():null;
 }
 @Transactional public SourcePreview applySource(Long postId,long version,boolean overwrite,SourcePreview confirmedPreview){
  users.lockById(owner()).orElseThrow();var post=owned(postId);if(post.version!=version)throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.conflict");
  items.findByPostIdOrderById(postId).stream().map(i->i.productId).filter(Objects::nonNull).distinct().sorted().forEach(products::lockById);
  var preview=previewSource(postId,overwrite);
  if(!preview.equals(confirmedPreview))throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.conflict");
  for(var row:preview.items()){var item=items.findById(row.itemId()).filter(i->i.postId.equals(postId)).orElseThrow();var c=item.referenceContext==null?new ReferenceOfferContext(null,null,null,null,null,null,null,false,null,false):item.referenceContext;Map<String,String> v=new HashMap<>();for(var f:row.fields())if(f.suggestedValue()!=null)v.put(f.field(),f.suggestedValue());
   item.referenceContext=new ReferenceOfferContext(v.getOrDefault("supplierKey",c.supplierKey()),v.getOrDefault("channel",c.channel()),c.variantKey(),v.getOrDefault("sourceMessageKey",c.sourceMessageKey()),v.getOrDefault("sourceUrl",c.sourceUrl()),c.activityStart(),c.activityEnd(),c.activityApplies(),c.windowEvidence(),c.startSearchComplete());items.save(item);
  }post.updatedAt=java.time.LocalDateTime.now();posts.saveAndFlush(post);return previewSource(postId,overwrite);
 }
 @Transactional(readOnly=true) public LocalePreview suggestLocales(Long postId){
  var post=owned(postId);var result=new ArrayList<LocaleSuggestion>();var seen=new HashSet<String>();for(var item:items.findByPostIdOrderById(postId)){if(item.productId==null||!seen.add(item.productId))continue;var p=products.findById(item.productId).filter(x->owner().equals(x.getMerchantId())).orElse(null);if(p==null||p.getCatalogData()==null)continue;
   for(String field:List.of("name","specification")){Map<String,String> values=field.equals("name")?p.getName():p.getCatalogData().specification();String sourceLocale=!ProductCatalogService.text(values,"ja-JP").isBlank()?"ja-JP":!ProductCatalogService.text(values,"zh-CN").isBlank()?"zh-CN":null;String source=sourceLocale==null?null:ProductCatalogService.text(values,sourceLocale);
    for(String locale:LOCALES)if(ProductCatalogService.text(values,locale).isBlank()){String suggestion=null,error=null;if(source==null)error="source text missing";else if(locale.equals(sourceLocale))error="source locale missing";else{try{suggestion=llm.translate(source,locale).filter(x->!x.isBlank()).orElse(null);if(suggestion==null)error="AI translation unavailable";}catch(RuntimeException ex){error="AI translation failed";}}result.add(new LocaleSuggestion(p.getId(),Objects.requireNonNullElse(p.getRecordVersion(),0L),field,locale,sourceLocale,source,suggestion,error,suggestion!=null));}
   }}return new LocalePreview(postId,post.version,result);
 }
 @Transactional public void applyLocales(Long postId,long version,List<LocaleEdit> edits){
  users.lockById(owner()).orElseThrow();var post=owned(postId);if(post.version!=version)throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.conflict");if(edits==null||edits.isEmpty())return;
  for(var group:edits.stream().collect(java.util.stream.Collectors.groupingBy(LocaleEdit::productId)).entrySet()){var p=products.findById(group.getKey()).filter(x->owner().equals(x.getMerchantId())).orElseThrow();long expected=group.getValue().get(0).productVersion();if(!Objects.equals(p.getRecordVersion(),expected))throw new ApiException(ErrorCode.INVALID_REQUEST,"master.conflict");var names=new HashMap<>(p.getName());var specs=new HashMap<>(p.getCatalogData().specification());
   for(var edit:group.getValue()){if(edit.productVersion()!=expected||!LOCALES.contains(edit.locale())||(!edit.field().equals("name")&&!edit.field().equals("specification"))||edit.value()==null||edit.value().isBlank())throw new ApiException(ErrorCode.INVALID_REQUEST,"master.invalid");
    var target=edit.field().equals("name")?names:specs;String old=target.get(edit.locale());
    if(!blank(old)&&!old.equals(edit.value().trim()))throw new ApiException(ErrorCode.INVALID_REQUEST,"master.conflict");
    target.put(edit.locale(),edit.value().trim());
   }
   // Installing fields must precede hashing. Blank-fill is not a review of existing translations.
   var d=p.getCatalogData();String previousHash=d.translatedSource();String previousSource=ProductCatalogService.sourceHash(p);
   boolean reviewedExisting=true;
   for(String locale:LOCALES){if(locale.equals("ja-JP"))continue;
    if(!ProductCatalogService.text(p.getDescription(),locale).isBlank())reviewedExisting=false;
    for(String field:List.of("name","specification")){
     var existing=field.equals("name")?p.getName():d.specification();
     if(!ProductCatalogService.text(existing,locale).isBlank()&&group.getValue().stream().noneMatch(e->e.field().equals(field)&&e.locale().equals(locale)))reviewedExisting=false;
    }
   }
   p.setName(names);p.setCatalogData(new ProductCatalogData(Map.copyOf(specs),d.model(),d.packaging(),d.categoryIds(),d.supplierId(),previousHash,d.reviewedBy(),d.reviewedAt()));
   String updatedSource=ProductCatalogService.sourceHash(p);
   if(reviewedExisting&&!previousSource.equals(updatedSource))p.setCatalogData(new ProductCatalogData(Map.copyOf(specs),d.model(),d.packaging(),d.categoryIds(),d.supplierId(),updatedSource,d.reviewedBy(),d.reviewedAt()));
   products.saveAndFlush(p);
  }
 }
}
