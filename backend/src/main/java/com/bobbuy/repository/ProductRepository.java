package com.bobbuy.repository;

import com.bobbuy.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, String> {
    Optional<Product> findByMerchantIdAndItemNumber(Long merchantId, String itemNumber);
    Optional<Product> findByItemNumber(String itemNumber);
}
