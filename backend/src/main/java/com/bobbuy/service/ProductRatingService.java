package com.bobbuy.service;
import com.bobbuy.api.response.*;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.BobbuyAuthenticatedUser;
import java.math.*;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** User-authored reviews. Never reads legacy merchant scores. */
@Service
public class ProductRatingService {
 private final ProductRepository products;private final ProductReviewRepository reviews;
 public ProductRatingService(ProductRepository products,ProductReviewRepository reviews){this.products=products;this.reviews=reviews;}
 public record Input(BigDecimal stars,String comment,long version){}
 public record Value(BigDecimal stars,String comment,long version,Instant updatedAt){}
 public record Bucket(BigDecimal stars,long count){}
 public record Summary(BigDecimal average,long count,BigDecimal sum,List<Bucket> distribution){}
 public record Entry(Long id,BigDecimal stars,String comment,Instant updatedAt){}
 public record ReviewPage(List<Entry> items,boolean hasNext){}
 private static ApiException invalid(String key){return new ApiException(ErrorCode.INVALID_REQUEST,key);}
 public static void validate(Input input){
  if(input==null||input.stars()==null||input.version()<0||input.stars().compareTo(BigDecimal.ONE)<0||input.stars().compareTo(new BigDecimal("5"))>0||input.stars().multiply(new BigDecimal("2")).stripTrailingZeros().scale()>0||input.comment()!=null&&input.comment().length()>2000)throw invalid("rating.invalid");
 }
 private Long author(){var auth=SecurityContextHolder.getContext().getAuthentication();if(auth==null||!(auth.getPrincipal() instanceof BobbuyAuthenticatedUser user)||user.id()==null)throw new ApiException(ErrorCode.UNAUTHORIZED,"error.auth.unauthorized");return user.id();}
 private Set<String> reviewableIds(Collection<Product> candidates){
  var result=new HashSet<String>();var references=new ArrayList<String>();
  for(var p:candidates)if(!p.isDeleted()){if(p.getVisibilityStatus()==ProductVisibility.PUBLIC)result.add(p.getId());else if(p.getVisibilityStatus()==ProductVisibility.DRAFTER_ONLY)references.add(p.getId());}
  if(!references.isEmpty())products.publicReviewLinks(references).stream().filter(RecommendationPublication::visible).map(i->i.productId).forEach(result::add);
  return result;
 }
 private Product visible(String id,boolean lock){return (lock?products.lockById(id):products.findById(id)).filter(p->reviewableIds(List.of(p)).contains(id)).orElseThrow(()->new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"error.product.not_found"));}
 private static Value value(ProductReview row){return row==null?new Value(null,"",0,null):new Value(row.stars,row.comment,row.version,row.updatedAt);}
 @Transactional(readOnly=true) public Value get(String id){var user=author();visible(id,false);return value(reviews.findByProductIdAndUserId(id,user).orElse(null));}
 @Transactional public Value save(String id,Input input){
  validate(input);var user=author();visible(id,true);
  var row=reviews.findByProductIdAndUserId(id,user).orElse(null);
  if((row==null?0:row.version)!=input.version())throw new org.springframework.orm.ObjectOptimisticLockingFailureException(ProductReview.class,id);
  var now=Instant.now();if(row==null){row=new ProductReview();row.productId=id;row.userId=user;row.createdAt=now;}
  row.stars=input.stars();row.comment=input.comment()==null?"":input.comment().strip();row.version++;row.updatedAt=now;
  return value(reviews.saveAndFlush(row));
 }
 private Map<String,Summary> aggregates(Collection<String> ids){
  var counts=new TreeMap<String,long[]>();ids.forEach(id->counts.put(id,new long[9]));
  if(!ids.isEmpty())for(var row:reviews.buckets(ids)){var bins=counts.get((String)row[0]);int index=((BigDecimal)row[1]).multiply(new BigDecimal("2")).intValueExact()-2;bins[index]=((Number)row[2]).longValue();}
  var result=new TreeMap<String,Summary>();counts.forEach((id,bins)->{long count=0;BigDecimal sum=BigDecimal.ZERO;var distribution=new ArrayList<Bucket>();for(int i=0;i<9;i++){var stars=BigDecimal.valueOf(i+2).divide(new BigDecimal("2"));count+=bins[i];sum=sum.add(stars.multiply(BigDecimal.valueOf(bins[i])));distribution.add(new Bucket(stars,bins[i]));}result.put(id,new Summary(count==0?null:sum.divide(BigDecimal.valueOf(count),6,RoundingMode.HALF_UP),count,sum,List.copyOf(distribution)));});return result;
 }
 @Transactional(readOnly=true) public Summary summary(String id){visible(id,false);return aggregates(List.of(id)).get(id);}
 @Transactional(readOnly=true) public ReviewPage list(String id,int page){visible(id,false);if(page<0||page>10000)throw invalid("rating.invalid");var rows=reviews.findByProductIdOrderByUpdatedAtDescIdDesc(id,PageRequest.of(page,20));return new ReviewPage(rows.stream().map(r->new Entry(r.id,r.stars,r.comment,r.updatedAt)).toList(),rows.hasNext());}
 @Transactional(readOnly=true) public Map<String,BigDecimal> publicRatings(Map<String,Long> visibleOwners){
  var owned=new ArrayList<Product>();for(var p:products.findAllById(visibleOwners.keySet()))if(Objects.equals(p.getMerchantId(),visibleOwners.get(p.getId())))owned.add(p);
  var ids=new ArrayList<>(reviewableIds(owned));
  var result=new TreeMap<String,BigDecimal>();aggregates(ids).forEach((id,summary)->{if(summary.average()!=null)result.put(id,summary.average());});return Collections.unmodifiableMap(result);
 }
}
