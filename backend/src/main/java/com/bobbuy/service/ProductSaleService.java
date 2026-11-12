package com.bobbuy.service;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.api.response.*;
import java.math.*;
import java.time.*;
import java.util.*;
import jakarta.validation.constraints.*;
import org.springframework.stereotype.Service;

@Service
public class ProductSaleService {
 private final ProductRepository products;
 private final CurrencyRepository currencies;
 private final ProductPriceAdjustmentRepository adjustments;
 private final PricingTime time;
 public ProductSaleService(ProductRepository products,CurrencyRepository currencies,ProductPriceAdjustmentRepository adjustments,PricingTime time){this.products=products;this.currencies=currencies;this.adjustments=adjustments;this.time=time;}
 @jakarta.annotation.PostConstruct
 public void initializeRegistry(){
  for(String code:List.of("JPY","USD","CNY","TWD"))if(!currencies.existsById(code)){
   var c=new CurrencyDefinition();c.code=code;c.symbol=switch(code){case "USD"->"$";case "TWD"->"NT$";default->"¥";};
   c.fractionDigits=java.util.Currency.getInstance(code).getDefaultFractionDigits();c.name=code;c.saleEnabled=code.equals("JPY");currencies.save(c);
  }
 }
 public record Review(@NotNull Long itemId,@NotNull @DecimalMin(value="0",inclusive=false) BigDecimal amount,
  @NotBlank String currency,@NotBlank @Size(max=80) String unit,LocalDate validFrom,LocalDate validThrough,
  @Min(0) long revision,boolean replaceExisting,boolean enabled,@NotBlank @Size(max=1000) String reason) {}
 public record Quote(BigDecimal amount,String currency,String unit,long revision,String priceToken,
  BigDecimal regularAmount,Long adjustmentId,Instant validFrom,Instant validUntil,String channel) {}
 public List<CurrencyDefinition> currencies(){return currencies.findAll().stream().sorted(Comparator.comparing(c->c.code)).toList();}
 private CurrencyDefinition enabled(String code){return currencies.findById(code).filter(c->c.saleEnabled).orElseThrow(()->invalid("sale.currency_disabled"));}
 public static LocalDate today(){return LocalDate.now(ZoneId.of("Asia/Tokyo"));}
 public Instant now(){return time.now();}
 public ProductSale currentRegular(Product product){var sale=product.getSale();if(sale==null)return null;var price=PriceAdjustmentResolver.resolve(adjustments.findByProductIdOrderByCreatedAtDescIdDesc(product.getId()),product.getId(),product.getMerchantId(),"STOREFRONT",sale.currency(),sale.unit(),sale.amount(),time.now());return new ProductSale(price.regular(),sale.currency(),sale.unit(),sale.validFrom(),sale.validThrough(),sale.revision(),sale.reviewedBy(),sale.reviewedAt(),sale.enabled());}
 public void review(RecommendationItem item,Long owner,Review input){
  if(item.productId==null)throw invalid("sale.profile_required");
  var product=products.lockById(item.productId).filter(p->owner.equals(p.getMerchantId())).orElseThrow(()->invalid("sale.profile_required"));
  reviewProduct(product,owner,input);
 }
 public void reviewProduct(Product product,Long owner,Review input){
  var prior=product.getSale();
  long revision=prior==null?0:prior.revision();
  if(revision!=input.revision())throw invalid("sale.conflict");
  // Existing prices/stock are never silently overwritten by linking or import.
  if((prior!=null||(!RecommendationCatalogService.profile(product)&&product.getBasePrice()>0))&&!input.replaceExisting())throw invalid("sale.replace_required");
  var currency=enabled(input.currency());
  if(input.amount()==null||input.amount().signum()<=0||input.amount().compareTo(new BigDecimal("1000000000"))>0
   ||input.amount().stripTrailingZeros().scale()>currency.fractionDigits||input.unit()==null||input.unit().isBlank())throw invalid("sale.invalid");
  if(input.validFrom()!=null&&input.validThrough()!=null&&input.validFrom().isAfter(input.validThrough()))throw invalid("sale.invalid");
  if(input.enabled()&&input.validThrough()!=null&&input.validThrough().isBefore(today()))throw invalid("sale.expired");
  // The visible operator confirmation explicitly selects pre-order fulfillment;
  // existing direct-buy products require their inventory workflow instead.
  if(product.getOrderMethod()!=OrderMethod.PRE_ORDER)throw invalid("sale.preorder_required");
  if(input.reason()==null||input.reason().isBlank()||input.reason().length()>1000)throw invalid("pricing.reason_required");
  if(adjustments.findByProductIdOrderByCreatedAtDescIdDesc(product.getId()).stream().anyMatch(a->Objects.equals(a.merchantId,owner)&&a.channel.equals("STOREFRONT")&&a.status==ProductPriceAdjustment.Status.APPROVED&&(a.endsAt==null||a.endsAt.isAfter(time.now()))&&(!a.currency.equals(input.currency())||!Objects.equals(a.line(product.getId()).unit,input.unit().trim()))))throw invalid("pricing.regular_conflict");
  var document=new ProductPriceAdjustment();document.merchantId=owner;document.channel="STOREFRONT";document.currency=currency.code;document.type=ProductPriceAdjustment.Type.PERMANENT;document.startsAt=time.now();document.status=ProductPriceAdjustment.Status.APPROVED;document.sourceNote=input.reason().trim();document.createdBy=owner;document.updatedBy=owner;document.approvedBy=owner;document.createdAt=time.now();document.updatedAt=time.now();document.approvedAt=time.now();document.documentNumber="PC-"+UUID.randomUUID();
  var line=new ProductPriceAdjustmentLine();line.document=document;line.productId=product.getId();line.amount=input.amount();line.beforeAmount=prior==null?null:currentRegular(product).amount();line.unit=input.unit().trim();document.lines.add(line);adjustments.saveAndFlush(document);
  product.setSale(new ProductSale(input.amount(),currency.code,input.unit().trim(),input.validFrom(),input.validThrough(),revision+1,owner,Instant.now(),input.enabled()));
  products.saveAndFlush(product);
 }
 public Optional<Quote> quote(Product product){
  return quoteAt(product,time.now());
 }
 public Optional<Quote> quoteAt(Product product,Instant now){
  if(product.isDeleted()||product.getVisibilityStatus()!=ProductVisibility.PUBLIC)return Optional.empty();
  return effectiveAt(product,now);
 }
 public Optional<Quote> effectiveAt(Product product,Instant now){
  var sale=product.getSale();
  BigDecimal regular;String code,unit;long revision;
  LocalDate date=now.atZone(ZoneId.of("Asia/Tokyo")).toLocalDate();
  if(sale!=null){
   if(!sale.enabled()||sale.amount()==null||sale.amount().signum()<=0||sale.unit()==null||sale.unit().isBlank()
    ||product.getOrderMethod()!=OrderMethod.PRE_ORDER
    ||(sale.validFrom()!=null&&sale.validFrom().isAfter(date))||(sale.validThrough()!=null&&sale.validThrough().isBefore(date)))return Optional.empty();
   var currency=currencies.findById(sale.currency()).filter(c->c.saleEnabled).orElse(null);
   if(currency==null||sale.amount().stripTrailingZeros().scale()>currency.fractionDigits)return Optional.empty();
   regular=sale.amount();code=sale.currency();unit=sale.unit();revision=sale.revision();
  }else{
  if(RecommendationCatalogService.profile(product)
   ||!Double.isFinite(product.getBasePrice())||product.getBasePrice()<=0)return Optional.empty();
  var currency=currencies.findById(product.getCurrency()).filter(c->c.saleEnabled).orElse(null);
  if(currency==null)return Optional.empty();
  regular=BigDecimal.valueOf(product.getBasePrice());code=currency.code;unit="";revision=0;
  }
  String currency=code;
  var resolved=PriceAdjustmentResolver.resolve(adjustments.findByProductIdOrderByCreatedAtDescIdDesc(product.getId()),product.getId(),product.getMerchantId(),"STOREFRONT",currency,unit,regular,now);
  regular=resolved.regular();var adjustment=resolved.document();BigDecimal amount=resolved.amount();
  String identity=product.getId()+"|STOREFRONT|"+code+"|"+unit+"|"+regular.stripTrailingZeros().toPlainString()+"|"+amount.stripTrailingZeros().toPlainString()+"|"+revision+"|"+(adjustment==null?"regular":adjustment.id+":"+adjustment.version);
  String token;
  try{token=HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(identity.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}catch(java.security.NoSuchAlgorithmException error){throw new IllegalStateException(error);}
  Instant nextChange=resolved.nextChange();
  if(sale!=null&&sale.validThrough()!=null){Instant saleEnd=sale.validThrough().plusDays(1).atStartOfDay(ZoneId.of("Asia/Tokyo")).toInstant();if(nextChange==null||saleEnd.isBefore(nextChange))nextChange=saleEnd;}
  return Optional.of(new Quote(amount,code,unit,revision,token,regular,adjustment==null?null:adjustment.id,adjustment==null?null:adjustment.startsAt,nextChange,"STOREFRONT"));
 }
 private static ApiException invalid(String key){return new ApiException(ErrorCode.INVALID_REQUEST,key);}
}
