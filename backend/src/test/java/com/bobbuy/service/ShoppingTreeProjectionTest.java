package com.bobbuy.service;
import com.bobbuy.model.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
class ShoppingTreeProjectionTest {
 CategoryTreeNode node(String id,String parent,int rank,String...path){return new CategoryTreeNode(id,parent,Map.of("ja-JP",id),List.of(path),rank,null);}
 @Test void configuredOrderDeepPathsRootAttachmentAndImages(){
  var a=node("a",null,20,"a");var b=node("b",null,0,"b");var child=node("c","a",0,"a","c");var deep=node("d","c",0,"a","c","d");
  child.setImageUrl("/api/storefront/recommendation-images/child-test");
  b.setImageUrl("/api/storefront/recommendation-images/test");
  var projection=new ShoppingTreeProjection(List.of(deep,a,child,b));
  assertThat(projection.categories()).extracting(ShoppingCategoryMap.Category::id).containsExactly("shop-b","shop-a","shop-c");
  assertThat(projection.categories().get(0).imageUrl()).isEqualTo(b.getImageUrl());
  assertThat(projection.categories().get(2).imageUrl()).isEqualTo(child.getImageUrl());
  assertThat(projection.target("b")).isEqualTo("shop-b");assertThat(projection.target("d")).isEqualTo("shop-c");assertThat(projection.target("missing")).isNull();
 }
 @Test void rejectsOrphansCyclesAndInconsistentPaths(){
  assertThatThrownBy(()->new ShoppingTreeProjection(List.of(node("x","missing",0,"missing","x")))).isInstanceOf(IllegalArgumentException.class);
  assertThatThrownBy(()->new ShoppingTreeProjection(List.of(node("x","x",0,"x","x")))).isInstanceOf(IllegalArgumentException.class);
  assertThatThrownBy(()->new ShoppingTreeProjection(List.of(node("x",null,0,"other","x")))).isInstanceOf(IllegalArgumentException.class);
 }
 @Test void servicePreservesAssignedSourceProtectionAndDoesNotInventUnknownAssignments(){
  var nodes=mock(com.bobbuy.repository.CategoryTreeNodeRepository.class);var paths=mock(com.bobbuy.repository.ProductPrimaryCategoryPathRepository.class);
  when(nodes.findAll()).thenReturn(List.of(node("root",null,0,"root")));
  when(paths.countByCategoryNodeId("root")).thenReturn(1L);
  when(paths.findAllById(any())).thenReturn(List.of(new ProductPrimaryCategoryPath("p","root"),new ProductPrimaryCategoryPath("q","missing")));
  var service=new ShoppingCategoryService(nodes,paths,new com.fasterxml.jackson.databind.ObjectMapper());
  assertThat(service.referencesSource("root")).isTrue();
  assertThat(service.snapshot(List.of("p","q")).assignments()).containsExactly(entry("p","shop-root"));
 }
}
