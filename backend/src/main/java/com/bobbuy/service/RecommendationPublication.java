package com.bobbuy.service;

import com.bobbuy.model.*;
import com.bobbuy.api.response.*;
import com.fasterxml.jackson.databind.*;
import java.security.MessageDigest;
import java.util.*;

/** Deterministic publication protocol. No persistence, network, sale or global visibility writes. */
public final class RecommendationPublication {
    private RecommendationPublication() {}
    private static final ObjectMapper JSON=new ObjectMapper().findAndRegisterModules()
        .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS,true)
        .configure(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY,true);
    public static boolean visible(RecommendationItem item) {
        return "PUBLISHED".equals(item.publicationState)&&item.publicationSnapshot!=null&&item.publicationSnapshot.version()==1;
    }
    public static void pending(RecommendationItem item) {
        if(!"PENDING".equals(item.publicationState)||item.publicationSnapshot!=null)
            throw new ApiException(ErrorCode.INVALID_STATUS,"error.recommendation.item_published");
    }
    private static String hash(Object value) {
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(JSON.writeValueAsBytes(value)));}
        catch(Exception e){throw new IllegalStateException("Cannot bind publication evidence",e);}
    }
    public static String requestHash(Long postId,Long itemId,UUID requestId,long version,long productVersion,String sourceHash,boolean reviewed) {
        return hash(List.of("recommendation-item-publication-v1",postId,itemId,requestId.toString(),version,productVersion,sourceHash,reviewed));
    }
    public static String additionHash(Long postId,String productId,long productVersion,RecommendationFacts facts) {
        return hash(List.of("recommendation-addition-v1",postId,productId,productVersion,facts));
    }
    public static RecommendationPublicationSnapshot candidate(RecommendationItem item,Product product) {
        var catalog=product==null||product.getCatalogData()==null?null:ProductCatalogRecovery.capture(product,item.id==null?List.of():List.of(item.id));
        Long productVersion=product==null?null:product.getRecordVersion();
        var content=new RecommendationPublicationSnapshot(1,false,productVersion,product==null?null:ProductCatalogService.sourceHash(product),null,
            item.name,item.itemNumber,item.specification,item.description,new TreeMap<>(item.translations),item.translatedSource,
            null,null,null,item.sourcePrice==null?null:item.sourcePrice.unit(),null,null,item.couponStart,item.couponEnd,
            item.offerNotes,item.referenceContext,List.copyOf(item.gallery),List.copyOf(item.categoryIds),item.supplierId,item.showSupplier,
            item.imageHash,item.imageUrl,item.offerIdentity,catalog,null,null);
        String reviewHash=hash(Arrays.asList("recommendation-item-review-v1",item.id,item.postId,item.productId,content));
        // Serialize/deserialize once to detach mutable nested media/maps from the live master.
        try{return JSON.readValue(JSON.writeValueAsBytes(new RecommendationPublicationSnapshot(content.version(),false,content.productVersion(),content.productSourceHash(),reviewHash,
            content.name(),content.itemNumber(),content.specification(),content.description(),content.translations(),content.translatedSource(),
            content.referencePrice(),content.originalPrice(),content.discountAmount(),content.priceUnit(),content.offerStart(),content.offerEnd(),content.couponStart(),content.couponEnd(),
            content.offerNotes(),content.referenceContext(),content.gallery(),content.categoryIds(),content.supplierId(),content.showSupplier(),
            content.imageHash(),content.imageUrl(),content.offerIdentity(),content.catalog(),null,null)),RecommendationPublicationSnapshot.class);}
        catch(Exception e){throw new IllegalStateException("Cannot retain publication snapshot",e);}
    }
    public static RecommendationItem project(RecommendationItem identity,RecommendationPublicationSnapshot s) {
        var item=new RecommendationItem();
        item.id=identity.id;item.postId=identity.postId;item.productId=identity.productId;item.createdAt=identity.createdAt;
        item.publicationState=identity.publicationState;item.publishedAt=identity.publishedAt;item.publicationProductVersion=s.productVersion();item.publicationLegacy=s.legacy();
        item.name=s.name();item.itemNumber=s.itemNumber();item.specification=s.specification();item.description=s.description();
        item.translations=new TreeMap<>(s.translations());item.translatedSource=s.translatedSource();
        // Historical snapshot prices/dates are evidence only. ReferenceQuoteService supplies document projections.
        item.couponStart=s.couponStart();item.couponEnd=s.couponEnd();
        // Original source unit binds translation evidence only; it is never an effective price/unit fallback.
        item.sourcePrice=new RecommendationItem.SourcePrice(null,null,null,s.priceUnit(),null,null);
        item.offerNotes=s.offerNotes();item.referenceContext=s.referenceContext();item.gallery=List.copyOf(s.gallery());item.categoryIds=List.copyOf(s.categoryIds());
        item.supplierId=s.supplierId();item.showSupplier=s.showSupplier();item.imageHash=s.imageHash();item.imageUrl=s.imageUrl();item.offerIdentity=s.offerIdentity();
        if(s.catalog()!=null){
            var product=new Product();var recovery=new ProductCatalogRecovery();recovery.original=s.catalog();recovery.apply(product);
            ProductCatalogProjection.apply(item,item,product);
        }
        return item;
    }
    public static RecommendationItem.SourceFacts sourceFacts(RecommendationPublicationSnapshot s){
        var source=new RecommendationItem();source.name=s.name();source.priceUnit=s.priceUnit();source.offerNotes=s.offerNotes();source.specification=s.specification();source.description=s.description();
        return new RecommendationItem.SourceFacts(s.name(),s.itemNumber(),s.specification(),s.description(),s.translations(),source.getTranslationSource());
    }
    private static boolean filled(String value){return value!=null&&!value.isBlank();}
    private static boolean https(String value){try{var uri=java.net.URI.create(value);return "https".equals(uri.getScheme())&&uri.getHost()!=null&&uri.getUserInfo()==null&&uri.getRawFragment()==null;}catch(Exception e){return false;}}
    /** Missing/unstated price/window facts remain null; they are not inferred by publication. */
    public static void requireReady(RecommendationItem original,Product product,RecommendationPublicationSnapshot snapshot) {
        var shown=project(original,snapshot);var data=product==null?null:product.getCatalogData();
        if(product==null||data==null||data.reviewedAt()==null||data.reviewedBy()==null||!ProductCatalogService.translationsCurrent(product)
            ||!filled(shown.name)||!filled(shown.itemNumber)||!Objects.equals(original.productId,product.getId())||!Objects.equals(original.itemNumber,product.getItemNumber())||shown.gallery.isEmpty())
            throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.incomplete");
        for(String locale:List.of("ja-JP","zh-CN","zh-TW","en-US"))
            if(!filled(ProductCatalogService.text(product.getName(),locale))||!filled(ProductCatalogService.text(data.specification(),locale)))
                throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.incomplete");
        if(filled(original.offerNotes)&&(!"REVIEWED".equals(original.getTranslationStatus())||!original.translations.keySet().containsAll(Set.of("zh-CN","zh-TW","en-US"))))
            throw new ApiException(ErrorCode.INVALID_REQUEST,"translation.review_required");
        var context=original.referenceContext;
        if(context==null||!filled(context.supplierKey())||!filled(context.channel())||!filled(context.variantKey())||!filled(context.sourceMessageKey())||!https(context.sourceUrl()))
            throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.incomplete");
        for(var picture:shown.gallery)
            if(picture==null||picture.url()==null||!picture.url().startsWith("/api/storefront/recommendation-images/")
                ||picture.hash()==null||!picture.hash().matches("[0-9a-f]{64}")||!https(picture.sourceUrl())||picture.verifiedAt()==null)
                throw new ApiException(ErrorCode.INVALID_REQUEST,"gallery.invalid");
    }
}
