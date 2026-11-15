package com.bobbuy.service;

import com.bobbuy.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class ShoppingCategoryService {
 private final CategoryTreeNodeRepository nodes;
 private final ProductPrimaryCategoryPathRepository paths;
 private final ShoppingCategoryMap mapping;
 public ShoppingCategoryService(CategoryTreeNodeRepository nodes,ProductPrimaryCategoryPathRepository paths,ObjectMapper json)throws java.io.IOException{
  this.nodes=nodes;this.paths=paths;
  try(var input=new ClassPathResource("shopping-categories.json").getInputStream()){mapping=new ShoppingCategoryMap(json.readValue(input,ShoppingCategoryMap.Config.class));}
 }
 public boolean referencesSource(String id){return mapping.referencesSource(id);}
 public void validateSources(List<com.bobbuy.model.CategoryTreeNode> tree){var sources=new HashMap<String,List<String>>();tree.forEach(n->sources.put(n.getId(),n.getFullPath()));mapping.resolve(sources,Map.of());}
 public record Snapshot(List<ShoppingCategoryMap.Category> categories,Map<String,String> assignments){}
 public Snapshot snapshot(Collection<String> ids){
  var sources=new HashMap<String,List<String>>();nodes.findAll().forEach(n->sources.put(n.getId(),n.getFullPath()));
  var selected=new HashSet<>(ids);var products=new LinkedHashMap<String,String>();ids.forEach(id->products.put(id,""));
  paths.findAllById(ids).forEach(p->{if(selected.contains(p.getProductId()))products.put(p.getProductId(),p.getCategoryNodeId());});
  return new Snapshot(mapping.categories(),mapping.resolve(sources,products));
 }
}
