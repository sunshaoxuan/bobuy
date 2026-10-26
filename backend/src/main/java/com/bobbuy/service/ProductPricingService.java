package com.bobbuy.service;

import com.bobbuy.api.response.*;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.MerchantScope;
import jakarta.validation.constraints.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

@Service
public class ProductPricingService {
 private final ProductRepository products;
 private final ProductPriceAdjustmentRepository adjustments;
 private final CurrencyRepository currencies;
 private final ProductSaleService sales;
 private final PricingTime time;
 public ProductPricingService(ProductRepository products,ProductPriceAdjustmentRepository adjustments,CurrencyRepository currencies,ProductSaleService sales,PricingTime time){this.products=products;this.adjustments=adjustments;this.currencies=currencies;this.sales=sales;this.time=time;}
 public record Input(@NotBlank String channel,@NotBlank String currency,@NotNull BigDecimal amount,@NotNull Instant startsAt,@NotNull Instant endsAt,@NotNull @Size(max=1000) String sourceNote,@Min(0) long version){}
 public record Action(@Min(0) long version,boolean confirmed){}
 public record Regular(@NotNull BigDecimal amount,@NotBlank String currency,@NotBlank @Size(max=80) String unit,LocalDate validFrom,LocalDate validThrough,@Min(0) long revision,boolean replaceExisting,boolean enabled,boolean confirmed){}
 public record Entry(ProductPriceAdjustment value,String state){}
 public record Sheet(String productId,ProductSale regular,ProductVisibility visibility,OrderMethod orderMethod,Instant now,String timezone,ProductSaleService.Quote effective,List<Entry> history){}
 private ApiException invalid(String key){return new ApiException(ErrorCode.INVALID_REQUEST,key);}
 private Long owner(){var value=MerchantScope.current();if(value==null)throw new ApiException(ErrorCode.FORBIDDEN,"error.auth.forbidden");return value;}
 private Product owned(String id,boolean lock){return (lock?products.lockById(id):products.findById(id)).filter(p->owner().equals(p.getMerchantId())).orElseThrow(()->new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"error.product.not_found"));}
 private ProductPriceAdjustment entry(Product product,Long id,long version){var value=adjustments.findById(id).filter(a->product.getId().equals(a.productId)&&owner().equals(a.merchantId)).orElseThrow(()->new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"error.product.not_found"));if(value.version!=version)throw invalid("pricing.conflict");return value;}
 private void validate(Input input){
  if(!"STOREFRONT".equals(input.channel()))throw invalid("pricing.channel");
  var currency=currencies.findById(input.currency()).orElseThrow(()->invalid("sale.currency_disabled"));
  if(input.amount().signum()<=0||input.amount().compareTo(new BigDecimal("1000000000"))>0||input.amount().stripTrailingZeros().scale()>Math.min(4,currency.fractionDigits)||!input.startsAt().isBefore(input.endsAt())||input.startsAt().getNano()%1000!=0||input.endsAt().getNano()%1000!=0)throw invalid("pricing.invalid");
 }
 private void confirmed(Action action){if(!action.confirmed())throw invalid("pricing.confirm_required");}
 public String state(ProductPriceAdjustment value,Instant now){if(value.status!=ProductPriceAdjustment.Status.APPROVED)return value.status.name();return now.isBefore(value.startsAt)?"SCHEDULED":now.isBefore(value.endsAt)?"ACTIVE":"EXPIRED";}
 private Sheet sheet(Product product){Instant now=time.now();return new Sheet(product.getId(),product.getSale(),product.getVisibilityStatus(),product.getOrderMethod(),now,"Asia/Tokyo",sales.effectiveAt(product,now).orElse(null),adjustments.findByProductIdOrderByCreatedAtDescIdDesc(product.getId()).stream().filter(a->owner().equals(a.merchantId)).map(a->new Entry(a,state(a,now))).toList());}
 @Transactional(readOnly=true) public Sheet get(String id){return sheet(owned(id,false));}
 @Transactional public Sheet draft(String id,Long adjustmentId,Input input){
  var product=owned(id,true);validate(input);var value=adjustmentId==null?new ProductPriceAdjustment():entry(product,adjustmentId,input.version());
  if(value.status!=ProductPriceAdjustment.Status.DRAFT)throw invalid("pricing.immutable");
  Instant now=time.now();if(adjustmentId==null){value.productId=id;value.merchantId=owner();value.createdBy=owner();value.createdAt=now;}
  value.channel=input.channel();value.currency=input.currency();value.amount=input.amount();value.startsAt=input.startsAt();value.endsAt=input.endsAt();value.sourceNote=input.sourceNote().trim();value.updatedBy=owner();value.updatedAt=now;
  adjustments.saveAndFlush(value);return sheet(product);
 }
 @Transactional public Sheet approve(String id,Long adjustmentId,Action action){
  var product=owned(id,true);var value=entry(product,adjustmentId,action.version());confirmed(action);
  if(value.status!=ProductPriceAdjustment.Status.DRAFT)throw invalid("pricing.immutable");
  if(!value.endsAt.isAfter(time.now()))throw invalid("pricing.expired");
  var regular=product.getSale();
  if(regular==null||!regular.enabled()||product.getOrderMethod()!=OrderMethod.PRE_ORDER||regular.amount()==null||regular.amount().signum()<=0||regular.unit()==null||regular.unit().isBlank())throw invalid("pricing.regular_required");
  if(!regular.currency().equals(value.currency)||!currencies.findById(value.currency).map(c->c.saleEnabled).orElse(false))throw invalid("pricing.currency");
  var conflicts=adjustments.findByProductIdOrderByCreatedAtDescIdDesc(id).stream().filter(a->!a.id.equals(value.id)&&a.status==ProductPriceAdjustment.Status.APPROVED&&a.channel.equals(value.channel)&&a.currency.equals(value.currency)&&a.startsAt.isBefore(value.endsAt)&&value.startsAt.isBefore(a.endsAt)).map(a->a.id.toString()).toList();
  if(!conflicts.isEmpty())throw new ApiException(ErrorCode.INVALID_REQUEST,"pricing.overlap_ids",String.join(", ",conflicts));
  value.status=ProductPriceAdjustment.Status.APPROVED;value.unit=regular.unit();value.approvedBy=owner();value.approvedAt=time.now();value.updatedBy=owner();value.updatedAt=time.now();adjustments.saveAndFlush(value);return sheet(product);
 }
 @Transactional public Sheet cancel(String id,Long adjustmentId,Action action){
  var product=owned(id,true);var value=entry(product,adjustmentId,action.version());confirmed(action);
  if(value.status==ProductPriceAdjustment.Status.CANCELLED||(value.status==ProductPriceAdjustment.Status.APPROVED&&!value.endsAt.isAfter(time.now())))throw invalid("pricing.immutable");
  value.status=ProductPriceAdjustment.Status.CANCELLED;value.cancelledBy=owner();value.cancelledAt=time.now();value.updatedBy=owner();value.updatedAt=time.now();adjustments.saveAndFlush(value);return sheet(product);
 }
 @Transactional public Sheet regular(String id,Regular input){
  var product=owned(id,true);if(!input.confirmed())throw invalid("pricing.confirm_required");
  sales.reviewProduct(product,owner(),new ProductSaleService.Review(null,input.amount(),input.currency(),input.unit(),input.validFrom(),input.validThrough(),input.revision(),input.replaceExisting(),input.enabled()));return sheet(product);
 }
}
