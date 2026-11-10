package com.bobbuy.service;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import java.util.*;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.*;

class ProductIdentityAuditTest {
 @SuppressWarnings("unchecked") private <T>T stub(Class<T> type,java.lang.reflect.InvocationHandler call){return (T)java.lang.reflect.Proxy.newProxyInstance(type.getClassLoader(),new Class[]{type},call);}
 @Test void actualAuditKeepsLegacyStateSeparatesTenantsAndPreservesQuoteWindows(){
  var owned=new Product();owned.setId("owned");owned.setMerchantId(1000L);owned.setName(Map.of("ja-JP","Old full name"));owned.setRecordVersion(4L);owned.setItemNumber("ITEM-A");
  var foreign=new Product();foreign.setId("foreign");foreign.setMerchantId(2000L);
  var post=new RecommendationPost();post.id=7L;post.merchantId=1000L;post.version=11L;post.published=true;post.title="Issue";
  var item=new RecommendationItem();item.id=248L;item.postId=7L;item.productId="owned";item.name="Source full name";item.itemNumber="ITEM-A";item.referencePrice=new BigDecimal("1234");item.offerStart=java.time.LocalDate.of(2026,11,6);item.offerEnd=java.time.LocalDate.of(2026,11,8);
  var products=stub(ProductRepository.class,(p,m,a)->{if(m.getName().equals("findAll"))return List.of(owned,foreign);throw new AssertionError("Unexpected product write/read "+m.getName());});
  var items=stub(RecommendationItemRepository.class,(p,m,a)->{if(m.getName().equals("findByProductIdInOrderById"))return List.of(item);throw new AssertionError(m.getName());});
  var posts=stub(RecommendationPostRepository.class,(p,m,a)->{if(m.getName().equals("findAllById"))return List.of(post);throw new AssertionError(m.getName());});
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("agent-1000","synthetic",List.of(new SimpleGrantedAuthority("ROLE_AGENT"))));
  try{
   var service=new ProductCatalogService(products,items,null,posts,null,null,null,null);var audit=service.audit();
   assertThat(audit).hasSize(1);var row=audit.get(0);assertThat(row.current().canonical()).isFalse();assertThat(row.originalCatalogData()).isNull();assertThat(owned.getCatalogData()).isNull();
   assertThat(row.current().value().version()).isEqualTo(4);assertThat(row.current().sourceItemIds()).containsExactly(248L);
   assertThat(row.sources().get(0).offerStart()).isEqualTo(item.offerStart);assertThat(row.sources().get(0).referencePrice()).isEqualByComparingTo("1234");assertThat(row.sources().get(0).postVersion()).isEqualTo(11);
  }finally{SecurityContextHolder.clearContext();}
 }
 @Test void projectionDoesNotChangeStoredSourceOrPrice(){
  var product=new Product();product.setName(Map.of("ja-JP","Refrigerator"));product.setBrand("TOSHIBA");product.setCatalogData(new ProductCatalogData(Map.of("ja-JP","601L"),"ExactModel","1 unit",List.of(),null,null,null,null));
  var source=new RecommendationItem();source.name="Original mail full name";source.referencePrice=new BigDecimal("90000");source.offerEnd=java.time.LocalDate.of(2026,11,8);
  var dto=new RecommendationItem();dto.referencePrice=source.referencePrice;dto.offerEnd=source.offerEnd;ProductCatalogProjection.apply(dto,source,product);
  assertThat(dto.name).isEqualTo("Refrigerator");assertThat(dto.brand).isEqualTo("TOSHIBA");assertThat(dto.specification).isEqualTo("601L");assertThat(dto.referencePrice).isEqualByComparingTo("90000");assertThat(dto.offerEnd).isEqualTo(source.offerEnd);assertThat(source.name).isEqualTo("Original mail full name");
 }
}
