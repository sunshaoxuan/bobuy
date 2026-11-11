package com.bobbuy.repository;
import com.bobbuy.model.ProductReview;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
public interface ProductReviewRepository extends JpaRepository<ProductReview,Long> {
 Optional<ProductReview> findByProductIdAndUserId(String productId,Long userId);
 Slice<ProductReview> findByProductIdOrderByUpdatedAtDescIdDesc(String productId,Pageable page);
 @Query("select r.productId,r.stars,count(r) from ProductReview r where r.productId in :ids group by r.productId,r.stars")
 List<Object[]> buckets(@Param("ids") Collection<String> ids);
}
