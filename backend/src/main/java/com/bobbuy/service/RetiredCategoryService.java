package com.bobbuy.service;

import com.bobbuy.model.*;
import com.bobbuy.repository.RetiredCategoryRepository;
import java.text.Normalizer;
import java.util.*;
import org.springframework.stereotype.Service;

/** Historical reads remain readable; a retired classification never becomes a current assignment. */
@Service
public class RetiredCategoryService {
 private final RetiredCategoryRepository retired;
 public RetiredCategoryService(RetiredCategoryRepository retired){this.retired=retired;}
 public List<String> currentIds(List<String> ids,Long owner){
  if(ids==null||ids.isEmpty())return ids==null?List.of():ids;
  var excluded=new HashSet<String>();retired.findAllById(ids).stream().filter(c->Objects.equals(owner,c.merchantId)).forEach(c->excluded.add(c.id));
  return ids.stream().filter(id->!excluded.contains(id)).toList();
 }
 public Map<String,RetiredCategory> historical(Collection<String> ids){
  var result=new HashMap<String,RetiredCategory>();retired.findAllById(ids).forEach(c->result.put(c.id,c));return result;
 }
 public boolean retiredHint(String hint,Long owner){
  if(hint==null||hint.isBlank()||owner==null)return false;
  String key=Normalizer.normalize(hint.trim(),Normalizer.Form.NFKC).toLowerCase(Locale.ROOT);
  return retired.findByMerchantId(owner).stream().anyMatch(c->key.equals(c.id.toLowerCase(Locale.ROOT))||key.equals(c.tagKey)||c.name.values().stream().anyMatch(n->key.equals(Normalizer.normalize(n,Normalizer.Form.NFKC).toLowerCase(Locale.ROOT))));
 }
 public void removeAssignments(Product product){
  var kept=currentIds(product.getCategoryId()==null?List.of():List.of(product.getCategoryId()),product.getMerchantId());
  if(kept.isEmpty())product.setCategoryId(null);
  var d=product.getCatalogData();if(d!=null){var ids=currentIds(d.categoryIds(),product.getMerchantId());if(!ids.equals(d.categoryIds()))product.setCatalogData(new ProductCatalogData(d.specification(),d.model(),d.packaging(),ids,d.supplierId(),d.translatedSource(),d.reviewedBy(),d.reviewedAt()));}
 }
}
