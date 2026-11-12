package com.bobbuy.service;
import com.bobbuy.repository.ProductRepository;
import com.bobbuy.model.ProductVisibility;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Service;
@Service
public class PublicBrowsePriceService {
 private final ProductRepository products;private final ProductSaleService sales;
 public PublicBrowsePriceService(ProductRepository products,ProductSaleService sales){this.products=products;this.sales=sales;}
 public record Price(BigDecimal amount,String currency){}
 public Map<String,Price> prices(Collection<String> ids){
  var result=new HashMap<String,Price>();var now=sales.now();
  for(var product:products.findAllById(ids))if(product.getVisibilityStatus()==ProductVisibility.PUBLIC)
   sales.quoteAt(product,now).ifPresent(quote->result.put(product.getId(),new Price(quote.amount(),quote.currency())));
  return result;
 }
}
