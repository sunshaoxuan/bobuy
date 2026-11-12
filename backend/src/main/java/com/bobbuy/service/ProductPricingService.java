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
}
