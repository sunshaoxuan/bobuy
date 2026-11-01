package com.bobbuy.service;

import com.bobbuy.model.*;
import com.bobbuy.repository.ProductRepository;
import com.bobbuy.api.response.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class RecommendationCatalogService {
    private static final String PROFILE_ID_PREFIX="bobuy-rec-v1-";
    private final ProductRepository products;
    public RecommendationCatalogService(ProductRepository products){this.products=products;}
    public static boolean profile(Product product){return (product.getId()!=null&&product.getId().startsWith(PROFILE_ID_PREFIX))||(product.getAttributes()!=null&&"true".equals(product.getAttributes().get("recommendationProfile")));}
    public void requireOwnership(String id,Long owner){if(!products.existsByIdAndMerchantId(id,owner))throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"error.product.not_found");}
    public void syncText(RecommendationItem item,Long owner){
        if(item.productId==null)return;
        var product=products.lockById(item.productId).orElseThrow();
        if(product.getCatalogData()!=null)return;
        if(!owner.equals(product.getMerchantId())||!profile(product)||!item.postId.toString().equals(product.getAttributes().get("recommendationSourceIssue")))return;
        var names=RecommendationText.names(item);var descriptions=RecommendationText.descriptions(item);
        if(!names.equals(product.getName())||!descriptions.equals(product.getDescription())){product.setName(names);product.setDescription(descriptions);products.save(product);}
    }
    public boolean ensure(RecommendationItem item,Long owner){
        if(item.productId!=null){requireOwnership(item.productId,owner);return false;}
        // Reuse a reviewed supplier identity; issue/channel/offer dates are separate records.
        var context=item.referenceContext;
        if(context!=null&&item.specification==null)item.specification=context.variantKey();
        if(item.itemNumber!=null){
            if(products.deletedCodeCount(owner,item.itemNumber)>0)throw new ApiException(ErrorCode.INVALID_REQUEST,"master.use_profile");
            var candidates=products.findAllByMerchantIdAndItemNumber(owner,item.itemNumber);
            var original=candidates.stream().filter(p->profile(p)&&p.getCatalogData()!=null&&p.getAttributes()!=null&&item.postId.toString().equals(p.getAttributes().get("recommendationSourceIssue"))&&item.name.equals(ProductCatalogService.text(p.getName(),"ja-JP"))&&Objects.toString(item.specification,"").equals(ProductCatalogService.text(p.getCatalogData().specification(),"ja-JP"))).toList();
            if(original.size()==1){item.productId=original.get(0).getId();return false;}
            var exact=candidates.stream().filter(p->context!=null&&p.getCatalogData()!=null&&(Objects.equals(context.supplierKey(),p.getCatalogData().supplierId())||(p.getAttributes()!=null&&Objects.equals(context.supplierKey(),p.getAttributes().get("referenceSupplierKey"))))&&Objects.equals(context.variantKey(),ProductCatalogService.text(p.getCatalogData().specification(),"ja-JP"))&&item.name.equals(ProductCatalogService.text(p.getName(),"ja-JP"))).toList();
            if(exact.size()==1){item.productId=exact.get(0).getId();return false;}
            if(!candidates.isEmpty())throw new ApiException(ErrorCode.INVALID_REQUEST,"master.use_profile");
        }
        String identity=owner+":"+(context==null?Objects.toString(item.supplierId,""):Objects.toString(context.supplierKey(),""))+":"+Objects.toString(item.itemNumber,item.imageHash)+":"+item.name.trim()+":"+Objects.toString(item.specification,"");
        String id=PROFILE_ID_PREFIX+UUID.nameUUIDFromBytes(identity.getBytes(StandardCharsets.UTF_8));
        if(products.existsById(id)){requireOwnership(id,owner);item.productId=id;return false;}
        var product=new Product();product.setId(id);product.setMerchantId(owner);
        var names=new HashMap<String,String>();names.put("ja-JP",item.name);var specifications=new HashMap<String,String>();
        if(item.specification!=null)specifications.put("ja-JP",item.specification);
        boolean reviewed="REVIEWED".equals(item.getTranslationStatus());
        if(reviewed)item.translations.forEach((locale,text)->{names.put(locale,text.name());if(text.specification()!=null)specifications.put(locale,text.specification());});
        product.setName(names);product.setDescription(RecommendationText.descriptions(item));
        product.setItemNumber(item.itemNumber);product.setBasePrice(0);
        product.setOrderMethod(OrderMethod.PRE_ORDER);product.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);
        product.setAttributes(new HashMap<>(Map.of("recommendationProfile","true","recommendationSourceIssue",item.postId.toString(),"pricingStatus","REQUIRES_REVIEW")));
        if(context!=null&&context.supplierKey()!=null)product.getAttributes().put("referenceSupplierKey",context.supplierKey());
        product.setMediaGallery(item.gallery.stream().map(ProductCatalogService::media).collect(java.util.stream.Collectors.toCollection(ArrayList::new)));
        product.setCategoryId(item.categoryIds.isEmpty()?null:item.categoryIds.get(0));
        product.setCatalogData(new ProductCatalogData(specifications,null,null,List.copyOf(item.categoryIds),item.supplierId,null,owner,java.time.Instant.now()));
        if(reviewed){var d=product.getCatalogData();product.setCatalogData(new ProductCatalogData(d.specification(),d.model(),d.packaging(),d.categoryIds(),d.supplierId(),ProductCatalogService.sourceHash(product),d.reviewedBy(),d.reviewedAt()));}
        products.saveAndFlush(product);item.productId=id;return true;
    }
}
