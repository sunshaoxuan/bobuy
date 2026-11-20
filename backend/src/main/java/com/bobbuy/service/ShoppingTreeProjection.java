package com.bobbuy.service;

import com.bobbuy.model.CategoryTreeNode;
import java.util.*;

/** Read-only two-level view of the operator-managed tree. Never creates business records. */
final class ShoppingTreeProjection {
 private final Map<String,CategoryTreeNode> nodes=new LinkedHashMap<>();
 ShoppingTreeProjection(List<CategoryTreeNode> tree){
  for(var n:tree)if(n.getId()==null||nodes.putIfAbsent(n.getId(),n)!=null)throw new IllegalArgumentException("Duplicate category identity");
  for(var n:tree){
   var path=n.getFullPath();
   if(path==null||path.isEmpty()||!n.getId().equals(path.get(path.size()-1))||new HashSet<>(path).size()!=path.size())throw new IllegalArgumentException("Invalid category path");
   if(n.getParentId()==null){if(path.size()!=1)throw new IllegalArgumentException("Invalid root path");}
   else {
    var parent=nodes.get(n.getParentId());
    if(parent==null||!path.subList(0,path.size()-1).equals(parent.getFullPath())||parent.getSystemKey()!=null)throw new IllegalArgumentException("Invalid category parent");
   }
  }
 }
 static String identity(String id){return "shop-"+id;}
 List<ShoppingCategoryMap.Category> categories(){
  var result=new ArrayList<ShoppingCategoryMap.Category>();
  var order=Comparator.comparingInt(CategoryTreeNode::getSortOrder).thenComparing(CategoryTreeNode::getId);
  nodes.values().stream().filter(n->n.getParentId()==null&&n.getSystemKey()==null).sorted(order).forEach(root->{
   result.add(new ShoppingCategoryMap.Category(identity(root.getId()),null,Map.copyOf(root.getName()),null,root.getImageUrl()));
   nodes.values().stream().filter(n->root.getId().equals(n.getParentId())&&n.getSystemKey()==null).sorted(order).forEach(child->result.add(new ShoppingCategoryMap.Category(identity(child.getId()),identity(root.getId()),Map.copyOf(child.getName()),null,child.getImageUrl())));
  });
  return List.copyOf(result);
 }
 String target(String id){
  var node=nodes.get(id);if(node==null||node.getSystemKey()!=null)return null;
  var path=node.getFullPath();return identity(path.get(Math.min(1,path.size()-1)));
 }
}
