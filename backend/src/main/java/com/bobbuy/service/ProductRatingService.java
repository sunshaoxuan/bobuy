package com.bobbuy.service;

import com.bobbuy.api.response.*;
import com.bobbuy.model.ProductRating;
import com.bobbuy.repository.*;
import com.bobbuy.security.MerchantScope;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductRatingService {
 private final ProductRepository products;private final ProductRatingRepository ratings;
 public ProductRatingService(ProductRepository p,ProductRatingRepository r){products=p;ratings=r;}
 public record Value(BigDecimal stars,boolean publicVisible,long version){}
 public record Input(BigDecimal stars,boolean publicVisible,long version,boolean reviewed){}
 private static ApiException invalid(String key){return new ApiException(ErrorCode.INVALID_REQUEST,key);}
 public static void validate(Input input){
  if(input==null||!input.reviewed()||input.version()<0)throw invalid("rating.review_required");
  var value=input.stars();
  if(value!=null&&(value.signum()<0||value.compareTo(new BigDecimal("5"))>0||value.multiply(new BigDecimal("2")).stripTrailingZeros().scale()>0))throw invalid("rating.invalid");
  if(input.publicVisible()&&value==null)throw invalid("rating.invalid");
 }
 private Long owner(){var owner=MerchantScope.current();if(owner==null)throw new ApiException(ErrorCode.FORBIDDEN,"error.auth.forbidden");return owner;}
 private void owned(String id,boolean lock){var owner=owner();(lock?products.lockById(id):products.findById(id)).filter(p->owner.equals(p.getMerchantId())).orElseThrow(()->new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"error.product.not_found"));}
 private static Value value(ProductRating row){return row==null?new Value(null,false,0):new Value(row.stars,row.publicVisible,row.version);}
 @Transactional(readOnly=true) public Value get(String id){owned(id,false);return value(ratings.findById(id).orElse(null));}
 @Transactional public Value save(String id,Input input){
  validate(input);owned(id,true); // Product row serializes first creation and subsequent writes, including concurrent requests.
  var row=ratings.findById(id).orElse(null);if((row==null?0:row.version)!=input.version())throw invalid("master.conflict");
  if(row==null){row=new ProductRating();row.productId=id;row.merchantId=owner();}
  if(!owner().equals(row.merchantId))throw new ApiException(ErrorCode.FORBIDDEN,"error.auth.forbidden");
  row.stars=input.stars();row.publicVisible=input.publicVisible();row.version++;row.reviewedAt=Instant.now();
  return value(ratings.saveAndFlush(row));
 }
 /** Only explicit public ratings of already-authorized product/owner pairs may leave the service. */
 @Transactional(readOnly=true) public Map<String,BigDecimal> publicRatings(Map<String,Long> visibleOwners){
  if(visibleOwners.isEmpty())return Map.of();var result=new TreeMap<String,BigDecimal>();var eligible=new HashSet<String>();
  for(var p:products.findAllById(visibleOwners.keySet()))if(p.getVisibilityStatus()==com.bobbuy.model.ProductVisibility.PUBLIC&&Objects.equals(p.getMerchantId(),visibleOwners.get(p.getId())))eligible.add(p.getId());
  for(var row:ratings.findAllById(eligible))if(row.publicVisible&&row.stars!=null&&Objects.equals(row.merchantId,visibleOwners.get(row.productId)))result.put(row.productId,row.stars);
  return Collections.unmodifiableMap(result);
 }
}
