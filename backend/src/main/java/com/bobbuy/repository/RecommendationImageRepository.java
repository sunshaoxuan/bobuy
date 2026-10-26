package com.bobbuy.repository;

import com.bobbuy.model.RecommendationImage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface RecommendationImageRepository extends JpaRepository<RecommendationImage, String> {
    Optional<RecommendationImage> findByMerchantIdAndImageHash(Long merchantId, String imageHash);
}
