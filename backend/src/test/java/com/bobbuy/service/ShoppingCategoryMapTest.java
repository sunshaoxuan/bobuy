package com.bobbuy.service;

import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class ShoppingCategoryMapTest {
 static Map<String,String> name(String name){return Map.of("zh-CN",name,"zh-TW",name,"en-US",name,"ja-JP",name);}
 static List<ShoppingCategoryMap.Category> categories(){return List.of(new ShoppingCategoryMap.Category("shop-food",null,name("Food"),""),new ShoppingCategoryMap.Category("shop-food-one","shop-food",name("Same name"),""),new ShoppingCategoryMap.Category("shop-food-two","shop-food",name("Same name"),""));}
 ShoppingCategoryMap mapping(List<ShoppingCategoryMap.Rule> rules,List<ShoppingCategoryMap.Override> overrides){return new ShoppingCategoryMap(new ShoppingCategoryMap.Config(categories(),rules,overrides));}
 final Map<String,List<String>> sources=Map.of("root",List.of("root"),"child",List.of("root","child"),"other",List.of("other"));
 @Test void bundledConfigurationLoadsThroughRuntimeServiceWithoutFabricatedAssignments()throws Exception{
  var nodes=org.mockito.Mockito.mock(com.bobbuy.repository.CategoryTreeNodeRepository.class);var paths=org.mockito.Mockito.mock(com.bobbuy.repository.ProductPrimaryCategoryPathRepository.class);
  org.mockito.Mockito.when(nodes.findAll()).thenReturn(List.of());org.mockito.Mockito.when(paths.findAllById(org.mockito.ArgumentMatchers.any())).thenReturn(List.of());
  var service=new ShoppingCategoryService(nodes,paths,new com.fasterxml.jackson.databind.ObjectMapper());var snapshot=service.snapshot(List.of("unmapped"));
  assertThat(snapshot.categories().stream().filter(c->c.parentId()==null)).hasSize(16);assertThat(snapshot.assignments()).isEmpty();
 }
 @Test void includesDirectParentProductsAndNewDescendantsExactlyOnce(){var map=mapping(List.of(new ShoppingCategoryMap.Rule("root","shop-food-one",true)),List.of());assertThat(map.resolve(sources,Map.of("parent-product","root","child-product","child","unmapped","other"))).containsOnly(entry("parent-product","shop-food-one"),entry("child-product","shop-food-one"));}
 @Test void exactNodeRuleDoesNotClaimChildren(){var map=mapping(List.of(new ShoppingCategoryMap.Rule("root","shop-food-one",false)),List.of());assertThat(map.resolve(sources,Map.of("p","root","q","child"))).containsOnly(entry("p","shop-food-one"));}
 @Test void distinctNodesWithSameDisplayNameKeepIdentity(){var map=mapping(List.of(new ShoppingCategoryMap.Rule("root","shop-food-one",false),new ShoppingCategoryMap.Rule("child","shop-food-two",false)),List.of());assertThat(map.resolve(sources,Map.of("p","root","q","child"))).containsOnly(entry("p","shop-food-one"),entry("q","shop-food-two"));}
 @Test void explicitProductExceptionHasOneFinalAssignment(){var map=mapping(List.of(new ShoppingCategoryMap.Rule("root","shop-food-one",true)),List.of(new ShoppingCategoryMap.Override("p","shop-food-two")));assertThat(map.resolve(sources,Map.of("p","child"))).containsOnly(entry("p","shop-food-two"));}
 @Test void rejectsOverlapEvenWhenNoProductCurrentlyUsesIt(){var map=mapping(List.of(new ShoppingCategoryMap.Rule("root","shop-food-one",true),new ShoppingCategoryMap.Rule("child","shop-food-two",false)),List.of());assertThatThrownBy(()->map.resolve(sources,Map.of())).hasMessageContaining("Overlapping");}
 @Test void rejectsUnknownSourceAndRootTargets(){assertThatThrownBy(()->mapping(List.of(new ShoppingCategoryMap.Rule("root","shop-food",true)),List.of())).hasMessageContaining("leaf");var map=mapping(List.of(new ShoppingCategoryMap.Rule("missing","shop-food-one",true)),List.of());assertThatThrownBy(()->map.resolve(sources,Map.of())).hasMessageContaining("Unknown");}
 @Test void rejectsDuplicateOverridesAndThirdLevel(){assertThatThrownBy(()->mapping(List.of(),List.of(new ShoppingCategoryMap.Override("p","shop-food-one"),new ShoppingCategoryMap.Override("p","shop-food-two")))).hasMessageContaining("Duplicate");var nodes=new ArrayList<>(categories());nodes.add(new ShoppingCategoryMap.Category("shop-third","shop-food-one",name("Bad"),""));assertThatThrownBy(()->new ShoppingCategoryMap(new ShoppingCategoryMap.Config(nodes,List.of(),List.of()))).hasMessageContaining("two levels");}
 @Test void missingAndUnclassifiedProductsRemainExplicitlyUnmapped(){assertThat(mapping(List.of(),List.of()).resolve(sources,Map.of("p","","q","system-uncategorized"))).isEmpty();}
}
