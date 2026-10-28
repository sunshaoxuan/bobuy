package com.bobbuy.service;

import com.bobbuy.api.response.*;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.MerchantScope;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class RecommendationService {
    private final RecommendationPostRepository posts;
    private final RecommendationItemRepository items;
    private final RecommendationImageRepository images;
    private final ProductRepository products;
    private final UserRepository users;
    private final AuditLogService audit;
    private final RecommendationTaxonomyService taxonomy;
    private final RecommendationCatalogService catalog;
    private final ProductSaleService sales;
    private final MediaBinaryService binaries;

    public RecommendationService(RecommendationPostRepository posts, RecommendationItemRepository items,
            RecommendationImageRepository images, ProductRepository products, UserRepository users,
            AuditLogService audit, RecommendationTaxonomyService taxonomy, RecommendationCatalogService catalog, ProductSaleService sales,MediaBinaryService binaries) {
        this.posts = posts; this.items = items; this.images = images; this.products = products;
        this.users = users; this.audit = audit; this.taxonomy = taxonomy; this.catalog = catalog; this.sales=sales;this.binaries=binaries;
    }
    public record Summary(Long id, String title, boolean published, long version, LocalDateTime updatedAt, java.time.Instant publishedAt, String publisherName, String coverImageUrl, Long merchantId) {}
    public record Detail(Summary post, String body, List<RecommendationItem> items) {}
    public record Upload(Detail detail, boolean productCreated, boolean imageReused, boolean priceUpdated) {}
    private Summary summary(RecommendationPost post, String cover) { return new Summary(post.id, post.title, post.published, post.version, post.updatedAt, post.publishedAt, post.publisherName, cover, post.merchantId); }
    public record PublicNode(Long id, String name) {}
    @Transactional(readOnly = true)
    public List<PublicNode> publicNodes() {
        var nodes = new TreeMap<Long, String>();
        posts.findByPublishedTrue().forEach(post -> nodes.put(post.merchantId, post.publisherName));
        return nodes.entrySet().stream().map(e -> new PublicNode(e.getKey(), e.getValue())).toList();
    }
    private Detail detail(RecommendationPost post) { return detail(post,false); }
    private Detail detail(RecommendationPost post,boolean publicView) {
        var linked = taxonomy.display(items.findByPostIdOrderById(post.id),publicView);
        return new Detail(summary(post, linked.isEmpty()?null:publicView?(linked.get(0).gallery.isEmpty()?null:linked.get(0).gallery.get(0).url()):linked.get(0).imageUrl), post.body, linked);
    }
    private Long owner() {
        Long owner = MerchantScope.current();
        if (owner == null) throw new ApiException(ErrorCode.FORBIDDEN, "error.auth.forbidden");
        return owner;
    }
    private void lockOwner() { users.lockById(owner()).orElseThrow(() -> new ApiException(ErrorCode.FORBIDDEN, "error.auth.forbidden")); }
    private RecommendationPost owned(Long id) { return posts.findByIdAndMerchantId(id, owner()).orElseThrow(RecommendationService::missing); }
    private static ApiException missing() { return new ApiException(ErrorCode.RESOURCE_NOT_FOUND, "error.recommendation.not_found"); }
    private static void editable(RecommendationPost post) {
        if (post.published) throw new ApiException(ErrorCode.INVALID_STATUS, "error.recommendation.published");
    }
    private static void version(RecommendationPost post, long version) {
        if (post.version != version) throw new ApiException(ErrorCode.INVALID_REQUEST, "error.recommendation.conflict");
    }
    private void touch(RecommendationPost post) { post.updatedAt = LocalDateTime.now(); posts.saveAndFlush(post); }

    @Transactional(readOnly = true)
    public List<Summary> list(int page) {
        var paging = PageRequest.of(Math.max(0, page), 20);
        var selected = posts.findByMerchantIdOrderByUpdatedAtDesc(owner(), paging);
        if (selected.isEmpty()) return List.of();
        return selected.stream().map(p -> detail(p).post()).toList();
    }
    @Transactional(readOnly = true)
    public List<Detail> publicFeed(int page) {
        return publicFeed(page, null);
    }
    @Transactional(readOnly = true)
    public List<Detail> publicFeed(int page, Long merchantId) {
        var paging = PageRequest.of(Math.max(0, page), 20);
        var selected = merchantId == null ? posts.findByPublishedTrueOrderByPublishedAtDesc(paging)
            : posts.findByMerchantIdAndPublishedTrueOrderByPublishedAtDesc(merchantId, paging);
        if (selected.isEmpty()) return List.of();
        var grouped = items.findByPostIdInOrderById(selected.stream().map(p -> p.id).toList()).stream()
            .collect(java.util.stream.Collectors.groupingBy(i -> i.postId));
        return selected.stream().map(post -> {
            var linked = taxonomy.display(grouped.getOrDefault(post.id, List.of()),true);
            return new Detail(summary(post, linked.isEmpty()||linked.get(0).gallery.isEmpty()?null:linked.get(0).gallery.get(0).url()), post.body, linked);
        }).toList();
    }
    @Transactional(readOnly = true)
    public Detail get(Long id, boolean publicView) { return detail(publicView ? posts.findByIdAndPublishedTrue(id).orElseThrow(RecommendationService::missing) : owned(id),publicView); }
    @Transactional(readOnly = true)
    public Detail publicGet(Long id, Long merchantId) {
        var post = posts.findByIdAndPublishedTrue(id).filter(p -> merchantId == null || merchantId.equals(p.merchantId)).orElseThrow(RecommendationService::missing);
        return detail(post, true);
    }
    @Transactional
    public Detail create() { var post = new RecommendationPost(); post.merchantId = owner(); return detail(posts.saveAndFlush(post)); }

    @Transactional
    public Detail save(Long id, String title, String body, long expectedVersion) {
        lockOwner(); var post = owned(id); editable(post); version(post, expectedVersion);
        post.title = title.trim(); post.body = body.trim(); touch(post); return detail(post);
    }
    @Transactional
    public Detail publish(Long id, long expectedVersion, boolean publish) {
        lockOwner(); var post = owned(id);
        if (post.published == publish) return detail(post);
        version(post, expectedVersion);
        if (publish && (post.title.isBlank() || post.body.isBlank() || items.findByPostIdOrderById(id).isEmpty()))
            throw new ApiException(ErrorCode.INVALID_REQUEST, "error.recommendation.incomplete");
        post.published = publish;
        if (publish) {
            var publisher = users.findById(owner()).orElseThrow(RecommendationService::missing);
            post.publishedAt = java.time.Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
            post.publisherId = publisher.getId();
            post.publisherName = publisher.getName();
        }
        touch(post);
        audit.logStatusChange("RecommendationPost", id, publish ? "DRAFT" : "PUBLISHED", publish ? "PUBLISHED" : "DRAFT", owner());
        return detail(post);
    }
    @Transactional
    public Detail removeItem(Long id, Long itemId, long expectedVersion) {
        lockOwner(); var post = owned(id); editable(post); version(post, expectedVersion);
        var item = items.findById(itemId).filter(i -> i.postId.equals(id)).orElseThrow(RecommendationService::missing);
        items.delete(item); touch(post); return detail(post);
    }

    @Transactional
    public Upload upload(Long id, RecommendationFacts facts, long expectedVersion, RecommendationImageValidator.Image image) {
        lockOwner(); var post = owned(id); editable(post);
        var proposed = new RecommendationItem(); facts.apply(proposed);
        String code = proposed.itemNumber;
        var currentItems = items.findByPostIdOrderById(id);
        var duplicate = currentItems.stream()
            .filter(i -> Objects.equals(i.itemNumber, code) && i.imageHash.equals(image.hash())).findFirst();
        // A retry after a committed response loss is safe only when its metadata still matches.
        if (post.version != expectedVersion && duplicate.isPresent() && sameFacts(duplicate.get(), proposed))
            return new Upload(detail(post), false, true, false);
        version(post, expectedVersion);
        boolean changed = duplicate.isPresent() && !Objects.equals(duplicate.get().referencePrice, proposed.referencePrice);
        boolean reused = images.findByMerchantIdAndImageHash(owner(), image.hash()).isPresent();
        var blob = images.findByMerchantIdAndImageHash(owner(), image.hash()).map(existing->binaries.reuse(existing,image.content())).orElseGet(() -> {
                var value = new RecommendationImage(); value.id = UUID.randomUUID().toString(); value.merchantId = owner();
                value.imageHash = image.hash(); value.contentType = image.contentType(); value.content = image.content(); return binaries.persist(value);
            });
        var item = duplicate.orElseGet(RecommendationItem::new);
        facts.apply(item);
        item.postId = id;
        item.imageHash = image.hash(); item.imageUrl = "/api/storefront/recommendation-images/" + blob.id;
        boolean productCreated=catalog.ensure(item,owner());catalog.syncText(item,owner());
        items.saveAndFlush(item); touch(post);
        return new Upload(detail(post), productCreated, reused || duplicate.isPresent(), changed);
    }

    private static boolean sameFacts(RecommendationItem a, RecommendationItem b) {
        return Objects.equals(a.name,b.name) && Objects.equals(a.itemNumber,b.itemNumber)
            && equalPrice(a.referencePrice,b.referencePrice) && equalPrice(a.originalPrice,b.originalPrice)
            && equalPrice(a.discountAmount,b.discountAmount) && Objects.equals(a.priceUnit,b.priceUnit)
            && Objects.equals(a.offerStart,b.offerStart) && Objects.equals(a.offerEnd,b.offerEnd)
            && Objects.equals(a.couponStart,b.couponStart) && Objects.equals(a.couponEnd,b.couponEnd)
            && Objects.equals(a.offerNotes,b.offerNotes);
    }
    private static boolean equalPrice(BigDecimal a, BigDecimal b) { return a == null ? b == null : b != null && a.compareTo(b) == 0; }

    @Transactional
    public Detail editItem(Long id, Long itemId, RecommendationFacts facts, long expectedVersion) {
        lockOwner(); var post = owned(id); editable(post); version(post,expectedVersion);
        var item = items.findById(itemId).filter(i -> i.postId.equals(id)).orElseThrow(RecommendationService::missing);
        var proposed = new RecommendationItem(); facts.apply(proposed);
        if(item.productId!=null&&products.findById(item.productId).map(p->p.getCatalogData()!=null).orElse(false)&&(!Objects.equals(item.name,proposed.name)||!Objects.equals(item.itemNumber,proposed.itemNumber)))throw new ApiException(ErrorCode.INVALID_REQUEST,"master.use_profile");
        if (items.findByPostIdOrderById(id).stream().anyMatch(i -> !i.id.equals(itemId)
                && Objects.equals(i.itemNumber,proposed.itemNumber) && i.imageHash.equals(item.imageHash)))
            throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.conflict");
        if(!Objects.equals(item.itemNumber,proposed.itemNumber))item.productId=null;
        facts.apply(item);catalog.ensure(item,owner());catalog.syncText(item,owner());
        touch(post); return detail(post);
    }

    @Transactional(readOnly = true)
    public RecommendationImage image(String id) {
        String url="/api/storefront/recommendation-images/"+id;
        var deleted=products.deletedIds();
        if(!deleted.isEmpty()){
            var references=items.findAll().stream().filter(i->url.equals(i.imageUrl)||i.gallery.stream().anyMatch(p->url.equals(p.url()))).toList();
            boolean activeMaster=products.findAll().stream().anyMatch(p->p.getMediaGallery().stream().anyMatch(m->url.equals(m.getUrl())));
            var converter=new com.bobbuy.model.converter.MediaGalleryJsonConverter();
            boolean deletedMaster=products.deletedMediaGalleries().stream().filter(Objects::nonNull).map(converter::convertToEntityAttribute).anyMatch(gallery->gallery.stream().anyMatch(m->url.equals(m.getUrl())));
            if(!activeMaster&&(deletedMaster||!references.isEmpty())&&references.stream().allMatch(i->i.productId!=null&&deleted.contains(i.productId)))throw missing();
        }
        return images.findById(id).filter(i->"PUBLIC".equals(i.accessScope)).orElseThrow(RecommendationService::missing);
    }

    @Transactional
    public Detail classify(Long id,List<Long> itemIds,List<String> categoryIds,String mode,boolean updateCategories,
            String supplierId,boolean updateSupplier,boolean showSupplier,long expectedVersion) {
        lockOwner();var post=owned(id);editable(post);version(post,expectedVersion);
        if(!updateCategories&&!updateSupplier)throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.classification");
        var categories=new ArrayList<>(new LinkedHashSet<>(categoryIds));
        String supplier=supplierId==null||supplierId.isBlank()?null:supplierId;
        taxonomy.validate(updateCategories?categories:List.of(),updateSupplier?supplier:null,updateSupplier&&showSupplier);
        var wanted=new HashSet<>(itemIds);
        var selected=items.findByPostIdOrderById(id).stream().filter(i->wanted.contains(i.id)).toList();
        if(selected.size()!=wanted.size())throw missing();
        for(var item:selected) {
            var master=item.productId==null?null:products.findById(item.productId).map(Product::getCatalogData).orElse(null);
            if(master!=null){
                if(updateCategories){var next=new LinkedHashSet<>(master.categoryIds());switch(mode){case "add"->next.addAll(categories);case "remove"->next.removeAll(categories);case "replace"->{next.clear();next.addAll(categories);}default->throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.classification");}if(!new ArrayList<>(next).equals(master.categoryIds()))throw new ApiException(ErrorCode.INVALID_REQUEST,"master.use_profile");}
                if(updateSupplier&&!Objects.equals(supplier,master.supplierId()))throw new ApiException(ErrorCode.INVALID_REQUEST,"master.use_profile");
                if(updateSupplier)item.showSupplier=showSupplier;
                continue;
            }
            if(updateCategories) {
                var merged=new LinkedHashSet<>(item.categoryIds);
                switch(mode) {case "add" -> merged.addAll(categories);case "remove" -> merged.removeAll(categories);case "replace" -> {merged.clear();merged.addAll(categories);}default -> throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.classification");}
                item.categoryIds=new ArrayList<>(merged);
            }
            if(updateSupplier) {item.supplierId=supplier;item.showSupplier=showSupplier;}
        }
        touch(post);return detail(post);
    }
    @Transactional
    private void syncGallery(RecommendationItem item){
        if(item.productId==null)return;
        var product=products.lockById(item.productId).orElseThrow(RecommendationService::missing);
        if(product.getCatalogData()!=null)throw new ApiException(ErrorCode.INVALID_REQUEST,"master.use_profile");
        if(!owner().equals(product.getMerchantId())||!RecommendationCatalogService.profile(product)
            ||!item.postId.toString().equals(product.getAttributes().get("recommendationSourceIssue")))return;
        product.setMediaGallery(item.gallery.stream().map(p->{var media=new MediaGalleryItem();media.setType(MediaType.IMAGE);media.setVisible(true);media.setUrl(p.url());return media;}).collect(java.util.stream.Collectors.toCollection(ArrayList::new)));
        products.save(product);
    }
    @Transactional
    public Detail picture(Long id,Long itemId,long expectedVersion,RecommendationImageValidator.Image image,
        String sourceUrl,String assetKey,String label,String itemNumber,boolean verified){
        lockOwner();var post=owned(id);version(post,expectedVersion);
        var item=items.findById(itemId).filter(i->i.postId.equals(id)).orElseThrow(RecommendationService::missing);
        if(!verified||!Objects.equals(item.itemNumber,itemNumber)||assetKey==null||assetKey.isBlank()||assetKey.length()>2048||assetKey.matches(".*[?@#\\r\\n].*")||label==null||label.length()>200)throw new ApiException(ErrorCode.INVALID_REQUEST,"gallery.invalid");
        try{var uri=java.net.URI.create(sourceUrl);if(!"https".equals(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||uri.getRawQuery()!=null||uri.getRawFragment()!=null||sourceUrl.length()>2048)throw new IllegalArgumentException();}
        catch(Exception error){throw new ApiException(ErrorCode.INVALID_REQUEST,"gallery.invalid");}
        if(item.gallery.stream().anyMatch(p->p.hash().equals(image.hash())||p.assetKey().equals(assetKey)))return detail(post);
        if(item.gallery.size()>=100)throw new ApiException(ErrorCode.INVALID_REQUEST,"gallery.invalid");
        var blob=images.findByMerchantIdAndImageHash(owner(),image.hash()).map(existing->binaries.reuse(existing,image.content())).orElseGet(()->{var value=new RecommendationImage();value.id=UUID.randomUUID().toString();value.merchantId=owner();value.imageHash=image.hash();value.contentType=image.contentType();value.content=image.content();return binaries.persist(value);});
        var gallery=new ArrayList<>(item.gallery);gallery.add(new RecommendationItem.Picture(blob.id,"/api/storefront/recommendation-images/"+blob.id,image.hash(),sourceUrl,assetKey,label,java.time.Instant.now()));item.gallery=gallery;
        syncGallery(item);touch(post);return detail(post);
    }
    @Transactional
    public Detail gallery(Long id,Long itemId,long expectedVersion,List<String> orderedIds){
        lockOwner();var post=owned(id);version(post,expectedVersion);
        var item=items.findById(itemId).filter(i->i.postId.equals(id)).orElseThrow(RecommendationService::missing);
        if(orderedIds.size()>100||new HashSet<>(orderedIds).size()!=orderedIds.size())throw new ApiException(ErrorCode.INVALID_REQUEST,"gallery.invalid");
        item.gallery=orderedIds.stream().map(key->item.gallery.stream().filter(p->p.id().equals(key)).findFirst().orElseThrow(RecommendationService::missing)).toList();
        syncGallery(item);touch(post);return detail(post);
    }
    public record Localization(Long itemId,String sourceHash,String specification,String description,Map<String,RecommendationItem.Text> translations) {}
    @Transactional
    public Detail localize(Long id,List<Localization> rows,long expectedVersion){
        lockOwner();var post=owned(id);version(post,expectedVersion);
        var linked=items.findByPostIdOrderById(id);var seen=new HashSet<Long>();
        var locales=Set.of("zh-CN","zh-TW","en-US");
        for(var row:rows){
            if(row==null)throw new ApiException(ErrorCode.INVALID_REQUEST,"translation.invalid");
            var item=linked.stream().filter(i->i.id.equals(row.itemId())).findFirst().orElseThrow(RecommendationService::missing);
            boolean canonical=item.productId!=null&&products.findById(item.productId).map(p->p.getCatalogData()!=null).orElse(false);
            if(canonical){
                if(!Objects.equals(Objects.toString(item.specification,""),Objects.toString(row.specification(),""))||!Objects.equals(Objects.toString(item.description,""),Objects.toString(row.description(),"")))throw new ApiException(ErrorCode.INVALID_REQUEST,"master.use_profile");
                if(row.translations()!=null)for(var entry:row.translations().entrySet()){var before=item.translations.get(entry.getKey());var after=entry.getValue();if(after==null||!Objects.equals(before==null?item.name:before.name(),after.name())||!Objects.equals(Objects.toString(before==null?item.specification:before.specification(),""),Objects.toString(after.specification(),""))||!Objects.equals(Objects.toString(before==null?item.description:before.description(),""),Objects.toString(after.description(),"")))throw new ApiException(ErrorCode.INVALID_REQUEST,"master.use_profile");}
            }
            if(!seen.add(item.id)||!item.getTranslationSource().equals(row.sourceHash()))throw new ApiException(ErrorCode.INVALID_REQUEST,"translation.conflict");
            if(row.translations()==null||row.translations().isEmpty()||!locales.containsAll(row.translations().keySet())
                ||(row.specification()!=null&&row.specification().length()>1000)||(row.description()!=null&&row.description().length()>8000))throw new ApiException(ErrorCode.INVALID_REQUEST,"translation.invalid");
            row.translations().values().forEach(text->{if(text==null||text.name()==null||text.name().isBlank()||text.name().length()>400
                ||(text.specification()!=null&&text.specification().length()>1000)||(text.description()!=null&&text.description().length()>8000)
                ||(text.offerNotes()!=null&&text.offerNotes().length()>2000))throw new ApiException(ErrorCode.INVALID_REQUEST,"translation.invalid");});
            item.specification=row.specification();item.description=row.description();
            var merged=new HashMap<String,RecommendationItem.Text>();
            // Source changes invalidate all earlier languages, rather than blessing stale text.
            if("REVIEWED".equals(item.getTranslationStatus()))merged.putAll(item.translations);
            merged.putAll(row.translations());item.translations=merged;item.translatedSource=item.getTranslationSource();
            if(item.productId!=null){var product=products.lockById(item.productId).orElseThrow(RecommendationService::missing);
                if(product.getCatalogData()==null&&owner().equals(product.getMerchantId())&&RecommendationCatalogService.profile(product)
                    &&id.toString().equals(product.getAttributes().get("recommendationSourceIssue"))){
                    product.setName(RecommendationText.names(item));product.setDescription(RecommendationText.descriptions(item));products.save(product);
                }
            }
        }
        audit.logStatusChange("RECOMMENDATION_TRANSLATION",id,"REVIEW_REQUIRED","HUMAN_REVIEWED",owner());
        touch(post);return detail(post);
    }
    @Transactional
    public Detail reviewSales(Long id,List<ProductSaleService.Review> reviews,long expectedVersion,boolean confirmedPreorder){
        lockOwner();var post=owned(id);version(post,expectedVersion);
        if(!confirmedPreorder||reviews.isEmpty())throw new ApiException(ErrorCode.INVALID_REQUEST,"sale.confirm_required");
        var linked=items.findByPostIdOrderById(id);var seen=new HashSet<String>();
        for(var review:reviews){
            if(review==null)throw new ApiException(ErrorCode.INVALID_REQUEST,"sale.invalid");
            var item=linked.stream().filter(i->i.id.equals(review.itemId())).findFirst().orElseThrow(RecommendationService::missing);
            if(item.productId==null||!seen.add(item.productId))throw new ApiException(ErrorCode.INVALID_REQUEST,"sale.duplicate");
            sales.review(item,owner(),review);
        }
        audit.logStatusChange("RECOMMENDATION_SALE",id,"OPERATOR_REVIEW","CONFIRMED_JPY_PREORDER",owner());
        touch(post);return detail(post);
    }
    @Transactional
    public Detail catalog(Long id,List<Long> itemIds,String productId,long expectedVersion) {
        lockOwner();var post=owned(id);
        var wanted=new HashSet<>(itemIds);
        var selected=items.findByPostIdOrderById(id).stream().filter(i->wanted.contains(i.id)).toList();
        if(selected.isEmpty()||selected.size()!=wanted.size())throw missing();
        if(productId==null&&selected.stream().allMatch(i->i.productId!=null))return detail(post);
        version(post,expectedVersion);
        if(productId!=null){if(selected.size()!=1)throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.catalog");catalog.requireOwnership(productId,owner());selected.get(0).productId=productId;}
        else selected.forEach(item->catalog.ensure(item,owner()));
        touch(post);return detail(post);
    }
}
