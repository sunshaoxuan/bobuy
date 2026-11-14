package com.bobbuy.repository;

import com.bobbuy.model.RecommendationSourceArtifact;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecommendationSourceArtifactRepository extends JpaRepository<RecommendationSourceArtifact,String> {
    Optional<RecommendationSourceArtifact> findBySourceRef(String sourceRef);
}
