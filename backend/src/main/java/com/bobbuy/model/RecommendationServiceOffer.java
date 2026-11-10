package com.bobbuy.model;

import com.bobbuy.api.response.*;
import com.bobbuy.service.MediaBinaryService;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;

/** A reviewed member service, never a product/SKU, inventory or selling price. */
public record RecommendationServiceOffer(String sourceUrl,String sourceText,String provider,Integer staff,BigDecimal hours,
 BigDecimal originalPrice,BigDecimal price,String currency,Boolean taxIncluded,List<Fee> fees,boolean noExtraFees,
 LocalDate applicationStart,LocalDate applicationEnd,LocalDate serviceStart,LocalDate serviceEnd,
 Map<String,Terms> terms,boolean costsReviewed,boolean windowsReviewed,boolean reviewed,
 @JsonInclude(JsonInclude.Include.NON_NULL) Basis basis,@JsonInclude(JsonInclude.Include.NON_NULL) List<PackageOption> packages) {
 public enum Basis { STAFF_HOURS, TASK_PACKAGES }
 public enum FeeKind { FIXED, CONDITIONAL }
 /** Legacy constructors/JSON retain their original staff-hours shape. */
 public RecommendationServiceOffer(String sourceUrl,String sourceText,String provider,Integer staff,BigDecimal hours,
  BigDecimal originalPrice,BigDecimal price,String currency,Boolean taxIncluded,List<Fee> fees,boolean noExtraFees,
  LocalDate applicationStart,LocalDate applicationEnd,LocalDate serviceStart,LocalDate serviceEnd,
  Map<String,Terms> terms,boolean costsReviewed,boolean windowsReviewed,boolean reviewed){
  this(sourceUrl,sourceText,provider,staff,hours,originalPrice,price,currency,taxIncluded,fees,noExtraFees,applicationStart,applicationEnd,serviceStart,serviceEnd,terms,costsReviewed,windowsReviewed,reviewed,null,null);
 }
 public Basis effectiveBasis(){return basis==null?Basis.STAFF_HOURS:basis;}
 public static final Set<String> LOCALES=Set.of("ja-JP","zh-CN","zh-TW","en-US");
 public record Fee(String key,BigDecimal amount,Map<String,String> descriptions,@JsonInclude(JsonInclude.Include.NON_NULL) FeeKind kind){
  public Fee(String key,BigDecimal amount,Map<String,String> descriptions){this(key,amount,descriptions,null);}
  @JsonAnySetter public void unexpected(String key,Object value){throw invalid();}
 }
 public record PackageText(String name,String scope){
  @JsonAnySetter public void unexpected(String key,Object value){throw invalid();}
 }
 public record PackageOption(String key,Map<String,PackageText> terms,BigDecimal originalPrice,BigDecimal price){
  @JsonAnySetter public void unexpected(String key,Object value){throw invalid();}
 }
 public record Terms(String title,String description,String eligibility,String regions,String restrictions,String cancellation,List<String> benefits){
  @JsonAnySetter public void unexpected(String key,Object value){throw invalid();}
 }
 @JsonAnySetter public void unexpected(String key,Object value){throw invalid();}
 private static ApiException invalid(){return new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.invalid");}
 private static String text(String value,int max){if(value==null||value.isBlank()||value.length()>max)throw invalid();return value.trim();}
 private static BigDecimal number(BigDecimal n,boolean zero){if(n==null||n.signum()<0||(!zero&&n.signum()==0)||n.scale()>6||n.compareTo(new BigDecimal("999999999"))>0)throw invalid();return n.stripTrailingZeros();}
 public RecommendationServiceOffer normalized(){
  String source=text(sourceUrl,4096);try{var u=URI.create(source);if(!"https".equals(u.getScheme())||u.getHost()==null||u.getUserInfo()!=null||u.getFragment()!=null)throw invalid();}catch(IllegalArgumentException e){throw invalid();}
  if(!reviewed||!costsReviewed||!windowsReviewed||!Boolean.TRUE.equals(taxIncluded)||!"JPY".equals(currency))throw invalid();
  boolean tasks=effectiveBasis()==Basis.TASK_PACKAGES;BigDecimal duration=null,current=null,regular=null;List<PackageOption> options=null;
  if(tasks){
   if(staff!=null||hours!=null||price!=null||originalPrice!=null||packages==null||packages.isEmpty()||packages.size()>20)throw invalid();
   var result=new ArrayList<PackageOption>();var packageKeys=new HashSet<String>();
   for(var option:packages){
    if(option==null||option.key()==null||!option.key().matches("[a-z][a-z0-9-]{0,39}")||!packageKeys.add(option.key())||option.terms()==null||!option.terms().keySet().equals(LOCALES))throw invalid();
    var labels=new TreeMap<String,PackageText>();for(String locale:LOCALES){var label=option.terms().get(locale);if(label==null)throw invalid();labels.put(locale,new PackageText(text(label.name(),200),text(label.scope(),6000)));}
    var amount=number(option.price(),true);var original=option.originalPrice()==null?null:number(option.originalPrice(),true);if(original!=null&&original.compareTo(amount)<0)throw invalid();
    result.add(new PackageOption(option.key(),Map.copyOf(labels),original,amount));
   }
   options=List.copyOf(result);
  }else{
   if(staff==null||staff<1||staff>10||packages!=null&&!packages.isEmpty())throw invalid();
   duration=number(hours,false);if(duration.compareTo(new BigDecimal("24"))>0)throw invalid();
   current=number(price,true);regular=originalPrice==null?null:number(originalPrice,true);if(regular!=null&&regular.compareTo(current)<0)throw invalid();
  }
  if(applicationEnd==null||serviceEnd==null||(applicationStart!=null&&applicationStart.isAfter(applicationEnd))||(serviceStart!=null&&serviceStart.isAfter(serviceEnd))||applicationEnd.isAfter(serviceEnd))throw invalid();
  if(fees==null||fees.size()>20||noExtraFees!=fees.isEmpty()||terms==null||!terms.keySet().equals(LOCALES))throw invalid();
  var charges=new ArrayList<Fee>();var keys=new HashSet<String>();
  for(var fee:fees){if(fee==null||fee.key()==null||!fee.key().matches("[a-z][a-z0-9-]{0,39}")||!keys.add(fee.key())||fee.descriptions()==null||!fee.descriptions().keySet().equals(LOCALES))throw invalid();var labels=new TreeMap<String,String>();for(String locale:LOCALES)labels.put(locale,text(fee.descriptions().get(locale),2000));boolean conditional=fee.kind()==FeeKind.CONDITIONAL;if(conditional&&(!tasks||fee.amount()!=null))throw invalid();charges.add(new Fee(fee.key(),conditional?null:number(fee.amount(),true),Map.copyOf(labels),conditional?FeeKind.CONDITIONAL:null));}
  charges.sort(Comparator.comparing(Fee::key));
  var localized=new TreeMap<String,Terms>();for(String locale:LOCALES){var t=terms.get(locale);if(t==null||t.benefits()==null||t.benefits().size()>20)throw invalid();localized.put(locale,new Terms(text(t.title(),200),text(t.description(),20000),text(t.eligibility(),4000),text(t.regions(),4000),text(t.restrictions(),6000),text(t.cancellation(),4000),t.benefits().stream().map(b->text(b,4000)).toList()));}
  return new RecommendationServiceOffer(source,text(sourceText,100000),text(provider,200),staff,duration,regular,current,"JPY",true,List.copyOf(charges),noExtraFees,applicationStart,applicationEnd,serviceStart,serviceEnd,Map.copyOf(localized),true,true,true,tasks?Basis.TASK_PACKAGES:null,options);
 }
 public String sourceKey(){var uri=URI.create(sourceUrl);String identity=uri.normalize().toString();if("outlook.live.com".equalsIgnoreCase(uri.getHost())&&uri.getRawQuery()!=null){for(String part:uri.getRawQuery().split("&")){var kv=part.split("=",2);if(kv.length==2&&"ItemID".equalsIgnoreCase(kv[0]))identity="outlook:"+URLDecoder.decode(kv[1],StandardCharsets.UTF_8);}}return MediaBinaryService.sha(identity.getBytes(StandardCharsets.UTF_8));}
 public String sourceHash(){return MediaBinaryService.sha(sourceText.getBytes(StandardCharsets.UTF_8));}
 public RecommendationServiceOffer publicView(){return new RecommendationServiceOffer(null,null,provider,staff,hours,originalPrice,price,currency,taxIncluded,fees,noExtraFees,applicationStart,applicationEnd,serviceStart,serviceEnd,terms,costsReviewed,windowsReviewed,reviewed,basis,packages);}
 private static String day(LocalDate date){return date==null?"？":date.toString();}
 private static String money(BigDecimal value){return "JPY "+value.toPlainString();}
 public String article(String locale){
  var t=terms.get(locale);String[] labels=switch(locale){case "zh-CN"->new String[]{"服务提供方","资格","人数／小时","服务费（含税）","额外费用","申请期限","服务期限","服务区域","限制","取消／改期","独立会员权益（不可自动叠加）"};case "zh-TW"->new String[]{"服務提供方","資格","人數／小時","服務費（含稅）","額外費用","申請期限","服務期限","服務區域","限制","取消／改期","獨立會員權益（不可自動併用）"};case "en-US"->new String[]{"Provider","Eligibility","Staff / hours","Service fee (tax included)","Additional fees","Application window","Service window","Service area","Restrictions","Cancellation / rescheduling","Separate member benefits (not automatically cumulative)"};default->new String[]{"提供事業者","対象資格","人数／時間","サービス料金（税込）","追加料金","申込期間","提供期間","提供地域","制限事項","取消・日程変更","個別会員特典（自動的に併用不可）"};};
  var paragraphs=new ArrayList<String>();paragraphs.add(t.description());paragraphs.add(labels[0]+": "+provider);paragraphs.add(labels[1]+": "+t.eligibility());if(effectiveBasis()==Basis.TASK_PACKAGES){String caption=switch(locale){case "zh-CN"->"套餐参考价（非实时，含税）";case "zh-TW"->"套餐參考價（非即時，含稅）";case "en-US"->"Reference package price (not live, tax included)";default->"パッケージ参考料金（非リアルタイム・税込）";};for(var option:packages){var label=option.terms().get(locale);paragraphs.add(label.name()+"\n"+label.scope()+"\n"+caption+": "+(option.originalPrice()==null?"":money(option.originalPrice())+" → ")+money(option.price()));}}else{paragraphs.add(labels[2]+": "+staff+" / "+hours.toPlainString());paragraphs.add(labels[3]+": "+(originalPrice==null?"":money(originalPrice)+" → ")+money(price));}
  for(var fee:fees)paragraphs.add(labels[4]+" — "+fee.descriptions().get(locale)+(fee.kind()==FeeKind.CONDITIONAL?"":": "+money(fee.amount())));
  paragraphs.add(labels[5]+": "+day(applicationStart)+" – "+day(applicationEnd));paragraphs.add(labels[6]+": "+day(serviceStart)+" – "+day(serviceEnd));paragraphs.add(labels[7]+": "+t.regions());paragraphs.add(labels[8]+": "+t.restrictions());paragraphs.add(labels[9]+": "+t.cancellation());if(!t.benefits().isEmpty()){paragraphs.add(labels[10]);for(int i=0;i<t.benefits().size();i++)paragraphs.add((i+1)+". "+t.benefits().get(i));}return String.join("\n\n",paragraphs);
 }
}
