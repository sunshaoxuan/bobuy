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
 public ProductSaleService(ProductRepository products,CurrencyRepository currencies){this.products=products;this.currencies=currencies;}
 @jakarta.annotation.PostConstruct
 public void initializeRegistry(){
  for(String code:List.of("JPY","USD","CNY","TWD"))if(!currencies.existsById(code)){
   var c=new CurrencyDefinition();c.code=code;c.symbol=switch(code){case "USD"->"$";case "TWD"->"NT$";default->"¥";};
   c.fractionDigits=java.util.Currency.getInstance(code).getDefaultFractionDigits();c.name=code;c.saleEnabled=code.equals("JPY");currencies.save(c);
  }
 }
 public record Review(@NotNull Long itemId,@NotNull @DecimalMin(value="0",inclusive=false) BigDecimal amount,
  @NotBlank String currency,@NotBlank @Size(max=80) String unit,LocalDate validFrom,LocalDate validThrough,
  @Min(0) long revision,boolean replaceExisting,boolean enabled) {}
 public record Quote(BigDecimal amount,String currency,String unit,long revision) {}
 public List<CurrencyDefinition> currencies(){return currencies.findAll().stream().sorted(Comparator.comparing(c->c.code)).toList();}
 private CurrencyDefinition enabled(String code){return currencies.findById(code).filter(c->c.saleEnabled).orElseThrow(()->invalid("sale.currency_disabled"));}
 public static LocalDate today(){return LocalDate.now(ZoneId.of("Asia/Tokyo"));}
 public void review(RecommendationItem item,Long owner,Review input){
  if(item.productId==null)throw invalid("sale.profile_required");
  var product=products.lockById(item.productId).filter(p->owner.equals(p.getMerchantId())).orElseThrow(()->invalid("sale.profile_required"));
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
  product.setSale(new ProductSale(input.amount(),currency.code,input.unit().trim(),input.validFrom(),input.validThrough(),revision+1,owner,Instant.now(),input.enabled()));
  products.saveAndFlush(product);
 }
 public Optional<Quote> quote(Product product){
  if(product.getVisibilityStatus()!=ProductVisibility.PUBLIC)return Optional.empty();
  var sale=product.getSale();
  if(sale!=null){
   if(!sale.enabled()||sale.amount()==null||sale.amount().signum()<=0||sale.unit()==null||sale.unit().isBlank()
    ||product.getOrderMethod()!=OrderMethod.PRE_ORDER
    ||(sale.validFrom()!=null&&sale.validFrom().isAfter(today()))||(sale.validThrough()!=null&&sale.validThrough().isBefore(today())))return Optional.empty();
   var currency=currencies.findById(sale.currency()).filter(c->c.saleEnabled).orElse(null);
   if(currency==null||sale.amount().stripTrailingZeros().scale()>currency.fractionDigits)return Optional.empty();
   return Optional.of(new Quote(sale.amount(),sale.currency(),sale.unit(),sale.revision()));
  }
  if(RecommendationCatalogService.profile(product)||product.getVisibilityStatus()!=ProductVisibility.PUBLIC
   ||!Double.isFinite(product.getBasePrice())||product.getBasePrice()<=0)return Optional.empty();
  var currency=currencies.findById(product.getCurrency()).filter(c->c.saleEnabled).orElse(null);
  if(currency==null)return Optional.empty();
  return Optional.of(new Quote(BigDecimal.valueOf(product.getBasePrice()),currency.code,"",0));
 }
 private static ApiException invalid(String key){return new ApiException(ErrorCode.INVALID_REQUEST,key);}
}
