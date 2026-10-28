package com.bobbuy.repository;

import com.bobbuy.model.RecommendationImage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;
import org.springframework.data.domain.Pageable;

public interface RecommendationImageRepository extends JpaRepository<RecommendationImage, String> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select i from RecommendationImage i where i.id=:id")
    Optional<RecommendationImage> lock(@org.springframework.data.repository.query.Param("id") String id);
    List<RecommendationImage> findByIdGreaterThanOrderByIdAsc(String after,Pageable page);
    Optional<RecommendationImage> findByMerchantIdAndImageHash(Long merchantId, String imageHash);
}
