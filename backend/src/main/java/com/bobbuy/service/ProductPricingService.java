package com.bobbuy.service;

import com.bobbuy.api.response.*;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.MerchantScope;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductPricingService {
 private final ProductRepository products;private final ProductPriceAdjustmentRepository adjustments;private final CurrencyRepository currencies;private final ProductSaleService sales;private final PricingTime time;private final UserRepository users;private final jakarta.persistence.EntityManager entities;
 public ProductPricingService(ProductRepository p,ProductPriceAdjustmentRepository a,CurrencyRepository c,ProductSaleService s,PricingTime t,UserRepository u,jakarta.persistence.EntityManager e){products=p;adjustments=a;currencies=c;sales=s;time=t;users=u;entities=e;}
 public record Input(@NotBlank String channel,@NotBlank String currency,@NotNull BigDecimal amount,@NotNull Instant startsAt,Instant endsAt,@NotBlank @Size(max=1000) String sourceNote,@Min(0) long version,@NotNull ProductPriceAdjustment.Type type,String unit,BigDecimal beforeAmount){}
 public record LineInput(@NotBlank String productId,@NotNull BigDecimal amount,@NotBlank @Size(max=100) String unit,BigDecimal beforeAmount){}
 public record DocumentInput(@NotBlank String channel,@NotBlank String currency,@NotNull ProductPriceAdjustment.Type type,Instant startsAt,Instant endsAt,@NotBlank @Size(max=1000) String reason,@NotEmpty @Size(max=200) List<@Valid LineInput> lines,@Min(0) long version){}
 public record Action(@Min(0) long version,boolean confirmed,@Size(max=1000) String reason){}
 public record Regular(@NotNull BigDecimal amount,@NotBlank String currency,@NotBlank @Size(max=80) String unit,LocalDate validFrom,LocalDate validThrough,@Min(0) long revision,boolean replaceExisting,boolean enabled,boolean confirmed,@NotBlank @Size(max=1000) String reason){}
 public record Entry(ProductPriceAdjustment value,String state){}
 public record ProductOption(String id,String itemNumber,Map<String,String> name,String currency,String unit){}
 public record Sheet(String productId,ProductSale regular,ProductVisibility visibility,OrderMethod orderMethod,Instant now,String timezone,ProductSaleService.Quote effective,List<Entry> history){}
 private ApiException invalid(String key){return new ApiException(ErrorCode.INVALID_REQUEST,key);}
 private Long owner(){Long id=MerchantScope.current();if(id==null)throw new ApiException(ErrorCode.FORBIDDEN,"error.auth.forbidden");return id;}
 private void lockOwner(){users.lockById(owner()).orElseThrow(()->invalid("pricing.invalid"));}
 private Product owned(String id,boolean lock){return (lock?products.lockById(id):products.findById(id)).filter(p->owner().equals(p.getMerchantId())&&!p.isDeleted()).orElseThrow(()->new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"error.product.not_found"));}
 private ProductPriceAdjustment ownedDocument(Long id,long version){var d=adjustments.findById(id).filter(v->owner().equals(v.merchantId)).orElseThrow(()->invalid("pricing.invalid"));if(d.version!=version)throw invalid("pricing.conflict");return d;}
 public String state(ProductPriceAdjustment d,Instant now){if(d.status!=ProductPriceAdjustment.Status.APPROVED)return d.status.name();if(d.startsAt==null)return "DRAFT";return now.isBefore(d.startsAt)?"SCHEDULED":d.endsAt==null||now.isBefore(d.endsAt)?"ACTIVE":"EXPIRED";}
 private Sheet sheet(Product p){Instant now=time.now();return new Sheet(p.getId(),sales.currentRegular(p),p.getVisibilityStatus(),p.getOrderMethod(),now,"Asia/Tokyo",sales.effectiveAt(p,now).orElse(null),adjustments.findByProductIdOrderByCreatedAtDescIdDesc(p.getId()).stream().filter(d->owner().equals(d.merchantId)).map(d->new Entry(d,state(d,now))).toList());}
 @Transactional(readOnly=true) public Sheet get(String id){return sheet(owned(id,false));}
 @Transactional(readOnly=true) public List<Entry> documents(){return adjustments.findByMerchantIdOrderByCreatedAtDescIdDesc(owner()).stream().map(d->new Entry(d,state(d,time.now()))).toList();}
 @Transactional(readOnly=true) public List<ProductOption> documentProducts(){return products.findAll().stream().filter(p->owner().equals(p.getMerchantId())&&!p.isDeleted()).map(p->new ProductOption(p.getId(),p.getItemNumber(),Map.copyOf(p.getName()),p.getCurrency(),p.getSale()==null?null:p.getSale().unit())).toList();}
 private void validate(DocumentInput input){
  if(input==null||input.type()==null||input.reason()==null||input.reason().isBlank()||input.reason().length()>1000)throw invalid("pricing.reason_required");
  if(!Set.of("STOREFRONT","COSTCO_WAREHOUSE","COSTCO_ONLINE").contains(input.channel()))throw invalid("pricing.channel");
  var currency=currencies.findById(input.currency()).orElseThrow(()->invalid("sale.currency_disabled"));
  if(input.startsAt()!=null&&input.startsAt().getNano()%1000!=0||input.endsAt()!=null&&input.endsAt().getNano()%1000!=0)throw invalid("pricing.invalid");
  if(input.lines()==null||input.lines().isEmpty()||input.lines().size()>200||input.lines().stream().map(LineInput::productId).distinct().count()!=input.lines().size())throw invalid("pricing.invalid");
  if(input.startsAt()!=null&&input.endsAt()!=null&&!input.startsAt().isBefore(input.endsAt())||input.type()==ProductPriceAdjustment.Type.PERMANENT&&input.endsAt()!=null)throw invalid("pricing.invalid");
  for(var line:input.lines())if(line.amount()==null||line.amount().signum()<=0||line.amount().compareTo(new BigDecimal("1000000000"))>0||line.amount().stripTrailingZeros().scale()>(input.channel().equals("STOREFRONT")?currency.fractionDigits:2)||line.unit()==null||line.unit().isBlank()||line.unit().length()>100||line.beforeAmount()!=null&&line.beforeAmount().signum()<=0)throw invalid("pricing.invalid");
 }
 @Transactional public Entry saveDocument(Long id,DocumentInput input){
  validate(input);lockOwner();var d=id==null?new ProductPriceAdjustment():ownedDocument(id,input.version());if(d.status!=ProductPriceAdjustment.Status.DRAFT)throw invalid("pricing.immutable");
  var locked=new HashMap<String,Product>();input.lines().stream().map(LineInput::productId).sorted().forEach(key->locked.put(key,owned(key,true)));
  if(id==null){d.merchantId=owner();d.createdBy=owner();d.createdAt=time.now();d.documentNumber="PC-"+UUID.randomUUID();}
  if(Boolean.TRUE.equals(d.evidence.get("reviewRequired"))&&Objects.equals(d.sourceNote,input.reason().trim()))throw invalid("pricing.reason_required");
  d.channel=input.channel();d.currency=input.currency();d.type=input.type();d.startsAt=input.startsAt();d.endsAt=input.endsAt();d.sourceNote=input.reason().trim();d.updatedBy=owner();d.updatedAt=time.now();d.evidence.put("reviewRequired",false);
  var unresolved=d.lines.size()==1&&d.lines.get(0).referenceItemId!=null&&d.lines.get(0).productId==null?d.lines.get(0):null;
  if(unresolved!=null){if(input.lines().size()!=1||d.evidence.get("sourceItemNumber")!=null&&!Objects.equals(d.evidence.get("sourceItemNumber"),locked.get(input.lines().get(0).productId()).getItemNumber()))throw invalid("pricing.invalid");}
  else if(d.lines.stream().anyMatch(l->l.referenceItemId!=null)&&!new HashSet<>(d.lines.stream().map(l->l.productId).toList()).equals(locked.keySet()))throw invalid("pricing.immutable");
  var old=new HashMap<String,ProductPriceAdjustmentLine>();d.lines.forEach(l->old.put(l.productId,l));d.lines.clear();
  for(var inputLine:input.lines()){var line=unresolved!=null?unresolved:old.getOrDefault(inputLine.productId(),new ProductPriceAdjustmentLine());line.document=d;line.productId=inputLine.productId();line.amount=inputLine.amount();line.beforeAmount=inputLine.beforeAmount();line.unit=inputLine.unit().trim();d.lines.add(line);}
  adjustments.saveAndFlush(d);if(id!=null)entities.lock(d,jakarta.persistence.LockModeType.PESSIMISTIC_FORCE_INCREMENT);return new Entry(d,state(d,time.now()));
 }
 @Transactional public Entry act(Long id,Action action,boolean approve){
  lockOwner();var d=ownedDocument(id,action.version());if(!action.confirmed())throw invalid("pricing.confirm_required");
  var locked=new TreeMap<String,Product>();d.lines.stream().map(l->l.productId).filter(Objects::nonNull).sorted().forEach(key->locked.put(key,owned(key,true)));
  if(approve){
   if(d.status!=ProductPriceAdjustment.Status.DRAFT)throw invalid("pricing.immutable");
   if(d.sourceNote==null||d.sourceNote.isBlank()||Boolean.TRUE.equals(d.evidence.get("reviewRequired")))throw invalid("pricing.reason_required");
   if(!Set.of("STOREFRONT","COSTCO_WAREHOUSE","COSTCO_ONLINE").contains(d.channel))throw invalid("pricing.channel");
   if(d.startsAt==null||d.type!=ProductPriceAdjustment.Type.PERMANENT&&(d.endsAt==null||!d.startsAt.isBefore(d.endsAt))||d.type==ProductPriceAdjustment.Type.PERMANENT&&d.endsAt!=null||d.endsAt!=null&&!d.endsAt.isAfter(time.now())||d.lines.isEmpty()||d.lines.size()!=locked.size())throw invalid("pricing.invalid");
   for(var line:d.lines){
    var p=locked.get(line.productId);if(line.amount==null||line.amount.signum()<=0||line.amount.compareTo(new BigDecimal("1000000000"))>0||line.unit==null||line.unit.isBlank()||d.evidence.get("sourceItemNumber")!=null&&!Objects.equals(d.evidence.get("sourceItemNumber"),p.getItemNumber()))throw invalid("pricing.invalid");
    var rows=adjustments.findByProductIdOrderByCreatedAtDescIdDesc(line.productId);
    if(rows.stream().anyMatch(a->!a.id.equals(d.id)&&a.status==ProductPriceAdjustment.Status.APPROVED&&a.channel.equals(d.channel)&&a.currency.equals(d.currency)&&Objects.equals(a.line(p.getId()).unit,line.unit)&&
      (a.type==ProductPriceAdjustment.Type.PERMANENT&&d.type==ProductPriceAdjustment.Type.PERMANENT?Objects.equals(a.startsAt,d.startsAt):a.type!=ProductPriceAdjustment.Type.PERMANENT&&d.type!=ProductPriceAdjustment.Type.PERMANENT&&a.startsAt.isBefore(d.endsAt)&&d.startsAt.isBefore(a.endsAt))))throw invalid("pricing.overlap");
    if(d.channel.equals("STOREFRONT")){
     var regular=p.getSale();if(regular==null||!regular.enabled()||p.getOrderMethod()!=OrderMethod.PRE_ORDER||!regular.currency().equals(d.currency)||!regular.unit().equals(line.unit)||!currencies.findById(d.currency).map(c->c.saleEnabled).orElse(false))throw invalid("pricing.regular_required");
     var at=PriceAdjustmentResolver.resolve(rows,p.getId(),owner(),d.channel,d.currency,line.unit,regular.amount(),d.startsAt);line.beforeAmount=at.regular();
    }
    if(d.type==ProductPriceAdjustment.Type.PROMOTION&&(line.beforeAmount==null||line.amount.compareTo(line.beforeAmount)>=0))throw invalid("pricing.promotion_reduction");
   }
   d.status=ProductPriceAdjustment.Status.APPROVED;d.approvedBy=owner();d.approvedAt=time.now();
  }else{
   if(d.status==ProductPriceAdjustment.Status.CANCELLED||d.status==ProductPriceAdjustment.Status.APPROVED&&d.type==ProductPriceAdjustment.Type.PERMANENT&&!time.now().isBefore(d.startsAt)||d.endsAt!=null&&!time.now().isBefore(d.endsAt))throw invalid("pricing.immutable");
   if(action.reason()==null||action.reason().isBlank())throw invalid("pricing.reason_required");
   d.status=ProductPriceAdjustment.Status.CANCELLED;d.cancelledBy=owner();d.cancelledAt=time.now();d.cancellationReason=action.reason().trim();
  }
  d.updatedBy=owner();d.updatedAt=time.now();adjustments.saveAndFlush(d);return new Entry(d,state(d,time.now()));
 }
 @Transactional public Sheet draft(String productId,Long id,Input i){var p=owned(productId,false);String unit=i.unit()==null&&p.getSale()!=null?p.getSale().unit():i.unit();saveDocument(id,new DocumentInput(i.channel(),i.currency(),i.type(),i.startsAt(),i.endsAt(),i.sourceNote(),List.of(new LineInput(productId,i.amount(),unit,i.beforeAmount())),i.version()));return sheet(owned(productId,false));}
 @Transactional public Sheet approve(String productId,Long id,Action action){owned(productId,false);if(ownedDocument(id,action.version()).line(productId)==null)throw invalid("pricing.invalid");act(id,action,true);return sheet(owned(productId,false));}
 @Transactional public Sheet cancel(String productId,Long id,Action action){owned(productId,false);if(ownedDocument(id,action.version()).line(productId)==null)throw invalid("pricing.invalid");act(id,action,false);return sheet(owned(productId,false));}
 @Transactional public Sheet regular(String id,Regular input){lockOwner();var p=owned(id,true);if(!input.confirmed())throw invalid("pricing.confirm_required");sales.reviewProduct(p,owner(),new ProductSaleService.Review(null,input.amount(),input.currency(),input.unit(),input.validFrom(),input.validThrough(),input.revision(),input.replaceExisting(),input.enabled(),input.reason()));return sheet(p);}
 public record UnitCorrection(@Min(0) long revision,@NotNull BigDecimal amount,@NotBlank String currency,@NotBlank @Size(max=80) String unit,@NotNull Map<Long,Long> documents,boolean confirmed,@NotBlank @Size(max=1000) String reason){}
 private List<ProductPriceAdjustment> unitDocuments(Product p,Instant now){return adjustments.findByProductIdOrderByCreatedAtDescIdDesc(p.getId()).stream().filter(d->owner().equals(d.merchantId)&&d.channel.equals("STOREFRONT")&&d.status==ProductPriceAdjustment.Status.APPROVED&&(d.endsAt==null||now.isBefore(d.endsAt))).sorted(Comparator.comparing(d->d.id)).toList();}
 @Transactional public Sheet correctUnit(String id,UnitCorrection input){
  lockOwner();var p=owned(id,true);var prior=p.getSale();var now=time.now();
  if(!input.confirmed())throw invalid("pricing.confirm_required");
  if(prior==null||prior.revision()!=input.revision())throw invalid("sale.conflict");
  if(!prior.currency().equals(input.currency())||sales.currentRegular(p).amount().compareTo(input.amount())!=0||prior.unit().equals(input.unit().trim()))throw invalid("pricing.unit_only");
  var rows=unitDocuments(p,now);var versions=new TreeMap<Long,Long>();rows.forEach(d->versions.put(d.id,d.version));
  if(!versions.equals(input.documents()))throw invalid("pricing.conflict");
  // This narrow correction must never silently change other products or currencies.
  if(rows.stream().anyMatch(d->d.lines.size()!=1||!d.currency.equals(prior.currency())||!d.line(id).unit.equals(prior.unit())))throw invalid("pricing.unit_scope");
  for(var original:rows){
   var replacement=new ProductPriceAdjustment();replacement.merchantId=owner();replacement.channel=original.channel;replacement.currency=original.currency;replacement.type=original.type;replacement.startsAt=original.startsAt;replacement.endsAt=original.endsAt;replacement.status=ProductPriceAdjustment.Status.APPROVED;replacement.documentNumber="PC-"+UUID.randomUUID();replacement.sourceNote=input.reason().trim();replacement.createdBy=owner();replacement.updatedBy=owner();replacement.approvedBy=owner();replacement.createdAt=now;replacement.updatedAt=now;replacement.approvedAt=now;
   replacement.evidence.putAll(original.evidence);replacement.evidence.remove("supersededBy");replacement.evidence.put("unitCorrectionOf",original.id);replacement.evidence.put("originalUnit",prior.unit());
   var line=new ProductPriceAdjustmentLine();line.document=replacement;line.productId=id;line.amount=original.line(id).amount;line.beforeAmount=original.line(id).beforeAmount;line.unit=input.unit().trim();line.referenceItemId=original.line(id).referenceItemId;replacement.lines.add(line);adjustments.saveAndFlush(replacement);
   original.status=ProductPriceAdjustment.Status.CANCELLED;original.cancelledBy=owner();original.cancelledAt=now;original.cancellationReason=input.reason().trim();original.updatedBy=owner();original.updatedAt=now;original.evidence.put("supersededBy",replacement.id);adjustments.saveAndFlush(original);
  }
  // With no documents, retain an explicit audit record instead of silently changing the sale JSON.
  if(rows.isEmpty()){
   var d=new ProductPriceAdjustment();d.merchantId=owner();d.currency=prior.currency();d.type=ProductPriceAdjustment.Type.PERMANENT;d.startsAt=now;d.status=ProductPriceAdjustment.Status.APPROVED;d.documentNumber="PC-"+UUID.randomUUID();d.sourceNote=input.reason().trim();d.createdBy=owner();d.updatedBy=owner();d.approvedBy=owner();d.createdAt=now;d.updatedAt=now;d.approvedAt=now;d.evidence.put("originalUnit",prior.unit());
   var l=new ProductPriceAdjustmentLine();l.document=d;l.productId=id;l.amount=prior.amount();l.beforeAmount=prior.amount();l.unit=input.unit().trim();d.lines.add(l);adjustments.saveAndFlush(d);
  }
  p.setSale(new ProductSale(prior.amount(),prior.currency(),input.unit().trim(),prior.validFrom(),prior.validThrough(),prior.revision()+1,owner(),now,prior.enabled()));products.saveAndFlush(p);return sheet(p);
 }
 public record CancellationImpact(String productId,BigDecimal regularAfter,BigDecimal amountAfter,String currency,String unit){}
 public record CancellationPreview(long version,String token,List<CancellationImpact> impacts){}
 public record ReviewedCancellation(@Min(0) long version,@NotBlank String token,boolean confirmed,@NotBlank @Size(max=1000) String reason){}
 private BigDecimal cancellationBase(Product p,ProductPriceAdjustment d,List<ProductPriceAdjustment> remaining,Instant now){
  var sale=p.getSale();if(sale==null||!d.channel.equals("STOREFRONT")||!d.currency.equals(sale.currency())||!Objects.equals(d.line(p.getId()).unit,sale.unit()))return null;
  if(d.type!=ProductPriceAdjustment.Type.PERMANENT||!PriceAdjustmentResolver.approvedAt(d,now))return sale.amount();
  var previous=remaining.stream().filter(a->a.type==ProductPriceAdjustment.Type.PERMANENT&&a.channel.equals(d.channel)&&a.currency.equals(d.currency)&&Objects.equals(a.line(p.getId()).unit,sale.unit())&&PriceAdjustmentResolver.approvedAt(a,now)).max(Comparator.comparing((ProductPriceAdjustment a)->a.startsAt).thenComparing(a->a.id)).orElse(null);
  if(previous!=null)return previous.line(p.getId()).amount;
  // Regular confirmation also writes ProductSale; its value is not independent rollback evidence.
  if(sale.amount().compareTo(d.line(p.getId()).amount)==0)throw invalid("pricing.cancel_no_prior");
  return sale.amount();
 }
 private CancellationPreview cancellationPreview(ProductPriceAdjustment d,boolean lock){
  var now=time.now();if(d.status==ProductPriceAdjustment.Status.CANCELLED||d.endsAt!=null&&!now.isBefore(d.endsAt))throw invalid("pricing.immutable");
  var impacts=new ArrayList<CancellationImpact>();var fingerprint=new StringBuilder(d.id+":"+d.version);
  for(var line:d.lines.stream().sorted(Comparator.comparing(l->l.productId,Comparator.nullsFirst(Comparator.naturalOrder()))).toList()){
   if(line.productId==null)continue;var p=owned(line.productId,lock);var rows=adjustments.findByProductIdOrderByCreatedAtDescIdDesc(p.getId());var remaining=rows.stream().filter(a->!a.id.equals(d.id)).toList();var base=cancellationBase(p,d,remaining,now);
   var resolved=PriceAdjustmentResolver.resolve(remaining,p.getId(),owner(),d.channel,d.currency,line.unit,base,now);
   impacts.add(new CancellationImpact(p.getId(),resolved.regular(),resolved.amount(),d.currency,line.unit));
   fingerprint.append('|').append(p.getId()).append(':').append(p.getRecordVersion()).append(':').append(state(d,now));
   for(var row:rows)fingerprint.append('|').append(row.id).append(':').append(row.version).append(':').append(state(row,now));
  }
  fingerprint.append(impacts);
  try{return new CancellationPreview(d.version,HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(fingerprint.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8))),List.copyOf(impacts));}catch(java.security.NoSuchAlgorithmException e){throw new IllegalStateException(e);}
 }
 @Transactional(readOnly=true) public CancellationPreview previewCancellation(Long id){return cancellationPreview(adjustments.findById(id).filter(d->owner().equals(d.merchantId)).orElseThrow(()->invalid("pricing.invalid")),false);}
 @Transactional public Entry cancelReviewed(Long id,ReviewedCancellation input){
  lockOwner();var d=ownedDocument(id,input.version());if(!input.confirmed())throw invalid("pricing.confirm_required");var preview=cancellationPreview(d,true);if(!preview.token().equals(input.token()))throw invalid("pricing.conflict");var now=time.now();
  if(d.status==ProductPriceAdjustment.Status.APPROVED&&d.type==ProductPriceAdjustment.Type.PERMANENT&&PriceAdjustmentResolver.approvedAt(d,now)&&d.channel.equals("STOREFRONT"))for(var impact:preview.impacts()){
   var p=owned(impact.productId(),true);var sale=p.getSale();if(sale!=null&&sale.currency().equals(impact.currency())&&sale.unit().equals(impact.unit())&&impact.regularAfter()!=null){p.setSale(new ProductSale(impact.regularAfter(),sale.currency(),sale.unit(),sale.validFrom(),sale.validThrough(),sale.revision()+1,owner(),now,sale.enabled()));products.saveAndFlush(p);}
  }
  d.status=ProductPriceAdjustment.Status.CANCELLED;d.cancelledBy=owner();d.cancelledAt=now;d.cancellationReason=input.reason().trim();d.updatedBy=owner();d.updatedAt=now;d.evidence.put("cancellationPreview",input.token());adjustments.saveAndFlush(d);return new Entry(d,state(d,now));
 }

}
