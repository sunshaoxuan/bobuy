package com.bobbuy.repository;

import com.bobbuy.model.ProductPrimaryCategoryPath;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductPrimaryCategoryPathRepository extends JpaRepository<ProductPrimaryCategoryPath, String> {
    long countByCategoryNodeId(String categoryNodeId);
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update ProductPrimaryCategoryPath p set p.categoryNodeId=:category, p.revision=p.revision+1 where p.productId=:product and p.revision=:revision")
    int replaceAtRevision(@Param("product") String productId, @Param("category") String categoryNodeId,
                          @Param("revision") long revision);
}
