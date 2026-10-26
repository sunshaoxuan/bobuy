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
        if(!owner.equals(product.getMerchantId())||!profile(product)||!item.postId.toString().equals(product.getAttributes().get("recommendationSourceIssue")))return;
        var names=RecommendationText.names(item);var descriptions=RecommendationText.descriptions(item);
        if(!names.equals(product.getName())||!descriptions.equals(product.getDescription())){product.setName(names);product.setDescription(descriptions);products.save(product);}
    }
    public boolean ensure(RecommendationItem item,Long owner){
        if(item.productId!=null){requireOwnership(item.productId,owner);return false;}
        // Scope by source issue, official string code and reviewed name. Never
        // merge online/warehouse quotations or uncertain same-code identities.
        String identity=owner+":"+item.postId+":"+Objects.toString(item.itemNumber,item.imageHash)+":"+item.name.trim();
        String id=PROFILE_ID_PREFIX+UUID.nameUUIDFromBytes(identity.getBytes(StandardCharsets.UTF_8));
        if(products.existsById(id)){requireOwnership(id,owner);item.productId=id;return false;}
        var product=new Product();product.setId(id);product.setMerchantId(owner);
        product.setName(RecommendationText.names(item));product.setDescription(RecommendationText.descriptions(item));
        product.setItemNumber(item.itemNumber);product.setBasePrice(0);
        product.setOrderMethod(OrderMethod.PRE_ORDER);product.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);
        product.setAttributes(new HashMap<>(Map.of("recommendationProfile","true","recommendationSourceIssue",item.postId.toString(),"pricingStatus","REQUIRES_REVIEW")));
        product.setMediaGallery(item.gallery.stream().map(p->{var media=new MediaGalleryItem();media.setUrl(p.url());media.setType(MediaType.IMAGE);media.setVisible(true);return media;}).collect(java.util.stream.Collectors.toCollection(ArrayList::new)));
        products.saveAndFlush(product);item.productId=id;return true;
    }
}
