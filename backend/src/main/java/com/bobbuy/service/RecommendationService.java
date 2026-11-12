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
    private final ReferenceQuoteService referenceQuotes;
    private final RecommendationArticleService articles;

    public RecommendationService(RecommendationPostRepository posts, RecommendationItemRepository items,
            RecommendationImageRepository images, ProductRepository products, UserRepository users,
            AuditLogService audit, RecommendationTaxonomyService taxonomy, RecommendationCatalogService catalog, ProductSaleService sales,MediaBinaryService binaries,ReferenceQuoteService referenceQuotes,RecommendationArticleService articles) {
        this.posts = posts; this.items = items; this.images = images; this.products = products;
        this.users = users; this.audit = audit; this.taxonomy = taxonomy; this.catalog = catalog; this.sales=sales;this.binaries=binaries;
        this.referenceQuotes=referenceQuotes;
        this.articles=articles;
    }
    public record Summary(Long id, String title, boolean published, long version, LocalDateTime updatedAt, java.time.Instant publishedAt, String publisherName, String coverImageUrl, Long merchantId,java.util.Map<String,String> articleTitles,java.time.LocalDate issueDate,String issueDateSource) {
        public Summary(Long id,String title,boolean published,long version,LocalDateTime updatedAt,java.time.Instant publishedAt,String publisherName,String coverImageUrl,Long merchantId,java.util.Map<String,String> articleTitles){this(id,title,published,version,updatedAt,publishedAt,publisherName,coverImageUrl,merchantId,articleTitles,null,"UNKNOWN");}
    }
    public record Detail(Summary post, String body, List<RecommendationItem> items,String articleSourceLocale,String articleSourceHash,java.util.Map<String,RecommendationPost.ArticleText> articleTranslations,RecommendationServiceOffer serviceOffer) {}
    public record Upload(Detail detail, boolean productCreated, boolean imageReused, boolean priceUpdated) {}
    private Summary summary(RecommendationPost post, String cover) { return new Summary(post.id, post.title, post.published, post.version, post.updatedAt, post.publishedAt, post.publisherName, cover, post.merchantId,articles.titles(post),post.reviewedIssueDate(),post.issueDateSource()); }
    public record PublicNode(Long id, String name) {}
    @Transactional(readOnly = true)
    public List<PublicNode> publicNodes() {
        var ids = new TreeSet<Long>();
        var published=posts.findByPublishedTrue();
        var deleted=products.deletedIds();
        var withItems=published.isEmpty()?Set.<Long>of():items.findByPostIdInOrderById(published.stream().map(p->p.id).toList()).stream()
            .filter(RecommendationPublication::visible).filter(i->i.productId==null||!deleted.contains(i.productId)).map(i->i.postId).collect(java.util.stream.Collectors.toSet());
        published.stream().filter(p->p.serviceOffer!=null||withItems.contains(p.id)).map(p->p.merchantId).filter(Objects::nonNull).forEach(ids::add);
        var names = new HashMap<Long,String>();
        users.findAllById(ids).forEach(user -> names.put(user.getId(),user.getName()==null?"":user.getName().trim()));
        return ids.stream().map(id -> new PublicNode(id,names.getOrDefault(id,""))).toList();
    }
    private Detail detail(RecommendationPost post) { return detail(post,false); }
    private Detail detail(RecommendationPost post,boolean publicView) {
        var originals=items.findByPostIdOrderById(post.id);referenceQuotes.decorate(originals,false);
        var linked = taxonomy.display(originals,publicView);
        referenceQuotes.decorate(linked,publicView);
        return new Detail(summary(post, linked.isEmpty()?null:publicView?(linked.get(0).gallery.isEmpty()?null:linked.get(0).gallery.get(0).url()):linked.get(0).imageUrl), post.body, linked,post.articleSourceLocale,articles.sourceHash(post),publicView?articles.current(post):articles.all(post),post.serviceOffer==null?null:publicView?post.serviceOffer.publicView():post.serviceOffer);
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
    private static void goodsOnly(RecommendationPost post){if(post.serviceOffer!=null)throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.invalid");}
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
        var visible=publicBrowseEntries(merchantId);
        int start=(int)Math.min((long)Math.max(0,page)*20,visible.size()),end=Math.min(start+20,visible.size());
        return visible.subList(start,end);
    }
    @Transactional(readOnly = true)
    public Detail get(Long id, boolean publicView) { return publicView?publicGet(id,null):detail(owned(id),false); }
    /** Complete server-side oracle; only bounded summaries leave the browse controller. */
    @Transactional(readOnly = true)
    public List<Detail> publicBrowseEntries(Long merchantId) {
        if(merchantId!=null&&merchantId<1)throw new IllegalArgumentException("Invalid merchant");
        var selected=posts.findByPublishedTrue().stream().filter(p->merchantId==null||merchantId.equals(p.merchantId))
            .sorted(Comparator.comparing((RecommendationPost p)->p.publishedAt,Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(p->p.id,Comparator.reverseOrder())).toList();
        var originals=selected.isEmpty()?List.<RecommendationItem>of():items.findByPostIdInOrderById(selected.stream().map(p->p.id).toList());referenceQuotes.decorate(originals,false);
        var displayed=taxonomy.display(originals,true);
        if(!displayed.isEmpty())referenceQuotes.decorate(displayed,true);
        var grouped=displayed.stream().collect(java.util.stream.Collectors.groupingBy(i->i.postId));
        return selected.stream().map(post->{var linked=grouped.getOrDefault(post.id,List.of());return new Detail(summary(post,linked.isEmpty()||linked.get(0).gallery.isEmpty()?null:linked.get(0).gallery.get(0).url()),post.body,linked,post.articleSourceLocale,articles.sourceHash(post),articles.current(post),post.serviceOffer==null?null:post.serviceOffer.publicView());})
            .filter(detail->detail.serviceOffer()!=null||!detail.items().isEmpty()).toList();
    }
    @Transactional(readOnly = true)
    public Detail publicGet(Long id, Long merchantId) {
        var post = posts.findByIdAndPublishedTrue(id).filter(p -> merchantId == null || merchantId.equals(p.merchantId)).orElseThrow(RecommendationService::missing);
        var result=detail(post, true);
        if(result.serviceOffer()==null&&result.items().isEmpty())throw missing();
        return result;
    }
    @Transactional
    public Detail create() { var post = new RecommendationPost(); post.merchantId = owner();post.articleSourceLocale="ja-JP"; return detail(posts.saveAndFlush(post)); }

    @Transactional public Detail createService(RecommendationServiceOffer input){
        lockOwner();if(input==null)throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.invalid");var offer=input.normalized();var existing=posts.findByMerchantIdAndServiceSourceKey(owner(),offer.sourceKey());
        if(existing.isPresent()){if(existing.get().serviceOffer==null||!offer.equals(existing.get().serviceOffer.normalized()))throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.conflict");return detail(existing.get());}
        var post=new RecommendationPost();post.merchantId=owner();applyService(post,offer);touch(post);articles.snapshot(post);return detail(post);
    }
    @Transactional public Detail saveService(Long id,RecommendationServiceOffer input,long expectedVersion){
        lockOwner();var post=owned(id);editable(post);if(input==null)throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.invalid");var offer=input.normalized();if(post.version!=expectedVersion&&post.serviceOffer!=null&&offer.equals(post.serviceOffer.normalized()))return detail(post);version(post,expectedVersion);
        if(post.serviceOffer==null||!items.findByPostIdOrderById(id).isEmpty()||!offer.sourceKey().equals(post.serviceSourceKey)||!offer.sourceHash().equals(post.serviceOffer.sourceHash()))throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.conflict");
        articles.snapshot(post);applyService(post,offer);touch(post);articles.snapshot(post);return detail(post);
    }
    private void applyService(RecommendationPost post,RecommendationServiceOffer offer){
        post.serviceOffer=offer;post.serviceSourceKey=offer.sourceKey();post.articleSourceLocale="ja-JP";post.title=offer.terms().get("ja-JP").title();post.body=offer.article("ja-JP");
        var translations=new HashMap<String,RecommendationPost.ArticleText>();for(String locale:RecommendationServiceOffer.LOCALES)if(!locale.equals("ja-JP"))translations.put(locale,new RecommendationPost.ArticleText(offer.terms().get(locale).title(),offer.article(locale),articles.sourceHash(post),java.time.Instant.now()));post.articleTranslations=translations;
    }

    @Transactional
    public Detail save(Long id, String title, String body, long expectedVersion) {
        lockOwner(); var post = owned(id); editable(post);goodsOnly(post); version(post, expectedVersion);
        articles.snapshot(post);
        post.title = title.trim(); post.body = body.trim();articles.snapshot(post); touch(post); return detail(post);
    }
    @Transactional
    public Detail articleLanguage(Long id,String locale,String title,String body,String sourceHash,long expectedVersion,boolean reviewed){lockOwner();var post=owned(id);editable(post);goodsOnly(post);version(post,expectedVersion);articles.update(post,locale,title,body,sourceHash,reviewed);touch(post);return detail(post);}
    public record ArticleRevision(Detail detail,UUID requestId,String previousSourceHash,String articleSourceHash,long appliedVersion,boolean replayed,boolean current) {}
    @Transactional
    public ArticleRevision reviseArticle(Long id,UUID requestId,long expectedVersion,String expectedSource,boolean reviewed,Map<String,RecommendationArticleService.ReviewedText> input){
        lockOwner();var post=owned(id);goodsOnly(post);
        if(requestId==null||expectedVersion<0||expectedSource==null||!expectedSource.matches("[a-f0-9]{64}"))throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.invalid");
        var texts=articles.reviewedTexts(input,reviewed);String payloadHash=articles.revisionPayloadHash(post,expectedVersion,expectedSource,texts);
        var replay=articles.replay(post,requestId,payloadHash);
        if(replay.isPresent())return articleRevision(post,replay.get(),true);
        if(!post.published)throw new ApiException(ErrorCode.INVALID_STATUS,"error.recommendation.published");
        if(post.version!=expectedVersion||!articles.sourceHash(post).equals(expectedSource))throw new RecommendationArticleService.RevisionConflict();
        articles.snapshot(post);articles.applyReviewedRevision(post,texts);touch(post);
        var receipt=articles.recordRevision(post,requestId,payloadHash,expectedSource,expectedVersion,owner());
        return articleRevision(post,receipt,false);
    }
    private ArticleRevision articleRevision(RecommendationPost post,RecommendationArticleService.RevisionReceipt receipt,boolean replayed){
        return new ArticleRevision(detail(post),receipt.requestId(),receipt.previousSourceHash(),receipt.articleSourceHash(),receipt.appliedVersion(),replayed,post.version==receipt.appliedVersion()&&articles.sourceHash(post).equals(receipt.articleSourceHash()));
    }
    @Transactional(readOnly=true)
    public java.util.List<RecommendationArticleRevision> articleHistory(Long id){return articles.history(owned(id));}
    @Transactional
    public Detail publish(Long id, long expectedVersion, boolean publish) {
        lockOwner(); var post = owned(id);
        if (post.published == publish) return detail(post);
        version(post, expectedVersion);
        var linked=items.findByPostIdOrderById(id);
        if (publish && (post.title.isBlank() || post.body.isBlank() || (post.serviceOffer==null&&linked.stream().noneMatch(RecommendationPublication::visible))))
            throw new ApiException(ErrorCode.INVALID_REQUEST, "error.recommendation.incomplete");
        if (publish) {
            if(post.serviceOffer!=null){var verified=post.serviceOffer.normalized();if(!linked.isEmpty()||!verified.sourceKey().equals(post.serviceSourceKey)||!post.title.equals(verified.terms().get("ja-JP").title())||!post.body.equals(verified.article("ja-JP"))||articles.current(post).size()!=3)throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.incomplete");}
            items.findByPostIdOrderById(id).forEach(item->referenceQuotes.snapshot(item,owner()));
            var publisher = users.findById(owner()).orElseThrow(RecommendationService::missing);
            post.publishedAt = java.time.Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
            post.publisherId = publisher.getId();
            post.publisherName = publisher.getName();
        }
        // Queries/snapshot flushes above must not expose a partially published row
        // to PostgreSQL's publication metadata constraint.
        post.published = publish;
        touch(post);
        audit.logStatusChange("RecommendationPost", id, publish ? "DRAFT" : "PUBLISHED", publish ? "PUBLISHED" : "DRAFT", owner());
        return detail(post);
    }
    /** One explicit reviewed occurrence, serialized with all merchant/master writers. */
    @Transactional
    public Detail publishItem(Long id,Long itemId,UUID requestId,long expectedVersion,long productVersion,String sourceHash,boolean reviewed) {
        lockOwner();var post=owned(id);goodsOnly(post);
        if(requestId==null||sourceHash==null||!sourceHash.matches("[0-9a-f]{64}")||!reviewed||productVersion<0)
            throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.incomplete");
        var item=items.findById(itemId).filter(value->id.equals(value.postId)).orElseThrow(RecommendationService::missing);
        referenceQuotes.decorate(List.of(item),false);
        String requestHash=RecommendationPublication.requestHash(id,itemId,requestId,expectedVersion,productVersion,sourceHash,reviewed);
        var previous=items.findByPublishedByAndPublicationRequestId(owner(),requestId.toString());
        if(previous.isPresent()){
            var prior=previous.get();
            if(item.id.equals(prior.id)&&RecommendationPublication.visible(prior)&&requestHash.equals(prior.publicationRequestHash))return detail(post);
            throw publicationConflict(itemId);
        }
        if(RecommendationPublication.visible(item)||post.version!=expectedVersion)throw publicationConflict(itemId);
        RecommendationPublication.pending(item);
        if(post.title.isBlank()||post.body.isBlank())throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.incomplete");
        var product=item.productId==null?null:products.lockById(item.productId)
            .filter(value->owner().equals(value.getMerchantId())&&!value.isDeleted()).orElseThrow(RecommendationService::missing);
        if(product==null||!Objects.equals(product.getRecordVersion(),productVersion))throw publicationConflict(itemId);
        var snapshot=RecommendationPublication.candidate(item,product);
        if(!sourceHash.equals(snapshot.reviewHash()))throw publicationConflict(itemId);
        RecommendationPublication.requireReady(item,product,snapshot);
        var shown=RecommendationPublication.project(item,snapshot);taxonomy.validate(shown.categoryIds,shown.supplierId,shown.showSupplier);
        String prefix="/api/storefront/recommendation-images/";
        for(var picture:shown.gallery){
            var image=images.findById(picture.url().substring(prefix.length())).filter(value->owner().equals(value.merchantId)&&"PUBLIC".equals(value.accessScope)).orElseThrow(RecommendationService::missing);
            if(!picture.hash().equals(image.imageHash))throw new ApiException(ErrorCode.INVALID_REQUEST,"gallery.invalid");
        }
        referenceQuotes.snapshot(item,owner());
        item.publicationSnapshot=snapshot;item.publicationState="PUBLISHED";item.publishedAt=java.time.Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        item.publishedBy=owner();item.publicationRequestId=requestId.toString();item.publicationRequestHash=requestHash;
        items.saveAndFlush(item);
        if(!post.published){
            var publisher=users.findById(owner()).orElseThrow(RecommendationService::missing);
            post.publishedAt=item.publishedAt;post.publisherId=publisher.getId();post.publisherName=publisher.getName();post.published=true;
        }
        touch(post);audit.logStatusChange("RecommendationItem",item.id,"PENDING","PUBLISHED",owner());return detail(post);
    }
    private static org.springframework.orm.ObjectOptimisticLockingFailureException publicationConflict(Long itemId){return new org.springframework.orm.ObjectOptimisticLockingFailureException(RecommendationItem.class,itemId);}
    @Transactional
    public Detail removeItem(Long id, Long itemId, long expectedVersion) {
        lockOwner(); var post = owned(id); goodsOnly(post); version(post, expectedVersion);
        var item = items.findById(itemId).filter(i -> i.postId.equals(id)).orElseThrow(RecommendationService::missing);
        RecommendationPublication.pending(item);
        referenceQuotes.snapshot(item,owner());
        items.delete(item); touch(post); return detail(post);
    }

    @Transactional
    public Upload upload(Long id, RecommendationFacts facts, long expectedVersion, RecommendationImageValidator.Image image) {
        lockOwner(); var post = owned(id); goodsOnly(post);
        var proposed = new RecommendationItem(); facts.apply(proposed);
        String code = proposed.itemNumber;
        var currentItems = items.findByPostIdOrderById(id);
        referenceQuotes.decorate(currentItems,false);
        var duplicate = currentItems.stream()
            .filter(i -> Objects.equals(i.itemNumber, code) &&Objects.equals(i.name,proposed.name)&&Objects.equals(i.sourcePrice,proposed.sourcePrice)&&Objects.equals(i.couponStart,proposed.couponStart)&&Objects.equals(i.couponEnd,proposed.couponEnd)&&Objects.equals(i.referenceContext,proposed.referenceContext)).findFirst();
        // A retry after a committed response loss is safe only when its metadata still matches.
        if (post.version != expectedVersion && duplicate.isPresent() && sameFacts(duplicate.get(), proposed))
            return new Upload(detail(post), false, true, false);
        version(post, expectedVersion);
        if(duplicate.isPresent()&&!sameFacts(duplicate.get(),proposed))throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.conflict");
        if(duplicate.isPresent())return new Upload(detail(post),false,true,false);
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
        item.offerIdentity=referenceQuotes.identity(item);
        if(currentItems.stream().anyMatch(existing->Objects.equals(referenceQuotes.identity(existing),item.offerIdentity)))throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.conflict");
        items.saveAndFlush(item);referenceQuotes.snapshot(item,owner()); touch(post);
        return new Upload(detail(post), productCreated, reused || duplicate.isPresent(), changed);
    }

    /** Explicit reviewed selection: reuse a master before registering issue-only offer facts. */
    @Transactional
    public Detail fromProduct(Long id,String productId,long productVersion,RecommendationFacts facts,long expectedVersion,boolean reviewed) {
        lockOwner();var post=owned(id);goodsOnly(post);
        if(!reviewed)throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.conflict");
        String additionHash=RecommendationPublication.additionHash(id,productId,productVersion,facts);
        if(items.findByPostIdAndAdditionPayloadHash(id,additionHash).isPresent())return detail(post);
        var proposed=new RecommendationItem();facts.apply(proposed);proposed.postId=id;proposed.productId=productId;
        var prior=items.findByPostIdOrderById(id).stream().filter(i->productId.equals(i.productId)&&Objects.equals(referenceQuotes.identity(i),referenceQuotes.identity(proposed))).findFirst();
        if(prior.isPresent()&&Objects.equals(prior.get().linkedProductVersion,productVersion)){
            if(prior.get().additionPayloadHash==null&&sameFacts(prior.get(),proposed))return detail(post);
            throw publicationConflict(prior.get().id);
        }
        var product=products.lockById(productId).filter(p->owner().equals(p.getMerchantId())&&!p.isDeleted()).orElseThrow(RecommendationService::missing);
        if(!reviewed||product.getCatalogData()==null||!Objects.equals(product.getRecordVersion(),productVersion))
            throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.conflict");
        var item=new RecommendationItem();facts.apply(item);
        if(!Objects.equals(item.itemNumber,product.getItemNumber())||!item.name.equals(ProductCatalogService.text(product.getName(),"ja-JP")))
            throw new ApiException(ErrorCode.INVALID_REQUEST,"master.use_profile");
        item.postId=id;item.productId=productId;item.linkedProductVersion=productVersion;item.additionPayloadHash=additionHash;
        ProductCatalogProjection.apply(item,item,product);
        if(item.gallery.isEmpty())throw new ApiException(ErrorCode.INVALID_REQUEST,"gallery.invalid");
        String prefix="/api/storefront/recommendation-images/";
        for(var picture:item.gallery){
            if(picture.url()==null||!picture.url().startsWith(prefix)||picture.sourceUrl()==null||picture.hash()==null)
                throw new ApiException(ErrorCode.INVALID_REQUEST,"gallery.invalid");
            var image=images.findById(picture.url().substring(prefix.length())).filter(p->owner().equals(p.merchantId)&&"PUBLIC".equals(p.accessScope)).orElseThrow(RecommendationService::missing);
            if(!picture.hash().equals(image.imageHash))throw new ApiException(ErrorCode.INVALID_REQUEST,"gallery.invalid");
        }
        item.imageUrl=item.gallery.get(0).url();item.imageHash=item.gallery.get(0).hash();
        item.offerIdentity=referenceQuotes.identity(item);
        var duplicate=items.findByPostIdOrderById(id).stream().filter(i->productId.equals(i.productId)&&Objects.equals(referenceQuotes.identity(i),item.offerIdentity)).findFirst();
        if(duplicate.isPresent()){
            if(duplicate.get().additionPayloadHash==null&&sameFacts(duplicate.get(),item))return detail(post);
            throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.conflict");
        }
        version(post,expectedVersion);items.saveAndFlush(item);referenceQuotes.snapshot(item,owner());touch(post);return detail(post);
    }

    private static boolean sameFacts(RecommendationItem a, RecommendationItem b) {
        return Objects.equals(a.name,b.name) && Objects.equals(a.itemNumber,b.itemNumber)
            && Objects.equals(a.sourcePrice,b.sourcePrice)
            && Objects.equals(a.couponStart,b.couponStart) && Objects.equals(a.couponEnd,b.couponEnd)
            && Objects.equals(a.referenceContext,b.referenceContext)
            && Objects.equals(a.offerNotes,b.offerNotes);
    }
    private static boolean equalPrice(BigDecimal a, BigDecimal b) { return a == null ? b == null : b != null && a.compareTo(b) == 0; }

    @Transactional
    public Detail editItem(Long id, Long itemId, RecommendationFacts facts, long expectedVersion) {
        if(facts.referencePrice()!=null||facts.originalPrice()!=null||facts.discountAmount()!=null||facts.priceUnit()!=null||facts.offerStart()!=null||facts.offerEnd()!=null)throw new ApiException(ErrorCode.INVALID_REQUEST,"pricing.use_documents");
        lockOwner(); var post = owned(id); goodsOnly(post); version(post,expectedVersion);
        var item = items.findById(itemId).filter(i -> i.postId.equals(id)).orElseThrow(RecommendationService::missing);
        RecommendationPublication.pending(item);
        var proposed = new RecommendationItem(); facts.apply(proposed);
        referenceQuotes.snapshot(item,owner());
        if(item.productId!=null&&products.findById(item.productId).map(p->p.getCatalogData()!=null).orElse(false)&&(!Objects.equals(item.name,proposed.name)||!Objects.equals(item.itemNumber,proposed.itemNumber)))throw new ApiException(ErrorCode.INVALID_REQUEST,"master.use_profile");
        if (items.findByPostIdOrderById(id).stream().anyMatch(i -> !i.id.equals(itemId)
                && Objects.equals(i.itemNumber,proposed.itemNumber) && Objects.equals(i.sourcePrice,proposed.sourcePrice)&&Objects.equals(i.couponStart,proposed.couponStart)&&Objects.equals(i.couponEnd,proposed.couponEnd)&&Objects.equals(i.referenceContext,proposed.referenceContext)))
            throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.conflict");
        if(!Objects.equals(item.itemNumber,proposed.itemNumber))item.productId=null;
        facts.apply(item);catalog.ensure(item,owner());catalog.syncText(item,owner());
        item.offerIdentity=referenceQuotes.identity(item);
        if(items.findByPostIdOrderById(id).stream().anyMatch(existing->!existing.id.equals(itemId)&&Objects.equals(referenceQuotes.identity(existing),item.offerIdentity)))throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.conflict");
        items.saveAndFlush(item);referenceQuotes.snapshot(item,owner());
        touch(post); return detail(post);
    }

    @Transactional(readOnly = true)
    public RecommendationImage image(String id) {
        String url="/api/storefront/recommendation-images/"+id;
        var deleted=products.deletedIds();
        if(!deleted.isEmpty()){
            var converter=new com.bobbuy.model.converter.MediaGalleryJsonConverter();
            var references=items.imageReferences().stream().filter(i->url.equals(i.getImageUrl())||i.getGallery().stream().anyMatch(p->url.equals(p.url()))).toList();
            boolean activeMaster=products.activeMediaGalleries().stream().filter(Objects::nonNull).map(converter::convertToEntityAttribute).anyMatch(gallery->gallery.stream().anyMatch(m->url.equals(m.getUrl())));
            boolean deletedMaster=products.deletedMediaGalleries().stream().filter(Objects::nonNull).map(converter::convertToEntityAttribute).anyMatch(gallery->gallery.stream().anyMatch(m->url.equals(m.getUrl())));
            if(!activeMaster&&(deletedMaster||!references.isEmpty())&&references.stream().allMatch(i->i.getProductId()!=null&&deleted.contains(i.getProductId())))throw missing();
        }
        return images.findById(id).filter(i->"PUBLIC".equals(i.accessScope)).orElseThrow(RecommendationService::missing);
    }

    @Transactional
    public Detail classify(Long id,List<Long> itemIds,List<String> categoryIds,String mode,boolean updateCategories,
            String supplierId,boolean updateSupplier,boolean showSupplier,long expectedVersion) {
        lockOwner();var post=owned(id);goodsOnly(post);version(post,expectedVersion);
        if(!updateCategories&&!updateSupplier)throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.classification");
        var categories=new ArrayList<>(new LinkedHashSet<>(categoryIds));
        String supplier=supplierId==null||supplierId.isBlank()?null:supplierId;
        taxonomy.validate(updateCategories?categories:List.of(),updateSupplier?supplier:null,updateSupplier&&showSupplier);
        var wanted=new HashSet<>(itemIds);
        var selected=items.findByPostIdOrderById(id).stream().filter(i->wanted.contains(i.id)).toList();
        if(selected.size()!=wanted.size())throw missing();
        selected.forEach(RecommendationPublication::pending);
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
        RecommendationPublication.pending(item);
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
        RecommendationPublication.pending(item);
        if(orderedIds.size()>100||new HashSet<>(orderedIds).size()!=orderedIds.size())throw new ApiException(ErrorCode.INVALID_REQUEST,"gallery.invalid");
        item.gallery=orderedIds.stream().map(key->item.gallery.stream().filter(p->p.id().equals(key)).findFirst().orElseThrow(RecommendationService::missing)).toList();
        syncGallery(item);touch(post);return detail(post);
    }
    public record Localization(Long itemId,String sourceHash,String specification,String description,Map<String,RecommendationItem.Text> translations) {}
    @Transactional
    public Detail localize(Long id,List<Localization> rows,long expectedVersion){
        lockOwner();var post=owned(id);version(post,expectedVersion);
        var linked=items.findByPostIdOrderById(id);referenceQuotes.decorate(linked,false);var seen=new HashSet<Long>();
        var locales=Set.of("zh-CN","zh-TW","en-US");
        for(var row:rows){
            if(row==null)throw new ApiException(ErrorCode.INVALID_REQUEST,"translation.invalid");
            var item=linked.stream().filter(i->i.id.equals(row.itemId())).findFirst().orElseThrow(RecommendationService::missing);
            RecommendationPublication.pending(item);
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
            RecommendationPublication.pending(item);
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
        selected.forEach(RecommendationPublication::pending);
        version(post,expectedVersion);
        selected.forEach(item->referenceQuotes.snapshot(item,owner()));
        if(productId!=null){if(selected.size()!=1)throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.catalog");catalog.requireOwnership(productId,owner());referenceQuotes.relinkDraftSource(selected.get(0),owner(),productId);selected.get(0).productId=productId;}
        else selected.forEach(item->catalog.ensure(item,owner()));
        selected.forEach(item->{item.offerIdentity=referenceQuotes.identity(item);items.saveAndFlush(item);referenceQuotes.snapshot(item,owner());});
        touch(post);return detail(post);
    }
    @Transactional(readOnly=true)
    public List<ReferenceQuoteRevision> referenceHistory(Long postId,Long itemId){owned(postId);var item=items.findById(itemId).filter(i->i.postId.equals(postId)).orElseThrow(RecommendationService::missing);if(item.productId!=null&&products.findById(item.productId).filter(p->owner().equals(p.getMerchantId())&&!p.isDeleted()).isEmpty())throw missing();return referenceQuotes.history(owner(),itemId);}
}
