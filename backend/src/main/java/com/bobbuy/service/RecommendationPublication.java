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
        var failures=new ArrayList<PublicationValidationException.Failure>();
        if(product==null)add(failures,"PRODUCT_MISSING","recommendation.publication.product_missing","PRODUCT_MASTER");
        if(data==null)add(failures,"CATALOG_DATA_MISSING","recommendation.publication.catalog_missing","PRODUCT_MASTER");
        if(data!=null&&(data.reviewedAt()==null||data.reviewedBy()==null))add(failures,"CATALOG_REVIEW_REQUIRED","recommendation.publication.catalog_review","PRODUCT_MASTER");
        if(product!=null&&data!=null&&!ProductCatalogService.translationsCurrent(product))add(failures,"CATALOG_TRANSLATIONS_STALE","recommendation.publication.translations_stale","PRODUCT_MASTER");
        if(!filled(shown.name))add(failures,"PRODUCT_NAME_MISSING","recommendation.publication.name_missing","PRODUCT_MASTER");
        if(!filled(shown.itemNumber))add(failures,"ITEM_NUMBER_MISSING","recommendation.publication.item_number_missing","PRODUCT_MASTER");
        if(product!=null&&!Objects.equals(original.productId,product.getId()))add(failures,"PRODUCT_LINK_MISMATCH","recommendation.publication.product_link","PRODUCT_MASTER");
        if(product!=null&&!Objects.equals(original.itemNumber,product.getItemNumber()))add(failures,"ITEM_NUMBER_MISMATCH","recommendation.publication.item_number_mismatch","PRODUCT_MASTER");
        if(shown.gallery.isEmpty())add(failures,"GALLERY_EMPTY","recommendation.publication.gallery_empty","PRODUCT_MASTER");
        if(product!=null&&data!=null)for(String locale:List.of("ja-JP","zh-CN","zh-TW","en-US")){
            if(!filled(ProductCatalogService.text(product.getName(),locale)))add(failures,"PRODUCT_NAME_"+locale.replace('-','_').toUpperCase(Locale.ROOT)+"_MISSING","recommendation.publication.localized_name."+locale,"PRODUCT_MASTER");
            if(!filled(ProductCatalogService.text(data.specification(),locale)))add(failures,"PRODUCT_SPECIFICATION_"+locale.replace('-','_').toUpperCase(Locale.ROOT)+"_MISSING","recommendation.publication.localized_specification."+locale,"PRODUCT_MASTER");
        }
        if(filled(original.offerNotes)&&(!"REVIEWED".equals(original.getTranslationStatus())||!original.translations.keySet().containsAll(Set.of("zh-CN","zh-TW","en-US"))))
            add(failures,"OFFER_TRANSLATION_REVIEW_REQUIRED","recommendation.publication.offer_translation","ITEM_TRANSLATION");
        var context=original.referenceContext;
        if(context==null||!filled(context.supplierKey()))add(failures,"REFERENCE_SUPPLIER_KEY_MISSING","recommendation.publication.supplier_key","SOURCE_CONTEXT");
        if(context==null||!filled(context.channel()))add(failures,"REFERENCE_CHANNEL_MISSING","recommendation.publication.channel","SOURCE_CONTEXT");
        if(context==null||!filled(context.variantKey()))add(failures,"REFERENCE_VARIANT_KEY_MISSING","recommendation.publication.variant_key","SOURCE_CONTEXT");
        if(context==null||!filled(context.sourceMessageKey()))add(failures,"REFERENCE_SOURCE_MESSAGE_KEY_MISSING","recommendation.publication.source_message_key","SOURCE_CONTEXT");
        if(context==null||!https(context.sourceUrl()))add(failures,"REFERENCE_SOURCE_URL_INVALID","recommendation.publication.source_url","SOURCE_CONTEXT");
        for(var picture:shown.gallery)
            if(picture==null||picture.url()==null||!picture.url().startsWith("/api/storefront/recommendation-images/")
                ||picture.hash()==null||!picture.hash().matches("[0-9a-f]{64}")||!https(picture.sourceUrl())||picture.verifiedAt()==null)
                {add(failures,"GALLERY_IMAGE_INVALID","recommendation.publication.gallery_invalid","PRODUCT_MASTER");break;}
        if(!failures.isEmpty())throw new PublicationValidationException(failures);
    }
    private static void add(List<PublicationValidationException.Failure> failures,String code,String key,String target){failures.add(new PublicationValidationException.Failure(code,key,target));}
}
