package com.bobbuy.service;
import com.bobbuy.model.*;
import java.util.*;
/** Applies only reviewed product metadata to a detached recommendation DTO. */
public final class ProductCatalogProjection {
 private ProductCatalogProjection(){}
 public static void apply(RecommendationItem item,RecommendationItem original,Product product){
  if(product==null||product.getCatalogData()==null)return;var data=product.getCatalogData();item.catalogDriven=true;
  item.name=ProductCatalogService.text(product.getName(),"ja-JP");item.itemNumber=product.getItemNumber();
  item.specification=ProductCatalogService.text(data.specification(),"ja-JP");item.description=ProductCatalogService.text(product.getDescription(),"ja-JP");
  item.categoryIds=List.copyOf(data.categoryIds());item.supplierId=data.supplierId();item.brand=product.getBrand();item.model=data.model();item.packaging=data.packaging();
  var translations=new HashMap<String,RecommendationItem.Text>();
  if(ProductCatalogService.translationsCurrent(product))for(String locale:List.of("zh-CN","zh-TW","en-US")){
   String name=ProductCatalogService.text(product.getName(),locale);if(name.isBlank())continue;
   var sourceText="REVIEWED".equals(original.getTranslationStatus())?original.translations.get(locale):null;
   translations.put(locale,new RecommendationItem.Text(name,ProductCatalogService.text(data.specification(),locale),ProductCatalogService.text(product.getDescription(),locale),sourceText==null?null:sourceText.offerNotes()));
  }
  item.translations=translations;item.translatedSource=item.getTranslationSource();
  item.gallery=product.getMediaGallery().stream().filter(p->p.getType()==MediaType.IMAGE&&p.isVisible()).map(p->{String key=Objects.toString(p.getSha256(),UUID.nameUUIDFromBytes(p.getUrl().getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString());return new RecommendationItem.Picture(key,p.getUrl(),p.getSha256(),p.getSourceUrl(),p.getUrl(),ProductCatalogService.text(p.getTitle(),"ja-JP"),data.reviewedAt());}).toList();
 }
}
