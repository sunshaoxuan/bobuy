package com.bobbuy.repository;
import com.bobbuy.model.RecommendationArticleRevision;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface RecommendationArticleRevisionRepository extends JpaRepository<RecommendationArticleRevision,Long>{
 Optional<RecommendationArticleRevision> findFirstByPostIdOrderByIdDesc(Long postId);
 List<RecommendationArticleRevision> findByMerchantIdAndPostIdOrderById(Long merchantId,Long postId);
}
