package com.bobbuy.repository;

import com.bobbuy.model.RecommendationItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface RecommendationItemRepository extends JpaRepository<RecommendationItem, Long> {
    List<RecommendationItem> findByPostIdOrderById(Long postId);
    List<RecommendationItem> findByPostIdInOrderById(List<Long> postIds);
    @Query("select i from RecommendationItem i where i.id in (select min(c.id) from RecommendationItem c where c.postId in :postIds group by c.postId)")
    List<RecommendationItem> findCovers(List<Long> postIds);
    void deleteByPostId(Long postId);
}
