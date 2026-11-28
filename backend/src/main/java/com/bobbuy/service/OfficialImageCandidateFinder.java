package com.bobbuy.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.net.URI;
import java.security.MessageDigest;
import java.util.*;
import java.util.regex.*;

/** Starts a new public-evidence lookup after every non-excluded item has been published. */
public interface OfficialImageCandidateFinder {
 record Request(long merchantId,String supplierId,String market,String itemNumber,String brand,String specification,String packaging) {}
 record Candidate(String sourcePage,String imageUrl,String matchBasis) {}
 Optional<Candidate> find(Request request);

 @Service
 final class CostcoOfficialSiteFinder implements OfficialImageCandidateFinder {
  private final CostcoOfficialEvidenceFetcher fetcher;
  private final CostcoEvidenceStore store;
  private final ObjectMapper mapper;
  private final OfficialProductResearch legacyTestResearch;

  @Autowired public CostcoOfficialSiteFinder(CostcoOfficialEvidenceFetcher fetcher,CostcoEvidenceStore store,ObjectMapper mapper){this.fetcher=fetcher;this.store=store;this.mapper=mapper;this.legacyTestResearch=null;}
  CostcoOfficialSiteFinder(OfficialProductResearch research){this.fetcher=null;this.store=null;this.mapper=null;this.legacyTestResearch=research;}

  @Override public Optional<Candidate> find(Request request){
   if(legacyTestResearch!=null)return fromProducts(request,legacyTestResearch.find(request.itemNumber(),null));
   String inputHash=hash(String.join("\n",Long.toString(request.merchantId()),request.supplierId(),request.market(),request.itemNumber(),
     Objects.toString(request.brand(),""),Objects.toString(request.specification(),""),Objects.toString(request.packaging(),"")));
   var evidence=fetcher.fetch(new CostcoOfficialEvidenceFetcher.Query(request.merchantId(),request.supplierId(),request.market(),request.itemNumber(),null,inputHash));
   var documents=new HashMap<String,CostcoOfficialEvidence>();
   for(var item:evidence)if(!item.mediaType().startsWith("image/"))documents.put(item.sha256(),item);
   var manufacturerHosts=trustedManufacturerHosts(request,documents.values());
   for(var image:evidence){
    if(!image.mediaType().startsWith("image/")||image.sourceDocumentSha256()==null)continue;
    var page=documents.get(image.sourceDocumentSha256());if(page==null)continue;
    if(!isCostcoHost(page.fetchedUrl().getHost())&&!manufacturerHosts.contains(normalizeHost(page.fetchedUrl().getHost())))continue;
    String text=new String(store.readVerified(request.merchantId(),page.sha256()),StandardCharsets.UTF_8);
    var product=exactProductSection(text,page,request.itemNumber());
    if(product.isEmpty())continue;
    String exactProduct;
    try{exactProduct=mapper.writeValueAsString(product);}catch(Exception error){throw new IllegalStateException("official_image.product_evidence",error);}
    if(!hasIdentifier(exactProduct,request.itemNumber())||!sameVariant(request.specification()+" "+request.packaging(),exactProduct))continue;
    if(request.brand()!=null&&!request.brand().isBlank()&&!normalize(exactProduct).contains(normalize(request.brand())))continue;
    return Optional.of(new Candidate(page.fetchedUrl().toString(),image.fetchedUrl().toString(),
      "verified official page/image relationship; item "+request.itemNumber()+"; market "+request.market()+"; specification "+request.specification()+"; package "+request.packaging()));
   }
   return Optional.empty();
  }
  private Set<String> trustedManufacturerHosts(Request request,Collection<CostcoOfficialEvidence> documents){
   var result=new HashSet<String>();
   for(var page:documents){
    if(!isCostcoHost(page.fetchedUrl().getHost()))continue;
    String text=new String(store.readVerified(request.merchantId(),page.sha256()),StandardCharsets.UTF_8);
    var product=CostcoPinnedStageReviewer.costcoProductSection(text,page,request.itemNumber(),mapper);
    if(product.isEmpty())continue;
    String exactProduct;
    try{exactProduct=mapper.writeValueAsString(product);}catch(Exception error){throw new IllegalStateException("official_image.product_evidence",error);}
    if(!hasIdentifier(exactProduct,request.itemNumber())||!sameVariant(request.specification()+" "+request.packaging(),exactProduct))continue;
    if(request.brand()!=null&&!request.brand().isBlank()&&!normalize(exactProduct).contains(normalize(request.brand())))continue;
    var structured=(com.fasterxml.jackson.databind.JsonNode)product.get("product");
    // Only an explicit brand or manufacturer URL on the verified supplier product proves provenance.
    for(var field:List.of("brand","manufacturer"))try{
     URI link=URI.create(structured.path(field).path("url").asText());String host=normalizeHost(link.getHost());
     if("https".equalsIgnoreCase(link.getScheme())&&link.getRawUserInfo()==null&&link.getPort()==-1
         &&host!=null&&!isCostcoHost(host))result.add(host);
    }catch(IllegalArgumentException ignored){/* An unparseable page link establishes no provenance. */}
   }
   return result;
  }
  private Map<String,Object> exactProductSection(String html,CostcoOfficialEvidence page,String itemNumber){
   if(isCostcoHost(page.fetchedUrl().getHost()))return CostcoPinnedStageReviewer.costcoProductSection(html,page,itemNumber,mapper);
   var scripts=Pattern.compile("(?is)<script[^>]*application/ld\\+json[^>]*>(.*?)</script>").matcher(html);
   Map<String,Object> result=Map.of();
   while(scripts.find())try{
    var node=mapper.readTree(scripts.group(1));
    if(node!=null&&"product".equalsIgnoreCase(node.path("@type").asText())&&itemNumber.equals(node.path("sku").asText())&&!node.path("name").asText().isBlank()){
     if(!result.isEmpty())return Map.of();
     result=Map.of("product",node);
    }
   }catch(com.fasterxml.jackson.core.JsonProcessingException ignored){/* Invalid structured data is not evidence. */}
   return result;
  }
  private static boolean isCostcoHost(String host){host=normalizeHost(host);return "costco.co.jp".equals(host)||(host!=null&&host.endsWith(".costco.co.jp"));}
  private static String normalizeHost(String host){return host==null?null:host.toLowerCase(Locale.ROOT).replaceFirst("\\.$","");}
  private Optional<Candidate> fromProducts(Request request,List<OfficialProductResearch.Product> products){
   for(var product:products){String official=String.join(" ",product.name(),product.description());if(!Objects.equals(request.itemNumber(),product.itemNumber())||!sameVariant(request.specification()+" "+request.packaging(),official)||product.images().isEmpty())continue;return Optional.of(new Candidate(product.productUrl(),product.images().get(0),"official SKU "+request.itemNumber()+"; market "+request.market()+"; specification "+request.specification()+"; package "+request.packaging()));}return Optional.empty();
  }
  static boolean sameVariant(String expected,String actual){var wanted=measures(expected);return !wanted.isEmpty()&&measures(actual).containsAll(wanted)&&packageCounts(actual).containsAll(packageCounts(expected));}
  private record Measure(String dimension,long amount){}
  private static Set<Measure> measures(String value){var result=new HashSet<Measure>();if(value==null)return result;var matcher=Pattern.compile("(?i)(\\d+(?:[.,]\\d+)?)\\s*(kg|g|ml|l)\\b").matcher(value);while(matcher.find()){double amount=Double.parseDouble(matcher.group(1).replace(',','.'));String unit=matcher.group(2).toLowerCase(Locale.ROOT);String dimension=unit.equals("ml")||unit.equals("l")?"volume":"weight";result.add(new Measure(dimension,Math.round(amount*(unit.equals("kg")||unit.equals("l")?1000:1))));}return result;}
  private static Set<Long> packageCounts(String value){var result=new HashSet<Long>();if(value==null)return result;var m=Pattern.compile("(?i)(?:x|×)\\s*(\\d+)|(\\d+)\\s*(?:pack|packs|pk|個|本|袋|缶|箱)\\b").matcher(value);while(m.find()){long count=Long.parseLong(m.group(1)!=null?m.group(1):m.group(2));if(count>1)result.add(count);}return result;}
  private static boolean hasIdentifier(String text,String item){return Pattern.compile("(?<![0-9])"+Pattern.quote(item)+"(?![0-9])").matcher(text).find();}
  private static String normalize(String value){return value.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]","");}
  private static String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
 }
}
