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
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select p from Product p where p.id=:id")
    Optional<Product> lockById(@org.springframework.data.repository.query.Param("id") String id);
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
