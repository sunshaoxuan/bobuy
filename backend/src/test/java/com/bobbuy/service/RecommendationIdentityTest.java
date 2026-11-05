package com.bobbuy.service;
import com.bobbuy.model.*;
import com.bobbuy.repository.ProductRepository;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class RecommendationIdentityTest {
 @Test void jsonFactsAcceptStructuredIdentityAndOldPayloads() throws Exception {
  var mapper=new com.fasterxml.jackson.databind.ObjectMapper();
  var facts=mapper.readValue("{\"name\":\"Diapers\",\"brand\":\"Pampers\",\"itemNumber\":\"0001\",\"model\":\"L\",\"packaging\":\"80 pieces x2\",\"specification\":\"80 pieces x2 packs\"}",RecommendationFacts.class);
  var item=new RecommendationItem();facts.apply(item);assertThat(item.brand).isEqualTo("Pampers");assertThat(item.itemNumber).isEqualTo("0001");assertThat(item.specification).isEqualTo("80 pieces x2 packs");
  var old=mapper.readValue("{\"name\":\"Old source name\"}",RecommendationFacts.class);assertThat(old.brand()).isNull();assertThat(old.name()).isEqualTo("Old source name");
 }
 @Test void createPreservesExplicitFieldsAndIndependentItemNumbers(){
  var saved=new ArrayList<Product>();
  var repo=(ProductRepository)java.lang.reflect.Proxy.newProxyInstance(ProductRepository.class.getClassLoader(),new Class[]{ProductRepository.class},(proxy,method,args)->switch(method.getName()){
   case "deletedCodeCount" -> 0L;
   case "findAllByMerchantIdAndItemNumber" -> List.of();
   case "existsById" -> false;
   case "saveAndFlush" -> {saved.add((Product)args[0]);yield args[0];}
   default -> throw new AssertionError("Unexpected repository operation: "+method.getName());
  });
  var service=new RecommendationCatalogService(repo);
  for(String code:List.of("80x2-L","76x2-XL")){
   var item=new RecommendationItem();item.postId=8L;
   new RecommendationFacts("Diapers",code,null,null,null,null,null,null,null,null,null,null,"Pampers","Model","2 packs",code.startsWith("80")?"80 pieces x 2":"76 pieces x 2").apply(item);
   item.imageHash="fixture";item.supplierId="Costco";assertThat(service.ensure(item,1000L)).isTrue();
  }
  var rows=saved;assertThat(rows).hasSize(2);
  assertThat(rows.get(0).getId()).isNotEqualTo(rows.get(1).getId());
  assertThat(rows).allSatisfy(p->{assertThat(p.getBrand()).isEqualTo("Pampers");assertThat(p.getName().get("ja-JP")).isEqualTo("Diapers");assertThat(p.getCatalogData().packaging()).isEqualTo("2 packs");assertThat(p.getCatalogData().model()).isEqualTo("Model");});
  assertThat(rows.get(0).getCatalogData().specification()).containsEntry("ja-JP","80 pieces x 2");
 }
}
