package com.bobbuy.service;

import com.bobbuy.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
public class ShoppingCategoryService {
 private final CategoryTreeNodeRepository nodes;
 private final ProductPrimaryCategoryPathRepository paths;
 private final ProductAdditionalCategoryPathRepository additional;
 @org.springframework.beans.factory.annotation.Autowired
 public ShoppingCategoryService(CategoryTreeNodeRepository nodes,ProductPrimaryCategoryPathRepository paths,ObjectMapper json,@org.springframework.beans.factory.annotation.Autowired(required=false) ProductAdditionalCategoryPathRepository additional){
  this.nodes=nodes;this.paths=paths;this.additional=additional;
 }
 public ShoppingCategoryService(CategoryTreeNodeRepository nodes,ProductPrimaryCategoryPathRepository paths,ObjectMapper json){this(nodes,paths,json,null);}
 /** Assigned source nodes remain protected; structural and legacy references are also checked by management. */
 public boolean referencesSource(String id){return paths.countByCategoryNodeId(id)>0||additional!=null&&additional.countByCategoryNodeId(id)>0;}
 public void validateSources(List<com.bobbuy.model.CategoryTreeNode> tree){new ShoppingTreeProjection(tree);}
 public record Snapshot(List<ShoppingCategoryMap.Category> categories,Map<String,Set<String>> assignments){}
 @Transactional(readOnly=true)
 public Snapshot snapshot(Collection<String> ids){
  var projection=new ShoppingTreeProjection(nodes.findAll());
  var selected=new HashSet<>(ids);var assignments=new LinkedHashMap<String,Set<String>>();
  paths.findAllById(ids).forEach(p->{
   if(selected.contains(p.getProductId())){
    String target=projection.target(p.getCategoryNodeId());
    if(target!=null)assignments.computeIfAbsent(p.getProductId(),key->new LinkedHashSet<>()).add(target);
   }
  });
  if(additional!=null)additional.findAllByProductIdIn(ids).forEach(p->{String target=projection.target(p.getCategoryNodeId());if(target!=null)assignments.computeIfAbsent(p.getProductId(),key->new LinkedHashSet<>()).add(target);});
  assignments.replaceAll((key,value)->Collections.unmodifiableSet(value));
  return new Snapshot(projection.categories(),Collections.unmodifiableMap(assignments));
 }
}
