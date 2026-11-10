package com.bobbuy.service;

import com.bobbuy.api.response.*;
import com.fasterxml.jackson.databind.*;
import org.springframework.stereotype.Service;
import java.net.*;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.regex.Pattern;

/** Exact structured SKU evidence, never image filenames or similar-name results. */
@Service
public class OfficialProductResearch {
 private final AiSearchService search;
 private final ObjectMapper mapper;
 public OfficialProductResearch(AiSearchService search,ObjectMapper mapper){this.search=search;this.mapper=mapper;}
 public record Product(String itemNumber,String name,String description,String productUrl,List<String> images){}
 public static class AccessFailure extends ApiException {
  private final int status;private final String target;
  public AccessFailure(int status,String target,String key){super(ErrorCode.INVALID_REQUEST,key);this.status=status;this.target=target;}
  public int status(){return status;} public String target(){return target;}
 }
 public List<Product> find(String item,String suppliedUrl){
  if(item==null||item.isBlank()||item.length()>100)throw invalid();
  var urls=suppliedUrl!=null&&!suppliedUrl.isBlank()?List.of(suppliedUrl):search.officialProductUrls(item);
  var found=new ArrayList<Product>();
  for(String url:urls.stream().distinct().limit(5).toList()){
   try{Product p=parse(get(pageUri(url),2*1024*1024),url,item,mapper);if(p!=null)found.add(p);}catch(ApiException error){if(error instanceof AccessFailure access&&(access.status()==401||access.status()==403||access.status()==429)||suppliedUrl!=null&&!suppliedUrl.isBlank())throw error;}
  }
  return found;
 }
 public RecommendationImageValidator.Image image(String productUrl,String item,String imageUrl){
  var p=find(item,productUrl).stream().findFirst().orElseThrow(OfficialProductResearch::invalid);
  if(!p.images().contains(imageUrl))throw invalid();
  return RecommendationImageValidator.validate(getBytes(imageUri(imageUrl),RecommendationImageValidator.MAX_BYTES));
 }
 public List<RecommendationImageValidator.Image> images(String productUrl,String item,List<String> imageUrls){
  if(imageUrls.isEmpty())return List.of();
  var product=find(item,productUrl).stream().findFirst().orElseThrow(OfficialProductResearch::invalid);
  if(!product.images().containsAll(imageUrls))throw invalid();
  return imageUrls.stream().map(url->RecommendationImageValidator.validate(getBytes(imageUri(url),RecommendationImageValidator.MAX_BYTES))).toList();
 }
 private static ApiException invalid(){return new ApiException(ErrorCode.INVALID_REQUEST,"error.ai.source_filter_empty");}
 static URI pageUri(String source){
  try{var u=URI.create(source);if(!"https".equals(u.getScheme())||!"www.costco.co.jp".equalsIgnoreCase(u.getHost())||u.getPort()!=-1||u.getUserInfo()!=null||u.getRawQuery()!=null||u.getFragment()!=null||!u.getPath().contains("/p/"))throw invalid();return u;}catch(IllegalArgumentException error){throw invalid();}
 }
 static URI imageUri(String source){
  try{var u=URI.create(source);if(!"https".equals(u.getScheme())||!"www.costco.co.jp".equalsIgnoreCase(u.getHost())||u.getPort()!=-1||u.getUserInfo()!=null||u.getRawQuery()!=null||u.getFragment()!=null||!u.getPath().startsWith("/medias/sys_master/images/"))throw invalid();return u;}catch(IllegalArgumentException error){throw invalid();}
 }
 protected String get(URI uri,int limit){return new String(getBytes(uri,limit),java.nio.charset.StandardCharsets.UTF_8);}
 protected byte[] getBytes(URI uri,int limit){
  try{var client=HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).connectTimeout(Duration.ofSeconds(10)).build();
   var result=client.send(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(25)).header("Accept","text/html,application/json,image/jpeg,image/png").GET().build(),HttpResponse.BodyHandlers.ofInputStream());
   try(var body=result.body()){if(result.statusCode()!=200)throw new AccessFailure(result.statusCode(),uri.toString(),"error.ai.source_filter_empty");var bytes=body.readNBytes(limit+1);if(bytes.length>limit)throw invalid();return bytes;}
  }catch(ApiException error){throw error;}catch(Exception error){throw invalid();}
 }
 public static Product parse(String html,String url,String item,ObjectMapper mapper){
  if(!pageUri(url).getPath().endsWith("/p/"+item))return null;
  var scripts=Pattern.compile("<script\\b[^>]*type\\s*=\\s*[\"']application/ld\\+json[\"'][^>]*>(.*?)</script>",Pattern.CASE_INSENSITIVE|Pattern.DOTALL).matcher(html);
  while(scripts.find())try{
   var queue=new ArrayDeque<JsonNode>();queue.add(mapper.readTree(scripts.group(1)));
   while(!queue.isEmpty()){
    var node=queue.remove();if(node.isArray()){node.forEach(queue::add);continue;}if(node.has("@graph"))queue.add(node.get("@graph"));
    var type=node.path("@type");boolean productType=type.isTextual()&&type.asText().equalsIgnoreCase("Product");if(type.isArray())for(var entry:type)if(entry.asText().equalsIgnoreCase("Product"))productType=true;
    if(!productType||!item.equals(node.path("sku").asText()))continue;
    var name=node.path("name").asText("");if(name.isBlank())continue;
    var pictures=new ArrayList<String>();var image=node.path("image");var values=image.isArray()?image:mapper.createArrayNode().add(image);
    for(var value:values){String source=value.isTextual()?value.asText():value.path("url").asText("");if(source.startsWith("http://www.costco.co.jp/"))source="https"+source.substring(4);try{imageUri(source);if(!pictures.contains(source))pictures.add(source);}catch(ApiException ignored){}}
    // The SSR primary gallery is scoped to this product, unlike recommendation carousels.
    // Prefer its explicit zoom assets over responsive/thumbnail copies of the same angles.
    var gallery=primaryGallery(html,name);
    if(!gallery.isEmpty()&&gallery.containsAll(pictures))pictures=new ArrayList<>(gallery);
    // No hasVariant traversal: a different SKU or colour must never enter this gallery.
    return new Product(item,name,node.path("description").asText(""),url,List.copyOf(pictures));
   }
  }catch(Exception ignored){}
  return null;
 }
 private static String attribute(String tag,String name){
  var match=Pattern.compile("\\b"+name+"\\s*=\\s*([\"'])(.*?)\\1",Pattern.CASE_INSENSITIVE|Pattern.DOTALL).matcher(tag);
  return match.find()?match.group(2).replace("&amp;","&").replace("&quot;","\"").replace("&#39;","'"):"";
 }
 private static List<String> primaryGallery(String html,String name){
  var divs=Pattern.compile("</?div\\b[^>]*>",Pattern.CASE_INSENSITIVE).matcher(html);
  int start=-1,depth=0,end=-1;
  while(divs.find()){
   String tag=divs.group();boolean close=tag.startsWith("</");
   if(start<0){if(!close&&Arrays.asList(attribute(tag,"class").split("\\s+")).contains("primary-image")){start=divs.end();depth=1;}}
   else {depth+=close?-1:1;if(depth==0){end=divs.start();break;}}
  }
  if(start<0||end<0)return List.of();
  var pictures=new ArrayList<String>();
  var zooms=Pattern.compile("<sip-media\\b([^>]*)>(.*?)</sip-media>",Pattern.CASE_INSENSITIVE|Pattern.DOTALL).matcher(html.substring(start,end));
  while(zooms.find()){
   if(!"zoom".equalsIgnoreCase(attribute(zooms.group(1),"format")))continue;
   var image=Pattern.compile("<img\\b[^>]*>",Pattern.CASE_INSENSITIVE).matcher(zooms.group(2));
   if(!image.find()||!name.equals(attribute(image.group(),"alt")))continue;
   String src=attribute(image.group(),"src");if(src.startsWith("/medias/"))src="https://www.costco.co.jp"+src;
   try{imageUri(src);if(!pictures.contains(src))pictures.add(src);}catch(ApiException ignored){}
  }
  return pictures;
 }
}
