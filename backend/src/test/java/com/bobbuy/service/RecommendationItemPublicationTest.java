package com.bobbuy.service;

import com.bobbuy.api.RecommendationController;
import com.bobbuy.api.response.ApiException;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.function.BiFunction;
import org.junit.jupiter.api.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.junit.jupiter.api.Assertions.*;

/** Real service/projection code with in-memory repositories, not PG/transaction evidence. */
class RecommendationItemPublicationTest {
    final Map<Long,RecommendationPost> postRows=new LinkedHashMap<>();
    final Map<Long,RecommendationItem> itemRows=new LinkedHashMap<>();
    final Map<String,Product> productRows=new LinkedHashMap<>();
    final Map<String,RecommendationImage> imageRows=new HashMap<>();
    final List<ReferenceQuoteRevision> history=new ArrayList<>();
    final ProductPriceAdjustmentRepository priceDocuments=com.bobbuy.test.PriceDocumentFixtures.repository();
    final ObjectMapper json=new ObjectMapper().findAndRegisterModules();
    long itemSequence=1000;
    RecommendationService service;RecommendationTaxonomyService taxonomy;ReferenceQuoteService quotes;PublicProductCatalogService catalog;
    User merchant=new User(1000L,"Synthetic merchant",Role.AGENT,0);
    @SuppressWarnings("unchecked") <T>T repo(Class<T> type,BiFunction<String,Object[],Object> handler){
        return (T)Proxy.newProxyInstance(type.getClassLoader(),new Class<?>[]{type},(proxy,method,args)->{
            Object answer=handler.apply(method.getName(),args==null?new Object[0]:args);if(answer!=null)return answer;
            Class<?> result=method.getReturnType();if(result==Optional.class)return Optional.empty();if(result==boolean.class)return false;
            if(result==long.class)return 0L;if(result==int.class)return 0;if(Set.class.isAssignableFrom(result))return Set.of();
            if(Collection.class.isAssignableFrom(result)||Iterable.class==result)return List.of();return null;});
    }
    @BeforeEach void setup(){
        authenticate(1000L,"ROLE_AGENT");
        var posts=repo(RecommendationPostRepository.class,(name,args)->switch(name){
            case "findById"->Optional.ofNullable(postRows.get(args[0]));
            case "findByIdAndMerchantId"->Optional.ofNullable(postRows.get(args[0])).filter(p->Objects.equals(p.merchantId,args[1]));
            case "findByIdAndPublishedTrue"->Optional.ofNullable(postRows.get(args[0])).filter(p->p.published);
            case "findByPublishedTrue"->postRows.values().stream().filter(p->p.published).toList();
            case "findAllById"->postRows.values().stream().filter(p->((Collection<?>)args[0]).contains(p.id)).toList();
            case "saveAndFlush"->{var p=(RecommendationPost)args[0];p.version++;postRows.put(p.id,p);yield p;}
            default->null;});
        var items=repo(RecommendationItemRepository.class,(name,args)->switch(name){
            case "findById"->Optional.ofNullable(itemRows.get(args[0]));
            case "findByPostIdOrderById"->itemRows.values().stream().filter(i->Objects.equals(i.postId,args[0])).toList();
            case "findByPostIdInOrderById"->itemRows.values().stream().filter(i->((Collection<?>)args[0]).contains(i.postId)).toList();
            case "findByProductIdInOrderById"->itemRows.values().stream().filter(i->((Collection<?>)args[0]).contains(i.productId)).toList();
            case "findByPublishedByAndPublicationRequestId"->itemRows.values().stream().filter(i->Objects.equals(i.publishedBy,args[0])&&Objects.equals(i.publicationRequestId,args[1])).findFirst();
            case "findByPostIdAndAdditionPayloadHash"->itemRows.values().stream().filter(i->Objects.equals(i.postId,args[0])&&Objects.equals(i.additionPayloadHash,args[1])).findFirst();
            case "saveAndFlush"->{var i=(RecommendationItem)args[0];if(i.id==null)i.id=++itemSequence;itemRows.put(i.id,i);yield i;}
            default->null;});
        var products=repo(ProductRepository.class,(name,args)->switch(name){
            case "findById","lockById"->Optional.ofNullable(productRows.get(args[0])).filter(p->!p.isDeleted());
            case "findAll"->productRows.values().stream().filter(p->!p.isDeleted()).toList();
            case "findAllById"->productRows.values().stream().filter(p->!p.isDeleted()&&((Collection<?>)args[0]).contains(p.getId())).toList();
            case "deletedIds"->productRows.values().stream().filter(Product::isDeleted).map(Product::getId).collect(java.util.stream.Collectors.toSet());
            default->null;});
        var users=repo(UserRepository.class,(name,args)->switch(name){case "findById","lockById"->Objects.equals(args[0],merchant.getId())?Optional.of(merchant):Optional.empty();case "findAllById"->List.of(merchant);default->null;});
        var images=repo(RecommendationImageRepository.class,(name,args)->name.equals("findById")?Optional.ofNullable(imageRows.get(args[0])):null);
        var categories=repo(CategoryRepository.class,(name,args)->name.equals("findAllById")?List.of():null);
        var suppliers=repo(SupplierRepository.class,(name,args)->null);
        taxonomy=new RecommendationTaxonomyService(categories,suppliers,users,products,posts);
        var revisions=repo(ReferenceQuoteRevisionRepository.class,(name,args)->switch(name){
            case "findFirstByItemIdOrderByIdDesc"->history.stream().filter(h->Objects.equals(h.itemId,args[0])).reduce((a,b)->b);
            case "saveAndFlush"->{var row=(ReferenceQuoteRevision)args[0];row.id=(long)history.size()+1;history.add(row);yield row;}
            case "findByMerchantIdAndItemIdOrderById"->history.stream().filter(h->Objects.equals(h.merchantId,args[0])&&Objects.equals(h.itemId,args[1])).toList();
            default->null;});
        quotes=new ReferenceQuoteService(revisions,json,items,posts,priceDocuments);
        service=new RecommendationService(posts,items,images,products,users,new AuditLogService(),taxonomy,new RecommendationCatalogService(products),null,null,quotes,
            new RecommendationArticleService(repo(RecommendationArticleRevisionRepository.class,(name,args)->null),json));
        catalog=new PublicProductCatalogService(products,posts,items,taxonomy,quotes,categories);
    }
    @AfterEach void clear(){SecurityContextHolder.clearContext();}
    void authenticate(long id,String authority){SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("merchant-"+id,"",List.of(new SimpleGrantedAuthority(authority))));}
    RecommendationPost post(long id){var p=new RecommendationPost();p.id=id;p.merchantId=1000L;p.title="Synthetic issue "+id;p.body="Synthetic reviewed source";p.articleSourceLocale="ja-JP";postRows.put(id,p);return p;}
    Product product(String code){
        var p=new Product();p.setId("product-"+code);p.setMerchantId(1000L);p.setItemNumber(code);p.setRecordVersion(2L);p.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);
        var names=new HashMap<String,String>();var specs=new HashMap<String,String>();for(String locale:List.of("ja-JP","zh-CN","zh-TW","en-US")){names.put(locale,"Synthetic "+code);specs.put(locale,"24 cartons of 200ml");}
        p.setName(names);p.setDescription(new HashMap<>());
        var media=new MediaGalleryItem("/api/storefront/recommendation-images/"+code,MediaType.IMAGE,Map.of("ja-JP","Synthetic carton"),true,"https://www.costco.co.jp/"+code+".jpg","www.costco.co.jp","OFFICIAL_PRODUCT");media.setSha256("a".repeat(64));p.setMediaGallery(new ArrayList<>(List.of(media)));
        p.setCatalogData(new ProductCatalogData(specs,null,"24 cartons",List.of(),null,null,1000L,Instant.parse("2026-01-01T00:00:00Z")));
        refreshTranslations(p);productRows.put(p.getId(),p);
        var image=new RecommendationImage();image.id=code;image.merchantId=1000L;image.imageHash="a".repeat(64);image.accessScope="PUBLIC";imageRows.put(code,image);return p;
    }
    void refreshTranslations(Product p){var d=p.getCatalogData();p.setCatalogData(new ProductCatalogData(d.specification(),d.model(),d.packaging(),d.categoryIds(),d.supplierId(),ProductCatalogService.sourceHash(p),d.reviewedBy(),d.reviewedAt()));}
    RecommendationItem item(RecommendationPost post,long id,String code){var p=product(code);var i=new RecommendationItem();i.id=id;i.postId=post.id;i.productId=p.getId();i.name="Source "+code;i.itemNumber=code;i.specification="Original package wording";i.imageHash="b".repeat(64);i.imageUrl="/api/storefront/recommendation-images/source-"+code;i.referencePrice=BigDecimal.TEN;i.priceUnit="per carton";com.bobbuy.test.PriceDocumentFixtures.start(i,LocalDate.of(2020,1,1));com.bobbuy.test.PriceDocumentFixtures.end(i,LocalDate.of(2099,1,1));i.referenceContext=new ReferenceOfferContext("COSTCO","COSTCO_ONLINE","carton-"+code,"synthetic-message-"+post.id,"https://www.costco.co.jp/source/"+post.id,null,null,false,null,true);i.offerIdentity=quotes.identity(i);itemRows.put(id,i);
        // Publication tests use an independently reviewed canonical reference-price fixture.
        quotes.snapshot(i,1000L);var price=priceDocuments.forReferenceItem(id).get(0);price.status=ProductPriceAdjustment.Status.APPROVED;price.approvedBy=1000L;price.approvedAt=Instant.parse("2020-01-01T00:00:00Z");price.sourceNote="Synthetic independently reviewed reference quote";price.evidence.put("reviewRequired",false);return i;}
    RecommendationService.Detail publish(RecommendationPost p,RecommendationItem i){var s=RecommendationPublication.candidate(i,productRows.get(i.productId));return service.publishItem(p.id,i.id,UUID.randomUUID(),p.version,s.productVersion(),s.reviewHash(),true);}
    List<String> failureCodes(RecommendationPost p,RecommendationItem i){var s=RecommendationPublication.candidate(i,productRows.get(i.productId));var failure=assertThrows(PublicationValidationException.class,()->service.publishItem(p.id,i.id,UUID.randomUUID(),p.version,s.productVersion(),s.reviewHash(),true));return failure.failures().stream().map(PublicationValidationException.Failure::code).toList();}

    @Test void issue11ReportsOnlyMissingSupplierIdentifierWithoutTheGenericArticleError(){
        var p=post(11);var i=item(p,389,"82848");var c=i.referenceContext;i.referenceContext=new ReferenceOfferContext(null,c.channel(),c.variantKey(),c.sourceMessageKey(),c.sourceUrl(),c.activityStart(),c.activityEnd(),c.activityApplies(),c.windowEvidence(),c.startSearchComplete());
        assertEquals(List.of("REFERENCE_SUPPLIER_KEY_MISSING"),failureCodes(p,i));
    }

    @Test void issue12ReportsEverySourceAndLocalizedMasterGap(){
        var p=post(12);var i=item(p,390,"MIRROR-12");var product=productRows.get(i.productId);var c=i.referenceContext;
        i.referenceContext=new ReferenceOfferContext(c.supplierKey(),null,c.variantKey(),null,null,c.activityStart(),c.activityEnd(),c.activityApplies(),c.windowEvidence(),c.startSearchComplete());
        product.getName().remove("zh-TW");var d=product.getCatalogData();var specs=new HashMap<>(d.specification());specs.remove("zh-TW");specs.remove("en-US");product.setCatalogData(new ProductCatalogData(specs,d.model(),d.packaging(),d.categoryIds(),d.supplierId(),d.translatedSource(),d.reviewedBy(),d.reviewedAt()));
        assertEquals(List.of("PRODUCT_NAME_ZH_TW_MISSING","PRODUCT_SPECIFICATION_ZH_TW_MISSING","PRODUCT_SPECIFICATION_EN_US_MISSING","REFERENCE_CHANNEL_MISSING","REFERENCE_SOURCE_MESSAGE_KEY_MISSING","REFERENCE_SOURCE_URL_INVALID"),failureCodes(p,i));
    }

    @Test void firstReadyItemOpensIssueWithoutPendingLeakThroughDetailBrowseDirectoryCatalogOrCover(){
        var p=post(8);var ready=item(p,271,"47506");var pending=item(p,272,"1731065");productRows.get(pending.productId).setMediaGallery(List.of());
        assertThrows(ApiException.class,()->service.publicGet(8L,null));publish(p,ready);assertTrue(p.published);assertNotNull(p.publisherId);assertNotNull(p.publishedAt);
        var visible=service.publicGet(8L,null);assertEquals(List.of(271L),visible.items().stream().map(i->i.id).toList());assertEquals("/api/storefront/recommendation-images/47506",visible.post().coverImageUrl());
        var browse=new PublicRecommendationBrowseService(service);assertEquals(1,browse.page(0,null,8L,"en-US","all","","",null).scopeTotal());assertEquals(0,browse.page(0,null,8L,"en-US","all","1731065","",null).scopeTotal());assertEquals(1,browse.directory(0,null,"en-US","all","",null).items().get(0).itemCount());
        assertEquals(List.of(ready.productId),catalog.page(0,null).items().stream().map(PublicProductCatalogService.Entry::productId).toList());assertEquals(2,itemRows.size());assertEquals("PENDING",pending.publicationState);assertNull(pending.publicationSnapshot);
    }
    @Test void sevenPublicItemsStayOnlineWhileAnEighthIsAppendedAndThenPublished(){
        var p=post(9);for(int n=0;n<7;n++)publish(p,item(p,382+n,"READY-"+n));var old=service.publicGet(9L,null).items().stream().map(i->i.id).toList();
        var newProduct=product("NEXT");var facts=new RecommendationFacts("Synthetic NEXT","NEXT",BigDecimal.ONE,null,null,"per carton",null,null,null,null,null,new ReferenceOfferContext("COSTCO","COSTCO_ONLINE","carton-NEXT","synthetic-message-9","https://www.costco.co.jp/source/9",null,null,false,null,true),null,null,null,null);
        service.fromProduct(9L,newProduct.getId(),2L,facts,p.version,true);assertEquals(old,service.publicGet(9L,null).items().stream().map(i->i.id).toList());
        var pending=itemRows.values().stream().filter(i->i.productId.equals(newProduct.getId())).findFirst().orElseThrow();assertEquals("PENDING",pending.publicationState);publish(p,pending);assertEquals(8,service.publicGet(9L,null).items().size());assertTrue(p.published);assertTrue(itemRows.keySet().containsAll(old));
    }
    @Test void lostResponseReplayIsIdempotentButChangedBodyOrCrossItemKeyConflicts(){
        var p=post(8);var i=item(p,271,"47506");var other=item(p,272,"OTHER");var s=RecommendationPublication.candidate(i,productRows.get(i.productId));var key=UUID.randomUUID();long version=p.version;
        service.publishItem(p.id,i.id,key,version,2L,s.reviewHash(),true);long after=p.version;Instant at=i.publishedAt;int afterHistory=history.size();
        service.publishItem(p.id,i.id,key,version,2L,s.reviewHash(),true);assertEquals(after,p.version);assertEquals(at,i.publishedAt);assertEquals(afterHistory,history.size());
        assertThrows(org.springframework.orm.ObjectOptimisticLockingFailureException.class,()->service.publishItem(p.id,i.id,key,version+1,2L,s.reviewHash(),true));
        var otherS=RecommendationPublication.candidate(other,productRows.get(other.productId));assertThrows(org.springframework.orm.ObjectOptimisticLockingFailureException.class,()->service.publishItem(p.id,other.id,key,p.version,2L,otherS.reviewHash(),true));assertEquals("PENDING",other.publicationState);
    }
    @Test void currentVersionAndEvidenceHashBothBindTheDecision(){
        var p=post(8);var i=item(p,271,"47506");var product=productRows.get(i.productId);var old=RecommendationPublication.candidate(i,product);
        assertThrows(org.springframework.orm.ObjectOptimisticLockingFailureException.class,()->service.publishItem(p.id,i.id,UUID.randomUUID(),p.version+1,2L,old.reviewHash(),true));
        product.setRecordVersion(3L);assertThrows(org.springframework.orm.ObjectOptimisticLockingFailureException.class,()->service.publishItem(p.id,i.id,UUID.randomUUID(),p.version,2L,old.reviewHash(),true));
        product.setRecordVersion(2L);i.offerNotes="Changed source terms after review";assertThrows(org.springframework.orm.ObjectOptimisticLockingFailureException.class,()->service.publishItem(p.id,i.id,UUID.randomUUID(),p.version,2L,old.reviewHash(),true));assertFalse(p.published);assertNull(i.publicationSnapshot);
    }
    @Test void changedMasterDoesNotRewriteAnOlderIssueOrItsQuoteAndSource(){
        var p=post(8);var i=item(p,271,"47506");publish(p,i);var before=service.publicGet(8L,null).items().get(0);var product=productRows.get(i.productId);int afterHistory=history.size();
        product.setRecordVersion(3L);var d=product.getCatalogData();var corrected=new HashMap<>(d.specification());corrected.replaceAll((locale,spec)->"A later reviewed carton specification");product.setCatalogData(new ProductCatalogData(corrected,d.model(),d.packaging(),d.categoryIds(),d.supplierId(),null,d.reviewedBy(),Instant.now()));product.getName().replaceAll((locale,name)->"Later product name");product.setMediaGallery(List.of());refreshTranslations(product);
        var after=service.publicGet(8L,null).items().get(0);assertEquals(before.name,after.name);assertEquals(before.specification,after.specification);assertEquals(before.gallery,after.gallery);assertEquals(2L,after.publicationProductVersion);assertEquals(0,BigDecimal.TEN.compareTo(after.referencePrice));assertEquals("Original package wording",i.specification);assertEquals("Source 47506",i.name);assertEquals(afterHistory,history.size());
    }
    @Test void pendingQuotationDoesNotInfluencePublicPriceResolution(){
        var p=post(8);var ready=item(p,271,"47506");publish(p,ready);var pending=new RecommendationItem();pending.id=272L;pending.postId=p.id;pending.productId=ready.productId;pending.itemNumber=ready.itemNumber;pending.name="Private quote";pending.priceUnit=ready.priceUnit;com.bobbuy.test.PriceDocumentFixtures.start(pending,com.bobbuy.test.PriceDocumentFixtures.start(ready));com.bobbuy.test.PriceDocumentFixtures.end(pending,com.bobbuy.test.PriceDocumentFixtures.end(ready));pending.referenceContext=ready.referenceContext;pending.referencePrice=new BigDecimal("999");itemRows.put(272L,pending);
        var visible=service.publicGet(8L,null).items().get(0);assertEquals("ACTIVE",visible.referenceQuote.state());assertEquals(0,BigDecimal.TEN.compareTo(visible.referenceQuote.amount()));assertEquals(List.of(271L),visible.referenceQuote.itemIds());
    }
    @Test void permissionFailuresCannotReadOrPublishOtherMerchantItems(){
        var p=post(8);var i=item(p,271,"47506");var s=RecommendationPublication.candidate(i,productRows.get(i.productId));
        authenticate(2000L,"ROLE_AGENT");assertThrows(ApiException.class,()->service.publishItem(p.id,i.id,UUID.randomUUID(),0,2L,s.reviewHash(),true));
        authenticate(1000L,"ROLE_CUSTOMER");assertThrows(ApiException.class,()->service.publishItem(p.id,i.id,UUID.randomUUID(),0,2L,s.reviewHash(),true));SecurityContextHolder.clearContext();assertThrows(ApiException.class,()->service.publishItem(p.id,i.id,UUID.randomUUID(),0,2L,s.reviewHash(),true));assertFalse(p.published);assertNull(i.publicationSnapshot);
    }
    @Test void missingReviewSourceTranslationOrVerifiedImageCannotPublish(){
        var p=post(8);var i=item(p,271,"47506");var product=productRows.get(i.productId);i.referenceContext=null;
        assertEquals(List.of("REFERENCE_SUPPLIER_KEY_MISSING","REFERENCE_CHANNEL_MISSING","REFERENCE_VARIANT_KEY_MISSING","REFERENCE_SOURCE_MESSAGE_KEY_MISSING","REFERENCE_SOURCE_URL_INVALID"),failureCodes(p,i));assertFalse(p.published);i.referenceContext=new ReferenceOfferContext("COSTCO","COSTCO_ONLINE","v","message","https://www.costco.co.jp/source",null,null,false,null,true);
        product.getName().remove("en-US");assertEquals(List.of("PRODUCT_NAME_EN_US_MISSING"),failureCodes(p,i));product.getName().put("en-US","Synthetic 47506");refreshTranslations(product);
        i.itemNumber="A different source ITEM";assertEquals(List.of("ITEM_NUMBER_MISMATCH"),failureCodes(p,i));i.itemNumber="47506";
        product.getMediaGallery().get(0).setSha256(null);assertEquals(List.of("GALLERY_IMAGE_INVALID"),failureCodes(p,i));assertNull(i.publicationSnapshot);
    }
    @Test void publishedItemsCannotBeMutatedOrRemovedThroughPendingEditors(){
        var p=post(8);var i=item(p,271,"47506");publish(p,i);assertThrows(ApiException.class,()->service.removeItem(p.id,i.id,p.version));assertThrows(ApiException.class,()->service.gallery(p.id,i.id,p.version,List.of()));long version=p.version;service.catalog(p.id,List.of(i.id),null,p.version);assertEquals(version,p.version);assertThrows(ApiException.class,()->service.catalog(p.id,List.of(i.id),"another-product",p.version));
        assertThrows(ApiException.class,()->service.classify(p.id,List.of(i.id),List.of(),"replace",true,null,false,false,p.version));assertTrue(itemRows.containsKey(i.id));assertTrue(p.published);
    }
    @Test void newlyAddedDraftIsNeverMadePublicByTheOldWholeIssueButton(){
        var p=post(8);item(p,271,"47506");assertThrows(ApiException.class,()->service.publish(p.id,p.version,true));assertFalse(p.published);assertEquals(0,service.publicBrowseEntries(null).size());
    }
    @Test void fromProductLostResponseRetryRecognizesTheCreatedVersionEvenAfterMasterChange(){
        var p=post(9);var product=product("NEXT");var facts=new RecommendationFacts("Synthetic NEXT","NEXT",null,null,null,null,null,null,null,null,null,null,null,null,null,null);
        long originalVersion=p.version;service.fromProduct(p.id,product.getId(),2,facts,originalVersion,true);assertEquals(1,itemRows.size());product.setRecordVersion(3L);product.getName().put("ja-JP","Later name");
        service.fromProduct(p.id,product.getId(),2,facts,originalVersion,true);assertEquals(1,itemRows.size());assertFalse(p.published);
        var changed=new RecommendationFacts(facts.name(),facts.itemNumber(),null,null,null,null,null,null,null,null,null,null,"Changed raw source brand",null,null,null);
        assertThrows(org.springframework.orm.ObjectOptimisticLockingFailureException.class,()->service.fromProduct(p.id,product.getId(),2,changed,originalVersion,true));
    }
    @Test void publicationDtoRejectsIdentityAndPermissionFields(){
        String valid="{\"requestId\":\""+UUID.randomUUID()+"\",\"version\":0,\"productVersion\":2,\"sourceHash\":\""+"a".repeat(64)+"\",\"reviewed\":true";
        assertDoesNotThrow(()->json.readValue(valid+"}",RecommendationController.ItemPublication.class));
        for(String field:List.of("merchantId","userId","publicationState","publishedBy"))assertThrows(Exception.class,()->json.readValue(valid+",\""+field+"\":1000}",RecommendationController.ItemPublication.class));
    }
    @Test void syntheticLegacyCutoverKeepsTheAlreadyVisibleCartonAndOnlyPublishesTheLaterRecipeInItsNewIssue()throws Exception{
        var p8=post(8);var original=item(p8,271,"SYNTHETIC-CARTON");var master=productRows.get(original.productId);
        original.name="Synthetic source bottle name";original.specification="Original synthetic bottle wording";
        original.originalPrice=new BigDecimal("12");original.discountAmount=new BigDecimal("2");original.offerNotes="Synthetic tax included; original offer conditions";
        master.getName().replaceAll((locale,name)->"Confirmed synthetic carton");master.setBrand("Confirmed synthetic brand");refreshTranslations(master);
        original.offerIdentity=quotes.identity(original);String sourceHash=RecommendationPublication.candidate(original,null).reviewHash();
        var sourceBefore=json.valueToTree(RecommendationPublication.candidate(original,null));
        // Fixed82's public path copied the source, then applied the same-owner catalog projection.
        var old82=new RecommendationItem();old82.id=original.id;old82.postId=original.postId;old82.productId=original.productId;
        old82.name=original.name;old82.itemNumber=original.itemNumber;old82.specification=original.specification;old82.description=original.description;
        old82.translations=new TreeMap<>(original.translations);old82.translatedSource=original.translatedSource;old82.gallery=List.copyOf(original.gallery);
        old82.referencePrice=original.referencePrice;old82.originalPrice=original.originalPrice;old82.discountAmount=original.discountAmount;old82.priceUnit=original.priceUnit;
        com.bobbuy.test.PriceDocumentFixtures.start(old82,com.bobbuy.test.PriceDocumentFixtures.start(original));com.bobbuy.test.PriceDocumentFixtures.end(old82,com.bobbuy.test.PriceDocumentFixtures.end(original));old82.couponStart=original.couponStart;old82.couponEnd=original.couponEnd;
        old82.referenceContext=original.referenceContext;old82.offerNotes=original.offerNotes;old82.imageHash=original.imageHash;old82.imageUrl=original.imageUrl;
        old82.categoryIds=List.copyOf(original.categoryIds);old82.supplierId=original.supplierId;old82.showSupplier=original.showSupplier;
        assertEquals(p8.merchantId,master.getMerchantId());ProductCatalogProjection.apply(old82,original,master);
        old82.imageHash=null;old82.imageUrl=old82.gallery.isEmpty()?null:old82.gallery.get(0).url();
        assertEquals("24 cartons of 200ml",old82.specification);assertEquals("Confirmed synthetic carton",old82.name);assertEquals("Confirmed synthetic brand",old82.brand);assertFalse(old82.gallery.isEmpty());
        // Negative control: the former catalog=null migration re-exposed the old source.
        var formerCutover=RecommendationPublication.project(original,RecommendationPublication.candidate(original,null));
        assertEquals("Original synthetic bottle wording",formerCutover.specification);
        assertNotEquals(old82.specification,formerCutover.specification);assertNotEquals(old82.gallery,formerCutover.gallery);
        // Synthetic equivalent of the SQL cutover copy: original review/version remains unknown.
        var cutover=(com.fasterxml.jackson.databind.node.ObjectNode)json.valueToTree(RecommendationPublication.candidate(original,master));
        cutover.put("legacy",true).putNull("productVersion").putNull("productSourceHash").putNull("reviewHash");
        cutover.put("legacyDisplayProductVersion",2L).put("legacyDisplayProvenance","VISIBLE_AT_V31_CUTOVER");
        original.publicationSnapshot=json.treeToValue(cutover,RecommendationPublicationSnapshot.class);original.publicationState="PUBLISHED";
        original.publishedAt=Instant.parse("2026-01-01T00:00:00Z");original.publishedBy=1000L;p8.published=true;p8.publishedAt=original.publishedAt;p8.publisherId=1000L;p8.publisherName="Synthetic cutover publisher";
        byte[] frozen=json.writeValueAsBytes(original.publicationSnapshot);var shown=service.publicGet(8L,null).items().get(0);
        assertEquals(old82.name,shown.name);assertEquals(old82.specification,shown.specification);assertEquals(old82.brand,shown.brand);assertEquals(old82.gallery,shown.gallery);assertEquals(old82.imageUrl,shown.imageUrl);
        assertNull(original.publicationSnapshot.productVersion());assertNull(original.publicationSnapshot.productSourceHash());assertNull(original.publicationSnapshot.reviewHash());
        assertEquals(Long.valueOf(2),original.publicationSnapshot.legacyDisplayProductVersion());assertEquals("VISIBLE_AT_V31_CUTOVER",original.publicationSnapshot.legacyDisplayProvenance());
        assertNull(shown.publicationProductVersion);assertTrue(shown.publicationLegacy);assertEquals(sourceBefore,json.valueToTree(RecommendationPublication.candidate(original,null)));
        // A real recipe change belongs to the later issue, not to the earlier cutover occurrence.
        master.setRecordVersion(3L);master.getName().replaceAll((locale,name)->"Synthetic recipe v3 carton");master.setBrand("Synthetic recipe v3 brand");
        var specs=new HashMap<>(master.getCatalogData().specification());specs.replaceAll((locale,spec)->"12 cartons of synthetic new recipe 250ml");
        master.setCatalogData(new ProductCatalogData(specs,"Synthetic model v3","12 cartons",List.of(),null,null,1000L,Instant.parse("2026-02-01T00:00:00Z")));
        var image=new MediaGalleryItem("/api/storefront/recommendation-images/synthetic-v3",MediaType.IMAGE,Map.of("ja-JP","Synthetic recipe v3"),true,"https://www.costco.co.jp/synthetic-v3.jpg","www.costco.co.jp","OFFICIAL_PRODUCT");image.setSha256("c".repeat(64));master.setMediaGallery(new ArrayList<>(List.of(image)));refreshTranslations(master);
        var storedImage=new RecommendationImage();storedImage.id="synthetic-v3";storedImage.merchantId=1000L;storedImage.imageHash="c".repeat(64);storedImage.accessScope="PUBLIC";imageRows.put(storedImage.id,storedImage);
        var p9=post(9);var next=new RecommendationItem();next.id=272L;next.postId=p9.id;next.productId=master.getId();next.itemNumber=master.getItemNumber();next.name="Synthetic recipe v3 source";next.specification="Synthetic recipe v3 source pack";
        next.referencePrice=new BigDecimal("20");next.priceUnit=original.priceUnit;com.bobbuy.test.PriceDocumentFixtures.start(next,com.bobbuy.test.PriceDocumentFixtures.start(original));com.bobbuy.test.PriceDocumentFixtures.end(next,com.bobbuy.test.PriceDocumentFixtures.end(original));
        next.referenceContext=new ReferenceOfferContext("COSTCO","COSTCO_ONLINE","recipe-v3-SYNTHETIC-CARTON","synthetic-recipe-message-9","https://www.costco.co.jp/source/9",null,null,false,null,true);next.offerIdentity=quotes.identity(next);itemRows.put(next.id,next);
        assertEquals("PENDING",next.publicationState);assertNull(next.publicationSnapshot);assertThrows(ApiException.class,()->service.publicGet(9L,null));
        assertTrue(service.publicBrowseEntries(null).stream().flatMap(detail->detail.items().stream()).noneMatch(row->row.id.equals(next.id)));
        var browse=new PublicRecommendationBrowseService(service);assertEquals(0,browse.page(0,null,9L,"en-US","all","","",null).scopeTotal());
        var beforePublish=catalog.page(0,null).items().get(0);assertEquals(old82.name,beforePublish.name().get("ja-JP"));assertEquals(old82.specification,beforePublish.specification().get("ja-JP"));assertEquals(old82.gallery,beforePublish.gallery());assertTrue(beforePublish.referenceOffers().stream().noneMatch(offer->offer.postId().equals(9L)));
        publish(p9,next);var later=service.publicGet(9L,null).items().get(0);assertEquals("Synthetic recipe v3 carton",later.name);assertEquals("12 cartons of synthetic new recipe 250ml",later.specification);assertEquals("Synthetic recipe v3 brand",later.brand);assertEquals(image.getUrl(),later.gallery.get(0).url());assertEquals(Long.valueOf(3),later.publicationProductVersion);assertEquals(0,BigDecimal.TEN.compareTo(later.referencePrice));assertEquals(ProductPriceAdjustment.Status.DRAFT,priceDocuments.forReferenceItem(next.id).get(0).status);assertEquals(0,new BigDecimal("20").compareTo(priceDocuments.forReferenceItem(next.id).get(0).line(next.productId).amount));
        var retained=service.publicGet(8L,null).items().get(0);assertEquals(old82.name,retained.name);assertEquals(old82.specification,retained.specification);assertEquals(old82.brand,retained.brand);assertEquals(old82.gallery,retained.gallery);assertEquals(old82.imageUrl,retained.imageUrl);
        assertEquals(0,BigDecimal.TEN.compareTo(retained.referencePrice));assertEquals(0,BigDecimal.TEN.compareTo(retained.referenceQuote.amount()));assertEquals(original.originalPrice,retained.originalPrice);assertEquals(original.discountAmount,retained.discountAmount);assertEquals(original.priceUnit,retained.priceUnit);assertEquals(original.offerNotes,retained.offerNotes);assertEquals(original.referenceContext.channel(),retained.referenceContext.channel());assertEquals(original.referenceContext.sourceUrl(),retained.referenceContext.sourceUrl());assertEquals(com.bobbuy.test.PriceDocumentFixtures.start(original),com.bobbuy.test.PriceDocumentFixtures.start(retained));assertEquals(com.bobbuy.test.PriceDocumentFixtures.end(original),com.bobbuy.test.PriceDocumentFixtures.end(retained));
        assertArrayEquals(frozen,json.writeValueAsBytes(original.publicationSnapshot));assertEquals(sourceBefore,json.valueToTree(RecommendationPublication.candidate(original,null)));assertEquals(sourceHash,RecommendationPublication.candidate(original,null).reviewHash());assertEquals(quotes.identity(original),original.offerIdentity);
        assertEquals("Synthetic source bottle name",original.name);assertEquals("Original synthetic bottle wording",original.specification);assertEquals("b".repeat(64),original.imageHash);assertEquals("/api/storefront/recommendation-images/source-SYNTHETIC-CARTON",original.imageUrl);
    }
    @Test void legacyVersionRemainsUnknownAndStoredIssueFactsBeatAnUnrelatedCurrentMaster()throws Exception{
        var p=post(8);var i=item(p,271,"47506");var node=json.valueToTree(RecommendationPublication.candidate(i,null));
        ((com.fasterxml.jackson.databind.node.ObjectNode)node).put("legacy",true).putNull("reviewHash");
        i.publicationSnapshot=json.treeToValue(node,RecommendationPublicationSnapshot.class);i.publicationState="PUBLISHED";i.publishedAt=Instant.parse("2026-01-01T00:00:00Z");p.published=true;p.publisherId=1000L;p.publisherName="Legacy publisher";p.publishedAt=i.publishedAt;
        var master=productRows.get(i.productId);master.setRecordVersion(99L);master.getName().replaceAll((locale,name)->"Unrelated current master recipe");
        var shown=service.publicGet(8L,null).items().get(0);assertEquals("Source 47506",shown.name);assertEquals("Original package wording",shown.specification);assertTrue(shown.publicationLegacy);assertNull(shown.publicationProductVersion);assertNull(shown.publicationReviewHash);assertNull(i.publicationSnapshot.catalog());assertEquals(0,BigDecimal.TEN.compareTo(shown.referencePrice));assertEquals(i.referenceContext.sourceUrl(),shown.referenceContext.sourceUrl());
        var row=catalog.page(0,null).items().get(0);assertEquals("Source 47506",row.name().get("ja-JP"));assertFalse(row.name().values().contains("Unrelated current master recipe"));
    }
}
