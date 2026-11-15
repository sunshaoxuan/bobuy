package com.bobbuy.repository;

import com.bobbuy.model.ProductPrimaryCategoryPath;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductPrimaryCategoryPathRepository extends JpaRepository<ProductPrimaryCategoryPath, String> {
    long countByCategoryNodeId(String categoryNodeId);
}
