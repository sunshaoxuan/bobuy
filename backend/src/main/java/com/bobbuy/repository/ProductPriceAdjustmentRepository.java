package com.bobbuy.repository;
import com.bobbuy.model.ProductPriceAdjustment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface ProductPriceAdjustmentRepository extends JpaRepository<ProductPriceAdjustment,Long> {
 boolean existsByProductId(String productId);
 List<ProductPriceAdjustment> findByProductIdOrderByCreatedAtDescIdDesc(String productId);
}
