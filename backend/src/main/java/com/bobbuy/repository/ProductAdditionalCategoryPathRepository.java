package com.bobbuy.repository;

import com.bobbuy.model.ProductAdditionalCategoryPath;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface ProductAdditionalCategoryPathRepository extends JpaRepository<ProductAdditionalCategoryPath, ProductAdditionalCategoryPath.Key> {
    List<ProductAdditionalCategoryPath> findAllByProductId(String productId);
    List<ProductAdditionalCategoryPath> findAllByProductIdIn(Collection<String> productIds);
    long countByCategoryNodeId(String categoryNodeId);
    void deleteAllByProductId(String productId);
}
