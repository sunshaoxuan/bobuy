package com.bobbuy.repository;

import com.bobbuy.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, String> {
    // Same owned, published association used by the reference-only public catalog.
    // Snapshot validity is checked with RecommendationPublication.visible in the service.
    @org.springframework.data.jpa.repository.Query("select i from RecommendationItem i, RecommendationPost post, Product p where i.productId=p.id and i.postId=post.id and post.published=true and post.merchantId=p.merchantId and i.productId in :ids and i.publicationState='PUBLISHED'")
    java.util.List<com.bobbuy.model.RecommendationItem> publicReviewLinks(@org.springframework.data.repository.query.Param("ids") java.util.Collection<String> ids);
    // Internal scalar IDs only: normal ORM queries always exclude deleted products.
    @org.springframework.data.jpa.repository.Query(value="select id from bb_product where deleted_at is not null",nativeQuery=true)
    java.util.Set<String> deletedIds();
    // Internal authorization check only, never serialize deleted product rows to callers.
    @org.springframework.data.jpa.repository.Query(value="select cast(media_gallery as varchar) from bb_product where deleted_at is not null",nativeQuery=true)
    java.util.List<String> deletedMediaGalleries();
    @org.springframework.data.jpa.repository.Query(value="select cast(media_gallery as varchar) from bb_product where deleted_at is null",nativeQuery=true)
    java.util.List<String> activeMediaGalleries();
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select p from Product p where p.id=:id")
    Optional<Product> lockById(@org.springframework.data.repository.query.Param("id") String id);
    String ARCHIVE_SCOPE = """
            from bb_product p
            where p.merchant_id = :owner and p.deleted_at is null
              and (:query = '' or strpos(lower(coalesce(p.item_number, '')), lower(:query)) > 0
                or exists (
                    select 1 from jsonb_each_text(
                        case when jsonb_typeof(p.name) = 'object' then p.name else '{}' end
                    ) as name_entry
                    where strpos(lower(name_entry.value), lower(:query)) > 0
                ))
            """;
    @org.springframework.data.jpa.repository.Query(value = "select p.id " + ARCHIVE_SCOPE + """
            order by p.is_recommended desc, p.updated_at desc nulls last, p.id collate "C"
            limit :limit offset :offset
            """, nativeQuery = true)
    java.util.List<String> archiveIds(long owner, String query, int limit, long offset);

    @org.springframework.data.jpa.repository.Query(value = "select count(*) " + ARCHIVE_SCOPE, nativeQuery = true)
    long archiveCount(long owner, String query);

    java.util.List<Product> findAllByMerchantIdAndIdIn(Long merchantId, java.util.Collection<String> ids);
    java.util.List<Product> findAllByMerchantId(Long merchantId);
    java.util.List<Product> findAllByMerchantIdAndCartEnabledFalseOrderById(Long merchantId);
    boolean existsByMerchantIdAndCartEnabledFalse(Long merchantId);
    boolean existsByIdAndMerchantId(String id, Long merchantId);
    java.util.List<Product> findAllByMerchantIdAndItemNumber(Long merchantId, String itemNumber);
    @org.springframework.data.jpa.repository.Query(value="select count(*) from bb_product where merchant_id=:owner and item_number=:code and deleted_at is not null",nativeQuery=true)
    long deletedCodeCount(@org.springframework.data.repository.query.Param("owner") Long owner,@org.springframework.data.repository.query.Param("code") String code);
    java.util.List<Product> findAllByItemNumber(String itemNumber);
    // Ambiguous source variants require human selection; never pick an arbitrary row.
    default Optional<Product> findByMerchantIdAndItemNumber(Long merchantId, String itemNumber) {
        var matches=findAllByMerchantIdAndItemNumber(merchantId,itemNumber);
        return matches.size()==1?Optional.of(matches.get(0)):Optional.empty();
    }
    default Optional<Product> findByItemNumber(String itemNumber) {
        var matches=findAllByItemNumber(itemNumber);
        return matches.size()==1?Optional.of(matches.get(0)):Optional.empty();
    }
}
