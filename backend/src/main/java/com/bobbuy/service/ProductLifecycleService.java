package com.bobbuy.service;

import com.bobbuy.api.response.*;
import com.bobbuy.repository.ProductRepository;
import com.bobbuy.security.MerchantScope;
import com.fasterxml.jackson.databind.*;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The only deliberate read of deleted rows; protected by existing platform-admin identity. */
@Service
public class ProductLifecycleService {
 private final ProductRepository products; private final JdbcTemplate jdbc;
 private final AuthService auth; private final ObjectMapper json;
 public ProductLifecycleService(ProductRepository products,JdbcTemplate jdbc,AuthService auth,ObjectMapper json){this.products=products;this.jdbc=jdbc;this.auth=auth;this.json=json;}
 public record Row(String id,JsonNode name,String itemNumber,Long merchantId,Instant deletedAt,Long deletedBy,long version,int imageCount,List<Long> recommendationIds){}
 public record Selection(@NotBlank String id,@Min(0) long version){}
 private static ApiException missing(){return new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"error.product.not_found");}
 private Long admin(Authentication authentication){var user=auth.currentUser(authentication);if(!user.platformAdmin())throw new ApiException(ErrorCode.FORBIDDEN,"error.auth.forbidden");return user.id();}
 private JsonNode node(String text){try{JsonNode value=json.readTree(text==null?"null":text);return value.isTextual()?json.readTree(value.asText()):value;}catch(Exception error){throw new IllegalStateException("Invalid stored product JSON",error);}}
 @Transactional(readOnly=true)
 public List<Row> list(Authentication authentication,boolean deleted){
  admin(authentication);
  return jdbc.query("select id,name,item_number,merchant_id,deleted_at,deleted_by,coalesce(record_version,0) as version,media_gallery from bb_product where deleted_at is "+(deleted?"not null":"null")+" order by id",(rs,index)->{
   var time=rs.getTimestamp("deleted_at");var gallery=node(rs.getString("media_gallery"));
   return new Row(rs.getString("id"),node(rs.getString("name")),rs.getString("item_number"),rs.getObject("merchant_id",Long.class),time==null?null:time.toInstant(),rs.getObject("deleted_by",Long.class),rs.getLong("version"),gallery.isArray()?gallery.size():0,
    jdbc.queryForList("select id from bb_recommendation_item where product_id=? order by id",Long.class,rs.getString("id")));
  });
 }
 private void event(String id,String action,Long actor){jdbc.update("insert into bb_product_lifecycle_event(id,product_id,action,actor_id,occurred_at) values(?,?,?,?,?)",UUID.randomUUID().toString(),id,action,actor,java.sql.Timestamp.from(Instant.now()));}
 @Transactional
 public boolean deleteOwned(String id){
  var product=products.lockById(id).filter(p->MerchantScope.current()!=null&&MerchantScope.current().equals(p.getMerchantId())).orElse(null);
  if(product==null||product.isDeleted())return false;
  product.setDeletedAt(Instant.now());product.setDeletedBy(MerchantScope.current());products.saveAndFlush(product);event(id,"DELETE",MerchantScope.current());return true;
 }
 @Transactional
 public void deleteReviewed(Authentication authentication,List<Selection> rows){
  Long actor=admin(authentication);validate(rows);
  for(var row:rows.stream().sorted(Comparator.comparing(Selection::id)).toList()){
   var product=products.lockById(row.id()).orElseThrow(ProductLifecycleService::missing);
   if(product.isDeleted()||!Objects.equals(product.getRecordVersion(),row.version()))throw new ApiException(ErrorCode.INVALID_REQUEST,"master.conflict");
   // This batch is intentionally limited to the visible no-product-image cleanup.
   if(!product.getMediaGallery().isEmpty())throw new ApiException(ErrorCode.INVALID_REQUEST,"trash.has_images");
   product.setDeletedAt(Instant.now());product.setDeletedBy(actor);products.saveAndFlush(product);event(row.id(),"DELETE",actor);
  }
 }
 @Transactional
 public void restore(Authentication authentication,Selection row){
  Long actor=admin(authentication);validate(List.of(row));
  int updated=jdbc.update("update bb_product set deleted_at=null,deleted_by=null,record_version=coalesce(record_version,0)+1 where id=? and deleted_at is not null and coalesce(record_version,0)=?",row.id(),row.version());
  if(updated!=1)throw new ApiException(ErrorCode.INVALID_REQUEST,"master.conflict");event(row.id(),"RESTORE",actor);
 }
 private void validate(List<Selection> rows){if(rows==null||rows.isEmpty()||rows.size()>200||rows.stream().anyMatch(r->r==null||r.id()==null||r.id().isBlank()||r.version()<0)||rows.stream().map(Selection::id).distinct().count()!=rows.size())throw new ApiException(ErrorCode.INVALID_REQUEST,"master.invalid");}
}
