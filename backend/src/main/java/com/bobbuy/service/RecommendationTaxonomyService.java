package com.bobbuy.service;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.MerchantScope;
import com.bobbuy.api.response.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.text.Normalizer;

@Service
public class RecommendationTaxonomyService {
    private final CategoryRepository categories;
    private final SupplierRepository suppliers;
    private final UserRepository users;
    public RecommendationTaxonomyService(CategoryRepository categories,SupplierRepository suppliers,UserRepository users) {
        this.categories=categories;this.suppliers=suppliers;this.users=users;
    }
    public record Choice(String id,Map<String,String> name,boolean editable) {}
    public record Options(List<Choice> categories,List<Choice> suppliers) {}
    private Long owner() {
        var owner=MerchantScope.current();
        if(owner==null)throw new ApiException(ErrorCode.FORBIDDEN,"error.auth.forbidden");
        return owner;
    }
    @Transactional(readOnly=true)
    public Options options() {
        Long owner=owner();
        return new Options(categories.findAll().stream().filter(c->c.getMerchantId()==null||owner.equals(c.getMerchantId()))
            .map(c->new Choice(c.getId(),c.getName(),owner.equals(c.getMerchantId()))).toList(),
            suppliers.findAll().stream().filter(s->owner.equals(s.getMerchantId())).map(s->new Choice(s.getId(),s.getName(),true)).toList());
    }
    @Transactional
    public Choice category(String id,String label,String locale) {
        Long owner=owner();users.lockById(owner).orElseThrow(()->new ApiException(ErrorCode.FORBIDDEN,"error.auth.forbidden"));
        String key=Normalizer.normalize(label.trim(),Normalizer.Form.NFKC).toLowerCase(Locale.ROOT);
        if(key.isBlank()||key.length()>100)throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.classification");
        var existing=categories.findAll().stream().filter(c->owner.equals(c.getMerchantId())&&key.equals(c.getTagKey())).findFirst();
        if(existing.isPresent()&&!existing.get().getId().equals(id)) {
            if(id==null)return new Choice(existing.get().getId(),existing.get().getName(),true);
            throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.classification");
        }
        var value=id==null?new Category():categories.findById(id).filter(c->owner.equals(c.getMerchantId()))
            .orElseThrow(()->new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"error.category.not_found"));
        if(id==null)value.setId("rec-cat-"+UUID.randomUUID());
        value.setMerchantId(owner);value.setTagKey(key);
        var names=new LinkedHashMap<>(value.getName());names.put(locale,label.trim());value.setName(names);
        categories.saveAndFlush(value);return new Choice(value.getId(),value.getName(),true);
    }
    public void validate(List<String> ids,String supplierId,boolean showSupplier) {
        Long owner=owner();
        var allowed=categories.findAllById(ids).stream().filter(c->c.getMerchantId()==null||owner.equals(c.getMerchantId())).count();
        if(allowed!=new HashSet<>(ids).size() || (showSupplier&&supplierId==null)
            || (supplierId!=null&&!suppliers.findById(supplierId).filter(s->owner.equals(s.getMerchantId())).isPresent()))
            throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.classification");
    }
    public List<RecommendationItem> display(List<RecommendationItem> source,boolean publicView) {
        Set<String> ids=new HashSet<>(), supplierIds=new HashSet<>();
        for(var item:source) {
            ids.addAll(item.categoryIds);
            if(item.supplierId!=null&&(!publicView||item.showSupplier))supplierIds.add(item.supplierId);
        }
        Map<String,Category> categoryMap=new HashMap<>();categories.findAllById(ids).forEach(c->categoryMap.put(c.getId(),c));
        Map<String,Supplier> supplierMap=new HashMap<>();suppliers.findAllById(supplierIds).forEach(s->supplierMap.put(s.getId(),s));
        return source.stream().map(original->{
            var item=new RecommendationItem();
            item.id=original.id;item.postId=original.postId;item.productId=original.productId;item.name=original.name;
            item.itemNumber=original.itemNumber;item.referencePrice=original.referencePrice;item.originalPrice=original.originalPrice;
            item.discountAmount=original.discountAmount;item.priceUnit=original.priceUnit;item.offerStart=original.offerStart;
            item.offerEnd=original.offerEnd;item.couponStart=original.couponStart;item.couponEnd=original.couponEnd;
            item.specification=original.specification;item.description=original.description;
            item.translations=original.translations;item.translatedSource=original.translatedSource;
            item.gallery=List.copyOf(original.gallery);
            item.offerNotes=original.offerNotes;item.imageHash=original.imageHash;item.imageUrl=original.imageUrl;item.createdAt=original.createdAt;
            if(publicView){item.imageHash=null;item.imageUrl=item.gallery.isEmpty()?null:item.gallery.get(0).url();}
            item.categoryIds=List.copyOf(original.categoryIds);item.showSupplier=original.showSupplier;
            item.categories=item.categoryIds.stream().filter(categoryMap::containsKey).map(id->new RecommendationItem.Label(id,categoryMap.get(id).getName())).toList();
            if(!publicView||original.showSupplier) {
                item.supplierId=original.supplierId;
                if(supplierMap.containsKey(item.supplierId))item.supplierName=supplierMap.get(item.supplierId).getName();
            }
            return item;
        }).toList();
    }
}
