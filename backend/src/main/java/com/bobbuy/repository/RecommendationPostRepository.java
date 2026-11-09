package com.bobbuy.repository;

import com.bobbuy.model.RecommendationPost;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RecommendationPostRepository extends JpaRepository<RecommendationPost, Long> {
    List<RecommendationPost> findByMerchantIdOrderByUpdatedAtDesc(Long merchantId, Pageable page);
    List<RecommendationPost> findByPublishedTrueOrderByPublishedAtDesc(Pageable page);
    List<RecommendationPost> findByMerchantIdAndPublishedTrueOrderByPublishedAtDesc(Long merchantId, Pageable page);
    List<RecommendationPost> findByPublishedTrue();
    Optional<RecommendationPost> findByIdAndMerchantId(Long id, Long merchantId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from RecommendationPost p where p.id=:id and p.merchantId=:merchantId")
    Optional<RecommendationPost> findOwnedForUpdate(@Param("id") Long id,@Param("merchantId") Long merchantId);
    Optional<RecommendationPost> findByIdAndPublishedTrue(Long id);
    Optional<RecommendationPost> findByMerchantIdAndServiceSourceKey(Long merchantId,String serviceSourceKey);
}
