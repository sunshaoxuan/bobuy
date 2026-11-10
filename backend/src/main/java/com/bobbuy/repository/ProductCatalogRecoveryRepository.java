package com.bobbuy.repository;
import com.bobbuy.model.ProductCatalogRecovery;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface ProductCatalogRecoveryRepository extends JpaRepository<ProductCatalogRecovery,String>{
 Optional<ProductCatalogRecovery> findTopByProductIdAndMerchantIdOrderByVersionAfterDesc(String productId,Long merchantId);
}
