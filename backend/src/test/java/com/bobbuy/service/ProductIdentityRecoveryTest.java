package com.bobbuy.service;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.compat.PreviousOrderLine;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

/** Offline recovery boundary tests: no Spring context, sockets, persistence or production data. */
class ProductIdentityRecoveryTest {
 @SuppressWarnings("unchecked") private <T>T stub(Class<T> type,java.lang.reflect.InvocationHandler call){return (T)java.lang.reflect.Proxy.newProxyInstance(type.getClassLoader(),new Class[]{type},call);}
 private ProductCatalogService service(Product product){
  var products=stub(ProductRepository.class,(p,m,a)->switch(m.getName()){
   case "findById","lockById" -> Optional.of(product);
   case "saveAndFlush" -> product;
   default -> throw new AssertionError(m.getName());
  });
  var items=stub(RecommendationItemRepository.class,(p,m,a)->{if(m.getName().equals("findByProductIdInOrderById"))return List.of();throw new AssertionError(m.getName());});
  var users=stub(UserRepository.class,(p,m,a)->{if(m.getName().equals("lockById"))return Optional.of(new User(1000L,"fixture",Role.AGENT,0));throw new AssertionError(m.getName());});
  var categories=stub(CategoryRepository.class,(p,m,a)->{if(m.getName().equals("findAllById"))return List.of();throw new AssertionError(m.getName());});
  var taxonomy=new RecommendationTaxonomyService(categories,null,users,products,null);
  return new ProductCatalogService(products,items,null,null,users,taxonomy,null);
 }
 private Product product(){var p=new Product();p.setId("offline");p.setMerchantId(1000L);p.setRecordVersion(4L);p.setItemNumber("independent-ITEM");p.setBrand("Brand");p.setName(Map.of("ja-JP","Original"));return p;}
 private ProductCatalogService.Input rename(ProductCatalogService.Input v,String name){return new ProductCatalogService.Input(v.productId(),v.version(),Map.of("ja-JP",name),v.description(),v.itemNumber(),v.brand(),v.specification(),v.model(),v.packaging(),v.categoryIds(),v.supplierId(),v.gallery(),v.translationsReviewed());}
 private void withOwner(Runnable body){SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("agent-1000","synthetic",List.of(new SimpleGrantedAuthority("ROLE_AGENT"))));try{body.run();}finally{SecurityContextHolder.clearContext();}}

 @Test void restoringOrdinaryFieldsCannotUndoLegacyCanonicalization(){withOwner(()->{
  var p=product();var service=service(p);var before=service.get(p.getId());assertThat(before.canonical()).isFalse();
  service.save(List.of(rename(before.value(),"Corrected")),true);assertThat(p.getCatalogData()).isNotNull();
  service.save(List.of(before.value()),true);
  assertThat(p.getName()).isEqualTo(before.value().name());assertThat(p.getCatalogData()).isNotNull();
  assertThat(service.get(p.getId()).canonical()).isTrue();
 });}
 @Test void canonicalFieldRecoveryRestoresMetadataWithoutChangingIdentityOrSale(){withOwner(()->{
  var p=product();p.setBasePrice(123);p.setCatalogData(new ProductCatalogData(Map.of("ja-JP","80 pieces x 2"),"Model","2 packs",List.of(),null,null,null,null));
  var service=service(p);var before=service.get(p.getId()).value();service.save(List.of(rename(before,"Corrected")),true);service.save(List.of(before),true);
  var after=service.get(p.getId()).value();assertThat(after.name()).isEqualTo(before.name());assertThat(after.specification()).isEqualTo(before.specification());
  assertThat(after.model()).isEqualTo(before.model());assertThat(after.packaging()).isEqualTo(before.packaging());assertThat(after.itemNumber()).isEqualTo(before.itemNumber());
  assertThat(p.getBasePrice()).isEqualTo(123);assertThat(p.getCatalogData().reviewedAt()).isNotNull();
  // Review timestamps change; this is semantic field recovery, never a byte-identical database restore.
 });}
 @Test void actualPreviousStrictOrderShapeRejectsNewSnapshotFieldsButReadsUntouchedHistory() throws Exception {
  var mapper=new ObjectMapper().findAndRegisterModules();var line=new OrderLine("p","Old full name","box",2,123);
  var oldJson=mapper.writeValueAsString(line);assertThat(mapper.readValue(oldJson,PreviousOrderLine.class).getSpec()).isEqualTo("box");
  var p=product();p.setCatalogData(new ProductCatalogData(Map.of("ja-JP","80 pieces x 2"),"Model","2 packs",List.of(),null,null,null,null));OrderProductSnapshot.capture(line,p);
  var newJson=mapper.writeValueAsString(line);
  assertThatThrownBy(()->mapper.readValue(newJson,PreviousOrderLine.class)).isInstanceOf(UnrecognizedPropertyException.class);
  var compatible=mapper.readValue(newJson,OrderLine.class);assertThat(compatible.getBrand()).isEqualTo("Brand");assertThat(compatible.getSpecifications()).containsEntry("ja-JP","80 pieces x 2");assertThat(compatible.getSpec()).isEqualTo("box");
 }
}
