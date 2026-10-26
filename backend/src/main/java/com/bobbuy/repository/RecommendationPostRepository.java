package com.bobbuy.repository;

import com.bobbuy.model.RecommendationPost;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface RecommendationPostRepository extends JpaRepository<RecommendationPost, Long> {
    List<RecommendationPost> findByMerchantIdOrderByUpdatedAtDesc(Long merchantId, Pageable page);
    List<RecommendationPost> findByPublishedTrueOrderByPublishedAtDesc(Pageable page);
    Optional<RecommendationPost> findByIdAndMerchantId(Long id, Long merchantId);
    Optional<RecommendationPost> findByIdAndPublishedTrue(Long id);
}
