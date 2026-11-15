package com.bobbuy.service;

import java.util.*;

/** Reviewed shopping taxonomy, independent of the mutable source tree. No name-based matching. */
public final class ShoppingCategoryMap {
 public record Category(String id,String parentId,Map<String,String> name,String icon) {}
 public record Rule(String nodeId,String categoryId,boolean subtree) {}
 public record Override(String productId,String categoryId) {}
 public record Config(List<Category> categories,List<Rule> rules,List<Override> overrides) {}
 private final Config config;
 private final Map<String,Category> categories=new LinkedHashMap<>();
 public ShoppingCategoryMap(Config config){
  this.config=config;
  for(var c:config.categories()){
   if(c.id()==null||!c.id().matches("shop-[a-z0-9-]+")||categories.putIfAbsent(c.id(),c)!=null)throw new IllegalArgumentException("Duplicate or invalid shopping identity");
   if(!c.name().keySet().containsAll(Set.of("zh-CN","zh-TW","en-US","ja-JP"))||c.name().values().stream().anyMatch(String::isBlank))throw new IllegalArgumentException("Shopping names require four languages");
  }
  for(var c:categories.values())if(c.parentId()!=null){var parent=categories.get(c.parentId());if(parent==null||parent.parentId()!=null)throw new IllegalArgumentException("Shopping taxonomy must have exactly two levels");}
  var sources=new HashSet<String>();for(var rule:config.rules()){leaf(rule.categoryId());if(!sources.add(rule.nodeId()))throw new IllegalArgumentException("Duplicate source mapping");}
  var products=new HashSet<String>();for(var override:config.overrides()){leaf(override.categoryId());if(!products.add(override.productId()))throw new IllegalArgumentException("Duplicate product mapping");}
 }
 private void leaf(String id){var c=categories.get(id);if(c==null||c.parentId()==null)throw new IllegalArgumentException("Mapping target must be a shopping leaf");}
 public boolean referencesSource(String id){return config.rules().stream().anyMatch(r->r.nodeId().equals(id));}
 public List<Category> categories(){return List.copyOf(categories.values());}
 public String parent(String id){var c=categories.get(id);return c==null?null:c.parentId();}
 /** Validates against current identities, including unused nodes; nested rules never silently win. */
 public Map<String,String> resolve(Map<String,List<String>> sourcePaths,Map<String,String> productNodes){
  var nodeTargets=new HashMap<String,String>();
  for(var rule:config.rules())if(!sourcePaths.containsKey(rule.nodeId()))throw new IllegalArgumentException("Unknown source node: "+rule.nodeId());
  for(var entry:sourcePaths.entrySet())for(var rule:config.rules())if(rule.nodeId().equals(entry.getKey())||rule.subtree()&&entry.getValue().contains(rule.nodeId())){
   if(nodeTargets.putIfAbsent(entry.getKey(),rule.categoryId())!=null)throw new IllegalArgumentException("Overlapping source mappings: "+entry.getKey());
  }
  var result=new LinkedHashMap<String,String>();productNodes.forEach((product,node)->{if(nodeTargets.containsKey(node))result.put(product,nodeTargets.get(node));});
  for(var override:config.overrides())if(productNodes.containsKey(override.productId()))result.put(override.productId(),override.categoryId());
  return Collections.unmodifiableMap(result);
 }
}
