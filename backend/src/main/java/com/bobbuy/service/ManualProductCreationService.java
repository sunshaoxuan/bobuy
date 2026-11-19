package com.bobbuy.service;

import com.bobbuy.api.response.*;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.MerchantScope;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Manual creation only: no AI matching, inventory reconciliation or public-price authorization. */
@Service
public class ManualProductCreationService {
    public record Input(UUID requestId, Map<String,String> name, Map<String,String> description,
        Map<String,String> specification, String itemNumber, String brand, String categoryNodeId,
        Map<String,String> attributes, Map<String,String> merchantSkus, List<MediaGalleryItem> mediaGallery,
        StorageCondition storageCondition, OrderMethod orderMethod, List<PriceTier> priceTiers) {}
    private final ProductRepository products;
    private final UserRepository users;
    private final CategoryTreeManagementService categories;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;
    public ManualProductCreationService(ProductRepository products, UserRepository users,
        CategoryTreeManagementService categories, org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.products=products;this.users=users;this.categories=categories;this.jdbc=jdbc;
    }
    private static ApiException invalid(String key){return new ApiException(ErrorCode.INVALID_REQUEST,key);}
    private static String text(String value,int limit){
        if(value==null)return null;
        if(value.length()>limit)throw invalid("master.invalid");
        return value.strip().isEmpty()?null:value.strip();
    }
    private static Map<String,String> localized(Map<String,String> input,int limit){
        if(input==null)return Map.of();
        if(!Set.of("ja-JP","zh-CN","zh-TW","en-US").containsAll(input.keySet()))throw invalid("master.invalid");
        var result=new LinkedHashMap<String,String>();
        input.forEach((k,v)->{String clean=text(v,limit);if(clean!=null)result.put(k,clean);});return result;
    }
    private static Map<String,String> fields(Map<String,String> input){
        if(input==null)return Map.of();
        if(input.size()>100||input.entrySet().stream().anyMatch(e->e.getKey()==null||e.getKey().length()>100||e.getValue()==null||e.getValue().length()>2000))throw invalid("master.invalid");
        return Map.copyOf(input);
    }
    @Transactional
    public Product create(Input input){
        Long owner=MerchantScope.current();
        if(owner==null)throw new ApiException(ErrorCode.FORBIDDEN,"error.auth.forbidden");
        if(input==null||input.requestId()==null)throw invalid("master.invalid");
        users.lockById(owner).orElseThrow(()->new ApiException(ErrorCode.FORBIDDEN,"error.auth.forbidden"));
        // Stable server-derived identity plus owner lock makes lost-response/concurrent retries safe.
        String id=UUID.nameUUIDFromBytes(("manual-product:"+owner+":"+input.requestId()).getBytes(StandardCharsets.UTF_8)).toString();
        var existing=products.findById(id);
        if(existing.isPresent())return existing.get(); // Never overwrite an existing product on create/retry.
        if(jdbc.queryForObject("select count(*) from bb_product where id=?",Long.class,id)>0)throw invalid("product.create.deleted_retry");
        var name=localized(input.name(),400);
        if(!name.containsKey("ja-JP"))throw invalid("master.japanese_required");
        String item=text(input.itemNumber(),100);
        if(item!=null&&(!products.findAllByMerchantIdAndItemNumber(owner,item).isEmpty()||products.deletedCodeCount(owner,item)>0))throw invalid("product.create.duplicate");
        var product=new Product();product.setId(id);product.setMerchantId(owner);
        product.setName(name);product.setDescription(localized(input.description(),8000));
        product.setBrand(text(input.brand(),200));product.setItemNumber(item);
        product.setCategoryId(null);product.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);
        product.setAttributes(fields(input.attributes()));product.setMerchantSkus(fields(input.merchantSkus()));
        product.setCatalogData(new ProductCatalogData(localized(input.specification(),1000),null,null,List.of(),null,null,null,null));
        product.setStorageCondition(input.storageCondition()==null?StorageCondition.AMBIENT:input.storageCondition());
        product.setOrderMethod(input.orderMethod()==null?OrderMethod.PRE_ORDER:input.orderMethod());
        var gallery=input.mediaGallery()==null?List.<MediaGalleryItem>of():input.mediaGallery();
        if(gallery.size()>100)throw invalid("gallery.invalid");
        for(var media:gallery){
            if(media==null||media.getType()==null||media.getUrl()==null||media.getUrl().length()>2048)throw invalid("gallery.invalid");
            try{var uri=java.net.URI.create(media.getUrl());if(!"https".equals(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||uri.getRawQuery()!=null||uri.getRawFragment()!=null)throw new IllegalArgumentException();media.setSourceUrl(media.getUrl());media.setSourceDomain(uri.getHost());media.setSourceType("USER_PROVIDED_URL");}catch(Exception e){throw invalid("gallery.invalid");}
            media.setTitle(localized(media.getTitle(),400));
        }
        product.setMediaGallery(gallery);
        if(input.priceTiers()!=null){if(input.priceTiers().size()>100)throw invalid("master.invalid");product.setPriceTiers(input.priceTiers());}
        products.saveAndFlush(product);
        categories.assign(id,new CategoryTreeManagementService.ProductPath(id,input.categoryNodeId()));
        return product;
    }
}
