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

    public RecommendationService(RecommendationPostRepository posts, RecommendationItemRepository items,
            RecommendationImageRepository images, ProductRepository products, UserRepository users,
            AuditLogService audit, RecommendationTaxonomyService taxonomy) {
        this.posts = posts; this.items = items; this.images = images; this.products = products;
        this.users = users; this.audit = audit; this.taxonomy = taxonomy;
    }
    public record Summary(Long id, String title, boolean published, long version, LocalDateTime updatedAt, java.time.Instant publishedAt, String publisherName, String coverImageUrl) {}
    public record Detail(Summary post, String body, List<RecommendationItem> items) {}
    public record Upload(Detail detail, boolean productCreated, boolean imageReused, boolean priceUpdated) {}
    private Summary summary(RecommendationPost post, String cover) { return new Summary(post.id, post.title, post.published, post.version, post.updatedAt, post.publishedAt, post.publisherName, cover); }
    private Detail detail(RecommendationPost post) { return detail(post,false); }
    private Detail detail(RecommendationPost post,boolean publicView) {
        var linked = items.findByPostIdOrderById(post.id);
        return new Detail(summary(post, linked.isEmpty() ? null : linked.get(0).imageUrl), post.body, taxonomy.display(linked,publicView));
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
        Map<Long, String> covers = new HashMap<>();
        items.findCovers(selected.stream().map(p -> p.id).toList()).forEach(i -> covers.put(i.postId, i.imageUrl));
        return selected.stream().map(p -> summary(p, covers.get(p.id))).toList();
    }
    @Transactional(readOnly = true)
    public List<Detail> publicFeed(int page) {
        var selected = posts.findByPublishedTrueOrderByPublishedAtDesc(PageRequest.of(Math.max(0, page), 20));
        if (selected.isEmpty()) return List.of();
        var grouped = items.findByPostIdInOrderById(selected.stream().map(p -> p.id).toList()).stream()
            .collect(java.util.stream.Collectors.groupingBy(i -> i.postId));
        return selected.stream().map(post -> {
            var linked = grouped.getOrDefault(post.id, List.of());
            return new Detail(summary(post, linked.isEmpty() ? null : linked.get(0).imageUrl), post.body, taxonomy.display(linked,true));
        }).toList();
    }
    @Transactional(readOnly = true)
    public Detail get(Long id, boolean publicView) { return detail(publicView ? posts.findByIdAndPublishedTrue(id).orElseThrow(RecommendationService::missing) : owned(id),publicView); }
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
        var blob = images.findByMerchantIdAndImageHash(owner(), image.hash()).orElseGet(() -> {
                var value = new RecommendationImage(); value.id = UUID.randomUUID().toString(); value.merchantId = owner();
                value.imageHash = image.hash(); value.contentType = image.contentType(); value.content = image.content(); return images.save(value);
            });
        var item = duplicate.orElseGet(RecommendationItem::new);
        facts.apply(item);
        item.postId = id;
        // Optional catalog link only. Recommendation facts never create stock or overwrite its USD selling price.
        item.productId = code == null ? null : products.findByMerchantIdAndItemNumber(owner(), code).map(Product::getId).orElse(null);
        item.imageHash = image.hash(); item.imageUrl = "/api/storefront/recommendation-images/" + blob.id;
        items.saveAndFlush(item); touch(post);
        return new Upload(detail(post), false, reused || duplicate.isPresent(), changed);
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
        if (items.findByPostIdOrderById(id).stream().anyMatch(i -> !i.id.equals(itemId)
                && Objects.equals(i.itemNumber,proposed.itemNumber) && i.imageHash.equals(item.imageHash)))
            throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.conflict");
        facts.apply(item);
        item.productId = item.itemNumber == null ? null : products.findByMerchantIdAndItemNumber(owner(),item.itemNumber).map(Product::getId).orElse(null);
        touch(post); return detail(post);
    }

    @Transactional(readOnly = true)
    public RecommendationImage image(String id) { return images.findById(id).orElseThrow(RecommendationService::missing); }

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
            if(updateCategories) {
                var merged=new LinkedHashSet<>(item.categoryIds);
                switch(mode) {case "add" -> merged.addAll(categories);case "remove" -> merged.removeAll(categories);case "replace" -> {merged.clear();merged.addAll(categories);}default -> throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.classification");}
                item.categoryIds=new ArrayList<>(merged);
            }
            if(updateSupplier) {item.supplierId=supplier;item.showSupplier=showSupplier;}
        }
        touch(post);return detail(post);
    }
}
