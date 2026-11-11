package com.bobbuy.repository;

import com.bobbuy.model.RecommendationItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface RecommendationItemRepository extends JpaRepository<RecommendationItem, Long> {
    // Image authorization uses only associations and gallery URLs, never full snapshots/text.
    interface ImageReference {
        String getProductId();
        String getImageUrl();
        List<RecommendationItem.Picture> getGallery();
    }
    @Query("select i.productId as productId, i.imageUrl as imageUrl, i.gallery as gallery from RecommendationItem i")
    List<ImageReference> imageReferences();
    java.util.Optional<RecommendationItem> findByPublishedByAndPublicationRequestId(Long publishedBy,String publicationRequestId);
    java.util.Optional<RecommendationItem> findByPostIdAndAdditionPayloadHash(Long postId,String additionPayloadHash);
    List<RecommendationItem> findByPostIdOrderById(Long postId);
    List<RecommendationItem> findByProductIdInOrderById(java.util.Collection<String> productIds);
    List<RecommendationItem> findByPostIdInOrderById(List<Long> postIds);
    @Query("select i from RecommendationItem i where i.id in (select min(c.id) from RecommendationItem c where c.postId in :postIds group by c.postId)")
    List<RecommendationItem> findCovers(List<Long> postIds);
    void deleteByPostId(Long postId);
}
